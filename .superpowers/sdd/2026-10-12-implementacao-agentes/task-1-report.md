# Etapa 1 — coleta pública segura e evidência

Data: 12/10/2026, America/Sao_Paulo. Base: `9305f94501eafd51a7d100ecd134c49b9f70213a`.
Trabalho diretamente em VellumAI/main, conforme autorização. Sem push nesta etapa.

## Escopo entregue

- `lib/implementations/contracts.ts`: contratos snake_case, categorias/schema Zod, limites e validação extrativa compartilhada.
- `public-url.ts`: URL HTTP(S)/porta padrão sem userinfo; classificação IPv4/IPv6 e resolução completa por conexão.
- `robots.ts`: grupos específicos, Allow/Disallow, wildcard, âncora final, query, normalização de percent-encoding e orçamento de complexidade.
- `html.ts`: parser HTML5 sem execução, extração de título/texto, deduplicação de linhas e descoberta limitada de links relevantes.
- `crawler.ts`: transporte Node com DNS fixado, TLS normal, orçamento global, redirects verificados, robots por origem/caminho, limites de streams e deduplicação.
- `tests/unit/implementations-crawler.test.ts`: 56 casos de coleta, transporte e segurança sem rede real.
- `tests/unit/implementations-evidence.test.ts`: 17 casos de contratos, normalização, categorias e rejeição de evidência fabricada.
- `package.json`/`pnpm-lock.yaml`: parse5 8.0.1 de produção; somente uma linha no manifest e três no lockfile.
- `docs/vellum/CONTINUIDADE.md`: registro exclusivamente desta etapa.

Sem mudança em DB, APIs, UI, workers, schemas existentes, guards, RLS ou arquivos de ambiente.

## Contratos efetivamente exportados

`crawler.ts`:

```ts
crawlPublicSite(url: string, options?: CrawlOptions): Promise<CrawlResult>
publicHttpTransport: CrawlTransport
```

`contracts.ts` exporta os valores `CRAWL_LIMITS`, `FACT_CATEGORIES`,
`factCategorySchema`, `factSchema`, `factsSchema`, `evidenceSourceSchema`,
`normalizeEvidenceText`, `validateFactEvidence` e `validateFactsEvidence`.
Exporta os tipos `FactCategory`, `ImplementationFact`, `EvidenceSource`,
`ResolvedAddress`, `DnsResolver`, `CrawlRequest`, `CrawlResponse`,
`CrawlTransport`, `CrawlOptions`, `CrawledPage` e `CrawlResult`.

```ts
interface CrawlResult {
  pages: { url: string; title: string; text: string; captured_at: string; content_hash: string }[];
  content_hash: string;
  warnings: string[];
}
interface CrawlOptions {
  max_pages?: number; max_depth?: number; max_redirects?: number;
  max_response_bytes?: number; max_total_bytes?: number; timeout_ms?: number;
  signal?: AbortSignal;
  resolve_dns?: (hostname: string) => Promise<readonly { address: string; family: 4 | 6 }[]>;
  transport?: CrawlTransport;
}
interface CrawlRequest {
  url: URL; address: string; family: 4 | 6; signal: AbortSignal;
  timeout_ms: number; max_bytes: number;
}
interface CrawlResponse {
  status: number; headers: Record<string, string | undefined>;
  body: AsyncIterable<Uint8Array>; cancel?: () => void;
}
type CrawlTransport = (request: CrawlRequest) => Promise<CrawlResponse>;
```

As funções injetáveis são seams internos confiáveis de servidor para fixtures;
nunca devem ser aceitas de um body/API ou expostas ao cliente. O consumidor
de produção deve usar `crawlPublicSite` para coordenar validação, DNS, robots,
limites totais e deadline. `publicHttpTransport` é a camada HTTP interna,
recebe um endereço já validado e respeita o limite de stream fornecido;
isoladamente não substitui a coordenação do crawler.

Categorias compartilhadas: `company`, `segment`, `products_services`,
`prices`, `hours`, `scheduling`, `service_area`, `contacts`, `differentiators`,
`payment_methods`, `policies`, `commercial_conditions`, `faq`.

