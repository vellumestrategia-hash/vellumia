# Contrato financeiro Véllum AI

O módulo financeiro usa BRL em centavos. O custo de IA existente continua em USD; não há conversão fixa de tokens para créditos. Planos guardam um orçamento opcional de IA em centavos de USD, que precisa ser escolhido pela operação.

## Sequência

Administrador da empresa solicita contratação → reserva persistida no banco → cliente/assinatura Asaas sandbox → links hospedados para mensalidade e implantação → webhook autenticado → consulta canônica do pagamento no Asaas → transação de conciliação → ativação somente após os dois pagamentos.

Não coletar cartão na aplicação. Nenhuma assinatura é ativada por retorno do navegador. Respostas incertas de criação não são repetidas automaticamente: ficam em revisão para evitar assinaturas duplicadas. Uma empresa pode ter uma única assinatura; upgrades/downgrades e cancelamento exigem conciliação com o gateway.

## Medição

A primeira mensagem recebida de um contato abre uma janela de 24 horas no relógio de recebimento do servidor. Mensagens seguintes, em qualquer número/canal da mesma empresa, reutilizam essa janela até seu fim. No instante exato de término abre uma nova janela. Grupos, mensagens de saída e histórico anterior à instalação não são faturáveis. O gatilho serializa por empresa/contato e verifica a proveniência dos três registros (mensagem, contato e conversa). A janela pertence ao período em que foi aberta; atravessar uma renovação não duplica a conversa. Excedentes são calculados dos registros persistidos, separados de mensagens/tokens/custos Meta. A emissão automática de cobranças de excedentes só deve ser habilitada após homologação.

## Segurança e homologação

Planos são editáveis somente por superadministrador; snapshots preservam contratos já feitos. Assinaturas, faturas e janelas têm leitura RLS por administrador da própria empresa. Escrita financeira e conciliação são exclusivas do servidor. Eventos usam ID único e são aplicados em transação. A chave Asaas e o token do webhook nunca alcançam o frontend. Chamadas remotas são limitadas ao host sandbox fixo.

Os testes PostgreSQL embarcados exercitam a migration financeira com o contrato mínimo da base. Eles não substituem `test:db` do baseline completo nem homologação remota do Asaas. Ainda serão necessários credenciais privadas, schema instalado e jornada de cobrança sandbox com webhook público.

## Configuração e limites desta etapa

Configurar `ASAAS_SANDBOX_API_KEY` e `ASAAS_WEBHOOK_TOKEN` no servidor; webhook `POST /api/v1/webhooks/asaas`, header `asaas-access-token`. Escolher envio sequencial e eventos de cobranças. A URL precisa ser pública em homologação. Tokens diferentes para API e webhook. Não existe chave de produção nem seletor de host nesta implementação.

Aplicar baseline em instalação nova; a migration 0231 está refletida no apêndice e MANIFEST. `/admin/billing` permite editar planos; `/app/settings/billing` mostra contratação, faturas e conversas persistidas. A reserva única de contratação tem estados `creating`, `ready` e `review`; uma operação em revisão exige consulta ao gateway e saneamento pelo operador.

`VELLUM_BILLING_ENFORCEMENT=true` habilita o gate no seam canônico de LLM, antes de resolver credenciais ou chamar o provedor. Ele recusa assinatura ausente/inativa/expirada e gasto no teto USD escolhido no snapshot. A régua permanece `fn_gasto_de_ia_do_mes`, compartilhada com o orçamento da base. No inbound, a recusa usa a passagem ao atendente já existente; o acesso humano e os dados continuam disponíveis. Falha de banco também recusa a chamada. Enquanto o schema e a jornada não forem homologados, manter `false`. Os caminhos legados depreciados não são autorizados para operação SaaS.

Pendências de desenvolvimento/homologação: cupons, créditos adicionais, emissão e conciliação de excedentes, upgrade/downgrade e cancelamento com confirmação do gateway, reconciliação automatizada de operações incertas, alertas comerciais em 50/80/100%, cálculo de custos efetivos de transcrição/Meta e validação de concorrência em PostgreSQL PG15 do baseline completo. O módulo entregue não permite comercialização antes desses gates.

Referências verificadas em 12/10/2026: [assinaturas](https://docs.asaas.com/reference/criar-nova-assinatura), [clientes](https://docs.asaas.com/reference/criar-novo-cliente), [recebimento/idempotência de eventos](https://docs.asaas.com/docs/receive-asaas-events-at-your-webhook-endpoint), [sandbox](https://docs.asaas.com/docs/sandbox).
