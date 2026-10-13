# Task 2 — schema interno, revisão e API por empresa

Status: DONE. Implementação encerrada em 13/10/2026 sobre o checkpoint
`b893f470b7f1e3a67c872bd28c0235794883df95`. Commit desta etapa:
`feat(implementations): add internal review schema and tenant API` (SHA informado
na resposta de fechamento). Nenhum push, deploy ou SQL de produção executado.

## Escopo entregue

Três tabelas internas, RLS/Storage e invariantes de tenancy; revisão humana com
proveniência imutável; importação idempotente enfileirada no event_log existente;
lease finito com concorrência global um; DTOs de lista/detalhe e ações HTTP
autorizadas para administrador global full. Não foram implementados worker,
upload HTTP, inferência, indexação, configuração de agente, execução de testes,
finalização ou UI das próximas etapas.

As rotas reutilizam requirePlatformAdmin, MFA e readSupportContext: clientes,
ausência/revogação de sessão, escopos de suporte e acompanhamento temporário
são negados. Tenant vem exclusivamente do caminho UUID validado; body é strict
e não fornece tenant, ator, job id ou lease. Consultas são parametrizadas e
mutação/leitura por empresa filtram organization_id. A lista global é uma
exceção autorizada pelo guard em cada chamada. Cursor UUID da última empresa é
estritamente validado, limite 1–100 e q até 120 caracteres; o cursor só escolhe
a posição, sem influência no escopo. Exceção ao padrão de cursor assinado
confirmada pelo coordenador para esta leitura administrativa global.

Lista/detalhe usam billing, setup, agentes/publicação/arquivamento, credenciais
e canais reais. Pré-requisitos não inventam prontidão/homologação externa.
Fonte arquivada/inativa com ponteiro antigo não satisfaz knowledge_current.
Pendências de revisão aparecem separadamente do conhecimento aprovado.
Erros/audit usam contratos existentes: respostas genéricas sem SQL/segredos e
audit somente de operação, organização e ator, sem fatos/brief/URLs/citações.

## Exports e contrato de integração

- contracts.ts: IMPORT_LIMITS; ImplementationRecord, FactRecord, ImportRecord,
  ImplementationListItem, ImplementationDetail, CompanyRecord, PlanRecord,
  AgentState, Prerequisite, TestRecord, ImplementationSourceMetadata;
  ImplementationStatus, ImportStatus, IndexStatus, FactReviewStatus;
  ImplementationError e seu union de códigos. Contratos da Task 1 preservados.
- schemas.ts: organizationIdSchema, briefSchema, actionSchema,
  listQuerySchema, ImplementationAction, ImplementationListQuery.
- review.ts: SENSITIVE_CATEGORIES, importedFactHash, prepareImportedFacts,
  approveFact, approvedContentHash, invalidateRevision.
- access.ts: requireImplementationAdmin, implementationFailure.
- repository.ts: MutationResult, ClaimResult, enqueueFileImport, getImport,
  getImportByIdempotencyKey, mutateImplementation, claimImport, completeImport,
  failImport, listImplementations, getImplementationDetail.

GET /api/v1/admin/implementations retorna lista + meta cursor/has_more.
GET /[organizationId] retorna company/plan/implementation/facts/imports,
knowledge (hashes/revisões/status/pointer e estado real da fonte), draft config,
pré-requisitos e registros históricos de teste. Datas PG Date são normalizadas
para ISO no DTO. Imports no detalhe são limitados aos 100 recentes.
POST union: import_site, retry_import, review_fact, add_fact, delete_fact,
save_brief. Imports retornam {import, duplicate}; revisão/brief retornam
{implementation, fact?}. Exige expected_revision para fatos/brief;
idempotency_key para import. Limites/campos e erros estão no documento público
do repositório docs/vellum/IMPLEMENTACOES-API.md.

enqueueFileImport é seam interno: path gerado pelo servidor no bucket privado
ai-policy, <org>/implementation-pending/<uuid>.pdf|txt. Não é upload público e
não aceita bytes. Upload limitado/verificado pertence à próxima etapa.

## SQL, revisão e conhecimento

