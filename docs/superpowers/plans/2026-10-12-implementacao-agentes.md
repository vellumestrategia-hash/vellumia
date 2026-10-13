# Implementação de Agentes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Implementar todo o onboarding interno solicitado, da coleta segura à revisão, RAG, configuração e simulação real do agente.

**Architecture:** Ferramenta exclusivamente de administração full por empresa, com três tabelas internas e jobs no event_log existente. Fontes aprovadas seguem o indexador atual; configurações e testes usam versões e sandbox atuais. A implementação não publica agentes automaticamente.

**Tech Stack:** Next.js 16, React 19, TypeScript, Zod 4, Supabase/PostgreSQL, Storage privado, motor AI SDK existente, Vitest e Playwright.

## Global Constraints

- Trabalhar diretamente em VellumAI e no remoto de escrita vellumestrategia-hash/vellumia; commits/push necessários já autorizados. Preservar licença MIT e módulos existentes.
- Não fazer deploy, não aplicar SQL em produção e não utilizar credenciais reais nas provas desta funcionalidade. Nunca abrir/copiar/logar `.env*`; `.env.example` é o template permitido.
- Build, suíte completa e banco descartável no GitHub Actions; testes unitários pequenos locais com `node node_modules/vitest/vitest.mjs run <arquivos> --maxWorkers=1`. Não reinstalar node_modules com pnpm global de versão divergente.
- Somente administrador global ativo com scope=full; toda query tenant-bound filtra organization_id confiável do caminho; corpos nunca definem o tenant. APIs v1 snake_case, Zod, ok/fail e auditoria de mutações.
- Reutilizar event_log/dispatcher, ai-policy privado, extração existente, ai_knowledge_sources/rag-indexer, runModelCall, ai_agents/versions e testAgentVersion. Nenhuma segunda fila/motor/RAG ou serviço adicional.
- Uma importação simultânea, seis páginas, profundidade um, quatro redirects, 1 MB por resposta, 2 MB no total, 90 segundos de coleta, arquivo até 10 MB e inferência limitada com timeout. Retentativas finitas com lease recuperável; sem advisory lock de sessão no pooler.
- Somente fatos aprovados entram no RAG. Reimportação nunca sobrescreve correções/fatos aprovados automaticamente. Comercial/horários/preços/políticas exigem confirmação explícita. Fonte e data acompanham fatos.
- UI segue docs/vellum/DESIGN-SYSTEM.md, marca resolvida, responsiva e acessível; seção apenas na navegação administrativa. Não prometer duração fixa.
- SQL novo 0233 idempotente + baseline apêndice + MANIFEST, sem BEGIN/COMMIT na migration. Não editar lib/database.types.ts manualmente; regenerar somente por ferramenta de schema se necessário.
- Atualizar docs/vellum/CONTINUIDADE.md ao concluir cada etapa, distinguindo implementado, testado local, CI e pendente.

### Task 1: Coleta pública segura e contratos de evidência

**Files:** Create `lib/implementations/{contracts,public-url,robots,html,crawler}.ts`; tests `tests/unit/implementations-crawler.test.ts` and `implementations-evidence.test.ts`. Dependency changes only if a proper HTML parser is needed, using pnpm 9.15.9 without replacing the existing install.

**Interfaces:** Export `crawlPublicSite(url: string, options?: CrawlOptions): Promise<CrawlResult>` with bounded injected transport for fixtures and secure production transport. `CrawlResult` has `pages: {url,title,text,captured_at,content_hash}[]`, `content_hash`, `warnings: string[]`. Export fact category/schema contracts with snake_case fields: category, key, value, evidence_quote, source_url/source_name, captured_at. Export evidence validation/normalization shared by worker/review. Do not write DB/API/UI in this task.

Category IDs: company, segment, products_services, prices, hours, service_area, contacts, differentiators, payment_methods, policies, commercial_conditions, faq, scheduling. Segment and scheduling explicit allow missing-question logic without parsing opaque keys.

- [ ] Write failing tests for valid collection, private IPv4/IPv6/mapped IP/DNS rebinding/redirects, ports/userinfo, robots allow/disallow, timeout/bytes/pages/depth and duplicate pages. No public network in tests.
- [ ] Run those files and record RED evidence.
- [ ] Implement HTTP(S) transport that pins validated DNS results on every hop while retaining normal certificate validation, limits streams and deadlines, honors robots on target paths/origins, and never executes scripts or authentication bypass. Relevant same-origin links only; meaningful text extraction/de-duplication.
- [ ] Implement bounded structured facts with exact normalized quote check against supplied source, rejecting invented/unattributed facts.
- [ ] Run focused tests and direct lint for changed files, self-review, commit only task files and update continuity. Report exported interfaces, command/results and limitations.

### Task 2: Schema interno, revisão e API por empresa

