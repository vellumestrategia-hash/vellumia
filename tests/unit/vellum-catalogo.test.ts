import { describe, expect, it } from "vitest";
import {
  CONVERSA_EXCEDENTE_CENTS,
  IMPLANTACAO_CENTS,
  JANELA_CONVERSA_MS,
  PLANOS_VELLUM,
  projetarMensalidade,
} from "@/lib/vellum/catalogo";
import { isPublicPath } from "@/lib/auth/public-paths";

describe("contrato comercial Véllum", () => {
  it("mantém valores e franquias aprovados no briefing", () => {
    expect(
      PLANOS_VELLUM.map(({ id, preco_cents, conversas }) => [id, preco_cents, conversas]),
    ).toEqual([
      ["start", 39900, 200],
      ["growth", 69900, 500],
      ["scale", 99900, 1000],
      ["enterprise", null, null],
    ]);
    expect(IMPLANTACAO_CENTS).toBe(100000);
    expect(CONVERSA_EXCEDENTE_CENTS).toBe(200);
    expect(JANELA_CONVERSA_MS).toBe(86400000);
  });
  it("cobra excedente só acima da franquia, sem somar implantação à mensalidade", () => {
    expect(projetarMensalidade("start", 200)).toEqual({
      base_cents: 39900,
      excedentes: 0,
      excedente_cents: 0,
      total_cents: 39900,
    });
    expect(projetarMensalidade("start", 201)?.total_cents).toBe(40100);
    expect(projetarMensalidade("growth", 507)?.excedente_cents).toBe(1400);
    expect(projetarMensalidade("scale", 0)?.total_cents).toBe(99900);
  });
  it("não inventa preço Enterprise", () => {
    expect(projetarMensalidade("enterprise", 10000)).toBeNull();
  });
  it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER])(
    "recusa quantidade inválida ou overflow: %s",
    (quantidade) => {
      expect(() => projetarMensalidade("start", quantidade)).toThrow(RangeError);
    },
  );
  it("libera somente catálogo público, mantendo billing autenticado", () => {
    expect(isPublicPath("/precos")).toBe(true);
    expect(isPublicPath("/precos/privado")).toBe(false);
    expect(isPublicPath("/app/settings/billing")).toBe(false);
    expect(isPublicPath("/admin")).toBe(false);
  });
});
