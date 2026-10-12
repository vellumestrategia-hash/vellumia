/**
 * Helpers dos specs de auth E2E: leitura de e-mails reais no Mailpit do
 * Supabase local + parsing do link /auth/confirm dos templates.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

/** Parser mínimo de .env.local (os specs rodam fora do runtime Next). */
export function loadEnvLocal(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const raw = readFileSync(join(process.cwd(), ".env.local"), "utf-8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) out[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
    }
  } catch {
    // sem .env.local — caller decide se é fatal
  }
  return out;
}

export function uniqueEmail(prefix: string): string {
  return `e2e-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@deskcomm.test`;
}

interface MailpitSearchResult {
  messages: { ID: string; Subject: string }[];
}

/**
 * Aguarda um e-mail para `to` cujo assunto contenha `subjectPart` e devolve o
 * HTML da mensagem mais recente.
 */
export async function waitForEmail(
  to: string,
  subjectPart: string,
  timeoutMs = 30_000,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(
      `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`,
    );
    if (res.ok) {
      const data = (await res.json()) as MailpitSearchResult;
      const msg = data.messages?.find((m) => m.Subject.includes(subjectPart));
      if (msg) {
        const msgRes = await fetch(`${MAILPIT_URL}/api/v1/message/${msg.ID}`);
        const body = (await msgRes.json()) as { HTML: string; Text: string };
        return body.HTML || body.Text;
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`email para ${to} com assunto contendo "${subjectPart}" não chegou em ${timeoutMs}ms`);
}

/**
 * Extrai o link real do e-mail. Não conserta origem ou caminho: isto escondia
 * uma allowlist de redirecionamento errada e aprovava um e-mail que o usuário
 * não conseguiria abrir. O provedor do teste precisa estar configurado.
 */
export function extractAuthConfirmLink(html: string, baseUrl: string): string {
  const m = html.match(/href="([^"]*token_hash=[^"]*)"/);
  if (!m) throw new Error("link com token_hash não encontrado no e-mail");
  const href = m[1]!.replace(/&amp;/g, "&");
  const url = new URL(href);
  if (url.origin !== new URL(baseUrl).origin || url.pathname !== "/auth/confirm") {
    throw new Error("O e-mail aponta para outro endereço. Confira Site URL e Redirect URLs do provedor de teste.");
  }
  if (!url.searchParams.get("type")) throw new Error("O e-mail não informa o tipo de confirmação.");
  return url.toString();
}
