import { SiteShell } from "@/components/vellum/SiteShell";
import { Planos } from "@/components/vellum/Planos";
import { carregarPlanosPublicos } from "@/lib/vellum/plans-server";

export const metadata = { title: "Planos e preços" };
export const dynamic = "force-dynamic";

export default async function PrecosPage() {
  const planos = await carregarPlanosPublicos();
  return (
    <SiteShell>
      <main id="conteudo" className="vellum-pricing">
        <header className="vellum-pricing-heading">
          <p className="vellum-eyebrow">INVESTIMENTO CLARO. OPERAÇÃO ORGANIZADA.</p>
          <h1>
            Escolha o ritmo
            <br />
            <em>da sua operação.</em>
          </h1>
          <p>
            Agentes, conversas e CRM no mesmo fluxo.
            <br />O volume muda. O método acompanha.
          </p>
        </header>
        <Planos planos={planos} />
        <section className="vellum-faq">
          <h2>As regras, por escrito.</h2>
          <details>
            <summary>O que conta como uma conversa?</summary>
            <p>
              Uma unidade de atendimento por contato em uma janela de 24 horas. Várias mensagens na
              mesma janela contam como uma conversa. Um atendimento iniciado após o fim da janela
              abre outra unidade. A medição precisa considerar a empresa e o contato para evitar
              duplicidade.
            </p>
          </details>
          <details>
            <summary>O que inclui a implantação?</summary>
            <p>
              O valor de implantação aparece nas condições de cada plano. O escopo de configuração
              dos agentes, canais e base de conhecimento deve ser definido com a sua empresa antes
              da contratação.
            </p>
          </details>
          <details>
            <summary>Como funcionam os custos de WhatsApp e IA?</summary>
            <p>
              As conversas do plano não equivalem a mensagens cobradas pela Meta nem a tokens de IA.
              Esses consumos têm medição separada. O orçamento de IA e os custos do canal são
              definidos na configuração comercial da operação.
            </p>
          </details>
          <details>
            <summary>Qual conexão de WhatsApp é utilizada?</summary>
            <p>
              A conexão oficial é a WhatsApp Business Platform da Meta, com suas regras de
              consentimento, templates e janela de atendimento. A plataforma também preserva a
              uma integração alternativa não oficial, com diferenças de suporte,
              estabilidade e risco de bloqueio.
            </p>
          </details>
          <details>
            <summary>Criar uma conta já gera uma cobrança?</summary>
            <p>
              Não. A criação da conta prepara o acesso à plataforma. A assinatura e o pagamento
              precisam ser concluídos em uma etapa de contratação com cobrança explicitamente
              apresentada.
            </p>
          </details>
        </section>
      </main>
    </SiteShell>
  );
}