```ts
interface ImplementationFact {
  category: FactCategory; key: string; value: string; evidence_quote: string;
  source_url?: string; source_name?: string; captured_at: string;
}
interface EvidenceSource {
  source_url?: string; source_name?: string; text: string; captured_at: string;
}
normalizeEvidenceText(text: string): string;
validateFactEvidence(candidate: unknown, sources: readonly EvidenceSource[]): ImplementationFact;
validateFactsEvidence(candidates: unknown, sources: readonly EvidenceSource[]): ImplementationFact[];
```

Schemas são strict, requerem URL ou nome, aceitam somente datas ISO UTC e no
máximo 80 fatos. Key até 120 caracteres, value até 4.000, citação entre 8 e
1.000, nome até 255, URL até 2.048 e texto por fonte até 200.000. O contrato
extrativo exige que o valor caiba integralmente na citação; portanto um valor
maior que a própria citação será rejeitado mesmo dentro do teto estrutural.
Não há inferência nesta etapa. O futuro worker deve pedir valores extrativos,
usar o timestamp autoritativo fornecido e tratar ausência como pendência.
Correção manual e aprovação humana pertencem às etapas seguintes.

`public-url.ts`: `isPublicAddress`, `parsePublicUrl`, `resolvePublicDns`,
`resolvePublicAddress`. `parsePublicUrl` faz a validação sintática/literal;
hostnames só são autorizados após `resolvePublicAddress` a cada conexão.

`robots.ts`: `CRAWLER_USER_AGENT`, `parseRobots`, `robotsAllows`, tipos
`RobotsRule` e `RobotsPolicy`.

`html.ts`: `extractPublicHtml(html, pageUrl, options?: { deadline_at?: number })`,
tipo `ExtractedHtml` (`title`, `text`, `links`).

## Decisões e limites

1. Seis tentativas de página incluem páginas repetidas/falhadas; profundidade
   máxima um, quatro redirects por cadeia, 1.048.576 bytes por resposta,
   2.097.152 bytes totais (robots inclusive), 90.000 ms na coleta inteira.
   Opções somente reduzem limites; valores maiores são truncados, inválidos
   são recusados. GETs de robots/redirects têm os mesmos limites de segurança.
2. Cada conexão resolve todos os registros e rejeita qualquer IP especial ou
   família inconsistente. Escolhe um IP público e o fixa no `lookup` da
   conexão sem nova consulta. `agent:false` impede reutilização de socket.
   HTTP(S) mantém a URL original, hostname/Host/SNI padrão e
   `rejectUnauthorized:true`; nenhum fallback contorna falha de certificado.
3. IPv4 especial inclui loopback, private, link-local/metadata, CGNAT,
   documentação, benchmarking, multicast/reservado e 6to4 relay. IPv6 usa
   allowlist conservadora de unicast global, excluindo faixas especiais,
   mapped, NAT64, 6to4, documentação e ULA/link-local. Esta etapa não altera
   o guard legado de webhooks: seu risco residual não foi tratado aqui.
4. Redirect inicial pode mudar para origem pública validada; cada origem e
   caminho recebe robots antes do GET. Depois da origem final, somente links
   dessa origem são descobertos; redirect de página secundária para fora é
   recusado. Sem cookies, autenticação, scripts, login ou bypass de CAPTCHA.
5. Robots 404/410 permite coleta; outros status indisponíveis, MIME diferente
   de `text/plain`, falha de rede, limites ou decoding falham fechado. Cada
   cadeia de robots também valida IP/URL e limita redirects. Regras do arquivo
   obtido em redirect se aplicam à origem que solicitou aquele robots.
6. Robots limita 2.000 regras, caminhos com 2.048 caracteres e 4.000 diretivas
   de user-agent. Glob iterativo tem orçamento compartilhado de 100.000
   comparações por caminho; nenhum regex é gerado da entrada hostil.
   O teste com 500 wildcards e caminho de mil caracteres termina normalmente;
   excesso de regras/comparações é recusado, sem ignorar um Disallow tardio.
7. parse5 8.0.1 está fixado. Seu Parser exportado é subclassificado para
   interromper antes de inserções: até 10.000 callbacks de token, pilha de
   elementos menor que 128 e um segundo de parsing por resposta, além do
   deadline global. Traversal fica limitado por essa árvore. Esses callbacks
   são API interna do parser; qualquer atualização da dependência exige
   manter os testes de profundidade/tokens/deadline.
