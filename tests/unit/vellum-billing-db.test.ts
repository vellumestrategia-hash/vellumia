// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";

// PostgreSQL embarcado real; stubs limitados ao contrato da base importada.
// Não toca o projeto remoto e não substitui os invariantes do baseline inteiro.
const migration = readFileSync(
  "supabase/migrations/20261012010000_0231_vellum_billing.sql",
  "utf8",
);
const orgA = "10000000-0000-0000-0000-000000000001",
  orgB = "10000000-0000-0000-0000-000000000002";
const actorA = "20000000-0000-0000-0000-000000000001",
  actorB = "20000000-0000-0000-0000-000000000002";
const contactA = "30000000-0000-0000-0000-000000000001",
  contactB = "30000000-0000-0000-0000-000000000002";
const convA = "40000000-0000-0000-0000-000000000001",
  convB = "40000000-0000-0000-0000-000000000002";
const subA = "50000000-0000-0000-0000-000000000001",
  subB = "50000000-0000-0000-0000-000000000002";
let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
  create role anon; create role authenticated; create role service_role bypassrls;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
  grant usage on schema public,auth to anon,authenticated,service_role;
  grant execute on function auth.uid() to anon,authenticated,service_role;
  create table organizations(id uuid primary key);
  create table contacts(id uuid primary key,organization_id uuid references organizations(id));
  create table conversations(id uuid primary key,organization_id uuid,contact_id uuid,is_group boolean not null default false);
  create table messages(id uuid primary key,organization_id uuid,contact_id uuid,conversation_id uuid,direction text);
  create table memberships(organization_id uuid,actor uuid,role text);
  create function public.fn_role_at_least(org uuid,minrole text) returns boolean language sql stable security definer set search_path='' as $$
    select exists(select 1 from public.memberships where organization_id=org and actor=auth.uid() and role='admin')$$;
  create function public.fn_is_platform_admin() returns boolean language sql stable as $$select false$$;
 `);
  await db.exec(migration);
}, 30000);
afterAll(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.exec(`reset role; select set_config('test.actor','',false);
 truncate billing_webhook_events,billing_conversation_windows,billing_invoices,billing_subscriptions,messages,conversations,contacts,organizations,memberships cascade;
 insert into organizations values('${orgA}'),('${orgB}');
 insert into contacts values('${contactA}','${orgA}'),('${contactB}','${orgB}');
 insert into conversations(id,organization_id,contact_id) values('${convA}','${orgA}','${contactA}'),('${convB}','${orgB}','${contactB}');
 insert into memberships values('${orgA}','${actorA}','admin'),('${orgB}','${actorB}','admin');
 insert into billing_subscriptions(id,organization_id,plan_id,status,monthly_price_cents,included_conversations,setup_price_cents,overage_price_cents,provider_customer_id,provider_subscription_id,period_start,period_end)
 values('${subA}','${orgA}','start','active',39900,200,0,200,'cus_A','sub_A',current_date,current_date+interval '1 month'),
 ('${subB}','${orgB}','growth','active',69900,500,0,200,'cus_B','sub_B',current_date,current_date+interval '1 month');`);
});
async function message(
  org = orgA,
  contact = contactA,
  conversation = convA,
  direction = "inbound",
) {
  await db.query("insert into messages values($1,$2,$3,$4,$5)", [
    randomUUID(),
    org,
    contact,
    conversation,
    direction,
  ]);
}
async function windows() {
  return (
    await db.query<{ n: number }>("select count(*)::int as n from billing_conversation_windows")
  ).rows[0]?.n;
}
async function apply(
  event: string,
  payment: string,
  status: string,
  kind = "monthly",
  amount = 39900,
  due?: string,
  customer = "cus_A",
) {
  return db.query(
    "select fn_billing_apply_payment($1,$2,$3,$4,$5,$6,$7,$8,coalesce($9::date,current_date),$10,null) as result",
    [
      event,
      "PAYMENT_TEST",
      subA,
      payment,
      customer,
      kind === "monthly" ? "sub_A" : null,
      kind,
      amount,
      due ?? null,
      status,
    ],
  );
}
async function state() {
  return (
    await db.query<{ status: string }>("select status from billing_subscriptions where id=$1", [
      subA,
    ])
  ).rows[0]?.status;
}

describe("migration financeira PostgreSQL", () => {
  it("é idempotente e não sobrescreve preços editados", async () => {
    await db.exec("update billing_plans set monthly_price_cents=49900 where id='start'");
    await db.exec(migration);
    expect(
      (
        await db.query<{ monthly_price_cents: number }>(
          "select monthly_price_cents from billing_plans where id='start'",
        )
      ).rows[0]?.monthly_price_cents,
    ).toBe(49900);
  });
  it("isola leitura de assinaturas e recusa DML de cliente/anon e RPC financeiro", async () => {
    await db.exec(`set role authenticated; select set_config('test.actor','${actorA}',false);`);
    expect(
      (
        await db.query<{ organization_id: string }>(
          "select organization_id from billing_subscriptions",
        )
      ).rows.map((r) => r.organization_id),
    ).toEqual([orgA]);
    await expect(db.exec("update billing_subscriptions set status='active'")).rejects.toThrow(
      /permission denied/,
    );
    await expect(apply("evt_forbidden", "pay_A", "paid")).rejects.toThrow(/permission denied/);
    await db.exec(`select set_config('test.actor','${actorB}',false);`);
    expect(
      (
        await db.query<{ organization_id: string }>(
          "select organization_id from billing_subscriptions",
        )
      ).rows.map((r) => r.organization_id),
    ).toEqual([orgB]);
    await db.exec("set role anon;");
    await expect(db.exec("select * from billing_subscriptions")).rejects.toThrow(
      /permission denied/,
    );
    const published = (
      await db.query<{ plans: unknown[] }>("select fn_billing_public_plans() as plans")
    ).rows[0]?.plans;
    expect(published).toHaveLength(4);
    expect(JSON.stringify(published)).not.toContain("ai_budget");
  });
  it("cobra uma janela por contato, inclusive em outro canal; saída/grupo não contam", async () => {
    await message();
    await message();
    await message(orgA, contactA, convA, "outbound");
    const another = randomUUID();
    await db.query("insert into conversations values($1,$2,$3,false)", [another, orgA, contactA]);
    await message(orgA, contactA, another);
    expect(await windows()).toBe(1);
    await db.exec(`update conversations set is_group=true where id='${convB}'`);
    await message(orgB, contactB, convB);
    expect(await windows()).toBe(1);
  });
  it("reabre após 24h e não duplica janela na renovação", async () => {
    await message();
    await db.exec(
      "update billing_subscriptions set period_start=current_date-1 where organization_id='" +
        orgA +
        "'",
    );
    await message();
    expect(await windows()).toBe(1);
    await db.exec(
      "update billing_conversation_windows set opened_at=now()-interval '25 hours',expires_at=now()-interval '1 hour'",
    );
    await message();
    expect(await windows()).toBe(2);
  });
  it("mensagem forjada entre empresas não é medida", async () => {
    await message(orgA, contactB, convB);
    expect(await windows()).toBe(0);
    await message();
    await message(orgB, contactB, convB);
    expect(await windows()).toBe(2);
  });
  it("ativação exige mensalidade e implantação; evento duplicado é neutro", async () => {
    await db.exec(`update billing_subscriptions set status='pending',setup_price_cents=100000 where id='${subA}';
   insert into billing_invoices values('pay_setup','${orgA}','${subA}','setup',100000,current_date,'pending',null,now());`);
    await apply("evt_month", "pay_A", "paid");
    expect(await state()).toBe("pending");
    await apply("evt_setup", "pay_setup", "paid", "setup", 100000);
    expect(await state()).toBe("active");
    await apply("evt_setup_late", "pay_setup", "pending", "setup", 100000);
    expect(await state()).toBe("active");
    const repeated = await apply("evt_month", "pay_A", "paid");
    expect(repeated.rows[0]).toEqual({ result: { duplicate: true } });
    expect(
      (await db.query<{ n: number }>("select count(*)::int as n from billing_webhook_events"))
        .rows[0]?.n,
    ).toBe(3);
  });
  it("vencimentos futuros e eventos antigos não revogam o período pago", async () => {
    await apply("evt_paid", "pay_A", "paid");
    const future = (
      await db.query<{ date: string }>(
        "select to_char(current_date+interval '1 month','YYYY-MM-DD') as date",
      )
    ).rows[0]?.date;
    await apply("evt_future", "pay_next", "pending", "monthly", 39900, future);
    expect(await state()).toBe("active");
    await apply("evt_late", "pay_A", "overdue");
    expect(await state()).toBe("active");
    await apply("evt_refund", "pay_A", "refunded");
    expect(await state()).toBe("past_due");
    await apply("evt_stale_paid", "pay_A", "paid");
    expect(await state()).toBe("past_due");
  });
  it("preço/identidade inválidos deixam zero eventos; implantação desconhecida não ativa", async () => {
    await expect(apply("evt_wrong", "pay_A", "paid", "monthly", 100)).rejects.toThrow(
      /billing_amount/,
    );
    await expect(
      apply("evt_tenant", "pay_A", "paid", "monthly", 39900, undefined, "cus_B"),
    ).rejects.toThrow(/billing_payment_identity/);
    await expect(apply("evt_setup", "pay_unknown", "paid", "setup", 0)).rejects.toThrow(
      /billing_unknown_setup/,
    );
    expect(
      (await db.query<{ n: number }>("select count(*)::int as n from billing_webhook_events"))
        .rows[0]?.n,
    ).toBe(0);
  });
});
