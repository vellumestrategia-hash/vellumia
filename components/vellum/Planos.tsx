import Link from "next/link";
import { ArrowUpRight, Check } from "lucide-react";
import {
  CONVERSA_EXCEDENTE_CENTS,
  formatarBRL,
  IMPLANTACAO_CENTS,
  PLANOS_VELLUM,
} from "@/lib/vellum/catalogo";
import type { PlanoComercial } from "@/lib/vellum/plans-server";

export function Planos({
  mostrarCadastro = true,
  planos = [...PLANOS_VELLUM],
}: {
  mostrarCadastro?: boolean;
  planos?: PlanoComercial[];
}) {
  return (
    <>
      <div className="vellum-plans">
        {planos.map((plano) => (
          <article className={`vellum-plan ${plano.destaque ? "featured" : ""}`} key={plano.id}>
            {plano.destaque && <span className="vellum-plan-label">Para crescer com método</span>}
            <h3>{plano.nome}</h3>
            <p>{plano.descricao}</p>
            <div className="vellum-plan-price">
              {plano.preco_cents === null ? (
                <strong>Sob medida</strong>
              ) : (
                <>
                  <strong>{formatarBRL(plano.preco_cents)}</strong>
                  <span>/mês</span>
                </>
              )}
            </div>
            <div className="vellum-plan-limit">
              {plano.conversas === null
                ? "Limites definidos com sua empresa"
                : `${plano.conversas.toLocaleString("pt-BR")} conversas por mês`}
            </div>
            <ul>
              {plano.setup_price_cents !== undefined && (
                <li>
                  Implantação: {formatarBRL(plano.setup_price_cents)} · Excedente:{" "}
                  {formatarBRL(plano.overage_price_cents ?? CONVERSA_EXCEDENTE_CENTS)}/conversa
                </li>
              )}
              <li>
                <Check size={15} aria-hidden /> Agentes comerciais com sua base
              </li>
              <li>
                <Check size={15} aria-hidden /> Caixa de entrada e atendimento humano
              </li>
              <li>
                <Check size={15} aria-hidden /> CRM, follow-ups e relatórios
              </li>
              <li>
                <Check size={15} aria-hidden /> Ambiente privado da sua empresa
              </li>
            </ul>
            {mostrarCadastro && (
              <Link href="/signup" className={`vellum-button ${plano.destaque ? "" : "outline"}`}>
                Criar conta <ArrowUpRight size={16} aria-hidden />
              </Link>
            )}
          </article>
        ))}
      </div>
      <div className="vellum-pricing-note">
        {!planos.some((p) => p.setup_price_cents !== undefined) && (
          <p>
            Implantação inicial: <strong>{formatarBRL(IMPLANTACAO_CENTS)}</strong>. Conversa
            excedente: <strong>{formatarBRL(CONVERSA_EXCEDENTE_CENTS)}</strong>.
          </p>
        )}
        <p>
          Uma conversa corresponde ao atendimento de um contato em uma janela de 24 horas. Mensagens
          dentro dessa janela não são novas conversas. Custos oficiais da Meta e consumo de IA são
          medidos separadamente. A criação de conta não realiza uma cobrança.
        </p>
      </div>
    </>
  );
}