8. Transporte pede `Accept-Encoding: identity` e recusa compressão inesperada.
   Usa charset declarado (UTF-8 como padrão), decoding fatal; charset
   desconhecido/bytes malformados geram `unsupported_charset`. Não substitui
   bytes inválidos por caracteres de evidência. Streams cancelam ao terminar,
   no limite ou timeout. DNS/transporte/body que ignorem sinal ainda têm
   timeout no coordenador; respostas tardias são fechadas.
9. Título até 300 caracteres, texto até 200.000 e 64 links candidatos; prioriza
   main/article/body. Descarta scripts/estilos/forms/iframes/nav e conteúdo
   explicitamente oculto; usa navegação somente para achar links. Espaço entre
   células evita juntar preço/moeda. Deduplica linhas e páginas por texto.
   Hash SHA-256 final usa hashes de texto únicos ordenados, sem timestamps,
   ordem da coleta ou URL, para conteúdo idêntico permanecer estável.
10. Evidência normaliza NFKC e whitespace, preserva caixa/números/pontuação.
    Exige trecho contíguo no texto da fonte enumerada, fonte sem ambiguidade,
    data exata da captura e valor presente na citação. Isso prova atribuição
    extrativa; a adequação comercial/semântica continua sendo revisão humana.
    Fatos idênticos por categoria/key/value/fonte são deduplicados.

Erro de segurança/limite da página inicial rejeita a Promise; status, robots
negado ou conteúdo impróprio retornam resultado vazio com warnings. Falhas
secundárias retornam páginas já obtidas e warnings com códigos locais, sem
copiar mensagens arbitrárias do servidor. Consumidor precisa conferir
`pages.length` e warnings antes de considerar a importação utilizável.

## TDD e evidência local

Skills lidas: test-driven-development, writing-good-tests e
verification-before-completion. O briefing existente e a especificação foram
seguidos; não foi criado outro plano ou worktree.

O setup padrão de Vitest lê arquivos de ambiente. Para obedecer a proibição
de acessar credenciais, todas as provas usaram configuração isolada em
`C:/Users/Lenovo/.codex/tmp/vellum-task-1-vitest.config.mjs`, fora do Git:

```js
export default {
  root: "C:/Users/Lenovo/Desktop/Backup_Google_Drive/VellumAI",
  test: { environment: "node", setupFiles: [], testTimeout: 15000 },
  resolve: { alias: { "@": "C:/Users/Lenovo/Desktop/Backup_Google_Drive/VellumAI" } },
};
```

Comando RED/GREEN principal (o mesmo para ambos):

```powershell
node node_modules/vitest/vitest.mjs run tests/unit/implementations-crawler.test.ts tests/unit/implementations-evidence.test.ts --maxWorkers=1 --config C:/Users/Lenovo/.codex/tmp/vellum-task-1-vitest.config.mjs --reporter=verbose
```

RED inicial, depois de criar testes e apenas stubs sem comportamento, em
20:54:02 local, exit 1:

```text
Test Files  2 failed (2)
Tests       53 failed (53)
Duration    1.45s (setup 0ms)
```

Falhas esperadas de coleta não implementada, normalização ausente e schema
sem limites. A primeira sonda também encontrou duas rejeições não tratadas
nos testes de fake timers; o manejo do teste foi corrigido antes desse RED
limpo. Nenhum erro não tratado permaneceu.

Ciclos adicionais orientados pela self-review:

- 21:00:29: quatro falhas / 58 aprovados (62), exit 1 — cancelamento ainda
  chamava DNS, células eram coladas, segmento/agendamento ausentes.
- 21:01:31: seis falhas / 58 aprovados (64), exit 1 — acrescentados excessos
  de regras e comparações robots; corrigidos com matcher limitado.
- 21:02:57: duas falhas / 67 aprovados (69), exit 1 — bytes UTF-8 malformados
  eram substituídos e HTML no robots permitia coleta; corrigidos.
- 21:04:55: uma falha / 52 ignorados, exit 1 — stream de produção entregava
  chunk acima do orçamento. Comando focado abaixo; wrapper passou a bloquear
  o chunk e fechar stream antes da entrega.
