-- Implementação interna: service role escreve; somente full ativo + MFA lê.
-- Não adiciona fila, RPC privilegiada nem fonte de conhecimento pendente.
create unique index if not exists ai_agents_id_org_implementation_fk on public.ai_agents(id,organization_id);
create unique index if not exists ai_sources_id_org_implementation_fk on public.ai_knowledge_sources(id,organization_id);
create unique index if not exists ai_versions_id_agent_org_implementation_fk on public.ai_agent_versions(id,agent_id,organization_id);

create table if not exists public.agent_implementations (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null unique references public.organizations(id) on delete cascade,
 revision integer not null default 1 check (revision>0),
 knowledge_revision integer not null default 1 check (knowledge_revision>0),
 status text not null default 'draft' check (status in ('draft','review','ready')),
 brief jsonb not null default '{}'::jsonb check (jsonb_typeof(brief)='object' and octet_length(brief::text)<=150000),
 source_id uuid, agent_id uuid, draft_version_id uuid,
 approved_revision integer, approved_hash text,
 indexed_revision integer, indexed_hash text,
 index_status text not null default 'pending' check (index_status in ('pending','indexing','success','failed')),
 config_revision integer, tested_revision integer, finalized_revision integer,
 test_records jsonb not null default '[]'::jsonb check (jsonb_typeof(test_records)='array' and jsonb_array_length(test_records)<=100),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(id,organization_id),
 foreign key (source_id,organization_id) references public.ai_knowledge_sources(id,organization_id),
 foreign key (agent_id,organization_id) references public.ai_agents(id,organization_id),
 foreign key (draft_version_id,agent_id,organization_id) references public.ai_agent_versions(id,agent_id,organization_id),
 check (draft_version_id is null or agent_id is not null),
 check ((approved_hash is null and approved_revision is null) or (approved_hash is not null and approved_revision is not null and approved_hash ~ '^[a-f0-9]{64}$' and approved_revision=knowledge_revision)),
 check ((indexed_hash is null and indexed_revision is null) or (indexed_hash is not null and indexed_revision is not null and approved_hash is not null and indexed_hash=approved_hash and indexed_revision=knowledge_revision)),
 check (index_status<>'success' or (indexed_hash is not null and indexed_revision is not null)),
 check (config_revision is null or config_revision=revision),
 check (tested_revision is null or tested_revision=revision),
 check (finalized_revision is null or (finalized_revision=revision and tested_revision is not null and tested_revision=revision)),
 check (status<>'ready' or (finalized_revision is not null and finalized_revision=revision))
);
create table if not exists public.agent_implementation_imports (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 implementation_id uuid not null, kind text not null check (kind in ('site','file')),
 site_url text, blob_path text, source_name text,
 requested_by uuid not null references auth.users(id),
 idempotency_key uuid not null, request_hash text not null check (request_hash ~ '^[a-f0-9]{64}$'),
 status text not null default 'queued' check (status in ('queued','running','succeeded','failed')),
 attempts integer not null default 0, max_attempts integer not null default 3 check (max_attempts between 1 and 3),
 lease_token uuid, lease_expires_at timestamptz, deadline_at timestamptz,
 next_attempt_at timestamptz not null default now(), content_hash text check (content_hash ~ '^[a-f0-9]{64}$'),
 error_code text check (error_code ~ '^[a-z][a-z0-9_]{0,79}$'), warnings jsonb not null default '[]'::jsonb check (jsonb_typeof(warnings)='array' and jsonb_array_length(warnings)<=100),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(id,organization_id), unique(id,implementation_id,organization_id), unique(organization_id,idempotency_key),
 foreign key (implementation_id,organization_id) references public.agent_implementations(id,organization_id) on delete cascade,
 check (attempts between 0 and max_attempts),
 check ((kind='site' and site_url is not null and length(site_url)<=2048 and blob_path is null)
   or (kind='file' and site_url is null and source_name is not null and blob_path is not null
       and blob_path like organization_id::text||'/implementation-pending/%')),
 check ((status='running' and attempts>0 and lease_token is not null and deadline_at is not null and lease_expires_at is not null
   and deadline_at<=lease_expires_at and lease_expires_at<=updated_at+interval '4 minutes')
   or (status<>'running' and lease_token is null and deadline_at is null and lease_expires_at is null))
);
create unique index if not exists agent_implementation_one_running on public.agent_implementation_imports((1)) where status='running';
create index if not exists agent_implementation_imports_org on public.agent_implementation_imports(organization_id,created_at desc);

