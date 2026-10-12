import type pg from "pg";

export class BillingAccessDeniedError extends Error {
  readonly terminal = true;
  override readonly name = "billing_access_denied";
  constructor(public readonly reason: "subscription" | "budget") {
    super(
      reason === "budget"
        ? "O teto de IA do plano foi atingido. Atendimento humano permanece disponível."
        : "A assinatura não está ativa no período atual. Atendimento humano permanece disponível.",
    );
  }
}

/** Gate adicional do SaaS. Usa a mesma régua de gasto USD da base existente. */
export async function assertBillingAccess(
  db: Pick<pg.Pool, "query">,
  organizationId: string,
  enabled = process.env.VELLUM_BILLING_ENFORCEMENT === "true",
) {
  if (!enabled) return;
  const { rows } = await db.query<{
    active: boolean;
    budget: number | null;
    spent: string | number;
  }>(
    `
    select status='active'
      and now()>=period_start::timestamp at time zone 'America/Sao_Paulo'
      and now()<period_end::timestamp at time zone 'America/Sao_Paulo' as active,
      ai_budget_usd_cents as budget,public.fn_gasto_de_ia_do_mes($1) as spent
    from public.billing_subscriptions where organization_id=$1`,
    [organizationId],
  );
  const row = rows[0];
  if (!row?.active) throw new BillingAccessDeniedError("subscription");
  if (!Number.isFinite(Number(row.spent))) throw new Error("billing_usage_unavailable");
  if (row.budget !== null && Number(row.spent) >= row.budget)
    throw new BillingAccessDeniedError("budget");
}
