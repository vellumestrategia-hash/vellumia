# E-mails de acesso da Véllum AI — Resend Free

Estado em 12/10/2026: domínio `auth.vellumestrategia.com.br` cadastrado na conta
Resend autenticada pelo proprietário, região São Paulo. Os três registros foram
adicionados na zona HostGator e conferidos no DNS público. DKIM, os dois CNAMEs
e o domínio estão Verified no Resend. Eventos DNS verified às 15:09 e Domain
verified às 15:12 no horário local; domínio pronto para envio.

SMTP personalizado aplicado no Supabase, com a chave nova indicada pelo
proprietário e remetente `acesso@auth.vellumestrategia.com.br`. Modelos de
confirmação e recuperação aplicados com marca e contrato RedirectTo/TokenHash.
Leitura de retorno confirmou host, porta 465, remetente e ambos os modelos.
A confirmação de e-mail continua obrigatória. Pedido de recuperação via Supabase
Auth para o e-mail administrador indicado pelo proprietário aceito sem erro.
O painel Resend mostrou Delivered para esse e-mail, assunto "Redefina sua senha
- Véllum AI", ID 01a13154-76d9-7891-9edf-515c91dc0855. Nenhum link foi consumido
nem senha alterada. Delivered comprova aceite pelo servidor de destino; caixa de
entrada/spam e a troca de senha continuam dependentes da ação do proprietário.
O percurso completo de confirmação/recuperação já tem prova descartável em CI;
esse envio prova a conexão SMTP real, sem criar usuários de teste no projeto real.

O proprietário confirmou acesso ao painel do domínio e forneceu uma chave
restrita a envio. A consulta de domínios recebeu HTTP 401 `restricted_api_key`
com a mensagem de restrição a envio; isso não significa chave inválida.
A chave anterior foi desconsiderada a pedido do proprietário. A substituta
também é limitada ao envio: cadastro de domínio foi realizado pela sessão
autenticada do navegador interno, sem ampliar seu acesso. Nenhuma chave foi
gravada no Git ou nesta documentação; a substituta foi armazenada no campo
privado de senha SMTP do Supabase para a conexão autorizada.

## O que é necessário

Não é necessário contratar nem acessar uma caixa de e-mail do domínio.
O Resend envia depois que o domínio é autorizado pelo DNS. A conta do
Resend pode usar o e-mail pessoal do proprietário. O acesso ao painel de
DNS, ou a ajuda de quem o administra, é necessário para essa autorização.
Receber respostas nesse endereço é uma configuração separada.

A consulta pública de DNS em 12/10/2026 retornou `dns3.hostgator.com.br` e
`dns4.hostgator.com.br` para `vellumestrategia.com.br`. O painel que gerencia
essa zona deve permitir adicionar os registros; a consulta não comprova
que o proprietário já possui acesso a esse painel.

Remetente configurado:

| Campo | Valor |
| --- | --- |
| Domínio de envio | `auth.vellumestrategia.com.br` |
| Endereço de envio | `acesso@auth.vellumestrategia.com.br` |
| Nome exibido | Véllum AI |

O subdomínio mantém os e-mails de acesso separados dos outros envios da marca.
O remetente acima não é uma caixa de suporte. Se houver necessidade de receber
respostas, usar um endereço atendido pela equipe na configuração adequada.

Domínio Resend: `ed191c77-6ec0-47a8-a2d3-b265d301fd75`. Registros criados:

| Tipo | Nome na HostGator | Valor |
| --- | --- | --- |
| TXT | `resend._domainkey.auth` | Chave DKIM pública gerada para esse domínio; comparação exata com DNS público aprovada |
| CNAME | `rsend.auth` | `rsend-sae1.forge.rmta.net` |
| CNAME | `send.auth` | `send.forge.rmta.net` |

TTL 14400, padrão do painel. O TXT completo e as provas ficam em
`C:/Users/Lenovo/.codex/tmp/VellumAI-auth/REGISTROS-RESEND.md` e
`hostgator-dns.jpg`, fora do Git. Registros de site, Brevo e Titan existentes
foram preservados. Recebimento pelo Resend e subdomínio de tracking não foram
ativados; a aba Configuration oferece criar tracking, sem subdomínio existente.

