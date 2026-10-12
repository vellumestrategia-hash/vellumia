-- Véllum AI: contratos financeiros, leitura isolada e medição por contato.
-- Aditiva: não backfilla histórico e não altera RLS nem estados do CRM.
create table if not exists public.billing_plans (
  id text primary key check (id ~ '^[a-z][a-z0-9_-]{1,39}$'),
  name text not null check (length(name) between 1 and 80),
  monthly_price_cents integer check (monthly_price_cents >= 0),
  included_conversations integer check (included_conversations >= 0),
  setup_price_cents integer not null default 100000 check (setup_price_cents >= 0),
  overage_price_cents integer not null default 200 check (overage_price_cents >= 0),
  ai_budget_usd_cents integer check (ai_budget_usd_cents >= 100),
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into public.billing_plans (id,name,monthly_price_cents,included_conversations)
values ('start','START',39900,200),('growth','GROWTH',69900,500),
       ('scale','SCALE',99900,1000),('enterprise','ENTERPRISE',null,null)
on conflict (id) do nothing;

create table if not exists public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id),
  plan_id text not null references public.billing_plans(id),
  status text not null default 'pending' check (status in ('pending','active','past_due','canceled')),
  monthly_price_cents integer not null check (monthly_price_cents >= 0),
  included_conversations integer not null check (included_conversations >= 0),
  setup_price_cents integer not null check (setup_price_cents >= 0),
  overage_price_cents integer not null check (overage_price_cents >= 0),
  ai_budget_usd_cents integer check (ai_budget_usd_cents >= 100),
  provider_customer_id text unique,
  provider_subscription_id text unique,
  checkout_state text not null default 'reserved' check (checkout_state in ('reserved','creating','ready','review')),
  setup_paid boolean not null default false,
  period_start date,
  period_end date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  check ((period_start is null and period_end is null) or period_end > period_start)
);

create table if not exists public.billing_invoices (
  provider_payment_id text primary key,
  organization_id uuid not null references public.organizations(id),
  subscription_id uuid not null,
  kind text not null check (kind in ('monthly','setup','overage')),
  amount_cents integer not null check (amount_cents >= 0),
  due_date date not null,
  status text not null check (status in ('pending','paid','overdue','refunded','canceled')),
  invoice_url text,
  updated_at timestamptz not null default now(),
  foreign key (subscription_id, organization_id) references public.billing_subscriptions(id,organization_id)
);
create index if not exists billing_invoices_org_due on public.billing_invoices(organization_id,due_date);
create unique index if not exists billing_setup_once on public.billing_invoices(subscription_id) where kind='setup';

create table if not exists public.billing_webhook_events (
  provider_event_id text primary key,
  provider_payment_id text not null,
  event_type text not null,
  organization_id uuid references public.organizations(id),
  processed_at timestamptz not null default now()
);

create table if not exists public.billing_conversation_windows (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  subscription_id uuid not null,
  contact_id uuid not null references public.contacts(id),
  opening_message_id uuid not null unique references public.messages(id),
  opened_at timestamptz not null,
  expires_at timestamptz not null,
  period_start date not null,
  foreign key (subscription_id, organization_id) references public.billing_subscriptions(id,organization_id),
  check (expires_at = opened_at + interval '24 hours')
);
create index if not exists billing_windows_contact on public.billing_conversation_windows(organization_id,contact_id,expires_at desc);
create index if not exists billing_windows_period on public.billing_conversation_windows(organization_id,period_start);

alter table public.billing_plans enable row level security;
alter table public.billing_subscriptions enable row level security;
alter table public.billing_invoices enable row level security;
alter table public.billing_webhook_events enable row level security;
alter table public.billing_conversation_windows enable row level security;
revoke all on public.billing_plans, public.billing_subscriptions, public.billing_invoices,
  public.billing_webhook_events, public.billing_conversation_windows from public, anon, authenticated;
