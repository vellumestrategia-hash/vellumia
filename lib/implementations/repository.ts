import { createHash, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { z } from "zod";
import { getRequestPool } from "@/lib/agent-engine/db/request-pool";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  IMPORT_LIMITS,
  ImplementationError,
  type EvidenceSource,
  type FactRecord,
  type ImportRecord,
  type ImplementationRecord,
  type ImplementationDetail,
  type ImplementationListItem,
} from "./contracts";
import {
  actionSchema,
  organizationIdSchema,
  type ImplementationAction,
  type ImplementationListQuery,
} from "./schemas";
import { approveFact, approvedContentHash, prepareImportedFacts } from "./review";
import { parsePublicUrl } from "./public-url";

/** Driver canônico: rollback também desfaz event_log e increments feitos por triggers. */
async function transaction<T>(work: (db: PoolClient) => Promise<T>, readOnly = false): Promise<T> {
  const db = await getRequestPool().connect();
  try {
    await db.query(readOnly ? "begin isolation level repeatable read read only" : "begin");
    const result = await work(db);
    await db.query("commit");
    return result;
  } catch (error) {
    await db.query("rollback");
    throw error;
  } finally {
    db.release();
  }
}
async function rows<T>(db: PoolClient, sql: string, values: unknown[] = []): Promise<T[]> {
  const found = (await db.query(sql, values)).rows;
  return found.map((row) =>
    Object.fromEntries(
      Object.entries(row as Record<string, unknown>).map(([key, value]) => [
        key,
        value instanceof Date ? value.toISOString() : value,
      ]),
    ),
  ) as T[];
}
function tenant(value: string): string {
  return organizationIdSchema.parse(value);
}
async function lockImplementation(
  db: PoolClient,
  org: string,
  create = false,
): Promise<ImplementationRecord> {
  if (create) {
    const company = await rows(
      db,
      "select id from public.organizations where id=$1 for key share",
      [org],
    );
    if (!company.length) throw new ImplementationError("not_found");
    await db.query(
      "insert into public.agent_implementations(organization_id) values($1) on conflict(organization_id) do nothing returning *",
      [org],
    );
  }
  const [record] = await rows<ImplementationRecord>(
    db,
    "select * from public.agent_implementations where organization_id=$1 for update",
    [org],
  );
  if (!record) throw new ImplementationError("not_found");
  return record;
}
async function factsFor(db: PoolClient, org: string, id: string): Promise<FactRecord[]> {
  return rows(
    db,
    "select * from public.agent_implementation_facts where organization_id=$1 and implementation_id=$2 order by created_at,id",
    [org, id],
  );
}
async function emitImport(db: PoolClient, org: string, id: string): Promise<void> {
  await db.query(
    `insert into public.event_log(organization_id,event_type,entity_kind,entity_id,payload,metadata)
    values($1,'agent_implementation.import_requested','agent_implementation_import',$2::uuid,jsonb_build_object('import_id',$2::uuid::text),'{"producer":"implementation_repository"}'::jsonb)`,
    [org, id],
  );
}
/** Hash atual confirmado na mesma transação; o trigger já retirou o ponteiro antigo. */
async function refreshApprovedMetadata(
  db: PoolClient,
  org: string,
  id: string,
): Promise<ImplementationRecord> {
  const hash = approvedContentHash(await factsFor(db, org, id));
  const [record] = await rows<ImplementationRecord>(
    db,
    `update public.agent_implementations set approved_hash=$3,
    approved_revision=case when $3::text is null then null else knowledge_revision end
    where organization_id=$1 and id=$2 returning *`,
    [org, id, hash],
  );
  if (!record) throw new ImplementationError("not_found");
  if (record.source_id)
    await db.query(
      `update public.ai_knowledge_sources set source_metadata=source_metadata ||
    jsonb_build_object('implementation',jsonb_build_object('id',$2::text,'revision',$4::int,'approved_hash',$5::text))
    where organization_id=$1 and id=$3`,
      [org, id, record.source_id, record.knowledge_revision, hash],
    );
  return record;
}
type ImportInput =
  | { kind: "site"; site_url: string; idempotency_key: string }
  | { kind: "file"; blob_path: string; source_name: string; idempotency_key: string };
export type MutationResult =
  | { import: ImportRecord; duplicate: boolean }
  | { implementation: ImplementationRecord; fact?: FactRecord };
