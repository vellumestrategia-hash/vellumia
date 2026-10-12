# Cadastro, acesso e primeira experiência — Véllum AI

Revisão de 12/10/2026, solicitada pelo proprietário após uma conta de empresa
ficar parada na tela Perfil. Este documento trata a Véllum cadastrada nessa
conta como empresa de teste, separada da administração da plataforma.

## Bloqueio reproduzido e causa

Na sessão real do Chrome, `/app/settings/profile` mostrava o perfil com a
navegação principal vazia. O menu da conta oferecia apenas Sair. A pessoa estava
autenticada, mas não tinha vínculo com uma empresa. `homeDaInterface()` devolvia
Perfil quando não encontrava destino permitido; `/app` usava esse resultado
também para uma conta sem organização. O layout não interceptava esse estado.

O formulário existente em `/get-started` encontrou o nome informado no cadastro.
O proprietário autorizou testar esse cadastro de empresa; o formulário foi
enviado na própria sessão, criando Véllum Estratégia e levando a
`/onboarding/welcome`. Não houve promoção a administrador da plataforma,
mudança de senha ou alteração manual de tabelas. O aceite dos termos e as
escolhas seguintes da conta real permanecem com a pessoa.

## Correções

- Login de cliente sem empresa chega à configuração da empresa. Todas as
  páginas do CRM compartilham esse desvio, inclusive um acesso direto ao Perfil.
- Administrador da plataforma sem vínculo chega à administração ao entrar
  pelo login comum. Seu perfil pessoal permanece acessível, e não precisa criar
  uma empresa para operar a plataforma.
- Configuração inicial conserva o nome já informado, explica o próximo passo
  e oferece Sair e usar outra conta. Convites continuam com validação própria;
  o formulário não concede acesso à empresa de outra pessoa.
- Menu da conta oferece início e perfil. O perfil tem caminho de volta,
  layout para celular, e-mail legível e mensagens junto aos campos inválidos.
  O salvamento informa sucesso ou falha sem exibir mensagens internas do banco.
- Foto pessoal pede o endereço de uma imagem e explica que o site da empresa
  não é uma foto. Campo vazio mantém as iniciais; upload ainda não existe.
- Logo na barra lateral usa a mesma superfície legível da administração,
  inclusive em tema escuro. As mensagens de boas-vindas falam de espaço de
  trabalho, sem atribuir uma instalação de servidor ao cliente SaaS.
- Erro de confirmação por e-mail continua registrado com sua causa na
  auditoria, mas o login orienta a pessoa sem pedir execução de um script.
- Avisos temporários aparecem no canto inferior. O E2E encontrou os avisos
  de salvar/validar sobre o botão Publicar do construtor de follow-up; o cursor
  mantinha o aviso aberto e impedia clicar na ação. A posição foi corrigida
  no produto, conservando o fechamento manual, a duração e as mensagens.

## Verificação e evidência

O teste de regressão do destino de `/app` foi executado antes da correção:
cliente sem empresa recebeu Perfil, e administrador sem empresa recebeu Inbox.
Depois da correção, os casos passam e mantêm o destino de clientes com empresa
e de quem usa uma interface personalizada por vínculo.

Validação local: 18 casos em quatro arquivos aprovados, incluindo perfil com
URL inválida, discriminação da recusa do link e cobertura de tradução espanhola.
Build, suíte completa, isolamento e navegação com banco descartável são do
GitHub Actions, para preservar os recursos do computador local. A aprovação do
SHA deve ser registrada em CONTINUIDADE.md depois da execução.

O SHA `f511aa9c` aprovou TypeScript, lint, 8.022 testes unitários (um caso de
falha esperada existente na suíte), invariantes e build/validação pública.
A partes 1 e 3 do E2E também aprovaram, incluindo a jornada completa de cadastro,
perfil móvel com Axe, saída real e novo login. A parte 2 identificou a sobreposição dos
avisos na publicação; suas 94 aprovações não tornam a execução verde.
A correção da posição dos avisos requer os checks do próximo SHA.

As provas de navegador incluem:

