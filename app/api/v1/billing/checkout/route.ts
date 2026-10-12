import { z } from "zod";
import { randomUUID } from "node:crypto";
import { requireRole } from "@/lib/auth/require-role";
import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { checkRateLimit } from "@/lib/ai/dispatcher/rate-limit";
import { iniciarContratacao, BillingError } from "@/lib/vellum/billing-server";

export async function POST(req: Request) {
  const requestId = randomUUID();
  const authz = await requireRole("admin", { requestId, resource: "billing_subscriptions" });
  if (!authz.ok) return authz.response;
  if (authz.user.support)
    return fail("forbidden", "Contratação exige a sessão do administrador da empresa.", 403, {
      requestId,
    });
  if (!(await checkRateLimit(`billing:${authz.org.orgId}`, 5, 60)).allowed)
    return fail("rate_limited", "Aguarde antes de tentar novamente.", 429, { requestId });
  const parsed = z
    .object({ plan_id: z.string().regex(/^[a-z][a-z0-9_-]{1,39}$/) })
    .strict()
    .safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("validation_failed", "Plano inválido.", 422, { requestId });
  await audit({
    action: "billing.checkout_requested",
    actorUserId: authz.user.id,
    organizationId: authz.org.orgId,
    resourceType: "billing_subscriptions",
    requestId,
    metadata: { plan_id: parsed.data.plan_id, stage: "requested" },
  });
  try {
    const result = await iniciarContratacao(authz.org.orgId, authz.user.email, parsed.data.plan_id);
    await audit({
      action: "billing.checkout_requested",
      actorUserId: authz.user.id,
      organizationId: authz.org.orgId,
      resourceType: "billing_subscriptions",
      resourceId: result.subscription_id,
      requestId,
      metadata: { plan_id: parsed.data.plan_id, repeated: result.repeated, stage: "completed" },
      bypassedRls: true,
    });
    return ok(result, { requestId });
  } catch (error) {
    if (error instanceof BillingError)
      return fail(error.code, error.message, error.status, { requestId });
    return fail(
      "unavailable",
      "O financeiro não está disponível. Verifique a instalação do banco e a configuração do servidor.",
      503,
      { requestId },
    );
  }
}
