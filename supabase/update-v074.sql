do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid='public.profiles'::regclass
      and contype='c'
      and pg_get_constraintdef(oid) ilike '%role%'
  loop
    execute format('alter table public.profiles drop constraint if exists %I', c.conname);
  end loop;
end $$;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin','gerencia','coordenacao','tecnico','visualizacao','escola'));

drop policy if exists "visitas_read" on public.visitas;
drop policy if exists "visitas_insert" on public.visitas;
drop policy if exists "visitas_update" on public.visitas;
drop policy if exists "visitas_read_v05" on public.visitas;
drop policy if exists "visitas_insert_v05" on public.visitas;
drop policy if exists "visitas_update_v05" on public.visitas;
drop policy if exists "visitas_read_v074" on public.visitas;
drop policy if exists "visitas_insert_v074" on public.visitas;
drop policy if exists "visitas_update_v074" on public.visitas;

create policy "visitas_read_v074"
on public.visitas
for select
to authenticated
using ((select public.is_active_user()));

create policy "visitas_insert_v074"
on public.visitas
for insert
to authenticated
with check (
  (select public.is_active_user())
  and (select public.current_role()) in ('admin','gerencia','coordenacao','tecnico')
  and created_by=(select auth.uid())
);

create policy "visitas_update_v074"
on public.visitas
for update
to authenticated
using (
  (select public.is_active_user())
  and (select public.current_role()) in ('admin','gerencia','coordenacao','tecnico')
  and (
    (select public.is_manager())
    or created_by=(select auth.uid())
  )
)
with check (
  (select public.is_active_user())
  and (select public.current_role()) in ('admin','gerencia','coordenacao','tecnico')
  and (
    (select public.is_manager())
    or created_by=(select auth.uid())
  )
);

drop policy if exists "gestao_read" on public.acompanhamentos_gestao;
drop policy if exists "gestao_insert" on public.acompanhamentos_gestao;
drop policy if exists "gestao_update" on public.acompanhamentos_gestao;
drop policy if exists "gestao_read_v05" on public.acompanhamentos_gestao;
drop policy if exists "gestao_insert_v05" on public.acompanhamentos_gestao;
drop policy if exists "gestao_update_v05" on public.acompanhamentos_gestao;
drop policy if exists "gestao_read_v074" on public.acompanhamentos_gestao;
drop policy if exists "gestao_insert_v074" on public.acompanhamentos_gestao;
drop policy if exists "gestao_update_v074" on public.acompanhamentos_gestao;

create policy "gestao_read_v074"
on public.acompanhamentos_gestao
for select
to authenticated
using ((select public.is_active_user()));

create policy "gestao_insert_v074"
on public.acompanhamentos_gestao
for insert
to authenticated
with check (
  (select public.is_active_user())
  and (select public.current_role()) in ('admin','gerencia','coordenacao','tecnico')
  and created_by=(select auth.uid())
);

create policy "gestao_update_v074"
on public.acompanhamentos_gestao
for update
to authenticated
using (
  (select public.is_active_user())
  and (select public.current_role()) in ('admin','gerencia','coordenacao','tecnico')
  and (
    (select public.is_manager())
    or created_by=(select auth.uid())
  )
)
with check (
  (select public.is_active_user())
  and (select public.current_role()) in ('admin','gerencia','coordenacao','tecnico')
  and (
    (select public.is_manager())
    or created_by=(select auth.uid())
  )
);