**Files:** Create `supabase/migrations/20261012160000_0233_agent_implementations.sql`, append baseline and MANIFEST; create `lib/implementations/{access,repository,review,schemas}.ts`, routes `app/api/v1/admin/implementations/route.ts` and `[organizationId]/route.ts`; tests `tests/unit/implementations-review.test.ts`, `implementations-routes.test.ts`, `tests/invariants/agent-implementations.test.ts`.

**Interfaces:** Expose typed list/detail DTOs and repository operations consumed by worker/UI. Detail contains company, actual plan, implementation, facts, imports, approved knowledge/index status, draft agent config, prerequisites and test records. POST action union for import_site, retry_import, review_fact, add_fact, delete_fact, save_brief, with later task additions config/index/test/finalize. Job ID/tenant metadata only created in authorized server operation. Keep response/operation contracts documented in `lib/implementations/contracts.ts`.

- [ ] Write failing domain/API tests: no session/customer/support scope denied; full allowed; body tenant ignored/rejected; evidence, manual correction, explicit sensitive confirmation, replacement and removal invalidate finalized/test revision; duplicate requests return existing import safely.
- [ ] Implement three tables named agent_implementations/imports/facts with organization_id, revision, statuses, approved metadata, job attempts/deadline/lease, provenance and review fields. Composite tenant FKs, internal RLS (customer reads/mutations denied even for own org), full-global read only, service role mutations; no exposed privileged RPC. Add idempotent indexes/constraints and finite job attempts.
- [ ] Implement guard/repository/review with explicit tenant filters and transaction for enqueue + event. Global concurrency one uses atomic lease claim/partial unique running slot, expired recovery and retry without counting contention. List intentionally spans tenants only after full-global authorization, with paging/search, real plans/status and no invented metrics.
- [ ] Implement API actions and safe error codes/messages plus audit. Existing content is never silently replaced on reimport; pending facts are isolated from customer knowledge.
- [ ] Run focused tests/lint, commit, update continuity. DB tests are authored now but executed later in Actions; never claim local RLS proof.

### Task 3: Jobs, extração com IA e conhecimento aprovado

**Files:** Create `lib/implementations/{import-worker,extract-facts,knowledge}.ts`, `workers/agent-implementation.handler.ts`; modify `lib/event-log/register-handlers.ts`, `lib/agent-engine/edge/llm/run-model-call.ts`, add upload route `app/api/v1/admin/implementations/[organizationId]/upload/route.ts`; unit tests `implementations-worker.test.ts`, `implementations-knowledge.test.ts`.

**Interfaces:** Consume Task 1 crawler/contracts and Task 2 repository actions. Register event `agent_implementation.import_requested` with handler key `agent-implementation.v1`. Add API action `index_knowledge`. Export `syncApprovedKnowledge(organizationId, actorId)` to normalize approved facts, write one private Markdown source and enqueue `knowledge_source.updated` only when content hash changes. Export progress/retry worker functions usable with injected DB/AI/storage/transport fixtures; production wired to existing services.

- [ ] Write RED tests: queued→running→review, contention retry, expired recovery, failure/retry exhaustion, cross-tenant job rejection, unsupported/oversize document, quote validation, duplicate extraction and embedding/index skips, updates/deletions and unapproved facts excluded.
- [ ] Add optional bounded abortSignal/maxOutputTokens input to existing runModelCall preserving existing defaults/budgets; use that seam for extraction, external provider only. All facts start pending with citations/date, existing approved/manual facts preserved and comparisons exposed.
- [ ] Implement document upload in private ai-policy with random trusted tenant prefix; only PDF/MD/TXT, actual size/extension/MIME checks, reuse extrairTextoDoArquivo and existing PDF/text parsers. Pending document must not appear as active customer RAG source.
- [ ] Implement event handler/worker with one global lease, finite retries, failure states/progress and harmless lost-lease handling. Crawl/extraction bounded, credentials missing yields actionable error, no real credentials or public network in tests.
- [ ] Implement approved-only index synchronization using existing ai_knowledge_sources/rag-indexer contract and hash. Metadata preserves citations/fact IDs/date. Mutations safely invalidate knowledge revision and tests, prevent stale unapproved content from being available after changes, avoid redundant embeddings.
- [ ] Run focused tests/lint; commit and update continuity with environment needs and unverified remote status.

### Task 4: Agente comercial, sandbox real e aprovação

**Files:** Create `lib/implementations/{agent-config,simulation,finalize}.ts`; extend API/schema/contracts; tests `implementations-agent.test.ts`, `implementations-simulation.test.ts`.

**Interfaces:** Add actions generate_config, save_config, simulate, finalize. AI suggestion is editable and does not write a published agent. Return final_text, tool proposals, available RAG citations, run status/guardrails from real sandbox, plus revision/version. finalize records approving full admin and timestamp; ready is separate from operationally active.

