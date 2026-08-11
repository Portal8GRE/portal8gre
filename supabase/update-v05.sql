-- Portal 8ª GRE — atualização V0.5
-- Execute UMA VEZ no SQL Editor do mesmo projeto Supabase já usado pelo Portal.
-- Esta atualização preserva os dados existentes.

-- 1) Dados adicionais do perfil para o painel de usuários
alter table public.profiles add column if not exists email text;

update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id
  and (p.email is null or p.email = '');

-- 2) Perfil automático de novos usuários passa a guardar também o e-mail
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  insert into public.profiles (id,nome,email,role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email,'@',1)),
    new.email,
    'tecnico'
  )
  on conflict (id) do update
    set email = excluded.email;
  return new;
end;
$$;

-- 3) Helpers de segurança
create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path=public
as $$
  select role
  from public.profiles
  where id=auth.uid() and ativo=true;
$$;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1 from public.profiles
    where id=auth.uid() and ativo=true
  );
$$;

create or replace function public.is_admin_or_gerencia()
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select coalesce(public.current_role() in ('admin','gerencia'), false);
$$;

create or replace function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select coalesce(public.current_role() in ('admin','gerencia','coordenacao'), false);
$$;

-- 4) Recria políticas com permissões mais seguras
-- PERFIS
drop policy if exists "profiles_read_own_or_manager" on public.profiles;
drop policy if exists "profiles_update_own_or_manager" on public.profiles;
drop policy if exists "profiles_read_v05" on public.profiles;
drop policy if exists "profiles_update_v05" on public.profiles;

create policy "profiles_read_v05"
on public.profiles for select to authenticated
using (
  id = auth.uid()
  or (public.is_active_user() and public.is_admin_or_gerencia())
);

create policy "profiles_update_v05"
on public.profiles for update to authenticated
using (public.is_active_user() and public.is_admin_or_gerencia())
with check (public.is_active_user() and public.is_admin_or_gerencia());

-- SETORES
drop policy if exists "setores_read" on public.setores;
drop policy if exists "setores_read_v05" on public.setores;
create policy "setores_read_v05"
on public.setores for select to authenticated
using (public.is_active_user());

-- VEÍCULOS
drop policy if exists "veiculos_read" on public.veiculos;
drop policy if exists "veiculos_read_v05" on public.veiculos;
create policy "veiculos_read_v05"
on public.veiculos for select to authenticated
using (public.is_active_user());

-- ESCOLAS
drop policy if exists "escolas_read" on public.escolas;
drop policy if exists "escolas_insert" on public.escolas;
drop policy if exists "escolas_update" on public.escolas;
drop policy if exists "escolas_read_v05" on public.escolas;
drop policy if exists "escolas_insert_v05" on public.escolas;
drop policy if exists "escolas_update_v05" on public.escolas;

create policy "escolas_read_v05"
on public.escolas for select to authenticated
using (public.is_active_user());

create policy "escolas_insert_v05"
on public.escolas for insert to authenticated
with check (
  public.is_active_user()
  and public.is_manager()
  and created_by = auth.uid()
);

create policy "escolas_update_v05"
on public.escolas for update to authenticated
using (public.is_active_user() and public.is_manager())
with check (public.is_active_user() and public.is_manager());

-- TRANSPORTE
-- Todos os usuários ativos visualizam.
-- Todos podem solicitar em seu próprio nome.
-- Gerência/Admin gerenciam qualquer solicitação.
-- O solicitante só altera/cancela enquanto estiver em "Solicitado".
drop policy if exists "transport_read" on public.agendamentos_transporte;
drop policy if exists "transport_insert" on public.agendamentos_transporte;
drop policy if exists "transport_update" on public.agendamentos_transporte;
drop policy if exists "transport_read_v05" on public.agendamentos_transporte;
drop policy if exists "transport_insert_v05" on public.agendamentos_transporte;
drop policy if exists "transport_update_v05" on public.agendamentos_transporte;

create policy "transport_read_v05"
on public.agendamentos_transporte for select to authenticated
using (public.is_active_user());

create policy "transport_insert_v05"
on public.agendamentos_transporte for insert to authenticated
with check (
  public.is_active_user()
  and created_by = auth.uid()
  and status = 'Solicitado'
);

create policy "transport_update_v05"
on public.agendamentos_transporte for update to authenticated
using (
  public.is_active_user()
  and (
    public.is_admin_or_gerencia()
    or (created_by = auth.uid() and status = 'Solicitado')
  )
)
with check (
  public.is_active_user()
  and (
    public.is_admin_or_gerencia()
    or (created_by = auth.uid() and status in ('Solicitado','Cancelado'))
  )
);

-- VISITAS
drop policy if exists "visitas_read" on public.visitas;
drop policy if exists "visitas_insert" on public.visitas;
drop policy if exists "visitas_update" on public.visitas;
drop policy if exists "visitas_read_v05" on public.visitas;
drop policy if exists "visitas_insert_v05" on public.visitas;
drop policy if exists "visitas_update_v05" on public.visitas;

create policy "visitas_read_v05"
on public.visitas for select to authenticated
using (public.is_active_user());

create policy "visitas_insert_v05"
on public.visitas for insert to authenticated
with check (public.is_active_user() and created_by=auth.uid());

create policy "visitas_update_v05"
on public.visitas for update to authenticated
using (public.is_active_user() and (public.is_manager() or created_by=auth.uid()))
with check (public.is_active_user() and (public.is_manager() or created_by=auth.uid()));

-- GESTÃO
drop policy if exists "gestao_read" on public.acompanhamentos_gestao;
drop policy if exists "gestao_insert" on public.acompanhamentos_gestao;
drop policy if exists "gestao_update" on public.acompanhamentos_gestao;
drop policy if exists "gestao_read_v05" on public.acompanhamentos_gestao;
drop policy if exists "gestao_insert_v05" on public.acompanhamentos_gestao;
drop policy if exists "gestao_update_v05" on public.acompanhamentos_gestao;

create policy "gestao_read_v05"
on public.acompanhamentos_gestao for select to authenticated
using (public.is_active_user());

create policy "gestao_insert_v05"
on public.acompanhamentos_gestao for insert to authenticated
with check (public.is_active_user() and created_by=auth.uid());

create policy "gestao_update_v05"
on public.acompanhamentos_gestao for update to authenticated
using (public.is_active_user() and (public.is_manager() or created_by=auth.uid()))
with check (public.is_active_user() and (public.is_manager() or created_by=auth.uid()));

-- AUDITORIA
drop policy if exists "audit_read_manager" on public.audit_log;
drop policy if exists "audit_read_v05" on public.audit_log;
create policy "audit_read_v05"
on public.audit_log for select to authenticated
using (public.is_active_user() and public.is_admin_or_gerencia());