async function enqueue(
  db: PoolClient,
  org: string,
  actor: string,
  input: ImportInput,
): Promise<{ import: ImportRecord; duplicate: boolean }> {
  z.uuid().parse(actor);
  z.uuid().parse(input.idempotency_key);
  if (input.kind === "site") input = { ...input, site_url: parsePublicUrl(input.site_url).href };
  else {
    // Somente caminho gerado pelo upload de servidor, sem traversal ou prefixo de outro tenant.
    const suffix = input.blob_path.slice(`${org}/implementation-pending/`.length);
    if (
      !input.blob_path.startsWith(`${org}/implementation-pending/`) ||
      !/\.(pdf|txt)$/i.test(suffix) ||
      !z.uuid().safeParse(suffix.slice(0, -4)).success
    )
      throw new ImplementationError("forbidden");
    z.string().trim().min(1).max(255).parse(input.source_name);
  }
  const implementation = await lockImplementation(db, org, true);
  const request_hash = createHash("sha256")
    .update(
      JSON.stringify(
        input.kind === "site"
          ? [input.kind, input.site_url]
          : [input.kind, input.blob_path, input.source_name],
      ),
    )
    .digest("hex");
  const [existing] = await rows<ImportRecord>(
    db,
    "select * from public.agent_implementation_imports where organization_id=$1 and idempotency_key=$2",
    [org, input.idempotency_key],
  );
  if (existing) {
    if (existing.request_hash !== request_hash)
      throw new ImplementationError("idempotency_conflict");
    return { import: existing, duplicate: true };
  }
  const [job] = await rows<ImportRecord>(
    db,
    `insert into public.agent_implementation_imports
    (organization_id,implementation_id,requested_by,site_url,idempotency_key,request_hash,kind,blob_path,source_name)
    values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`,
    [
      org,
      implementation.id,
      actor,
      input.kind === "site" ? input.site_url : null,
      input.idempotency_key,
      request_hash,
      input.kind,
      input.kind === "file" ? input.blob_path : null,
      input.kind === "file" ? input.source_name : null,
    ],
  );
  if (!job) throw new Error("implementation_insert_failed");
  await emitImport(db, org, job.id);
  return { import: job, duplicate: false };
}
/** Caller já fez o full guard. Upload Task 3 gera blob_path; nunca recebe caminho do body. */
export async function enqueueFileImport(
  org: string,
  actor: string,
  input: Omit<Extract<ImportInput, { kind: "file" }>, "kind">,
) {
  return transaction((db) => enqueue(db, tenant(org), actor, { ...input, kind: "file" }));
}
export async function getImport(org: string, id: string): Promise<ImportRecord | null> {
  return transaction(
    async (db) =>
      (
        await rows<ImportRecord>(
          db,
          "select * from public.agent_implementation_imports where organization_id=$1 and id=$2",
          [tenant(org), z.uuid().parse(id)],
        )
      )[0] ?? null,
    true,
  );
}
export async function getImportByIdempotencyKey(
  org: string,
  key: string,
): Promise<ImportRecord | null> {
  return transaction(
    async (db) =>
      (
        await rows<ImportRecord>(
          db,
          "select * from public.agent_implementation_imports where organization_id=$1 and idempotency_key=$2",
          [tenant(org), z.uuid().parse(key)],
        )
      )[0] ?? null,
    true,
  );
}
export async function mutateImplementation(
  org: string,
  actor: string,
  candidate: ImplementationAction,
): Promise<MutationResult> {
  org = tenant(org);
  z.uuid().parse(actor);
  const action = actionSchema.parse(candidate);
  return transaction(async (db) => {
    if (action.action === "import_site")
      return enqueue(db, org, actor, {
        kind: "site",
        site_url: action.url,
        idempotency_key: action.idempotency_key,
      });
    const implementation = await lockImplementation(db, org, true);
    if (action.action === "retry_import") {
      const [job] = await rows<ImportRecord>(
        db,
        "select * from public.agent_implementation_imports where organization_id=$1 and implementation_id=$2 and id=$3 for update",
        [org, implementation.id, action.import_id],
      );
      if (!job) throw new ImplementationError("not_found");
      if (job.status !== "failed") return { import: job, duplicate: true };
      if (job.attempts >= job.max_attempts)
        throw new ImplementationError("implementation_import_exhausted");
      const [retry] = await rows<ImportRecord>(
        db,
        "update public.agent_implementation_imports set status='queued',error_code=null,next_attempt_at=clock_timestamp(),updated_at=clock_timestamp() where organization_id=$1 and id=$2 returning *",
        [org, job.id],
      );
      if (!retry) throw new ImplementationError("not_found");
      await emitImport(db, org, retry.id);
      return { import: retry, duplicate: false };
    }
    if (implementation.revision !== action.expected_revision)
      throw new ImplementationError("implementation_revision_conflict");
    if (action.action === "save_brief") {
      const [saved] = await rows<ImplementationRecord>(
        db,
        "update public.agent_implementations set brief=$2::jsonb where organization_id=$1 returning *",
        [org, JSON.stringify(action.brief)],
      );
      if (!saved) throw new ImplementationError("not_found");
      return { implementation: saved };
    }
    const facts = await factsFor(db, org, implementation.id);
    let saved: FactRecord | undefined;
    if (action.action === "add_fact") {
      if (
        facts.some(
          (f) =>
            f.category === action.category &&
            f.key === action.key &&
            f.review_status === "approved",
        )
      )
        throw new ImplementationError("state_conflict");
      const manual = approveFact(
        {
          id: randomUUID(),
          organization_id: org,
          implementation_id: implementation.id,
          import_id: null,
          category: action.category,
          key: action.key,
          original_value: action.value,
          original_hash: createHash("sha256").update(randomUUID()).digest("hex"),
          evidence_quote: null,
          source_url: null,
          source_name: action.source_name,
          captured_at: new Date().toISOString(),
          reviewed_value: null,
          review_status: "pending",
          is_manual: true,
          sensitive_confirmed: false,
          reviewed_by: null,
          reviewed_at: null,
          review_note: null,
        },
        action,
        actor,
        new Date().toISOString(),
      );
      [saved] = await rows<FactRecord>(
        db,
        `insert into public.agent_implementation_facts
        (id,organization_id,implementation_id,category,key,original_value,original_hash,source_name,captured_at,reviewed_value,review_status,is_manual,sensitive_confirmed,reviewed_by,reviewed_at,review_note)
        values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'approved',true,$11,$12,$13,$14) returning *`,
        [
          manual.id,
          org,
          implementation.id,
          manual.category,
          manual.key,
          manual.original_value,
          manual.original_hash,
          manual.source_name,
          manual.captured_at,
          manual.reviewed_value,
          manual.sensitive_confirmed,
          actor,
          manual.reviewed_at,
          manual.review_note,
        ],
      );
    } else {
      const current = facts.find((f) => f.id === action.fact_id);
      if (!current || current.review_status === "deleted")
        throw new ImplementationError("not_found");
      const now = new Date().toISOString();
      const revised =
        action.action === "review_fact" && action.disposition === "approved"
          ? approveFact(current, action, actor, now)
          : {
              ...current,
              review_status:
                action.action === "delete_fact" ? ("deleted" as const) : ("rejected" as const),
              reviewed_by: actor,
              reviewed_at: now,
              review_note: action.note ?? null,
            };
      if (revised.review_status === "approved") {
        const other = facts.find(
          (f) =>
            f.id !== current.id &&
            f.category === current.category &&
            f.key === current.key &&
            f.review_status === "approved",
        );
        if (other && (action.action !== "review_fact" || action.replace_fact_id !== other.id))
          throw new ImplementationError("state_conflict");
        if (
          action.action === "review_fact" &&
          action.replace_fact_id &&
          action.replace_fact_id !== other?.id
        )
          throw new ImplementationError("state_conflict");
        if (other)
          await db.query(
            "update public.agent_implementation_facts set review_status='rejected',reviewed_by=$3,reviewed_at=$4,review_note='Substituído por revisão explícita' where organization_id=$1 and id=$2",
            [org, other.id, actor, now],
          );
      }
      [saved] = await rows<FactRecord>(
        db,
        `update public.agent_implementation_facts set reviewed_value=$3,review_status=$4,is_manual=$5,
        sensitive_confirmed=$6,reviewed_by=$7,reviewed_at=$8,review_note=$9 where organization_id=$1 and id=$2 and implementation_id=$10 returning *`,
        [
          org,
          current.id,
          revised.reviewed_value,
          revised.review_status,
          revised.is_manual,
          revised.sensitive_confirmed,
          actor,
          now,
          revised.review_note,
          implementation.id,
        ],
      );
    }
    if (!saved) throw new ImplementationError("not_found");
    return {
      implementation: await refreshApprovedMetadata(db, org, implementation.id),
      fact: saved,
    };
  });
}

