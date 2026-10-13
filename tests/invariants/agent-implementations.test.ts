import { beforeAll, describe, expect, it } from "vitest";
import { lastLine, sql } from "./gov-helpers";
import { motivoDoErro } from "./psql-transporte";

const orgA = "02330000-0000-4000-8000-000000000001",
  orgB = "02330000-0000-4000-8000-000000000002";
const customerA = "02330000-1111-4000-8000-000000000001",
  customerB = "02330000-1111-4000-8000-000000000002";
const full = "02330000-1111-4000-8000-000000000003",
  support = "02330000-1111-4000-8000-000000000004";
const revoked = "02330000-1111-4000-8000-000000000005",
  mfa = "02330000-1111-4000-8000-000000000006";
const implA = "02330000-2222-4000-8000-000000000001",
  implB = "02330000-2222-4000-8000-000000000002";
const jobA = "02330000-3333-4000-8000-000000000001",
  jobB = "02330000-3333-4000-8000-000000000002";
const factA = "02330000-4444-4000-8000-000000000001",
  factB = "02330000-4444-4000-8000-000000000002";
const sourceA = "02330000-5555-4000-8000-000000000001",
  sourceB = "02330000-5555-4000-8000-000000000002";
const version = "02330000-6666-4000-8000-000000000001";
const agentA = "02330000-7777-4000-8000-000000000001",
  agentB = "02330000-7777-4000-8000-000000000002";
const channelA = "02330000-8888-4000-8000-000000000001",
  channelB = "02330000-8888-4000-8000-000000000002";
const draftA = "02330000-9999-4000-8000-000000000001",
  draftB = "02330000-9999-4000-8000-000000000002";
