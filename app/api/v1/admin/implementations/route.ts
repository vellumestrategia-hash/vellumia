import { randomUUID } from "node:crypto";
import { ok, fail } from "@/lib/api/wrappers";
import { requireImplementationAdmin, implementationFailure } from "@/lib/implementations/access";
import { listQuerySchema } from "@/lib/implementations/schemas";
import { listImplementations } from "@/lib/implementations/repository";
export const runtime = "nodejs";
export async function GET(req: Request) {
  const requestId = randomUUID();
  try {
    await requireImplementationAdmin();
    const parsed = listQuerySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
    if (!parsed.success)
      return fail("invalid_request", "Revise os filtros da listagem.", 400, { requestId });
    const result = await listImplementations(parsed.data);
    return ok(result.data, {
      requestId,
      meta: { has_more: result.has_more, cursor: result.cursor },
    });
  } catch (error) {
    return implementationFailure(error, requestId);
  }
}
