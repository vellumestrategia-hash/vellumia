# Véllum AI — WhatsApp oficial e implantação Hostinger

**Data:** 15/10/2026

**Estado:** especificação aprovada em conversa; implementação pendente
**Objetivo:** retirar o WAHA da operação e preparar a Véllum AI para executar em uma VPS Hostinger com Coolify, Supabase externo e WhatsApp Business Platform Cloud API como único transporte de WhatsApp.

## Decisão central

A aplicação aceitará somente `meta_cloud` para novas conexões e para envio ou recebimento de WhatsApp. O adaptador oficial existente será completado e continuará sendo a única integração com a Graph API. Não será criado outro adaptador oficial, outro container de WhatsApp nem automação de WhatsApp Web.

Dados históricos relacionados ao WAHA serão preservados. Tabelas e colunas antigas não serão removidas nesta entrega quando houver risco de quebrar chaves estrangeiras, auditoria ou leitura de conversas antigas. Esses registros serão tratados como legado inativo: visíveis apenas onde a história exige, sem possibilidade de reconectar, enviar, receber ou criar sessões WAHA.

## Estado confirmado da base

O repositório já possui:

- adaptador `meta_cloud` para texto, mídia e contatos;
- resolução de credencial por organização e `phone_number_id`, com token cifrado;
- rota autenticada para cadastrar e validar WABA, número e token antes da gravação;
- webhook Meta por token de canal, handshake, assinatura SHA-256, vínculo do token com a organização e validação da WABA;
- ingestão oficial para contato, conversa, CRM, evento e agente;
- processamento de status de mensagem e de template;
- sincronização e envio de templates;
- regras de janela de 24 horas e capacidades por canal;
- health check do número oficial;
- RLS e restrições de unicidade para canais oficiais.

O WAHA ainda participa do Compose, das variáveis de ambiente, do onboarding por QR Code, de rotas de sessão, de módulos de envio/ingestão/mídia, de workers, de health checks, de documentação e de uma parcela extensa dos testes. A remoção será guiada pelos consumidores reais, não por uma exclusão textual indiscriminada.

## Arquitetura de produção

O conjunto mínimo no Coolify será:

1. **app:** Next.js standalone, APIs, painel, webhook Meta e rotas internas;
2. **worker:** consumo contínuo da fila PostgreSQL para agentes, mensagens e trabalhos assíncronos;
3. **scheduler:** crons autenticados da aplicação;
4. **redis:** rate limiting e debounce enquanto esses consumidores ainda dependerem dele;
5. **ponte HTTP do Redis:** compatibilidade com o cliente Upstash já usado pela aplicação;
6. **Supabase externo:** Postgres, Auth e Storage;
7. **Coolify proxy:** domínio e TLS automático.

Não haverá serviço `waha`, volume de sessão WhatsApp, dashboard WAHA, QR Code ou dependência `depends_on: waha`. O aplicativo e o worker não receberão variáveis `WAHA_*`.

## Transporte oficial único

O registro de adapters exporá `meta_cloud` como transporte de WhatsApp. Rotas genéricas que hoje aceitam `waha`, `meta_cloud` e provedores intermediados serão restringidas conforme o produto Véllum: WhatsApp oficial é `meta_cloud`; integrações que não sejam WhatsApp permanecem somente quando tiverem outra finalidade válida.

O envio seguirá:

`CRM/agente -> fila PostgreSQL -> regras before_send -> adaptador meta_cloud -> Graph API -> status pelo webhook`.

O recebimento seguirá:

`Meta -> webhook assinado -> token de caminho -> canal autorizado -> WABA/phone_number_id validados -> contato/conversa/CRM -> fila do agente`.

O tenant nunca será escolhido somente pelo payload. O token de webhook identifica uma sessão persistida e o payload precisa coincidir com a WABA e o número autorizados dessa sessão.

Texto livre será permitido apenas dentro da janela oficial. Fora dela, o sistema exigirá template aprovado e registrará claramente a ausência ou rejeição. Limites de campanha não bloquearão respostas essenciais de atendimento.

## Credenciais por empresa

Cada organização terá seu próprio:

- WABA ID;
- Phone Number ID;
- token autorizado cifrado;
- token de caminho do webhook;
- status e dados públicos do número;
- metadados de autorização e saúde.

O token nunca retornará ao frontend ou aos logs. Toda leitura e mutação feita com service role filtrará `organization_id` resolvido de sessão, caminho autorizado ou registro de canal. Índices impedirão o mesmo Phone Number ID ativo em mais de uma organização.

O caminho inicial continuará aceitando provisionamento oficial assistido: o administrador da empresa informa os dados obtidos na Meta, o backend valida a credencial na Graph API e só então persiste. O Meta Embedded Signup será adicionado sobre o mesmo contrato de persistência quando App ID, Configuration ID, OAuth redirect, permissões e aprovação da Meta estiverem disponíveis. Sua ausência não será apresentada como conexão concluída.

## Compatibilidade histórica e migration

A migration será aditiva e não destrutiva:

- canais WAHA existentes serão marcados como legados/inativos ou arquivados por operação idempotente;
- novas inserções ou reativações WAHA serão impedidas no banco e na aplicação;
- mensagens, contatos, conversas e auditorias históricas permanecerão intactos;
- colunas antigas como `waha_session_name` poderão continuar nulas ou armazenadas apenas para leitura histórica;
- funções compartilhadas com nomes históricos, como operações canônicas de contato/conversa, só serão renomeadas se houver migração segura de todos os consumidores; o nome interno não define o transporte operacional;
- nenhuma tabela ou coluna será descartada nesta entrega.

Migration, apêndice do baseline e MANIFEST serão mantidos equivalentes. A varredura terminal de permissões anônimas continuará sendo o último bloco do baseline.

