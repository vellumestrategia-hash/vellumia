import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { readSupportContext } from "@/lib/impersonate/support";
import { createClient } from "@/lib/supabase/server";
import { fail } from "@/lib/api/wrappers";
import { ImplementationError } from "./contracts";
export async function requireImplementationAdmin() {
  let context;
  try {
    context = await requirePlatformAdmin();
  } catch {
    throw new ImplementationError("forbidden");
  }
  if (context.platformAdmin.scope !== "full") throw new ImplementationError("forbidden");
  if (await readSupportContext(await createClient())) throw new ImplementationError("forbidden");
  return context;
}
const errors = {
  forbidden: [403, "Administrador global com acesso completo necessário."],
  not_found: [404, "Empresa ou registro de implementação não encontrado."],
  idempotency_conflict: [409, "Esta chave já foi usada com outra importação."],
  state_conflict: [409, "Esta operação não é permitida no estado atual. Atualize a revisão."],
  implementation_revision_conflict: [409, "A revisão mudou. Atualize a página antes de salvar."],
  implementation_sensitive_confirmation_required: [
    422,
    "Confirme explicitamente este dado comercial antes de aprovar.",
  ],
  implementation_lease_lost: [409, "Esta tentativa de importação já terminou. Atualize a página."],
  implementation_import_exhausted: [409, "O limite de tentativas desta importação foi atingido."],
} as const;
export function implementationFailure(error: unknown, requestId: string) {
  if (error instanceof ImplementationError) {
    const [status, message] = errors[error.code];
    return fail(error.code, message, status, { requestId });
  }
  return fail(
    "unavailable",
    "Não foi possível concluir a operação de implementação. Tente novamente.",
    503,
    { requestId },
  );
}
