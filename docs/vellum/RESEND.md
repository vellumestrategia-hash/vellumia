# E-mails de acesso da Véllum AI — Resend Free

Estado em 12/10/2026: opção gratuita escolhida pelo proprietário. A conexão
SMTP ainda não foi aplicada; falta cadastrar e verificar o domínio de envio.
O Supabase mantém a confirmação de e-mail obrigatória.

O proprietário confirmou acesso ao painel do domínio e forneceu uma chave
restrita a envio. A consulta de domínios recebeu HTTP 401 `restricted_api_key`
com a mensagem de restrição a envio; isso não significa chave inválida.
Ela foi mantida somente em memória privada, sem arquivo ou commit.
O painel do Resend no Chrome ainda mostra login. Foi solicitado que o
proprietário abra Domains na mesma conta dessa chave e deixe o painel
autenticado, para cadastrar o domínio sem ampliar as permissões da chave.

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

Proposta de remetente, ainda não cadastrada:

| Campo | Valor proposto |
| --- | --- |
| Domínio de envio | `auth.vellumestrategia.com.br` |
| Endereço de envio | `acesso@auth.vellumestrategia.com.br` |
| Nome exibido | Véllum AI |

O subdomínio mantém os e-mails de acesso separados dos outros envios da marca.
O remetente acima não é uma caixa de suporte. Se houver necessidade de receber
respostas, usar um endereço atendido pela equipe na configuração adequada.

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
O Supabase recusou a alteração de modelos enquanto o projeto Free usava
o remetente padrão; a tentativa anterior não foi aplicada.

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
