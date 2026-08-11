-- Portal 8ª GRE — V0.6.3
-- CORREÇÃO DEFINITIVA DO SALVAMENTO DO TRANSPORTE
--
-- Execute este arquivo UMA VEZ no SQL Editor do mesmo projeto Supabase.
--
-- Mudança principal:
-- O Portal deixa de fazer INSERT direto em agendamentos_transporte.
-- A criação passa pela função segura public.create_transport_booking(jsonb).
-- Essa função:
--   • identifica o usuário autenticado;
--   • confere se está ativo;
--   • confere se é admin ou gerência;
--   • grava created_by no próprio banco;
--   • grava o status inicial como Confirmado;
--   • deixa o trigger do banco validar conflito de veículo.
--
-- Isso elimina a dependência do INSERT direto via RLS, que estava sendo
-- a parte instável do fluxo anterior.

-- ------------------------------------------------------------
-- 1. Funções de perfil
-- ------------------------------------------------------------

create or replace function public.current_role()
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

create or replace function public.is_active_user()
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

create or replace function public.is_admin_or_gerencia()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select public.current_role()) in ('admin','gerencia'),
    false
  );
$$;

revoke execute on function public.current_role() from public, anon;
revoke execute on function public.is_active_user() from public, anon;
revoke execute on function public.is_admin_or_gerencia() from public, anon;

grant execute on function public.current_role() to authenticated;
grant execute on function public.is_active_user() to authenticated;
grant execute on function public.is_admin_or_gerencia() to authenticated;

-- ------------------------------------------------------------
-- 2. Regras da tabela
-- ------------------------------------------------------------

grant usage on schema public to authenticated;
grant select, update, delete on table public.agendamentos_transporte to authenticated;

alter table public.agendamentos_transporte enable row level security;
alter table public.agendamentos_transporte
  alter column status set default 'Confirmado';

-- Remove todas as políticas anteriores do Transporte para não deixar
-- regras antigas acumuladas interferirem no comportamento atual.
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

-- Todos os usuários ativos visualizam.
create policy "transport_select_v063"
on public.agendamentos_transporte
for select
to authenticated
using ((select public.is_active_user()));

-- Gerência/Admin editam.
create policy "transport_update_v063"
on public.agendamentos_transporte
for update
to authenticated
using (
  (select public.is_active_user())
  and (select public.is_admin_or_gerencia())
)
with check (
  (select public.is_active_user())
  and (select public.is_admin_or_gerencia())
);

-- Gerência/Admin excluem.
create policy "transport_delete_v063"
on public.agendamentos_transporte
for delete
to authenticated
using (
  (select public.is_active_user())
  and (select public.is_admin_or_gerencia())
);

-- Não criamos policy de INSERT direto.
-- Novos registros entram somente pela função segura abaixo.

-- ------------------------------------------------------------
-- 3. Validação de conflito do veículo
-- ------------------------------------------------------------

create or replace function public.prevent_transport_vehicle_conflict()
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
execute function public.prevent_transport_vehicle_conflict();

-- ------------------------------------------------------------
-- 4. RPC segura para NOVO AGENDAMENTO
-- ------------------------------------------------------------

create or replace function public.create_transport_booking(payload jsonb)
returns public.agendamentos_transporte
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_role text;
  v_row public.agendamentos_transporte;
  v_escola_id uuid;
  v_retorno time;
begin
  v_uid := (select auth.uid());

  if v_uid is null then
    raise exception 'Sessão expirada. Saia do Portal e entre novamente.';
  end if;

  select p.role
    into v_role
  from public.profiles p
  where p.id = v_uid
    and p.ativo = true;

  if v_role is null then
    raise exception 'Usuário sem perfil ativo no Portal.';
  end if;

  if v_role not in ('admin','gerencia') then
    raise exception 'Somente a Gerência pode criar agendamentos de transporte.';
  end if;

  if nullif(payload->>'escola_id','') is not null then
    v_escola_id := (payload->>'escola_id')::uuid;
  else
    v_escola_id := null;
  end if;

  if nullif(payload->>'previsao_retorno','') is not null then
    v_retorno := (payload->>'previsao_retorno')::time;
  else
    v_retorno := null;
  end if;

  insert into public.agendamentos_transporte (
    data,
    veiculo,
    escola_id,
    escola_nome,
    destino,
    responsavel,
    hora_saida,
    previsao_retorno,
    participantes,
    finalidade,
    status,
    created_by
  )
  values (
    (payload->>'data')::date,
    payload->>'veiculo',
    v_escola_id,
    nullif(payload->>'escola_nome',''),
    payload->>'destino',
    payload->>'responsavel',
    (payload->>'hora_saida')::time,
    v_retorno,
    nullif(payload->>'participantes',''),
    payload->>'finalidade',
    'Confirmado',
    v_uid
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke execute on function public.create_transport_booking(jsonb) from public, anon;
grant execute on function public.create_transport_booking(jsonb) to authenticated;

-- ------------------------------------------------------------
-- 5. Auditoria
-- ------------------------------------------------------------

create or replace function public.audit_transporte_changes()
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
execute function public.audit_transporte_changes();

-- ------------------------------------------------------------
-- 6. Índices
-- ------------------------------------------------------------

create index if not exists idx_transporte_data
on public.agendamentos_transporte(data);

create index if not exists idx_transporte_data_escola
on public.agendamentos_transporte(data, escola_id);

create index if not exists idx_transporte_data_destino_lower
on public.agendamentos_transporte(data, lower(destino));

-- Resultado esperado no SQL Editor:
-- Success. No rows returned.
