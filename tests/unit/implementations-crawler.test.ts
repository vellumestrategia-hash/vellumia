// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { spawnSync } from "node:child_process";
import * as http from "node:http";
import * as https from "node:https";
import { crawlPublicSite, publicHttpTransport } from "@/lib/implementations/crawler";
import type { CrawlOptions, CrawlRequest, CrawlResponse } from "@/lib/implementations/contracts";
import { parseRobots, robotsAllows } from "@/lib/implementations/robots";
import { extractPublicHtml } from "@/lib/implementations/html";

vi.mock("node:http", () => ({ request: vi.fn() }));
vi.mock("node:https", () => ({ request: vi.fn() }));

const ORIGIN = "https://company.example";
const html = (text: string, links = "") =>
  `<html><head><title>Empresa &amp; serviços</title></head><body><nav>Menu</nav><main><p>${text}</p>${links}</main><script>segredo falso</script></body></html>`;
function response(text: string, status = 200, headers: Record<string, string> = {}): CrawlResponse {
  return {
    status,
    headers: { "content-type": "text/html; charset=utf-8", ...headers },
    body: (async function* () {
      yield Buffer.from(text);
    })(),
  };
}
function fixture(
  pages: Record<string, CrawlResponse | string>,
  robots = "User-agent: *\nAllow: /",
) {
  const requests: CrawlRequest[] = [];
  const options: CrawlOptions = {
    resolve_dns: async () => [{ address: "93.184.216.34", family: 4 }],
    transport: async (request) => {
      requests.push(request);
      if (request.url.pathname === "/robots.txt")
        return response(robots, 200, { "content-type": "text/plain" });
      const page = pages[request.url.href];
      if (page === undefined) return response("", 404);
      return typeof page === "string" ? response(page) : page;
    },
  };
  return { options, requests };
}
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("coleta pública limitada", () => {
  it("recusa prontamente uma única tag com 50 mil atributos distintos", () => {
    const script = `
      import { extractPublicHtml } from './lib/implementations/html.ts';
      const hostile = '<div ' + Array.from({length: 50000}, (_, i) => 'a' + i).join(' ') + '>Public company</div>';
      const started = Date.now();
      let error = null;
      try { extractPublicHtml(hostile, new URL('https://company.example')); }
      catch (caught) { error = caught.message; }
      process.stdout.write(JSON.stringify({error, elapsed_ms: Date.now() - started}));
    `;
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", "--input-type=module", "-e", script],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        timeout: 5000,
        windowsHide: true,
        env: { SystemRoot: process.env.SystemRoot ?? "C:/Windows" },
      },
    );
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ error: "html_complexity_limit" });
    expect(JSON.parse(result.stdout).elapsed_ms).toBeLessThan(1000);
  });
  it("interrompe a acumulação de atributos no deadline controlado antes de emitir a tag", () => {
    const hostile = `<div ${Array.from({ length: 2000 }, (_, i) => `a${i}`).join(" ")}>Empresa</div>`;
    let now = 0;
    const clock = vi.spyOn(Date, "now").mockImplementation(() => now++);
    try {
      expect(() => extractPublicHtml(hostile, new URL(ORIGIN), { deadline_at: 50 })).toThrow(
        "crawl_timeout",
      );
    } finally {
      clock.mockRestore();
    }
  });
  it("interrompe tokenizer dentro de um valor longo antes do callback da tag", () => {
    const hostile = `<div title="${"x".repeat(50_000)}">Empresa</div>`;
    let now = 0;
    const clock = vi.spyOn(Date, "now").mockImplementation(() => now++);
    try {
      expect(() => extractPublicHtml(hostile, new URL(ORIGIN), { deadline_at: 50 })).toThrow(
        "crawl_timeout",
      );
    } finally {
      clock.mockRestore();
    }
  });
  it("contabiliza tentativas de atributo duplicado no orçamento da tag", () => {
    expect(() =>
      extractPublicHtml(`<div ${'a="1" '.repeat(2000)}>Empresa</div>`, new URL(ORIGIN)),
    ).toThrow("html_complexity_limit");
  });
  it("preserva HTML5 com valores citados, entidades e atributos em tags diferentes", () => {
    const attributes = Array.from({ length: 100 }, (_, i) => `a${i}="${i}"`).join(" ");
    const page = `<main><div ${attributes} title="${"a=1 ".repeat(2000)}">Empresa &amp; serviços</div><p ${attributes}>Atendimento público</p></main>`;
    expect(extractPublicHtml(page, new URL(ORIGIN)).text).toBe(
      "Empresa & serviços\nAtendimento público",
    );
  });
  it("recusa HTML excessivamente profundo antes de construir uma árvore hostil", async () => {
    const f = fixture({
      [`${ORIGIN}/`]: html(`${"<div>".repeat(200)}Texto da empresa.${"</div>".repeat(200)}`),
    });
    await expect(crawlPublicSite(ORIGIN, f.options)).rejects.toThrow("html_complexity_limit");
  });
  it("recusa excesso de tokens HTML mesmo abaixo do limite de bytes", async () => {
    const f = fixture({ [`${ORIGIN}/`]: html("<p>Informação da empresa.</p>".repeat(5001)) });
    await expect(crawlPublicSite(ORIGIN, f.options)).rejects.toThrow("html_complexity_limit");
  });
  it("não inicia parsing quando o prazo absoluto já expirou", () => {
    expect(() =>
      extractPublicHtml(html("Informações da empresa."), new URL(ORIGIN), {
        deadline_at: Date.now() - 1,
      }),
    ).toThrow("crawl_timeout");
  });
  it("não amplia o prazo máximo de 90 segundos via opções", async () => {
    vi.useFakeTimers();
    const outcome = crawlPublicSite(ORIGIN, {
      timeout_ms: 999_999,
      resolve_dns: async () => new Promise(() => {}),
    }).then(
      () => undefined,
      (error: Error) => error,
    );
    await vi.advanceTimersByTimeAsync(90_001);
    expect((await outcome)?.message).toBe("crawl_timeout");
  });
  it("não amplia o limite padrão de 1 MB por resposta", async () => {
    const f = fixture({ [`${ORIGIN}/`]: response("x".repeat(1024 * 1024 + 1)) });
    await expect(
      crawlPublicSite(ORIGIN, { ...f.options, max_response_bytes: 999_999_999 }),
    ).rejects.toThrow("response_bytes_limit");
  });
  it("não amplia o limite padrão de 2 MB no total", async () => {
    const pages: Record<string, string> = {
      [`${ORIGIN}/`]: html(
        "Conheça nossos serviços.",
        Array.from({ length: 5 }, (_, i) => `<a href="/servicos/${i}">Serviço</a>`).join(""),
      ),
    };
    for (let i = 0; i < 5; i++)
      pages[`${ORIGIN}/servicos/${i}`] = html(`Serviço ${i}: ${"x".repeat(600_000)}`);
    const f = fixture(pages);
    const result = await crawlPublicSite(ORIGIN, { ...f.options, max_total_bytes: 999_999_999 });
    expect(result.pages).toHaveLength(4);
    expect(result.warnings.join(" ")).toContain("total_bytes_limit");
  });
  it("não resolve DNS nem transporta quando a coleta já foi cancelada", async () => {
    const f = fixture({});
    const controller = new AbortController();
    controller.abort();
    let lookups = 0;
    await expect(
      crawlPublicSite(ORIGIN, {
        ...f.options,
        signal: controller.signal,
        resolve_dns: async () => {
          lookups++;
          return [{ address: "93.184.216.34", family: 4 }];
        },
      }),
    ).rejects.toThrow("crawl_aborted");
    expect(lookups).toBe(0);
    expect(f.requests).toEqual([]);
  });
  it("mantém um espaço entre células HTML e ignora texto oculto", async () => {
    const f = fixture({
      [`${ORIGIN}/`]:
        '<html><title>Contato</title><body><main><table><tr><td>Preço:</td><td>R$ 500</td></tr></table><p hidden>desconto falso</p><p aria-hidden="true">outro falso</p></main></body></html>',
    });
    expect((await crawlPublicSite(ORIGIN, f.options)).pages[0]?.text).toBe("Preço: R$ 500");
  });
  it("recusa UTF-8 malformado sem fabricar caracteres de evidência", async () => {
    const f = fixture({
      [`${ORIGIN}/`]: {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
        body: (async function* () {
          yield Uint8Array.from([0xc3, 0x28]);
        })(),
      },
    });
    await expect(crawlPublicSite(ORIGIN, f.options)).rejects.toThrow("unsupported_charset");
  });
  it("decodifica charset declarado e recusa compressão não solicitada", async () => {
    const f = fixture({
      [`${ORIGIN}/`]: {
        status: 200,
        headers: { "content-type": "text/html; charset=iso-8859-1" },
        body: (async function* () {
          yield Buffer.from("<html><body><main>Preço: R$ 500</main></body></html>", "latin1");
        })(),
      },
    });
    expect((await crawlPublicSite(ORIGIN, f.options)).pages[0]?.text).toBe("Preço: R$ 500");
    const compressed = fixture({
      [`${ORIGIN}/`]: response("gzip", 200, { "content-encoding": "gzip" }),
    });
    await expect(crawlPublicSite(ORIGIN, compressed.options)).rejects.toThrow(
      "unsupported_content_encoding",
    );
  });
  it("extrai HTML com entidades sem scripts e registra fonte, data e hash estável", async () => {
    const f = fixture({ [`${ORIGIN}/`]: html("Atendemos empresas &amp; profissionais.") });
    const a = await crawlPublicSite(`${ORIGIN}/#top`, f.options);
    const b = await crawlPublicSite(`${ORIGIN}/`, f.options);
    expect(a.pages).toHaveLength(1);
    expect(a.pages[0]).toMatchObject({
      url: `${ORIGIN}/`,
      title: "Empresa & serviços",
      text: "Atendemos empresas & profissionais.",
    });
    expect(a.pages[0]?.captured_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(a.content_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(a.content_hash).toBe(b.content_hash);
  });
  it("visita somente links relevantes da mesma origem, profundidade um e deduplica texto", async () => {
    const f = fixture({
      [`${ORIGIN}/`]: html(
        "Empresa de consultoria.",
        '<a href="/servicos#one">Serviços</a><a href="/contato">Contato</a><a href="https://other.example/servicos">Outro</a><a href="/login">Login</a>',
      ),
      [`${ORIGIN}/servicos`]: html(
        "Consultoria empresarial especializada.",
        '<nav><a href="/precos">Preços</a></nav>',
      ),
      [`${ORIGIN}/contato`]: html("Consultoria empresarial especializada."),
    });
    const result = await crawlPublicSite(ORIGIN, f.options);
    expect(result.pages.map((p) => p.url)).toEqual([`${ORIGIN}/`, `${ORIGIN}/servicos`]);
    expect(
      f.requests.filter((r) => r.url.pathname !== "/robots.txt").map((r) => r.url.href),
    ).toEqual([`${ORIGIN}/`, `${ORIGIN}/servicos`, `${ORIGIN}/contato`]);
    expect(result.warnings.join(" ")).toContain("duplicate_content");
  });
  it("limita seis tentativas de páginas mesmo quando os links são duplicados ou falham", async () => {
    const links = Array.from({ length: 9 }, (_, i) => `<a href="/servicos/${i}">Serviço</a>`).join(
      "",
    );
    const f = fixture({ [`${ORIGIN}/`]: html("Conheça todos os serviços.", links) });
    await crawlPublicSite(ORIGIN, { ...f.options, max_pages: 999, max_depth: 99 });
    expect(f.requests.filter((r) => r.url.pathname !== "/robots.txt")).toHaveLength(6);
  });
  it("respeita uma redução explícita de páginas e profundidade", async () => {
    const f = fixture({
      [`${ORIGIN}/`]: html("Serviços disponíveis.", '<a href="/servicos">Serviços</a>'),
    });
    await crawlPublicSite(ORIGIN, { ...f.options, max_depth: 0, max_pages: 1 });
    expect(f.requests.map((r) => r.url.pathname)).toEqual(["/robots.txt", "/"]);
  });
  it("recusa resposta maior que o limite e cancela o stream", async () => {
    let cancelled = false;
    const oversized = response("x".repeat(200));
    oversized.cancel = () => {
      cancelled = true;
    };
    const f = fixture({ [`${ORIGIN}/`]: oversized });
    await expect(
      crawlPublicSite(ORIGIN, { ...f.options, max_response_bytes: 100 }),
    ).rejects.toThrow("response_bytes_limit");
    expect(cancelled).toBe(true);
  });
  it("contabiliza robots e páginas no limite total", async () => {
    const f = fixture({
      [`${ORIGIN}/`]: html("Conheça os serviços.", '<a href="/servicos">Serviços</a>'),
      [`${ORIGIN}/servicos`]: html("x".repeat(300)),
    });
    const result = await crawlPublicSite(ORIGIN, { ...f.options, max_total_bytes: 400 });
    expect(result.pages).toHaveLength(1);
    expect(result.warnings.join(" ")).toContain("total_bytes_limit");
  });
  it("interrompe transporte que ignora AbortSignal no prazo global", async () => {
    vi.useFakeTimers();
    const promise = crawlPublicSite(ORIGIN, {
      timeout_ms: 25,
      resolve_dns: async () => [{ address: "93.184.216.34", family: 4 }],
      transport: async () => new Promise(() => {}),
    });
    const outcome = promise.then(
      () => undefined,
      (error: Error) => error,
    );
    await vi.advanceTimersByTimeAsync(26);
    expect((await outcome)?.message).toContain("crawl_timeout");
  });
  it("interrompe corpo pendente e cancela a resposta no prazo global", async () => {
    vi.useFakeTimers();
    let cancelled = false;
    const f = fixture({
      [`${ORIGIN}/`]: {
        status: 200,
        headers: { "content-type": "text/html" },
        body: { [Symbol.asyncIterator]: () => ({ next: () => new Promise(() => {}) }) },
        cancel: () => {
          cancelled = true;
        },
      },
    });
    const outcome = crawlPublicSite(ORIGIN, { ...f.options, timeout_ms: 25 }).then(
      () => undefined,
      (error: Error) => error,
    );
    await vi.advanceTimersByTimeAsync(26);
    expect((await outcome)?.message).toContain("crawl_timeout");
    expect(cancelled).toBe(true);
  });
  it("não tenta contornar autenticação nem trata PDF como HTML", async () => {
    const f = fixture({ [`${ORIGIN}/`]: response("login", 401) });
    const result = await crawlPublicSite(ORIGIN, f.options);
    expect(result.pages).toEqual([]);
    expect(result.warnings.join(" ")).toContain("http_status:401");
    const pdf = fixture({
      [`${ORIGIN}/`]: response("%PDF-1.7", 200, { "content-type": "application/pdf" }),
    });
    expect((await crawlPublicSite(ORIGIN, pdf.options)).pages).toEqual([]);
  });
});

