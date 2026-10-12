import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { expect, it } from "vitest";

it("não habilita o log automático de argumentos nas ações que recebem credenciais", () => {
  const source = ts.createSourceFile(
    "next.config.ts",
    readFileSync(resolve("next.config.ts"), "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  let protegido = false;
  function visit(node: ts.Node) {
    if (ts.isPropertyAssignment(node) && node.name.getText(source) === "logging") {
      if (node.initializer.kind === ts.SyntaxKind.FalseKeyword) protegido = true;
      if (ts.isObjectLiteralExpression(node.initializer)) {
        protegido = node.initializer.properties.some(
          (p) =>
            ts.isPropertyAssignment(p) &&
            p.name.getText(source) === "serverFunctions" &&
            p.initializer.kind === ts.SyntaxKind.FalseKeyword,
        );
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  expect(
    protegido,
    "Next registra senha e outros argumentos de Server Functions se o log padrão ficar ativo",
  ).toBe(true);
});
