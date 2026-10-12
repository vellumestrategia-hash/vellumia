# Véllum AI — ponto de continuidade

Atualização: 12/10/2026. Pasta de trabalho: VellumAI. Destino autorizado: https://github.com/vellumestrategia-hash/vellumia, branch main. A ordem posterior do usuário autoriza envio e continuidade nesse repositório; os repositórios de origem permanecem preservados.

## Estado comprovado

- Base importada: airshell/WhatsappCRM, commit 1c9a46a1, com licença MIT original e README upstream preservados.
- Marca Véllum aplicada a landing, preços, login/cadastro, defaults de marca e módulos financeiros. Paleta, selo e fontes vêm da pasta original Véllum/relancamento, que foi preservada.
- CRM, agentes, RAG, Meta, WAHA, follow-up, RBAC, RLS, auditoria, workers, dashboards e onboarding da base são mantidos.
- Financeiro: planos editáveis; checkout Asaas sandbox; assinatura e implantação; faturas; webhook idempotente com confirmação no provedor; medição de conversas por janela de 24 horas; gate opcional de assinatura/orçamento IA. Contratos em FINANCEIRO.md.
- Migration 0232 sincronizada com baseline e MANIFEST. PGlite testa a migration com contratos mínimos e RLS de duas empresas.
- Evidências locais: 418 testes em 40 arquivos selecionados; TypeScript completo aprovado com heap 4096 MB; lint sem erros; Playwright público/Axe aprovado em desktop e celular. Ver RELATORIO.md para limites e evidências.
- Build local de produção interrompido por pressão de memória; não foi aprovado. Máquina com 6 GB. As verificações completas passam a ser executadas no Actions após o envio.
- GitHub: envio de main confirmado no commit bcd3e285ad3abdbee4270d4ef71fdbc92da896a7; histórico preservado e origin aponta somente para vellumestrategia-hash/vellumia. A conta henrriquelealbranco recebeu WRITE. Workflows de verificação registrados no GitHub; automações upstream restritas à origem e configuração Codespaces preparada. Preparação validada com 37 testes em 7 arquivos, parse dos sete workflows, migration sincronizada e licença intacta. Varredura dos 3978 arquivos versionados não encontrou os sete valores privados presentes no ambiente local. Consultar Actions para o resultado remoto do SHA em revisão; registro de workflow não comprova execução aprovada.
- Verificações completas iniciadas no Actions, com build e bancos descartáveis na nuvem. A primeira execução identificou uma menção ao transporte no FAQ que violava o guard de canais; a cópia pública foi ajustada para explicar a conexão alternativa por suas características. O guard permanece ativo. Execuções anteriores podem aparecer canceladas quando um novo push substitui o mesmo grupo; usar sempre o SHA mais recente para avaliar os resultados.

## Ambiente privado

Supabase base: https://dchhxzssxkrvqqmozydv.supabase.co. URL/chave pública e segredos técnicos estão em `.env.local`, ignorado pelo Git. Schema e bootstrap manual aplicados pelo proprietário e confirmados pela API. Conta solicitada criada em Auth, e-mail confirmado, platform_admin full ativo e login no painel /admin/dashboard comprovado pelo navegador. Nenhum vínculo de empresa, organização cliente ou pagamento foi criado para conceder esse acesso.

Chave privada Supabase configurada e validada apenas no .env.local. SUPABASE_DB_ADMIN_URL não foi fornecida; o proprietário prefere executar SQL no painel. Asaas sandbox e credenciais IA/Meta ainda não configurados. VELLUM_BILLING_ENFORCEMENT=false até homologação; AI_BUDGET_ENFORCEMENT=on; SENTRY_DSN=off. Nunca imprimir ou versionar segredos.

## Atualização de 12/10/2026

Build de produção e verificação pública Playwright/Axe aprovados no GitHub para ea2124c2 (run 38196916647). A suíte completa desse SHA encontrou falhas de importação e dos contratos novos. Correções em revisão: migration financeira renumerada 0232, catálogo público SECURITY INVOKER com privilégios de coluna, financeiro antes da varredura anon final, prova PostgreSQL de isolamento registrada, guards de suporte canônicos, condições upstream explícitas nos testes e tradução espanhola nas telas novas. Resultados futuros devem ser conferidos para o novo SHA.

