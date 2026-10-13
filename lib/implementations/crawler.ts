import { createHash } from "node:crypto";
import * as http from "node:http";
import * as https from "node:https";
import type { LookupFunction } from "node:net";
import {
  CRAWL_LIMITS,
  type CrawlOptions,
  type CrawlRequest,
  type CrawlResponse,
  type CrawlResult,
  type CrawlTransport,
} from "./contracts";
import { parsePublicUrl, resolvePublicAddress } from "./public-url";
import { extractPublicHtml } from "./html";
import { CRAWLER_USER_AGENT, parseRobots, robotsAllows, type RobotsPolicy } from "./robots";

/** Uma conexão nova por salto; lookup fixo não faz uma segunda resolução DNS. */
export const publicHttpTransport: CrawlTransport = async (request: CrawlRequest) =>
  new Promise((resolve, reject) => {
    const pinnedLookup: LookupFunction = (_hostname, options, callback) => {
      if (options.all) callback(null, [{ address: request.address, family: request.family }]);
      else callback(null, request.address, request.family);
    };
    const client = request.url.protocol === "https:" ? https : http;
    const requestOptions: https.RequestOptions & { autoSelectFamily: boolean } = {
      method: "GET",
      agent: false,
      lookup: pinnedLookup,
      family: request.family,
      autoSelectFamily: false,
      signal: request.signal,
      ...(request.url.protocol === "https:" ? { rejectUnauthorized: true } : {}),
      headers: {
        "User-Agent": `${CRAWLER_USER_AGENT}/1.0`,
        Accept: "text/html,text/plain;q=0.9",
        "Accept-Encoding": "identity",
      },
    };
    const outgoing = client.request(request.url, requestOptions, (incoming) => {
      const headers: Record<string, string | undefined> = {};
      for (const [name, value] of Object.entries(incoming.headers))
        headers[name.toLowerCase()] = Array.isArray(value) ? value.join(", ") : value;
      const cancel = () => {
        incoming.destroy();
        outgoing.destroy();
      };
      const body = (async function* () {
        let bytes = 0;
        try {
          for await (const chunk of incoming) {
            bytes += chunk.byteLength;
            if (bytes > request.max_bytes) throw new Error("response_bytes_limit");
            yield chunk as Uint8Array;
          }
        } finally {
          cancel();
        }
      })();
      resolve({ status: incoming.statusCode ?? 0, headers, body, cancel });
    });
    outgoing.setTimeout(request.timeout_ms, () => outgoing.destroy(new Error("crawl_timeout")));
    outgoing.on("error", reject);
    outgoing.end();
  });

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(signal.reason ?? new Error("crawl_aborted"));
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(signal.reason ?? new Error("crawl_aborted"));
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort));
  });
}
function hash(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}
function boundedOption(value: number | undefined, maximum: number, minimum = 1): number {
  if (value === undefined) return maximum;
  if (!Number.isSafeInteger(value) || value < minimum) throw new Error("invalid_crawl_options");
  return Math.min(value, maximum);
}
function header(response: CrawlResponse, name: string): string | undefined {
  return Object.entries(response.headers).find(([key]) => key.toLowerCase() === name)?.[1];
}
const REDIRECTS = new Set([301, 302, 303, 307, 308]);