## Onboarding e interface

O onboarding mostrará somente a conexão oficial. Serão removidos:

- escolha por QR Code;
- criação, reinício e polling de sessão WAHA;
- mensagens sobre WhatsApp Web ou serviço local;
- telas e ações de reconexão WAHA;
- opção de provedor parceiro quando apresentada como substituto do WhatsApp oficial da Véllum.

Estados de interface:

- não conectado;
- aguardando autorização;
- em configuração;
- conectado;
- requer atenção;
- erro de integração.

Cada estado terá explicação e ação concreta. O formulário manual oficial será a alternativa inicial. O Embedded Signup, quando habilitado, trocará a coleta manual por OAuth sem alterar o restante do fluxo. Tokens e respostas cruas da Meta não serão exibidos.

## Mídia, status, humano e agente

O adaptador oficial deverá cobrir texto, imagem, vídeo, áudio compatível, documento e contato. Mídia recebida será baixada pela Graph API com a credencial da mesma organização, limitada por tamanho e tipo e persistida pelo fluxo compartilhado existente.

IDs externos e webhooks serão idempotentes. Eventos duplicados não criarão mensagens ou acionamentos repetidos. Status fora de ordem só avançarão ou registrarão o estado de forma coerente. Falhas temporárias usarão a fila PostgreSQL e retentativas finitas; não será criada uma segunda fila.

O atendimento humano manterá precedência sobre o agente. O agente usará a organização, conversa, canal e base de conhecimento já vinculados, obedecerá orçamento de IA e enviará exclusivamente por `meta_cloud`.

## Custos e métricas

Serão registrados fatos confiáveis disponíveis nos eventos e requisições:

- organização, canal e mensagem;
- direção e tipo da mensagem;
- template, idioma e categoria quando informados;
- resultado e status de entrega;
- timestamp e identificador externo.

Nenhum custo monetário será calculado sem tabela de preços versionada e fonte confiável. Alertas e limites opcionais de campanha operarão por métricas, sem bloquear atendimento essencial.

## Remoção operacional do WAHA

A remoção abrangerá:

- serviço, imagem, volumes, health check e dependências do Compose;
- `WAHA_API_BASE_URL`, `WAHA_API_KEY`, `WAHA_HMAC_SECRET`, `WAHA_WEBHOOK_BASE_URL`, configuração de dashboard e assinatura;
- clientes, adapters, rotas de webhook, sessão e QR exclusivos;
- watchdogs e jobs exclusivos;
- caminhos de envio e mídia que ainda importam módulos WAHA;
- testes que promovem WAHA a comportamento operacional;
- documentação, exemplos, checklist e instruções de VPS.

Um teste de inventário impedirá que código operacional, Compose, `.env.example`, rotas ou textos de UI voltem a referenciar WAHA. Migrations históricas e documentos arquivados poderão conter o termo quando identificados como história e fora do caminho operacional.

## Segurança e falhas

- webhook sem assinatura válida: `401`, sem escrita;
- token de caminho desconhecido: `404`, sem revelar empresa;
- WABA/Phone Number divergente: evento ignorado e registrado sem trocar tenant;
- credencial ausente, expirada ou revogada: canal em “requer atenção”, mensagem não marcada como enviada;
- payload inválido: erro delimitado e sem exceção crua;
- Graph API indisponível: retentativa finita e status operacional observável;
- mídia excessiva ou incompatível: rejeição limitada e mensagem de diagnóstico;
- ausência de aprovação Meta/Embedded Signup: provisionamento assistido disponível, sem estado falso de conexão.

## Estratégia de testes

Testes unitários e de contrato cobrirão:

- ambiente e Compose sem WAHA;
- registro contendo somente o adaptador oficial;
- validação e armazenamento cifrado por empresa;
- assinatura e handshake do webhook;
- tenant resolvido pelo canal autorizado;
- texto, mídia recebida/enviada e contatos;
- duplicidade e eventos fora de ordem;
- falha e recuperação de envio;
- janela de 24 horas e template aprovado;
- atendimento humano e acionamento do agente;
- health checks sem WAHA;
- ausência de segredos no frontend/logs.

Testes PostgreSQL descartáveis provarão RLS, índices e desativação de canais legados. E2E usará duas organizações, credenciais Meta simuladas e Graph API mockada, sem rede real. O CI executará typecheck, lint, unitários, invariantes, build, E2E e construção das imagens.

Uma homologação real posterior exigirá conta e app Meta autorizados, WABA, número de teste ou produção, permissões e webhook público HTTPS. Testes com mocks não serão chamados de homologação Meta.

## Critério de prontidão para a Hostinger

O pacote estará pronto para subir quando:

1. nenhum serviço ou variável WAHA for necessário para iniciar app, worker e scheduler;
2. não existir caminho operacional de QR Code, WhatsApp Web ou envio WAHA;
3. Meta oficial enviar e receber por tenant nos testes integrados;
4. build, unitários, invariantes, E2E e imagens do mesmo SHA estiverem verdes;
5. Compose do Coolify usar imagens publicadas, Supabase externo e proxy HTTPS;
6. health checks não dependerem de serviços removidos;
7. migration e SQL manual estiverem documentados, sem execução automática em produção;
8. manual de implantação listar domínio, DNS, SSL, variáveis, worker, scheduler, Redis, webhook e smoke tests;
9. pendências externas da Meta estiverem claramente separadas de defeitos da aplicação.

O trabalho não inclui contratar a VPS, alterar DNS, aplicar SQL real, cadastrar dados de clientes, realizar deploy ou declarar homologação comercial sem autorização e credenciais Meta próprias para esse teste.
