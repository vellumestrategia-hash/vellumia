# WhatsApp oficial e Hostinger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer da WhatsApp Business Platform Cloud API o único transporte de WhatsApp operacional da Véllum AI e entregar um pacote validado para implantação em uma VPS Hostinger pelo Coolify.

**Architecture:** `meta_cloud` será o único adapter registrado para envio, recebimento, mídia, templates e saúde. WAHA e o BSP intermediário continuarão apenas como valores históricos em linhas arquivadas; a aplicação, os workers e o Compose não carregarão seus clientes, rotas, credenciais ou interfaces. App, worker, scheduler, Redis e a ponte HTTP do Redis rodarão no Coolify, usando Supabase externo para Postgres, Auth e Storage.

**Tech Stack:** Next.js 16, React 19, TypeScript 6, Supabase/PostgreSQL 15, Vitest, Playwright, Docker Compose, Coolify, Redis 7 e Meta Graph API.

## Global Constraints

- Somente `meta_cloud` pode ser criado, reativado ou usado para WhatsApp.
- Linhas históricas `waha` e `zernio` permanecem arquivadas; nenhuma tabela ou coluna histórica será descartada nesta entrega.
- Credenciais do número oficial vivem cifradas por organização em `channel_sessions`; token de sistema global no ambiente não é fallback multiempresa.
- Tenant de webhook é resolvido pelo token persistido no caminho e confirmado por WABA e Phone Number ID.
- A janela oficial de 24 horas e templates aprovados continuam obrigatórios.
- App, worker e scheduler não dependem de serviço, volume, rota ou variável WAHA.
- O Supabase permanece externo à VPS.
- O Coolify termina TLS e publica apenas o app; Redis e serviços auxiliares ficam internos.
- SQL real, DNS real, deploy e homologação com a Meta exigem uma etapa operacional posterior.
- A varredura terminal de permissões anônimas permanece como último bloco de `supabase/baseline.sql`.

---

## Mapa de arquivos

### Contrato e banco

- `supabase/migrations/20261015190000_0234_meta_cloud_only.sql`: arquiva canais legados e impede criação ou reativação.
- `supabase/baseline.sql`: espelho idempotente da migration, antes da varredura terminal de grants.
- `supabase/migrations/MANIFEST.md`: registro da migration e de sua política não destrutiva.
- `lib/channels/types.ts`: separa vocabulário histórico do provider operacional.
- `lib/channels/capabilities.ts`: capabilities e default exclusivos da API oficial.
- `lib/channels/index.ts`: registry com apenas `metaCloudAdapter`.
- `lib/channels/session-ref.ts`: referência operacional pelo `meta_phone_number_id`.
- `lib/messaging/media/types.ts`: tipo neutro `OutboundMedia`, sem import de `lib/waha`.

### Envio, recebimento e agente

- `lib/channels/adapters/meta-cloud.ts`: adapter oficial e readiness assíncrono por sessão.
- `lib/channels/meta/credentials.ts`: resolução cifrada somente pela sessão da organização.
- `app/api/v1/messages/_handler.ts`: aguarda readiness da sessão antes do envio.
- `app/api/v1/webhooks/meta/[token]/route.ts`: valida token, assinatura, WABA e número.
- `lib/channels/meta/ingest.ts`: ingestão idempotente e isolada por organização.
- `lib/agent-engine/edge/channel/meta-cloud-via-crm-adapter.ts`: adapter do runtime do agente com semântica oficial.
- `lib/channels/runtime.ts`: registra o adapter oficial no worker.
- `workers/agent-worker/main.ts`: remove watchdog e configuração WAHA.
- `workers/media-persist-worker.ts`: baixa mídia somente pelo adapter oficial.

### Produto e implantação

- `app/onboarding/connect-whatsapp/page.tsx`: onboarding oficial sem detecção de WAHA.
- `app/onboarding/connect-whatsapp/_client.tsx`: fluxo único de conexão oficial.
- `components/connections/ConexoesShell.tsx`: conexão e templates oficiais.
- `app/app/connections/page.tsx`: página sem configuração por QR.
- `docker-compose.prod.yml`: stack sem WAHA.
- `docker-compose.coolify.yml`: stack específica do Coolify, sem Caddy.
- `.env.example`: variáveis oficiais e de infraestrutura.
- `docs/deploy-coolify/README.md`: guia Hostinger/Coolify, DNS, TLS, SQL e smoke tests.
- `scripts/lint-official-whatsapp-only.ts`: inventário que impede regressão operacional.

---

### Task 1: Arquivar e bloquear canais legados no banco

