# Implementação assistida de agentes

Pedido aprovado pelo proprietário no documento de onboarding inteligente de
12/10/2026. Esta especificação organiza sua implementação; não reduz o escopo.

## Decisão

Adicionar uma ferramenta interna em `/admin/implementations`, com assistente
por empresa em `/admin/implementations/[organizationId]`. O guard existente
`requirePlatformAdmin` deve exigir também `scope=full`. Nenhum item aparece no
menu do cliente. O identificador da empresa vem do caminho autorizado; operações
com service role sempre filtram a empresa explicitamente.

Reutilizar `event_log`, o dispatcher registrado, Storage privado `ai-policy`,
extração PDF/Markdown, `ai_knowledge_sources`, `rag-indexer`, `ai_agents`, versões,
o seam `runModelCall` e o sandbox `testAgentVersion`. Não introduzir outro motor,
fila, banco, serviço de scraping ou provedor de embeddings.

## Fluxo

1. Lista com empresa, plano real, situação da implementação/agente e atualização.
2. Conhecer a empresa: URL pública ou documentos privados PDF/MD/TXT. Trabalho
   assíncrono; progresso e repetição de falhas, sem promessa de duração fixa.
3. Revisar informações com fonte/data/trecho, comparação com versão aprovada,
   edição, confirmação, rejeição e observação. Conteúdo comercial exige confirmação
   explícita. Importações não alteram automaticamente conteúdo aprovado ou manual.
4. Complementar os campos ausentes e registrar objetivo, prioridades, tom,
   qualificação, oportunidades, transferência humana, regras comerciais,
   agendamento e ações autorizadas no CRM.
5. Gerar sugestão com IA a partir de conteúdo aprovado, revisar e salvar uma
   versão de agente em rascunho. Reutilizar configurações técnicas existentes e
   apresentar pendências concretas quando faltarem.
6. Testar com o motor real, RAG e ferramentas em modo sandbox, exibindo resposta,
   referências e propostas sem executar mensagens ou ações externas.
7. Finalizar registra aprovação e deixa pronto para ativação. A publicação
   operacional permanece sujeita às validações existentes de versão, assinatura,
   credenciais e WhatsApp oficial. Não publicar automaticamente.

A central mantém fontes, documentos, fatos aprovados, histórico, indexação,
reimportação, correções/exclusões e teste. Revisão do conhecimento ou configuração
invalida a aprovação/teste anterior.

## Dados e processamento

Três tabelas novas: `agent_implementations`, `agent_implementation_imports` e
`agent_implementation_facts`. Todas contêm `organization_id`. FKs compostas
impedem referências entre empresas. RLS não concede leitura aos clientes,
incluindo administrador da própria empresa. Administrador global full pode ler;
mutação somente no servidor. Registros de auditoria acompanham as operações.

Uma importação pode executar por vez em toda a instalação: claim atômico com
lease expirável no Postgres, não advisory lock de sessão. Jobs e eventos são
gravados na mesma transação. Limites: seis páginas, profundidade um, quatro
redirecionamentos, 1 MB por resposta, 2 MB no total, 90 segundos de coleta;
inferência externa limitada e uploads de até 10 MB. Retentativas finitas e
recuperação após lease expirar. Nenhuma credencial real nas provas.

Cada conexão HTTP resolve e valida todos os IPs, fixa o endereço validado no
lookup e preserva TLS com hostname original. Somente HTTP/HTTPS e portas padrão;
negar localhost, redes privadas/especiais, metadata, IPv4/IPv6 não públicos,
credenciais na URL e cada redirecionamento inseguro. Seguir robots.txt e limites,
sem executar JavaScript ou contornar login/CAPTCHA/proteções.

A IA recebe somente texto limitado e fontes enumeradas. Saída estruturada com
schema e trechos de evidência conferidos no texto original; ausência não é fato.
Conteúdo extraído inicia pendente. Apenas informações aprovadas compõem documento
Markdown privado enviado ao indexador existente, com hash e metadados de fontes.
Conteúdo idêntico não provoca nova indexação nem embeddings. Configurações de
versões apontam somente para fontes autorizadas dessa empresa.

## Alternativas e consequências

Scraping terceirizado e uma segunda fila aumentariam custo e operação na VPS de
2 vCPU/4 GB. Processamento síncrono tornaria o navegador dependente da duração do
site/provedor. A fila existente com concorrência um mantém o consumo previsível;
sites exclusivamente JavaScript, PDFs de imagem e bloqueios de acesso exigem
arquivo com texto ou preenchimento manual. Inferência e embeddings dependem de
credenciais/configuração existentes e podem ter custo externo.

## Aceite

Provar SSRF e redirecionamentos, robots, limites, deduplicação, revisão comercial,
preservação de correção manual, tenant/FKs/RLS, retomada de jobs, fluxo RAG e
sandbox sem efeitos externos. CI aplica baseline novo e reaplicação em PG15,
tipos/lint/unidades, build e E2E responsivo com capturas de fixtures. Migration
0233 versionada, apêndice idempotente e MANIFEST; proprietário recebe SQL manual.
Nenhuma migration nova aplicada à produção e nenhum deploy nesta etapa.
