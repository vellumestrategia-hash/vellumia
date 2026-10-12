import { traduzir } from "@/lib/i18n/dicionario";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { carregarPlanosPublicos } from "@/lib/vellum/plans-server";
import { asaasConfigurado } from "@/lib/vellum/asaas";
import { calcularExcedente, linkSeguroAsaas } from "@/lib/vellum/financeiro";
import { Checkout } from "./Checkout";
import type { Idioma } from "@/lib/i18n/idiomas";

const moeda = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const estados: Record<string, string> = {
  pending: "Aguardando pagamento",
  active: "Ativa",
  past_due: "Pagamento pendente ou estornado",
  canceled: "Cancelada",
  paid: "Paga",
  overdue: "Vencida",
  refunded: "Estornada",
  review: "Em revisão",
  creating: "Preparando contratação",
  ready: "Links disponíveis",
};

export async function Financeiro({
  orgId,
  suporteTemporario,
  idioma = "pt-BR",
}: {
  orgId: string;
  suporteTemporario: boolean;
  idioma?: Idioma;
}) {
  const t = (texto: string) => traduzir(texto, idioma);

  const db = await createClient();
  const planos = await carregarPlanosPublicos();
  const { data: subscription, error } = await db
    .from("billing_subscriptions")
    .select("*")
    .eq("organization_id", orgId)
    .maybeSingle();
  if (error)
    return (
      <Card className="p-6">
        <h2 className="font-semibold">{t("Financeiro ainda não instalado")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t(
            "O schema financeiro precisa ser aplicado ao banco. Nenhum consumo ou pagamento é exibido antes da configuração.",
          )}
        </p>
      </Card>
    );
  if (!subscription)
    return (
      <Card className="max-w-3xl space-y-4 p-6">
        <h2 className="font-semibold">{t("Escolha sua assinatura")}</h2>
        <Checkout planos={planos} disponivel={asaasConfigurado() && !suporteTemporario} />
      </Card>
    );
  const { data: invoices, error: invoiceError } = await db
    .from("billing_invoices")
    .select("*")
    .eq("organization_id", orgId)
    .order("due_date", { ascending: false })
    .limit(50);
  const { count, error: usageError } = subscription.period_start
    ? await db
        .from("billing_conversation_windows")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("period_start", subscription.period_start)
    : { count: null, error: null };
  const excess =
    count !== null
      ? calcularExcedente(
          count,
          subscription.included_conversations,
          subscription.overage_price_cents,
        )
      : null;
  return (
    <>
      <Card className="max-w-3xl space-y-3 p-6">
        <h2 className="font-semibold">
          {planos.find((p) => p.id === subscription.plan_id)?.nome ?? subscription.plan_id} ·{" "}
          {t(estados[subscription.status] ?? subscription.status)}
        </h2>
        <p>
          {moeda(subscription.monthly_price_cents)}
          {t("/mês")} · {subscription.included_conversations} {t("conversas incluídas.")}
        </p>
        <p className="text-sm text-muted-foreground">
          {t("Contratação: ")}
          {t(estados[subscription.checkout_state] ?? subscription.checkout_state)}.{" "}
          {subscription.checkout_state === "review" &&
            t("Consulte o administrador para conciliar a operação antes de tentar novamente.")}
        </p>
        {count !== null && !usageError && (
          <p>
            {t("Conversas abertas neste período: ")}
            <strong>{count}</strong>
            {t(". Excedente apurado:")} {moeda(excess!.amount_cents)} ({excess!.conversas}{" "}
            {t(" conversas).")}
          </p>
        )}
        {usageError && <p role="alert">{t("Não foi possível consultar o consumo.")}</p>}
        {subscription.period_start && (
          <p className="text-sm">
            {t("Período: ")}
            {subscription.period_start} {t(" a ")}
            {subscription.period_end}
            {t(". Custos de IA e Meta são medidos separadamente em Uso de IA.")}
          </p>
        )}
        <p className="text-sm text-muted-foreground">
          {t(
            "Alteração de plano e cancelamento: solicite ao administrador. Não há cobrança automática de excedentes nesta etapa de homologação.",
          )}
        </p>
      </Card>
      <section className="space-y-3">
        <h2 className="font-semibold">{t("Faturas · sandbox")}</h2>
        {invoiceError ? (
          <p role="alert">{t("Não foi possível consultar as faturas.")}</p>
        ) : !invoices?.length ? (
          <p className="text-sm text-muted-foreground">
            {t("Ainda não há faturas sincronizadas.")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="p-3">{t("Tipo")}</th>
                  <th className="p-3">{t("Vencimento")}</th>
                  <th className="p-3">{t("Valor")}</th>
                  <th className="p-3">{t("Situação")}</th>
                  <th className="p-3">{t("Pagamento")}</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((i) => (
                  <tr key={i.provider_payment_id} className="border-t">
                    <td className="p-3">
                      {i.kind === "setup"
                        ? t("Implantação")
                        : i.kind === "monthly"
                          ? t("Mensalidade")
                          : t("Excedentes")}
                    </td>
                    <td className="p-3">{i.due_date}</td>
                    <td className="p-3">{moeda(i.amount_cents)}</td>
                    <td className="p-3">{t(estados[i.status] ?? i.status)}</td>
                    <td className="p-3">
                      {linkSeguroAsaas(i.invoice_url) && i.status !== "paid" ? (
                        <a
                          className="underline"
                          href={linkSeguroAsaas(i.invoice_url)!}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {t("Abrir no Asaas")}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
