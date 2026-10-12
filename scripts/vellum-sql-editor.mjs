import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Divide só após ; fora de strings, comentários e corpos $tag$ de funções. */
export function separarComandos(sql) {
  const comandos = [];
  let inicio = 0;
  let estado = "normal";
  let tag = "";
  let profundidade = 0;
  let escape = false;
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i],
      seguinte = sql[i + 1];
    if (estado === "linha") {
      if (c === "\n") estado = "normal";
    } else if (estado === "bloco") {
      if (c === "/" && seguinte === "*") {
        profundidade++;
        i++;
      } else if (c === "*" && seguinte === "/") {
        if (--profundidade === 0) estado = "normal";
        i++;
      }
    } else if (estado === "simples" || estado === "dupla") {
      const aspas = estado === "simples" ? "'" : '"';
      if (escape && c === "\\") i++;
      else if (c === aspas && seguinte === aspas) i++;
      else if (c === aspas) estado = "normal";
    } else if (estado === "dolar") {
      if (sql.startsWith(tag, i)) {
        i += tag.length - 1;
        estado = "normal";
      }
    } else if (c === "-" && seguinte === "-") {
      estado = "linha";
      i++;
    } else if (c === "/" && seguinte === "*") {
      estado = "bloco";
      profundidade = 1;
      i++;
    } else if (c === "'") {
      estado = "simples";
      escape = /[eE]/.test(sql[i - 1] ?? "") && !/[\w$]/.test(sql[i - 2] ?? "");
    } else if (c === '"') {
      estado = "dupla";
      escape = false;
    } else if (c === "$" && !/[\w$]/.test(sql[i - 1] ?? "")) {
      const match = /^(\$[A-Za-z_][A-Za-z_0-9]*\$|\$\$)/.exec(sql.slice(i));
      if (match) {
        tag = match[0];
        estado = "dolar";
        i += tag.length - 1;
      }
    } else if (c === ";") {
      comandos.push(sql.slice(inicio, i + 1));
      inicio = i + 1;
    }
  }
  if (!["normal", "linha"].includes(estado))
    throw new Error("SQL com literal ou comentário incompleto");
  if (inicio < sql.length) comandos.push(sql.slice(inicio));
  return comandos;
}

const prefixo = `begin;
set local statement_timeout = 0;
set local check_function_bodies = false;
set local row_security = off;
set local search_path = public, extensions;
`;

// Durante instalação parcial, tabelas já nascem fechadas e nenhuma definer fica
// acessível a anon. A última parte aplica os grants e a varredura canônicos.
const proteger = `
do $vellum_instalacao$
declare r record;
begin
  for r in select c.oid::regclass as tabela from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in ('r','p')
      and not exists (select 1 from pg_depend d
        where d.classid='pg_class'::regclass and d.objid=c.oid and d.deptype='e')
  loop
    execute format('alter table %s enable row level security',r.tabela);
  end loop;
  for r in select p.oid::regprocedure as funcao from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prosecdef
  loop
    execute format('revoke execute on function %s from public, anon',r.funcao);
  end loop;
end $vellum_instalacao$;
`;

export function prepararSQLParaEditor(sql) {
  return separarComandos(sql.replace(/\r\n/g, "\n"))
    .map((original) => {
      // O editor/clipboard pode mudar EOL ou indentar linhas dentro de $body$.
      // Transportar o texto como base64 preserva os bytes e o self-check md5
      // dos playbooks. O baseline e seus hashes permanecem intactos.
      return /insert\s+into\s+(?:public\.)?skill_versions\b/i.test(original)
        ? original.replace(/\$body\$([^]*?)\$body\$/g, (_, corpo) => {
            const payload = Buffer.from(corpo, "utf8").toString("base64");
            return `convert_from(decode('${payload}', 'base64'), 'UTF8')`;
          })
        : original;
    })
    .join("");
}

export function gerarPartes(baseline, limite = 700000) {
  const grupos = [];
  let atual = "";
  const reserva = Buffer.byteLength(prefixo + proteger) + 500;
  for (const comando of separarComandos(prepararSQLParaEditor(baseline))) {
    if (Buffer.byteLength(comando) + reserva > limite)
      throw new Error("Comando SQL excede o limite individual");
    if (atual && Buffer.byteLength(atual + comando) + reserva > limite) {
      grupos.push(atual);
      atual = "";
    }
    atual += comando;
  }
  if (atual) grupos.push(atual);
  return grupos.map((corpo, i) => {
    const ultima = i === grupos.length - 1;
    return (
      `-- Véllum AI: parte ${i + 1} de ${grupos.length}. Execute em ordem.\n` +
      prefixo +
      corpo +
      (ultima ? "" : proteger) +
      "\nnotify pgrst, 'reload schema';\ncommit;\n" +
      `select 'Parte ${i + 1}/${grupos.length} aplicada${ultima ? ". Execute agora o SQL do administrador." : ". Continue para a próxima parte."}' as resultado;\n`
    );
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const destino = resolve(process.argv[2] ?? "docs/vellum/sql/instalacao");
  const partes = gerarPartes(readFileSync(resolve("supabase/baseline.sql"), "utf8"));
  mkdirSync(destino, { recursive: true });
  const arquivos = partes.map((sql, i) => {
    const nome = `02_${String(i + 1).padStart(2, "0")}_instalar_schema.sql`;
    writeFileSync(join(destino, nome), sql);
    return { nome, bytes: Buffer.byteLength(sql) };
  });
  process.stdout.write(JSON.stringify({ arquivos }) + "\n");
}
