import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { gatewayAsaas, asaasConfigurado, type PagamentoAsaas } from "./asaas";
import { linkSeguroAsaas, reaisParaCentavos } from "./financeiro";

export class BillingError extends Error {
  constructor(
    public readonly code: "unavailable" | "state_conflict" | "validation_failed",
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
function checar(error: { message: string } | null) {
  if (error) throw new Error("billing_database");
}

/** Reserva única por empresa. Um timeout remoto exige conciliação, nunca POST cego. */
export async function iniciarContratacao(organizationId: string, email: string, planId: string) {
  if (!asaasConfigurado())
    throw new BillingError(
      "unavailable",
      503,
      "Configure o Asaas sandbox e o token de webhook no servidor.",
    );
  const db = createAdminClient();
  const { data: plan, error: pe } = await db
    .from("billing_plans")
    .select("*")
    .eq("id", planId)
    .eq("enabled", true)
    .maybeSingle();
  checar(pe);
  if (!plan || plan.monthly_price_cents === null || plan.included_conversations === null)
    throw new BillingError("validation_failed", 422, "Este plano exige um contrato personalizado.");
  const { data: org, error: oe } = await db
    .from("organizations")
    .select("legal_name,cnpj")
    .eq("id", organizationId)
    .single();
  checar(oe);
  if (!org?.cnpj || !/^\d{14}$/.test(org.cnpj.replace(/\D/g, "")))
    throw new BillingError(
      "validation_failed",
      422,
      "Preencha o CNPJ nas configurações da empresa antes de contratar.",
    );
  const id = randomUUID();
  const { error: reserveError } = await db.from("billing_subscriptions").insert({
    id,
    organization_id: organizationId,
    plan_id: plan.id,
    monthly_price_cents: plan.monthly_price_cents,
    included_conversations: plan.included_conversations,
    setup_price_cents: plan.setup_price_cents,
    overage_price_cents: plan.overage_price_cents,
    ai_budget_usd_cents: plan.ai_budget_usd_cents,
    checkout_state: "creating",
  });
  if (reserveError?.code === "23505") {
    const { data: existing, error } = await db
      .from("billing_subscriptions")
      .select("id,checkout_state")
      .eq("organization_id", organizationId)
      .single();
    checar(error);
    if (existing?.checkout_state !== "ready")
      throw new BillingError(
        "state_conflict",
        409,
        "Há uma contratação em processamento ou revisão. Consulte o administrador antes de repetir.",
      );
    return { subscription_id: existing.id, repeated: true };
  }
  checar(reserveError);
  const update = async (patch: Record<string, unknown>) => {
    const { error } = await db
      .from("billing_subscriptions")
      .update(patch)
      .eq("id", id)
      .eq("organization_id", organizationId);
    checar(error);
  };
  try {
    const gateway = gatewayAsaas();
    const customer = await gateway.criarCliente({
      name: org.legal_name,
      cpfCnpj: org.cnpj.replace(/\D/g, ""),
      email,
      externalReference: `vellum:${organizationId}`,
    });
    await update({ provider_customer_id: customer.id });
    const hoje = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const subscription = await gateway.criarAssinatura({
      customer: customer.id,
      value: plan.monthly_price_cents / 100,
      nextDueDate: hoje,
      externalReference: id,
      description: `Plano ${plan.name}`,
    });
    await update({ provider_subscription_id: subscription.id });
    if (plan.setup_price_cents > 0) {
      const setup = await gateway.criarImplantacao({
        customer: customer.id,
        value: plan.setup_price_cents / 100,
        dueDate: hoje,
        externalReference: `${id}:setup`,
      });
      if (
        setup.customer !== customer.id ||
        setup.subscription ||
        reaisParaCentavos(setup.value) !== plan.setup_price_cents
      )
        throw new Error("billing_setup_identity");
      await guardarFatura(setup, "setup", organizationId, id);
    }
    for (const payment of await gateway.pagamentosDaAssinatura(subscription.id)) {
      if (
        payment.customer !== customer.id ||
        payment.subscription !== subscription.id ||
        reaisParaCentavos(payment.value) !== plan.monthly_price_cents
      )
        throw new Error("billing_identity");
      await guardarFatura(payment, "monthly", organizationId, id);
    }
    await update({ checkout_state: "ready" });
    return { subscription_id: id, repeated: false };
  } catch {
    await update({ checkout_state: "review" }).catch(() => {});
    throw new BillingError(
      "state_conflict",
      409,
      "O gateway não confirmou todas as etapas. A contratação ficou em revisão para evitar cobranças duplicadas.",
    );
  }
}

async function guardarFatura(
  payment: PagamentoAsaas,
  kind: "monthly" | "setup",
  org: string,
  subscription: string,
) {
  const { error } = await createAdminClient()
    .from("billing_invoices")
    .insert({
      provider_payment_id: payment.id,
      organization_id: org,
      subscription_id: subscription,
      kind,
      amount_cents: reaisParaCentavos(payment.value),
      due_date: payment.dueDate,
      status: "pending",
      invoice_url: linkSeguroAsaas(payment.invoiceUrl),
    });
  // Um webhook pode ter conciliado antes de a criação terminar; não sobrescrever.
  if (error?.code !== "23505") checar(error);
}