- 21:06:58: três falhas / 70 aprovados (73), exit 1 — profundidade/tokens HTML
  e deadline no parser ainda sem proteção; corrigidos antes do GREEN final.

```powershell
node node_modules/vitest/vitest.mjs run tests/unit/implementations-crawler.test.ts --maxWorkers=1 --config C:/Users/Lenovo/.codex/tmp/vellum-task-1-vitest.config.mjs --reporter=verbose -t 'limita o stream de produção'
```

GREEN final após formatação e todas as correções, 21:07:47 local, exit 0:

```text
Test Files  2 passed (2)
Tests       73 passed (73)
Duration    2.62s (setup 0ms, tests 486ms)
```

DNS/transportes dos testes são fixtures; `node:http` e `node:https` estão
substituídos no arquivo de crawler. Os testes da camada de produção usam
streams locais em memória e conferem lookup/TLS/cancelamento; nunca abrem
conexão real. Nenhuma variável/credencial de ambiente é necessária.

Lint direto dos sete arquivos, exit 0 e nenhuma saída:

```powershell
node node_modules/eslint/bin/eslint.js lib/implementations/contracts.ts lib/implementations/public-url.ts lib/implementations/robots.ts lib/implementations/html.ts lib/implementations/crawler.ts tests/unit/implementations-crawler.test.ts tests/unit/implementations-evidence.test.ts
```

TypeScript estrito focado, exit 0 e nenhuma saída:

```powershell
node node_modules/typescript/bin/tsc --noEmit --project C:/Users/Lenovo/.codex/tmp/vellum-task-1-tsconfig.json
```

Configuração temporária de tipos estende o tsconfig original com
`incremental:false`, `plugins:[]`, `types:["node"]`, `typeRoots` absoluto do
node_modules existente, `include` apenas os cinco módulos e dois testes, e
`exclude:[]`. A primeira sonda precisou corrigir a resolução de @types do
scratch externo; então apontou uma opção Node ausente nos tipos de
RequestOptions e casts de mocks incompatíveis, corrigidos antes do exit 0.
Não foi feita checagem de tipos do repositório inteiro neste computador.

Prettier direto aplicado aos sete arquivos. `git diff --check` sem saída.
Logs completos temporários no mesmo scratch externo: `vellum-task-1-red.log`,
`-boundary-red.log`, `-parser-red.log`, `-decoder-red.log`, `-transport-red.log`,
`-html-red.log`, `-green.log`. Não contêm dados reais ou segredos.

Dependência gerada por `corepack pnpm --version` = 9.15.9 e
`corepack pnpm add parse5@8.0.1 --ignore-scripts --lockfile-only --offline`.
Uma primeira resolução com range foi substituída pela versão exata já no
store; diff final contém somente o importer novo. O parser já existente no
store foi ligado localmente por junction, sem reinstalar/substituir
node_modules. CI fará sua instalação congelada normal. pnpm emitiu avisos
preexistentes de peer de React do emoji-mart e de eslint, além do aviso de
lockfile-only; nenhum foi tratado alterando dependências alheias.

## Self-review e pendências

- Revisados os cinco módulos finais, todas as superfícies exportadas, limite
  de redução de opções, validação de cada DNS/salto, certificado/hostname,
  fechamento de streams, timeout de DNS/body, robots alvo, CPU de wildcard e
  árvore HTML, captura/hash e preservação de fontes.
- Regressões de cancelamento, HTML de tabela, decoder, robots falso, stream
  de produção e complexidade receberam RED e GREEN concretos.
- Código somente de servidor; próxima etapa deve usar contratos sem aceitar
  seams injetáveis via cliente. Nenhuma extração aprova fatos ou indexa RAG.
- A concorrência global de uma importação é responsabilidade do claim/lease
  da próxima etapa, não de um mutex local deste crawler.
- Sites só JavaScript, imagem/PDF/OCR, login/CAPTCHA, robots não conformes,
  conteúdo/compressão/codificação não aceitos ou páginas de alta complexidade
  exigem documentos com texto ou preenchimento manual. CSS externo não é
  renderizado; visibilidade só pode usar atributos/estilos explícitos.
- Heurísticas de links e preferência por main/article podem deixar conteúdo
  fora da coleta. Texto longo é truncado; ausência nunca vira fato.