Migration 0233, apêndice correspondente no baseline e linha no MANIFEST:
agent_implementations (uma por organização; revision, knowledge_revision,
status, brief, source/agent/draft ids, approved/indexed metadata,
config/test/finalized revisions, test_records);
agent_implementation_imports (tenant/implementation, origem, ator,
idempotency/request hash, status, attempts/max_attempts, token/expiração/deadline,
next_attempt_at, content_hash, códigos/warnings);
agent_implementation_facts (tenant/implementation/import, categoria/key,
original_value/hash, quote/source/data, reviewed_value/status, is_manual,
confirmação comercial, revisor/data/nota).

Statuses: implementation draft/review/ready; import queued/running/succeeded/
failed; fact pending/approved/rejected/deleted; index pending/indexing/success/
failed. ready representa preparação futura, não publicação automática.
Composite FKs impedem cruzamento de tenant para import/fact/source/agent e
draft version (também agent_id). Unique aprovado por category/key; unique
original_hash por implementação/tenant; unique idempotency_key por tenant.
CHECKs de estado, hash, origem, confirmação e lease/attempts; índices idempotentes.

Authenticated só recebe SELECT com administrador ativo full e aal2 quando MFA
requerido; não recebe DML. Clientes não leem nem a própria organização. Service
role faz mutações, com DELETE/TRUNCATE de fatos revogados para preservar
tombstones. Trigger functions são invoker, sem RPC privilegiada exposta e com
EXECUTE revogado. Storage possui policy restrictive que nega todas as operações
authenticated no subprefixo implementation-pending; políticas dos arquivos
históricos no prefixo comum são preservadas.

Import automático passa validateFactsEvidence da Task 1: valor extrativo,
citação/fonte/data verificadas. Correção humana pode divergir da citação, porém
originais e provenance permanecem imutáveis; reviewed_value/is_manual e dados
do revisor tornam a alteração explícita. Categorias comerciais sensíveis
requerem sensitive_confirmed=true, protegido também no banco.

original_hash usa categoria, key/value normalizados e fonte canonicalizada;
captured_at, quote e revisão não fazem parte da identidade. Reimportação idêntica
não duplica nem ressuscita deleted/rejected, mesmo com nova data de captura.
Candidato diferente permanece pending ao lado do aprovado/manual. Aprovação
substituta exige replace_fact_id do aprovado da mesma category/key; rejeição
do anterior e aprovação do candidato são atômicas. Não há troca silenciosa.

revision controla comportamento/config/test/finalização. knowledge_revision
controla apenas conteúdo factual aprovado. Brief alterado sobe revision e limpa
config/test/finalized; mantém hash/revisão/pointer do conhecimento inalterado.
Pendentes/rejects/notes não alteram nenhuma revisão e conservam teste histórico;
facts_reviewed pendente deve bloquear finalize futuro. Aprovação/correção/
exclusão de conteúdo aprovado sobe ambas, limpa config/test/finalized e
approved/indexed hash/revisões/status via trigger; remove atomicamente da fonte
active_kb_version_id, last_index_status/data/chunks/content_hash. Repositório
calcula novo approved_hash e approved_revision=knowledge_revision e registra
metadata na mesma transação. Substituição pode incrementar duas vezes; comparar
igualdade, não presumir +1. Não apagar histórico de test_records.

source_metadata.implementation={id,revision,approved_hash}, onde revision é
knowledge_revision. Task 3 deve capturar id/revisão/hash, gerar só fatos approved
e validar esse contrato atomicamente na ativação da versão (CAS). O presente
invalida ponteiro existente; não implementa ainda a proteção contra conclusão
tardia de um indexador em voo. Sync após mutação aprovada será automático;
index_knowledge futuro é retry/recuperação, sem passo técnico obrigatório ao
operador. Brief/pending não devem provocar embeddings desnecessários.

## Fila e lease para Task 3

getRequestPool canônico, sem segunda fila/serviço. Enqueue/retry e evento
agent_implementation.import_requested fazem commit juntos. Evento transporta
apenas import_id; URL/blob/ator são resolvidos do job persistido pelo worker.
Mesma chave/payload retorna job existente; payload diferente é conflito.
Retry mantém job/attempts; máximo três aquisições, sem reset.

