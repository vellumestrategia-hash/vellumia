"use client";

import { useState } from "react";
import { ArrowRight, BookOpen, Check, GitBranch, Headphones, MessageCircle } from "lucide-react";
import { useT } from "@/lib/i18n/IdiomaProvider";

/** Demonstração editorial: conteúdo fictício, sem consulta ou chamada de IA. */
export function AtendimentoDemo() {
  const t = useT();
  const [etapa, setEtapa] = useState(0);
  const etapas = [
    {
      nome: t("Atender"),
      icon: MessageCircle,
      status: t("Em atendimento"),
      pergunta: t("Olá! Quero entender como funciona a consultoria para a minha empresa."),
      resposta: t("Olá, Marina. Me conta: qual é o principal desafio do seu atendimento hoje?"),
      fonte: t("Base de conhecimento da empresa"),
      contexto: t("Interesse em consultoria"),
      detalhe: t("O agente consulta o conhecimento cadastrado para orientar a conversa."),
      proximo: t("Entender a necessidade"),
    },
    {
      nome: t("Qualificar"),
      icon: GitBranch,
      status: t("Em qualificação"),
      pergunta: t("A gente recebe os contatos, mas perde o acompanhamento depois."),
      resposta: t(
        "Entendi. Quem acompanha esses contatos hoje e como vocês organizam os retornos?",
      ),
      fonte: t("Perguntas de qualificação"),
      contexto: t("Desafio: acompanhamento dos contatos"),
      detalhe: t("As respostas ajudam a organizar o contato e o próximo passo no funil."),
      proximo: t("Registrar o contexto comercial"),
    },
    {
      nome: t("Passar ao time"),
      icon: Headphones,
      status: t("Atendimento humano"),
      pergunta: t("Quero conversar com alguém sobre a nossa operação."),
      resposta: t(
        "Vou encaminhar para o time com o que conversamos. Assim, vocês continuam de onde pararam.",
      ),
      fonte: t("Histórico compartilhado com o time"),
      contexto: t("Contexto registrado. Próximo passo definido."),
      detalhe: t("Uma pessoa assume com o histórico e a necessidade do contato disponíveis."),
      proximo: t("Conversa com o especialista"),
    },
  ];
  const atual = etapas[etapa];
  const Icon = atual.icon;

  return (
    <div
      className="vellum-demo"
      aria-label={t("Exemplo ilustrativo de um atendimento, sem dados reais")}
    >
      <div className="vellum-demo-caption">
        <span>
          <MessageCircle size={15} aria-hidden />
          {t("DA CONVERSA À OPERAÇÃO")}
        </span>
        <small>{t("EXEMPLO ILUSTRATIVO")}</small>
      </div>
      <div
        className="vellum-demo-steps"
        role="group"
        aria-label={t("Explorar etapas do atendimento")}
      >
        {etapas.map((item, i) => (
          <button
            key={item.nome}
            type="button"
            aria-pressed={etapa === i}
            aria-controls="demo-atendimento"
            onClick={() => setEtapa(i)}
          >
            <span aria-hidden>{String(i + 1).padStart(2, "0")}</span>
            {item.nome}
          </button>
        ))}
      </div>
      <div id="demo-atendimento" className="vellum-demo-body">
        <div className="vellum-demo-conversation">
          <div className="vellum-demo-contact">
            <span className="vellum-avatar" aria-hidden>
              MC
            </span>
            <div>
              <strong>{t("Marina Costa")}</strong>
              <span>{t("Interesse em consultoria")}</span>
            </div>
            <MessageCircle size={18} aria-hidden />
          </div>
          <div className="vellum-demo-messages" aria-live="polite" aria-atomic="true">
            <div className="vellum-demo-message inbound">
              <small>{t("MARINA")}</small>
              <p>{atual.pergunta}</p>
            </div>
            <div className="vellum-demo-message outbound">
              <small>
                <Icon size={13} aria-hidden />
                {t(" AGENTE VÉLLUM")}
              </small>
              <p>{atual.resposta}</p>
            </div>
          </div>
          <div className="vellum-demo-source">
            <BookOpen size={14} aria-hidden />
            <span>{atual.fonte}</span>
          </div>
        </div>
        <div className="vellum-demo-context">
          <span className="vellum-demo-context-label">{t("CONTEXTO DO CONTATO")}</span>
          <span className="vellum-demo-status">
            <Icon size={14} aria-hidden />
            {atual.status}
          </span>
          <strong>{atual.contexto}</strong>
          <p>{atual.detalhe}</p>
          <div className="vellum-demo-next">
            <span>{t("PRÓXIMO PASSO")}</span>
            <strong>{atual.proximo}</strong>
            <ArrowRight size={18} aria-hidden />
          </div>
        </div>
      </div>
      <div className="vellum-demo-footer">
        <Check size={15} aria-hidden />
        <span>{t("IA e pessoas, com o mesmo contexto.")}</span>
        <span aria-hidden>V.</span>
      </div>
    </div>
  );
}
