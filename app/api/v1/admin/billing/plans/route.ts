import { randomUUID } from "node:crypto";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { planoFinanceiroSchema } from "@/lib/vellum/financeiro";

export async function PUT(req: Request) {
  const requestId = randomUUID();
  let ctx;
  try {
    ctx = await requirePlatformAdmin();
  } catch {
    return fail("forbidden", "Superadministrador necessário.", 403, { requestId });
  }
  // Uma sessão de suporte não dá direito de alterar preços da instalação.
  const { readSupportContext } = await import("@/lib/impersonate/support");
  const { createClient } = await import("@/lib/supabase/server");
  if (await readSupportContext(await createClient()))
    return fail("forbidden", "Encerre o suporte temporário para editar planos.", 403, {
      requestId,
    });
  const parsed = planoFinanceiroSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return fail("validation_failed", "Revise os valores do plano.", 422, { requestId });
  try {
    const { error } = await createAdminClient()
      .from("billing_plans")
      .upsert({ ...parsed.data, updated_at: new Date().toISOString() }, { onConflict: "id" });
    if (error) throw new Error("billing_db");
    await audit({
      action: "billing.plan_updated",
      actorUserId: ctx.user.id,
      actingAsPlatformAdmin: true,
      bypassedRls: true,
      resourceType: "billing_plans",
      requestId,
      metadata: parsed.data,
    });
    return ok(parsed.data, { requestId });
  } catch {
    return fail(
      "unavailable",
      "Não foi possível salvar o plano. Verifique o schema financeiro.",
      503,
      { requestId },
    );
  }
}