describe("SSRF e conexão validada", () => {
  it.each([
    "http://127.0.0.1",
    "http://10.0.0.1",
    "http://172.16.0.1",
    "http://192.168.1.1",
    "http://169.254.169.254",
    "http://100.64.0.1",
    "http://2130706433",
    "http://0x7f000001",
    "http://[::1]",
    "http://[fc00::1]",
    "http://[fe90::1]",
    "http://[::ffff:127.0.0.1]",
    "http://[::ffff:7f00:1]",
    "http://[2002:7f00:1::]",
    "http://[64:ff9b::a00:1]",
    "http://localhost",
    "http://server.localhost",
    "https://user:pass@company.example",
    "https://company.example:8443",
    "http://company.example:443",
    "file:///etc/passwd",
  ])("recusa URL insegura %s antes de transportar", async (url) => {
    const f = fixture({});
    await expect(crawlPublicSite(url, f.options)).rejects.toThrow("unsafe_url");
    expect(f.requests).toEqual([]);
  });
  it("recusa DNS misto com qualquer endereço privado", async () => {
    const f = fixture({});
    await expect(
      crawlPublicSite(ORIGIN, {
        ...f.options,
        resolve_dns: async () => [
          { address: "93.184.216.34", family: 4 },
          { address: "10.1.1.1", family: 4 },
        ],
      }),
    ).rejects.toThrow("unsafe_url:private_ip");
    expect(f.requests).toEqual([]);
  });
  it("fixa IP público e revalida DNS na conexão seguinte, impedindo rebinding", async () => {
    const f = fixture({ [`${ORIGIN}/`]: html("Serviços públicos.") });
    let lookups = 0;
    await expect(
      crawlPublicSite(ORIGIN, {
        ...f.options,
        resolve_dns: async () => [
          { address: ++lookups === 1 ? "93.184.216.34" : "127.0.0.1", family: 4 },
        ],
      }),
    ).rejects.toThrow("unsafe_url:private_ip");
    expect(f.requests).toHaveLength(1);
    expect(f.requests[0]).toMatchObject({ address: "93.184.216.34", family: 4 });
  });
  it("recusa salto de redirect para metadata mesmo após primeira conexão segura", async () => {
    const f = fixture({
      [`${ORIGIN}/`]: response("", 302, { location: "http://169.254.169.254/latest/meta-data" }),
    });
    await expect(crawlPublicSite(ORIGIN, f.options)).rejects.toThrow("unsafe_url");
    expect(f.requests).toHaveLength(2);
  });
  it("limita a cadeia a quatro redirecionamentos", async () => {
    const pages: Record<string, CrawlResponse> = {};
    for (let i = 0; i < 6; i++)
      pages[`${ORIGIN}/${i}`] = response("", 302, { location: `/${i + 1}` });
    const f = fixture(pages);
    await expect(
      crawlPublicSite(`${ORIGIN}/0`, { ...f.options, max_redirects: 999 }),
    ).rejects.toThrow("redirect_limit");
    expect(f.requests.filter((r) => r.url.pathname !== "/robots.txt")).toHaveLength(5);
  });
});