export async function crawlPublicSite(
  input: string,
  options: CrawlOptions = {},
): Promise<CrawlResult> {
  const start = parsePublicUrl(input);
  const limits = {
    max_pages: boundedOption(options.max_pages, CRAWL_LIMITS.max_pages),
    max_depth: boundedOption(options.max_depth, CRAWL_LIMITS.max_depth, 0),
    max_redirects: boundedOption(options.max_redirects, CRAWL_LIMITS.max_redirects, 0),
    max_response_bytes: boundedOption(options.max_response_bytes, CRAWL_LIMITS.max_response_bytes),
    max_total_bytes: boundedOption(options.max_total_bytes, CRAWL_LIMITS.max_total_bytes),
    timeout_ms: boundedOption(options.timeout_ms, CRAWL_LIMITS.timeout_ms),
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("crawl_timeout")), limits.timeout_ms);
  const onParentAbort = () => controller.abort(new Error("crawl_aborted"));
  if (options.signal?.aborted) onParentAbort();
  options.signal?.addEventListener("abort", onParentAbort, { once: true });
  const signal = controller.signal;
  const deadline = Date.now() + limits.timeout_ms;
  function checkDeadline(): void {
    if (Date.now() >= deadline && !signal.aborted) controller.abort(new Error("crawl_timeout"));
    if (signal.aborted) throw signal.reason;
  }
  const transport = options.transport ?? publicHttpTransport;
  const result: CrawlResult = { pages: [], content_hash: "", warnings: [] };
  let totalBytes = 0;
  const robots = new Map<string, RobotsPolicy | null>();
  const seenUrls = new Set<string>();
  const seenHashes = new Set<string>();

  async function connect(url: URL): Promise<CrawlResponse> {
    checkDeadline();
    const address = await abortable(resolvePublicAddress(url, options.resolve_dns), signal);
    checkDeadline();
    const pending = transport({
      url,
      ...address,
      signal,
      timeout_ms: Math.max(1, deadline - Date.now()),
      max_bytes: Math.min(limits.max_response_bytes, limits.max_total_bytes - totalBytes),
    });
    // Mesmo transporte injetado que ignora AbortSignal tem prazo; resposta tardia é fechada.
    pending.then(
      (response) => {
        if (signal.aborted) response.cancel?.();
      },
      () => {},
    );
    return abortable(pending, signal);
  }
  async function readBody(response: CrawlResponse): Promise<string> {
    const iterator = response.body[Symbol.asyncIterator]();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
      const contentLength = Number(header(response, "content-length"));
      if (contentLength > limits.max_response_bytes) throw new Error("response_bytes_limit");
      if (contentLength > limits.max_total_bytes - totalBytes) throw new Error("total_bytes_limit");
      if (
        header(response, "content-encoding") &&
        header(response, "content-encoding") !== "identity"
      )
        throw new Error("unsupported_content_encoding");
      while (true) {
        checkDeadline();
        const next = await abortable(iterator.next(), signal);
        if (next.done) break;
        bytes += next.value.byteLength;
        totalBytes += next.value.byteLength;
        if (bytes > limits.max_response_bytes) throw new Error("response_bytes_limit");
        if (totalBytes > limits.max_total_bytes) throw new Error("total_bytes_limit");
        chunks.push(next.value);
      }
      const body = Buffer.concat(chunks);
      const charset =
        /charset\s*=\s*["']?([^\s;"']+)/i.exec(header(response, "content-type") ?? "")?.[1] ??
        "utf-8";
      try {
        return new TextDecoder(charset, { fatal: true }).decode(body);
      } catch {
        throw new Error("unsupported_charset");
      }
    } finally {
      response.cancel?.();
      void iterator.return?.().catch(() => {});
    }
  }
  async function getRobots(url: URL): Promise<RobotsPolicy | null> {
    if (robots.has(url.origin)) return robots.get(url.origin) ?? null;
    let target = parsePublicUrl(new URL("/robots.txt", url).href);
    for (let redirects = 0; ; redirects++) {
      const response = await connect(target);
      if (REDIRECTS.has(response.status)) {
        response.cancel?.();
        const location = header(response, "location");
        if (!location || redirects >= limits.max_redirects) throw new Error("redirect_limit");
        target = parsePublicUrl(new URL(location, target).href);
        continue;
      }
      if (response.status === 404 || response.status === 410) {
        response.cancel?.();
        const policy = { rules: [] };
        robots.set(url.origin, policy);
        return policy;
      }
      if (
        response.status < 200 ||
        response.status >= 300 ||
        !/^text\/plain(?:;|$)/i.test(header(response, "content-type") ?? "")
      ) {
        response.cancel?.();
        robots.set(url.origin, null);
        result.warnings.push(`robots_unavailable:${url.origin}`);
        return null;
      }
      const policy = parseRobots(await readBody(response));
      robots.set(url.origin, policy);
      return policy;
    }
  }
  async function getPage(
    url: URL,
    origin?: string,
  ): Promise<{ response: CrawlResponse; url: URL } | undefined> {
    let target = url;
    for (let redirects = 0; ; redirects++) {
      target = parsePublicUrl(target.href);
      if (origin && target.origin !== origin) {
        result.warnings.push(`off_origin_redirect:${url.href}`);
        return;
      }
      const policy = await getRobots(target);
      if (!policy || !robotsAllows(policy, target)) {
        result.warnings.push(`robots_disallowed:${target.href}`);
        return;
      }
      const response = await connect(target);
      if (!REDIRECTS.has(response.status)) return { response, url: target };
      response.cancel?.();
      const location = header(response, "location");
      if (!location || redirects >= limits.max_redirects) throw new Error("redirect_limit");
      target = parsePublicUrl(new URL(location, target).href);
    }
  }
  try {
    const queue: Array<{ url: URL; depth: number }> = [{ url: start, depth: 0 }];
    let attempts = 0;
    let origin: string | undefined;
    while (queue.length && attempts < limits.max_pages) {
      const entry = queue.shift()!;
      if (seenUrls.has(entry.url.href)) continue;
      seenUrls.add(entry.url.href);
      attempts++;
      try {
        const page = await getPage(entry.url, entry.depth > 0 ? origin : undefined);
        if (!page) continue;
        const { response, url } = page;
        if (response.status !== 200) {
          response.cancel?.();
          result.warnings.push(`http_status:${response.status}:${url.href}`);
          continue;
        }
        if (
          !/^(?:text\/html|application\/xhtml\+xml)(?:;|$)/i.test(
            header(response, "content-type") ?? "",
          )
        ) {
          response.cancel?.();
          result.warnings.push(`unsupported_content_type:${url.href}`);
          continue;
        }
        const extracted = extractPublicHtml(await readBody(response), url, {
          deadline_at: deadline,
        });
        checkDeadline();
        origin ??= url.origin;
        seenUrls.add(url.href);
        if (!extracted.text) {
          result.warnings.push(`empty_text:${url.href}`);
          continue;
        }
        const contentHash = hash(extracted.text);
        if (seenHashes.has(contentHash)) result.warnings.push(`duplicate_content:${url.href}`);
        else {
          seenHashes.add(contentHash);
          result.pages.push({
            url: url.href,
            title: extracted.title,
            text: extracted.text,
            captured_at: new Date().toISOString(),
            content_hash: contentHash,
          });
        }
        if (entry.depth < limits.max_depth)
          for (const link of extracted.links)
            if (!seenUrls.has(link) && !queue.some((item) => item.url.href === link))
              queue.push({ url: parsePublicUrl(link), depth: entry.depth + 1 });
      } catch (error) {
        const code = error instanceof Error ? error.message : "crawl_failed";
        if (entry.depth === 0) throw error;
        // Mensagens externas não devem vazar dados do servidor.
        const safeCode =
          /^(?:unsafe_url:[a-z_]+|response_bytes_limit|total_bytes_limit|crawl_timeout|crawl_aborted|redirect_limit|unsupported_charset|unsupported_content_encoding|html_complexity_limit|robots_rules_limit|robots_complexity_limit)$/.test(
            code,
          )
            ? code
            : "crawl_failed";
        result.warnings.push(`${safeCode}:${entry.url.href}`);
        if (signal.aborted || totalBytes >= limits.max_total_bytes) break;
      }
    }
    if (queue.length) result.warnings.push("page_limit");
    result.content_hash = hash([...seenHashes].sort().join("\n"));
    return result;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", onParentAbort);
    controller.abort(new Error("crawl_finished"));
  }
}
