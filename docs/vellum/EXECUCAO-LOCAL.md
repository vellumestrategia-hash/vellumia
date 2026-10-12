# Executar a Véllum AI

Esta pasta é a cópia de trabalho da distribuição destinada ao repositório vellumestrategia-hash/vellumia. Esse é o remoto de escrita autorizado; os repositórios de origem permanecem preservados. LICENSE e NOTICE-VELLUM.md mantêm a licença MIT original. Ver GITHUB.md para verificações na nuvem e CONTINUIDADE.md para retomada do trabalho.

## Prévia local

Requisitos: Node 22 ou superior, pnpm 9.15.9. Dependências originais preservadas; PGlite foi acrescentado apenas para testes PostgreSQL financeiros locais. O lockfile atualizado é versionado.

```powershell
cd C:\Users\Lenovo\Desktop\Backup_Google_Drive\VellumAI
npx --yes pnpm@9.15.9 install --frozen-lockfile
npm run dev -- --port 3010
```

Abra http://localhost:3010, /precos, /login e /signup. /app continua protegido por autenticação. Em desenvolvimento, as telas públicas podem ser revisadas sem service_role; operações administrativas falham fechadas. Produção continua exigindo as credenciais privadas.

## Supabase do projeto

A URL base configurada é https://dchhxzssxkrvqqmozydv.supabase.co. O sufixo /rest/v1 é criado pelo SDK e não deve estar em NEXT_PUBLIC_SUPABASE_URL. A chave pública recebida foi gravada em .env.local, ignorado pelo Git. O endpoint de configuração do Auth respondeu HTTP 200 com autenticação por e-mail habilitada.

Ainda falta preencher no mesmo arquivo:

- SUPABASE_SERVICE_ROLE_KEY: chave privada do projeto, apenas servidor.
- SUPABASE_DB_ADMIN_URL: conexão PostgreSQL para aplicar schema e manutenção.
- SUPABASE_DB_URL: conexão com privilégios mínimos para o worker e módulos que usam PostgreSQL diretamente.

Os segredos internos de cron, criptografia e impersonação foram gerados localmente sem imprimir valores. Não substituir a chave privada pela pública: isso não concede os privilégios necessários e mascara um erro de configuração.

A telemetria comunitária da base foi desativada (`SENTRY_DSN=off`). Para monitoramento próprio, configurar DSN, SENTRY_ORG e SENTRY_PROJECT da Véllum, com as opções de redação existentes.

Não executar a sequência histórica de migrations em banco vazio: a base importada documenta que o caminho de instalação nova é supabase/baseline.sql. Aplicar primeiro em ambiente de teste:

```powershell
psql $env:SUPABASE_DB_ADMIN_URL -v ON_ERROR_STOP=1 -f supabase/baseline.sql
```

O baseline cria tabelas, funções, policies e extensões necessárias. Aplicar somente depois de confirmar o banco de destino e ter backup se houver dados. A aplicação remota não foi executada neste trabalho sem credenciais.

Para o primeiro administrador, usar scripts/bootstrap-owner.ts e o procedimento documentado em hostgator-setup-kit/README.md, sem criar automaticamente uma conta com senha conhecida. Configurar Auth → URL Configuration para a origem da implantação e o callback /auth/confirm; adequar os modelos de e-mail com o procedimento de marca do kit.

## Provedores

WhatsApp oficial: conectar pelo módulo Conexões, com aplicativo Meta, número de teste, token e webhook validados. WAHA permanece como alternativa não oficial; seu suporte e risco de bloqueio diferem da integração Meta.

IA: configurar OpenAI/OpenRouter pela tela de credenciais ou variáveis de servidor previstas no .env.example. O teste de agente existente usa execução real por padrão (INTERNAL_AGENT_RUN_STUB=false). Nenhuma chave IA foi fornecida.

Pagamentos: [contrato financeiro](FINANCEIRO.md). Configurar ASAAS_SANDBOX_API_KEY e ASAAS_WEBHOOK_TOKEN no servidor. Aplicar schema, cadastrar CNPJ da empresa, gerar contratação em `/app/settings/billing` e pagar nos links hospedados de sandbox. Configurar webhook de cobranças em `/api/v1/webhooks/asaas`, envio sequencial e token independente da API Key. A assinatura só se ativa após confirmação de mensalidade e implantação; o retorno do navegador não ativa acesso. Não repetir uma operação em revisão sem consultar o Asaas.

Editar preços e teto de IA em `/admin/billing`. Os contratos usam snapshot dos valores aceitos; alteração de catálogo não muda automaticamente assinaturas existentes. Habilitar VELLUM_BILLING_ENFORCEMENT=true somente após homologar o banco, o checkout e os dois pagamentos; o runtime canônico recusa novas chamadas pagas por assinatura inativa/expirada ou teto de IA atingido, preservando atendimento humano. A role da conexão PostgreSQL do worker precisa de leitura no schema financeiro, além dos grants originais. Usar somente o worker agent-engine; caminhos legados depreciados não são aprovados para SaaS.

## Implantação própria

Os Dockerfiles e Compose originais foram preservados. Para construir **esta versão Véllum**, usar o override de build local; o fluxo que puxa imagens upstream não contém as alterações desta pasta.

```bash
docker compose -f docker-compose.prod.yml -f docker-compose.build.yml --env-file .env build
docker compose -f docker-compose.prod.yml -f docker-compose.build.yml --env-file .env up -d
```

Definir APP_IMAGE, WORKER_IMAGE e SCHEDULER_IMAGE para imagens próprias locais ou publicadas em registry privado. Manter o mesmo override no build e no up. Se a VPS usa Traefik, acrescentar também -f docker-compose.traefik.yml. Não executar o atualizador upstream: ele pode substituir a versão Véllum por imagens originais. Deploy não foi executado. Publicação de código no GitHub e publicação de imagens para produção são operações distintas; os fluxos upstream de imagem/release ficam restritos à origem.

Cloudflare pode cuidar de DNS e proteção. O app Node, workers, scheduler, WAHA e serviços persistentes precisam de ambiente compatível, como VPS Docker; não assumir execução direta deles em Cloudflare Pages. Health check existente: /api/v1/health. Backups e recuperação: scripts do hostgator-setup-kit e docs/runbooks/.

## Validação

```powershell
npm run typecheck
npm run lint
npm run test:unit -- --maxWorkers=2
npm run build
node scripts/vellum-validar-publico.mjs
```

Neste computador de 6 GB, o typecheck exige ampliar o heap:

```powershell
node --max-old-space-size=4096 node_modules/typescript/bin/tsc --noEmit -p tsconfig.typecheck.json
```

Para tentar build com menor paralelismo e otimização de memória do Webpack:

```powershell
$env:VELLUM_LOW_MEMORY_BUILD='true'
$env:NODE_OPTIONS='--max-old-space-size=3072'
npm run build -- --webpack
```

O perfil de build é opcional e não elimina a necessidade de recursos suficientes na máquina de implantação.

O último comando usa Playwright, verifica rotas públicas, overflow, erros de hidratação e acessibilidade em 1440px e 390px. Ele não cria contas nem envia login real. Evidências ficam em docs/vellum/evidencias. Para instalar seu navegador de teste: npx playwright install chromium.

RLS e journeys autenticadas exigem banco real. test:db usa Docker; test:e2e usa .env.e2e apontando somente para Supabase local. Não usar o banco remoto da empresa como banco descartável de testes.