describe("robots por origem e caminho alvo", () => {
  it.each([
    ["/*.php$", "/private.php/secret.php", false],
    ["/*.php$", "/private.php", false],
    ["/*.php$", "/private.php/public.html", true],
    ["/*.php$", "/private.php?modo=publico", true],
    ["/*secret*.php$", "/secret.php/secret.php", false],
    ["/private.php$", "/private.php/secret.php", true],
    ["/private.php$", "/private.php", false],
    ["/*foo$", "/foo/foofoo", false],
  ])("respeita a âncora final da regra %s no caminho %s", (rule, path, allowed) => {
    expect(
      robotsAllows(parseRobots(`User-agent: *\nDisallow: ${rule}`), new URL(`${ORIGIN}${path}`)),
    ).toBe(allowed);
  });
  it("recusa o GET quando wildcard com sufixo repetido termina em Disallow", async () => {
    const url = `${ORIGIN}/private.php/secret.php`;
    const f = fixture(
      { [url]: html("Informações da empresa.") },
      "User-agent: *\nDisallow: /*.php$",
    );
    const result = await crawlPublicSite(url, f.options);
    expect(result.pages).toEqual([]);
    expect(f.requests.map((request) => request.url.pathname)).toEqual(["/robots.txt"]);
    expect(result.warnings.join(" ")).toContain("robots_disallowed");
  });
  it("mantém o orçamento global ao expandir wildcard para procurar sufixo final repetido", () => {
    const policy = parseRobots(`User-agent: *\nDisallow: /*${"a".repeat(100)}$`);
    expect(() => robotsAllows(policy, new URL(`${ORIGIN}/${"a".repeat(1500)}b`))).toThrow(
      "robots_complexity_limit",
    );
  });
  it("compara muitos wildcards sem regex nem retrocesso exponencial", () => {
    const policy = parseRobots(`User-agent: *\nDisallow: /${"a*".repeat(500)}z$`);
    expect(robotsAllows(policy, new URL(`${ORIGIN}/${"a".repeat(1000)}`))).toBe(true);
  });
  it("normaliza unreserved, preserva barra codificada e considera query", () => {
    const policy = parseRobots(
      "User-agent: *\nDisallow: /servicos%2Fprivado\nDisallow: /precos?modo=interno$\nDisallow: /%73obre\nAllow: /sobre/publico",
    );
    expect(robotsAllows(policy, new URL(`${ORIGIN}/servicos%2fprivado`))).toBe(false);
    expect(robotsAllows(policy, new URL(`${ORIGIN}/servicos/privado`))).toBe(true);
    expect(robotsAllows(policy, new URL(`${ORIGIN}/precos?modo=interno`))).toBe(false);
    expect(robotsAllows(policy, new URL(`${ORIGIN}/sobre/publico`))).toBe(true);
  });
  it("recusa HTML/CAPTCHA servido no lugar de robots.txt", async () => {
    const f = fixture({ [`${ORIGIN}/`]: html("Serviços públicos.") });
    f.options.transport = async (request) => {
      f.requests.push(request);
      return request.url.pathname === "/robots.txt"
        ? response("<html><body>Faça login</body></html>")
        : response(html("Serviços públicos."));
    };
    const result = await crawlPublicSite(ORIGIN, f.options);
    expect(result.pages).toEqual([]);
    expect(result.warnings.join(" ")).toContain("robots_unavailable");
    expect(f.requests).toHaveLength(1);
  });
  it("falha fechado quando o número de regras hostis ultrapassa o orçamento", () => {
    expect(() => parseRobots(`User-agent: *\n${"Disallow: /privado\n".repeat(2001)}`)).toThrow(
      "robots_rules_limit",
    );
  });
  it("falha fechado quando comparações de caminhos ultrapassam o orçamento de CPU", () => {
    const path = `/${"a".repeat(80)}z`;
    const policy = parseRobots(`User-agent: *\n${`Disallow: ${path}\n`.repeat(2000)}`);
    expect(() => robotsAllows(policy, new URL(`${ORIGIN}/${"a".repeat(81)}`))).toThrow(
      "robots_complexity_limit",
    );
  });
  it("aplica o Allow mais específico com wildcard, query e âncora final", async () => {
    const f = fixture(
      { [`${ORIGIN}/servicos/publico`]: html("Serviço público disponível.") },
      "User-agent: *\nDisallow: /servicos/*\nAllow: /servicos/publico$",
    );
    expect((await crawlPublicSite(`${ORIGIN}/servicos/publico`, f.options)).pages).toHaveLength(1);
    expect((await crawlPublicSite(`${ORIGIN}/servicos/privado`, f.options)).pages).toEqual([]);
  });
  it("seleciona grupo do crawler acima do grupo genérico", async () => {
    const f = fixture(
      { [`${ORIGIN}/`]: html("Informações da empresa.") },
      "User-agent: *\nDisallow: /\n\nUser-agent: VellumImplementationCrawler\nAllow: /",
    );
    expect((await crawlPublicSite(ORIGIN, f.options)).pages).toHaveLength(1);
  });
  it("verifica robots do destino antes de seguir redirect entre origens", async () => {
    const f = fixture({
      [`${ORIGIN}/`]: response("", 301, { location: "https://other.example/privado" }),
    });
    f.options.transport = async (request) => {
      f.requests.push(request);
      if (request.url.hostname === "other.example")
        return response("User-agent: *\nDisallow: /privado", 200, { "content-type": "text/plain" });
      return request.url.pathname === "/robots.txt"
        ? response("User-agent: *\nAllow: /", 200, { "content-type": "text/plain" })
        : response("", 301, { location: "https://other.example/privado" });
    };
    const result = await crawlPublicSite(ORIGIN, f.options);
    expect(result.pages).toEqual([]);
    expect(result.warnings.join(" ")).toContain("robots_disallowed");
    expect(f.requests.map((r) => r.url.href)).toEqual([
      `${ORIGIN}/robots.txt`,
      `${ORIGIN}/`,
      "https://other.example/robots.txt",
    ]);
  });
  it("falha fechado quando robots está indisponível", async () => {
    const f = fixture({});
    f.options.transport = async (request) => {
      f.requests.push(request);
      return response("", 503);
    };
    const result = await crawlPublicSite(ORIGIN, f.options);
    expect(result.pages).toEqual([]);
    expect(result.warnings.join(" ")).toContain("robots_unavailable");
    expect(f.requests).toHaveLength(1);
  });
});