create table if not exists public.agent_implementation_facts (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 implementation_id uuid not null, import_id uuid,
 category text not null check (category in ('company','segment','products_services','prices','hours','scheduling','service_area','contacts','differentiators','payment_methods','policies','commercial_conditions','faq')),
 key text not null check (length(key) between 1 and 120), original_value text not null check (length(original_value) between 1 and 4000),
 original_hash text not null check (original_hash ~ '^[a-f0-9]{64}$'), evidence_quote text check (length(evidence_quote) between 8 and 1000),
 source_url text check (length(source_url)<=2048), source_name text check (length(source_name)<=255), captured_at timestamptz not null,
 reviewed_value text check (length(reviewed_value) between 1 and 4000),
 review_status text not null default 'pending' check (review_status in ('pending','approved','rejected','deleted')),
 is_manual boolean not null default false, sensitive_confirmed boolean not null default false,
 reviewed_by uuid references auth.users(id), reviewed_at timestamptz, review_note text check (length(review_note)<=2000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(id,organization_id), unique(implementation_id,organization_id,original_hash),
 foreign key (implementation_id,organization_id) references public.agent_implementations(id,organization_id) on delete cascade,
 foreign key (import_id,implementation_id,organization_id) references public.agent_implementation_imports(id,implementation_id,organization_id),
 check (source_url is not null or source_name is not null),
 check (import_id is null or evidence_quote is not null),
 check (review_status<>'approved' or (reviewed_value is not null and reviewed_by is not null and reviewed_at is not null)),
 check (review_status<>'approved' or category not in ('prices','hours','scheduling','payment_methods','policies','commercial_conditions') or sensitive_confirmed)
);
create unique index if not exists agent_implementation_approved_key on public.agent_implementation_facts(implementation_id,organization_id,category,key) where review_status='approved';
create index if not exists agent_implementation_facts_org on public.agent_implementation_facts(organization_id,implementation_id);

alter table public.agent_implementations enable row level security;
alter table public.agent_implementation_imports enable row level security;
alter table public.agent_implementation_facts enable row level security;
revoke all on public.agent_implementations, public.agent_implementation_imports, public.agent_implementation_facts from public,anon,authenticated;
grant select on public.agent_implementations, public.agent_implementation_imports, public.agent_implementation_facts to authenticated;
grant all on public.agent_implementations, public.agent_implementation_imports to service_role;
-- Tombstones preservam recusa/exclusão, inclusive durante reimportações.
revoke delete,truncate on public.agent_implementation_facts from service_role;
grant select,insert,update on public.agent_implementation_facts to service_role;
drop policy if exists implementation_full_read on public.agent_implementations;
create policy implementation_full_read on public.agent_implementations for select to authenticated using (
 exists(select 1 from public.platform_admins pa where pa.user_id=auth.uid() and pa.revoked_at is null and pa.scope='full'
 and (not pa.mfa_required or auth.jwt()->>'aal'='aal2')));
drop policy if exists implementation_full_read on public.agent_implementation_imports;
create policy implementation_full_read on public.agent_implementation_imports for select to authenticated using (
 exists(select 1 from public.platform_admins pa where pa.user_id=auth.uid() and pa.revoked_at is null and pa.scope='full'
 and (not pa.mfa_required or auth.jwt()->>'aal'='aal2')));
drop policy if exists implementation_full_read on public.agent_implementation_facts;
create policy implementation_full_read on public.agent_implementation_facts for select to authenticated using (
 exists(select 1 from public.platform_admins pa where pa.user_id=auth.uid() and pa.revoked_at is null and pa.scope='full'
 and (not pa.mfa_required or auth.jwt()->>'aal'='aal2')));

-- Restritiva: compõe com as policies históricas sem limitar documentos comuns.
drop policy if exists implementation_pending_private on storage.objects;
create policy implementation_pending_private on storage.objects as restrictive for all to authenticated
 using (bucket_id<>'ai-policy' or split_part(name,'/',2)<>'implementation-pending')
 with check (bucket_id<>'ai-policy' or split_part(name,'/',2)<>'implementation-pending');

-- Origem imutável: revisão humana mora em reviewed_value, nunca na citação.
create or replace function public.fn_implementation_fact_original() returns trigger
language plpgsql set search_path='' as $$
begin
 if row(new.organization_id,new.implementation_id,new.import_id,new.category,new.key,new.original_value,new.original_hash,new.evidence_quote,new.source_url,new.source_name,new.captured_at)
 is distinct from row(old.organization_id,old.implementation_id,old.import_id,old.category,old.key,old.original_value,old.original_hash,old.evidence_quote,old.source_url,old.source_name,old.captured_at)
 then raise exception 'implementation_original_immutable' using errcode='23514'; end if;
 new.updated_at:=clock_timestamp(); return new;
end; $$;
revoke all on function public.fn_implementation_fact_original() from public,anon,authenticated,service_role;
drop trigger if exists implementation_fact_original on public.agent_implementation_facts;
create trigger implementation_fact_original before update on public.agent_implementation_facts for each row execute function public.fn_implementation_fact_original();

-- Mesmo writes tardios do serviço invalidam índice + estado na transação do fato.
create or replace function public.fn_implementation_fact_changed() returns trigger
language plpgsql set search_path='' as $$
declare i public.agent_implementations; f public.agent_implementation_facts; changed boolean;
begin
 if tg_op='DELETE' then f:=old; else f:=new; end if;
 if tg_op='INSERT' then changed:=new.review_status='approved';
 elsif tg_op='DELETE' then changed:=old.review_status='approved';
 else changed:=(old.review_status='approved' or new.review_status='approved') and
 row(old.review_status,old.reviewed_value,old.is_manual) is distinct from row(new.review_status,new.reviewed_value,new.is_manual); end if;
 -- Fatos pendentes/recusados e notas não alteram o comportamento aprovado.
 if not changed then return f; end if;
 update public.agent_implementations set revision=revision+1,status='review',config_revision=null,tested_revision=null,finalized_revision=null,
   knowledge_revision=knowledge_revision+1,approved_hash=null,approved_revision=null,
   indexed_hash=null,indexed_revision=null,index_status='pending',updated_at=clock_timestamp()
 where id=f.implementation_id and organization_id=f.organization_id returning * into i;
 if i.source_id is not null then
   update public.ai_knowledge_sources set active_kb_version_id=null,last_index_status=null,last_indexed_at=null,chunks_count=0,
   source_metadata=(source_metadata-'content_hash')||jsonb_build_object('implementation',jsonb_build_object('id',i.id,'revision',i.knowledge_revision,'approved_hash',null)),updated_at=clock_timestamp()
   where id=i.source_id and organization_id=i.organization_id;
 end if;
 return f;
end; $$;
revoke all on function public.fn_implementation_fact_changed() from public,anon,authenticated,service_role;
drop trigger if exists implementation_fact_changed on public.agent_implementation_facts;
create trigger implementation_fact_changed after insert or update or delete on public.agent_implementation_facts for each row execute function public.fn_implementation_fact_changed();

create or replace function public.fn_implementation_brief_changed() returns trigger
language plpgsql set search_path='' as $$
begin
 if new.brief is distinct from old.brief then
   new.revision:=old.revision+1; new.status:='review'; new.config_revision:=null; new.tested_revision:=null; new.finalized_revision:=null;
 end if;
 new.updated_at:=clock_timestamp(); return new;
end; $$;
revoke all on function public.fn_implementation_brief_changed() from public,anon,authenticated,service_role;
drop trigger if exists implementation_brief_changed on public.agent_implementations;
create trigger implementation_brief_changed before update on public.agent_implementations for each row execute function public.fn_implementation_brief_changed();

-- Solicitação imutável: o worker carrega o recibo, nunca a URL/ator do evento.
create or replace function public.fn_implementation_import_original() returns trigger
language plpgsql set search_path='' as $$
begin
 if row(new.organization_id,new.implementation_id,new.kind,new.site_url,new.blob_path,new.source_name,new.requested_by,new.idempotency_key,new.request_hash,new.max_attempts)
 is distinct from row(old.organization_id,old.implementation_id,old.kind,old.site_url,old.blob_path,old.source_name,old.requested_by,old.idempotency_key,old.request_hash,old.max_attempts)
 then raise exception 'implementation_import_immutable' using errcode='23514'; end if;
 return new;
end; $$;
revoke all on function public.fn_implementation_import_original() from public,anon,authenticated,service_role;
drop trigger if exists implementation_import_original on public.agent_implementation_imports;
create trigger implementation_import_original before update on public.agent_implementation_imports for each row execute function public.fn_implementation_import_original();
