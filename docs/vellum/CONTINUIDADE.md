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

Supabase base: https://dchhxzssxkrvqqmozydv.supabase.co. URL/chave pública e segredos técnicos estão em `.env.local`, ignorado pelo Git. A API Auth respondeu 200; organizações/marca responderam 404/PGRST205 em sondas sem linhas. Conta solicitada pelo proprietário criada em Supabase Auth, e-mail confirmado e login com senha validado. Papel administrador da plataforma aguarda execução do SQL manual; nenhum pagamento criado. O usuário esclareceu que deseja o administrador da Véllum, independente de empresa cliente; o bootstrap foi ajustado para conceder somente platform_admin full, sem criar organização ou vínculo de cliente.

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

Testes locais: cinco testes de interação/estados e três do provider de tooltip aprovados. Guard completo de tradução espanhol aprovado após complementar quatro chaves. Lint dos arquivos alterados sem erros. Novas provas públicas incluem 375, 768, 1024 e 1440px, menu/Escape/foco e três etapas; aguardar Actions do novo SHA antes de declarar essa revisão aprovada. Login pelo navegador local retornou à tela de entrada; diagnosticar a propagação de sessão na prévia e repetir a prova visual. Não enfraquecer atributos de cookie para contornar falha de desenvolvimento.

Os parágrafos anteriores de "papel aguardando SQL" são histórico do incidente, substituídos pelas sondas acima. Próximo passo desta etapa: verificação visual e CI do refinamento, com evidências de desktop/celular/tema escuro. Depois retomar IA/canais/financeiro com suas credenciais ainda ausentes.

1. Consultar os checks no Actions para o SHA em revisão e reparar falhas próprias antes de declarar build/isolamento aprovados. Transferência inicial ao GitHub concluída; não repetir clone nem configurar a origem como remoto de escrita.
2. Aplicar baseline e bootstrap em ambiente de teste Supabase/PostgreSQL. Executar cadastro, onboarding, MFA e isolamento completo entre duas empresas; obter credenciais privadas por arquivo seguro.
3. Validar agentes/RAG e atendimento real com provedor IA, número Meta de teste e worker. WAHA é alternativa opcional não oficial.
4. Homologar Asaas sandbox: contratação, mensalidade/implantação, dois pagamentos, webhook, duplicidade, atraso e estorno. Só então ativar o gate SaaS.
5. Completar cupons, créditos adicionais, emissão de excedentes, upgrade/downgrade/cancelamento, reconciliação de operações incertas, alertas 50/80/100% e custos reais de transcrição/Meta. Sem métricas fictícias.
6. Preparar implantação própria com backups, HTTPS, serviços persistentes e publicação de imagens da distribuição. A plataforma ainda não está pronta para comercialização.

## Como retomar

Ler AGENTS.md e este arquivo, depois RELATORIO.md e FINANCEIRO.md. Conferir `git status`, último commit e resultados do Actions para o mesmo SHA. REQUISITOS.md preserva o briefing inicial; PLANO-TECNICO.md registra a auditoria. Ao fechar uma etapa, atualizar este arquivo com evidência, pendência e próximo passo, sem reproduzir segredos ou afirmar verificações não executadas.
