import { randomUUID } from "node:crypto";
import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireImplementationAdmin, implementationFailure } from "@/lib/implementations/access";
import { actionSchema, organizationIdSchema } from "@/lib/implementations/schemas";
import { getImplementationDetail, mutateImplementation } from "@/lib/implementations/repository";
export const runtime = "nodejs";
type Context = { params: Promise<{ organizationId: string }> };
export async function GET(_req: Request, context: Context) {
  const requestId = randomUUID();
  try {
    await requireImplementationAdmin();
    const org = organizationIdSchema.safeParse((await context.params).organizationId);
    if (!org.success) return fail("invalid_request", "Empresa inválida.", 400, { requestId });
    const result = await getImplementationDetail(org.data);
    return result
      ? ok(result, { requestId })
      : fail("not_found", "Empresa não encontrada.", 404, { requestId });
  } catch (error) {
    return implementationFailure(error, requestId);
  }
}
export async function POST(req: Request, context: Context) {
  const requestId = randomUUID();
  try {
    const admin = await requireImplementationAdmin();
    const org = organizationIdSchema.safeParse((await context.params).organizationId);
    if (!org.success) return fail("invalid_request", "Empresa inválida.", 400, { requestId });
    const parsed = actionSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success)
      return fail("validation_failed", "Revise os dados da operação.", 422, { requestId });
    const result = await mutateImplementation(org.data, admin.user.id, parsed.data);
    void audit({
      action: "agent_implementation.changed",
      organizationId: org.data,
      actorUserId: admin.user.id,
      actingAsPlatformAdmin: true,
      bypassedRls: true,
      requestId,
      resourceType: "agent_implementations",
      metadata: { operation: parsed.data.action },
    });
    return ok(result, { requestId });
  } catch (error) {
    return implementationFailure(error, requestId);
  }
}