claimImport(org,id) confirma primeiro o job do tenant: ausente/terminal não
provoca recuperação global. Recuperação operacional de leases vencidos usa
apenas registros internos: falha após teto ou reenfileira/reemite evento com
tentativas restantes. Índice unique parcial de running garante um slot global.
Contenda faz rollback e retorna contended/retry_after_ms=5000, sem consumir
tentativa. Aquisição aumenta attempts e cria UUID token, deadline 180 segundos,
lease 240 segundos. completeImport exige org/id/token/status running e lease/
deadline vivos, revalida no final da transação. failImport exige lease vivo e
código seguro, permitindo registrar timeout após o deadline. Worker futuro deve
cancelar coleta/inferência pelo deadline e usar token em qualquer conclusão.

## TDD e validação local

Configuração Vitest fora do Git: C:/Users/Lenovo/.codex/tmp/
vellum-task-1-vitest.config.mjs, node, setupFiles=[], sem ambiente privado.
Pool/admin/guards são seams simulados. Testes de domínio verificam valores e
invalidação; driver tests verificam filtros/parâmetros/rollback/fencing/evento,
mas não constituem prova PostgreSQL de transação/RLS/concorrência.

Comando de domínio/rotas (RED e GREEN):

```powershell
node node_modules/vitest/vitest.mjs run tests/unit/implementations-review.test.ts tests/unit/implementations-routes.test.ts --maxWorkers=1 --config C:/Users/Lenovo/.codex/tmp/vellum-task-1-vitest.config.mjs --reporter=verbose
```

RED inicial: 21 failed | 1 passed (22); assertions esperavam negação/full,
revisão/validação/resultados reais e receberam stubs/500. RED repositório:
6 failed | 23 passed (29), antes de implementar comportamento transacional.
GREEN inicial: 29 passed (29). RED de fronteiras: hash ainda não normalizava
espaços (1 failed | 35 passed); retomada reproduziu hash, blob UUID inválido e
recuperação indevida para job ausente (3 failed | 34 passed). GREEN: 37/37.
RED de Date ISO: 1 failed | 24 passed, recebeu Date em vez de string; GREEN
com rotas: 38/38. RED final de fonte arquivada: 1 failed | 25 passed, recebeu
knowledge_current=present para fonte archived/inativa. Correção exige fonte
real ativa/ready além de hashes, revisão e pointer.

GREEN final em 13/10/2026: Test Files 2 passed (2), Tests 39 passed (39),
setup 0ms, exit 0. Log: vellum-task-2-verified-green.log, duração 2.67s.
Logs anteriores ficam no mesmo diretório scratch: task-2-red,
task-2-repository-red, task-2-green, task-2-boundaries-red, task-2-resume-red,
task-2-resume-green, task-2-dates-red, task-2-final-green,
task-2-source-status-red, todos com prefixo vellum- e extensão .log.

```powershell
node node_modules/typescript/bin/tsc --noEmit --project C:/Users/Lenovo/.codex/tmp/vellum-task-2-tsconfig.json
node node_modules/eslint/bin/eslint.js lib/implementations/contracts.ts lib/implementations/access.ts lib/implementations/schemas.ts lib/implementations/review.ts lib/implementations/repository.ts app/api/v1/admin/implementations/route.ts 'app/api/v1/admin/implementations/[organizationId]/route.ts' tests/unit/implementations-review.test.ts tests/unit/implementations-routes.test.ts tests/invariants/agent-implementations.test.ts lib/api/errors.ts lib/audit/actions.ts
node node_modules/vitest/vitest.mjs run tests/unit/mapas-de-arquitetura.test.ts --maxWorkers=1 --config C:/Users/Lenovo/.codex/tmp/vellum-task-1-vitest.config.mjs --testNamePattern implementacoes-internas --reporter=verbose
```

TypeScript estrito focado inclui next-env.d.ts real e dependências importadas;
exit 0, saída vazia (vellum-task-2-verified-types.log). Lint exit 0, saída vazia
(vellum-task-2-verified-lint.log). Mapa novo: 5 passed, 105 skipped, exit 0
(vellum-task-2-map-green.log); não afirmar validação dos mapas antigos pulados.
TS/routes/tests formatados pelo Prettier existente. diff --check aprovado;
bloco final do baseline corresponde à migration 0233.

