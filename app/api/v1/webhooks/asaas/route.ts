import { createHash, timingSafeEqual, randomUUID } from "node:crypto";
import { z } from "zod";
import { ok, fail } from "@/lib/api/wrappers";
import { createAdminClient } from "@/lib/supabase/admin";
import { gatewayAsaas } from "@/lib/vellum/asaas";
import { statusDoPagamento, reaisParaCentavos, linkSeguroAsaas } from "@/lib/vellum/financeiro";

export async function POST(req: Request) {
  const requestId = randomUUID();
  const secret = process.env.ASAAS_WEBHOOK_TOKEN ?? "";
  if (secret.length < 32)
    return fail("unavailable", "Webhook não configurado.", 503, { requestId });
  const digest = (s: string) => createHash("sha256").update(s).digest();
  if (!timingSafeEqual(digest(req.headers.get("asaas-access-token") ?? ""), digest(secret)))
    return fail("unauthorized", "Token inválido.", 401, { requestId });
  const body = await req.text();
  if (Buffer.byteLength(body) > 32768)
    return fail("payload_too_large", "Evento grande demais.", 413, { requestId });
  const parsed = z
    .object({
      id: z.string().min(1).max(100),
      event: z.string().min(1).max(100),
      payment: z.object({ id: z.string().min(1).max(100) }),
    })
    .safeParse(
      (() => {
        try {
          return JSON.parse(body);
        } catch {
          return null;
        }
      })(),
    );
  if (!parsed.success)
    return fail("validation_failed", "Evento de pagamento inválido.", 422, { requestId });
  try {
    const db = createAdminClient();
    const { data: seen, error: se } = await db
      .from("billing_webhook_events")
      .select("provider_event_id")
      .eq("provider_event_id", parsed.data.id)
      .maybeSingle();
    if (se) throw new Error("billing_db");
    if (seen) return ok({ duplicate: true }, { requestId });
    const payment = await gatewayAsaas().pagamento(parsed.data.payment.id);
    if (payment.id !== parsed.data.payment.id) throw new Error("billing_identity");
    const status = statusDoPagamento(payment.status);
    if (!status)
      return fail("unprocessable_entity", "Status do gateway exige revisão.", 422, { requestId });
    let kind: "monthly" | "setup";
    let subscriptionId: string;
    if (payment.subscription) {
      const { data: s, error } = await db
        .from("billing_subscriptions")
        .select("id")
        .eq("provider_subscription_id", payment.subscription)
        .eq("provider_customer_id", payment.customer)
        .maybeSingle();
      if (error || !s) throw new Error("billing_unmapped");
      subscriptionId = s.id;
      kind = "monthly";
    } else {
      const { data: i, error } = await db
        .from("billing_invoices")
        .select("subscription_id,kind")
        .eq("provider_payment_id", payment.id)
        .maybeSingle();
      if (error || !i || i.kind !== "setup") throw new Error("billing_unmapped");
      subscriptionId = i.subscription_id;
      kind = "setup";
    }
    const { data, error } = await db.rpc("fn_billing_apply_payment", {
      p_event_id: parsed.data.id,
      p_event_type: parsed.data.event,
      p_subscription: subscriptionId,
      p_payment_id: payment.id,
      p_customer: payment.customer,
      p_provider_subscription: payment.subscription ?? null,
      p_kind: kind,
      p_amount_cents: reaisParaCentavos(payment.value),
      p_due_date: payment.dueDate,
      p_status: status,
      p_invoice_url: linkSeguroAsaas(payment.invoiceUrl),
    });
    if (error) throw new Error("billing_apply");
    return ok(data, { requestId });
  } catch {
    // 503 solicita reentrega; identidade ainda pode estar sendo vinculada no checkout.
    return fail("unavailable", "Conciliação não confirmada. Reentregue o evento.", 503, {
      requestId,
    });
  }
}