- [ ] Write RED tests for approved-only suggestion, explicit admin save, existing version technical settings inherited, tenant scope for tools/pipelines/channel/sources, draft creation inactive, revision invalidation, simulation dry-run and finalize prerequisites.
- [ ] Generate bounded prompt suggestion from approved facts + saved brief using runModelCall; require schema and no invented discounts/promises. Provide all requested behavioral fields (personality, tone, purpose, priority, approach, qualification, opportunities, handoff, commercial restrictions, scheduling, CRM actions).
- [ ] Reuse existing schemas/scoping and agent/version contracts. Atomic inactive new agent + draft or new draft for existing agent, preserving published version. Select existing channels/provider/model/credential; when absent return prerequisite rather than fabricate/force. Allowed CRM tools obey actual catalog and selected permissions.
- [ ] Implement real testAgentVersion invocation via requestTurnDeps/getRequestPool, ai_agent_runs is_dry_run=true, no WhatsApp/external execution, audit and citations when available. Test fixtures use existing INTERNAL_AGENT_RUN_STUB/registry only in disposable tests.
- [ ] Finalize only current approved/indexed knowledge, reviewed draft and successful matching current revision test; record approval, do not auto-publish. Surface actual subscription/Meta/provider prerequisite states and derive Active solely from actual published active agent. Existing publication checks remain intact.
- [ ] Run focused tests/lint, commit and update continuity.

### Task 5: Interface responsiva e central de conhecimento

**Files:** Create `app/admin/(protected)/implementations/page.tsx`, `[organizationId]/page.tsx`, `components/admin/implementations/{ImplementationsClient,ImplementationWizard,KnowledgeReview,AgentSetup,AgentSimulation}.tsx` (split further if needed); modify AdminSidebar, add translated keys using existing i18n conventions; UI unit tests `implementations-ui.test.tsx`.

**Interfaces:** Consume typed Task 2–4 API contracts, existing fetch/API helpers and admin layout. All server pages require full admin. UI states waiting/importing/review/configuring/testing/ready/active/failed correspond to actual backend state. Poll only during pending processing, clean up on unmount and avoid blocking full-page reload.

- [ ] Write RED UI tests for field feedback, source/old vs new comparison, explicit sensitive confirmation, loading/errors/retry, missing info questions not duplicated, responsive step navigation and ready activation checklist.
- [ ] Implement searchable list with real company/plan/implementation/agent/last update and Configurar agente; add navigation only to platform admin Operação, hide from support-only context if existing layout supports scope prop, backend always denies.
- [ ] Implement Conhecer empresa URL/upload progress; review categorized facts confirm/edit/delete/notes/evidence/source/date and old/new comparison; manual knowledge and missing-category/segment-specific questions. Brief fields cover requested commercial behavior without repetitive technical settings.
- [ ] Implement generate/edit/save agent config, live sandbox chat with suggested product/price/hours/quote/scheduling/discount/handoff tests, feedback and sources. Finish approval is reviewable and disabled with actionable unmet prerequisites.
- [ ] Implement knowledge central approved info, documents/sources/import history/date/index status/reimport/correction/removal/retest. Semantic colors/brand resolution, keyboard labels/focus, useful empty states/mobile layout, no tech details unless a configuration decision is required.
- [ ] Run focused UI tests/lint, commit and update continuity.

### Task 6: Prova integrada, revisão final e entrega SQL

**Files:** Create `tests/e2e/agent-implementation.spec.ts`, extend fixtures and `.github/workflows/e2e.yml` selection/artifacts if needed; docs `docs/vellum/IMPLEMENTACAO-AGENTES.md`, `SQL-MANUAL.md`, `CONTINUIDADE.md`; fix only concrete validation findings in feature files.

- [ ] Add fresh-DB E2E for full-global admin without own tenant, customer/support forbidden, two tenant isolation, import fixtures/manual review/commercial confirmation/index/config/safe test/finalize/reimport-preserves-correction. Use local fixture transport/AI registry and INTERNAL_AGENT_RUN_STUB, never credentials or actual external effects; fixture bypass must be gated server-side to test runtime only and cannot weaken production SSRF.
- [ ] Capture fully loaded desktop/mobile/knowledge/sandbox states and Axe checks. Save screenshots as CI artifacts and copy outside Git for visual inspection after run. No skeleton-only proof.
- [ ] Push authorized origin and await same-SHA CI verify/invariants/build/E2E. Read concrete failures, repair and rerun necessary checks. No local heavy build/DB or production configuration.
- [ ] Verify migration fresh+update and tenant RLS from Actions; run final scope/security review with evidence. Regenerate database types from disposable schema if required by new generated-type contracts, never manually.
- [ ] Document functionality/files/reuse, migration 0233 and ordered manual SQL instructions, configuration requirements (existing DB pool/AI/embeddings/cron/Meta/billing), known crawler/PDF limitations, access/test instructions and measured CI results. SQL execution is pending owner, no deployment.
- [ ] Update continuity, commit/push final docs and verify final code SHA checks; final response links report/SQL and shows actual interface captures, with SMTP delivery already proven and localhost redirect pending publication.
