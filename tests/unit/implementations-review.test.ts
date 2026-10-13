import { describe, expect, it, vi } from "vitest";
const dependencies = vi.hoisted(() => ({ pool: vi.fn(), admin: vi.fn() }));
vi.mock("@/lib/agent-engine/db/request-pool", () => ({ getRequestPool: dependencies.pool }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: dependencies.admin }));
import { actionSchema } from "@/lib/implementations/schemas";
import {
  approveFact,
  importedFactHash,
  prepareImportedFacts,
  invalidateRevision,
  approvedContentHash,
} from "@/lib/implementations/review";
import type { FactRecord, ImplementationRecord } from "@/lib/implementations/contracts";
import {
  mutateImplementation,
  claimImport,
  completeImport,
  failImport,
  enqueueFileImport,
  listImplementations,
  getImplementationDetail,
  getImport,
} from "@/lib/implementations/repository";

const captured_at = "2026-10-12T12:00:00.000Z";
const original = {
  category: "hours" as const,
  key: "hours",
  value: "9h",
  evidence_quote: "Atendemos a partir das 9h",
  source_url: "https://example.com/",
  captured_at,
};
const source = { text: original.evidence_quote, source_url: original.source_url, captured_at };
const fact: FactRecord = {
  ...original,
  source_name: null,
  id: "aaaaaaaa-0000-4000-8000-000000000001",
  organization_id: "aaaaaaaa-0000-4000-8000-000000000002",
  implementation_id: "aaaaaaaa-0000-4000-8000-000000000003",
  import_id: null,
  original_value: "9h",
  original_hash: "hash",
  reviewed_value: null,
  review_status: "pending",
  is_manual: false,
  sensitive_confirmed: false,
  reviewed_by: null,
  reviewed_at: null,
  review_note: null,
};

