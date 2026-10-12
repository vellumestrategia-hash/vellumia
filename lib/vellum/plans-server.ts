import { createClient } from "@/lib/supabase/server";
import { PLANOS_VELLUM } from "./catalogo";

export interface PlanoComercial {
  id: string;
  nome: string;
  preco_cents: number | null;
  conversas: number | null;
  descricao: string;
  destaque: boolean;
  setup_price_cents?: number;
  overage_price_cents?: number;
}
/** RPC público só publica preço/limites. Fallback permite prévia antes do schema. */
export async function carregarPlanosPublicos(): Promise<PlanoComercial[]> {
  try {
    const { data, error } = await (await createClient()).rpc("fn_billing_public_plans");
    if (error || !Array.isArray(data)) return [...PLANOS_VELLUM];
    return data.map(
      (row: {
        id: string;
        name: string;
        monthly_price_cents: number | null;
        included_conversations: number | null;
        setup_price_cents: number;
        overage_price_cents: number;
      }) => ({
        id: row.id,
        nome: row.name,
        preco_cents: row.monthly_price_cents,
        conversas: row.included_conversations,
        setup_price_cents: row.setup_price_cents,
        overage_price_cents: row.overage_price_cents,
        descricao:
          PLANOS_VELLUM.find((p) => p.id === row.id)?.descricao ??
          "Atendimento comercial com os limites da sua empresa.",
        destaque: row.id === "growth",
      }),
    );
  } catch {
    return [...PLANOS_VELLUM];
  }
}
