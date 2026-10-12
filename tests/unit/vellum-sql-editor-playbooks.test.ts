// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { gerarPartes, separarComandos } from "../../scripts/vellum-sql-editor.mjs";

const baseline = readFileSync("supabase/baseline.sql", "utf8");
const publicacao = separarComandos(baseline).find((c) =>
  c.includes("v_md5 constant text := 'c2022f05f5b5d9451e727cf0f4187f8a'"),
)!;
const corpoOriginal = /\$body\$([^]*?)\$body\$/.exec(publicacao)![1]!;

async function banco() {
  const db = new PGlite();
  await db.exec(`
    create table skill_versions (
      id uuid primary key default gen_random_uuid(), organization_id uuid,
      name text, description text, body text, matcher jsonb
    );
    create table skill_pointers (
      organization_id uuid, name text, version_id uuid, updated_at timestamptz
    );
  `);
  return db;
}

it.each(["LF", "CRLF", "indentação"])(
  "publica o playbook original com hash válido após copiar com %s",
  async (copia) => {
    const db = await banco();
    try {
      const parte = gerarPartes(publicacao)[0]!;
      const copiado =
        copia === "CRLF"
          ? parte.replace(/\n/g, "\r\n")
          : copia === "indentação"
            ? parte.replace(/\n/g, "\n  ")
            : parte;
      await db.exec(copiado);
      await db.exec(copiado);
      const { rows } = await db.query<{ body: string; hash: string }>(
        "select body, md5(body) as hash from skill_versions",
      );
      expect(rows).toEqual([{ body: corpoOriginal, hash: "c2022f05f5b5d9451e727cf0f4187f8a" }]);
      expect((await db.query("select * from skill_pointers")).rows).toHaveLength(1);
    } finally {
      await db.close();
    }
  },
);

it("mantém a rejeição de conteúdo alterado pelo self-check original", async () => {
  const db = await banco();
  try {
    const original = Buffer.from(corpoOriginal).toString("base64");
    const adulterado = Buffer.from(corpoOriginal.replace("# Playbook", "! Playbook")).toString(
      "base64",
    );
    const parte = gerarPartes(publicacao)[0]!.replace(original, adulterado);
    await expect(db.exec(parte)).rejects.toThrow(/md5 declarado.*nao corresponde/);
    await db.exec("rollback;");
    expect((await db.query("select * from skill_versions")).rows).toHaveLength(0);
  } finally {
    await db.close();
  }
});
