import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { createClient } from "@/lib/supabase/server";
import type { PlanoFinanceiro } from "@/lib/vellum/financeiro";
import { EditorPlanos } from "./planos";
export const dynamic = "force-dynamic";
export const metadata = { title: "Planos e assinaturas" };
export default async function AdminBillingPage() {
  await requirePlatformAdmin();
  const db = await createClient();
  const { data: plans, error } = await db
    .from("billing_plans")
    .select("*")
    .order("monthly_price_cents");
  const { data: subscriptions } = error
    ? { data: null }
    : await db
        .from("billing_subscriptions")
        .select("id,organization_id,plan_id,status,checkout_state,monthly_price_cents,period_end")
        .order("created_at", { ascending: false })
        .limit(100);
  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Planos e assinaturas</h1>
        <p className="text-sm text-muted-foreground">
          Preços em BRL e orçamento de IA em USD. Mudanças valem para novas contratações.
        </p>
      </header>
      {error ? (
        <p role="alert">Aplique o schema financeiro para editar planos e consultar assinaturas.</p>
      ) : (
        <>
          <EditorPlanos planos={plans as PlanoFinanceiro[]} />
          <section>
            <h2 className="mb-3 font-semibold">Últimas assinaturas · sandbox</h2>
            {!subscriptions?.length ? (
              <p className="text-sm text-muted-foreground">Nenhuma assinatura registrada.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr>
                      <th className="p-2">Empresa</th>
                      <th className="p-2">Plano</th>
                      <th className="p-2">Status</th>
                      <th className="p-2">Contratação</th>
                      <th className="p-2">Fim do período</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscriptions.map((s) => (
                      <tr key={s.id} className="border-t">
                        <td className="p-2">{s.organization_id}</td>
                        <td className="p-2">{s.plan_id}</td>
                        <td className="p-2">{s.status}</td>
                        <td className="p-2">{s.checkout_state}</td>
                        <td className="p-2">{s.period_end ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
