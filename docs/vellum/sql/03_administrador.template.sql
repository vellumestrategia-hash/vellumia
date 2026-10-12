-- Execute DEPOIS do schema completo, no SQL Editor, como postgres.
-- Troque apenas EMAIL_DO_ADMIN pelo e-mail já cadastrado no Supabase Auth.
-- Este script não cria nem redefine senha e não desliga MFA já configurado.
begin;
set local vellum.bootstrap_admin_email = 'EMAIL_DO_ADMIN';

do $bootstrap$
declare
  v_email text := current_setting('vellum.bootstrap_admin_email');
  v_user uuid;
  v_org uuid;
  v_admin_before jsonb;
begin
  if v_email = 'EMAIL_DO_ADMIN' then
    raise exception 'Preencha o e-mail do administrador antes de executar.';
  end if;
  if to_regclass('public.platform_admins') is null
     or to_regclass('public.user_organizations') is null then
    raise exception 'Instale o schema completo antes de conceder acesso.';
  end if;

  select id into strict v_user from auth.users
    where lower(email)=lower(v_email) and email_confirmed_at is not null;
  perform pg_advisory_xact_lock(hashtextextended('vellum-bootstrap-admin',0));

  select id into v_org from public.organizations where slug='vellum-ai';
  if v_org is null then
    insert into public.organizations(slug,legal_name,display_name,locale,created_by)
      values ('vellum-ai','Véllum AI','Véllum AI','pt-BR',v_user)
      returning id into v_org;
  end if;

  insert into public.user_organizations(user_id,organization_id,role,accepted_at)
    values (v_user,v_org,'admin',now())
    on conflict (user_id,organization_id) do update
      set role='admin', revoked_at=null,
          accepted_at=coalesce(public.user_organizations.accepted_at,now());

  select to_jsonb(p) into v_admin_before from public.platform_admins p
    where user_id=v_user;
  insert into public.platform_admins(user_id,granted_by,scope,mfa_required,reason)
    values (v_user,v_user,'full',false,'Bootstrap Véllum AI autorizado pelo proprietário')
    on conflict (user_id) do update
      set scope='full', revoked_at=null, revoked_by=null, revoke_reason=null,
          granted_by=v_user, reason='Bootstrap Véllum AI autorizado pelo proprietário';

  -- Reexecução mantém o MFA do administrador e não duplica o vínculo.
  if v_admin_before is null
     or v_admin_before->>'scope' <> 'full'
     or v_admin_before->>'revoked_at' is not null then
    insert into public.api_audit_log(organization_id,actor_user_id,action,
      resource_type,resource_id,acting_as_platform_admin,bypassed_rls,metadata)
    values (v_org,v_user,'platform_admin.bootstrap','platform_admin',v_user,
      true,true,jsonb_build_object('source','manual_sql','scope','full'));
  end if;
end $bootstrap$;

notify pgrst, 'reload schema';
commit;

select 'Administrador vinculado. Entre na plataforma e conclua a configuração.' as resultado;
