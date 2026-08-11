# Portal 8ª GRE — V0.6

Versão de produção com autenticação Supabase, conexão automática pela Vercel e atualização do módulo de Agendamento de Transporte.

## Novidades da V0.6

- Agendamento de Transporte exclusivo da Gerência Regional (Administrador mantém acesso técnico).
- Coordenação, técnicos e escolas ficam em modo somente visualização no Transporte.
- Gerência pode criar, editar, cancelar, marcar como realizado e excluir agendamentos.
- Após excluir, o sistema reabre a agenda do mesmo dia com opção de criar novo agendamento.
- Alerta amarelo quando já existe viagem para a mesma escola ou município na mesma data, sugerindo compartilhamento de veículo e/ou horário.
- Mantido bloqueio de conflito quando o mesmo veículo já está ocupado no intervalo informado.
- Auditoria automática de INSERT, UPDATE e DELETE do Transporte no `audit_log`.

## Atualização do banco

Antes de publicar a V0.6, execute no Supabase SQL Editor:

`supabase/update-v06.sql`

Execute apenas uma vez no mesmo projeto que já está em uso.

## Publicação

Substitua os arquivos do mesmo repositório GitHub já conectado à Vercel. Não crie outro projeto Vercel e não altere `SUPABASE_URL` ou `SUPABASE_PUBLISHABLE_KEY`.


## V0.6.3 — correção definitiva do Transporte

A V0.6.3 muda o método de criação do agendamento:
- o front-end não faz mais INSERT direto na tabela `agendamentos_transporte`;
- o Portal chama a função segura `create_transport_booking`;
- o próprio banco identifica o usuário autenticado e grava `created_by`;
- somente `admin` e `gerencia` conseguem criar;
- os demais usuários continuam somente visualizando;
- editar e excluir continuam restritos à Gerência/Admin.

### Publicação
1. Execute `supabase/update-v063.sql` no SQL Editor.
2. Substitua TODOS os arquivos da aplicação pelos da V0.6.3 no mesmo repositório.
3. Aguarde o novo deployment da Vercel.
4. Confirme no rodapé que aparece `v0.6.3`.
5. Saia e entre novamente no Portal antes do primeiro teste.
