# Portal 8ª GRE — v0.4

Versão integrada do Portal 8ª GRE com conexão automática ao Supabase na Vercel e calendário de Transporte.

## Novidades da v0.4
- Conexão automática com o Supabase para todos os computadores e celulares.
- Usuário não precisa mais informar Project URL nem Publishable Key.
- Credenciais públicas são lidas das Environment Variables do projeto na Vercel.
- Mantido fallback de configuração manual apenas para testes técnicos.
- Tela de login informa o status da conexão.
- Mantidos calendário mensal de transporte, S10/Logan/Polo, conflito de horário, escolas, visitas e Gestão.

## Configuração única na Vercel
No projeto `portal8gre`, abra **Environment Variables** e crie:

1. `SUPABASE_URL`
   - Valor: Project URL do Supabase, no formato `https://xxxxxxxx.supabase.co`

2. `SUPABASE_PUBLISHABLE_KEY`
   - Valor: chave pública que começa com `sb_publishable_...`

Marque os ambientes desejados (Production, Preview e Development; para começar, ao menos Production).
Depois faça um novo deployment/redeploy.

A partir daí, qualquer usuário que abrir o Portal precisará apenas de e-mail e senha.

> Nunca cadastre `service_role`, `sb_secret_...` ou outras chaves secretas nesta API pública.

## Supabase
A v0.4 usa as mesmas tabelas do banco da v0.3. Não é necessário executar novamente o `schema.sql` se o banco já foi criado.

## Publicação
Substitua os arquivos do repositório GitHub pelos desta versão e faça commit na branch principal. A Vercel fará o deployment automaticamente.