O usuário solicita receber os SQLs necessários e executá-los pessoalmente. Ver SQL-MANUAL.md. O SQL Editor rejeitou o baseline de 1,2 MB antes de executar; scripts/vellum-sql-editor.mjs produz partes abaixo de 700 KB, preservando comandos inteiros e configuração por sessão. Conta Auth criada ainda não comprova o papel na aplicação. A parte 1 foi reconhecida pela API (tabelas disponíveis); a parte 2 falhou por search_path ausente entre sessões e foi regenerada com public, extensions. Em seguida, a cópia ficou com uma aspa cortada na última linha; após corrigi-la, o hash do playbook agendamento divergiu no editor. O arquivo original LF tem o hash correto; reproduzimos o mesmo erro ao converter a cópia para CRLF ou adicionar indentação. O gerador agora transporta esses playbooks em base64, mantendo a validação md5. A parte 2 corrigida entregue ao proprietário preserva a divisão da parte 1 anterior; não substituir por uma parte 2 de outra divisão. Aguardar confirmação pela API do financeiro e do acesso após sua execução e o bootstrap exclusivamente de plataforma.

GitHub confirmou CI completo (verify + invariants) e build de produção/Playwright público aprovados para f42516de: runs 38200511300 e 38200511295. Os scripts manuais desse SHA passaram no PostgreSQL descartável. E2E 38200511310 aprovou partes 1 e 2; parte 3 acusou o nome de etapa crm_stages.name "Aguardando pagamento" como interface por coincidir com a nova tradução financeira. A origem desse nó foi marcada nas métricas e a régua distingue o dado da empresa sem isentar essa chave de interface. Nomes cadastrados pelas empresas continuam intactos. Os ajustes atuais do transporte SQL, do administrador exclusivamente de plataforma e dessa classificação precisam dos checks no novo SHA. Sete testes locais de transporte SQL/playbook e administrador aprovados; lint dos arquivos de script/teste sem erros.

Sonda autenticada após a última correção confirmou o RPC financeiro disponível no Supabase real: instalação concluída. A conta em Auth permanece válida, mas ainda não há papel platform_admin full ativo; falta o proprietário executar o SQL atualizado 03_administrador_vellum.sql. Confirmar pela API e pela tela /admin após a execução; nenhuma associação de empresa é necessária para esse acesso.

## Próxima sequência

### Refinamento visual de 12/10/2026

O proprietário confirmou a execução do SQL. Sonda com SDK Supabase confirmou Auth válido, platform_admin full ativo, mfa_required=false e zero vínculos de empresa para a conta solicitada. O catálogo público retornou quatro planos; acesso anônimo aos orçamentos privados foi negado (42501). Nenhum SQL adicional é necessário para o refinamento visual.

Checks completos de 8d870d4d aprovados: CI 38210109038, build/Playwright público 38210109020 e E2E 38210109021. Assim, transporte SQL, bootstrap independente de empresa e classificação dos nomes de etapas foram aprovados no PostgreSQL/ambiente descartável da nuvem.

UI UX Pro Max oficial instalada em C:/Users/Lenovo/.codex/skills/ui-ux-pro-max; direção e critérios em DESIGN-SYSTEM.md. Refinamento atual: demonstração ilustrativa interativa de atendimento, menu público móvel acessível, hierarquia/legibilidade, navegação da plataforma agrupada, conta/saída/tema/idioma, estado inicial orientado e erro com repetição no dashboard. Identificação da empresa e seleção ativa refinadas na casca /app. Componentes mantêm marca resolvida e guards. Conta sem empresa não recebe atalho que pressupõe vínculo.