- Classificação de IP IPv6 é conservadora e pode recusar destinos públicos
  especiais/túneis. Nenhum teste com certificado/DNS/rede pública real foi
  feito; a prova local cobre os contratos concretos do transporte com doubles.
- Os limites de parsing dependem dos callbacks internos da versão fixada de
  parse5; atualizar o pacote exige preservar essa proteção e os testes.
- CI completo, build, suíte inteira, banco descartável, RLS integrada, API,
  worker, RAG e prova visual ficam pendentes para as etapas seguintes/Actions.
  Esta entrega local não comprova funcionamento da funcionalidade inteira.
- Sem SQL aplicado, configuração real, publicação ou deploy; remoto de
  escrita e licença preservados. Nenhum push foi executado.

Para localizar o commit desta etapa sem congelar uma referência que ainda
não existia durante a escrita do relatório:

```powershell
git log -1 --format='%H %s' -- .superpowers/sdd/2026-10-12-implementacao-agentes/task-1-report.md
```

## Fix round 1 — revisão P1/P2, 12/10/2026

Base corrigida: `6498cccb7a06de45bbb15a23791cd68f1ce00ca5`.
Lidos integralmente os dois achados Important de `task-1-review.md`:
P1, trabalho quadrático do tokenizer antes de `onStartTag`; P2, descarte
prematuro de wildcard com `$` quando o sufixo ocorre mais de uma vez.

### Correções e decisões

- O tokenizer HTML5 agora é uma subclasse interna da versão fixada de parse5.
  Conta tentativas de atributo, inclusive duplicatas, por start/end tag e
  recusa a 129ª tentativa antes de `_createAttr`/`getTokenAttr`. Cada procura
  linear de duplicata fica restrita a no máximo 128 atributos, em vez de
  crescer com as 50.000 entradas hostis. O orçamento reinicia em cada tag.
- Verifica o deadline da coleta e o teto de um segundo do parser nas
  fronteiras de atributos e a cada 256 consumos do tokenizer, inclusive
  `_advanceBy`. Isso interrompe também nomes/valores longos antes de emitir
  a tag. As guardas anteriores de 1 MB, 10.000 callbacks e profundidade 128
  permanecem. As verificações de tempo não consomem o contador de tokens.
- O matcher robots, quando chega ao fim do padrão ancorado com texto
  restante, retoma o último wildcard disponível. A expansão continua no
  loop com o mesmo orçamento compartilhado de 100.000 comparações; padrões
  sem wildcard continuam recusando essa tentativa. `/*.php$` agora bloqueia
  `/private.php/secret.php` e o crawler faz somente o GET de robots.
- Nenhum contrato/export foi acrescentado ou alterado. `crawlPublicSite`,
  seu transporte, DNS pinado, limites de coleta e contratos de fatos/evidência
  conservam suas interfaces. Sem dependência, lockfile, DB, API ou UI novos.

### RED genuíno antes das correções

Quinze casos novos foram adicionados somente ao teste de crawler: tag com
50.000 atributos distintos; deadlines controlados durante atributos e um
valor de 50.000 caracteres; duplicatas; controle HTML5 com entidades,
valores citados e orçamento por tag; oito combinações de âncora/wildcard;
recusa efetiva do GET; orçamento de expansão ao procurar um sufixo final.

O caso perigoso executa em processo filho com watchdog externo de 5.000 ms,
`windowsHide:true` e ambiente mínimo (somente SystemRoot). O script importa
apenas o extrator local, gera HTML de fixture e mede o tempo do parser; não
carrega setup, `.env`, credenciais nem rede. Assim o RED não bloqueia
indefinidamente o processo Vitest. Os deadlines controlados avançam Date.now
uma unidade por verificação, sem depender de sleeps/velocidade do computador.

Comando efetivamente executado (exit 1; log completo no scratch externo):

```powershell
node node_modules/vitest/vitest.mjs run tests/unit/implementations-crawler.test.ts --maxWorkers=1 --config C:/Users/Lenovo/.codex/tmp/vellum-task-1-vitest.config.mjs --reporter=verbose *> C:/Users/Lenovo/.codex/tmp/vellum-task-1-fix-1-red.log; $testExit = $LASTEXITCODE; Get-Content C:/Users/Lenovo/.codex/tmp/vellum-task-1-fix-1-red.log | Select-Object -Last 90; exit $testExit
```