**Files:**
- Create: `supabase/migrations/20261015190000_0234_meta_cloud_only.sql`
- Modify: `supabase/baseline.sql`
- Modify: `supabase/migrations/MANIFEST.md`
- Create: `tests/invariants/meta-cloud-only-schema.test.ts`
- Modify: `tests/invariants/channel-provider-schema.test.ts`

**Interfaces:**
- Consumes: `public.channel_sessions(provider, archived_at, status, status_reason)`.
- Produces: `public.fn_enforce_meta_cloud_only_channel()` e trigger `trg_enforce_meta_cloud_only_channel`.

- [ ] **Step 1: Escrever o teste de banco que prova o comportamento**

```ts
it("arquiva legado, recusa novo legado e aceita meta_cloud completo", async () => {
  const org = novaOrg(`meta-only-${Date.now()}`);
  expect(erroDe(() => insertSession(org, {
    provider: `'waha'`,
    waha_session_name: `'legacy-new'`,
    archived_at: "now()",
  }))).toMatch(/meta_cloud_only/);

  sql("alter table public.channel_sessions disable trigger trg_enforce_meta_cloud_only_channel");
  insertSession(org, {
    provider: `'waha'`,
    waha_session_name: `'legacy-existing'`,
    archived_at: "now()",
  });
  sql("alter table public.channel_sessions enable trigger trg_enforce_meta_cloud_only_channel");
  expect(erroDe(() => sql(`update public.channel_sessions set archived_at=null
                           where organization_id='${org}' and waha_session_name='legacy-existing'`)))
    .toMatch(/meta_cloud_only/);

  expect(insertSession(org, {
    provider: `'meta_cloud'`,
    waha_session_name: "null",
    meta_phone_number_id: `'phone-official'`,
  })).toContain("ok");
});
```

Definir no mesmo arquivo `novaOrg(slug: string): string`, `insertSession(org: string, cols: Record<string, string>): string` e `erroDe(fn: () => unknown): string`, com valores SQL tratados como literais explícitos. Acrescentar uma asserção estática que lê a migration e exige uma atualização de `public.channel_sessions` filtrada por `provider <> 'meta_cloud' and archived_at is null`, pois o baseline já nasce no estado final e não consegue provar o backfill sozinho.

- [ ] **Step 2: Rodar o teste e confirmar a falha anterior à migration**

Run: `pnpm vitest run tests/invariants/meta-cloud-only-schema.test.ts`

Expected: FAIL porque a função e o trigger ainda não existem e um canal legado ainda pode ficar ativo.

- [ ] **Step 3: Criar a migration aditiva**

```sql
begin;

update public.channel_sessions
set archived_at = coalesce(archived_at, now()),
    status = 'STOPPED',
    status_reason = 'legacy_provider_disabled'
where provider <> 'meta_cloud' and archived_at is null;

alter table public.channel_sessions alter column provider set default 'meta_cloud';

create or replace function public.fn_enforce_meta_cloud_only_channel()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.provider <> 'meta_cloud'
     and (tg_op = 'INSERT' or new.archived_at is null) then
    raise exception 'meta_cloud_only' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_meta_cloud_only_channel on public.channel_sessions;
create trigger trg_enforce_meta_cloud_only_channel
before insert or update of provider, archived_at on public.channel_sessions
for each row execute function public.fn_enforce_meta_cloud_only_channel();

revoke all on function public.fn_enforce_meta_cloud_only_channel() from public, anon, authenticated;
commit;
```

- [ ] **Step 4: Espelhar a migration no baseline e no MANIFEST**

Inserir o bloco antes da varredura terminal de permissões anônimas e registrar que os valores antigos continuam no CHECK apenas para leitura histórica arquivada.

- [ ] **Step 5: Rodar os invariantes do schema**

Run: `pnpm vitest run tests/invariants/meta-cloud-only-schema.test.ts tests/invariants/channel-provider-schema.test.ts tests/invariants/hardening-definer-varredura.test.ts`