export type ClaimResult =
  | { status: "claimed"; import: ImportRecord }
  | { status: "contended"; retry_after_ms: number }
  | { status: "terminal"; import: ImportRecord | null };
/** Recuperação global operacional, baseada só em recibos internos; nenhum tenant/body externo. */
async function recoverExpired(db: PoolClient) {
  const recovered = await rows<ImportRecord>(
    db,
    `update public.agent_implementation_imports set
    status=case when attempts>=max_attempts then 'failed' else 'queued' end,lease_token=null,lease_expires_at=null,deadline_at=null,
    error_code='lease_expired',next_attempt_at=clock_timestamp(),updated_at=clock_timestamp()
    where status='running' and lease_expires_at<=clock_timestamp() returning *`,
  );
  for (const job of recovered)
    if (job.status === "queued") await emitImport(db, job.organization_id, job.id);
}
export async function claimImport(org: string, id: string): Promise<ClaimResult> {
  org = tenant(org);
  z.uuid().parse(id);
  try {
    return await transaction(async (db): Promise<ClaimResult> => {
      const [initial] = await rows<ImportRecord>(
        db,
        "select * from public.agent_implementation_imports where organization_id=$1 and id=$2",
        [org, id],
      );
      if (!initial || initial.status === "succeeded" || initial.status === "failed")
        return { status: "terminal", import: initial ?? null };
      await recoverExpired(db);
      const [job] = await rows<ImportRecord>(
        db,
        "select * from public.agent_implementation_imports where organization_id=$1 and id=$2 for update",
        [org, id],
      );
      if (!job || job.status === "succeeded" || job.status === "failed")
        return { status: "terminal", import: job ?? null };
      if (job.status === "running") return { status: "contended", retry_after_ms: 5000 };
      const [claimed] = await rows<ImportRecord>(
        db,
        `update public.agent_implementation_imports set status='running',attempts=attempts+1,
        lease_token=$3,lease_expires_at=clock_timestamp()+$4*interval '1 millisecond',deadline_at=clock_timestamp()+$5*interval '1 millisecond',updated_at=clock_timestamp()
        where organization_id=$1 and id=$2 and status='queued' and attempts<max_attempts and next_attempt_at<=clock_timestamp() returning *`,
        [org, id, randomUUID(), IMPORT_LIMITS.lease_ms, IMPORT_LIMITS.work_ms],
      );
      return claimed
        ? { status: "claimed", import: claimed }
        : { status: "contended", retry_after_ms: 5000 };
    });
  } catch (error) {
    if (
      (error as { code?: string; constraint?: string }).code === "23505" &&
      (error as { constraint?: string }).constraint === "agent_implementation_one_running"
    )
      return { status: "contended", retry_after_ms: 5000 };
    throw error;
  }
}
async function lockLiveImport(db: PoolClient, org: string, id: string, token: string) {
  const [initial] = await rows<ImportRecord>(
    db,
    "select * from public.agent_implementation_imports where organization_id=$1 and id=$2",
    [org, id],
  );
  if (!initial) throw new ImplementationError("implementation_lease_lost");
  const implementation = await lockImplementation(db, org);
  const [job] = await rows<ImportRecord>(
    db,
    `select * from public.agent_implementation_imports where organization_id=$1 and id=$2 and lease_token=$3
    and status='running' and lease_expires_at>clock_timestamp() and deadline_at>clock_timestamp() for update`,
    [org, id, token],
  );
  if (!job || job.implementation_id !== implementation.id)
    throw new ImplementationError("implementation_lease_lost");
  return { job, implementation };
}
/** Automático é somente pendente; validação extrativa antecede qualquer INSERT. */
export async function completeImport(
  org: string,
  id: string,
  token: string,
  result: {
    facts: unknown;
    sources: readonly EvidenceSource[];
    content_hash: string;
    warnings: string[];
  },
): Promise<ImportRecord> {
  org = tenant(org);
  z.uuid().parse(id);
  z.uuid().parse(token);
  z.string()
    .regex(/^[a-f0-9]{64}$/)
    .parse(result.content_hash);
  z.array(z.string().max(255)).max(100).parse(result.warnings);
  return transaction(async (db) => {
    const { implementation } = await lockLiveImport(db, org, id, token);
    const candidates = prepareImportedFacts(
      result.facts,
      result.sources,
      await factsFor(db, org, implementation.id),
    );
    for (const fact of candidates)
      await db.query(
        `insert into public.agent_implementation_facts
      (organization_id,implementation_id,import_id,category,key,original_value,original_hash,evidence_quote,source_url,source_name,captured_at)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) on conflict(implementation_id,organization_id,original_hash) do nothing`,
        [
          org,
          implementation.id,
          id,
          fact.category,
          fact.key,
          fact.value,
          fact.original_hash,
          fact.evidence_quote,
          fact.source_url ?? null,
          fact.source_name ?? null,
          fact.captured_at,
        ],
      );
    const [job] = await rows<ImportRecord>(
      db,
      `update public.agent_implementation_imports set status='succeeded',content_hash=$4,warnings=$5::jsonb,
      error_code=null,lease_token=null,lease_expires_at=null,deadline_at=null,updated_at=clock_timestamp()
      where organization_id=$1 and id=$2 and lease_token=$3 and lease_expires_at>clock_timestamp() and deadline_at>clock_timestamp() returning *`,
      [org, id, token, result.content_hash, JSON.stringify(result.warnings)],
    );
    if (!job) throw new ImplementationError("implementation_lease_lost");
    return job;
  });
}
/** Código seguro, nunca mensagem, stack ou URL de uma exceção. */
export async function failImport(
  org: string,
  id: string,
  token: string,
  code: string,
): Promise<ImportRecord> {
  org = tenant(org);
  z.uuid().parse(id);
  z.uuid().parse(token);
  z.string()
    .regex(/^[a-z][a-z0-9_]{0,79}$/)
    .parse(code);
  return transaction(async (db) => {
    // Échec borné peut arriver au deadline; lease doit encore appartenir au worker.
    const [job] = await rows<ImportRecord>(
      db,
      `update public.agent_implementation_imports set status='failed',error_code=$4,
      lease_token=null,lease_expires_at=null,deadline_at=null,updated_at=clock_timestamp()
      where organization_id=$1 and id=$2 and lease_token=$3 and status='running' and lease_expires_at>clock_timestamp() returning *`,
      [org, id, token, code],
    );
    if (!job) throw new ImplementationError("implementation_lease_lost");
    return job;
  });
}

