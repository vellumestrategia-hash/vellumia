# Véllum AI

Plataforma de agentes comerciais de IA, WhatsApp e CRM multiempresa. Base importada do DeskcommCRM sob licença MIT. Repositório desta distribuição: [vellumestrategia-hash/vellumia](https://github.com/vellumestrategia-hash/vellumia).

Para continuar o desenvolvimento, leia [o estado e as próximas etapas](docs/vellum/CONTINUIDADE.md). Build, testes completos e banco descartável estão configurados no [GitHub Actions](https://github.com/vellumestrategia-hash/vellumia/actions). Os resultados de execução são a referência para aprovação; a existência do workflow não significa que os checks passaram.

## Começar

Node 22+ e pnpm 9.15.9. A configuração local está em `.env.local` (não versionado).

```powershell
npx --yes pnpm@9.15.9 install --frozen-lockfile
npm run dev -- --port 3010
```

Abra http://localhost:3010. Landing, preços, login e cadastro usam a identidade Véllum. O cadastro real e os módulos administrativos dependem da chave privada e do schema Supabase aplicado.

- [Trabalho no GitHub e Codespaces](docs/vellum/GITHUB.md)
- [Plano técnico e auditoria](docs/vellum/PLANO-TECNICO.md)
- [Execução local, Supabase e deploy](docs/vellum/EXECUCAO-LOCAL.md)
- [Relatório de validação e fases](docs/vellum/RELATORIO.md)
- [Contrato financeiro e homologação sandbox](docs/vellum/FINANCEIRO.md)
- [Documentação original preservada](README.upstream.md)
- [Licença MIT original](LICENSE) e [atribuição](NOTICE-VELLUM.md)

Planos editáveis, contratação recorrente Asaas sandbox, faturas, conciliação idempotente e medição de conversas estão implementados localmente. A jornada remota ainda exige configuração e homologação. Cupons, créditos adicionais, alterações/cancelamento de assinatura e emissão de excedentes seguem no roteiro financeiro. Não declarar esta versão pronta para comercialização antes de validar banco, isolamento e integrações reais.
