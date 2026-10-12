# PROJETO VÉLLUM AI | PLATAFORMA SAAS DE AGENTES COMERCIAIS

Você é um engenheiro de software sênior especializado em SaaS multi-tenant, inteligência artificial, automações comerciais, WhatsApp e arquitetura de sistemas.

Sua missão é transformar o projeto open-source DeskcommCRM em uma plataforma SaaS comercial chamada **Véllum AI**, inspirada no modelo de negócios e nas funcionalidades do Revolução AI / Chatflux.

Repositório de origem:
https://github.com/melgarafael/DeskcommCRM

Fork selecionado:
https://github.com/airshell/WhatsappCRM

## 1. IMPORTAÇÃO E AUDITORIA

- Utilizar toda a estrutura funcional do DeskcommCRM como base.
- Não reconstruir do zero funcionalidades existentes.
- Analisar README, ARCHITECTURE.md, AGENTS.md, LICENSE, banco de dados, autenticação, agentes e integrações.
- Identificar componentes reutilizáveis e recursos faltantes.
- Preservar funcionalidades existentes e adaptar para operação comercial SaaS.
- Respeitar a licença MIT e manter os avisos obrigatórios.
- Antes de modificar, produzir um plano técnico com etapas e dependências.
- Não afirmar que algo está funcionando sem executar os testes.

## 2. IDENTIDADE VÉLLUM AI

Substituir a identidade visual do produto pela marca Véllum AI.

Criar interface premium, moderna, responsiva, com excelente experiência em desktop e celular.

Desenvolver:
- Landing page comercial.
- Página de preços.
- Cadastro e login.
- Onboarding de empresas.
- Dashboard do cliente.
- Dashboard administrativo da Véllum.
- Painel de agentes.
- Caixa de entrada do WhatsApp.
- Gestão de contatos e leads.
- CRM com funil de vendas.
- Relatórios e métricas.
- Faturamento e consumo de créditos.

Usar componentes reutilizáveis e manter consistência visual. Não copiar logos, textos proprietários ou identidade visual de concorrentes.

## 3. ARQUITETURA MULTIEMPRESA

Cada empresa assinante deverá ter:
- Conta e usuários próprios.
- Agentes exclusivos.
- Número de WhatsApp conectado.
- Base de conhecimento privada.
- Contatos e conversas isolados.
- CRM independente.
- Assinatura própria.
- Controle individual de utilização.
- Histórico de pagamentos.

Implementar isolamento real no backend e no banco, com RLS e testes de segurança entre empresas.

Criar três papéis:
1. Superadministrador Véllum.
2. Administrador da empresa.
3. Atendente da empresa.

## 4. AGENTES DE INTELIGÊNCIA ARTIFICIAL

Criar um módulo completo para configurar agentes comerciais sem programação.

Cada empresa poderá:
- Escolher nome e personalidade do agente.
- Definir tom de comunicação.
- Cadastrar informações sobre produtos e serviços.
- Adicionar documentos, perguntas frequentes e URLs autorizadas.
- Configurar horário de atendimento.
- Definir regras comerciais.
- Criar perguntas de qualificação.
- Configurar objetivos de conversão.
- Escolher quando transferir para humano.
- Testar o agente antes de ativar.

Utilizar RAG com base de conhecimento isolada por empresa.

O agente deverá:
- Responder clientes naturalmente.
- Identificar intenções.
- Qualificar leads.
- Consultar informações cadastradas.
- Criar e atualizar contatos.
- Movimentar oportunidades no CRM.
- Realizar agendamentos por integrações autorizadas.
- Resumir conversas.
- Transferir para atendente humano.
- Registrar ações e falhas.
- Evitar inventar informações comerciais.

## 5. WHATSAPP E FOLLOW-UP

Priorizar integração com WhatsApp Business Platform oficial da Meta.

Preservar integrações existentes do DeskcommCRM quando tecnicamente adequadas, incluindo WAHA, mas deixar explícitas as diferenças de estabilidade, suporte e risco de bloqueio.

Implementar:
- Recebimento e envio de mensagens.
- Histórico completo.
- Mensagens de áudio quando suportadas.
- Identificação do cliente.
- Atribuição de atendentes.
- Pausa do agente quando humano assumir.
- Reativação controlada.
- Etiquetas e status.
- Templates aprovados.
- Follow-ups programados.

Criar sequências configuráveis de follow-up, como:
- Após 30 minutos sem resposta.
- Após 24 horas, respeitando regras da Meta.
- Após 3 dias, mediante autorização e template aplicável.

Cancelar automaticamente a sequência quando o cliente responder, solicitar interrupção ou concluir a conversão.

Respeitar consentimento, opt-out, janela de atendimento e políticas da Meta.

## 6. PLANOS E COBRANÇA

Criar planos comerciais editáveis pelo superadministrador.

Valores iniciais:

