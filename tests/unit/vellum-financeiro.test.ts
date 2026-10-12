import { describe, it, expect, vi } from "vitest";
import {
  calcularExcedente,
  reaisParaCentavos,
  statusDoPagamento,
  linkSeguroAsaas,
  planoFinanceiroSchema,
} from "@/lib/vellum/financeiro";
import { AsaasSandbox } from "@/lib/vellum/asaas";

describe("contrato financeiro sem IO", () => {
  it("centavos e excedentes não perdem precisão nem confundem moedas", () => {
    expect(reaisParaCentavos(399)).toBe(39900);
    expect(reaisParaCentavos(1.01)).toBe(101);
    expect(() => reaisParaCentavos(1.001)).toThrow();
    expect(() => reaisParaCentavos(Number.NaN)).toThrow();
    expect(calcularExcedente(502, 500, 200)).toEqual({ conversas: 2, amount_cents: 400 });
    expect(calcularExcedente(100, 500, 200).amount_cents).toBe(0);
    expect(() => calcularExcedente(Number.MAX_SAFE_INTEGER, 0, 200)).toThrow();
  });
  it("não ativa status desconhecido nem libera link externo", () => {
    expect(statusDoPagamento("CONFIRMED")).toBe("paid");
    expect(statusDoPagamento("CHARGEBACK_REQUESTED")).toBe("refunded");
    expect(statusDoPagamento("FUTURE_STATUS")).toBeNull();
    expect(linkSeguroAsaas("https://sandbox.asaas.com/i/abc")).toBeTruthy();
    for (const link of [
      "javascript:alert(1)",
      "https://asaas.com.evil.test/",
      "https://user:pass@asaas.com/",
      "http://asaas.com/",
    ])
      expect(linkSeguroAsaas(link)).toBeNull();
  });
  it("orçamento de IA é USD explícito e nunca aceita centavos fracionários", () => {
    const plan = {
      id: "start",
      name: "START",
      monthly_price_cents: 39900,
      included_conversations: 200,
      setup_price_cents: 100000,
      overage_price_cents: 200,
      ai_budget_usd_cents: null,
      enabled: true,
    };
    expect(planoFinanceiroSchema.safeParse(plan).success).toBe(true);
    expect(planoFinanceiroSchema.safeParse({ ...plan, monthly_price_cents: 39900.5 }).success).toBe(
      false,
    );
    expect(planoFinanceiroSchema.safeParse({ ...plan, ai_budget_usd_cents: 10 }).success).toBe(
      false,
    );
  });
});
describe("transporte Asaas isolado", () => {
  it("usa exclusivamente sandbox e não faz retry de POST incerto", async () => {
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response('{"id":"sub_test"}', {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    const gateway = new AsaasSandbox("test-key", transport);
    await gateway.criarAssinatura({
      customer: "cus_test",
      value: 399,
      nextDueDate: "2026-10-12",
      externalReference: "local",
      description: "START",
    });
    const [url, options] = transport.mock.calls[0]!;
    expect(url).toBe("https://api-sandbox.asaas.com/v3/subscriptions");
    expect(JSON.parse(String(options?.body))).toMatchObject({
      cycle: "MONTHLY",
      billingType: "UNDEFINED",
    });
    transport.mockRejectedValueOnce(new Error("timeout"));
    await expect(
      gateway.criarCliente({
        name: "Teste",
        cpfCnpj: "test",
        email: "test@example.invalid",
        externalReference: "local",
      }),
    ).rejects.toThrow("timeout");
    expect(transport).toHaveBeenCalledTimes(2);
    await expect(gateway.request("//evil.test")).rejects.toThrow("asaas_path");
  });
  it("erros não contêm payload sensível upstream", async () => {
    const gateway = new AsaasSandbox(
      "test-key",
      vi.fn<typeof fetch>().mockResolvedValue(new Response("secret-body", { status: 401 })),
    );
    await expect(gateway.pagamento("pay_test")).rejects.toThrow(/^asaas_http_401$/);
  });
});