describe("implementations: schemas e revisão factual", () => {
  it("aceita ação estrita com tenant exclusivamente no caminho", () => {
    expect(
      actionSchema.safeParse({
        action: "import_site",
        url: "https://example.com",
        idempotency_key: fact.id,
      }).success,
    ).toBe(true);
    expect(
      actionSchema.safeParse({
        action: "import_site",
        url: "https://example.com",
        idempotency_key: fact.id,
        organization_id: fact.organization_id,
      }).success,
    ).toBe(false);
  });
  it("rejeita URL privada sem executar DNS", () => {
    expect(
      actionSchema.safeParse({
        action: "import_site",
        url: "http://127.0.0.1",
        idempotency_key: fact.id,
      }).success,
    ).toBe(false);
  });
  it("extrai somente fatos com evidência literal e data da fonte", () => {
    expect(prepareImportedFacts([original], [source], [])).toHaveLength(1);
    expect(() => prepareImportedFacts([{ ...original, value: "10h" }], [source], [])).toThrow();
  });
  it("reimportação não ressuscita fato excluído ou substitui revisão humana", () => {
    const hash = importedFactHash(original);
    for (const review_status of ["deleted", "rejected", "approved"] as const) {
      expect(
        prepareImportedFacts(
          [original],
          [source],
          [{ ...fact, original_hash: hash, review_status, reviewed_value: "10h" }],
        ),
      ).toEqual([]);
    }
  });
  it("identidade do original normaliza texto e ignora data de nova coleta", () => {
    expect(
      importedFactHash({
        ...original,
        key: " hours ",
        value: " 9h ",
        captured_at: "2026-10-13T12:00:00.000Z",
      }),
    ).toBe(importedFactHash(original));
  });
  it("confirmação explícita é exigida para horários e regras comerciais", () => {
    expect(() =>
      approveFact(fact, { value: "10h", sensitive_confirmed: false }, fact.id, captured_at),
    ).toThrow("implementation_sensitive_confirmation_required");
    for (const category of [
      "prices",
      "hours",
      "policies",
      "commercial_conditions",
      "payment_methods",
      "scheduling",
    ] as const) {
      expect(() =>
        approveFact({ ...fact, category }, { sensitive_confirmed: false }, fact.id, captured_at),
      ).toThrow();
    }
  });
  it("correção humana preserva origem e identifica valor revisado", () => {
    const revised = approveFact(
      fact,
      { value: "10h", sensitive_confirmed: true, note: "Confirmado pelo proprietário" },
      fact.id,
      captured_at,
    );
    expect(revised).toMatchObject({
      original_value: "9h",
      evidence_quote: original.evidence_quote,
      original_hash: "hash",
      reviewed_value: "10h",
      is_manual: true,
      review_status: "approved",
      reviewed_by: fact.id,
      reviewed_at: captured_at,
    });
  });
  it("aprovação sem edição conserva natureza extrativa", () => {
    expect(approveFact({ ...fact, category: "company" }, {}, fact.id, captured_at)).toMatchObject({
      reviewed_value: "9h",
      is_manual: false,
      review_status: "approved",
    });
  });
  it("hash aprovado inclui só fatos aprovados e mantém ordem estável", () => {
    const approved = approveFact({ ...fact, category: "company" }, {}, fact.id, captured_at);
    expect(approvedContentHash([approved, fact])).toBe(approvedContentHash([approved]));
    expect(approvedContentHash([{ ...approved, reviewed_value: "novo" }])).not.toBe(
      approvedContentHash([approved]),
    );
    expect(approvedContentHash([])).toBeNull();
  });
  it("alteração invalida teste/finalização e índice da revisão anterior", () => {
    const record = {
      revision: 7,
      knowledge_revision: 7,
      status: "ready",
      tested_revision: 7,
      finalized_revision: 7,
      config_revision: 7,
      indexed_revision: 7,
      indexed_hash: "old",
      approved_revision: 7,
      approved_hash: "old",
    } as ImplementationRecord;
    expect(invalidateRevision(record, "new")).toMatchObject({
      revision: 8,
      status: "review",
      tested_revision: null,
      finalized_revision: null,
      config_revision: null,
      indexed_revision: null,
      indexed_hash: null,
      approved_hash: "new",
      approved_revision: 8,
      index_status: "pending",
    });
  });
  it("brief preserva conhecimento inalterado enquanto invalida comportamento", () => {
    const record = {
      revision: 10,
      knowledge_revision: 4,
      approved_hash: "same",
      indexed_hash: "same",
      indexed_revision: 4,
      index_status: "success",
      tested_revision: 10,
      finalized_revision: 10,
    } as ImplementationRecord;
    expect(invalidateRevision(record, "same")).toMatchObject({
      revision: 11,
      knowledge_revision: 4,
      indexed_hash: "same",
      indexed_revision: 4,
      index_status: "success",
      tested_revision: null,
      finalized_revision: null,
    });
  });
});