```text
Test Files  1 failed (1)
Tests       9 failed | 62 passed (71)
Start at    21:20:22
Duration    6.49s (transform 216ms, setup 0ms, import 543ms, tests 5.51s)
```

Falhas observadas: processo de 50.000 atributos encerrado com ETIMEDOUT após
5.057 ms de teste; dois deadlines e orçamento de duplicatas não lançavam
erro; três sufixos repetidos eram permitidos; o crawler coletava a página
Disallow; a expansão ancorada não atingia o orçamento porque retornava cedo.
Os controles de sufixo diferente, query, padrão sem wildcard e HTML5 comum
passaram já no RED. Não houve erro não tratado nem uso de rede real.

### GREEN e verificações focadas

Depois de implementar as duas correções e aplicar Prettier aos três arquivos:

```powershell
node node_modules/vitest/vitest.mjs run tests/unit/implementations-crawler.test.ts tests/unit/implementations-evidence.test.ts --maxWorkers=1 --config C:/Users/Lenovo/.codex/tmp/vellum-task-1-vitest.config.mjs --reporter=verbose *> C:/Users/Lenovo/.codex/tmp/vellum-task-1-fix-1-green.log; $testExit = $LASTEXITCODE; Get-Content C:/Users/Lenovo/.codex/tmp/vellum-task-1-fix-1-green.log | Select-Object -Last 30; exit $testExit
```

```text
Test Files  2 passed (2)
Tests       88 passed (88)
Start at    21:22:43
Duration    2.78s (transform 238ms, setup 0ms, import 720ms, tests 1.29s)
```

Exit 0: 71 casos de crawler e 17 de evidência. O teste do subprocesso
completou em 893 ms incluindo inicialização, e verificou dentro do filho
`html_complexity_limit` com duração do parser inferior a 1.000 ms. Os dois
deadlines controlados lançaram `crawl_timeout`; duplicatas lançaram
`html_complexity_limit`; a expansão ancorada hostil lançou
`robots_complexity_limit`. DNS, redirects, streams, timeout e evidência
anteriores continuaram aprovados. Evidência não precisou de alteração.

Lint direto e TypeScript estrito focado: cada comando retornou exit 0, sem
saída. Usaram as mesmas configurações sem `.env` descritas nesta entrega.

```powershell
node node_modules/eslint/bin/eslint.js lib/implementations/contracts.ts lib/implementations/public-url.ts lib/implementations/robots.ts lib/implementations/html.ts lib/implementations/crawler.ts tests/unit/implementations-crawler.test.ts tests/unit/implementations-evidence.test.ts
node node_modules/typescript/bin/tsc --noEmit --project C:/Users/Lenovo/.codex/tmp/vellum-task-1-tsconfig.json
```

### Self-review e limites desta rodada

Inspecionados os hooks concretos do tokenizer de parse5 8.0.1: `_consume`,
`_advanceBy`, `_createStartTagToken`, `_createEndTagToken`, `_createAttr` e
`_leaveAttrName`; as subclasses só atuam antes de chamar os métodos originais.
O `Parser` é usado para documento completo, de modo que o tokenizer é
substituído imediatamente após a inicialização, antes de qualquer write.
Revisados resets por tag, tentativas duplicadas, prioridade de timeout,
valores citados, texto/entidades e a manutenção do orçamento de robots.

A afirmação histórica de proteção somente por callbacks foi corrigida por
esta rodada: as guardas agora atuam também no tokenizer, antes da procura
linear de atributos. Continuam dependentes dos hooks internos da versão
fixada; atualizar parse5 exige revalidar esses caminhos e regressões. HTML
com mais de 128 tentativas de atributos por tag é deliberadamente recusado,
mesmo quando legítimo. O orçamento de robots também pode recusar padrões
legítimos excessivamente caros, preservando o comportamento fail-closed.

CI completo, rede/TLS real e integração posterior continuam pendentes.
Não foram executados suíte inteira, build, DB ou push. Nenhum arquivo de
outra tarefa foi editado. Continuidade registra apenas esta correção da
etapa 1; os relatórios de revisão permanecem sob controle do coordenador.
