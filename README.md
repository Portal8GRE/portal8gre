# Portal 8ª GRE — V0.5

Versão de produção com autenticação real pelo Supabase, conexão automática pela Vercel e avanço do módulo de Transporte e permissões.

## Novidades da V0.5

- Mantido somente login real; não existe modo demonstração.
- Transporte com calendário e lista.
- Todos os usuários ativos podem visualizar a agenda de Transporte.
- Usuários podem solicitar transporte.
- O solicitante pode editar ou cancelar a própria solicitação enquanto ela estiver em **Solicitado**.
- Gerência e Administrador podem confirmar, editar, marcar como realizado ou cancelar qualquer agendamento.
- Bloqueio de conflito de horário para o mesmo veículo.
- Painel **Usuários e Permissões** para Gerência/Administrador:
  - nome;
  - perfil;
  - setor;
  - escola vinculada;
  - ativo/inativo.
- Usuário marcado como inativo não consegue permanecer logado no Portal.
- RLS reforçada para reduzir alterações indevidas.

## IMPORTANTE — atualização do Supabase

Se você já usa o banco das versões anteriores, execute **uma vez** no SQL Editor:

`supabase/update-v05.sql`

Essa atualização preserva os registros existentes e apenas acrescenta/ajusta campos, funções e políticas de segurança.

## Como cadastrar um novo usuário

Nesta versão, a conta de login continua sendo criada com segurança em:

**Supabase → Authentication → Users → Add user**

Ao criar a conta, o perfil é gerado automaticamente. Depois entre no Portal como Administrador ou Gerência e abra **Usuários** para escolher perfil, setor e escola.

## Vercel

Mantenha as Environment Variables já configuradas:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

Não use `service_role`, `sb_secret_...` ou outra chave secreta no navegador.

## Publicação

Substitua os arquivos do mesmo repositório GitHub pelos desta versão e faça commit na branch principal. A Vercel fará um novo deployment automaticamente.
