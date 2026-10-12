import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: { NEXT_PUBLIC_SUPABASE_URL: "https://example.invalid", SUPABASE_SERVICE_ROLE_KEY: "" },
}));
const criarCliente = vi.fn();
vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => criarCliente(...args),
}));
import { createAdminClient } from "@/lib/supabase/admin";

describe("admin fail-closed em desenvolvimento parcial", () => {
  it("não usa anon key nem tenta criar cliente privilegiado sem chave privada", () => {
    expect(() => createAdminClient()).toThrow("Configure SUPABASE_SERVICE_ROLE_KEY");
    expect(criarCliente).not.toHaveBeenCalled();
  });
});