// Seams de transporte: PostgreSQL real/RLS/índice de concorrência são provas do CI.
// Aqui se verifica ordem transacional, binds confiáveis e fencing de writes.
function driver(respond: (sql: string, values: readonly unknown[]) => unknown[]) {
  const statements: Array<{ sql: string; values: readonly unknown[] }> = [];
  const client = {
    query: async (sql: string, values: readonly unknown[] = []) => {
      statements.push({ sql, values });
      return { rows: respond(sql, values), rowCount: 1 };
    },
    release: vi.fn(),
  };
  dependencies.pool.mockReturnValue({ connect: async () => client });
  return statements;
}
describe("implementations repository: transaction e lease", () => {
  const org = fact.organization_id,
    id = fact.implementation_id,
    actor = fact.id;
  const implementation = {
    id,
    organization_id: org,
    revision: 1,
    knowledge_revision: 1,
    approved_hash: null,
    source_id: null,
  };
  const previousApproved: FactRecord = {
    ...fact,
    id: "aaaaaaaa-0000-4000-8000-000000000004",
    reviewed_value: "9h",
    review_status: "approved",
    sensitive_confirmed: true,
    reviewed_by: actor,
    reviewed_at: captured_at,
  };
  const replacement: FactRecord = {
    ...fact,
    original_value: "10h",
    original_hash: "candidate-hash",
    evidence_quote: "Atendemos a partir das 10h",
  };
  const replacementApproved: FactRecord = {
    ...replacement,
    reviewed_value: "10h",
    review_status: "approved",
    sensitive_confirmed: true,
    reviewed_by: actor,
    reviewed_at: captured_at,
  };
  function replacementDriver(failCandidateWrite = false) {
    let factReads = 0;
    return driver((sql) => {
      if (sql.includes("select id from public.organizations")) return [{ id: org }];
      if (sql.includes("select * from public.agent_implementations")) return [implementation];
      if (sql.includes("select * from public.agent_implementation_facts"))
        return factReads++ === 0
          ? [previousApproved, replacement]
          : [{ ...previousApproved, review_status: "rejected" }, replacementApproved];
      if (sql.startsWith("update public.agent_implementation_facts set reviewed_value=")) {
        if (failCandidateWrite) throw new Error("candidate write failed");
        return [replacementApproved];
      }
      if (sql.startsWith("update public.agent_implementations set approved_hash="))
        return [implementation];
      return [];
    });
  }
  const replacementAction = {
    action: "review_fact" as const,
    fact_id: replacement.id,
    expected_revision: 1,
    disposition: "approved" as const,
    sensitive_confirmed: true,
  };
  it.each([
    { label: "ausente", replace_fact_id: undefined },
    { label: "incorreto", replace_fact_id: "aaaaaaaa-0000-4000-8000-000000000005" },
  ])(
    "substituição com replace_fact_id $label retorna conflito sem escrever fatos",
    async ({ replace_fact_id }) => {
      const statements = replacementDriver();
      await expect(
        mutateImplementation(org, actor, { ...replacementAction, replace_fact_id }),
      ).rejects.toThrow("state_conflict");
      expect(
        statements.filter((s) =>
          /^(update|insert into|delete from) public\.agent_implementation_facts/.test(s.sql),
        ),
      ).toEqual([]);
      expect(statements.at(-1)?.sql).toBe("rollback");
      expect(statements.some((s) => s.sql === "commit")).toBe(false);
    },
  );
  it("substituição explícita rejeita o aprovado antes de aprovar o candidato e confirmar", async () => {
    const statements = replacementDriver();
    const result = await mutateImplementation(org, actor, {
      ...replacementAction,
      replace_fact_id: previousApproved.id,
    });
    const writes = statements.filter((s) =>
      s.sql.startsWith("update public.agent_implementation_facts"),
    );
    expect(writes).toHaveLength(2);
    expect(writes[0]?.sql).toContain("review_status='rejected'");
    expect(writes[0]?.values).toEqual([org, previousApproved.id, actor, expect.any(String)]);
    expect(writes[1]?.values).toEqual([
      org,
      replacement.id,
      "10h",
      "approved",
      false,
      true,
      actor,
      expect.any(String),
      null,
      id,
    ]);
    expect(result).toMatchObject({
      fact: {
        id: replacement.id,
        original_value: "10h",
        reviewed_value: "10h",
        review_status: "approved",
      },
    });
    expect(statements[0]?.sql).toBe("begin");
    expect(statements.at(-1)?.sql).toBe("commit");
    expect(statements.some((s) => s.sql === "rollback")).toBe(false);
  });
  it("falha na segunda escrita da substituição desfaz a rejeição anterior", async () => {
    const statements = replacementDriver(true);
    await expect(
      mutateImplementation(org, actor, {
        ...replacementAction,
        replace_fact_id: previousApproved.id,
      }),
    ).rejects.toThrow("candidate write failed");
    expect(
      statements.filter((s) => s.sql.startsWith("update public.agent_implementation_facts")),
    ).toHaveLength(2);
    expect(statements.at(-1)?.sql).toBe("rollback");
    expect(statements.some((s) => s.sql === "commit")).toBe(false);
    expect(
      statements.some((s) =>
        s.sql.startsWith("update public.agent_implementations set approved_hash="),
      ),
    ).toBe(false);
  });
  it("enqueue e event são confirmados juntos; repetição devolve import existente", async () => {
    let job: Record<string, unknown> | undefined;
    const statements = driver((sql, values) => {
      if (sql.includes("select id from public.organizations")) return [{ id: org }];
      if (sql.includes("returning *") && sql.includes("insert into public.agent_implementations("))
        return [implementation];
      if (sql.includes("select * from public.agent_implementations")) return [implementation];
      if (sql.includes("select * from public.agent_implementation_imports"))
        return job ? [job] : [];
      if (sql.includes("insert into public.agent_implementation_imports")) {
        job = { id: actor, organization_id: org, request_hash: values[5], status: "queued" };
        return [job];
      }
      return [];
    });
    const action = actionSchema.parse({
      action: "import_site",
      url: "https://example.com/",
      idempotency_key: actor,
    });
    const first = await mutateImplementation(org, actor, action),
      second = await mutateImplementation(org, actor, action);
    expect(first).toMatchObject({ duplicate: false });
    expect(second).toMatchObject({ duplicate: true });
    expect(statements.filter((s) => s.sql.includes("insert into public.event_log"))).toHaveLength(
      1,
    );
    expect(statements.filter((s) => s.sql === "commit")).toHaveLength(2);
    expect(statements.find((s) => s.sql.includes("insert into public.event_log"))?.values[0]).toBe(
      org,
    );
  });
  it("falha do evento desfaz enqueue inteiro", async () => {
    const statements = driver((sql, values) => {
      if (sql.includes("select id from public.organizations")) return [{ id: org }];
      if (sql.includes("agent_implementations") && !sql.includes("imports"))
        return [implementation];
      if (sql.includes("insert into public.agent_implementation_imports"))
        return [{ id: actor, request_hash: values[5] }];
      if (sql.includes("insert into public.event_log")) throw new Error("event insert failed");
      return [];
    });
    await expect(
      mutateImplementation(
        org,
        actor,
        actionSchema.parse({
          action: "import_site",
          url: "https://example.com/",
          idempotency_key: actor,
        }),
      ),
    ).rejects.toThrow();
    expect(statements.some((s) => s.sql === "rollback")).toBe(true);
    expect(statements.some((s) => s.sql === "commit")).toBe(false);
  });
  it("chave reaproveitada com outra URL conflita", async () => {
    driver((sql) =>
      sql.includes("agent_implementations")
        ? [implementation]
        : sql.includes("agent_implementation_imports")
          ? [{ request_hash: "different" }]
          : [{ id: org }],
    );
    await expect(
      mutateImplementation(
        org,
        actor,
        actionSchema.parse({
          action: "import_site",
          url: "https://example.com/",
          idempotency_key: actor,
        }),
      ),
    ).rejects.toThrow("idempotency_conflict");
  });
  it("revisão antiga não pode sobrescrever fatos", async () => {
    const statements = driver((sql) =>
      sql.includes("agent_implementations") ? [{ ...implementation, revision: 2 }] : [{ id: org }],
    );
    await expect(
      mutateImplementation(
        org,
        actor,
        actionSchema.parse({ action: "delete_fact", fact_id: actor, expected_revision: 1 }),
      ),
    ).rejects.toThrow("implementation_revision_conflict");
    expect(statements.some((s) => s.sql.includes("update public.agent_implementation_facts"))).toBe(
      false,
    );
  });
  it("contenda de slot global não consome tentativa", async () => {
    const statements = driver((sql) => {
      if (sql.startsWith("select * from public.agent_implementation_imports"))
        return [{ id: actor, status: "queued", attempts: 0, max_attempts: 3 }];
      if (sql.includes("set status='running'"))
        throw Object.assign(new Error("slot busy"), {
          code: "23505",
          constraint: "agent_implementation_one_running",
        });
      return [];
    });
    expect(await claimImport(org, actor)).toMatchObject({ status: "contended" });
    expect(statements.at(-1)?.sql).toBe("rollback");
  });
  it("write tardio exige org, job e lease vivo antes de inserir fatos", async () => {
    const statements = driver((sql) =>
      sql.includes("agent_implementations")
        ? [implementation]
        : sql.includes("agent_implementation_imports") && !sql.includes("lease_expires_at>")
          ? [{ implementation_id: id }]
          : [],
    );
    await expect(
      completeImport(org, actor, actor, {
        facts: [original],
        sources: [source],
        content_hash: "a".repeat(64),
        warnings: [],
      }),
    ).rejects.toThrow("implementation_lease_lost");
    expect(
      statements.some((s) => s.sql.includes("insert into public.agent_implementation_facts")),
    ).toBe(false);
    expect(statements.find((s) => s.sql.includes("lease_expires_at>"))?.values.slice(0, 3)).toEqual(
      [org, actor, actor],
    );
  });
  it("retry não zera tentativas e limite esgotado é erro explícito", async () => {
    const statements = driver((sql) =>
      sql.includes("agent_implementations")
        ? [implementation]
        : sql.includes("agent_implementation_imports")
          ? [{ id: actor, status: "failed", attempts: 3, max_attempts: 3 }]
          : [{ id: org }],
    );
    await expect(
      mutateImplementation(
        org,
        actor,
        actionSchema.parse({ action: "retry_import", import_id: actor }),
      ),
    ).rejects.toThrow("implementation_import_exhausted");
    expect(statements.some((s) => s.sql.includes("insert into public.event_log"))).toBe(false);
  });
  it("lease expirado é recuperado com evento; nova aquisição é limitada", async () => {
    const statements = driver((sql) => {
      if (sql.includes("where status='running'"))
        return [{ id: actor, organization_id: org, status: "queued", attempts: 1 }];
      if (sql.startsWith("select * from public.agent_implementation_imports"))
        return [
          { id: actor, organization_id: org, status: "queued", attempts: 1, max_attempts: 3 },
        ];
      if (sql.includes("set status='running'"))
        return [{ id: actor, attempts: 2, lease_token: actor }];
      return [];
    });
    expect(await claimImport(org, actor)).toMatchObject({
      status: "claimed",
      import: { attempts: 2 },
    });
    expect(statements.filter((s) => s.sql.includes("insert into public.event_log"))).toHaveLength(
      1,
    );
    const claim = statements.find((s) => s.sql.includes("set status='running'"));
    expect(claim?.values.slice(0, 2)).toEqual([org, actor]);
    expect(claim?.values.slice(3)).toEqual([240000, 180000]);
  });
  it("falha tardia rejeita lease antigo e não persiste mensagem sensível", async () => {
    const statements = driver(() => []);
    await expect(failImport(org, actor, actor, "safe_error")).rejects.toThrow(
      "implementation_lease_lost",
    );
    expect(statements.find((s) => s.sql.includes("error_code=$4"))?.values).toEqual([
      org,
      actor,
      actor,
      "safe_error",
    ]);
    await expect(failImport(org, actor, actor, "password=secret URL")).rejects.toThrow();
  });
  it("blob pendente exige UUID de servidor e prefixo tenant exato", async () => {
    driver(() => []);
    for (const blob_path of [
      `other/implementation-pending/${actor}.pdf`,
      `${org}/implementation-pending/../../a.pdf`,
      `${org}/implementation-pending/${"-".repeat(36)}.pdf`,
    ]) {
      await expect(
        enqueueFileImport(org, actor, {
          blob_path,
          source_name: "Fixture.pdf",
          idempotency_key: actor,
        }),
      ).rejects.toThrow("forbidden");
    }
  });
  it("listagem usa planos/estados reais e limita DTO com cursor estável", async () => {
    const row = {
      company: { id: org, status: "active" },
      plan: { plan_id: "growth", name: "GROWTH", status: "pending", setup_paid: false },
      implementation: { ...implementation, status: "draft", brief: { private: "omit" } },
      agents: [{ id: actor, is_active: true, published_version_id: null }],
    };
    const statements = driver(() => [row, { ...row, company: { id: actor } }]);
    const result = await listImplementations({ limit: 1, q: "%Empresa" });
    expect(result).toMatchObject({
      has_more: true,
      cursor: org,
      data: [{ plan: { status: "pending" }, agents: [{ published_version_id: null }] }],
    });
    expect(result.data[0]?.implementation).not.toHaveProperty("brief");
    expect(statements.find((s) => s.sql.includes("from public.organizations o"))?.values).toEqual([
      "%Empresa",
      null,
      2,
    ]);
  });
  it("detalhe mostra pendências reais, importação tenant-bound e nenhum readiness inventado", async () => {
    const row = {
      company: { id: org, display_name: "Fixture" },
      plan: null,
      implementation: {
        ...implementation,
        brief: {},
        test_records: [],
        indexed_hash: null,
        indexed_revision: null,
        approved_revision: null,
        index_status: "pending",
      },
      agents: [],
    };
    const statements = driver((sql) =>
      sql.includes("from public.organizations o")
        ? [row]
        : sql.includes("agent_implementation_facts")
          ? [fact]
          : [],
    );
    const chain = {
      select: () => chain,
      eq: () => chain,
      then: (resolve: (value: unknown) => unknown) =>
        Promise.resolve({ count: 0, error: null }).then(resolve),
    };
    dependencies.admin.mockReturnValue({ from: () => chain });
    const result = await getImplementationDetail(org);
    expect(result?.prerequisites).toEqual(
      expect.arrayContaining([
        { code: "billing_active", status: "pending" },
        { code: "facts_reviewed", status: "pending" },
        { code: "test_current", status: "pending" },
      ]),
    );
    expect(
      statements.filter((s) => s.sql.includes("agent_implementation_imports"))[0]?.values,
    ).toEqual([org, id]);
  });
  it("job inexistente/repetido é inofensivo antes da recuperação global", async () => {
    const statements = driver(() => []);
    expect(await claimImport(org, actor)).toEqual({ status: "terminal", import: null });
    expect(
      statements.some((s) => s.sql.includes("update public.agent_implementation_imports")),
    ).toBe(false);
    expect(statements.some((s) => s.sql.includes("insert into public.event_log"))).toBe(false);
  });
  it("DTO de importação converte datas do driver PostgreSQL para ISO UTC", async () => {
    driver((sql) =>
      sql.startsWith("select * from public.agent_implementation_imports")
        ? [{ id: actor, created_at: new Date(captured_at) }]
        : [],
    );
    expect((await getImport(org, actor))?.created_at).toBe(captured_at);
  });
  it("fonte arquivada nunca aparece como conhecimento atual por ter ponteiro antigo", async () => {
    const row = {
      company: { id: org },
      plan: null,
      agents: [],
      implementation: {
        ...implementation,
        brief: {},
        test_records: [],
        source_id: actor,
        approved_hash: "same",
        indexed_hash: "same",
        approved_revision: 1,
        indexed_revision: 1,
        index_status: "success",
      },
    };
    driver((sql) =>
      sql.includes("from public.organizations o")
        ? [row]
        : sql.includes("from public.ai_knowledge_sources")
          ? [
              {
                active_kb_version_id: actor,
                is_active: false,
                status: "archived",
                last_index_status: "success",
              },
            ]
          : [],
    );
    const chain = {
      select: () => chain,
      eq: () => chain,
      then: (resolve: (value: unknown) => unknown) =>
        Promise.resolve({ count: 0, error: null }).then(resolve),
    };
    dependencies.admin.mockReturnValue({ from: () => chain });
    expect((await getImplementationDetail(org))?.prerequisites).toEqual(
      expect.arrayContaining([{ code: "knowledge_current", status: "pending" }]),
    );
  });
});
