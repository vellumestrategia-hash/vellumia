import { traducaoPublica } from "@/lib/vellum/idioma";
import { IdiomaProvider } from "@/lib/i18n/IdiomaProvider";
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
} from "lucide-react";
import { SiteShell } from "@/components/vellum/SiteShell";
import { AtendimentoDemo } from "@/components/vellum/AtendimentoDemo";
import { carregarPlanosPublicos } from "@/lib/vellum/plans-server";
import { formatarBRL } from "@/lib/vellum/catalogo";

export const dynamic = "force-dynamic";
export default async function HomePage() {
  const { t, locale } = await traducaoPublica();

  const planos = await carregarPlanosPublicos();
  const inicial = planos
    .filter((p) => p.preco_cents !== null)
    .sort((a, b) => a.preco_cents! - b.preco_cents!)[0];
  return (
    <IdiomaProvider locale={locale}>
      <SiteShell>
        <main id="conteudo" tabIndex={-1}>
          <section className="vellum-hero">
            <div className="vellum-hero-copy">
              <p className="vellum-eyebrow">
                <span /> {t(" INTELIGÊNCIA COMERCIAL, POR ESCRITO.")}
              </p>
              <h1>
                {t("A conversa começa.")}
                <br />
                {t("Sua operação")}
                <br />
                <em>{t("continua.")}</em>
              </h1>
              <p className="vellum-lead">
                {t(
                  "Agentes de IA que atendem, qualificam e acompanham seus leads no WhatsApp. Seu time entra com contexto. Seu funil acompanha cada passo.",
                )}
              </p>
              <div className="vellum-hero-actions">
                <Link href="/signup" className="vellum-button">
                  {t("Organizar meu atendimento ")}
                  <ArrowUpRight size={18} aria-hidden />
                </Link>
                <Link href="#operacao" className="vellum-text-link">
                  {t("Conhecer a plataforma ")}
                  <ArrowDown size={16} aria-hidden />
                </Link>
              </div>
              <div className="vellum-hero-proof">
                <span>
                  <ShieldCheck size={16} aria-hidden /> {t(" Base privada por empresa")}
                </span>
                <span>
                  <Headphones size={16} aria-hidden /> {t(" IA e pessoas, no mesmo fluxo")}
                </span>
              </div>
            </div>
            <AtendimentoDemo />
          </section>
          <div className="vellum-ribbon">
            <span>{t("DO PRIMEIRO “OLÁ” AO PRÓXIMO PASSO.")}</span>
            <div>
              <span>{t("WhatsApp")}</span>
              <i /> <span>{t("Agentes de IA")}</span>
              <i /> <span>{t("CRM")}</span>
              <i /> <span>{t("Seu time")}</span>
            </div>
          </div>
          <section className="vellum-operation" id="operacao">
            <div className="vellum-section-intro">
              <p className="vellum-eyebrow">{t("UMA OPERAÇÃO. TODO O CONTEXTO.")}</p>
              <h2>
                {t("Menos pontas soltas.")}
                <br />
                <em>{t("Mais continuidade.")}</em>
              </h2>
              <p>
                {t(
                  "Cada atendimento tem uma história. A plataforma reúne as conversas, o conhecimento da empresa e o próximo passo comercial no mesmo lugar.",
                )}
              </p>
            </div>
            <div className="vellum-features">
              {[
                {
                  icon: MessageCircle,
                  title: t("Uma caixa de entrada para o time"),
                  copy: t(
                    "Histórico de conversas, responsáveis e passagem da IA para uma pessoa com o contexto preservado.",
                  ),
                },
                {
                  icon: BookOpen,
                  title: t("Seu conhecimento orienta o agente"),
                  copy: t(
                    "Documentos, perguntas frequentes e informações comerciais para responder a partir do que sua empresa cadastrou.",
                  ),
                },
                {
                  icon: GitBranch,
                  title: t("O funil acompanha a conversa"),
                  copy: t(
                    "Contatos, oportunidades, etapas e próximos passos organizados para o time acompanhar o que está em andamento.",
                  ),
                },
                {
                  icon: CalendarDays,
                  title: t("Acompanhamento com critério"),
                  copy: t(
                    "Retornos programados, consentimento e interrupção quando o cliente responde, pede para sair ou conclui a conversão.",
                  ),
                },
              ].map(({ icon: Icon, title, copy }, i) => (
                <article key={title}>
                  <div className="vellum-feature-heading">
                    <Icon size={24} strokeWidth={1.5} aria-hidden />
                    <span aria-hidden>{String(i + 1).padStart(2, "0")}</span>
                  </div>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </article>
              ))}
            </div>
          </section>
          <section className="vellum-method" aria-labelledby="metodo-titulo">
            <div className="vellum-section-intro">
              <p className="vellum-eyebrow">{t("DO CONHECIMENTO À CONVERSA.")}</p>
              <h2 id="metodo-titulo">
                {t("Sua operação,")}
                <br />
                <em>{t("passo a passo.")}</em>
              </h2>
              <p>
                {t(
                  "Prepare a base, defina o atendimento e acompanhe o que acontece. Cada etapa tem seu lugar.",
                )}
              </p>
            </div>
            <ol>
              {[
                {
                  titulo: t("Organize o conhecimento"),
                  texto: t(
                    "Cadastre as informações que o agente pode usar: serviços, dúvidas frequentes e orientações comerciais.",
                  ),
                  icon: BookOpen,
                },
                {
                  titulo: t("Defina como atender"),
                  texto: t(
                    "Configure o agente e o canal. Revise as perguntas e teste o comportamento antes de ativar.",
                  ),
                  icon: MessageCircle,
                },
                {
                  titulo: t("Acompanhe e ajuste"),
                  texto: t(
                    "Veja as conversas e o funil, assuma quando necessário e refine a operação com o seu time.",
                  ),
                  icon: GitBranch,
                },
              ].map(({ titulo, texto, icon: Icon }, i) => (
                <li key={titulo}>
                  <span className="vellum-method-number" aria-hidden>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3>{titulo}</h3>
                    <p>{texto}</p>
                  </div>
                  <Icon size={22} aria-hidden />
                </li>
              ))}
            </ol>
          </section>
          <section className="vellum-control">
            <div>
              <p className="vellum-eyebrow">{t("AUTONOMIA COM LIMITES CLAROS.")}</p>
              <h2>
                {t("O agente atende.")}
                <br />
                <em>{t("Você define as regras.")}</em>
              </h2>
            </div>
            <div>
              <p>
                {t(
                  "Escolha o tom, os objetivos e as perguntas de qualificação. Defina horários e quando uma pessoa precisa assumir. Teste o agente antes de ativar.",
                )}
              </p>
              <ul>
                <li>
                  <Check size={17} aria-hidden /> {t(" Conhecimento privado por empresa")}
                </li>
                <li>
                  <Check size={17} aria-hidden />{" "}
                  {t(" Histórico de ações e acompanhamento de consumo")}
                </li>
                <li>
                  <Check size={17} aria-hidden />{" "}
                  {t(" Atendimento humano quando a operação precisa")}
                </li>
              </ul>
              <Link href="/signup" className="vellum-button">
                {t("Preparar minha operação ")}
                <ArrowUpRight size={18} aria-hidden />
              </Link>
            </div>
          </section>
          <section className="vellum-start">
            <p className="vellum-eyebrow">{t("UM PLANO PARA O SEU MOMENTO.")}</p>
            <h2>
              {t("Comece com estrutura.")}
              <br />
              {t("Cresça com método.")}
            </h2>
            <p>
              {inicial ? (
                <>
                  {t("Planos a partir de ")}
                  {formatarBRL(inicial.preco_cents!)}
                  {t("/mês, com ")}
                  {inicial.conversas?.toLocaleString(locale)} {t(" conversas incluídas.")}
                </>
              ) : (
                t("Planos definidos para a sua operação.")
              )}
              <br />
              {inicial ? (
                <>
                  {t("Implantação inicial de ")}
                  {formatarBRL(inicial.setup_price_cents ?? 100000)}.
                </>
              ) : (
                t("Consulte as condições de implantação.")
              )}
            </p>
            <Link href="/precos" className="vellum-button outline">
              {t("Conhecer os planos ")}
              <ArrowRight size={17} aria-hidden />
            </Link>
            <p className="vellum-start-note">
              {t(
                "Criar sua conta não gera cobrança. Consulte os planos e as condições antes de contratar.",
              )}
            </p>
          </section>
        </main>
      </SiteShell>
    </IdiomaProvider>
  );
}
