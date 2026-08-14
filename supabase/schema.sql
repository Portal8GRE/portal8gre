-- Portal 8ª GRE - esquema inicial v0.1
-- Execute este arquivo no SQL Editor de um projeto Supabase novo.

create extension if not exists pgcrypto;

create table if not exists public.setores (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  slug text not null unique,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.setores (nome, slug) values
  ('Gerência Regional','gerencia-regional'),
  ('Ensino e Aprendizagem','ensino-aprendizagem'),
  ('Gestão e Inspeção','gestao-inspecao'),
  ('Administração','administracao'),
  ('Prestação de Contas','prestacao-contas')
on conflict (slug) do nothing;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text,
  role text not null default 'tecnico' check (role in ('admin','gerencia','coordenacao','tecnico','visualizacao','escola')),
  setor_id uuid references public.setores(id),
  escola_id uuid,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.escolas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  inep text,
  municipio text not null,
  gestor text,
  telefone text,
  email text,
  ativo boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  drop constraint if exists profiles_escola_id_fkey;
alter table public.profiles
  add constraint profiles_escola_id_fkey foreign key (escola_id) references public.escolas(id) on delete set null;

create table if not exists public.veiculos (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);
insert into public.veiculos (nome) values ('S10'),('Logan'),('Polo') on conflict (nome) do nothing;

create table if not exists public.agendamentos_transporte (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  veiculo text not null check (veiculo in ('S10','Logan','Polo')),
  escola_id uuid references public.escolas(id) on delete set null,
  escola_nome text,
  destino text not null,
  responsavel text not null,
  hora_saida time not null,
  previsao_retorno time,
  participantes text,
  finalidade text not null,
  status text not null default 'Solicitado' check (status in ('Solicitado','Confirmado','Realizado','Cancelado')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.visitas (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  horario time,
  escola_id uuid not null references public.escolas(id) on delete restrict,
  escola_nome text,
  tecnico text not null,
  municipio text,
  objetivo text not null,
  observacoes text,
  encaminhamentos text,
  status text not null default 'Registrada',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.acompanhamentos_gestao (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references public.escolas(id) on delete restrict,
  escola_nome text,
  periodo text not null,
  aulas_previstas numeric not null default 0,
  aulas_dadas numeric not null default 0,
  frequencia numeric not null default 0 check (frequencia >= 0 and frequencia <= 100),
  media_notas numeric not null default 0,
  intervencao text,
  responsavel text,
  status text not null default 'Em acompanhamento',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  tabela text not null,
  registro_id text not null,
  operacao text not null,
  user_id uuid,
  dados_anteriores jsonb,
  dados_novos jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname='trg_profiles_updated') then create trigger trg_profiles_updated before update on public.profiles for each row execute function public.touch_updated_at(); end if;
  if not exists (select 1 from pg_trigger where tgname='trg_escolas_updated') then create trigger trg_escolas_updated before update on public.escolas for each row execute function public.touch_updated_at(); end if;
  if not exists (select 1 from pg_trigger where tgname='trg_transporte_updated') then create trigger trg_transporte_updated before update on public.agendamentos_transporte for each row execute function public.touch_updated_at(); end if;
  if not exists (select 1 from pg_trigger where tgname='trg_visitas_updated') then create trigger trg_visitas_updated before update on public.visitas for each row execute function public.touch_updated_at(); end if;
  if not exists (select 1 from pg_trigger where tgname='trg_gestao_updated') then create trigger trg_gestao_updated before update on public.acompanhamentos_gestao for each row execute function public.touch_updated_at(); end if;
end $$;

-- Cria perfil automaticamente ao cadastrar um usuário no Supabase Auth.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles (id,nome,role)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', split_part(new.email,'@',1)), 'tecnico')
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

-- Helpers para permissões
create or replace function public.current_role() returns text language sql stable security definer set search_path=public as $$
  select role from public.profiles where id=auth.uid();
$$;

create or replace function public.is_manager() returns boolean language sql stable security definer set search_path=public as $$
  select coalesce(public.current_role() in ('admin','gerencia','coordenacao'), false);
$$;

-- RLS
alter table public.profiles enable row level security;
alter table public.setores enable row level security;
alter table public.escolas enable row level security;
alter table public.veiculos enable row level security;
alter table public.agendamentos_transporte enable row level security;
alter table public.visitas enable row level security;
alter table public.acompanhamentos_gestao enable row level security;
alter table public.audit_log enable row level security;

-- Leitura de cadastros básicos para usuários autenticados
create policy "setores_read" on public.setores for select to authenticated using (true);
create policy "veiculos_read" on public.veiculos for select to authenticated using (true);
create policy "escolas_read" on public.escolas for select to authenticated using (true);
create policy "escolas_insert" on public.escolas for insert to authenticated with check (public.is_manager() or public.current_role()='tecnico');
create policy "escolas_update" on public.escolas for update to authenticated using (public.is_manager());

-- Perfil: cada usuário lê o próprio; gerência/admin lê todos.
create policy "profiles_read_own_or_manager" on public.profiles for select to authenticated using (id=auth.uid() or public.is_manager());
create policy "profiles_update_own_or_manager" on public.profiles for update to authenticated using (id=auth.uid() or public.is_manager());

-- Transporte: todos autenticados visualizam e podem solicitar; gerência/admin/coordenadores ou criador podem alterar.
create policy "transport_read" on public.agendamentos_transporte for select to authenticated using (true);
create policy "transport_insert" on public.agendamentos_transporte for insert to authenticated with check (auth.uid() is not null);
create policy "transport_update" on public.agendamentos_transporte for update to authenticated using (public.is_manager() or created_by=auth.uid());

-- Visitas: técnicos registram; gerência/coordenação vê tudo. Por enquanto todos autenticados leem para facilitar validação da v0.1.
create policy "visitas_read" on public.visitas for select to authenticated using (true);
create policy "visitas_insert" on public.visitas for insert to authenticated with check (auth.uid() is not null);
create policy "visitas_update" on public.visitas for update to authenticated using (public.is_manager() or created_by=auth.uid());

-- Gestão: leitura interna e escrita autenticada; políticas serão refinadas por setor na etapa de produção.
create policy "gestao_read" on public.acompanhamentos_gestao for select to authenticated using (true);
create policy "gestao_insert" on public.acompanhamentos_gestao for insert to authenticated with check (auth.uid() is not null);
create policy "gestao_update" on public.acompanhamentos_gestao for update to authenticated using (public.is_manager() or created_by=auth.uid());

-- Audit log fica restrito a gerência/admin.
create policy "audit_read_manager" on public.audit_log for select to authenticated using (public.current_role() in ('admin','gerencia'));

-- IMPORTANTE: antes de uso com dados reais, refinaremos as políticas por setor/escola e criaremos auditoria automática de INSERT/UPDATE/DELETE.
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
