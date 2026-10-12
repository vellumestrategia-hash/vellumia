"use client";
import { useT } from "@/lib/i18n/IdiomaProvider";

import { useState } from "react";
import type { PlanoFinanceiro } from "@/lib/vellum/financeiro";

export function EditorPlanos({ planos }: { planos: PlanoFinanceiro[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {planos.map((p) => (
        <EditorPlano key={p.id} plano={p} />
      ))}
    </div>
  );
}
function EditorPlano({ plano }: { plano: PlanoFinanceiro }) {
  const t = useT();

  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  async function salvar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFeedback("");
    const data = new FormData(event.currentTarget);
    const money = (name: string) =>
      data.get(name) === "" ? null : Math.round(Number(data.get(name)) * 100);
    try {
      const response = await fetch("/api/v1/admin/billing/plans", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: plano.id,
          name: String(data.get("name")),
          monthly_price_cents: money("price"),
          included_conversations: data.get("included") === "" ? null : Number(data.get("included")),
          setup_price_cents: money("setup"),
          overage_price_cents: money("overage"),
          ai_budget_usd_cents: money("ai"),
          enabled: data.get("enabled") === "on",
        }),
      });
      const result = await response.json();
      setFeedback(
        response.ok
          ? "Plano salvo. Contratos existentes mantêm seus valores."
          : (result.error?.message ?? "Falha ao salvar."),
      );
    } catch {
      setFeedback("Conexão interrompida. Verifique o plano antes de repetir.");
    } finally {
      setBusy(false);
    }
  }
  const field = (name: string, label: string, value: number | null, step = "0.01") => (
    <label className="block text-sm">
      {label}
      <input
        name={name}
        type="number"
        min="0"
        step={step}
        defaultValue={value ?? ""}
        className="mt-1 block w-full rounded-md border bg-background p-2"
      />
    </label>
  );
  return (
    <form onSubmit={salvar} className="space-y-3 rounded-lg border bg-card p-5">
      <h2 className="font-semibold">{plano.id.toUpperCase()}</h2>
      <label className="block text-sm">
        {t("Nome")}
        <input
          name="name"
          maxLength={80}
          required
          defaultValue={plano.name}
          className="mt-1 block w-full rounded-md border bg-background p-2"
        />
      </label>
      {field(
        "price",
        t("Mensalidade (R$) · vazio para personalizado"),
        plano.monthly_price_cents === null ? null : plano.monthly_price_cents / 100,
      )}
      {field(
        "included",
        t("Conversas incluídas · vazio para personalizado"),
        plano.included_conversations,
        "1",
      )}
      {field("setup", t("Implantação (R$)"), plano.setup_price_cents / 100)}
      {field("overage", t("Conversa excedente (R$)"), plano.overage_price_cents / 100)}
      {field(
        "ai",
        t("Teto mensal de IA (US$) · vazio até definir orçamento"),
        plano.ai_budget_usd_cents === null ? null : plano.ai_budget_usd_cents / 100,
      )}
      <label className="flex items-center gap-2 text-sm">
        <input name="enabled" type="checkbox" defaultChecked={plano.enabled} />
        {t("Disponível para contratação")}
      </label>
      <button
        disabled={busy}
        className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"
      >
        {busy ? t("Salvando…") : t("Salvar plano")}
      </button>
      <p role="status" className="text-sm">
        {t(feedback)}
      </p>
    </form>
  );
}