Expected: PASS; baseline e migration têm o mesmo trigger e nenhum grant anônimo novo.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20261015190000_0234_meta_cloud_only.sql supabase/baseline.sql supabase/migrations/MANIFEST.md tests/invariants/meta-cloud-only-schema.test.ts tests/invariants/channel-provider-schema.test.ts
git commit -m "feat(db): restringir WhatsApp ao canal oficial"
```

### Task 2: Tornar o registry e os tipos oficialmente exclusivos

**Files:**
- Modify: `lib/channels/types.ts`
- Modify: `lib/channels/capabilities.ts`
- Modify: `lib/channels/index.ts`
- Modify: `lib/channels/session-ref.ts`
- Modify: `lib/channels/selectable.ts`
- Modify: `lib/messaging/media/types.ts`
- Test: `tests/unit/channel-capability-matrix.test.ts`
- Create: `tests/unit/meta-cloud-only-registry.test.ts`

**Interfaces:**
- Produces: `StoredChannelProvider`, `ChannelProvider = "meta_cloud"`, `CHANNEL_PROVIDER_META`, `DEFAULT_CHANNEL_PROVIDER`, `getAdapter(provider)`.
- Produces: `OutboundMedia` em `lib/messaging/media/types.ts`.
- Consumes: migration da Task 1, que mantém os providers legados apenas em linhas arquivadas.

- [ ] **Step 1: Escrever os testes do vocabulário e registry**

```ts
it("registra somente a API oficial", () => {
  expect(DEFAULT_CHANNEL_PROVIDER).toBe("meta_cloud");
  expect(getAdapter("meta_cloud").provider).toBe("meta_cloud");
  expect(() => getAdapter("waha" as never)).toThrow("unknown_channel_provider: waha");
  expect(() => getAdapter("zernio" as never)).toThrow("unknown_channel_provider: zernio");
});
```

- [ ] **Step 2: Rodar e confirmar que o registry ainda aceita três adapters**

Run: `pnpm vitest run tests/unit/meta-cloud-only-registry.test.ts tests/unit/channel-capability-matrix.test.ts`

Expected: FAIL porque o default e o registry ainda incluem WAHA e o intermediário.

- [ ] **Step 3: Separar provider histórico de provider operacional**

```ts
export type StoredChannelProvider = "waha" | "meta_cloud" | "zernio";
export type ChannelProvider = "meta_cloud";
export const CHANNEL_PROVIDER_META: ChannelProvider = "meta_cloud";
export const DEFAULT_CHANNEL_PROVIDER: ChannelProvider = CHANNEL_PROVIDER_META;
```

`getAdapter` deve aceitar `string`, devolver apenas `metaCloudAdapter` para `meta_cloud` e falhar fechado para qualquer valor legado ou desconhecido.

Atualizar `tests/invariants/channel-provider-schema.test.ts` para comparar o CHECK do banco com `StoredChannelProvider` e esperar default `meta_cloud`; o tipo operacional `ChannelProvider` deve continuar contendo apenas `meta_cloud`.

- [ ] **Step 4: Mover o tipo de mídia para o módulo neutro**

```ts
export interface OutboundMedia {
  url: string;
  mime: string;
  filename?: string | null;
}
```

Atualizar `lib/channels/types.ts` para importá-lo de `lib/messaging/media/types.ts`, eliminando a dependência de `lib/waha/media-send.ts`.

- [ ] **Step 5: Fazer sessões selecionáveis exigirem provider oficial e Phone Number ID**

Consultas de canais ativos devem filtrar `provider = CHANNEL_PROVIDER_META`, selecionar `meta_phone_number_id` e usar `resolveSessionRef` sem fallback para `waha_session_name` ou `zernio_account_id`.

- [ ] **Step 6: Rodar testes e typecheck focados**

Run: `pnpm vitest run tests/unit/meta-cloud-only-registry.test.ts tests/unit/channel-capability-matrix.test.ts tests/unit/canais-selecionaveis.test.ts && pnpm typecheck`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/channels/types.ts lib/channels/capabilities.ts lib/channels/index.ts lib/channels/session-ref.ts lib/channels/selectable.ts lib/messaging/media/types.ts tests/unit/meta-cloud-only-registry.test.ts tests/unit/channel-capability-matrix.test.ts tests/unit/canais-selecionaveis.test.ts
git commit -m "refactor(channels): registrar somente Meta Cloud"
```

### Task 3: Corrigir readiness e credenciais multiempresa no envio oficial

**Files:**
- Modify: `lib/channels/types.ts`
- Modify: `lib/channels/adapters/meta-cloud.ts`
- Modify: `lib/channels/meta/credentials.ts`
- Modify: `app/api/v1/messages/_handler.ts`
- Modify: `lib/channels/meta/send-template-for-session.ts`
- Test: `tests/unit/channel-adapter-meta.test.ts`
- Test: `tests/unit/messages-handler-desfechos.test.ts`
- Create: `tests/unit/meta-credentials-tenant.test.ts`

**Interfaces:**
- Changes: `ChannelAdapter.isConfigured(input)` becomes asynchronous and tenant scoped.
- Produces: `resolveMetaCreds(admin, { organizationId, phoneNumberId })` with session-only credentials.

- [ ] **Step 1: Escrever testes de duas organizações e de readiness**