## Arquivos

Novos: migration 0233; access/repository/review/schemas; duas rotas; dois testes
unitários; invariants/agent-implementations.test.ts; IMPLEMENTACOES-API.md;
mapa implementacoes-internas.architecture.json; changes entry; este relatório.
Alterados: contracts.ts, api/errors.ts, audit/actions.ts, baseline, MANIFEST,
rls-completude-varredura PROVA_PROPRIA (três tabelas com prova comportamental),
architecture/README, testing/user-journey-map, CONTINUIDADE.

## Self-review e limites

Completude e fronteiras do brief conferidas; preservados contratos da Task 1,
fila/driver existentes, corpos strict, tenancy composta, tombstones e confirmação
sensível. Self-review corrigiu hash normalizado, path UUID, recuperação com job
ausente, datas ISO, casts UUID/text do evento e prontidão de fonte arquivada;
as correções de comportamento têm RED/GREEN acima. Repositório permanece
coeso para persistência transacional/DTO/lease; divisão extra não foi necessária
e o coordenador confirmou que tamanho isolado não é bloqueio. Sem módulos
ou funcionalidades futuras antecipadas.

Invariantes reais escritos: leitura negativa inclusive própria empresa para
clientes/suporte/revogado e MFA aal1; full/aal2 positivo; DML authenticated/anon
negado; FKs ambos sentidos para fatos/imports/source/agent/draft; pending Storage
negativo e arquivo histórico positivo; serviço positivo; revisão/pointer/hash
atômicos, brief/pending preservados, original/tombstone/confirmation protegidos;
slot global, teto attempts e duração lease. Estes testes NÃO foram executados
localmente e precisam de Actions. Não há prova local de banco/RLS/Storage.

Não lidos .env/segredos; sem rede, DB/Docker, build, suíte completa, tipos gerados,
SQL remoto ou deploy. CI integrado do SHA desta etapa está pendente. Falha de
typecheck CI da fixture Task 1 (NODE_ENV do subprocesso) é conhecida pelo
coordenador e será corrigida separadamente; esse arquivo não foi alterado.
Próximo passo: revisão independente Task 2 e CI/invariantes, depois worker e
indexador Task 3 com CAS e cancelamento pelo deadline.

## Fix round 1 — I1, provas de substituição e invalidação (13/10/2026)

Base: `46feac4ff36e5e91d5e99d38f5554588d85f89f8`, incluindo a correção de
fixture da Task 1 aprovada separadamente. A falha NODE_ENV descrita no histórico
acima não permanece neste checkpoint. I1 foi conferido literalmente: o cenário
SQL anterior mudava brief antes da correção/remoção, deixando teste/finalização
e conhecimento já invalidados. Era uma lacuna de prova, sem bug funcional
confirmado. Nenhum arquivo de produção ou migration foi alterado neste round.

Arquivos cobrindo a correção:

- tests/invariants/agent-implementations.test.ts: brief agora tem caso isolado.
  Correção e remoção são casos independentes, cada qual em sua transação, com
  approved/indexed hashes e revisions, source pointer/content hash/index status,
  config/tested/finalized na revisão corrente imediatamente antes da mutação.
  Uma precondição SQL exige esse estado completo; cada caso captura as revisões
  anteriores e verifica incremento de ambas, null de hashes/revisões/gates,
  index pending/status review, pointer/source hash retirados e metadata com nova
  knowledge_revision. Também verifica originais e status approved/deleted.
  Não há mudança de brief entre inicialização e mutação factual.
- tests/unit/implementations-review.test.ts: quatro casos usam o repositório
  real mutateImplementation com somente o transporte PG simulado. replace_fact_id
  ausente/incorreto devolvem state_conflict sem nenhuma escrita de fato e com
  rollback. ID correto emite rejeição do aprovado antes de aprovação do candidato
  com binds de org/id/ator/valor/status, e confirma a mesma transação. Falha na
  segunda escrita emite rollback, não commit nem refresh de metadata.
- CONTINUIDADE: atualização da evidência para 43 casos e limites mantidos.

