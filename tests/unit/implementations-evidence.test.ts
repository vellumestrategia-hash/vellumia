// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  factSchema,
  factsSchema,
  normalizeEvidenceText,
  validateFactEvidence,
  validateFactsEvidence,
} from "@/lib/implementations/contracts";

const date = "2026-10-12T12:00:00.000Z";
const source = {
  source_url: "https://company.example/servicos",
  text: "Atendemos empresas. Consultoria a partir de R$ 500. Horário: segunda a sexta, das 9h às 18h.",
  captured_at: date,
};
const fact = {
  category: "prices",
  key: "consultoria",
  value: "a partir de R$ 500",
  evidence_quote: "Consultoria a partir de R$ 500.",
  source_url: source.source_url,
  captured_at: date,
};

describe("contratos de fatos e evidência", () => {
  it.each(["segment", "scheduling"])(
    "preserva categoria explícita %s com evidência extrativa",
    (category) => {
      const evidence = {
        source_name: "empresa.md",
        captured_at: date,
        text: "Segmento: Consultoria empresarial. Agendamento: somente com horário confirmado.",
      };
      const value =
        category === "segment" ? "Consultoria empresarial" : "somente com horário confirmado";
      const candidate = {
        category,
        key: category,
        value,
        evidence_quote: evidence.text,
        source_name: evidence.source_name,
        captured_at: date,
      };
      expect(validateFactEvidence(candidate, [evidence]).category).toBe(category);
    },
  );
  it("normaliza somente Unicode e espaços, mantendo números e caixa", () => {
    expect(normalizeEvidenceText("  Preço\u00a0 R$\n５００ ")).toBe("Preço R$ 500");
  });
  it("aceita fato extrativo atribuído a fonte enumerada e normaliza a citação", () => {
    expect(
      validateFactEvidence({ ...fact, evidence_quote: "Consultoria\n a partir de R$ 500." }, [
        source,
      ]),
    ).toEqual(fact);
  });
  it("aceita fonte de arquivo pelo nome sem inventar URL", () => {
    const file = { source_name: "empresa.md", text: source.text, captured_at: date };
    const candidate = { ...fact, source_url: undefined, source_name: file.source_name };
    expect(validateFactEvidence(candidate, [file]).source_name).toBe("empresa.md");
  });
  it.each([
    [{ evidence_quote: "Consultoria a partir de R$ 100." }, "evidence_quote_not_found"],
    [{ value: "a partir de R$ 100" }, "fact_value_not_in_quote"],
    [{ source_url: "https://invented.example/" }, "evidence_source_not_found"],
    [{ source_url: undefined, source_name: undefined }, "invalid_fact_schema"],
    [{ captured_at: "2026-10-11T12:00:00.000Z" }, "evidence_capture_mismatch"],
    [{ category: "made_up" }, "invalid_fact_schema"],
    [{ evidence_quote: "consultoria a partir de R$ 500." }, "evidence_quote_not_found"],
    [{ source_url: "javascript:alert(1)" }, "invalid_fact_schema"],
    [{ value: "" }, "invalid_fact_schema"],
  ])("rejeita fato inventado, sem atribuição ou fora do contrato: %j", (change, code) => {
    expect(() => validateFactEvidence({ ...fact, ...change }, [source])).toThrow(code);
  });
  it("não aceita uma citação montada com trechos separados", () => {
    expect(() =>
      validateFactEvidence(
        {
          ...fact,
          evidence_quote: "Atendemos empresas. Horário: segunda a sexta",
          value: "segunda a sexta",
        },
        [source],
      ),
    ).toThrow("evidence_quote_not_found");
  });
  it("limita quantidade e tamanho antes de validar saída externa", () => {
    expect(factsSchema.safeParse(Array.from({ length: 81 }, () => fact)).success).toBe(false);
    expect(factSchema.safeParse({ ...fact, value: "x".repeat(4001) }).success).toBe(false);
    expect(factSchema.safeParse({ ...fact, evidence_quote: "x".repeat(1001) }).success).toBe(false);
  });
  it("rejeita fonte ambígua e deduplica fatos idênticos após normalização", () => {
    expect(() => validateFactEvidence(fact, [source, source])).toThrow("ambiguous_source");
    expect(
      validateFactsEvidence([fact, { ...fact, value: " a partir de R$ 500 " }], [source]),
    ).toEqual([fact]);
  });
});