```ts
it("usa somente o token cifrado da organização e da sessão", async () => {
  const creds = await resolveMetaCreds(adminFor([
    session({ organization_id: "org-a", meta_phone_number_id: "phone-a", token: "token-a" }),
    session({ organization_id: "org-b", meta_phone_number_id: "phone-b", token: "token-b" }),
  ]), { organizationId: "org-b", phoneNumberId: "phone-b" });
  expect(creds).toMatchObject({ phoneNumberId: "phone-b", token: "token-b", source: "session" });
});

it("não usa token global quando a sessão não possui credencial", async () => {
  process.env.META_SYSTEM_USER_TOKEN = "global-token";
  await expect(resolveMetaCreds(emptyAdmin(), { organizationId: "org-a", phoneNumberId: "phone-a" }))
    .resolves.toBeNull();
});
```

- [ ] **Step 2: Confirmar a falha do fallback global e do método síncrono**

Run: `pnpm vitest run tests/unit/meta-credentials-tenant.test.ts tests/unit/channel-adapter-meta.test.ts tests/unit/messages-handler-desfechos.test.ts`

Expected: FAIL porque `resolveMetaCreds` ainda cai no ambiente e `isConfigured()` ainda é síncrono.

- [ ] **Step 3: Alterar o contrato de readiness**

```ts
isConfigured(input: ChannelTenantScope & { sessionRef: string }): Promise<boolean>;
```

No adapter oficial, implementar com `resolveMetaCreds(createAdminClient(), input)` e retornar `creds !== null`. No handler, chamar:

```ts
const sessionRef = resolveSessionRef(c.channel_sessions);
const configured = await adapter.isConfigured({
  organizationId: ctx.organization_id,
  sessionRef,
});
```

- [ ] **Step 4: Remover o fallback de credencial de número pelo ambiente**

`resolveMetaCreds` passa a retornar somente `metaCredsForPhoneNumberId`. `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN` e `META_GRAPH_VERSION` continuam no ambiente porque pertencem ao app/webhook; WABA, Phone Number ID e token pertencem à sessão cifrada.

- [ ] **Step 5: Usar a mesma resolução no envio normal, template e health check**

Todos os caminhos recebem `organizationId` e `sessionRef`; ausência de credencial grava `queued_reason = meta_not_configured`, sem marcar a mensagem como enviada.

- [ ] **Step 6: Rodar testes focados**

Run: `pnpm vitest run tests/unit/meta-credentials-tenant.test.ts tests/unit/channel-adapter-meta.test.ts tests/unit/messages-handler-desfechos.test.ts tests/unit/send-template-wiring.test.ts tests/unit/saude-dos-canais-oficiais.test.ts`

Expected: PASS, inclusive sem `META_SYSTEM_USER_TOKEN` no processo.

- [ ] **Step 7: Commit**

```bash
git add lib/channels/types.ts lib/channels/adapters/meta-cloud.ts lib/channels/meta/credentials.ts lib/channels/meta/send-template-for-session.ts app/api/v1/messages/_handler.ts tests/unit/meta-credentials-tenant.test.ts tests/unit/channel-adapter-meta.test.ts tests/unit/messages-handler-desfechos.test.ts tests/unit/send-template-wiring.test.ts tests/unit/saude-dos-canais-oficiais.test.ts
git commit -m "fix(meta): resolver credenciais oficiais por empresa"
```

### Task 4: Fechar o contrato de entrada, mídia e status da Meta

**Files:**
- Modify: `app/api/v1/webhooks/meta/[token]/route.ts`
- Modify: `lib/channels/meta/webhook.ts`
- Modify: `lib/channels/meta/session.ts`
- Modify: `lib/channels/meta/ingest.ts`
- Modify: `lib/channels/adapters/meta-cloud.ts`
- Test: `tests/unit/contrato-do-webhook-meta.test.ts`
- Test: `tests/unit/meta-webhook.test.ts`
- Test: `tests/unit/midia-de-entrada-por-canal.test.ts`

**Interfaces:**
- Consumes: `metaSessionByWebhookToken(token)` e credenciais por sessão da Task 3.
- Produces: resposta HTTP delimitada e ingestão idempotente para `message`, `status` e `template_status`.

- [ ] **Step 1: Escrever matriz de webhook multiempresa**

```ts
it.each([
  ["WABA divergente", payloadMeta({ wabaId: "outra-waba", phoneNumberId: SESSAO.phoneNumberId })],
  ["número divergente", payloadMeta({ wabaId: SESSAO.wabaId, phoneNumberId: "outro-numero" })],
])("%s responde 200 sem ingerir", async (_name, payload) => {
  vi.stubEnv("META_APP_SECRET", APP_SECRET);
  ingeridos.length = 0;
  const res = await POST(pedido(payload), ctx);
  expect(res.status).toBe(200);
  expect(ingeridos).toHaveLength(0);
});
```