Testes locais: onze casos em três arquivos aprovados (demonstração, estados de erro/carregamento, tooltip e proteção do log de credenciais). Guard de tradução espanhol aprovado na revisão anterior, com mais duas chaves adicionadas para recuperação da consulta de empresas. Novas provas públicas incluem 375, 768, 1024 e 1440px, menu/Escape/foco e três etapas. Checks de d1d4719f reprovaram na tipagem estrita de índice numérico da demonstração; corrigida com tupla e fallback explícito. Aguardar Actions do novo SHA antes de declarar a revisão aprovada.

Prévia local reiniciada e login /admin/dashboard confirmado; não foi necessário mudar cookies ou autenticação. Inspeção real de desktop/celular/escuro confirma indicadores do Supabase, conta proprietária e navegação de plataforma sem depender de empresas. Menu móvel agora restaura foco ao fechar; marca recebe fundo claro para leitura também no escuro. A divergência de hidratação do ThemeToggle ao restaurar o storage foi corrigida preservando o HTML inicial do servidor. Prova E2E dedicada usa conta descartável de plataforma sem vínculos, testa Axe/desktop/celular/tema/Escape/navegação/saída; as fixtures existentes de administrador de empresa não foram promovidas.

Next 16.3 registra argumentos de Server Functions por padrão no desenvolvimento; configuração documentada logging.serverFunctions=false impede registrar argumentos de login. Logs locais da tarefa foram higienizados; teste de configuração evita regressão. Auditoria da aplicação permanece ativa. Capturas privadas da inspeção estão em C:/Users/Lenovo/.codex/tmp/VellumAI-UI, fora do Git; evidências públicas e de fixtures são publicadas como artifacts dos workflows perf/e2e.

Os parágrafos anteriores de "papel aguardando SQL" são histórico do incidente, substituídos pelas sondas acima. Checks de 1ac18496: verify (tipos/lint/suíte unitária) e invariants aprovados no run 38214747615. Build de produção aprovado; validação pública do run 38214747822 falhou no clique Entrar porque o menu móvel estava fechado após sair de Planos. O percurso foi corrigido para abrir o menu antes do clique. Não reduzir a régua de acessibilidade. E2E 38214747693 ainda em execução no momento deste registro; conferir conclusão antes do envio seguinte. Mais um teste local de hidratação aprovado; 16 casos locais de tradução/defasagem aprovados após os últimos rótulos da tela Empresas. Nenhum dos sete segredos locais apareceu nos 4001 arquivos versionados inspecionados.

E2E de 1ac18496 aprovou parte 2; parte 3 teve 54 casos aprovados e a prova nova reprovou ao limpar a fixture: platform_admins.granted_by tem ON DELETE RESTRICT. A limpeza agora remove a própria concessão antes da conta Auth, como a fixture de suporte já fazia. Não alterar o FK, o Supabase real ou a conta proprietária para resolver uma fixture. Capturas desktop e móvel e provas Axe da nova administração foram geradas nesse run; aprovação integral depende da nova execução.

Próximo passo desta etapa: concluir Actions do refinamento para o mesmo SHA. Prova visual local concluída em desktop/celular/escuro; Empresas retornou zero cadastros reais após a primeira compilação dev, sem alterar timeout ou criar fixtures no Supabase remoto. Depois retomar IA/canais/financeiro com suas credenciais ainda ausentes.

1. Consultar os checks no Actions para o SHA em revisão e reparar falhas próprias antes de declarar build/isolamento aprovados. Transferência inicial ao GitHub concluída; não repetir clone nem configurar a origem como remoto de escrita.
2. Concluir homologação de cadastro, onboarding, MFA e isolamento de duas empresas em ambiente descartável. Supabase real já recebeu schema/bootstrap; não repetir instalação ou criar empresas de teste ali sem necessidade.
3. Validar agentes/RAG e atendimento real com provedor IA, número Meta de teste e worker. WAHA é alternativa opcional não oficial.
4. Homologar Asaas sandbox: contratação, mensalidade/implantação, dois pagamentos, webhook, duplicidade, atraso e estorno. Só então ativar o gate SaaS.
5. Completar cupons, créditos adicionais, emissão de excedentes, upgrade/downgrade/cancelamento, reconciliação de operações incertas, alertas 50/80/100% e custos reais de transcrição/Meta. Sem métricas fictícias.
6. Preparar implantação própria com backups, HTTPS, serviços persistentes e publicação de imagens da distribuição. A plataforma ainda não está pronta para comercialização.

