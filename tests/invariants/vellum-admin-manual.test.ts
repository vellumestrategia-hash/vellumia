import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, expect, it } from "vitest";
import { countAs, sql } from "./gov-helpers";

const owner = "02320000-1111-4000-8000-000000000001";
const email = "bootstrap-vellum@invariant.test";
const template = readFileSync(resolve("docs/vellum/sql/03_administrador.template.sql"), "utf8");
const script = template.replace(
  "set local vellum.bootstrap_admin_email = 'EMAIL_DO_ADMIN';",
  `set local vellum.bootstrap_admin_email = '${email}';`,
);

beforeAll(() => {
  // O stub do harness cobre só os campos antigos de Auth; o Supabase real tem este campo.
  sql(`alter table auth.users add column if not exists email_confirmed_at timestamptz;
    insert into auth.users(id,email,email_confirmed_at) values ('${owner}','${email}',now());`);
});

it("cria administrador full e vínculo aceito, e reexecução preserva MFA e auditoria", () => {
  sql(script);
  expect(
    countAs(
      owner,
      "select count(*) from public.platform_admins where scope='full' and revoked_at is null;",
    ),
  ).toBe(1);
  expect(
    countAs(
      owner,
      "select count(*) from public.user_organizations where role='admin' and accepted_at is not null;",
    ),
  ).toBe(1);
  expect(sql(`select mfa_required from public.platform_admins where user_id='${owner}';`)).toBe(
    "f",
  );
  sql(`update public.platform_admins set mfa_required=true where user_id='${owner}';`);
  sql(script);
  expect(sql(`select mfa_required from public.platform_admins where user_id='${owner}';`)).toBe(
    "t",
  );
  expect(sql("select count(*) from public.organizations where slug='vellum-ai';")).toBe("1");
  expect(
    sql("select count(*) from public.api_audit_log where action='platform_admin.bootstrap';"),
  ).toBe("1");
});

it("recusa template sem destinatário e usuário sem e-mail confirmado", () => {
  expect(() => sql(template)).toThrow();
  const unconfirmed = "bootstrap-pendente@invariant.test";
  sql(`insert into auth.users(email) values ('${unconfirmed}');`);
  expect(() => sql(script.replace(email, unconfirmed))).toThrow();
  expect(sql("select count(*) from public.platform_admins;")).toBe("1");
});