const tables = [
  "agent_implementations",
  "agent_implementation_imports",
  "agent_implementation_facts",
];
function claims(user: string, aal = "aal1") {
  return `set role authenticated; select set_config('request.jwt.claims','{"sub":"${user}","aal":"${aal}"}',false);`;
}
function count(user: string, query: string, aal = "aal1") {
  return Number(lastLine(sql(`${claims(user, aal)} ${query}`)));
}
function denied(script: string, reason = /permission denied|row-level security/) {
  let failure: unknown;
  try {
    sql(script);
  } catch (error) {
    failure = error;
  }
  expect(failure).toBeDefined();
  expect(motivoDoErro(failure)).toMatch(reason);
}
function seedCurrentApprovedKnowledge() {
  return `update public.agent_implementation_facts set reviewed_value='A',review_status='approved',reviewed_by='${full}',reviewed_at=now() where organization_id='${orgA}' and id='${factA}';
    update public.agent_implementations set source_id='${sourceA}',approved_hash=repeat('a',64),approved_revision=knowledge_revision,
      indexed_hash=repeat('a',64),indexed_revision=knowledge_revision,index_status='success',config_revision=revision,tested_revision=revision,finalized_revision=revision,status='ready' where organization_id='${orgA}';
    update public.ai_knowledge_sources s set active_kb_version_id='${version}',last_index_status='success',last_indexed_at=now(),chunks_count=1,
      source_metadata=jsonb_build_object('content_hash',repeat('a',64),'implementation',jsonb_build_object('id','${implA}','revision',i.knowledge_revision,'approved_hash',repeat('a',64)))
      from public.agent_implementations i where s.organization_id='${orgA}' and s.id='${sourceA}' and i.organization_id=s.organization_id and i.id='${implA}';
    do $seed$ begin
      if not exists(select 1 from public.agent_implementations i join public.ai_knowledge_sources s on s.id=i.source_id and s.organization_id=i.organization_id where i.organization_id='${orgA}'
        and i.status='ready' and i.config_revision=i.revision and i.tested_revision=i.revision and i.finalized_revision=i.revision
        and i.approved_revision=i.knowledge_revision and i.indexed_revision=i.knowledge_revision and i.index_status='success'
        and i.approved_hash=repeat('a',64) and i.indexed_hash=repeat('a',64) and s.active_kb_version_id='${version}'
        and s.last_index_status='success' and s.last_indexed_at is not null and s.chunks_count=1
        and s.source_metadata->>'content_hash'=repeat('a',64) and s.source_metadata->'implementation'->>'approved_hash'=repeat('a',64)) then raise exception 'current approved/indexed/tested/finalized seed missing'; end if;
    end $seed$;`;
}
beforeAll(() => {
  sql(`insert into public.organizations(id,slug,legal_name,display_name) values
    ('${orgA}','implementation-invariant-a','Implementation A','Implementation A'),
    ('${orgB}','implementation-invariant-b','Implementation B','Implementation B');
    insert into auth.users(id,email) values ${[customerA, customerB, full, support, revoked, mfa].map((id, i) => `('${id}','implementation-${i}@invariant.test')`).join(",")};
    insert into public.user_organizations(user_id,organization_id,role,accepted_at) values
    ('${customerA}','${orgA}','admin',now()),('${customerB}','${orgB}','admin',now());
    insert into public.platform_admins(user_id,scope,mfa_required,granted_by,revoked_at,reason) values
    ('${full}','full',false,'${full}',null,'Invariant 0233 full-global reader'),
    ('${support}','support_readonly',false,'${full}',null,'Invariant 0233 support denied'),
    ('${revoked}','full',false,'${full}',now(),'Invariant 0233 revoked admin denied'),
    ('${mfa}','full',true,'${full}',null,'Invariant 0233 MFA assurance required');
    insert into public.agent_implementations(id,organization_id) values ('${implA}','${orgA}'),('${implB}','${orgB}');
    insert into public.agent_implementation_imports(id,organization_id,implementation_id,kind,site_url,requested_by,idempotency_key,request_hash) values
    ('${jobA}','${orgA}','${implA}','site','https://example.com/','${full}','${jobA}',repeat('a',64)),
    ('${jobB}','${orgB}','${implB}','site','https://example.org/','${full}','${jobB}',repeat('b',64));
    insert into public.agent_implementation_facts(id,organization_id,implementation_id,import_id,category,key,original_value,original_hash,evidence_quote,source_url,captured_at) values
    ('${factA}','${orgA}','${implA}','${jobA}','company','name','A',repeat('a',64),'Empresa A de teste','https://example.com/',now()),
    ('${factB}','${orgB}','${implB}','${jobB}','company','name','B',repeat('b',64),'Empresa B de teste','https://example.org/',now());
    insert into public.ai_knowledge_sources(id,organization_id,source_type,name) values
    ('${sourceA}','${orgA}','documento','Implementação A'),('${sourceB}','${orgB}','documento','Implementação B');
    insert into public.ai_knowledge_versions(id,organization_id,version_number) values('${version}','${orgA}',1);
    insert into public.ai_agents(id,organization_id,name,system_prompt) values('${agentA}','${orgA}','Implementation A','fixture'),('${agentB}','${orgB}','Implementation B','fixture');
    insert into public.channel_sessions(id,organization_id,waha_session_name,api_key_encrypted) values('${channelA}','${orgA}','implementation_a','\\x00'::bytea),('${channelB}','${orgB}','implementation_b','\\x00'::bytea);
    insert into public.ai_agent_versions(id,organization_id,agent_id,version_number,system_prompt,provider,model,channel_session_id) values
      ('${draftA}','${orgA}','${agentA}',1,'fixture','openai','gpt-4o-mini','${channelA}'),('${draftB}','${orgB}','${agentB}',1,'fixture','openai','gpt-4o-mini','${channelB}');
    insert into storage.objects(bucket_id,name) values
    ('ai-policy','${orgA}/implementation-pending/test.txt'),('ai-policy','${orgB}/implementation-pending/test.txt'),
    ('ai-policy','${orgA}/historical.txt'),('ai-policy','${orgB}/historical.txt');`);
});
describe("0233: implementação interna, isolamento e MFA no banco real", () => {
  it.each(tables)("%s: cliente não lê nem a própria organização A/B; full vê ambas", (table) => {
    for (const user of [customerA, customerB, support, revoked]) {
      expect(
        count(user, `select count(*) from public.${table} where organization_id='${orgA}';`),
      ).toBe(0);
      expect(
        count(user, `select count(*) from public.${table} where organization_id='${orgB}';`),
      ).toBe(0);
    }
    for (const org of [orgA, orgB]) {
      expect(
        count(full, `select count(*) from public.${table} where organization_id='${org}';`),
      ).toBe(1);
      expect(
        count(mfa, `select count(*) from public.${table} where organization_id='${org}';`, "aal1"),
      ).toBe(0);
      expect(
        count(mfa, `select count(*) from public.${table} where organization_id='${org}';`, "aal2"),
      ).toBe(1);
    }
  });
  it.each(tables)("%s: DML de JWT full/cliente e leitura anon negados", (table) => {
    for (const user of [full, customerA, customerB])
      for (const command of [
        `delete from public.${table} where organization_id='${orgA}';`,
        `update public.${table} set organization_id='${orgB}' where organization_id='${orgA}';`,
      ])
        denied(claims(user) + command);
    denied(`set role anon; select * from public.${table};`);
    expect(
      Number(
        lastLine(
          sql(
            `set role service_role; select count(*) from public.${table} where organization_id in ('${orgA}','${orgB}');`,
          ),
        ),
      ),
    ).toBe(2);
  });
  it("FKs rejeitam import, fato e fonte de outro tenant nos dois sentidos", () => {
    for (const [org, own, foreign, job] of [
      [orgA, implA, implB, jobB],
      [orgB, implB, implA, jobA],
    ]) {
      denied(
        `begin; set role service_role; insert into public.agent_implementation_imports(organization_id,implementation_id,kind,site_url,requested_by,idempotency_key,request_hash)
        values('${org}','${foreign}','site','https://example.com/','${full}',gen_random_uuid(),repeat('c',64)); rollback;`,
        /foreign key/,
      );
      denied(
        `begin; set role service_role; insert into public.agent_implementation_facts(organization_id,implementation_id,import_id,category,key,original_value,original_hash,evidence_quote,source_name,captured_at)
        values('${org}','${own}','${job}','company','foreign','X',repeat('c',64),'Empresa X de teste','fixture',now()); rollback;`,
        /foreign key/,
      );
    }
    denied(
      `begin; set role service_role; update public.agent_implementations set source_id='${sourceB}' where organization_id='${orgA}'; rollback;`,
      /foreign key/,
    );
    for (const [org, ownAgent, foreignAgent, foreignDraft] of [
      [orgA, agentA, agentB, draftB],
      [orgB, agentB, agentA, draftA],
    ]) {
      denied(
        `begin; set role service_role; update public.agent_implementations set agent_id='${foreignAgent}' where organization_id='${org}'; rollback;`,
        /foreign key/,
      );
      denied(
        `begin; set role service_role; update public.agent_implementations set agent_id='${ownAgent}',draft_version_id='${foreignDraft}' where organization_id='${org}'; rollback;`,
        /foreign key/,
      );
    }
  });
  it("Storage pendente é privado para authenticated inclusive full; histórico conserva leitura tenant", () => {
    for (const user of [customerA, customerB, full, mfa])
      expect(
        count(
          user,
          "select count(*) from storage.objects where bucket_id='ai-policy' and name like '%/implementation-pending/%';",
          "aal2",
        ),
      ).toBe(0);
    expect(
      count(
        customerA,
        `select count(*) from storage.objects where bucket_id='ai-policy' and name='${orgA}/historical.txt';`,
      ),
    ).toBe(1);
    expect(
      count(
        customerA,
        `select count(*) from storage.objects where bucket_id='ai-policy' and name='${orgB}/historical.txt';`,
      ),
    ).toBe(0);
    denied(
      `${claims(customerA)} insert into storage.objects(bucket_id,name) values('ai-policy','${orgA}/implementation-pending/new.txt');`,
    );
    expect(
      lastLine(
        sql(
          `${claims(customerA)} with d as (delete from storage.objects where bucket_id='ai-policy' and name='${orgA}/implementation-pending/test.txt' returning 1) select count(*) from d;`,
        ),
      ),
    ).toBe("0");
    expect(
      lastLine(
        sql(`begin; set role service_role; insert into storage.objects(bucket_id,name) values('ai-policy','${orgA}/implementation-pending/service.txt');
      select count(*) from storage.objects where bucket_id='ai-policy' and name like '${orgA}/implementation-pending/%'; rollback;`),
      ),
    ).toBe("2");
  });
  it("brief invalida comportamento e preserva conhecimento aprovado inalterado", () => {
    sql(`begin; set role service_role;
      ${seedCurrentApprovedKnowledge()}
      update public.agent_implementations set brief='{"purpose":"Atender"}' where organization_id='${orgA}';
      do $proof$ begin
        if not exists(select 1 from public.agent_implementations i join public.ai_knowledge_sources s on s.id=i.source_id and s.organization_id=i.organization_id where i.organization_id='${orgA}'
          and i.tested_revision is null and i.finalized_revision is null and i.indexed_hash=repeat('a',64) and s.active_kb_version_id='${version}') then raise exception 'brief lost unchanged knowledge'; end if;
      end $proof$;
      rollback;`);
  });
  it.each([
    {
      mutation: "correção",
      changes: "reviewed_value='Corrigido',is_manual=true",
      status: "approved",
    },
    { mutation: "remoção", changes: "review_status='deleted'", status: "deleted" },
  ])(
    "$mutation de fato aprovado invalida revisões/hash/ponteiro previamente atuais",
    ({ changes, status }) => {
      sql(`begin; set role service_role;
      ${seedCurrentApprovedKnowledge()}
      do $proof$ declare prior_revision integer; prior_knowledge_revision integer; begin
        select revision,knowledge_revision into strict prior_revision,prior_knowledge_revision from public.agent_implementations where organization_id='${orgA}' and id='${implA}';
        update public.agent_implementation_facts set ${changes} where organization_id='${orgA}' and implementation_id='${implA}' and id='${factA}';
        if not exists(select 1 from public.agent_implementations i join public.ai_knowledge_sources s on s.id=i.source_id and s.organization_id=i.organization_id where i.organization_id='${orgA}'
          and i.revision=prior_revision+1 and i.knowledge_revision=prior_knowledge_revision+1 and i.status='review'
          and i.approved_hash is null and i.approved_revision is null and i.indexed_hash is null and i.indexed_revision is null and i.index_status='pending'
          and i.config_revision is null and i.tested_revision is null and i.finalized_revision is null and s.active_kb_version_id is null
          and s.last_index_status is null and s.last_indexed_at is null and s.chunks_count=0 and not(s.source_metadata ? 'content_hash')
          and s.source_metadata->'implementation'->>'id'='${implA}'
          and (s.source_metadata->'implementation'->>'revision')::integer=prior_knowledge_revision+1
          and s.source_metadata->'implementation'->>'approved_hash' is null) then raise exception 'approved fact mutation left stale current state'; end if;
        if not exists(select 1 from public.agent_implementation_facts where organization_id='${orgA}' and id='${factA}' and review_status='${status}'
          and original_value='A' and evidence_quote='Empresa A de teste' and original_hash=repeat('a',64)) then raise exception 'original/tombstone lost'; end if;
      end $proof$;
      rollback;`);
    },
  );
  it("fato pendente e recusa preservam revisão/teste já aprovado", () => {
    sql(`begin; set role service_role;
      update public.agent_implementations set tested_revision=revision where organization_id='${orgA}';
      update public.agent_implementation_facts set review_status='rejected',reviewed_by='${full}',reviewed_at=now() where organization_id='${orgA}' and id='${factA}';
      do $proof$ begin if not exists(select 1 from public.agent_implementations where organization_id='${orgA}' and revision=1 and tested_revision=1) then raise exception 'pending invalidated behavior'; end if; end $proof$;
      rollback;`);
  });
  it("origem e identidade de import são imutáveis; exclusão física e confirmação implícita são negadas", () => {
    denied(
      `begin; set role service_role; update public.agent_implementation_facts set original_value='fabricado' where id='${factA}' and organization_id='${orgA}'; rollback;`,
      /implementation_original_immutable/,
    );
    denied(
      `begin; set role service_role; update public.agent_implementation_imports set site_url='https://outro.example/' where id='${jobA}' and organization_id='${orgA}'; rollback;`,
      /implementation_import_immutable/,
    );
    denied(
      `set role service_role; delete from public.agent_implementation_facts where id='${factA}' and organization_id='${orgA}';`,
    );
    denied(
      `begin; set role service_role; insert into public.agent_implementation_facts(organization_id,implementation_id,category,key,original_value,original_hash,source_name,captured_at,reviewed_value,review_status,is_manual,reviewed_by,reviewed_at)
      values('${orgA}','${implA}','prices','price','R$ 10',repeat('c',64),'human',now(),'R$ 10','approved',true,'${full}',now()); rollback;`,
      /check constraint/,
    );
  });
  it("slot global único bloqueia outro tenant, attempts são finitas e lease tem teto", () => {
    denied(
      `begin; set role service_role;
      update public.agent_implementation_imports set status='running',attempts=1,lease_token=gen_random_uuid(),lease_expires_at=now()+interval '4 minutes',deadline_at=now()+interval '3 minutes',updated_at=now() where id='${jobA}' and organization_id='${orgA}';
      update public.agent_implementation_imports set status='running',attempts=1,lease_token=gen_random_uuid(),lease_expires_at=now()+interval '4 minutes',deadline_at=now()+interval '3 minutes',updated_at=now() where id='${jobB}' and organization_id='${orgB}'; rollback;`,
      /agent_implementation_one_running/,
    );
    denied(
      `begin; set role service_role; update public.agent_implementation_imports set attempts=4 where id='${jobA}' and organization_id='${orgA}'; rollback;`,
      /check constraint/,
    );
    denied(
      `begin; set role service_role; update public.agent_implementation_imports set status='running',attempts=1,lease_token=gen_random_uuid(),lease_expires_at=now()+interval '1 hour',deadline_at=now()+interval '3 minutes',updated_at=now() where id='${jobA}' and organization_id='${orgA}'; rollback;`,
      /check constraint/,
    );
  });
});
