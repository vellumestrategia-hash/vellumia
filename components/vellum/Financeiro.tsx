import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { carregarPlanosPublicos } from "@/lib/vellum/plans-server";
import { asaasConfigurado } from "@/lib/vellum/asaas";
import { calcularExcedente, linkSeguroAsaas } from "@/lib/vellum/financeiro";
import { Checkout } from "./Checkout";

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
}: {
  orgId: string;
  suporteTemporario: boolean;
}) {
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
        <h2 className="font-semibold">Financeiro ainda não instalado</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          O schema financeiro precisa ser aplicado ao banco. Nenhum consumo ou pagamento é exibido
          antes da configuração.
        </p>
      </Card>
    );
  if (!subscription)
    return (
      <Card className="max-w-3xl space-y-4 p-6">
        <h2 className="font-semibold">Escolha sua assinatura</h2>
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
          {estados[subscription.status] ?? subscription.status}
        </h2>
        <p>
          {moeda(subscription.monthly_price_cents)}/mês · {subscription.included_conversations}{" "}
          conversas incluídas.
        </p>
        <p className="text-sm text-muted-foreground">
          Contratação: {estados[subscription.checkout_state] ?? subscription.checkout_state}.{" "}
          {subscription.checkout_state === "review" &&
            "Consulte o administrador para conciliar a operação antes de tentar novamente."}
        </p>
        {count !== null && !usageError && (
          <p>
            Conversas abertas neste período: <strong>{count}</strong>. Excedente apurado:{" "}
            {moeda(excess!.amount_cents)} ({excess!.conversas} conversas).
          </p>
        )}
        {usageError && <p role="alert">Não foi possível consultar o consumo.</p>}
        {subscription.period_start && (
          <p className="text-sm">
            Período: {subscription.period_start} a {subscription.period_end}. Custos de IA e Meta
            são medidos separadamente em Uso de IA.
          </p>
        )}
        <p className="text-sm text-muted-foreground">
          Alteração de plano e cancelamento: solicite ao administrador. Não há cobrança automática
          de excedentes nesta etapa de homologação.
        </p>
      </Card>
      <section className="space-y-3">
        <h2 className="font-semibold">Faturas · sandbox</h2>
        {invoiceError ? (
          <p role="alert">Não foi possível consultar as faturas.</p>
        ) : !invoices?.length ? (
          <p className="text-sm text-muted-foreground">Ainda não há faturas sincronizadas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="p-3">Tipo</th>
                  <th className="p-3">Vencimento</th>
                  <th className="p-3">Valor</th>
                  <th className="p-3">Situação</th>
                  <th className="p-3">Pagamento</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((i) => (
                  <tr key={i.provider_payment_id} className="border-t">
                    <td className="p-3">
                      {i.kind === "setup"
                        ? "Implantação"
                        : i.kind === "monthly"
                          ? "Mensalidade"
                          : "Excedentes"}
                    </td>
                    <td className="p-3">{i.due_date}</td>
                    <td className="p-3">{moeda(i.amount_cents)}</td>
                    <td className="p-3">{estados[i.status] ?? i.status}</td>
                    <td className="p-3">
                      {linkSeguroAsaas(i.invoice_url) && i.status !== "paid" ? (
                        <a
                          className="underline"
                          href={linkSeguroAsaas(i.invoice_url)!}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Abrir no Asaas
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
