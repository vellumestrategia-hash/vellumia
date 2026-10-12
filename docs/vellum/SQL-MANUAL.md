# SQL manual no Supabase

Projeto: dchhxzssxkrvqqmozydv. O proprietário prefere receber os scripts e executá-los no SQL Editor. A chave privada fica somente no ambiente do servidor; senhas nunca entram no SQL nem no Git.

## Instalação inicial

1. Execute `sql/01_preparar_supabase.sql` como postgres. Ele instala as extensões necessárias e recusa um banco que já tenha o schema da plataforma. Se uma extensão já existir em outro schema, a operação falha sem movê-la; encaminhe o erro para avaliar as dependências.
2. Gere as partes com `node scripts/vellum-sql-editor.mjs <pasta-de-saida>` e execute os arquivos `02_01`, `02_02` e seguintes, em ordem, cada um em uma consulta. O baseline ultrapassa o limite do SQL Editor; o gerador preserva comandos inteiros, inclusive corpos de função e comentários, e limita cada arquivo a 700 KB em UTF-8. Cada parte tem sua transação e configuração de sessão; tabelas e funções ficam protegidas durante a instalação parcial. Não crie stubs de Auth/Storage: o Supabase já fornece esses recursos. Em caso de erro, interrompa a sequência e encaminhe o erro; não execute o SQL do administrador até todas as partes concluírem.
3. Execute `sql/03_administrador.template.sql` após preencher o e-mail do usuário já criado e confirmado em Supabase Auth. Ele cria a organização Véllum AI, o vínculo admin e o papel transversal full, com auditoria. Preserva uma exigência de MFA existente e não muda a senha.

A instalação só será confirmada depois de consultar as tabelas pela API autenticada, verificar o papel do administrador e testar o acesso às telas. Um script preparado ou a conta criada em Auth ainda não comprova esses passos.

## Atualizações

Toda alteração de banco deve entregar a migration específica, numerada no MANIFEST, junto de instruções sobre ordem e pré-requisitos. Informar o SQL ao proprietário antes de depender do schema novo. A migration financeira atual é `supabase/migrations/20261012010000_0232_vellum_billing.sql`; ela já está incluída na instalação completa, portanto não precisa ser executada separadamente depois do baseline.
