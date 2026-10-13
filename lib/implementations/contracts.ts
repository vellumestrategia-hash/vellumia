import { z } from "zod";

/** Limites máximos; opções de coleta podem somente reduzi-los. */
export const CRAWL_LIMITS = Object.freeze({
  max_pages: 6,
  max_depth: 1,
  max_redirects: 4,
  max_response_bytes: 1024 * 1024,
  max_total_bytes: 2 * 1024 * 1024,
  timeout_ms: 90_000,
});
export const FACT_CATEGORIES = [
  "company",
  "segment",
  "products_services",
  "prices",
  "hours",
  "scheduling",
  "service_area",
  "contacts",
  "differentiators",
  "payment_methods",
  "policies",
  "commercial_conditions",
  "faq",
] as const;
export type FactCategory = (typeof FACT_CATEGORIES)[number];
export const factCategorySchema = z.enum(FACT_CATEGORIES);

export function normalizeEvidenceText(value: string): string {
  return value.normalize("NFKC").replace(/\s+/gu, " ").trim();
}
const boundedText = (max: number, min = 1) =>
  z.string().max(max).transform(normalizeEvidenceText).pipe(z.string().min(min).max(max));
const sourceUrlSchema = z
  .string()
  .max(2048)
  .url()
  .refine((value) => {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
  }, "source_url_invalid");
export const factSchema = z
  .object({
    category: factCategorySchema,
    key: boundedText(120),
    value: boundedText(4000),
    evidence_quote: boundedText(1000, 8),
    source_url: sourceUrlSchema.optional(),
    source_name: boundedText(255).optional(),
    captured_at: z.iso.datetime(),
  })
  .strict()
  .refine((fact) => Boolean(fact.source_url || fact.source_name), "source_required");
export const factsSchema = z.array(factSchema).max(80);
export type ImplementationFact = z.infer<typeof factSchema>;
export const evidenceSourceSchema = z
  .object({
    source_url: sourceUrlSchema.optional(),
    source_name: boundedText(255).optional(),
    text: z.string().min(1).max(200_000),
    captured_at: z.iso.datetime(),
  })
  .strict()
  .refine((source) => Boolean(source.source_url || source.source_name), "source_required");
export type EvidenceSource = z.infer<typeof evidenceSourceSchema>;

