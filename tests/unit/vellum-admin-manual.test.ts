// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("concede administração da plataforma sem cadastrar empresa nem vínculo de cliente", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create schema auth;
      create table auth.users (id uuid, email text, email_confirmed_at timestamptz);
      insert into auth.users values
        ('02320000-1111-4000-8000-000000000001','dono@admin.test',now());
      create table organizations (
        id uuid default gen_random_uuid(), slug text, legal_name text,
        display_name text, locale text, created_by uuid
      );
      create table user_organizations (
        user_id uuid, organization_id uuid, role text, accepted_at timestamptz,
        revoked_at timestamptz, unique(user_id,organization_id)
      );
      create table platform_admins (
        user_id uuid primary key, granted_by uuid, scope text, mfa_required boolean,
        reason text, revoked_at timestamptz, revoked_by uuid, revoke_reason text
      );
      create table api_audit_log (
        organization_id uuid, actor_user_id uuid, action text, resource_type text,
        resource_id uuid, acting_as_platform_admin boolean, bypassed_rls boolean,
        metadata jsonb
      );
    `);
    const script = readFileSync("docs/vellum/sql/03_administrador.template.sql", "utf8").replace(
      "= 'EMAIL_DO_ADMIN';",
      "= 'dono@admin.test';",
    );
    await db.exec(script);
    expect((await db.query("select * from organizations")).rows).toHaveLength(0);
    expect((await db.query("select * from user_organizations")).rows).toHaveLength(0);
    expect((await db.query("select scope from platform_admins")).rows).toEqual([{ scope: "full" }]);
    await db.exec("update platform_admins set mfa_required=true;");
    await db.exec(script);
    expect((await db.query("select mfa_required from platform_admins")).rows).toEqual([
      { mfa_required: true },
    ]);
    expect((await db.query("select organization_id from api_audit_log")).rows).toEqual([
      { organization_id: null },
    ]);
  } finally {
    await db.close();
  }
});
