-- Execute no SQL Editor do projeto Supabase da Véllum AI, como postgres.
-- Pré-requisitos da instalação inicial; preserva usuários existentes.
begin;

do $$
begin
  if to_regclass('auth.users') is null or to_regprocedure('auth.uid()') is null then
    raise exception 'Este script requer um projeto Supabase.';
  end if;
  if to_regclass('public.organizations') is not null then
    raise exception 'O schema já está instalado. Use as migrations de atualização.';
  end if;
end $$;

create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists vector with schema public;
create extension if not exists citext with schema public;
create extension if not exists pg_trgm with schema public;

do $$
begin
  if to_regtype('public.vector') is null
     or to_regtype('public.citext') is null
     or not exists (
       select 1 from pg_opclass c join pg_namespace n on n.oid=c.opcnamespace
       where n.nspname='public' and c.opcname='gin_trgm_ops'
     ) then
    raise exception 'vector, citext e pg_trgm precisam estar no schema public. Não foi movida nenhuma extensão existente.';
  end if;
end $$;

commit;
select 'Pré-requisitos instalados. Execute agora o schema completo.' as resultado;
