# Véllum AI — ponto de continuidade

Atualização: 11/10/2026. Pasta de trabalho: VellumAI. Destino autorizado: https://github.com/vellumestrategia-hash/vellumia, branch main. A ordem posterior do usuário autoriza envio e continuidade nesse repositório; os repositórios de origem permanecem preservados.

## Estado comprovado

- Base importada: airshell/WhatsappCRM, commit 1c9a46a1, com licença MIT original e README upstream preservados.
- Marca Véllum aplicada a landing, preços, login/cadastro, defaults de marca e módulos financeiros. Paleta, selo e fontes vêm da pasta original Véllum/relancamento, que foi preservada.
- CRM, agentes, RAG, Meta, WAHA, follow-up, RBAC, RLS, auditoria, workers, dashboards e onboarding da base são mantidos.
- Financeiro: planos editáveis; checkout Asaas sandbox; assinatura e implantação; faturas; webhook idempotente com confirmação no provedor; medição de conversas por janela de 24 horas; gate opcional de assinatura/orçamento IA. Contratos em FINANCEIRO.md.
- Migration 0231 sincronizada com baseline e MANIFEST. PGlite testa a migration com contratos mínimos e RLS de duas empresas.
- Evidências locais: 418 testes em 40 arquivos selecionados; TypeScript completo aprovado com heap 4096 MB; lint sem erros; Playwright público/Axe aprovado em desktop e celular. Ver RELATORIO.md para limites e evidências.
- Build local de produção interrompido por pressão de memória; não foi aprovado. Máquina com 6 GB. As verificações completas passam a ser executadas no Actions após o envio.
- GitHub: workflows de verificação adaptados, automações upstream restritas à origem e configuração Codespaces preparada. Preparação validada com 37 testes em 7 arquivos e parse dos sete workflows. Autenticação CLI concluída com henrriquelealbranco; GitHub ainda retorna viewerPermission READ. Envio depende de conceder escrita à conta ou autenticar uma conta com escrita. Não há execução CI remota comprovada nesta etapa de preparação.

## Ambiente privado

Supabase base: https://dchhxzssxkrvqqmozydv.supabase.co. URL/chave pública e segredos técnicos estão em `.env.local`, ignorado pelo Git. A API Auth respondeu 200; organizações/marca responderam 404/PGRST205 em sondas sem linhas. Nenhum schema, usuário ou pagamento foi criado remotamente.

Faltam SUPABASE_SERVICE_ROLE_KEY e SUPABASE_DB_ADMIN_URL. Asaas sandbox e credenciais IA/Meta ainda não configurados. VELLUM_BILLING_ENFORCEMENT=false até homologação; AI_BUDGET_ENFORCEMENT=on; SENTRY_DSN=off. Nunca imprimir ou versionar segredos.

## Próxima sequência

1. Concluir autenticação GitHub com escrita, enviar main e conferir SHA remoto. Consultar os checks desse SHA e reparar falhas próprias antes de declarar build/isolamento aprovados.
2. Aplicar baseline e bootstrap em ambiente de teste Supabase/PostgreSQL. Executar cadastro, onboarding, MFA e isolamento completo entre duas empresas; obter credenciais privadas por arquivo seguro.
3. Validar agentes/RAG e atendimento real com provedor IA, número Meta de teste e worker. WAHA é alternativa opcional não oficial.
4. Homologar Asaas sandbox: contratação, mensalidade/implantação, dois pagamentos, webhook, duplicidade, atraso e estorno. Só então ativar o gate SaaS.
5. Completar cupons, créditos adicionais, emissão de excedentes, upgrade/downgrade/cancelamento, reconciliação de operações incertas, alertas 50/80/100% e custos reais de transcrição/Meta. Sem métricas fictícias.
6. Preparar implantação própria com backups, HTTPS, serviços persistentes e publicação de imagens da distribuição. A plataforma ainda não está pronta para comercialização.

## Como retomar

Ler AGENTS.md e este arquivo, depois RELATORIO.md e FINANCEIRO.md. Conferir `git status`, último commit e resultados do Actions para o mesmo SHA. REQUISITOS.md preserva o briefing inicial; PLANO-TECNICO.md registra a auditoria. Ao fechar uma etapa, atualizar este arquivo com evidência, pendência e próximo passo, sem reproduzir segredos ou afirmar verificações não executadas.
