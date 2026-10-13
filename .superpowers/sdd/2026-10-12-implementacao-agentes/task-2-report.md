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
