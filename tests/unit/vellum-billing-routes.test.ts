// @vitest-environment node
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import type * as BillingServer from "@/lib/vellum/billing-server";
const mocks = vi.hoisted(() => ({
  role: vi.fn(),
  checkout: vi.fn(),
  audit: vi.fn(),
  limit: vi.fn(),
  admin: vi.fn(),
  payment: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
}));
vi.mock("@/lib/auth/require-role", () => ({ requireRole: mocks.role }));
vi.mock("@/lib/audit", () => ({ audit: mocks.audit }));
vi.mock("@/lib/ai/dispatcher/rate-limit", () => ({ checkRateLimit: mocks.limit }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("@/lib/vellum/asaas", () => ({
  gatewayAsaas: () => ({ pagamento: mocks.payment }),
  asaasConfigurado: () => true,
}));
vi.mock("@/lib/vellum/billing-server", async (importOriginal) => ({
  ...(await importOriginal<typeof BillingServer>()),
  iniciarContratacao: mocks.checkout,
}));
import { POST as checkout } from "@/app/api/v1/billing/checkout/route";
import { POST as webhook } from "@/app/api/v1/webhooks/asaas/route";
const secret = "test-webhook-token-independent-32chars";
const auth = {
  ok: true,
  user: { id: "actor", email: "actor@example.invalid", support: null },
  org: { orgId: "org-from-session" },
};
function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("ASAAS_WEBHOOK_TOKEN", secret);
  mocks.role.mockResolvedValue(auth);
  mocks.limit.mockResolvedValue({ allowed: true });
  mocks.checkout.mockResolvedValue({ subscription_id: "local", repeated: false });
  mocks.rpc.mockResolvedValue({ data: { duplicate: false }, error: null });
  mocks.from.mockImplementation((table: string) => {
    const result = {
      data: table === "billing_subscriptions" ? { id: "local" } : null,
      error: null,
    };
    const chain = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn().mockResolvedValue(result) };
    chain.select.mockReturnValue(chain);
    chain.eq.mockReturnValue(chain);
    return chain;
  });
  mocks.admin.mockReturnValue({ from: mocks.from, rpc: mocks.rpc });
  mocks.payment.mockResolvedValue({
    id: "pay_test",
    customer: "cus_test",
    subscription: "sub_test",
    value: 399,
    dueDate: "2026-10-12",
    status: "RECEIVED",
    invoiceUrl: "https://sandbox.asaas.com/i/test",
  });
});
afterEach(() => {
  vi.unstubAllEnvs();
});
describe("contratação usa a identidade da sessão", () => {
  it("recusa falta de papel antes de qualquer cobrança", async () => {
    mocks.role.mockResolvedValueOnce({
      ok: false,
      response: new Response("denied", { status: 403 }),
    });
    expect((await checkout(request({ plan_id: "start" }))).status).toBe(403);
    expect(mocks.checkout).not.toHaveBeenCalled();
  });
  it("recusa injeção de organização, suporte e rate-limit", async () => {
    expect((await checkout(request({ plan_id: "start", organization_id: "victim" }))).status).toBe(
      422,
    );
    mocks.role.mockResolvedValueOnce({
      ...auth,
      user: { ...auth.user, support: { status: "active" } },
    });
    expect((await checkout(request({ plan_id: "start" }))).status).toBe(403);
    mocks.limit.mockResolvedValueOnce({ allowed: false });
    expect((await checkout(request({ plan_id: "start" }))).status).toBe(429);
    expect(mocks.checkout).not.toHaveBeenCalled();
  });
  it("audita e repassa somente a org validada", async () => {
    expect((await checkout(request({ plan_id: "growth" }))).status).toBe(200);
    expect(mocks.checkout).toHaveBeenCalledWith(
      "org-from-session",
      "actor@example.invalid",
      "growth",
    );
    expect(mocks.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-from-session",
        metadata: { plan_id: "growth", stage: "requested" },
      }),
    );
  });
});
describe("webhook autentica e concilia a consulta canônica", () => {
  it("token ausente/errado e config ausente não acessam banco nem gateway", async () => {
    const event = { id: "evt_test", event: "PAYMENT_RECEIVED", payment: { id: "pay_test" } };
    expect((await webhook(request(event))).status).toBe(401);
    expect((await webhook(request(event, { "asaas-access-token": "bad" }))).status).toBe(401);
    vi.stubEnv("ASAAS_WEBHOOK_TOKEN", "");
    expect((await webhook(request(event))).status).toBe(503);
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("ignora organização, preço e estado alegados no evento", async () => {
    const res = await webhook(
      request(
        {
          id: "evt_test",
          event: "PAYMENT_OVERDUE",
          organization_id: "victim",
          payment: { id: "pay_test", value: 1, status: "OVERDUE" },
        },
        { "asaas-access-token": secret },
      ),
    );
    expect(res.status).toBe(200);
    expect(mocks.payment).toHaveBeenCalledWith("pay_test");
    expect(mocks.rpc).toHaveBeenCalledWith(
      "fn_billing_apply_payment",
      expect.objectContaining({
        p_subscription: "local",
        p_amount_cents: 39900,
        p_status: "paid",
        p_customer: "cus_test",
      }),
    );
    expect(mocks.rpc.mock.calls[0]![1]).not.toHaveProperty("organization_id");
  });
  it("evento repetido não consulta o gateway; falha de conciliação pede reentrega", async () => {
    const event = { id: "evt_test", event: "PAYMENT_RECEIVED", payment: { id: "pay_test" } };
    mocks.from.mockImplementationOnce(() => {
      const chain = {
        select: vi.fn(),
        eq: vi.fn(),
        maybeSingle: vi
          .fn()
          .mockResolvedValue({ data: { provider_event_id: "evt_test" }, error: null }),
      };
      chain.select.mockReturnValue(chain);
      chain.eq.mockReturnValue(chain);
      return chain;
    });
    expect((await webhook(request(event, { "asaas-access-token": secret }))).status).toBe(200);
    expect(mocks.payment).not.toHaveBeenCalled();
    mocks.rpc.mockResolvedValueOnce({ error: { message: "internal-private" } });
    const failed = await webhook(request(event, { "asaas-access-token": secret }));
    expect(failed.status).toBe(503);
    expect(await failed.text()).not.toContain("internal-private");
  });
});
