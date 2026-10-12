import { beforeEach, it, expect, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
const mocks = vi.hoisted(() => ({ db: vi.fn(), plans: vi.fn(), configured: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.db }));
vi.mock("@/lib/vellum/plans-server", () => ({ carregarPlanosPublicos: mocks.plans }));
vi.mock("@/lib/vellum/asaas", () => ({ asaasConfigurado: mocks.configured }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import { Financeiro } from "@/components/vellum/Financeiro";
import { Checkout } from "@/components/vellum/Checkout";
import { formatarBRL } from "@/lib/vellum/catalogo";
beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  mocks.configured.mockReturnValue(false);
  mocks.plans.mockResolvedValue([]);
});

it("não fabrica saldo zero quando o financeiro não está instalado", async () => {
  mocks.db.mockResolvedValue({
    from: () => {
      const chain = {
        select: vi.fn(),
        eq: vi.fn(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { code: "42P01" } }),
      };
      chain.select.mockReturnValue(chain);
      chain.eq.mockReturnValue(chain);
      return chain;
    },
  });
  render(await Financeiro({ orgId: "tenant", suporteTemporario: false }));
  expect(screen.getByText("Financeiro ainda não instalado")).toBeVisible();
  expect(screen.queryByText(/Conversas abertas neste período/)).toBeNull();
});
it("preserva centavos do preço editado e contratação fica desabilitada sem configuração", () => {
  render(
    <Checkout
      disponivel={false}
      planos={[
        {
          id: "start",
          nome: "START",
          preco_cents: 39990,
          conversas: 200,
          descricao: "Teste",
          destaque: false,
        },
      ]}
    />,
  );
  expect(formatarBRL(39990)).toContain("399,90");
  expect(screen.getByRole("option", { name: /399,90/ })).toBeVisible();
  expect(screen.getByRole("button", { name: "Gerar contratação em sandbox" })).toBeDisabled();
});