## Como retomar

### Revisão de acesso aprovada — código ee6e6f76fad756fac32ba79fcd46a5662da1550c

Em 12/10/2026, os checks desse código terminaram aprovados: CI 38282582626
(TypeScript, lint, 8.026 unitários e 1.481 invariantes de banco/isolamento),
build e interface pública 38282582421, E2E 38282582578 com as três partes
(143 + 95 + 55 = 293 casos aprovados, oito ignorados). Os casos de falha esperada
existentes nas suítes unitária e de invariantes continuam declarados; não são
falhas novas. Esse resultado supera as pendências e reprovações anteriores
da revisão de acesso descritas abaixo. Automações upstream de release/imagens
continuam sem publicar, conforme o contrato desta distribuição.

Inspeção das capturas finais confirmou Inbox carregado depois do cadastro e
depois de sair/entrar, sem skeletons nem aviso antigo de sessão; perfil móvel
com feedback persistente e retorno ao início. Publicação de follow-up também
aprovou depois de mover os avisos para baixo. Artifacts `vellum-acesso-<SHA>`,
`vellum-admin-ui-<SHA>` e `vellum-publico-<SHA>` nos runs correspondentes, retidos
por sete dias. Cópias em C:/Users/Lenovo/.codex/tmp/VellumAI-UI/ci-ee6e6f76-acesso,
ci-ee6e6f76-admin e ci-ee6e6f76-publico. Dados das provas são fixtures.
Relatório e limites em REVISAO-ACESSO-UX.md. Nenhum SQL novo foi necessário.

Pendência de acesso real: Resend Free escolhido pelo proprietário. Ele não tem
acesso à caixa de e-mail do domínio, mas confirmou acesso ao painel DNS; isso
é suficiente para verificar um remetente, sem contratar uma caixa de e-mail.
Consulta pública retornou DNS da HostGator. Proposta ainda não aplicada:
auth.vellumestrategia.com.br / acesso@auth.vellumestrategia.com.br.
Guia completo em RESEND.md. Login do Resend aberto no Chrome, sem sessão;
solicitado que o proprietário entre/crie a conta Free com Gmail e deixe o
painel aberto. Depois cadastrar domínio, entregar registros reais ao painel
DNS, obter chave de envio privada, configurar SMTP no Supabase pela API já
autorizada, aplicar os templates e comprovar entrega/links reais. Não ativar
upgrade nem afrouxar confirmação de e-mail. SMTP e templates ainda não foram
alterados; Site URL/allowlist locais já foram corrigidos para localhost:3010.

A aprovação do Mailpit/ambiente descartável não comprova entrega no Gmail.
IA, Meta e Asaas reais continuam exigindo credenciais/homologação próprias.
O envio posterior somente de documentação não altera o código validado acima.

### Revisão de acesso e primeira experiência — 12/10/2026

Conta de usuário de empresa reproduziu Perfil com navegação vazia: sessão sem
membership, e `/app` resolvia o destino pela interface antes de exigir empresa.
Corrigidos o destino inicial e o gate compartilhado. Administrador sem empresa
entra na administração pelo login comum e conserva perfil pessoal. O cadastro
de teste do proprietário foi concluído pela sessão já aberta, criando Véllum
Estratégia e chegando às boas-vindas; o aceite de termos e as escolhas seguintes
ficaram com a pessoa. Não houve mudança de senha/papel nem SQL manual novo.

Menu/perfil oferecem início, retorno, validação junto ao campo, feedback e
responsividade; logo legível no escuro e mensagens iniciais adaptadas a cliente
SaaS. Plano, provas e limitações em REVISAO-ACESSO-UX.md. Dezoito testes locais
focados aprovados após a regressão reproduzida. Provas E2E ampliadas para a
jornada de cadastro ao CRM, perfil/saída/retorno; links reais de e-mail não são
reescritos pelo helper. Checks completos do novo SHA aguardam Actions. A prova
descartável não valida entrega no Gmail, WhatsApp/IA reais ou cobrança.