const companySelection = `select jsonb_build_object('id',o.id,'display_name',o.display_name,'slug',o.slug,'status',o.status) as company,
  case when b.id is null then null else jsonb_build_object('plan_id',b.plan_id,'name',p.name,'status',b.status,'setup_paid',b.setup_paid) end as plan,
  case when i.id is null then null else to_jsonb(i) end as implementation,
  coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'name',a.name,'is_active',a.is_active,'published_version_id',a.published_version_id,'archived_at',a.archived_at) order by a.id)
    from public.ai_agents a where a.organization_id=o.id),'[]'::jsonb) as agents
  from public.organizations o left join public.billing_subscriptions b on b.organization_id=o.id
  left join public.billing_plans p on p.id=b.plan_id left join public.agent_implementations i on i.organization_id=o.id`;
/** Única listagem multitenant, invocada exclusivamente depois do full guard da rota. */
export async function listImplementations(
  query: ImplementationListQuery,
): Promise<{ data: ImplementationListItem[]; has_more: boolean; cursor: string | null }> {
  return transaction(async (db) => {
    const found = await rows<ImplementationListItem>(
      db,
      `${companySelection} where ($1::text is null or strpos(lower(o.display_name||' '||o.slug::text),lower($1))>0)
      and ($2::uuid is null or o.id>$2) order by o.id limit $3`,
      [query.q ?? null, query.cursor ?? null, query.limit + 1],
    );
    const has_more = found.length > query.limit;
    const data = found.slice(0, query.limit).map((row) => ({
      ...row,
      implementation: row.implementation
        ? {
            id: row.implementation.id,
            revision: row.implementation.revision,
            status: row.implementation.status,
            updated_at: row.implementation.updated_at,
          }
        : null,
    }));
    return { data, has_more, cursor: has_more ? (data.at(-1)?.company.id ?? null) : null };
  }, true);
}
export async function getImplementationDetail(org: string): Promise<ImplementationDetail | null> {
  org = tenant(org);
  const detail = await transaction(async (db) => {
    const [company] = await rows<
      ImplementationListItem & { implementation: ImplementationRecord | null }
    >(db, `${companySelection} where o.id=$1`, [org]);
    if (!company) return null;
    const i = company.implementation;
    const facts = i ? await factsFor(db, org, i.id) : [];
    const imports = i
      ? await rows<ImportRecord>(
          db,
          "select * from public.agent_implementation_imports where organization_id=$1 and implementation_id=$2 order by created_at desc,id limit 100",
          [org, i.id],
        )
      : [];
    const [source] = i?.source_id
      ? await rows<{
          active_kb_version_id: string | null;
          is_active: boolean;
          status: string;
          last_index_status: string | null;
        }>(
          db,
          "select active_kb_version_id,is_active,status,last_index_status from public.ai_knowledge_sources where organization_id=$1 and id=$2",
          [org, i.source_id],
        )
      : [];
    const [draft] = i?.draft_version_id
      ? await rows<Record<string, unknown>>(
          db,
          `select id,agent_id,status,system_prompt,provider,model,tool_ids,channel_session_id,
      max_steps,token_budget,cost_budget_cents,handoff_keywords,handoff_tool_enabled,knowledge_source_ids from public.ai_agent_versions where organization_id=$1 and id=$2 and agent_id=$3`,
          [org, i.draft_version_id, i.agent_id],
        )
      : [];
    return {
      ...company,
      facts,
      imports,
      knowledge: {
        source_id: i?.source_id ?? null,
        approved_revision: i?.approved_revision ?? null,
        approved_hash: i?.approved_hash ?? null,
        indexed_revision: i?.indexed_revision ?? null,
        indexed_hash: i?.indexed_hash ?? null,
        index_status: i?.index_status ?? "pending",
        active_kb_version_id: source?.active_kb_version_id ?? null,
        source_active: source?.is_active ?? null,
        source_status: source?.status ?? null,
        last_index_status: source?.last_index_status ?? null,
      },
      draft_agent_config: draft ?? null,
      test_records: i?.test_records ?? [],
    };
  }, true);
  if (!detail) return null;
  // Presença real de recursos; jamais serializar credenciais/config sensível.
  const admin = createAdminClient();
  const [credentials, channels] = await Promise.all([
    admin
      .from("ai_provider_credentials")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", org)
      .eq("is_active", true),
    admin
      .from("channel_sessions")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", org)
      .eq("status", "WORKING"),
  ]);
  if (credentials.error || channels.error) throw new Error("implementation_prerequisite_query");
  const present = (code: string, state: boolean) => ({
    code,
    status: state ? ("present" as const) : ("pending" as const),
  });
  return {
    ...detail,
    prerequisites: [
      present("billing_active", detail.plan?.status === "active"),
      present("setup_paid", detail.plan?.setup_paid === true),
      present("ai_credential", (credentials.count ?? 0) > 0),
      present("channel_working", (channels.count ?? 0) > 0),
      present(
        "approved_facts",
        detail.facts.some((f) => f.review_status === "approved"),
      ),
      present("facts_reviewed", !detail.facts.some((f) => f.review_status === "pending")),
      present("brief", Boolean(detail.implementation?.brief.purpose)),
      present("draft_agent", Boolean(detail.draft_agent_config)),
      present(
        "knowledge_current",
        Boolean(
          detail.knowledge.approved_hash &&
          detail.knowledge.source_active === true &&
          detail.knowledge.source_status === "ready" &&
          detail.knowledge.indexed_hash === detail.knowledge.approved_hash &&
          detail.knowledge.indexed_revision === detail.knowledge.approved_revision &&
          detail.knowledge.active_kb_version_id,
        ),
      ),
      present(
        "test_current",
        Boolean(
          detail.implementation?.tested_revision &&
          detail.implementation.tested_revision === detail.implementation.revision,
        ),
      ),
    ],
  };
}
