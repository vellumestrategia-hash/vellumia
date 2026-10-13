import { z } from "zod";
import { factCategorySchema, normalizeEvidenceText } from "./contracts";
import { parsePublicUrl } from "./public-url";
export const organizationIdSchema = z.uuid();
const text = (max: number) => z.string().trim().min(1).max(max).transform(normalizeEvidenceText);
export const briefSchema = z
  .object({
    purpose: text(2000),
    audience: text(2000),
    tone: text(1000),
    limits: text(4000),
    handoff: text(2000),
    required_questions: z.array(text(500)).max(20),
  })
  .strict();
const revision = { expected_revision: z.number().int().min(1) };
export const actionSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("import_site"),
      idempotency_key: z.uuid(),
      url: z
        .string()
        .max(2048)
        .transform((url, ctx) => {
          try {
            return parsePublicUrl(url).href;
          } catch {
            ctx.addIssue({ code: "custom", message: "unsafe_url" });
            return z.NEVER;
          }
        }),
    })
    .strict(),
  z.object({ action: z.literal("retry_import"), import_id: z.uuid() }).strict(),
  z
    .object({
      action: z.literal("review_fact"),
      fact_id: z.uuid(),
      ...revision,
      disposition: z.enum(["approved", "rejected"]),
      value: text(4000).optional(),
      replace_fact_id: z.uuid().optional(),
      sensitive_confirmed: z.boolean().default(false),
      note: text(2000).optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal("add_fact"),
      ...revision,
      category: factCategorySchema,
      key: text(120),
      value: text(4000),
      source_name: text(255),
      sensitive_confirmed: z.boolean().default(false),
      note: text(2000).optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal("delete_fact"),
      fact_id: z.uuid(),
      ...revision,
      note: text(2000).optional(),
    })
    .strict(),
  z.object({ action: z.literal("save_brief"), ...revision, brief: briefSchema }).strict(),
]);
export type ImplementationAction = z.infer<typeof actionSchema>;
export const listQuerySchema = z
  .object({
    q: z.string().trim().max(120).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(30),
    cursor: z.uuid().optional(),
  })
  .strict();
export type ImplementationListQuery = z.infer<typeof listQuerySchema>;
