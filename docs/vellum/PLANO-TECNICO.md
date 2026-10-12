# Véllum AI — auditoria e plano técnico

Data: 11/10/2026. Origem importada: airshell/WhatsappCRM, commit 1c9a46a1. O remoto da origem foi removido. O usuário posteriormente autorizou publicação e continuidade em vellumestrategia-hash/vellumia. LICENSE MIT de Rafael Melgaço é mantida. O estado atual de execução está em CONTINUIDADE.md.

## Decisão de arquitetura

Adaptar a aplicação Next.js 16 / React 19 / Supabase existente. Preservar os agentes, RAG, inbox, CRM, RBAC, auditoria, segurança, workers e WhatsApp existentes. Reescrever esses módulos descartaria funcionalidades e cobertura maduras. Um frontend separado duplicaria autenticação e contratos; a adaptação no próprio app mantém uma única plataforma.

## Identidade

Fonte: ../Véllum/relancamento/assets/fontes-editaveis/template-tese.html e assets/avatar.png. Paleta creme #F5F0E6, azul #0C1F33, vermelho #9E2B25. Fraunces para títulos, Archivo para leitura e IBM Plex Mono para dados. Usar o selo V original. Tom direto, sem promessas de resultados ou métricas fictícias. Assinatura visual: conversa, qualificação e passagem ao humano apresentadas como registro de atendimento, identificado como exemplo.

## Fase 1 — importação e execução

- Clone concluído em VellumAI; repositório público não recebe alterações.
- AGENTS.md, CLAUDE.md, README.md, ARCHITECTURE.md e LICENSE auditados.
- Instalar as versões do pnpm-lock.yaml com pnpm 9.15.9; não substituir dependências maduras.
- Configurar URL base https://dchhxzssxkrvqqmozydv.supabase.co (o SDK acrescenta /rest/v1).
- Chave pública fornecida pelo usuário; service_role, conexão PostgreSQL e schema remoto ainda não fornecidos/verificados.
- Docker não está instalado neste computador; testes de banco locais dependem dele.

## Fase 2 — marca e empresas

- Reutilizar resolvedor de marca de instalação e organização, com fallback Véllum AI e marca configurada por ambiente.
- Adicionar landing em / e preços em /precos, acessíveis antes do login; preservar /login, /signup e onboarding existentes.
- Aplicar cores e tipografia aos componentes existentes. Manter temas, contraste, teclado e telas móveis.
- Isolamento: manter organization_id, RLS e guards existentes. Nenhuma declaração de isolamento validado sem executar a suíte real de banco.
- Papéis solicitados mapeados aos existentes: platform_admin = superadministrador; admin = administrador da empresa; agent = atendente. manager/viewer continuam disponíveis para preservar compatibilidade.

## Fase 3 — agentes e WhatsApp

Confirmado por código: lib/agent-engine, lib/ai/rag, lib/followup, lib/waha, canal oficial e templates em Conexões, workers e controles de takeover. Preservar esses fluxos. Validar ponta a ponta com banco semeado, provedor IA e número de teste. Priorizar conexão oficial Meta na documentação; WAHA é integração alternativa não oficial. Não chamar uma simulação de resposta real.

## Fase 4 — cobrança

Na auditoria inicial, app/app/settings/billing/page.tsx continha somente “Em breve”. A etapa financeira implementou catálogo compartilhado e editável: START 39900 centavos/200 conversas, GROWTH 69900/500, SCALE 99900/1000, ENTERPRISE personalizado. Valores iniciais de implantação 100000 centavos e excedente 200 centavos. A interface explica a janela de 24 horas e a distinção dos custos Meta/IA. Assinaturas, faturas, medição, checkout sandbox e webhook já estão implementados; ver FINANCEIRO.md para os contratos e as pendências de homologação.

Entrega financeira completa exige tabelas de planos editáveis, assinaturas, faturas, eventos idempotentes, janelas faturáveis por contato, checkout sandbox Asaas e conciliação. Nenhuma cobrança deve ser ativada sem credenciais e teste sandbox. Medição de tokens e orçamento de IA existentes não equivalem a conversas faturáveis.

## Fase 5 — dashboards e onboarding

Reaproveitar dashboards administrativos, análise, onboarding, agentes, contatos e funil. Produção lê dados reais do Supabase. Nenhum dataset fictício alimenta os indicadores. Documentar o estado de assinatura e configuração com honestidade.

## Fase 6 — validação e infraestrutura

- Executar typecheck, lint, testes unitários e build; registrar falhas herdadas separadamente.
- Provar landing/preços/login por navegador desktop e mobile com screenshot e verificação de overflow.
- Reutilizar Dockerfiles e Compose existentes; elaborar execução local da versão própria sem puxar imagem upstream sobre alterações Véllum.
- Preparar roteiro de aplicação do baseline, bootstrap do administrador, backups, healthchecks e serviços persistentes em VPS.
- Testes RLS e jornadas autenticadas exigem PostgreSQL real e credenciais; não confundir verificação pública com esses testes.

## Dependências e ordem

Identidade e catálogo → páginas comerciais → entrada/auth → configuração local → testes públicos. Schema aplicado + service_role + bootstrap → jornada autenticada e testes RLS → provedores de IA/Meta → atendimento real → gateway sandbox → testes financeiros → preparação de produção.