grant select on public.billing_plans to authenticated;
-- Anon só lê as colunas comerciais. Orçamento interno continua sem privilégio.
grant select (id,name,monthly_price_cents,included_conversations,setup_price_cents,
  overage_price_cents,enabled) on public.billing_plans to anon;
grant select on public.billing_subscriptions, public.billing_invoices, public.billing_conversation_windows to authenticated;
grant all on public.billing_plans, public.billing_subscriptions, public.billing_invoices,
  public.billing_webhook_events, public.billing_conversation_windows to service_role;
drop policy if exists billing_plans_read on public.billing_plans;
create policy billing_plans_read on public.billing_plans for select to authenticated using (true);
drop policy if exists billing_plans_public_read on public.billing_plans;
create policy billing_plans_public_read on public.billing_plans for select to anon using (enabled);
drop policy if exists billing_subscriptions_read on public.billing_subscriptions;
create policy billing_subscriptions_read on public.billing_subscriptions for select to authenticated
 using (public.fn_role_at_least(organization_id,'admin') or public.fn_is_platform_admin());
drop policy if exists billing_invoices_read on public.billing_invoices;
create policy billing_invoices_read on public.billing_invoices for select to authenticated
 using (public.fn_role_at_least(organization_id,'admin') or public.fn_is_platform_admin());
drop policy if exists billing_windows_read on public.billing_conversation_windows;
create policy billing_windows_read on public.billing_conversation_windows for select to authenticated
 using (public.fn_role_at_least(organization_id,'admin') or public.fn_is_platform_admin());

-- Publicação de preços somente: nenhuma coluna de custo/credencial é pública.
create or replace function public.fn_billing_public_plans() returns jsonb
language sql stable security invoker set search_path = '' as $$
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',id,'name',name,'monthly_price_cents',monthly_price_cents,
   'included_conversations',included_conversations,'setup_price_cents',setup_price_cents,
   'overage_price_cents',overage_price_cents) order by monthly_price_cents nulls last),'[]'::jsonb)
 from public.billing_plans where enabled;
$$;
revoke execute on function public.fn_billing_public_plans() from public, anon, authenticated;
grant execute on function public.fn_billing_public_plans() to anon, authenticated, service_role;

-- Recebimento observado no servidor: sent_at do provedor não pode reescrever uma fatura.
create or replace function public.fn_billing_meter_message() returns trigger
language plpgsql security definer set search_path = '' as $$
declare s public.billing_subscriptions; observed timestamptz := clock_timestamp();
begin
 if new.direction <> 'inbound' then return new; end if;
 if not exists (select 1 from public.conversations c join public.contacts p on p.id=c.contact_id
   where c.id=new.conversation_id and c.organization_id=new.organization_id
     and c.contact_id=new.contact_id and p.organization_id=new.organization_id
     and not c.is_group) then return new; end if;
 select * into s from public.billing_subscriptions where organization_id=new.organization_id
   and status='active' and period_start is not null
   and observed >= period_start::timestamp at time zone 'America/Sao_Paulo'
   and observed < period_end::timestamp at time zone 'America/Sao_Paulo';
 if s.id is null then return new; end if;
 perform pg_advisory_xact_lock(hashtextextended(new.organization_id::text||':'||new.contact_id::text,0));
 if exists (select 1 from public.billing_conversation_windows
   where organization_id=new.organization_id and contact_id=new.contact_id and expires_at>observed)
 then return new; end if;
 insert into public.billing_conversation_windows
 (organization_id,subscription_id,contact_id,opening_message_id,opened_at,expires_at,period_start)
 values(new.organization_id,s.id,new.contact_id,new.id,observed,observed+interval '24 hours',s.period_start)
 on conflict (opening_message_id) do nothing;
 return new;
end; $$;
revoke execute on function public.fn_billing_meter_message() from public, anon, authenticated;
grant execute on function public.fn_billing_meter_message() to service_role;
drop trigger if exists trg_billing_meter_message on public.messages;
create trigger trg_billing_meter_message after insert on public.messages
 for each row execute function public.fn_billing_meter_message();