Adicionar `phoneNumberId: "phone-1"` ao `SESSAO` mutável já usado pelo teste. Definir `payloadMeta({ wabaId, phoneNumberId })` no mesmo arquivo para produzir um envelope `whatsapp_business_account` com uma `change` de mensagem, `metadata.phone_number_id = phoneNumberId` e `entry.id = wabaId`. Manter os casos existentes de assinatura ausente (`401`) e token desconhecido (`404`).

- [ ] **Step 2: Rodar e identificar lacunas reais**

Run: `pnpm vitest run tests/unit/contrato-do-webhook-meta.test.ts tests/unit/meta-webhook.test.ts tests/unit/midia-de-entrada-por-canal.test.ts`

Expected: pelo menos o caso de Phone Number ID divergente ou a matriz de duas organizações falha antes do reforço.

- [ ] **Step 3: Vincular o webhook ao número persistido**

Adicionar `phoneNumberId` a `MetaWebhookSession`; `metaSessionByWebhookToken` seleciona `meta_phone_number_id`. A rota ignora eventos cujo `wabaId` ou `phoneNumberId` não coincide com a sessão resolvida pelo token.

- [ ] **Step 4: Garantir idempotência e monotonicidade**

Mensagens usam o identificador externo como chave de deduplicação. Status repetidos não criam novas mensagens; status atrasados não rebaixam `delivered/read` para `sent`. Falhas guardam código e descrição delimitados, sem payload ou token cru.

- [ ] **Step 5: Validar mídia oficial**

`fetchInboundMedia` deve resolver o `media_id`, baixar bytes pela Graph API com o token da mesma sessão, aplicar `MAX_MEDIA_BYTES` antes e depois do download e nunca aceitar host do payload como URL final.

- [ ] **Step 6: Rodar a suíte oficial**

Run: `pnpm vitest run tests/unit/contrato-do-webhook-meta.test.ts tests/unit/meta-webhook.test.ts tests/unit/midia-de-entrada-por-canal.test.ts tests/unit/media-persist-worker.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/api/v1/webhooks/meta/[token]/route.ts lib/channels/meta/webhook.ts lib/channels/meta/session.ts lib/channels/meta/ingest.ts lib/channels/adapters/meta-cloud.ts tests/unit/contrato-do-webhook-meta.test.ts tests/unit/meta-webhook.test.ts tests/unit/midia-de-entrada-por-canal.test.ts tests/unit/media-persist-worker.test.ts
git commit -m "fix(meta): endurecer webhook e mídia oficial"
```

### Task 5: Substituir o onboarding por um fluxo oficial único

**Files:**
- Modify: `app/onboarding/connect-whatsapp/page.tsx`
- Rewrite: `app/onboarding/connect-whatsapp/_client.tsx`
- Modify: `components/connections/ConexoesShell.tsx`
- Modify: `components/connections/CanalOficialClient.tsx`
- Modify: `app/app/connections/page.tsx`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Delete: `components/connections/ConnectionsClient.tsx`
- Delete: `components/connections/CanalParceiroClient.tsx`
- Delete: `components/connections/TemplatesParceiroClient.tsx`
- Delete: `components/connections/AntiBanSheet.tsx`
- Test: `tests/unit/onboarding-escolhe-como-conecta.test.tsx`
- Test: `tests/unit/conexoes-excluir-canal.test.tsx`
- Create: `tests/unit/onboarding-meta-oficial.test.tsx`

**Interfaces:**
- Consumes: `GET/POST /api/v1/channels/official`.
- Produces: estados `not_connected | authorizing | configuring | connected | attention | error` e ação de continuar no onboarding.

- [ ] **Step 1: Escrever o teste do fluxo visível**

```tsx
render(<ConnectWhatsappClient oficialPodeReceber />);
expect(screen.getByRole("heading", { name: /conectar whatsapp oficial/i })).toBeVisible();
expect(screen.queryByText(/qr code|whatsapp web|provedor parceiro/i)).not.toBeInTheDocument();
await user.type(screen.getByLabelText(/waba id/i), "waba-1");
await user.type(screen.getByLabelText(/phone number id/i), "phone-1");
await user.type(screen.getByLabelText(/token de acesso/i), "token-1");
await user.click(screen.getByRole("button", { name: /validar e conectar/i }));
expect(await screen.findByText(/número oficial conectado/i)).toBeVisible();
```

- [ ] **Step 2: Confirmar a falha no fluxo atual de três escolhas**

Run: `pnpm vitest run tests/unit/onboarding-meta-oficial.test.tsx tests/unit/onboarding-escolhe-como-conecta.test.tsx tests/unit/conexoes-excluir-canal.test.tsx`

Expected: FAIL porque a tela ainda oferece QR e parceiro.

- [ ] **Step 3: Reescrever onboarding com uma única decisão**

