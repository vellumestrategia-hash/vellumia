import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { gerarPartes } from "../../scripts/vellum-sql-editor.mjs";
import { lastLine, sql } from "./gov-helpers";

it("baseline em partes funciona entre sessões PostgreSQL e termina com catálogo público mínimo", () => {
  const partes = gerarPartes(readFileSync("supabase/baseline.sql", "utf8"));
  for (const [i, parte] of partes.entries()) {
    expect(lastLine(sql(parte))).toContain(`Parte ${i + 1}/${partes.length} aplicada`);
    if (i < partes.length - 1) {
      expect(
        sql(`select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='public' and p.prosecdef and has_function_privilege('anon',p.oid,'EXECUTE');`),
      ).toBe("0");
    }
  }
  const planos = JSON.parse(
    lastLine(sql("set role anon; select public.fn_billing_public_plans();")),
  );
  expect(planos).toHaveLength(4);
  expect(planos[0]).not.toHaveProperty("ai_budget_usd_cents");
});