-- A API consulta o pagamento no Asaas antes de chamar. Identidade é resolvida pela
-- referência de assinatura persistida; organization_id nunca vem do webhook.
create or replace function public.fn_billing_apply_payment(
 p_event_id text,p_event_type text,p_subscription uuid,p_payment_id text,p_customer text,
 p_provider_subscription text,p_kind text,p_amount_cents integer,p_due_date date,
 p_status text,p_invoice_url text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.billing_subscriptions; current_invoice public.billing_invoices;
begin
 select * into s from public.billing_subscriptions where id=p_subscription for update;
 if s.id is null or s.provider_customer_id is distinct from p_customer then
   raise exception 'billing_payment_identity' using errcode='42501'; end if;
 if p_kind='monthly' and s.provider_subscription_id is distinct from p_provider_subscription then
   raise exception 'billing_payment_subscription' using errcode='42501'; end if;
 if p_kind='setup' and p_provider_subscription is not null then
   raise exception 'billing_setup_subscription' using errcode='42501'; end if;
 if p_kind not in ('monthly','setup','overage') then raise exception 'billing_kind'; end if;
 if p_kind='setup' and not exists (select 1 from public.billing_invoices where
    provider_payment_id=p_payment_id and subscription_id=s.id and kind='setup') then
   raise exception 'billing_unknown_setup' using errcode='42501'; end if;
 if (p_kind='monthly' and p_amount_cents<>s.monthly_price_cents)
 or (p_kind='setup' and p_amount_cents<>s.setup_price_cents) then raise exception 'billing_amount'; end if;
 if exists (select 1 from public.billing_invoices where provider_payment_id=p_payment_id
   and subscription_id<>s.id) then raise exception 'billing_payment_rebound' using errcode='42501'; end if;
 insert into public.billing_webhook_events(provider_event_id,provider_payment_id,event_type,organization_id)
 values(p_event_id,p_payment_id,p_event_type,s.organization_id) on conflict do nothing;
 if not found then return jsonb_build_object('duplicate',true); end if;
 insert into public.billing_invoices(provider_payment_id,organization_id,subscription_id,kind,amount_cents,due_date,status,invoice_url)
 values(p_payment_id,s.organization_id,s.id,p_kind,p_amount_cents,p_due_date,p_status,p_invoice_url)
 on conflict(provider_payment_id) do update set status=case
   when billing_invoices.status='refunded' then 'refunded'
   when billing_invoices.status in ('paid','refunded') and excluded.status in ('pending','overdue')
     then billing_invoices.status else excluded.status end,
   invoice_url=excluded.invoice_url,updated_at=now();
 if p_kind='setup' then update public.billing_subscriptions set setup_paid=exists(
   select 1 from public.billing_invoices where subscription_id=s.id and kind='setup' and status='paid') where id=s.id; end if;
 select * into current_invoice from public.billing_invoices where subscription_id=s.id and kind='monthly'
   and due_date <= (now() at time zone 'America/Sao_Paulo')::date
   order by due_date desc,provider_payment_id desc limit 1;
 if current_invoice.provider_payment_id is not null and s.status<>'canceled' then
   update public.billing_subscriptions set
     status=case when current_invoice.status='paid' and (setup_paid or setup_price_cents=0) then 'active'
       when current_invoice.status in ('overdue','refunded') then 'past_due' else 'pending' end,
     period_start=case when current_invoice.status='paid' then current_invoice.due_date else period_start end,
     period_end=case when current_invoice.status='paid' then (current_invoice.due_date+interval '1 month')::date else period_end end,
     updated_at=now() where id=s.id;
 end if;
 return jsonb_build_object('duplicate',false,'subscription_id',s.id);
end; $$;
revoke execute on function public.fn_billing_apply_payment(text,text,uuid,text,text,text,text,integer,date,text,text) from public, anon, authenticated;
grant execute on function public.fn_billing_apply_payment(text,text,uuid,text,text,text,text,integer,date,text,text) to service_role;
