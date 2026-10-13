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
