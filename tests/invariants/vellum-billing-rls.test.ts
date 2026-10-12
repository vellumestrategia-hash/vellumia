import { beforeAll, describe, expect, it } from "vitest";

import { countAs, lastLine, sql } from "./gov-helpers";
import { motivoDoErro } from "./psql-transporte";

function permissionDenied(script: string) {
  let failure: unknown;
  try {
    sql(script);
  } catch (err) {
    failure = err;
  }
  expect(failure).toBeDefined();
  expect(motivoDoErro(failure)).toMatch(/permission denied/);
}

const orgA = "02310000-0000-4000-8000-000000000001";
const orgB = "02310000-0000-4000-8000-000000000002";
const adminA = "02310000-1111-4000-8000-000000000001";
const adminB = "02310000-1111-4000-8000-000000000002";
const agentA = "02310000-1111-4000-8000-000000000003";
const privateTables = ["billing_subscriptions", "billing_invoices", "billing_conversation_windows"];

// Baseline inteiro em PostgreSQL 15: roles e JWT reais, sem mocks de RLS.
beforeAll(() => {
  sql(`
    set timezone = 'America/Sao_Paulo';
    insert into public.organizations(id,slug,legal_name,display_name) values
      ('${orgA}','billing-rls-a','Billing A LTDA','Billing A'),
      ('${orgB}','billing-rls-b','Billing B LTDA','Billing B');
    insert into auth.users(id,email) values
      ('${adminA}','billing-a@invariant.test'),
      ('${adminB}','billing-b@invariant.test'),
      ('${agentA}','billing-agent@invariant.test');
    insert into public.user_organizations(user_id,organization_id,role,accepted_at) values
      ('${adminA}','${orgA}','admin',now()),
      ('${adminB}','${orgB}','admin',now()),
      ('${agentA}','${orgA}','agent',now());
    do $seed$
    declare
      org uuid; sub uuid; contact uuid; session uuid; conversation uuid; message uuid;
    begin
      foreach org in array array['${orgA}'::uuid,'${orgB}'::uuid] loop
        insert into public.billing_subscriptions(organization_id,plan_id,status,monthly_price_cents,
          included_conversations,setup_price_cents,overage_price_cents,period_start,period_end)
          values(org,'start','active',39900,200,100000,200,current_date,current_date+interval '1 month')
          returning id into sub;
        insert into public.billing_invoices(provider_payment_id,organization_id,subscription_id,
          kind,amount_cents,due_date,status)
          values('pay_'||org,org,sub,'monthly',39900,current_date,'paid');
        insert into public.channel_sessions(organization_id,waha_session_name,webhook_secret_encrypted)
          values(org,'billing_'||org,'\\x00'::bytea) returning id into session;
        insert into public.contacts(organization_id,display_name)
          values(org,'Billing RLS contact') returning id into contact;
        insert into public.conversations(organization_id,contact_id,channel_session_id)
          values(org,contact,session) returning id into conversation;
        insert into public.messages(organization_id,conversation_id,channel_session_id,contact_id,
          type,direction,body) values(org,conversation,session,contact,'text','inbound','billing probe')
          returning id into message;
        insert into public.billing_webhook_events(provider_event_id,provider_payment_id,event_type,organization_id)
          values('evt_'||org,'pay_'||org,'PAYMENT_CONFIRMED',org);
      end loop;
    end $seed$;
  `);
});

describe("financeiro: isolamento e privilégios no baseline completo", () => {
  it.each(privateTables)("%s: administrador só lê a própria empresa nos dois sentidos", (table) => {
    for (const [admin, own, foreign] of [
      [adminA, orgA, orgB],
      [adminB, orgB, orgA],
    ] as const) {
      expect(
        countAs(admin, `select count(*) from public.${table} where organization_id='${own}';`),
      ).toBe(1);
      expect(
        countAs(admin, `select count(*) from public.${table} where organization_id='${foreign}';`),
      ).toBe(0);
    }
    expect(countAs(agentA, `select count(*) from public.${table};`)).toBe(0);
  });

  it.each(privateTables)("%s: escrita de cliente e leitura anônima negadas", (table) => {
    permissionDenied(`set role authenticated; select set_config('request.jwt.claims','{"sub":"${adminA}"}',false);
      delete from public.${table} where organization_id='${orgA}';`);
    permissionDenied(`set role anon; select * from public.${table};`);
  });

  it("recibos de webhook só são acessíveis ao serviço, inclusive com JWT admin", () => {
    expect(
      lastLine(sql("set role service_role; select count(*) from public.billing_webhook_events;")),
    ).toBe("2");
    for (const admin of [adminA, adminB]) {
      permissionDenied(`set role authenticated; select set_config('request.jwt.claims','{"sub":"${admin}"}',false);
        select * from public.billing_webhook_events;`);
    }
    permissionDenied("set role anon; select * from public.billing_webhook_events;");
  });

  it("catálogo público usa privilégios do chamador e não revela orçamento interno", () => {
    expect(
      sql(
        "select prosecdef from pg_proc where oid='public.fn_billing_public_plans()'::regprocedure;",
      ),
    ).toBe("f");
    const plans = JSON.parse(
      lastLine(sql("set role anon; select public.fn_billing_public_plans();")),
    ) as Array<Record<string, unknown>>;
    expect(plans).toHaveLength(4);
    expect(Object.keys(plans[0]!).sort()).toEqual(
      [
        "id",
        "name",
        "monthly_price_cents",
        "included_conversations",
        "setup_price_cents",
        "overage_price_cents",
      ].sort(),
    );
    permissionDenied("set role anon; select ai_budget_usd_cents from public.billing_plans;");
    permissionDenied("set role anon; update public.billing_plans set monthly_price_cents=0;");
    sql("update public.billing_plans set enabled=false where id='enterprise';");
    expect(
      JSON.parse(lastLine(sql("set role anon; select public.fn_billing_public_plans();"))),
    ).toHaveLength(3);
  });
});
