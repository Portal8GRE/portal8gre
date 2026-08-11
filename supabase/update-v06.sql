-- Portal 8ª GRE — atualização V0.6
-- Execute UMA VEZ no SQL Editor do mesmo projeto Supabase.
-- Objetivo: Transporte exclusivo da Gerência/Admin, exclusão segura e auditoria.

-- 1) Novo padrão: agendamento criado pela Gerência já nasce confirmado.
alter table public.agendamentos_transporte
  alter column status set default 'Confirmado';

-- Índices para agenda e alertas por data/escola/destino.
create index if not exists idx_transporte_data on public.agendamentos_transporte(data);
create index if not exists idx_transporte_data_escola on public.agendamentos_transporte(data, escola_id);
create index if not exists idx_transporte_data_destino_lower on public.agendamentos_transporte(data, lower(destino));

-- 2) Segurança do módulo Transporte.
-- Todos os usuários ativos podem visualizar.
-- Somente Gerência e Administrador técnico podem criar, editar ou excluir.
drop policy if exists "transport_read" on public.agendamentos_transporte;
drop policy if exists "transport_insert" on public.agendamentos_transporte;
drop policy if exists "transport_update" on public.agendamentos_transporte;
drop policy if exists "transport_delete" on public.agendamentos_transporte;
drop policy if exists "transport_read_v05" on public.agendamentos_transporte;
drop policy if exists "transport_insert_v05" on public.agendamentos_transporte;
drop policy if exists "transport_update_v05" on public.agendamentos_transporte;
drop policy if exists "transport_delete_v05" on public.agendamentos_transporte;
drop policy if exists "transport_read_v06" on public.agendamentos_transporte;
drop policy if exists "transport_insert_v06" on public.agendamentos_transporte;
drop policy if exists "transport_update_v06" on public.agendamentos_transporte;
drop policy if exists "transport_delete_v06" on public.agendamentos_transporte;

create policy "transport_read_v06"
on public.agendamentos_transporte for select to authenticated
using (public.is_active_user());

create policy "transport_insert_v06"
on public.agendamentos_transporte for insert to authenticated
with check (
  public.is_active_user()
  and public.is_admin_or_gerencia()
  and created_by = auth.uid()
);

create policy "transport_update_v06"
on public.agendamentos_transporte for update to authenticated
using (
  public.is_active_user()
  and public.is_admin_or_gerencia()
)
with check (
  public.is_active_user()
  and public.is_admin_or_gerencia()
);

create policy "transport_delete_v06"
on public.agendamentos_transporte for delete to authenticated
using (
  public.is_active_user()
  and public.is_admin_or_gerencia()
);


-- 2.1) Proteção adicional no banco: impede sobreposição do mesmo veículo no mesmo dia.
create or replace function public.prevent_transport_vehicle_conflict()
returns trigger
language plpgsql
set search_path=public
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
    where a.id <> coalesce(new.id, gen_random_uuid())
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

drop trigger if exists trg_prevent_transport_vehicle_conflict on public.agendamentos_transporte;
create trigger trg_prevent_transport_vehicle_conflict
before insert or update on public.agendamentos_transporte
for each row execute function public.prevent_transport_vehicle_conflict();

-- 3) Auditoria automática do Transporte.
-- Mesmo quando um agendamento é excluído, uma cópia do estado anterior fica no audit_log.
create or replace function public.audit_transporte_changes()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log(tabela, registro_id, operacao, user_id, dados_anteriores, dados_novos)
    values ('agendamentos_transporte', new.id::text, 'INSERT', auth.uid(), null, to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.audit_log(tabela, registro_id, operacao, user_id, dados_anteriores, dados_novos)
    values ('agendamentos_transporte', new.id::text, 'UPDATE', auth.uid(), to_jsonb(old), to_jsonb(new));
    return new;
  elsif tg_op = 'DELETE' then
    insert into public.audit_log(tabela, registro_id, operacao, user_id, dados_anteriores, dados_novos)
    values ('agendamentos_transporte', old.id::text, 'DELETE', auth.uid(), to_jsonb(old), null);
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_audit_transporte on public.agendamentos_transporte;
create trigger trg_audit_transporte
after insert or update or delete on public.agendamentos_transporte
for each row execute function public.audit_transporte_changes();

-- 4) Mantém o histórico visível somente para Gerência/Admin.
drop policy if exists "audit_read_v06" on public.audit_log;
create policy "audit_read_v06"
on public.audit_log for select to authenticated
using (public.is_active_user() and public.is_admin_or_gerencia());
