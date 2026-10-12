# Refinamento UI/UX Véllum

Direção de 12/10/2026, autorizada pelo proprietário. Aplicação de UI UX Pro Max (nextlevelbuilder/ui-ux-pro-max-skill), frontend-design, design-critique e design-system. A pesquisa sugere hierarquia, confiança e conversão; a identidade existente prevalece sobre cores, fontes e efeitos genéricos sugeridos pelo catálogo.

## Direção e critérios

Editorial, preciso e acolhedor. Creme #F5F0E6, azul #0C1F33 e vermelho #9E2B25, selo original sem distorção. Fraunces em títulos de apresentação, Archivo em conteúdo e controles, IBM Plex Mono em indicadores técnicos. Painéis autenticados usam tokens semânticos existentes e a marca resolvida do banco, preservando tema escuro e marcas das empresas.

Espaçamento em múltiplos de 4, margens móveis de 20–24px, largura pública máxima de 1280px, texto corrido com medida limitada. Um único acento visual: conversa e contexto lado a lado, ligados por uma sequência que pode ser explorada. Sem métricas, depoimentos ou clientes inventados; exemplos de produto identificados como ilustrativos.

## Diagnóstico e implementação

- Landing: o registro estático mostra uma conversa, mas explica pouco a passagem entre atendimento e operação. Substituir por uma demonstração controlada por três botões, sem chamada de IA nem rotação automática. Manter conteúdo inicial no HTML e preços vindos do catálogo real.
- Navegação pública: no celular, itens desaparecem sem alternativa. Entregar menu com foco contido, fechamento por Escape e retorno ao gatilho. Ações principais de 44px ou mais; links e foco legíveis.
- Plataforma: nomes misturam inglês e português e a volta para o app presume vínculo com empresa. Agrupar operações, governança e configuração; explicitar a abrangência global. Conta e saída acessíveis no topo. A conta Véllum pode operar sem pertencer a uma empresa.
- Visão geral: uma falha na consulta mantinha carregamento indefinido. Diferenciar carregamento, erro com repetição, atualização com dados existentes e ausência real de empresas. Mostrar atalhos de operação que já existem.
- Empresas: manter a separação dos acessos e a densidade medida do menu. Melhorar identificação do espaço de trabalho, seleção ativa e acabamento da casca compartilhada, sem alterar módulos ou permissões.

## Estados e acessibilidade

Botões com seleção anunciada, navegação com aria-current, ícones decorativos ocultos, uma h1 por página, estados de erro com mensagem útil. Nenhuma informação exclusivamente por cor. Sem animação essencial; respeitar prefers-reduced-motion. Contraste normal mínimo 4,5:1. Manter responsividade, zoom, idioma espanhol, teclado e drawer. A seleção da demonstração não desloca o foco.

## Verificação

Testes locais focados em comportamento e contratos de idioma; inspeção visual em desktop e celular pela interface real. Build, suíte completa, isolamento e E2E no Actions do repositório autorizado. Não executar build pesado nesta máquina. Registrar evidências e limites em CONTINUIDADE.md. Este refinamento não requer alteração SQL.

Aceite concluído para c488914b: build, suíte unitária, isolamento e as três partes E2E aprovados. Validação pública com Axe em quatro larguras e prova de administrador sem empresa em desktop/celular/escuro aprovadas. A demonstração continua ilustrativa; indicadores autenticados vêm do banco. O resumo com runs e artifacts está em CONTINUIDADE.md.