Remover `wahaConfigured`, `sessionName`, polling e criação de sessão. Mostrar o formulário oficial, a URL exata de callback derivada de `webhook_path_token`, o estado de validação e a ação “Continuar sem conectar agora”. Não renderizar token depois do POST.

Remover `qrcode` e `@types/qrcode` de `package.json` e do lockfile se `rg -n "qrcode" app components lib workers scripts` confirmar que nenhum consumidor permanece.

- [ ] **Step 4: Simplificar a Central de Conexões**

Manter duas áreas dentro do canal oficial: `Conexão` e `Templates da Meta`. Remover abas “Números por QR” e “Provedor parceiro”, textos de anti-ban e ações de reconexão WAHA.

- [ ] **Step 5: Revisar UX e acessibilidade do caminho principal**

Garantir labels associados, erros próximos ao campo, foco no primeiro erro, estado de loading sem duplo envio, contraste AA, navegação por teclado e texto que explique onde obter WABA ID, Phone Number ID e token.

- [ ] **Step 6: Rodar testes de UI e acessibilidade**

Run: `pnpm vitest run tests/unit/onboarding-meta-oficial.test.tsx tests/unit/onboarding-escolhe-como-conecta.test.tsx tests/unit/conexoes-excluir-canal.test.tsx tests/unit/vellum-ui-refinamento.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/onboarding/connect-whatsapp/page.tsx app/onboarding/connect-whatsapp/_client.tsx components/connections app/app/connections/page.tsx tests/unit/onboarding-meta-oficial.test.tsx tests/unit/onboarding-escolhe-como-conecta.test.tsx tests/unit/conexoes-excluir-canal.test.tsx tests/unit/vellum-ui-refinamento.test.tsx
git commit -m "feat(onboarding): conectar somente WhatsApp oficial"
```

### Task 6: Remover clientes, rotas e jobs WAHA/intermediário

**Files:**
- Create: `lib/agent-engine/edge/channel/meta-cloud-via-crm-adapter.ts`
- Modify: `lib/channels/runtime.ts`
- Modify: `lib/agent-engine/channel-adapter.ts`
- Modify: `workers/agent-worker/main.ts`
- Modify: `lib/agent-engine/env.ts`
- Modify: `app/api/v1/health/route.ts`
- Delete: `lib/agent-engine/edge/channel/waha-adapter.ts`
- Delete: `lib/waha/**`
- Delete: `lib/channels/adapters/waha.ts`
- Delete: `lib/channels/adapters/zernio.ts`
- Delete: `lib/channels/zernio/**`
- Delete: `app/api/v1/webhooks/waha/route.ts`
- Delete: `app/api/v1/webhooks/waha/[token]/route.ts`
- Delete: `app/api/v1/webhooks/in/[token]/route.ts`
- Delete: `app/api/v1/onboarding/whatsapp/session/route.ts`
- Delete: `app/api/v1/onboarding/whatsapp/qr/route.ts`
- Delete: `app/api/v1/channel-sessions/[id]/qr/route.ts`
- Delete: `app/api/v1/channel-sessions/[id]/reconnect/route.ts`
- Modify: `app/api/v1/channel-sessions/[id]/route.ts`
- Modify: `app/api/v1/channel-sessions/route.ts`
- Delete: `app/api/v1/channels/partner/**`
- Delete: `lib/messaging/media/waha-source.ts`
- Test: `tests/unit/channel-adapter-waha.test.ts` (replace with official test)
- Test: `tests/unit/channel-health-aviso.test.ts`

**Interfaces:**
- Produces: `META_CLOUD_VIA_CRM_CHANNEL` e `MetaCloudViaCrmAdapter` com o mesmo sink idempotente do CRM.
- Removes: watchdog direto WAHA e todas as bordas HTTP não oficiais.

- [ ] **Step 1: Escrever o teste do adapter do agente com semântica oficial**

```ts
expect(adapter.channel).toBe("meta_cloud_via_crm");
expect(adapter.capabilities()).toEqual({ freeformAnytime: false, serviceWindowHours: 24 });
expect(adapter.costPerMessage()).toEqual({ perMessageUsdCents: 0, model: "per_message" });
```

O valor monetário permanece zero até existir tabela de preço versionada; `model` registra que a plataforma cobra por mensagem.

- [ ] **Step 2: Rodar o teste e confirmar que o runtime ainda instancia WAHA**

Run: `pnpm vitest run tests/unit/channel-adapter-meta-via-crm.test.ts`

Expected: FAIL porque a classe oficial ainda não existe.

- [ ] **Step 3: Renomear o adapter do runtime sem reescrever o sink**

Criar `MetaCloudViaCrmAdapter` reutilizando `sendTurnMessage`, o ledger idempotente e o espelho `channel_session_health`. Alterar `createRuntimeSendChannel` para instanciá-lo.

