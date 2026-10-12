import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AtendimentoDemo } from "@/components/vellum/AtendimentoDemo";
import { DashboardClient } from "@/app/admin/(protected)/dashboard/_client";
import { TenantsClient } from "@/app/admin/(protected)/tenants/_client";

const mocks = vi.hoisted(() => ({ query: vi.fn(), tenants: vi.fn(), refetch: vi.fn() }));
vi.mock("@/hooks/useAdminDashboardKPIs", () => ({ useAdminDashboardKPIs: mocks.query }));
vi.mock("@/hooks/useAlertsRealtime", () => ({ useAlertsRealtime: vi.fn() }));
vi.mock("@/hooks/useAdminTenants", () => ({ useAdminTenants: mocks.tenants }));
vi.mock("@/components/admin/tenants/TenantsFilters", () => ({ TenantsFilters: () => null }));
vi.mock("@/components/admin/tenants/TenantsTable", () => ({
  TenantsTable: ({ data }: { data: Array<{ display_name: string }> }) => (
    <div data-testid="cadastros">{data.map((row) => row.display_name).join(", ")}</div>
  ),
  TenantsTableSkeleton: () => <div role="status">Carregando empresas</div>,
}));
afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());
const kpis = {
  tenants_active: 0,
  conv_pending_10min: 0,
  waha_ban_alerts: 0,
  lgpd_at_risk: 0,
  ai_budget_warnings: 0,
  alerts: [],
};

describe("demonstração ilustrativa", () => {
  it("mantém contexto ao trocar as etapas e anuncia a seleção sem mover o foco", () => {
    render(<AtendimentoDemo />);
    const atender = screen.getByRole("button", { name: /Atender/ });
    const qualificar = screen.getByRole("button", { name: /Qualificar/ });
    expect(atender).toHaveAttribute("aria-pressed", "true");
    qualificar.focus();
    fireEvent.click(qualificar);
    expect(qualificar).toHaveAttribute("aria-pressed", "true");
    expect(atender).toHaveAttribute("aria-pressed", "false");
    expect(qualificar).toHaveFocus();
    expect(screen.getByText("Desafio: acompanhamento dos contatos")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /Passar ao time/ }));
    expect(screen.getByText("Conversa com o especialista")).toBeVisible();
    expect(screen.getByText("EXEMPLO ILUSTRATIVO")).toBeVisible();
    expect(screen.getByText("Marina Costa")).toBeVisible();
  });
});

describe("consulta de empresas", () => {
  it("oferece recuperação sem transformar falha em zero empresas", () => {
    mocks.tenants.mockReturnValue({ isError: true, isLoading: false, refetch: mocks.refetch });
    render(<TenantsClient />);
    expect(screen.getByText("Cadastros indisponíveis")).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível carregar as empresas.");
    expect(screen.queryByText(/empresas cadastradas/)).toBeNull();
    expect(screen.queryByTestId("cadastros")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(mocks.refetch).toHaveBeenCalledOnce();
  });
  it("preserva os cadastros disponíveis se a atualização falhar", () => {
    mocks.tenants.mockReturnValue({
      data: { pages: [{ data: [{ display_name: "Empresa de teste" }] }] },
      isError: true,
      isLoading: false,
      refetch: mocks.refetch,
    });
    render(<TenantsClient />);
    expect(screen.getByRole("alert")).toBeVisible();
    expect(screen.getByTestId("cadastros")).toHaveTextContent("Empresa de teste");
    expect(screen.getByText("1 empresa cadastrada")).toBeVisible();
  });
});

describe("visão geral da plataforma", () => {
  it("não apresenta ausência de empresas ou indicadores zero quando a consulta falha", () => {
    mocks.query.mockReturnValue({
      isError: true,
      isLoading: false,
      isFetching: false,
      refetch: mocks.refetch,
    });
    render(<DashboardClient />);
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível atualizar");
    expect(screen.queryByText("Empresas ativas")).toBeNull();
    expect(screen.queryByText("Sua plataforma começa pelas empresas.")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Atualizar" }));
    expect(mocks.refetch).toHaveBeenCalledOnce();
  });
  it("preserva os últimos dados com aviso quando uma atualização falha", () => {
    mocks.query.mockReturnValue({
      data: { ...kpis, tenants_active: 7 },
      dataUpdatedAt: Date.now(),
      isError: true,
      isLoading: false,
      refetch: mocks.refetch,
    });
    render(<DashboardClient />);
    expect(screen.getByRole("alert")).toHaveTextContent("Os últimos dados disponíveis");
    expect(screen.getByText("7")).toBeVisible();
    expect(screen.queryByText("Sua plataforma começa pelas empresas.")).toBeNull();
  });
  it("orienta a plataforma sem empresas usando dados reais e uma rota existente", () => {
    mocks.query.mockReturnValue({
      data: kpis,
      dataUpdatedAt: Date.now(),
      isLoading: false,
      refetch: mocks.refetch,
    });
    render(<DashboardClient />);
    expect(screen.getByRole("link", { name: "Gerenciar empresas" })).toHaveAttribute(
      "href",
      "/admin/tenants",
    );
    expect(screen.getByText("Empresas ativas")).toBeVisible();
    expect(
      screen.getByText("Nenhum alerta sinalizado pelos indicadores monitorados."),
    ).toBeVisible();
  });
  it("distingue carregamento e evita atualizações concorrentes", () => {
    mocks.query.mockReturnValue({ isLoading: true, isFetching: true, refetch: mocks.refetch });
    render(<DashboardClient />);
    expect(screen.getByRole("status", { name: "Carregando visão geral" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Atualizando…" })).toBeDisabled();
    expect(screen.queryByText("Empresas ativas")).toBeNull();
  });
});
