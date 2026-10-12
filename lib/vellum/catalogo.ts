/** Catálogo comercial inicial. Valores monetários em centavos de BRL. */
export const PLANOS_VELLUM = [
  {
    id: "start",
    nome: "START",
    preco_cents: 39900,
    conversas: 200,
    descricao: "Para organizar o primeiro atendimento comercial.",
    destaque: false,
  },
  {
    id: "growth",
    nome: "GROWTH",
    preco_cents: 69900,
    conversas: 500,
    descricao: "Para um time que precisa dar continuidade a cada lead.",
    destaque: true,
  },
  {
    id: "scale",
    nome: "SCALE",
    preco_cents: 99900,
    conversas: 1000,
    descricao: "Para uma operação com mais volume de atendimento.",
    destaque: false,
  },
  {
    id: "enterprise",
    nome: "ENTERPRISE",
    preco_cents: null,
    conversas: null,
    descricao: "Para desenhar limites e implantação com a sua operação.",
    destaque: false,
  },
] as const;

export type PlanoVellumId = (typeof PLANOS_VELLUM)[number]["id"];
export const IMPLANTACAO_CENTS = 100000;
export const CONVERSA_EXCEDENTE_CENTS = 200;
export const JANELA_CONVERSA_MS = 24 * 60 * 60 * 1000;

export function formatarBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/** Projeção de preço, não lançamento financeiro. Enterprise exige contrato próprio. */
export function projetarMensalidade(planoId: PlanoVellumId, conversas: number) {
  if (!Number.isSafeInteger(conversas) || conversas < 0) {
    throw new RangeError("Quantidade de conversas deve ser um inteiro não negativo.");
  }
  const plano = PLANOS_VELLUM.find((item) => item.id === planoId);
  if (!plano) throw new RangeError("Plano inválido.");
  if (plano.preco_cents === null || plano.conversas === null) return null;
  const excedentes = Math.max(0, conversas - plano.conversas);
  const excedente_cents = excedentes * CONVERSA_EXCEDENTE_CENTS;
  const total_cents = plano.preco_cents + excedente_cents;
  if (!Number.isSafeInteger(total_cents))
    throw new RangeError("Quantidade excede o limite de cálculo.");
  return { base_cents: plano.preco_cents, excedentes, excedente_cents, total_cents };
}