- [ ] **Step 4: Retirar watchdog WAHA do worker**

Remover `runSessionWatchdogLoop`, `WAHA_API_BASE_URL`, `WAHA_API_KEY` e métricas específicas. O cron genérico `app/api/v1/cron/channel-health` continua consultando `metaCloudAdapter.checkHealth` e atualizando o espelho durável.

- [ ] **Step 5: Excluir módulos e rotas exclusivas**

Apagar os arquivos listados e seus testes exclusivos. Atualizar imports compartilhados para os módulos neutros ou Meta. Endpoints removidos devem retornar 404 por ausência de rota.

- [ ] **Step 6: Atualizar o health check**

`/api/v1/health` mede Supabase e Redis; saúde do número oficial permanece em `/api/v1/cron/channel-health` e na Central de Conexões. O app não fica indisponível quando a Graph API oscila.

- [ ] **Step 7: Rodar typecheck, lint de canais e testes de runtime**

Run: `pnpm typecheck && pnpm lint:channels && pnpm vitest run tests/unit/channel-adapter-meta-via-crm.test.ts tests/unit/channel-health-aviso.test.ts tests/unit/alcance-falha-de-rede.test.ts`

Expected: PASS e nenhum import de arquivo removido.

- [ ] **Step 8: Commit**

```bash
git add -A lib/waha lib/channels app/api/v1/webhooks app/api/v1/onboarding/whatsapp app/api/v1/channel-sessions app/api/v1/channels/partner lib/agent-engine workers app/api/v1/health tests/unit
git commit -m "refactor(whatsapp): remover transportes não oficiais"
```

### Task 7: Criar o pacote Hostinger/Coolify sem WAHA

**Files:**
- Modify: `docker-compose.prod.yml`
- Create: `docker-compose.coolify.yml`
- Modify: `docker-compose.yml`
- Modify: `docker-compose.traefik.yml`
- Modify: `Caddyfile`
- Modify: `.env.example`
- Modify: `lib/env.ts`
- Modify: `Dockerfile.worker`
- Modify: `.github/workflows/release.yml`
- Create: `docs/deploy-coolify/README.md`
- Modify: `docs/DEPLOY-CHECKLIST.md`
- Delete: `docs/runbooks/waha-hostgator.md`
- Delete: `docs/prd/03-prd-whatsapp-waha.md`
- Delete: `docs/specs/03-spec-whatsapp-waha.md`
- Delete: `hostgator-setup-kit/**`
- Create: `tests/unit/coolify-compose.test.ts`

**Interfaces:**
- Produces: serviços Coolify `app`, `worker`, `redis`, `srh`, `scheduler`.
- Consumes: imagens GHCR do repositório Véllum e Supabase externo.

- [ ] **Step 1: Escrever o teste estrutural do Compose e ambiente**

```ts
expect(services).toEqual(expect.arrayContaining(["app", "worker", "redis", "srh", "scheduler"]));
expect(services).not.toContain("waha");
expect(composeText).not.toMatch(/WAHA_|waha-data|waha-media|depends_on:\s*\n\s*waha/);
expect(envExample).not.toMatch(/^WAHA_/m);
expect(envExample).not.toMatch(/^ZERNIO_/m);
expect(envExample).toMatch(/^META_APP_SECRET=/m);
expect(envExample).toMatch(/^META_WEBHOOK_VERIFY_TOKEN=/m);
```

- [ ] **Step 2: Rodar e confirmar que Compose/env ainda dependem de WAHA**

Run: `pnpm vitest run tests/unit/coolify-compose.test.ts`

Expected: FAIL apontando serviço, volumes e variáveis legadas.

- [ ] **Step 3: Reduzir o Compose de produção**

Remover serviço, volumes e `depends_on` WAHA. Remover override `WAHA_API_BASE_URL` do worker. Manter limites aproximados: app 768 MiB, worker 512 MiB, Redis 128 MiB, ponte 128 MiB e scheduler 128 MiB, deixando margem para sistema e Coolify numa VPS de 4 GB.

- [ ] **Step 4: Criar o Compose do Coolify**

O arquivo deve usar imagens pináveis por `APP_IMAGE`, `WORKER_IMAGE` e `SCHEDULER_IMAGE`, expor internamente apenas `app:3000`, declarar health checks, rede interna e volumes somente quando necessários. Não incluir Caddy: domínio e certificado são configurados no proxy do Coolify.

- [ ] **Step 5: Limpar variáveis e branding de imagens**

