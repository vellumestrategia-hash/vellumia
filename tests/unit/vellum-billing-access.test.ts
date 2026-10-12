import { it, expect, vi } from "vitest";
import type pg from "pg";
import { assertBillingAccess, BillingAccessDeniedError } from "@/lib/vellum/billing-access";
import { runModelCall } from "@/lib/agent-engine/edge/llm/run-model-call";

it("desligado preserva a base; ligado recusa assinatura ausente e query falha antes do provedor", async () => {
  const query = vi.fn().mockResolvedValue({ rows: [] });
  const db = { query } as unknown as Pick<pg.Pool, "query">;
  await assertBillingAccess(db, "tenant", false);
  expect(query).not.toHaveBeenCalled();
  await expect(assertBillingAccess(db, "tenant", true)).rejects.toBeInstanceOf(
    BillingAccessDeniedError,
  );
  expect(query.mock.calls[0]![1]).toEqual(["tenant"]);
  query.mockRejectedValueOnce(new Error("database_unavailable"));
  await expect(assertBillingAccess(db, "tenant", true)).rejects.toThrow("database_unavailable");
});
it("tetos de plano bloqueiam na igualdade, sem apagar acesso humano e sem converter moeda", async () => {
  const query = vi
    .fn()
    .mockResolvedValue({ rows: [{ active: true, budget: 5000, spent: "4999" }] });
  const db = { query } as unknown as Pick<pg.Pool, "query">;
  await assertBillingAccess(db, "tenant", true);
  query.mockResolvedValueOnce({ rows: [{ active: true, budget: 5000, spent: "5000" }] });
  await expect(assertBillingAccess(db, "tenant", true)).rejects.toMatchObject({
    terminal: true,
    reason: "budget",
  });
  query.mockResolvedValueOnce({ rows: [{ active: false, budget: null, spent: "0" }] });
  await expect(assertBillingAccess(db, "tenant", true)).rejects.toMatchObject({
    reason: "subscription",
  });
  expect(query.mock.calls[0]![0]).toContain("fn_gasto_de_ia_do_mes");
});
it("o seam recusa antes de resolver credenciais ou instanciar modelo", async () => {
  vi.stubEnv("VELLUM_BILLING_ENFORCEMENT", "true");
  try {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const registry = vi.fn();
    await expect(
      runModelCall(
        { query } as unknown as pg.Pool,
        {} as never,
        { tenantId: "tenant", messages: [] },
        { registry: registry as never },
      ),
    ).rejects.toBeInstanceOf(BillingAccessDeniedError);
    expect(query).toHaveBeenCalledOnce();
    expect(registry).not.toHaveBeenCalled();
  } finally {
    vi.unstubAllEnvs();
  }
});
