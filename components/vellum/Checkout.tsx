"use client";
import { useT } from "@/lib/i18n/IdiomaProvider";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatarBRL } from "@/lib/vellum/catalogo";
import type { PlanoComercial } from "@/lib/vellum/plans-server";

export function Checkout({
  planos,
  disponivel,
}: {
  planos: PlanoComercial[];
  disponivel: boolean;
}) {
  const t = useT();

  const [plano, setPlano] = useState(planos.find((p) => p.preco_cents !== null)?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");
  const router = useRouter();
  const selected = planos.find((p) => p.id === plano);
  async function contratar() {
    setBusy(true);
    setErro("");
    try {
      const response = await fetch("/api/v1/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_id: plano }),
      });
      const data = await response.json();
      if (!response.ok) setErro(data.error?.message ?? "Não foi possível concluir a contratação.");
      else router.refresh();
    } catch {
      setErro("Conexão interrompida. Consulte o estado da contratação antes de repetir.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-3">
      <label htmlFor="billing-plan" className="block text-sm font-medium">
        {t("Plano mensal")}
      </label>
      <select
        id="billing-plan"
        className="rounded-md border bg-background p-2"
        value={plano}
        onChange={(e) => setPlano(e.target.value)}
        disabled={busy}
      >
        {planos
          .filter((p) => p.preco_cents !== null)
          .map((p) => (
            <option value={p.id} key={p.id}>
              {p.nome} · {formatarBRL(p.preco_cents!)}
              {t("/mês")}
            </option>
          ))}
      </select>
      {selected && (
        <p className="text-sm text-muted-foreground">
          {t("Implantação: ")}
          {formatarBRL(selected.setup_price_cents ?? 100000)}
          {t(". Excedente:")} {formatarBRL(selected.overage_price_cents ?? 200)}
          {t("/conversa. Os pagamentos são feitos nos links hospedados pelo Asaas.")}
        </p>
      )}
      <p className="text-sm">
        {t(
          "Ambiente de teste sandbox. Nenhum valor real será movimentado. Gerar os links ainda não ativa a assinatura.",
        )}
      </p>
      <button
        type="button"
        className="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
        onClick={contratar}
        disabled={!disponivel || busy || !plano}
      >
        {busy ? t("Preparando…") : t("Gerar contratação em sandbox")}
      </button>
      {!disponivel && (
        <p className="text-sm text-muted-foreground">
          {t("O administrador precisa instalar o financeiro e configurar o Asaas sandbox.")}
        </p>
      )}
      {erro && (
        <p role="alert" className="text-sm text-destructive">
          {t(erro)}
        </p>
      )}
    </div>
  );
}
