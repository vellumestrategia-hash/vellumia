import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Check,
  GitBranch,
  Headphones,
  MessageCircle,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { SiteShell } from "@/components/vellum/SiteShell";
import { carregarPlanosPublicos } from "@/lib/vellum/plans-server";
import { formatarBRL } from "@/lib/vellum/catalogo";

export const dynamic = "force-dynamic";
export default async function HomePage() {
  const planos = await carregarPlanosPublicos();
  const inicial = planos
    .filter((p) => p.preco_cents !== null)
    .sort((a, b) => a.preco_cents! - b.preco_cents!)[0];
  return (
    <SiteShell>
      <main id="conteudo">
        <section className="vellum-hero">
          <div className="vellum-hero-copy">
            <p className="vellum-eyebrow">
              <span /> INTELIGÊNCIA COMERCIAL, POR ESCRITO.
            </p>
            <h1>
              A conversa começa.
              <br />
              Sua operação
              <br />
              <em>continua.</em>
            </h1>
            <p className="vellum-lead">
              Agentes de IA que atendem, qualificam e acompanham seus leads no WhatsApp. Seu time
              entra com contexto. Seu funil acompanha cada passo.
            </p>
            <div className="vellum-hero-actions">
              <Link href="/signup" className="vellum-button">
                Organizar meu atendimento <ArrowUpRight size={18} aria-hidden />
              </Link>
              <Link href="#operacao" className="vellum-text-link">
                Conhecer a plataforma <ArrowDown size={16} aria-hidden />
              </Link>
            </div>
            <div className="vellum-hero-proof">
              <span>
                <ShieldCheck size={16} aria-hidden /> Base privada por empresa
              </span>
              <span>
                <Headphones size={16} aria-hidden /> IA e pessoas, no mesmo fluxo
              </span>
            </div>
          </div>
          <div
            className="vellum-workflow"
            aria-label="Exemplo ilustrativo de um atendimento, sem dados reais"
          >
            <div className="vellum-workflow-top">
              <span>
                <MessageCircle size={16} aria-hidden /> REGISTRO DE ATENDIMENTO
              </span>
              <small>EXEMPLO ILUSTRATIVO</small>
            </div>
            <div className="vellum-workflow-contact">
              <div className="vellum-avatar">MC</div>
              <div>
                <strong>Marina Costa</strong>
                <span>Interesse em consultoria</span>
              </div>
              <span className="vellum-pill">Novo contato</span>
            </div>
            <div className="vellum-message inbound">
              <small>MARINA</small>
              <p>Olá! Quero entender como funciona a consultoria para a minha empresa.</p>
            </div>
            <div className="vellum-message outbound">
              <small>
                <Sparkles size={12} aria-hidden /> AGENTE VÉLLUM
              </small>
              <p>Olá, Marina. Me conta: qual é o principal desafio do seu atendimento hoje?</p>
            </div>
            <div className="vellum-message inbound last">
              <small>MARINA</small>
              <p>A gente recebe os contatos, mas perde o acompanhamento depois.</p>
            </div>
            <div className="vellum-record">
              <span>
                <Check size={14} aria-hidden />
              </span>
              <div>
                <strong>Contexto registrado. Próximo passo definido.</strong>
                <p>Lead qualificado → conversa com o especialista</p>
              </div>
            </div>
            <div className="vellum-workflow-bottom">
              <GitBranch size={15} aria-hidden />
              <span>Contato</span>
              <ArrowRight size={13} aria-hidden />
              <span>Qualificação</span>
              <ArrowRight size={13} aria-hidden />
              <strong>Próximo passo</strong>
            </div>
            <div className="vellum-workflow-stamp">
              CONTEXTO
              <br />
              <strong>PRESERVADO.</strong>
            </div>
          </div>
        </section>
        <div className="vellum-ribbon">
          <span>DO PRIMEIRO “OLÁ” AO PRÓXIMO PASSO.</span>
          <div>
            <span>WhatsApp</span>
            <i /> <span>Agentes de IA</span>
            <i /> <span>CRM</span>
            <i /> <span>Seu time</span>
          </div>
        </div>
        <section className="vellum-operation" id="operacao">
          <div className="vellum-section-intro">
            <p className="vellum-eyebrow">UMA OPERAÇÃO. TODO O CONTEXTO.</p>
            <h2>
              Menos pontas soltas.
              <br />
              <em>Mais continuidade.</em>
            </h2>
            <p>
              Cada atendimento tem uma história. A plataforma reúne as conversas, o conhecimento da
              empresa e o próximo passo comercial no mesmo lugar.
            </p>
          </div>
          <div className="vellum-features">
            {[
              {
                icon: MessageCircle,
                title: "Uma caixa de entrada para o time",
                copy: "Histórico de conversas, responsáveis e passagem da IA para uma pessoa com o contexto preservado.",
              },
              {
                icon: BookOpen,
                title: "Seu conhecimento orienta o agente",
                copy: "Documentos, perguntas frequentes e informações comerciais para responder a partir do que sua empresa cadastrou.",
              },
              {
                icon: GitBranch,
                title: "O funil acompanha a conversa",
                copy: "Contatos, oportunidades, etapas e próximos passos organizados para o time acompanhar o que está em andamento.",
              },
              {
                icon: CalendarDays,
                title: "Acompanhamento com critério",
                copy: "Retornos programados, consentimento e interrupção quando o cliente responde, pede para sair ou conclui a conversão.",
              },
            ].map(({ icon: Icon, title, copy }) => (
              <article key={title}>
                <Icon size={25} strokeWidth={1.4} aria-hidden />
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="vellum-control">
          <div>
            <p className="vellum-eyebrow">AUTONOMIA COM LIMITES CLAROS.</p>
            <h2>
              O agente atende.
              <br />
              <em>Você define as regras.</em>
            </h2>
          </div>
          <div>
            <p>
              Escolha o tom, os objetivos e as perguntas de qualificação. Defina horários e quando
              uma pessoa precisa assumir. Teste o agente antes de ativar.
            </p>
            <ul>
              <li>
                <Check size={17} aria-hidden /> Conhecimento privado por empresa
              </li>
              <li>
                <Check size={17} aria-hidden /> Histórico de ações e acompanhamento de consumo
              </li>
              <li>
                <Check size={17} aria-hidden /> Atendimento humano quando a operação precisa
              </li>
            </ul>
            <Link href="/signup" className="vellum-button">
              Preparar minha operação <ArrowUpRight size={18} aria-hidden />
            </Link>
          </div>
        </section>
        <section className="vellum-start">
          <p className="vellum-eyebrow">UM PLANO PARA O SEU MOMENTO.</p>
          <h2>
            Comece com estrutura.
            <br />
            Cresça com método.
          </h2>
          <p>
            {inicial ? (
              <>
                Planos a partir de {formatarBRL(inicial.preco_cents!)}/mês, com{" "}
                {inicial.conversas?.toLocaleString("pt-BR")} conversas incluídas.
              </>
            ) : (
              "Planos definidos para a sua operação."
            )}
            <br />
            {inicial ? (
              <>Implantação inicial de {formatarBRL(inicial.setup_price_cents ?? 100000)}.</>
            ) : (
              "Consulte as condições de implantação."
            )}
          </p>
          <Link href="/precos" className="vellum-button outline">
            Conhecer os planos <ArrowRight size={17} aria-hidden />
          </Link>
        </section>
      </main>
    </SiteShell>
  );
}
