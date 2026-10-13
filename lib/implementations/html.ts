import { Parser, type Token, type DefaultTreeAdapterMap } from "parse5";
import { normalizeEvidenceText } from "./contracts";
type HtmlNode = DefaultTreeAdapterMap["node"];
type Element = DefaultTreeAdapterMap["element"];
/** parse5 está fixado: os callbacks limitam a árvore antes da inserção de cada token. */
class BoundedHtmlParser extends Parser<DefaultTreeAdapterMap> {
  private tokens = 0;
  private readonly parserDeadline = Date.now() + 1000;
  constructor(private readonly crawlDeadline: number) {
    super({ scriptingEnabled: false });
  }
  private checkpoint(): void {
    const now = Date.now();
    if (now >= this.crawlDeadline) throw new Error("crawl_timeout");
    if (++this.tokens > 10_000 || now >= this.parserDeadline || this.openElements.stackTop >= 128)
      throw new Error("html_complexity_limit");
  }
  override onStartTag(token: Token.TagToken): void {
    this.checkpoint();
    super.onStartTag(token);
  }
  override onEndTag(token: Token.TagToken): void {
    this.checkpoint();
    super.onEndTag(token);
  }
  override onCharacter(token: Token.CharacterToken): void {
    this.checkpoint();
    super.onCharacter(token);
  }
  override onWhitespaceCharacter(token: Token.CharacterToken): void {
    this.checkpoint();
    super.onWhitespaceCharacter(token);
  }
  override onNullCharacter(token: Token.CharacterToken): void {
    this.checkpoint();
    super.onNullCharacter(token);
  }
  override onComment(token: Token.CommentToken): void {
    this.checkpoint();
    super.onComment(token);
  }
}
const EXCLUDED = new Set([
  "script",
  "style",
  "noscript",
  "template",
  "svg",
  "canvas",
  "nav",
  "iframe",
  "form",
]);
const BLOCKS = new Set([
  "p",
  "div",
  "section",
  "article",
  "main",
  "li",
  "h1",
  "h2",
  "h3",
  "h4",
  "tr",
  "br",
  "footer",
  "header",
]);
function isElement(node: HtmlNode): node is Element {
  return "tagName" in node;
}
function attr(node: Element, name: string): string | undefined {
  return node.attrs.find((item) => item.name === name)?.value;
}
function hidden(node: Element): boolean {
  return (
    EXCLUDED.has(node.tagName) ||
    attr(node, "hidden") !== undefined ||
    attr(node, "aria-hidden") === "true" ||
    /(?:display\s*:\s*none|visibility\s*:\s*hidden)/i.test(attr(node, "style") ?? "")
  );
}
function children(node: HtmlNode): HtmlNode[] {
  return "childNodes" in node ? node.childNodes : [];
}
function find(node: HtmlNode, tag: string): Element | undefined {
  if (isElement(node) && hidden(node)) return undefined;
  if (isElement(node) && node.tagName === tag) return node;
  for (const child of children(node)) {
    const found = find(child, tag);
    if (found) return found;
  }
}
function nodeText(node: HtmlNode): string {
  if (node.nodeName === "#text" && "value" in node) return node.value;
  if (isElement(node) && hidden(node)) return "";
  const text = children(node).map(nodeText).join("");
  if (isElement(node) && ["td", "th"].includes(node.tagName)) return `${text} `;
  return isElement(node) && BLOCKS.has(node.tagName) ? `\n${text}\n` : text;
}
const RELEVANT =
  /(?:sobre|quem.somos|empresa|about|contact|contato|servi[cç]os?|service|produt|product|solu[cç]|solution|pre[cç]o|pric|plano|plan|faq|pergunta|hor[aá]rio|hour|pol[ií]tica|polic|pagamento|payment|condi[cç]|terms|termos)/i;
const SKIP_LINK =
  /(?:login|signin|sign-in|logout|checkout|carrinho|cart|wp-admin|\.pdf$|\.(?:png|jpe?g|gif|svg|zip|mp4)$)/i;
export interface ExtractedHtml {
  title: string;
  text: string;
  links: string[];
}
/** Parser HTML5 puro: scripts nunca executam e recursos não são carregados. */
export function extractPublicHtml(
  html: string,
  pageUrl: URL,
  options: { deadline_at?: number } = {},
): ExtractedHtml {
  if (html.length > 1024 * 1024) throw new Error("html_complexity_limit");
  if (options.deadline_at !== undefined && Date.now() >= options.deadline_at)
    throw new Error("crawl_timeout");
  const parser = new BoundedHtmlParser(options.deadline_at ?? Number.POSITIVE_INFINITY);
  parser.tokenizer.write(html, true);
  const document = parser.document;
  const titleNode = find(document, "title");
  const title = titleNode ? normalizeEvidenceText(nodeText(titleNode)).slice(0, 300) : "";
  const content =
    find(document, "main") ?? find(document, "article") ?? find(document, "body") ?? document;
  const seenLines = new Set<string>();
  const text = nodeText(content)
    .split(/\n+/)
    .map(normalizeEvidenceText)
    .filter((line) => {
      if (!line || seenLines.has(line)) return false;
      seenLines.add(line);
      return true;
    })
    .join("\n")
    .slice(0, 200_000);
  const links = new Set<string>();
  function visit(node: HtmlNode): void {
    if (isElement(node) && hidden(node)) return;
    if (isElement(node) && node.tagName === "a" && links.size < 64) {
      const href = attr(node, "href");
      if (href)
        try {
          const url = new URL(href, pageUrl);
          url.hash = "";
          if (
            url.origin === pageUrl.origin &&
            !url.username &&
            !url.password &&
            !SKIP_LINK.test(url.pathname) &&
            RELEVANT.test(`${url.pathname} ${nodeText(node)}`)
          )
            links.add(url.href);
        } catch {
          /* Link inválido não vira conexão. */
        }
    }
    for (const child of children(node)) visit(child);
  }
  // A navegação descobre páginas, embora não seja evidência textual.
  function discover(node: HtmlNode): void {
    if (isElement(node) && node.tagName === "nav") {
      for (const child of children(node)) visit(child);
      return;
    }
    if (isElement(node) && hidden(node)) return;
    if (isElement(node) && node.tagName === "a") visit(node);
    else for (const child of children(node)) discover(child);
  }
  discover(document);
  return { title, text, links: [...links] };
}
