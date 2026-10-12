# Trabalho no GitHub

Destino autorizado pelo usuário: https://github.com/vellumestrategia-hash/vellumia. O histórico importado e a licença MIT são preservados. Os repositórios de origem não são remotos de escrita.

## Continuidade

O código, requisitos, plano, relatório, testes e evidências públicas ficam no Git. AGENTS.md aponta para CONTINUIDADE.md: esse arquivo registra decisões, validações e próximos passos para retomar sem depender da memória da conversa. Atualizar o registro ao concluir uma etapa e versionar alterações coerentes.

Arquivos privados `.env*` (exceto templates), dependências, builds, logs e sessões permanecem ignorados. As chaves do projeto não devem ser colocadas em commits, screenshots, issues ou saídas do Actions. Um clone novo precisa de sua própria configuração de ambiente.

## Verificações na nuvem

Os workflows automáticos em push de main e pull request são:

- `ci`: TypeScript completo, lint, guard de canais, suíte unitária completa, scripts de instalação e isolamento/invariantes em PostgreSQL 15 descartável. O job de banco aplica o baseline em instalação e atualização.
- `perf`: build de produção com Webpack, heap de 6144 MB e paralelismo reduzido; depois Playwright e Axe nas páginas públicas em desktop e celular. Publica somente evidências dessas telas como artifact.
- `e2e`: jornadas autenticadas existentes em três runners com Supabase local e banco descartável. As specs excluídas e os motivos continuam declarados no próprio workflow.

Os jobs utilizam placeholders ou credenciais do Supabase local descartável. Não recebem a service_role, URL de banco ou chave Asaas da empresa. As validações financeiras unitárias usam PostgreSQL embarcado e mocks do gateway; não equivalem à homologação Asaas.

Concorrência cancela a execução anterior da mesma branch quando chega um novo push. Também é possível disparar os três workflows manualmente pela aba Actions. Verificar o SHA, conclusão e logs antes de registrar um check como aprovado.

Os quatro workflows herdados de publicação de imagens, release, relógio e acolhida ficam restritos por condição de repositório à origem. Não publicam imagens, tags, mensagens nem chamam cron nesta distribuição. A publicação própria de imagens de produção depende de uma etapa posterior de implantação e homologação.

## Desenvolvimento inteiramente remoto

A configuração em `.devcontainer/devcontainer.json` prepara Node 22, pnpm fixado, Docker e a porta 3010, com requisito de 4 CPUs/8 GB. Para usar, abrir um Codespace deste repositório. Nenhum Codespace foi criado nesta etapa; salvar no GitHub e executar Actions não move automaticamente o editor atual para uma máquina remota.

No ambiente remoto, criar `.env.local` privado seguindo `.env.example`, preencher as credenciais necessárias e executar:

```sh
npx --yes pnpm@9.15.9 dev --port 3010
```

Até configurar banco e integrações, somente a prévia pública funciona. Não executar resets ou testes descartáveis contra o Supabase da empresa.
