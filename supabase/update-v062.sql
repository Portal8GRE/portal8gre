-- Portal 8ª GRE — V0.6.2
-- CORREÇÃO ROBUSTA DO AGENDAMENTO DE TRANSPORTE
-- Execute no SQL Editor do MESMO projeto Supabase usado pelo Portal.
--
-- O que esta atualização faz:
-- 1. Remove políticas antigas do Transporte e recria somente as regras atuais.
-- 2. O próprio banco grava created_by = usuário autenticado.
-- 3. Somente admin/gerência podem inserir, editar e excluir.
-- 4. Todos os usuários ativos podem visualizar.
-- 5. Mantém status padrão "Confirmado".
-- 6. Mantém bloqueio de conflito de veículo.
-- 7. Mantém auditoria de INSERT/UPDATE/DELETE.

-- ------------------------------------------------------------------
-- A) Funções auxiliares em schema privado
-- ------------------------------------------------------------------

create schema if not exists private;
grant usage on schema private to authenticated;

create or replace function private.current_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = (select auth.uid())
    and p.ativo = true
  limit 1;
$$;

create or replace function private.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.ativo = true
  );
$$;

create or replace function private.is_admin_or_gerencia()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select private.current_role()) in ('admin','gerencia'), false);
$$;

revoke execute on function private.current_role() from public, anon;
revoke execute on function private.is_active_user() from public, anon;
revoke execute on function private.is_admin_or_gerencia() from public, anon;

grant execute on function private.current_role() to authenticated;
grant execute on function private.is_active_user() to authenticated;
grant execute on function private.is_admin_or_gerencia() to authenticated;

-- ------------------------------------------------------------------
-- B) Permissões da tabela
-- ------------------------------------------------------------------

grant usage on schema public to authenticated;
grant select, insert, update, delete
on table public.agendamentos_transporte
to authenticated;

alter table public.agendamentos_transporte enable row level security;

alter table public.agendamentos_transporte
  alter column status set default 'Confirmado';

-- ------------------------------------------------------------------
-- C) Banco define automaticamente o autor do agendamento
-- ------------------------------------------------------------------

create or replace function private.transport_set_created_by()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Sessão expirada. Entre novamente no Portal.';
  end if;

  new.created_by := (select auth.uid());

  if new.status is null or btrim(new.status) = '' then
    new.status := 'Confirmado';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_transport_set_created_by
on public.agendamentos_transporte;

create trigger trg_transport_set_created_by
before insert on public.agendamentos_transporte
for each row
execute function private.transport_set_created_by();

-- ------------------------------------------------------------------
-- D) Remove TODAS as políticas antigas da tabela Transporte
-- ------------------------------------------------------------------

do $$
declare
  p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'agendamentos_transporte'
  loop
    execute format(
      'drop policy if exists %I on public.agendamentos_transporte',
      p.policyname
    );
  end loop;
end $$;

-- ------------------------------------------------------------------
-- E) Regras atuais
-- ------------------------------------------------------------------

create policy "transport_select_v062"
on public.agendamentos_transporte
for select
to authenticated
using (
  (select private.is_active_user())
);

create policy "transport_insert_v062"
on public.agendamentos_transporte
for insert
to authenticated
with check (
  (select auth.uid()) is not null
  and (select private.is_active_user())
  and (select private.is_admin_or_gerencia())
  and created_by = (select auth.uid())
);

create policy "transport_update_v062"
on public.agendamentos_transporte
for update
to authenticated
using (
  (select private.is_active_user())
  and (select private.is_admin_or_gerencia())
)
with check (
  (select private.is_active_user())
  and (select private.is_admin_or_gerencia())
);

create policy "transport_delete_v062"
on public.agendamentos_transporte
for delete
to authenticated
using (
  (select private.is_active_user())
  and (select private.is_admin_or_gerencia())
);

-- ------------------------------------------------------------------
-- F) Bloqueio de conflito do mesmo veículo
-- ------------------------------------------------------------------

create or replace function private.prevent_transport_vehicle_conflict()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status = 'Cancelado' or new.previsao_retorno is null then
    return new;
  end if;

  if new.previsao_retorno <= new.hora_saida then
    raise exception 'A previsão de retorno deve ser posterior ao horário de saída.';
  end if;

  if exists (
    select 1
    from public.agendamentos_transporte a
    where a.id <> new.id
      and a.data = new.data
      and a.veiculo = new.veiculo
      and a.status <> 'Cancelado'
      and a.hora_saida < new.previsao_retorno
      and coalesce(a.previsao_retorno, a.hora_saida) > new.hora_saida
  ) then
    raise exception 'Conflito de agenda: este veículo já possui agendamento no intervalo informado.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_transport_vehicle_conflict
on public.agendamentos_transporte;

create trigger trg_prevent_transport_vehicle_conflict
before insert or update on public.agendamentos_transporte
for each row
execute function private.prevent_transport_vehicle_conflict();

-- ------------------------------------------------------------------
-- G) Auditoria do Transporte
-- ------------------------------------------------------------------

create or replace function private.audit_transporte_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log
      (tabela, registro_id, operacao, user_id, dados_anteriores, dados_novos)
    values
      ('agendamentos_transporte', new.id::text, 'INSERT',
       (select auth.uid()), null, to_jsonb(new));
    return new;

  elsif tg_op = 'UPDATE' then
    insert into public.audit_log
      (tabela, registro_id, operacao, user_id, dados_anteriores, dados_novos)
    values
      ('agendamentos_transporte', new.id::text, 'UPDATE',
       (select auth.uid()), to_jsonb(old), to_jsonb(new));
    return new;

  elsif tg_op = 'DELETE' then
    insert into public.audit_log
      (tabela, registro_id, operacao, user_id, dados_anteriores, dados_novos)
    values
      ('agendamentos_transporte', old.id::text, 'DELETE',
       (select auth.uid()), to_jsonb(old), null);
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_audit_transporte
on public.agendamentos_transporte;

create trigger trg_audit_transporte
after insert or update or delete on public.agendamentos_transporte
for each row
execute function private.audit_transporte_changes();

-- ------------------------------------------------------------------
-- H) Índices
-- ------------------------------------------------------------------

create index if not exists idx_transporte_data
on public.agendamentos_transporte(data);

create index if not exists idx_transporte_data_escola
on public.agendamentos_transporte(data, escola_id);

create index if not exists idx_transporte_data_destino_lower
on public.agendamentos_transporte(data, lower(destino));

-- ------------------------------------------------------------------
-- I) Conferência final
-- ------------------------------------------------------------------
-- Após executar, o Table Editor deve mostrar 4 RLS policies.
-- Resultado esperado do SQL Editor: Success. No rows returned.