| Percurso | Prova |
| --- | --- |
| Cadastro e confirmação | signup-journey: formulário e e-mail real do Mailpit |
| Primeiro acesso sem vínculo | primeiro-acesso-sem-organizacao: login, URL direta, recuperação e saída |
| Configuração e uso do CRM | signup-journey: boas-vindas, integrações adiadas, quadro pronto, entrada no atendimento |
| Perfil e retorno | signup-journey: salvar, feedback, celular, Axe, início, saída real e novo login |
| Recuperação de senha | password-recovery e reset-password-mfa: e-mail, senha nova, senha antiga recusada e MFA |
| Convite e isolamento | invite-lifecycle, rbac-roles, inbox-scope e invariants |
| Administrador sem empresa | organizacoes-criacao-convite-e-cache: login comum, desktop, celular, foco, saída e zero vínculos |

O helper de e-mail deixou de reescrever a origem ou o caminho do link recebido.
Agora uma configuração de Site URL/Redirect URLs incorreta faz o teste falhar,
em vez de o teste reparar o e-mail que deveria validar. Evidências da jornada
ficam no artifact `vellum-acesso-<SHA>` do Actions; contêm somente fixtures do
ambiente descartável. Capturas da conta real não são versionadas.

## Limites e próximos cuidados

O Supabase do proprietário e o Supabase descartável são ambientes distintos.
A prova do Mailpit não comprova a entrega ao Gmail nem a configuração dos
templates hospedados do projeto real. Em 12/10/2026, o token de gerenciamento
fornecido pelo proprietário permitiu consultar e ajustar o projeto real.
O Site URL estava em `http://localhost:3000`, com a allowlist vazia. Foi
atualizado para `http://localhost:3010`, com `/auth/confirm` e `/**` permitidos
nessa origem local. A leitura posterior confirmou a alteração. Quando houver
um domínio publicado, registrar a origem HTTPS correspondente antes do teste
comercial; os endereços locais atuais servem ao desenvolvimento.

Os modelos de confirmação e recuperação ainda eram os padrões que usam
`ConfirmationURL`. A Management API recusou a atualização com HTTP 400:
"Email template modification is not available for free tier projects using
the default email provider." O projeto não tem SMTP próprio configurado.
É necessário configurá-lo para aplicar os modelos `RedirectTo`/`TokenHash`
da Véllum e testar a entrega real. A tentativa recusada não alterou os modelos;
a confirmação de e-mail continua obrigatória. O backup dos seis campos
alteráveis está fora do Git, sem token nem credencial SMTP.

Um provedor com plano gratuito permite manter o Supabase Free.
O [Resend](https://resend.com/pricing) oferece 3.000 e-mails/mês e 100/dia na
consulta de 12/10/2026. Sua [integração SMTP](https://resend.com/docs/send-with-smtp)
exige chave de API e domínio verificado.
O [envio padrão do Supabase](https://supabase.com/docs/guides/auth/auth-smtp) é restrito aos endereços da
equipe do projeto e não atende ao cadastro de clientes externos.

Para configurar Resend, caso seja a opção escolhida: verificar um domínio de
envio com os registros DNS informados pelo provedor; criar chave restrita ao
envio; configurar no Supabase `smtp.resend.com`, porta `465`, usuário `resend`,
chave como senha, remetente no domínio verificado e nome Véllum AI. Desativar
rastreamento de links no provedor. Não usar o remetente de demonstração do
Resend para clientes externos. Depois aplicar os dois modelos renderizados,
conferir as URLs e testar confirmação e recuperação com uma conta descartável.
Não ativar upgrade nem cobrança para essa configuração. As credenciais devem
ficar em armazenamento privado, nunca na documentação ou no Git.

O aviso anterior sobre link por PKCE ainda depende dessa configuração; a
confirmação por token_hash permanece o contrato do projeto. Não houve
relaxamento de cookies, RBAC ou RLS.

É possível concluir a configuração e usar o CRM adiando WhatsApp, IA e convites.
Isso não ativa atendimento automático: IA, Meta e cobrança precisam de suas
credenciais e da homologação descrita em FINANCEIRO.md. Testes de interface
sem esses provedores não comprovam envio oficial, resposta de um modelo pago
ou pagamento. A contratação comercial continua pendente desses testes.

Prioridades seguintes de experiência: ativação assistida do WhatsApp oficial,
configuração da IA pela plataforma sem exigir uma chave de cada cliente,
recuperação/reenvio de confirmação com orientação visível, e estados de
contratação que expliquem os pagamentos e prazos sem linguagem de infraestrutura.
Nenhuma migration SQL nova é necessária para as correções desta revisão.
