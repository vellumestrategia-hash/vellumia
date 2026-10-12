import { beforeEach, describe, expect, it, vi } from "vitest";
import { redirect } from "next/navigation";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import type { ActiveOrg, AuthUser } from "@/lib/auth/types";
import AppHome from "./page";

vi.mock("@/lib/auth/server", () => ({ requireAuth: vi.fn(), resolveActiveOrg: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => { throw new Error(`redirect:${path}`); }),
}));

describe("destino do primeiro acesso", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue({ is_platform_admin: false, support: null } as AuthUser);
    vi.mocked(resolveActiveOrg).mockResolvedValue(null);
  });

  it("conta de cliente sem empresa vai configurar a empresa, nunca a um perfil sem navegação", async () => {
    await expect(AppHome()).rejects.toThrow("redirect:/get-started");
  });

  it("administrador da plataforma sem empresa entra na administração", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ is_platform_admin: true, support: null } as AuthUser);
    await expect(AppHome()).rejects.toThrow("redirect:/admin/dashboard");
  });

  it("cliente com empresa mantém a entrada no atendimento", async () => {
    vi.mocked(resolveActiveOrg).mockResolvedValue({ role: "admin" } as ActiveOrg);
    await expect(AppHome()).rejects.toThrow("redirect:/app/inbox");
    expect(redirect).not.toHaveBeenCalledWith("/get-started");
  });

  it("respeita a interface escolhida para o vínculo da empresa", async () => {
    vi.mocked(resolveActiveOrg).mockResolvedValue({
      role: "admin", interface_settings: { preset: "completa", destinos: ["/app/products"] },
    } as ActiveOrg);
    await expect(AppHome()).rejects.toThrow("redirect:/app/products");
  });
});
