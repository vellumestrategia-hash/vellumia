# Implementação interna de agentes — contrato de persistência e API

Etapa 2, implementada em 13/10/2026. A coleta da etapa 1 é reutilizada; worker,
upload HTTP, inferência, sincronização/indexação, configuração de agente, testes
de sandbox, finalização e interface pertencem às próximas etapas. Nenhum SQL foi
aplicado em produção. RLS/Storage/concorrência reais aguardam o Actions.

Somente `requireImplementationAdmin` autoriza estas rotas: administrador global
ativo com `scope=full`, MFA validado pelo guard existente e sem acompanhamento
temporário de suporte. Clientes não leem as três tabelas internas, inclusive na
própria empresa. A leitura direta exige também MFA aal2 quando requerido.
Authenticated não tem DML; os métodos de repositório são internos do servidor,
com tenant do caminho validado. Não são Server Actions nem RPCs públicas.

`GET /api/v1/admin/implementations?q=&limit=&cursor=` retorna lista de empresas
com plano/assinatura reais, estado interno e agentes com `is_active`, versão
publicada e arquivamento observados no banco. `limit` é 1–100 (padrão 30);
`cursor` é UUID da última empresa, paginação crescente por id. A exceção ao
cursor assinado é deliberada nesta listagem administrativa global: o valor só
define a posição de leitura, é validado como UUID e nunca concede escopo.
Busca é substring literal de nome/slug, parametrizada, sem interpolação SQL.
`GET /api/v1/admin/implementations/[organizationId]` entrega o DTO documentado
em `lib/implementations/contracts.ts`: empresa/plano, fatos/imports, metadados de
conhecimento, configuração draft existente, testes registrados e pré-requisitos.
Credenciais/canais são presença real, não prova de homologação externa.
`facts_reviewed=pending` informa candidatos ainda não revisados; não invalida o
conhecimento ou teste já aprovados. A próxima etapa deve bloquear finalize até
revisar essas pendências e validar os demais gates.

`POST /api/v1/admin/implementations/[organizationId]` usa union Zod strict:

| action | Campos além de action | Resultado |
| --- | --- | --- |
| import_site | url, idempotency_key UUID | import, duplicate |
| retry_import | import_id UUID | import, duplicate |
| review_fact | fact_id, expected_revision, disposition approved/rejected; value, sensitive_confirmed, note, replace_fact_id opcionais | implementation, fact |
| add_fact | expected_revision, category, key, value, source_name; sensitive_confirmed, note opcionais | implementation, fact |
| delete_fact | fact_id, expected_revision; note opcional | implementation, fact tombstone |
| save_brief | expected_revision, brief {purpose,audience,tone,limits,handoff,required_questions} | implementation |

Corpos com `organization_id`, ator, job id para criação, lease ou fonte são
rejeitados. O servidor cria o UUID do import e deriva payload/metadados do evento
do recibo persistido. Uma chave repetida da mesma empresa/URL retorna o import
existente; payload diferente retorna conflito. Retry reutiliza o job/contador:
máximo três aquisições, sem reset. Succeeded/queued/running não são duplicados
por retry. Cada mutação bem-sucedida audita operação, empresa e ator, sem copiar
fatos, brief, URL ou citação para o log.

Fatos automáticos exigem citação literal, origem/data verificadas pela extração
existente. Ficam pending. Correção humana pode divergir da citação: `original_*`,
quote, fonte/data permanecem imutáveis; `reviewed_value`, `is_manual`, revisor,
data/nota identificam a revisão. Horário, agendamento, preço, pagamentos,
políticas e condições comerciais exigem `sensitive_confirmed=true` explícito.
Somente um approved por category/key. Aprovar candidato substituto exige
`replace_fact_id` do aprovado atual; ele vira rejected na mesma transação. Não
há substituição automática durante reimportação. Original_hash usa categoria,
key/value normalizados e fonte canonicalizada; ignora captura/citação e revisão.
Deleted/rejected conservam essa identidade para impedir ressuscitar originais.

`revision` controla comportamento, configuração/teste/finalização.
`knowledge_revision` controla material factual aprovado. Brief alterado sobe
somente a primeira e preserva o índice. Inserts/rejects de pending e notas não
sobem revisão. Aprovação/correção/exclusão de approved sobe ambas via trigger,
limpa tested/finalized/config e índice na transação; source pointer/hash metadata
são retirados antes de qualquer sincronização externa. O repositório calcula o
novo approved_hash e grava approved_revision=knowledge_revision na mesma transação.
`approved_revision`/`indexed_revision` referem-se à revisão de conhecimento.
Uma substituição explícita pode subir dois números (retirada + aprovação);
consumidores devem comparar igualdade, nunca presumir incremento único.

`source_metadata.implementation={id,revision,approved_hash}` usa id da
implementação e revision=knowledge_revision. A Task 3 deve capturar esse par,
produzir só conteúdo approved e validar id/hash/revisão atomicamente ao ativar
a versão. A checagem anterior ao upload isoladamente não impede corrida.
Sync após aprovação será automático; index_knowledge futuro será recuperação.

Fila permanece `event_log`, evento `agent_implementation.import_requested`.
Enqueue/retry/event fazem commit juntos pelo `getRequestPool` existente.
`claimImport(org,id)` primeiro confirma job interno; id desconhecido/concluído
não tem efeito. Recupera leases expirados, reemite apenas jobs com tentativas
restantes e adquire um slot global por índice único parcial. Contenda retorna
contended/retry_after_ms=5000 e não consome tentativa. Aquisição gera lease UUID,
180 s de trabalho, 240 s de lease; complete/fail exigem org+id+token vivo.
Complete revalida deadline antes do commit. O worker futuro cancela coleta/
inferência pelo deadline e não confia em URL/blobPath/ator do evento.

Arquivos pendentes: bucket privado `ai-policy`, prefixo reservado
`<org>/implementation-pending/<uuid>.pdf|txt`, sem acesso direto authenticated
(read/insert/update/delete); documentos históricos no prefixo comum preservam
suas policies. `enqueueFileImport` é somente seam interno para o upload futuro;
esse upload deve gerar path no servidor, limitar stream e verificar conteúdo.
O endpoint desta etapa não aceita arquivos.

Erros usam ok/fail e X-Request-Id, sem mensagens internas:

| code | HTTP | Quando |
| --- | --- | --- |
| forbidden | 403 | Falta full/MFA/ativo ou há contexto de suporte |
| invalid_request | 400 | Caminho/filtro inválido |
| validation_failed | 422 | Body estrito inválido |
| not_found | 404 | Empresa/fato/import ausente no tenant |
| idempotency_conflict | 409 | Chave usada com outro payload |
| state_conflict | 409 | Substituição não explicitada ou estado incompatível |
| implementation_revision_conflict | 409 | Revisão do operador ficou antiga |
| implementation_sensitive_confirmation_required | 422 | Dado comercial sem confirmação |
| implementation_import_exhausted | 409 | Três tentativas adquiridas |
| implementation_lease_lost | 409 | Write de worker sem lease vigente |
| unavailable | 503 | Dependência/erro interno; mensagem genérica e segura |
