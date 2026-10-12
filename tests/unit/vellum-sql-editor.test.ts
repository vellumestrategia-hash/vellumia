import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { gerarPartes, separarComandos } from "../../scripts/vellum-sql-editor.mjs";

it("mantém corpos de funções, literais escapados e comentários aninhados inteiros", () => {
  const comandos = [
    "select 'um;dois';",
    "\nselect E'tres\\';quatro';",
    '\nselect "cinco;seis";',
    "\n-- ; ignorado\n/* bloco ; /* aninhado ; */ */ do $corpo$ begin perform 1; end $corpo$;",
  ];
  expect(separarComandos(comandos.join(""))).toEqual(comandos);
  expect(() => separarComandos("do $$ begin perform 1;")).toThrow(/incompleto/);
});

it("preserva integralmente o baseline e cada parte cabe no SQL Editor contando UTF-8", () => {
  const baseline = readFileSync("supabase/baseline.sql", "utf8");
  expect(separarComandos(baseline).join("")).toBe(baseline);
  const partes = gerarPartes(baseline);
  expect(partes.length).toBeGreaterThan(1);
  for (const parte of partes) {
    expect(Buffer.byteLength(parte)).toBeLessThanOrEqual(700000);
    expect(parte).toContain("begin;");
    expect(parte).toContain("commit;");
    expect(parte).toContain("set local check_function_bodies = false;");
  }
  expect(partes[0]).toContain("revoke execute on function %s from public, anon");
  expect(gerarPartes(baseline.replace(/\r?\n/g, "\r\n"))).toEqual(partes);
});