START:
R$ 399/mês
200 conversas mensais.

GROWTH:
R$ 699/mês
500 conversas mensais.

SCALE:
R$ 999/mês
1.000 conversas mensais.

ENTERPRISE:
Preço personalizado.
Limites personalizados.

Taxa de implantação inicial: R$ 1.000.

Conversa excedente: R$ 2.

Definir conversa faturável como uma unidade de atendimento por contato e janela de 24 horas, com regras claras para reabertura e deduplicação.

Não confundir conversas faturáveis com mensagens, tokens ou cobranças oficiais da Meta.

Implementar:
- Assinatura mensal.
- Checkout.
- Cobrança recorrente.
- Webhooks de pagamento.
- Suspensão por inadimplência.
- Renovação de limites.
- Upgrade e downgrade.
- Histórico financeiro.
- Cupons.
- Faturas.
- Cancelamento.
- Controle de inadimplência.
- Idempotência de eventos financeiros.

Preparar integração com Asaas ou outro gateway brasileiro, usando ambiente sandbox inicialmente.

## 7. CONTROLE DE CRÉDITOS E CUSTOS DE API

Criar sistema interno de medição de consumo.

Registrar por empresa:
- Modelo de IA utilizado.
- Tokens de entrada e saída.
- Custo estimado e custo real quando disponível.
- Consumo por agente.
- Custos de transcrição.
- Custos de mensagens oficiais do WhatsApp.
- Histórico de utilização.

Criar orçamento de IA configurável para cada plano, sem inventar equivalência fixa entre créditos e tokens.

O administrador Véllum deverá poder definir:
- Orçamento incluído no plano.
- Preço de créditos adicionais.
- Limite máximo mensal.
- Alertas em 50%, 80% e 100%.
- Política ao atingir o limite.

Bloquear novas chamadas pagas quando o limite rígido for atingido, preservando atendimento humano e acesso aos dados.

Nunca expor chaves de API no frontend.

## 8. DASHBOARD DO CLIENTE

Exibir:
- Conversas realizadas.
- Leads captados.
- Leads qualificados.
- Agendamentos.
- Conversões registradas.
- Atendimento por IA e humano.
- Desempenho dos agentes.
- Consumo do plano.
- Saldo de créditos.
- Próxima cobrança.

Todos os indicadores devem usar dados reais. Não utilizar métricas fictícias em produção.

## 9. PAINEL SUPERADMINISTRADOR

Permitir que a Véllum:
- Cadastre empresas.
- Configure agentes para clientes.
- Gerencie assinaturas.
- Altere planos.
- Consulte faturamento.
- Acompanhe consumo das APIs.
- Suspenda contas.
- Gerencie limites.
- Visualize logs e erros.
- Configure provedores globais.
- Consulte a saúde das integrações.

Implementar auditoria de ações administrativas e acesso seguro aos dados dos clientes.

## 10. INFRAESTRUTURA

Infraestrutura preferida:
- Cloudflare para DNS, proteção e frontend quando compatível.
- Supabase/PostgreSQL para banco e autenticação.
- Backend Next.js e workers conforme arquitetura existente.
- VPS com Docker para serviços persistentes.
- Integração com OpenAI ou OpenRouter.
- WhatsApp oficial da Meta.
- Asaas para pagamentos.

Não assumir que Cloudflare Pages ou Workers executam diretamente todos os serviços Node, Docker ou processos persistentes.

Criar Docker Compose, variáveis de ambiente de exemplo, instruções de deploy, health checks, backups e documentação.

## 11. SEGURANÇA E QUALIDADE

Implementar:
- Proteção contra acesso entre empresas.
- Validação server-side de permissões.
- Rate limiting.
- Proteção de webhooks.
- Criptografia de segredos.
- Logs sem dados sensíveis desnecessários.
- Políticas LGPD.
- Retenção e exclusão de dados.
- Proteção contra prompt injection.
- Testes unitários, integração e ponta a ponta.

## 12. EXECUÇÃO

Trabalhe em fases:

Fase 1: auditoria do repositório e funcionamento local.

Fase 2: identidade Véllum AI e estrutura multiempresa.

Fase 3: agentes, WhatsApp e follow-ups.

Fase 4: planos, faturamento e créditos.

Fase 5: dashboards, relatórios e onboarding.

Fase 6: segurança, testes e preparação para produção.

Preserve o código existente sempre que possível. Não substitua recursos maduros por implementações simplificadas.

Ao final de cada fase, informe:
- O que foi implementado.
- Arquivos modificados.
- Funcionalidades testadas.
- O que ainda falta.
- Variáveis e serviços necessários.

**Objetivo final:** entregar uma plataforma Véllum AI white-label, multiempresa, com agentes comerciais de IA por assinatura, pronta para testes reais e posterior comercialização, sem dependência operacional do Revolução AI.