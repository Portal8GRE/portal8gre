create table if not exists public.relatorios_aulas (
  id uuid primary key default gen_random_uuid(),
  arquivo_nome text not null,
  storage_path text not null unique,
  data_referencia date not null,
  total_paginas integer not null default 0,
  total_registros integer not null default 0,
  total_escolas integer not null default 0,
  observacao text,
  uploaded_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.aulas_relatorio_itens (
  id uuid primary key default gen_random_uuid(),
  relatorio_id uuid not null references public.relatorios_aulas(id) on delete cascade,
  periodo text not null,
  municipio text,
  escola_id uuid references public.escolas(id) on delete set null,
  escola_inep text,
  escola_nome text not null,
  id_turma text not null,
  turma text not null,
  disciplina text not null,
  carga_horaria_total numeric not null default 0,
  carga_horaria_confirmada numeric not null default 0,
  aulas_confirmadas integer not null default 0,
  aguardando_confirmacao_h numeric not null default 0,
  aulas_aguardando_confirmacao integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.aulas_professores (
  id uuid primary key default gen_random_uuid(),
  escola_inep text not null default '',
  id_turma text not null,
  disciplina text not null,
  professor_nome text not null,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  unique(escola_inep,id_turma,disciplina)
);

insert into public.setores (nome,slug) values ('Gestão','gestao') on conflict (slug) do nothing;

create index if not exists idx_aulas_itens_relatorio on public.aulas_relatorio_itens(relatorio_id);
create index if not exists idx_aulas_itens_escola on public.aulas_relatorio_itens(escola_inep);
create index if not exists idx_aulas_itens_turma on public.aulas_relatorio_itens(id_turma);
create index if not exists idx_aulas_itens_disciplina on public.aulas_relatorio_itens(disciplina);

create or replace function public.is_aulas_manager()
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select exists(
    select 1 from public.profiles p
    where p.id=(select auth.uid())
      and p.ativo=true
      and p.role in ('admin','gerencia','coordenacao')
  );
$$;

revoke execute on function public.is_aulas_manager() from public, anon;
grant execute on function public.is_aulas_manager() to authenticated;

grant select,insert,delete on public.relatorios_aulas to authenticated;
grant select,insert on public.aulas_relatorio_itens to authenticated;
grant select,insert,update on public.aulas_professores to authenticated;

alter table public.relatorios_aulas enable row level security;
alter table public.aulas_relatorio_itens enable row level security;
alter table public.aulas_professores enable row level security;

do $$ declare p record; begin
  for p in select policyname,tablename from pg_policies where schemaname='public' and tablename in ('relatorios_aulas','aulas_relatorio_itens','aulas_professores') loop
    execute format('drop policy if exists %I on public.%I',p.policyname,p.tablename);
  end loop;
end $$;

create policy "relatorios_aulas_read" on public.relatorios_aulas for select to authenticated using ((select public.is_active_user()));
create policy "relatorios_aulas_insert" on public.relatorios_aulas for insert to authenticated with check ((select public.is_aulas_manager()) and uploaded_by=(select auth.uid()));
create policy "relatorios_aulas_delete" on public.relatorios_aulas for delete to authenticated using ((select public.current_role()) in ('admin','gerencia'));

create policy "aulas_itens_read" on public.aulas_relatorio_itens for select to authenticated using ((select public.is_active_user()));
create policy "aulas_itens_insert" on public.aulas_relatorio_itens for insert to authenticated with check ((select public.is_aulas_manager()));

create policy "aulas_prof_read" on public.aulas_professores for select to authenticated using ((select public.is_active_user()));
create policy "aulas_prof_insert" on public.aulas_professores for insert to authenticated with check ((select public.is_aulas_manager()));
create policy "aulas_prof_update" on public.aulas_professores for update to authenticated using ((select public.is_aulas_manager())) with check ((select public.is_aulas_manager()));

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('relatorios-aulas','relatorios-aulas',false,52428800,array['application/pdf'])
on conflict (id) do update set public=false,file_size_limit=52428800,allowed_mime_types=array['application/pdf'];

do $$ declare p record; begin
  for p in select policyname from pg_policies where schemaname='storage' and tablename='objects' and policyname like 'aulas_storage_%' loop
    execute format('drop policy if exists %I on storage.objects',p.policyname);
  end loop;
end $$;

create policy "aulas_storage_read" on storage.objects for select to authenticated using (bucket_id='relatorios-aulas' and (select public.is_active_user()));
create policy "aulas_storage_insert" on storage.objects for insert to authenticated with check (bucket_id='relatorios-aulas' and (select public.is_aulas_manager()));
create policy "aulas_storage_delete" on storage.objects for delete to authenticated using (bucket_id='relatorios-aulas' and (select public.current_role()) in ('admin','gerencia'));
