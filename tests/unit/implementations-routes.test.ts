import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  guard: vi.fn(),
  support: vi.fn(),
  list: vi.fn(),
  detail: vi.fn(),
  mutate: vi.fn(),
  audit: vi.fn(),
}));
vi.mock("@/lib/auth/requirePlatformAdmin", () => ({ requirePlatformAdmin: mocks.guard }));
vi.mock("@/lib/impersonate/support", () => ({ readSupportContext: mocks.support }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/implementations/repository", () => ({
  listImplementations: mocks.list,
  getImplementationDetail: mocks.detail,
  mutateImplementation: mocks.mutate,
}));
vi.mock("@/lib/audit", () => ({ audit: mocks.audit }));
import { GET as list } from "@/app/api/v1/admin/implementations/route";
import { GET, POST } from "@/app/api/v1/admin/implementations/[organizationId]/route";
const org = "aaaaaaaa-0000-4000-8000-000000000001";
const user = "aaaaaaaa-0000-4000-8000-000000000002";
const context = { params: Promise.resolve({ organizationId: org }) };
const body = { action: "import_site", url: "https://example.com/", idempotency_key: user };
const request = (data: unknown = body) =>
  new Request("https://app.test/api/v1/admin/implementations/" + org, {
    method: "POST",
    body: JSON.stringify(data),
    headers: { "Content-Type": "application/json" },
  });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.guard.mockResolvedValue({ user: { id: user }, platformAdmin: { scope: "full" } });
  mocks.support.mockResolvedValue(null);
  mocks.list.mockResolvedValue({ data: [], has_more: false, cursor: null });
  mocks.detail.mockResolvedValue({ company: { id: org } });
  mocks.mutate.mockResolvedValue({ import: { id: user }, duplicate: false });
});
describe("implementations API: autorização, tenant e erros seguros", () => {
  it.each(["sem sessão", "cliente", "revogado", "MFA pendente"])(
    "nega %s antes de qualquer acesso privilegiado",
    async () => {
      mocks.guard.mockRejectedValue(new Error("denied"));
      expect((await POST(request(), context)).status).toBe(403);
      expect(mocks.mutate).not.toHaveBeenCalled();
    },
  );
  it.each(["support", "readonly"])("nega escopo global %s", async (scope) => {
    mocks.guard.mockResolvedValue({ user: { id: user }, platformAdmin: { scope } });
    expect((await GET(new Request("https://app.test/"), context)).status).toBe(403);
    expect(mocks.detail).not.toHaveBeenCalled();
  });
  it("nega sessão temporária de suporte inclusive full", async () => {
    mocks.support.mockResolvedValue({ access_mode: "full" });
    expect((await POST(request(), context)).status).toBe(403);
    expect(mocks.mutate).not.toHaveBeenCalled();
  });
  it("listagem global full tem paginação e busca validadas", async () => {
    const res = await list(new Request("https://app.test/?limit=20&q=Empresa"));
    expect(res.status).toBe(200);
    expect(mocks.list).toHaveBeenCalledWith(expect.objectContaining({ limit: 20, q: "Empresa" }));
    expect((await list(new Request("https://app.test/?limit=500"))).status).toBe(400);
  });
  it("ação usa somente tenant validado do caminho e ator do guard", async () => {
    const res = await POST(request(), context);
    expect(res.status).toBe(200);
    expect(mocks.mutate).toHaveBeenCalledWith(
      org,
      user,
      expect.objectContaining({ action: "import_site" }),
    );
    expect(mocks.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: org,
        actorUserId: user,
        actingAsPlatformAdmin: true,
      }),
    );
  });
  it("rejeita tenant no body e caminho inválido", async () => {
    expect((await POST(request({ ...body, organization_id: org }), context)).status).toBe(422);
    expect(
      (await POST(request(), { params: Promise.resolve({ organizationId: "invalid" }) })).status,
    ).toBe(400);
    expect(mocks.mutate).not.toHaveBeenCalled();
  });
  it("detalhe ausente é 404", async () => {
    mocks.detail.mockResolvedValue(null);
    expect((await GET(new Request("https://app.test/"), context)).status).toBe(404);
  });
  it("retorna importação idempotente existente sem criar outra", async () => {
    mocks.mutate.mockResolvedValue({ import: { id: user }, duplicate: true });
    const res = await POST(request(), context);
    expect((await res.json()).data).toEqual({ import: { id: user }, duplicate: true });
  });
  it("não vaza SQL, URL ou credencial em falha interna", async () => {
    mocks.mutate.mockRejectedValue(new Error("postgres password private-url"));
    const res = await POST(request(), context);
    expect(res.status).toBe(503);
    const serialized = JSON.stringify(await res.json());
    expect(serialized).not.toMatch(/postgres|password|private-url/);
    expect(res.headers.has("X-Request-Id")).toBe(true);
  });
});