/** Validação extrativa: a IA não pode trocar fonte, data, citação ou valor. */
export function validateFactEvidence(
  candidate: unknown,
  sources: readonly EvidenceSource[],
): ImplementationFact {
  const parsed = factSchema.safeParse(candidate);
  if (!parsed.success) throw new Error("invalid_fact_schema");
  const fact = parsed.data;
  const matches = sources.filter(
    (source) =>
      (!fact.source_url || source.source_url === fact.source_url) &&
      (!fact.source_name || source.source_name === fact.source_name),
  );
  if (!matches.length) throw new Error("evidence_source_not_found");
  if (matches.length !== 1) throw new Error("ambiguous_source");
  const source = evidenceSourceSchema.parse(matches[0]);
  if (fact.captured_at !== source.captured_at) throw new Error("evidence_capture_mismatch");
  if (!normalizeEvidenceText(source.text).includes(fact.evidence_quote))
    throw new Error("evidence_quote_not_found");
  if (!fact.evidence_quote.includes(fact.value)) throw new Error("fact_value_not_in_quote");
  return fact;
}
export function validateFactsEvidence(
  candidates: unknown,
  sources: readonly EvidenceSource[],
): ImplementationFact[] {
  const parsed = factsSchema.safeParse(candidates);
  if (!parsed.success) throw new Error("invalid_fact_schema");
  const seen = new Set<string>();
  return parsed.data
    .map((candidate) => validateFactEvidence(candidate, sources))
    .filter((fact) => {
      const key = JSON.stringify([
        fact.category,
        fact.key,
        fact.value,
        fact.source_url,
        fact.source_name,
      ]);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
export interface ResolvedAddress {
  address: string;
  family: 4 | 6;
}
export type DnsResolver = (hostname: string) => Promise<readonly ResolvedAddress[]>;
export interface CrawlRequest {
  url: URL;
  address: string;
  family: 4 | 6;
  signal: AbortSignal;
  timeout_ms: number;
  max_bytes: number;
}
export interface CrawlResponse {
  status: number;
  headers: Record<string, string | undefined>;
  body: AsyncIterable<Uint8Array>;
  cancel?: () => void;
}
/** Seams de servidor para fixtures; nunca aceitar essas funções de um request/API. */
export type CrawlTransport = (request: CrawlRequest) => Promise<CrawlResponse>;
export interface CrawlOptions {
  max_pages?: number;
  max_depth?: number;
  max_redirects?: number;
  max_response_bytes?: number;
  max_total_bytes?: number;
  timeout_ms?: number;
  signal?: AbortSignal;
  resolve_dns?: DnsResolver;
  transport?: CrawlTransport;
}
export interface CrawledPage {
  url: string;
  title: string;
  text: string;
  captured_at: string;
  content_hash: string;
}
export interface CrawlResult {
  pages: CrawledPage[];
  content_hash: string;
  warnings: string[];
}

/** Interno: tenant, ator, lease e fonte são criados/resolvidos pelo servidor. */
export const IMPORT_LIMITS = Object.freeze({
  max_attempts: 3,
  lease_ms: 240_000,
  work_ms: 180_000,
});
export type ImplementationStatus = "draft" | "review" | "ready";
export type ImportStatus = "queued" | "running" | "succeeded" | "failed";
export type IndexStatus = "pending" | "indexing" | "success" | "failed";
export type FactReviewStatus = "pending" | "approved" | "rejected" | "deleted";
export interface TestRecord {
  run_id: string;
  revision: number;
  agent_version_id: string;
  status: string;
  recorded_at: string;
}
export interface ImplementationRecord {
  id: string;
  organization_id: string;
  revision: number;
  knowledge_revision: number;
  status: ImplementationStatus;
  brief: Record<string, unknown>;
  source_id: string | null;
  agent_id: string | null;
  draft_version_id: string | null;
  approved_revision: number | null;
  approved_hash: string | null;
  indexed_revision: number | null;
  indexed_hash: string | null;
  index_status: IndexStatus;
  config_revision: number | null;
  tested_revision: number | null;
  finalized_revision: number | null;
  test_records: TestRecord[];
  created_at: string;
  updated_at: string;
}
/**
 * API /api/v1/admin/implementations: GET multitenant full autorizado retorna
 * ImplementationListItem[] + meta {cursor UUID exclusivo desta listagem, has_more}.
 * GET /[organizationId] retorna ImplementationDetail; tenant somente do caminho.
 * POST /[organizationId]: import_site/retry_import retornam {import, duplicate};
 * review_fact/add_fact/delete_fact/save_brief retornam {implementation, fact?}.
 * expected_revision protege revisão/fatos/brief; idempotency_key protege import.
 * review_fact com replace_fact_id faz substituição explícita da mesma category/key.
 * approved_revision/indexed_revision referem-se a knowledge_revision, não revision.
 * Brief muda revision/test/finalização; fatos pendentes não mudam nenhuma revisão.
 * Alteração factual aprovada muda ambas, limpa índice e conserva originais/tombstones.
 * Implementação 'ready' é preparo; AgentState mantém a publicação/ativação reais.
 * O union estrito de input/limites está em schemas.ts; nenhum body fornece tenant.
 */
export interface FactRecord {
  id: string;
  organization_id: string;
  implementation_id: string;
  import_id: string | null;
  category: FactCategory;
  key: string;
  original_value: string;
  original_hash: string;
  evidence_quote: string | null;
  source_url: string | null;
  source_name: string | null;
  captured_at: string;
  reviewed_value: string | null;
  review_status: FactReviewStatus;
  is_manual: boolean;
  sensitive_confirmed: boolean;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
}
export interface ImportRecord {
  id: string;
  organization_id: string;
  implementation_id: string;
  kind: "site" | "file";
  site_url: string | null;
  blob_path: string | null;
  source_name: string | null;
  requested_by: string;
  idempotency_key: string;
  request_hash: string;
  status: ImportStatus;
  attempts: number;
  max_attempts: number;
  lease_token: string | null;
  lease_expires_at: string | null;
  deadline_at: string | null;
  next_attempt_at: string;
  content_hash: string | null;
  error_code: string | null;
  warnings: string[];
  created_at: string;
  updated_at: string;
}
export interface CompanyRecord {
  id: string;
  display_name: string;
  slug: string;
  status: string;
}
export interface PlanRecord {
  plan_id: string;
  name: string;
  status: string;
  setup_paid: boolean;
}
export interface AgentState {
  id: string;
  name: string;
  is_active: boolean;
  published_version_id: string | null;
  archived_at: string | null;
}
export interface ImplementationListItem {
  company: CompanyRecord;
  plan: PlanRecord | null;
  implementation: Pick<ImplementationRecord, "id" | "revision" | "status" | "updated_at"> | null;
  agents: AgentState[];
}
export interface Prerequisite {
  code: string;
  status: "present" | "pending";
}
export interface ImplementationDetail extends ImplementationListItem {
  implementation: ImplementationRecord | null;
  facts: FactRecord[];
  imports: ImportRecord[];
  knowledge: {
    source_id: string | null;
    approved_revision: number | null;
    approved_hash: string | null;
    indexed_revision: number | null;
    indexed_hash: string | null;
    index_status: IndexStatus;
    active_kb_version_id: string | null;
    source_active: boolean | null;
    source_status: string | null;
    last_index_status: string | null;
  };
  draft_agent_config: Record<string, unknown> | null;
  prerequisites: Prerequisite[];
  test_records: TestRecord[];
}
/** source_metadata.implementation é o contrato de commit atômico do indexador (Task 3). */
export interface ImplementationSourceMetadata {
  id: string;
  revision: number;
  approved_hash: string | null;
}
export type ImplementationErrorCode =
  | "implementation_revision_conflict"
  | "implementation_sensitive_confirmation_required"
  | "implementation_lease_lost"
  | "implementation_import_exhausted"
  | "idempotency_conflict"
  | "state_conflict"
  | "not_found"
  | "forbidden";
export class ImplementationError extends Error {
  constructor(public readonly code: ImplementationErrorCode) {
    super(code);
  }
}
