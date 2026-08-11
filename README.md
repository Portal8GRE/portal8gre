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
