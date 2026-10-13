import { createHash } from "node:crypto";
import {
  ImplementationError,
  validateFactsEvidence,
  normalizeEvidenceText,
  type EvidenceSource,
  type FactRecord,
  type ImplementationFact,
  type ImplementationRecord,
} from "./contracts";
export const SENSITIVE_CATEGORIES = new Set([
  "prices",
  "hours",
  "scheduling",
  "payment_methods",
  "policies",
  "commercial_conditions",
]);
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
/** Captured_at muda na coleta; o hash do original permanece igual e preserva exclusões. */
export function importedFactHash(fact: ImplementationFact): string {
  return hash([
    fact.category,
    normalizeEvidenceText(fact.key),
    normalizeEvidenceText(fact.value),
    fact.source_url ? new URL(fact.source_url).href : null,
    fact.source_name ? normalizeEvidenceText(fact.source_name) : null,
  ]);
}
export function prepareImportedFacts(
  candidates: unknown,
  sources: readonly EvidenceSource[],
  existing: readonly FactRecord[],
): Array<ImplementationFact & { original_hash: string }> {
  const seen = new Set(existing.map((fact) => fact.original_hash));
  return validateFactsEvidence(candidates, sources).flatMap((fact) => {
    const original_hash = importedFactHash(fact);
    if (seen.has(original_hash)) return [];
    seen.add(original_hash);
    return [{ ...fact, original_hash }];
  });
}
export function approveFact(
  fact: FactRecord,
  edit: { value?: string; sensitive_confirmed?: boolean; note?: string },
  actor: string,
  now: string,
): FactRecord {
  if (SENSITIVE_CATEGORIES.has(fact.category) && edit.sensitive_confirmed !== true)
    throw new ImplementationError("implementation_sensitive_confirmation_required");
  const reviewed_value = edit.value ?? fact.reviewed_value ?? fact.original_value;
  return {
    ...fact,
    reviewed_value,
    review_status: "approved",
    is_manual: fact.is_manual || reviewed_value !== fact.original_value,
    sensitive_confirmed: edit.sensitive_confirmed === true,
    reviewed_by: actor,
    reviewed_at: now,
    review_note: edit.note ?? null,
  };
}
export function approvedContentHash(facts: readonly FactRecord[]): string | null {
  const content = facts
    .filter((fact) => fact.review_status === "approved")
    .map((fact) => [
      fact.category,
      fact.key,
      fact.reviewed_value,
      fact.source_url,
      fact.source_name,
      fact.captured_at,
      fact.is_manual,
    ]);
  return content.length
    ? hash(content.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))))
    : null;
}
export function invalidateRevision(
  record: ImplementationRecord,
  approved_hash: string | null,
): ImplementationRecord {
  const revision = record.revision + 1;
  const knowledge_changed = record.approved_hash !== approved_hash;
  const knowledge_revision = record.knowledge_revision + (knowledge_changed ? 1 : 0);
  return {
    ...record,
    revision,
    knowledge_revision,
    status: "review",
    approved_hash,
    approved_revision: approved_hash ? knowledge_revision : null,
    ...(knowledge_changed
      ? { indexed_revision: null, indexed_hash: null, index_status: "pending" as const }
      : {}),
    config_revision: null,
    tested_revision: null,
    finalized_revision: null,
  };
}
