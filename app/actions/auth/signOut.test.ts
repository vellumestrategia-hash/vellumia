import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  logout: vi.fn(),
  deleteCookie: vi.fn(),
  audit: vi.fn(),
  redirect: vi.fn((path: string) => { throw new Error(`REDIRECT:${path}`); }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mocks.getUser, signOut: mocks.logout } }),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ delete: mocks.deleteCookie }),
  headers: async () => new Headers({ "x-request-id": "logout-test" }),
}));
vi.mock("@/lib/audit", () => ({ audit: mocks.audit }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { signOut, signOutSession } from "./signOut";

describe("saída da conta", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "usuario-autenticado" } } });
    mocks.logout.mockResolvedValue({ error: null });
  });

  it("encerra a sessão e o vínculo ativo, com auditoria, antes da navegação do cliente", async () => {
    await signOutSession();
    expect(mocks.logout).toHaveBeenCalledOnce();
    expect(mocks.deleteCookie).toHaveBeenCalledWith("active_org");
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({
      action: "auth.logout", actorUserId: "usuario-autenticado", requestId: "logout-test",
    }));
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("conserva a saída com redirecionamento para formulários de servidor", async () => {
    await expect(signOut()).rejects.toThrow("REDIRECT:/login");
    expect(mocks.logout).toHaveBeenCalledOnce();
    expect(mocks.deleteCookie).toHaveBeenCalledWith("active_org");
    expect(mocks.audit).toHaveBeenCalledOnce();
  });
});