## Conta e DNS

1. Entrar ou criar a conta em [Resend](https://resend.com/login), no plano Free.
2. Em [Domains](https://resend.com/domains), adicionar o domínio de envio.
3. Copiar os registros da aba Records para o painel de DNS. Os nomes, tipos,
   valores e prioridades devem ser exatamente os gerados para esse domínio.
   Não substituir registros do site ou do serviço de e-mail existente.
4. Pedir a verificação no Resend e aguardar a confirmação do envio. Recebimento
   de mensagens pelo Resend não é necessário para a autenticação do sistema.
5. Manter rastreamento de cliques e de abertura desativados para esses e-mails.
6. Em [API Keys](https://resend.com/api-keys), criar uma chave de envio limitada
   ao domínio verificado. Guardar somente em armazenamento privado.

Os registros são gerados por conta/domínio; não há valores universais para
colar. O Resend pode mostrar TXT/MX ou CNAME para autorizar o envio.
Quem controla o DNS deve usar a aba Records como referência.

## Conexão ao Supabase

Configurar o provedor SMTP personalizado em Authentication / Emails do
projeto `dchhxzssxkrvqqmozydv`, ou pela Management API já autorizada.

| Campo | Valor |
| --- | --- |
| Host | `smtp.resend.com` |
| Porta | `465` (TLS) |
| Usuário | `resend` |
| Senha | Chave de API de envio do Resend |
| Remetente | Endereço do domínio cuja verificação terminou |
| Nome | Véllum AI |

A senha acima é a chave do Resend; não é a senha de Gmail, da caixa de e-mail
ou do usuário da aplicação. Não usar chave pública ou service_role do
Supabase nesse campo. Não gravar nenhum desses segredos na documentação,
no Git ou no código do navegador. A aplicação continua usando Supabase Auth;
essa conexão não exige adicionar outra biblioteca ao sistema.

Depois de ativar o SMTP, aplicar os modelos de confirmação e recuperação de
`supabase/templates`, renderizados com a marca Véllum. Os links precisam
preservar `RedirectTo` e `TokenHash` conforme o contrato de `/auth/confirm`.
O Supabase havia recusado os modelos com o remetente padrão. Depois de salvar
o SMTP personalizado, a alteração dos dois modelos foi aceita no plano Free.
Na Management API, `smtp_port` é string (`"465"`); número foi recusado sem aplicar
a alteração. Nenhuma regra de autenticação ou limite foi desativada.

## Endereços e prova de funcionamento

A instalação local usa Site URL `http://localhost:3010` e Redirect URLs dessa
origem. Ao publicar, configurar a origem HTTPS do sistema, seu `/auth/confirm`
e os destinos de retorno antes de enviar convites aos clientes. Um e-mail
com link localhost só abre o sistema no computador onde ele está rodando.

Validar pelo formulário do sistema: cadastro, recebimento e confirmação do
e-mail, criação de empresa, entrada no CRM, saída e novo acesso. Em seguida,
testar recuperação de senha, definição da nova senha, recusa da antiga e
erro compreensível para link vencido ou já utilizado. Conferir a entrega
no Resend e na caixa de destino; a prova de Mailpit no CI é independente
da entrega real. Não redefinir a senha de uma conta real para essa prova.

O plano Free consultado oferece 3.000 e-mails por mês e 100 por dia. Verificar
também os limites de envio do Supabase; conectá-lo ao SMTP não remove suas
limitações. Não ativar upgrade ou cobrança para esta configuração.

Referências: [domínios verificados](https://resend.com/docs/dashboard/domains/introduction),
[registros DNS](https://resend.com/docs/dashboard/domains/manage-domains),
[SMTP](https://resend.com/docs/send-with-smtp),
[plano Free](https://resend.com/pricing) e
[SMTP personalizado no Supabase](https://supabase.com/docs/guides/auth/auth-smtp).
