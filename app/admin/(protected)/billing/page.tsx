import { traduzir } from "@/lib/i18n/dicionario";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { createClient } from "@/lib/supabase/server";
import type { PlanoFinanceiro } from "@/lib/vellum/financeiro";
import { EditorPlanos } from "./planos";
import { normalizarIdioma } from "@/lib/i18n/idiomas";
export const dynamic = "force-dynamic";
export const metadata = { title: "Planos e assinaturas" };
export default async function AdminBillingPage() {
  const t = (texto: string) => traduzir(texto, idioma);

  const ctx = await requirePlatformAdmin();
  const idioma = normalizarIdioma(ctx.user.user_metadata?.locale as string | undefined);
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
        <h1 className="text-2xl font-semibold">{t("Planos e assinaturas")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("Preços em BRL e orçamento de IA em USD. Mudanças valem para novas contratações.")}
        </p>
      </header>
      {error ? (
        <p role="alert">
          {t("Aplique o schema financeiro para editar planos e consultar assinaturas.")}
        </p>
      ) : (
        <>
          <EditorPlanos planos={plans as PlanoFinanceiro[]} />
          <section>
            <h2 className="mb-3 font-semibold">{t("Últimas assinaturas · sandbox")}</h2>
            {!subscriptions?.length ? (
              <p className="text-sm text-muted-foreground">{t("Nenhuma assinatura registrada.")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr>
                      <th className="p-2">{t("Empresa")}</th>
                      <th className="p-2">{t("Plano")}</th>
                      <th className="p-2">{t("Status")}</th>
                      <th className="p-2">{t("Contratação")}</th>
                      <th className="p-2">{t("Fim do período")}</th>
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
