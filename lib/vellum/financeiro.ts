import { z } from "zod";

export const planoFinanceiroSchema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9_-]{1,39}$/),
    name: z.string().trim().min(1).max(80),
    monthly_price_cents: z.number().int().min(0).max(100000000).nullable(),
    included_conversations: z.number().int().min(0).max(10000000).nullable(),
    setup_price_cents: z.number().int().min(0).max(100000000),
    overage_price_cents: z.number().int().min(0).max(1000000),
    ai_budget_usd_cents: z.number().int().min(100).max(100000000).nullable(),
    enabled: z.boolean(),
  })
  .strict();
export type PlanoFinanceiro = z.infer<typeof planoFinanceiroSchema>;
export type StatusFatura = "pending" | "paid" | "overdue" | "refunded" | "canceled";

/** Sem equivalência de moedas ou tokens: valor do provedor em BRL. */
export function reaisParaCentavos(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 1000000) throw new Error("billing_amount");
  const cents = Math.round(value * 100);
  if (Math.abs(value * 100 - cents) > 0.00001) throw new Error("billing_fractional_cent");
  return cents;
}

export function statusDoPagamento(status: string): StatusFatura | null {
  if (["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(status)) return "paid";
  if (status === "OVERDUE") return "overdue";
  if (
    [
      "REFUNDED",
      "CHARGEBACK_REQUESTED",
      "CHARGEBACK_DISPUTE",
      "AWAITING_CHARGEBACK_REVERSAL",
    ].includes(status)
  )
    return "refunded";
  if (status === "DELETED") return "canceled";
  if (
    ["PENDING", "AWAITING_RISK_ANALYSIS", "DUNNING_REQUESTED", "DUNNING_RECEIVED"].includes(status)
  )
    return "pending";
  return null; // Vocabulário novo do gateway exige revisão, não ativa acesso.
}

export function linkSeguroAsaas(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" &&
      ["sandbox.asaas.com", "www.asaas.com", "asaas.com"].includes(url.hostname) &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export function calcularExcedente(quantidade: number, incluidos: number, precoCents: number) {
  for (const value of [quantidade, incluidos, precoCents]) {
    if (!Number.isSafeInteger(value) || value < 0) throw new RangeError("billing_usage");
  }
  const conversas = Math.max(0, quantidade - incluidos);
  const amount_cents = conversas * precoCents;
  if (!Number.isSafeInteger(amount_cents)) throw new RangeError("billing_overflow");
  return { conversas, amount_cents };
}