describe("transporte HTTP de produção sem rede real", () => {
  it("limita o stream de produção antes de entregar um chunk acima do orçamento", async () => {
    const incoming = Object.assign(new PassThrough(), {
      statusCode: 200,
      headers: { "content-type": "text/html" },
    });
    const outgoing = Object.assign(new EventEmitter(), {
      setTimeout: vi.fn(),
      destroy: vi.fn(),
      end: vi.fn(),
    });
    vi.mocked(https.request).mockImplementation(((
      _url: unknown,
      _options: unknown,
      callback: (response: unknown) => void,
    ) => {
      outgoing.end.mockImplementation(() => {
        callback(incoming);
        incoming.end(Buffer.alloc(101));
      });
      return outgoing;
    }) as unknown as typeof https.request);
    const response = await publicHttpTransport({
      url: new URL(ORIGIN),
      address: "93.184.216.34",
      family: 4,
      signal: new AbortController().signal,
      timeout_ms: 90_000,
      max_bytes: 100,
    });
    const read = async () => {
      for await (const chunk of response.body) {
        expect(chunk.byteLength).toBeLessThanOrEqual(100);
      }
    };
    await expect(read()).rejects.toThrow("response_bytes_limit");
    expect(incoming.destroyed).toBe(true);
  });
  it("mantém URL/hostname TLS original e usa lookup fixo, sem pool ou credenciais", async () => {
    const incoming = Object.assign(new PassThrough(), {
      statusCode: 200,
      headers: { "content-type": "text/html" },
    });
    const outgoing = Object.assign(new EventEmitter(), {
      setTimeout: vi.fn(),
      destroy: vi.fn(),
      end: vi.fn(),
    });
    vi.mocked(https.request).mockImplementation(((
      _url: unknown,
      _options: unknown,
      callback: (response: unknown) => void,
    ) => {
      outgoing.end.mockImplementation(() => callback(incoming));
      return outgoing;
    }) as unknown as typeof https.request);
    const response = await publicHttpTransport({
      url: new URL(ORIGIN),
      address: "93.184.216.34",
      family: 4,
      signal: new AbortController().signal,
      timeout_ms: 90_000,
      max_bytes: 1024,
    });
    const [url, requestOptions] = vi.mocked(https.request).mock.calls[0]!;
    expect(url).toEqual(new URL(ORIGIN));
    expect(requestOptions).toMatchObject({
      rejectUnauthorized: true,
      agent: false,
      family: 4,
      autoSelectFamily: false,
      headers: { "Accept-Encoding": "identity" },
    });
    const lookup = (requestOptions as https.RequestOptions).lookup!;
    const single = vi.fn();
    const all = vi.fn();
    lookup("company.example", {}, single);
    lookup("company.example", { all: true }, all);
    expect(single.mock.calls).toEqual([[null, "93.184.216.34", 4]]);
    expect(all.mock.calls).toEqual([[null, [{ address: "93.184.216.34", family: 4 }]]]);
    expect(vi.mocked(http.request).mock.calls).toEqual([]);
    response.cancel?.();
    expect(incoming.destroyed).toBe(true);
  });
  it("propaga erro de validação TLS em vez de tentar fallback HTTP", async () => {
    const outgoing = Object.assign(new EventEmitter(), {
      setTimeout: vi.fn(),
      destroy: vi.fn(),
      end: () => queueMicrotask(() => outgoing.emit("error", new Error("CERT_HAS_EXPIRED"))),
    });
    vi.mocked(https.request).mockImplementation(
      (() => outgoing) as unknown as typeof https.request,
    );
    await expect(
      publicHttpTransport({
        url: new URL(ORIGIN),
        address: "93.184.216.34",
        family: 4,
        signal: new AbortController().signal,
        timeout_ms: 25,
        max_bytes: 100,
      }),
    ).rejects.toThrow("CERT_HAS_EXPIRED");
  });
});