RED por mutation probes: comportamento existente passou inicialmente (43/43);
para provar que a nova cobertura detecta regressão, foram introduzidas somente
temporariamente três mutações, restaurando repository.ts byte a byte em finally.
Comando scratch: `& C:/Users/Lenovo/.codex/tmp/vellum-task-2-fix1-mutation-probes.ps1`.
Cada probe executou o comando seguinte com --testNamePattern específico:

```powershell
node node_modules/vitest/vitest.mjs run tests/unit/implementations-review.test.ts --maxWorkers=1 --config C:/Users/Lenovo/.codex/tmp/vellum-task-1-vitest.config.mjs --testNamePattern 'substituição com' --reporter=verbose
```

Sem guards de state_conflict: 2 failed | 28 skipped (30), exit 1,
“promise resolved ... instead of rejecting”. Sem rejeição anterior (pattern
'substituição explícita'): 1 failed | 29 skipped, exit 1, esperava duas escritas
e recebeu uma. Commit no lugar de rollback (pattern 'falha na segunda escrita
da substituição'): 1 failed | 29 skipped, exit 1, “expected 'commit' to be
'rollback'”. Logs scratch vellum-task-2-fix1-replacement-{guards,rejection,
rollback}-red.log. Estes RED são provas de sensibilidade dos novos testes, não
falhas funcionais alegadas no código entregue. git diff do repositório ficou
vazio após restauração; nenhuma mutação temporária entra no commit.

GREEN após restauração e ajustes finais de tipos das assertions:

```powershell
node node_modules/vitest/vitest.mjs run tests/unit/implementations-review.test.ts tests/unit/implementations-routes.test.ts --maxWorkers=1 --config C:/Users/Lenovo/.codex/tmp/vellum-task-1-vitest.config.mjs --reporter=verbose
node node_modules/typescript/bin/tsc --noEmit --project C:/Users/Lenovo/.codex/tmp/vellum-task-2-tsconfig.json
node node_modules/eslint/bin/eslint.js tests/unit/implementations-review.test.ts tests/invariants/agent-implementations.test.ts
```

Resultados: 2 files passed, 43 passed (43), setup 0ms, exit 0, 2.50s
(vellum-task-2-fix1-green.log). TypeScript focado com next-env.d.ts real exit 0,
saída vazia (fix1-types.log); lint dos dois arquivos alterados exit 0, saída
vazia (fix1-lint.log), com prefixo vellum-task-2-. Prettier aplicado aos dois
arquivos; diff --check aprovado.

Limites: invariantes SQL foram apenas autorados; não executados localmente,
sem claim de prova PostgreSQL/RLS/atomicidade real. Actions precisa executar os
casos independentes, incluindo os triggers de produção. Driver tests verificam
decisões/SQL/binds/commit/rollback, não o funcionamento de PostgreSQL. Sem DB,
Docker, .env, segredos, rede, build, suítes completas, deploy ou push. Escopo
restrito a I1 e à fixture CI solicitada abaixo; produto preservado.

### Correção adicional da fixture CI no mesmo round

RED real informado pelo coordenador: Actions run 38390583193, invariants job
115273108848, checkpoint 46feac4f. O beforeAll desta suite falhou antes dos casos:
`null value in column reason violates not-null constraint`, psql linha 9,
seed de platform_admins. Não é falha funcional do produto nem resultado local.
Incluído reason explícito e legível nas quatro fixtures full/support/revoked/MFA.
Conferência focada: baseline.sql:1768 exige user_id/granted_by/reason não nulos,
scope permite full/support_readonly; :3868 liga granted_by a auth.users com
ON DELETE RESTRICT. auth.users é semeado antes e todos os granted_by apontam
para o usuário full existente, inclusive bootstrap self-grant usado também por
organizacoes-criacao-e-convite.test.ts:11. Sem constraint alterada e sem uso de
administrador real. Correção PostgreSQL aguarda nova execução Actions. Os mesmos
comandos focados de tipos e lint acima foram executados após esse ajuste:
ambos exit 0, saída vazia, logs vellum-task-2-fix1-ci-fixture-types.log e
vellum-task-2-fix1-ci-fixture-lint.log. Sem DB local; a suite unitária permanece
43/43 no GREEN anterior, pois a alteração posterior está apenas no seed SQL
não executado localmente.