Token de gerenciamento fornecido depois permitiu acessar o Supabase real.
Site URL corrigido de localhost:3000 para localhost:3010 e allowlist dessa
origem local registrada; leitura posterior confirmou. A API recusou os modelos
de e-mail com HTTP 400 porque o projeto Free usa o remetente padrão, sem SMTP
próprio. Confirmação continua obrigatória e os modelos permanecem padrão.
Falta configurar um provedor SMTP (pode ter plano gratuito), aplicar os modelos
da Véllum e validar a entrega real. Token não gravado nem versionado. Não é
necessário acesso ao painel proprietário para essa configuração pela API.

CI verify + invariants (38278594958) e build/validação pública (38278594897)
aprovaram f511aa9c; 8.022 unitários aprovados e um caso esperado existente.
As partes 1 e 3 do E2E passaram, incluindo cadastro ao CRM e perfil móvel.
Parte 2 acusou toast sobre o botão Publicar no
construtor de follow-up, com 94 testes aprovados e uma falha. Avisos movidos
para o canto inferior para liberar as ações do cabeçalho; aguardar aprovação
do novo SHA antes de declarar a revisão completa.

Inspeção da captura de retorno de f511aa9c encontrou skeletons e aviso antigo
de sessão, apesar do teste de URL aprovado. A jornada agora exige o estado
vazio do Inbox depois da API carregar, inclusive após o novo login, sem aviso
de sessão. Saída no cliente abre um documento novo após encerrar/auditar no
servidor; formulários de servidor conservam o redirect. Códigos unauthenticated
e unauthorized recebem a orientação canônica em português. Dois testes de
mensagem falharam antes da correção e passaram depois; 27 casos locais em seis
arquivos e lint dos arquivos novos aprovados. Os checks finais ainda são necessários.

### Refinamento concluído — código c488914b7e1a13109d0db0d696f5d5556c61a2f4

Em 12/10/2026, todos os checks do código acima foram aprovados: CI verify + invariants no run 38216423478; build de produção e validação pública no run 38216423578; E2E, incluindo as três partes e a conta exclusiva de plataforma, no run 38216423440. Os registros anteriores de checks pendentes/reprovados nesta etapa são histórico, superados por essa execução. As automações upstream de release/imagem continuam intencionalmente sem publicação.

Landing, planos, login e cadastro foram verificados em 375/768/1024/1440px, com Axe, etapas da demonstração, menu móvel, Escape/foco, campos inválidos e ausência de overflow/erros de JavaScript. A administração foi verificada em 1280×900 e 375×812, tema escuro, Axe, navegação, saída e zero vínculos da conta descartável. A restrição granted_by foi respeitada na limpeza. Provas de empresas/convites/cache e de administrador comum permaneceram ativas.

Evidências remotas nos artifacts vellum-publico-c488914b7e1a13109d0db0d696f5d5556c61a2f4 e vellum-admin-ui-c488914b7e1a13109d0db0d696f5d5556c61a2f4, com retenção de sete dias. Cópias locais em C:/Users/Lenovo/.codex/tmp/VellumAI-UI/ci-c488914b-publico e ci-c488914b-admin, fora do Git. Capturas da conta real proprietária em admin-desktop.jpg/admin-escuro.jpg/admin-mobile-escuro.jpg; nenhuma empresa de fixture foi criada no Supabase real.

Próxima etapa funcional: configurar/homologar os provedores de IA, os canais e o Asaas sandbox, conforme FINANCEIRO.md. Este refinamento não exigiu SQL novo nem implantação. Atualização posterior somente de documentação não altera o código validado acima.

Ler AGENTS.md e este arquivo, depois RELATORIO.md e FINANCEIRO.md. Conferir `git status`, último commit e resultados do Actions para o mesmo SHA. REQUISITOS.md preserva o briefing inicial; PLANO-TECNICO.md registra a auditoria. Ao fechar uma etapa, atualizar este arquivo com evidência, pendência e próximo passo, sem reproduzir segredos ou afirmar verificações não executadas.