Remover `WAHA_*`, `ZERNIO_*`, `META_WABA_ID`, `META_PHONE_NUMBER_ID` e `META_SYSTEM_USER_TOKEN`. Manter `META_APP_ID`, `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN` e `META_GRAPH_VERSION`. A workflow deve publicar app, worker e scheduler no namespace do repositório Véllum, sem nomes `deskcomm*` hardcoded.

- [ ] **Step 6: Substituir o kit HostGator legado pelo guia Coolify**

O guia deve listar: VPS Ubuntu suportada, 4 GB RAM, swap de 2 GB, projeto Compose, variáveis obrigatórias, domínio `app.<domínio>`, DNS A/AAAA, TLS automático, aplicação manual da migration, configuração do webhook Meta, rollback por tag e smoke tests.

- [ ] **Step 7: Validar Compose e documentação**

Run: `docker compose -f docker-compose.prod.yml config && docker compose -f docker-compose.coolify.yml config && pnpm vitest run tests/unit/coolify-compose.test.ts`

Expected: PASS, cinco serviços no Coolify e nenhuma referência operacional a WAHA.

- [ ] **Step 8: Commit**

```bash
git add -A docker-compose.prod.yml docker-compose.coolify.yml docker-compose.yml docker-compose.traefik.yml Caddyfile .env.example lib/env.ts Dockerfile.worker .github/workflows/release.yml docs hostgator-setup-kit tests/unit/coolify-compose.test.ts
git commit -m "ops: preparar stack oficial para Coolify"
```

### Task 8: Instalar um gate contra regressão e executar a validação final

**Files:**
- Create: `scripts/lint-official-whatsapp-only.ts`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`
- Create: `tests/unit/whatsapp-oficial-only-inventory.test.ts`
- Modify: `docs/deploy-coolify/README.md`

**Interfaces:**
- Produces: comando `pnpm lint:whatsapp-official`.
- Consumes: allowlist histórica limitada a `supabase/migrations/**`, `supabase/baseline.sql`, `supabase/migrations/MANIFEST.md` e specs arquivadas explicitamente.

- [ ] **Step 1: Escrever o teste do inventário operacional**

```ts
const forbidden = ["WAHA_", "/webhooks/waha", "devlikeapro/waha", "wahaAdapter", "zernioAdapter"];
for (const file of operationalFiles()) {
  for (const token of forbidden) expect(read(file), `${file}: ${token}`).not.toContain(token);
}
```

O inventário inclui `app`, `components`, `lib`, `workers`, `scripts`, Dockerfiles, Compose, `.env.example` e documentação ativa; migrations históricas ficam fora.

- [ ] **Step 2: Confirmar que o gate detecta qualquer resíduo operacional**

Run: `pnpm vitest run tests/unit/whatsapp-oficial-only-inventory.test.ts`

Expected: FAIL listando todos os resíduos ainda não removidos; corrigir cada consumidor real, sem ampliar a allowlist.

- [ ] **Step 3: Adicionar o comando e ligá-lo ao CI**

```json
{
  "scripts": {
    "lint:whatsapp-official": "tsx scripts/lint-official-whatsapp-only.ts"
  }
}
```

Executar o comando no job de verificação antes de testes e build.

- [ ] **Step 4: Rodar a bateria completa no mesmo SHA**

Run:

```bash
pnpm typecheck
pnpm lint
pnpm lint:channels
pnpm lint:role-rank
pnpm lint:whatsapp-official
pnpm test:unit
pnpm test:invariants
pnpm build
pnpm test:e2e
docker compose -f docker-compose.coolify.yml build
```

Expected: todos os comandos terminam com código 0.

- [ ] **Step 5: Executar smoke tests em containers locais**

Subir o Compose com Supabase de teste e Graph API mockada; provar `/api/v1/health`, login, criação de empresa, conexão oficial simulada, webhook assinado, mensagem recebida, resposta humana, resposta do agente e template fora da janela. Registrar no guia os comandos e resultados do SHA validado.

- [ ] **Step 6: Revisar segurança e segredos**

Confirmar que imagens, logs, HTML e respostas de API não contêm token da Meta, service role, chave de cifra ou `INTERNAL_SECRET`; confirmar que Redis/SRH não publicam portas; confirmar que webhook inválido não escreve no banco.

- [ ] **Step 7: Commit final**

```bash
git add scripts/lint-official-whatsapp-only.ts package.json .github/workflows/ci.yml tests/unit/whatsapp-oficial-only-inventory.test.ts docs/deploy-coolify/README.md
git commit -m "test: impedir retorno de WhatsApp não oficial"
```

- [ ] **Step 8: Publicar branch e acompanhar o CI**

Run: `git push origin main`

Expected: o SHA remoto coincide com `git rev-parse HEAD`, e os jobs de verificação, invariantes, build, E2E e imagens ficam verdes antes de qualquer deploy real.
