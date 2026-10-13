export const CRAWLER_USER_AGENT = "VellumImplementationCrawler";
export interface RobotsRule {
  allow: boolean;
  path: string;
}
export interface RobotsPolicy {
  rules: RobotsRule[];
}
interface Group {
  agents: string[];
  rules: RobotsRule[];
}
/** Grupos mais específicos são combinados; o grupo genérico só é fallback. */
export function parseRobots(text: string, userAgent = CRAWLER_USER_AGENT): RobotsPolicy {
  const groups: Group[] = [];
  let group: Group | undefined;
  let directives = false;
  let ruleCount = 0;
  let agentCount = 0;
  for (const line of text.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const clean = line.split("#", 1)[0]?.trim() ?? "";
    const separator = clean.indexOf(":");
    if (separator < 0) continue;
    const name = clean.slice(0, separator).trim().toLowerCase();
    const value = clean.slice(separator + 1).trim();
    if (name === "user-agent") {
      if (++agentCount > 4000) throw new Error("robots_rules_limit");
      if (!group || directives) {
        group = { agents: [], rules: [] };
        groups.push(group);
        directives = false;
      }
      group.agents.push(value.toLowerCase());
    } else if (group && (name === "allow" || name === "disallow")) {
      directives = true;
      if (value.startsWith("/")) {
        if (++ruleCount > 2000 || value.length > 2048) throw new Error("robots_rules_limit");
        group.rules.push({ allow: name === "allow", path: value });
      }
    }
  }
  const agent = userAgent.toLowerCase();
  const score = (g: Group) =>
    g.agents.reduce(
      (best, candidate) =>
        Math.max(
          best,
          candidate === "*" ? 0 : candidate && agent.includes(candidate) ? candidate.length : -1,
        ),
      -1,
    );
  const best = groups.reduce((best, g) => Math.max(best, score(g)), -1);
  return { rules: groups.filter((g) => score(g) === best && best >= 0).flatMap((g) => g.rules) };
}
function normalizePath(path: string): string {
  // Unreserved podem ser decodificados; %2F continua distinto de / (RFC 9309).
  return path
    .replace(/%[0-9a-f]{2}/gi, (encoded) => {
      const char = String.fromCharCode(Number.parseInt(encoded.slice(1), 16));
      return /[A-Za-z0-9._~-]/.test(char) ? char : encoded.toUpperCase();
    })
    .replace(/[^\x21-\x7E]/gu, (char) => encodeURIComponent(char));
}
export function robotsAllows(policy: RobotsPolicy, url: URL): boolean {
  const path = normalizePath(`${url.pathname}${url.search}`);
  let best = -1;
  let allowed = true;
  let comparisons = 0;
  const tick = () => {
    if (++comparisons > 100_000) throw new Error("robots_complexity_limit");
  };
  // Glob iterativo com orçamento compartilhado; nenhum regex é compilado da entrada hostil.
  function matches(pattern: string, end: boolean): boolean {
    let p = 0;
    let t = 0;
    let star = -1;
    let retry = 0;
    while (t < path.length) {
      tick();
      if (p === pattern.length) {
        if (!end) return true;
        if (star < 0) return false;
        // Uma ocorrência anterior do sufixo não satisfaz a âncora final.
        p = star + 1;
        t = ++retry;
        continue;
      }
      if (pattern[p] === "*") {
        star = p++;
        retry = t;
      } else if (pattern[p] === path[t]) {
        p++;
        t++;
      } else if (star >= 0) {
        p = star + 1;
        t = ++retry;
      } else return false;
    }
    while (pattern[p] === "*") {
      tick();
      p++;
    }
    return p === pattern.length;
  }
  for (const rule of policy.rules) {
    const pattern = normalizePath(rule.path);
    const end = pattern.endsWith("$");
    const content = end ? pattern.slice(0, -1) : pattern;
    const specificity = Buffer.byteLength(content.replaceAll("*", ""));
    if (matches(content, end) && (specificity > best || (specificity === best && rule.allow))) {
      best = specificity;
      allowed = rule.allow;
    }
  }
  return allowed;
}
