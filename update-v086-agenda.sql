create table if not exists public.portal_links_acesso (
  slug text primary key,
  token_hash text not null,
  ativo boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.portal_links_acesso enable row level security;

revoke all on table public.portal_links_acesso from anon;
revoke all on table public.portal_links_acesso from authenticated;

insert into public.portal_links_acesso (slug, token_hash, ativo, updated_at)
values ('motoristas', 'e83b1b60b36a43bf533112565ebd0438', true, now())
on conflict (slug) do update
set token_hash=excluded.token_hash,
    ativo=true,
    updated_at=now();

create or replace function public.list_transport_motoristas(access_key text)
returns table (
  id uuid,
  data date,
  veiculo text,
  escola_nome text,
  destino text,
  responsavel text,
  hora_saida time,
  previsao_retorno time,
  participantes text,
  finalidade text,
  status text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if access_key is null
     or not exists (
       select 1
       from public.portal_links_acesso l
       where l.slug='motoristas'
         and l.ativo=true
         and l.token_hash=md5(access_key)
     )
  then
    raise exception 'Acesso inválido';
  end if;

  return query
  select
    a.id, a.data, a.veiculo, a.escola_nome, a.destino, a.responsavel,
    a.hora_saida, a.previsao_retorno, a.participantes, a.finalidade, a.status
  from public.agendamentos_transporte a
  where a.status <> 'Cancelado'
    and a.data >= current_date - 31
  order by a.data asc, a.hora_saida asc;
end;
$$;

revoke all on function public.list_transport_motoristas(text) from public;
grant execute on function public.list_transport_motoristas(text) to anon;
grant execute on function public.list_transport_motoristas(text) to authenticated;
