create table if not exists public.ideb_resultados (
  id uuid primary key default gen_random_uuid(),
  escola_nome text not null,
  municipio text,
  etapa text not null check (etapa in ('Anos Iniciais','Anos Finais','Ensino Médio')),
  ano integer not null check (ano between 2000 and 2100),
  ideb numeric(3,1) not null check (ideb between 0 and 10),
  aprendizado numeric(5,3),
  fluxo numeric(4,2),
  portugues numeric(6,2),
  matematica numeric(6,2),
  origem text,
  created_at timestamptz not null default now(),
  unique (escola_nome, etapa, ano)
);

create table if not exists public.ideb_composicao_gre (
  resultado_id uuid primary key references public.ideb_resultados(id) on delete cascade,
  incluida boolean not null default true,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

alter table public.ideb_resultados enable row level security;
alter table public.ideb_composicao_gre enable row level security;

drop policy if exists "ideb_resultados_read_v080" on public.ideb_resultados;
drop policy if exists "ideb_composicao_read_v080" on public.ideb_composicao_gre;
drop policy if exists "ideb_composicao_insert_v080" on public.ideb_composicao_gre;
drop policy if exists "ideb_composicao_update_v080" on public.ideb_composicao_gre;

create policy "ideb_resultados_read_v080"
on public.ideb_resultados
for select
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id=(select auth.uid()) and p.ativo=true
  )
);

create policy "ideb_composicao_read_v080"
on public.ideb_composicao_gre
for select
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id=(select auth.uid()) and p.ativo=true
  )
);

create policy "ideb_composicao_insert_v080"
on public.ideb_composicao_gre
for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles p
    where p.id=(select auth.uid())
      and p.ativo=true
      and p.role in ('admin','gerencia','coordenacao')
  )
);

create policy "ideb_composicao_update_v080"
on public.ideb_composicao_gre
for update
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id=(select auth.uid())
      and p.ativo=true
      and p.role in ('admin','gerencia','coordenacao')
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id=(select auth.uid())
      and p.ativo=true
      and p.role in ('admin','gerencia','coordenacao')
  )
);

insert into public.ideb_resultados
  (escola_nome, municipio, etapa, ano, ideb, aprendizado, fluxo, portugues, matematica, origem)
values
  ('CETI Família Agrícola Dom Edilberto II','São João da Varjota','Anos Finais',2019,3.2,null,null,null,null,'Gráfico de evolução do relatório'),
  ('CETI Família Agrícola Dom Edilberto II','São João da Varjota','Anos Finais',2021,3.3,null,null,null,null,'Gráfico de evolução do relatório'),
  ('CETI Família Agrícola Dom Edilberto II','São João da Varjota','Anos Finais',2023,4.6,null,null,null,null,'Gráfico de evolução do relatório'),
  ('CETI Família Agrícola Dom Edilberto II','São João da Varjota','Anos Finais',2025,4.6,4.700,0.98,239.29,242.93,'Painel do relatório 2025'),
  ('CETI Família Agrícola Dom Edilberto III','Cajazeiras do Piauí','Anos Finais',2015,3.7,null,null,null,null,'Gráfico de evolução do relatório'),
  ('CETI Família Agrícola Dom Edilberto III','Cajazeiras do Piauí','Anos Finais',2017,3.0,null,null,null,null,'Gráfico de evolução do relatório'),
  ('CETI Família Agrícola Dom Edilberto III','Cajazeiras do Piauí','Anos Finais',2019,3.8,null,null,null,null,'Gráfico de evolução do relatório'),
  ('CETI Família Agrícola Dom Edilberto III','Cajazeiras do Piauí','Anos Finais',2021,4.3,null,null,null,null,'Gráfico de evolução do relatório'),
  ('CETI Família Agrícola Dom Edilberto III','Cajazeiras do Piauí','Anos Finais',2025,4.0,4.050,1.00,205.75,237.14,'Painel do relatório 2025'),
  ('CETI Família Agrícola Dom Edilberto V','Santo Inácio do Piauí','Anos Finais',2019,2.1,null,null,null,null,'Gráfico de evolução do relatório'),
  ('CETI Família Agrícola Dom Edilberto V','Santo Inácio do Piauí','Anos Finais',2023,4.8,null,null,null,null,'Gráfico de evolução do relatório'),
  ('CETI Família Agrícola Dom Edilberto V','Santo Inácio do Piauí','Anos Finais',2025,3.9,3.880,1.00,217.88,214.92,'Painel do relatório 2025'),
  ('CETI Armando Burlamaqui','Oeiras','Ensino Médio',2023,4.4,null,null,null,null,'Gráfico de evolução do relatório'),
  ('CETI Armando Burlamaqui','Oeiras','Ensino Médio',2025,4.3,4.350,0.99,256.62,271.83,'Painel do relatório 2025'),
  ('CETI Clementino Martins','Wall Ferraz','Ensino Médio',2017,3.6,null,null,null,null,'Gráfico de evolução do relatório'),
  ('CETI Clementino Martins','Wall Ferraz','Ensino Médio',2019,3.6,null,null,null,null,'Gráfico de evolução do relatório'),
  ('CETI Clementino Martins','Wall Ferraz','Ensino Médio',2023,4.0,null,null,null,null,'Gráfico de evolução do relatório'),
  ('CETI Clementino Martins','Wall Ferraz','Ensino Médio',2025,5.4,5.400,1.00,289.49,311.37,'Painel do relatório 2025'),
  ('CETI Costa Alvarenga','Oeiras','Ensino Médio',2019,3.3,null,null,null,null,'Gráfico de evolução do relatório'),
  ('CETI Costa Alvarenga','Oeiras','Ensino Médio',2023,4.0,null,null,null,null,'Gráfico de evolução do relatório'),
  ('CETI Costa Alvarenga','Oeiras','Ensino Médio',2025,3.4,4.480,0.75,266.79,270.56,'Painel do relatório 2025'),
  ('CETI Desembargador Pedro Sá','Oeiras','Ensino Médio',2017,5.5,null,null,null,null,'Gráfico de evolução do relatório'),
  ('CETI Desembargador Pedro Sá','Oeiras','Ensino Médio',2019,4.5,null,null,null,null,'Gráfico de evolução do relatório'),
  ('CETI Desembargador Pedro Sá','Oeiras','Ensino Médio',2023,5.2,null,null,null,null,'Gráfico de evolução do relatório'),
  ('CETI Desembargador Pedro Sá','Oeiras','Ensino Médio',2025,5.7,5.730,0.99,290.27,334.48,'Painel do relatório 2025'),
  ('CETI Dom Edilberto Dinkelborg','Santa Rosa do Piauí','Ensino Médio',2017,3.7,null,null,null,null,'Gráfico de evolução do relatório'),
  ('CETI Dom Edilberto Dinkelborg','Santa Rosa do Piauí','Ensino Médio',2019,3.6,null,null,null,null,'Gráfico de evolução do relatório'),
  ('CETI Dom Edilberto Dinkelborg','Santa Rosa do Piauí','Ensino Médio',2023,4.0,null,null,null,null,'Gráfico de evolução do relatório'),
  ('CETI Dom Edilberto Dinkelborg','Santa Rosa do Piauí','Ensino Médio',2025,5.9,5.860,1.00,294.67,339.17,'Painel do relatório 2025'),
  ('CETI Dr. José Gusmão','Colônia do Piauí','Ensino Médio',2017,3.0,null,null,null,null,'Gráfico de evolução do relatório'),
  ('CETI Dr. José Gusmão','Colônia do Piauí','Ensino Médio',2019,3.0,null,null,null,null,'Gráfico de evolução do relatório'),
  ('CETI Dr. José Gusmão','Colônia do Piauí','Ensino Médio',2023,4.0,null,null,null,null,'Gráfico de evolução do relatório'),
  ('CETI Dr. José Gusmão','Colônia do Piauí','Ensino Médio',2025,5.1,5.100,1.00,284.35,295.66,'Painel do relatório 2025'),
  ('CETI Dr. José de Moura Fé','Campinas do Piauí','Ensino Médio',2017,3.1,null,null,null,null,'Gráfico de evolução do relatório'),
  ('CETI Dr. José de Moura Fé','Campinas do Piauí','Ensino Médio',2019,3.5,null,null,null,null,'Gráfico de evolução do relatório'),
  ('CETI Dr. José de Moura Fé','Campinas do Piauí','Ensino Médio',2023,3.8,null,null,null,null,'Gráfico de evolução do relatório'),
  ('CETI Dr. José de Moura Fé','Campinas do Piauí','Ensino Médio',2025,4.7,4.730,0.99,286.26,267.33,'Painel do relatório 2025'),
  ('CETI Família Agrícola Dom Edilberto II','São João da Varjota','Ensino Médio',2019,2.4,null,null,null,null,'Gráfico de evolução do relatório'),
  ('CETI Família Agrícola Dom Edilberto II','São João da Varjota','Ensino Médio',2025,3.6,4.020,0.90,248.72,256.75,'Painel do relatório 2025'),
  ('CETI Família Agrícola Dom Edilberto III','Cajazeiras do Piauí','Ensino Médio',2017,3.5,null,null,null,null,'Gráfico de evolução do relatório'),
  ('CETI Família Agrícola Dom Edilberto III','Cajazeiras do Piauí','Ensino Médio',2019,3.4,null,null,null,null,'Gráfico de evolução do relatório'),
  ('CETI Família Agrícola Dom Edilberto III','Cajazeiras do Piauí','Ensino Médio',2023,3.6,null,null,null,null,'Gráfico de evolução do relatório'),
  ('CETI Família Agrícola Dom Edilberto III','Cajazeiras do Piauí','Ensino Médio',2025,4.2,4.170,1.00,247.81,268.24,'Painel do relatório 2025'),
  ('CETI Família Agrícola Dom Edilberto IV','Oeiras','Ensino Médio',2017,3.8,null,null,null,null,'Gráfico de evolução do relatório'),
  ('CETI Família Agrícola Dom Edilberto IV','Oeiras','Ensino Médio',2019,3.6,null,null,null,null,'Gráfico de evolução do relatório'),
  ('CETI Família Agrícola Dom Edilberto IV','Oeiras','Ensino Médio',2023,3.5,null,null,null,null,'Gráfico de evolução do relatório'),
  ('CETI Família Agrícola Dom Edilberto IV','Oeiras','Ensino Médio',2025,3.8,3.930,0.97,248.02,251.43,'Painel do relatório 2025'),
  ('CETI Família Agrícola Dom Edilberto V','Santo Inácio do Piauí','Ensino Médio',2019,2.2,null,null,null,null,'Gráfico de evolução do relatório'),
  ('CETI Família Agrícola Dom Edilberto V','Santo Inácio do Piauí','Ensino Médio',2023,3.6,null,null,null,null,'Gráfico de evolução do relatório'),
  ('CETI Família Agrícola Dom Edilberto V','Santo Inácio do Piauí','Ensino Médio',2025,4.5,4.480,1.00,253.98,284.20,'Painel do relatório 2025'),
  ('CETI Família Agrícola Dom Edilberto VII - Dona Jandira Nunes Martins','Santa Cruz do Piauí','Ensino Médio',2019,3.0,null,null,null,null,'Gráfico de evolução do relatório'),
  ('CETI Família Agrícola Dom Edilberto VII - Dona Jandira Nunes Martins','Santa Cruz do Piauí','Ensino Médio',2025,4.1,4.130,1.00,252.29,261.06,'Painel do relatório 2025'),
  ('CETI Francival Rodrigues do Nascimento','Cajazeiras do Piauí','Ensino Médio',2017,3.8,null,null,null,null,'Gráfico de evolução do relatório'),
  ('CETI Francival Rodrigues do Nascimento','Cajazeiras do Piauí','Ensino Médio',2019,2.1,null,null,null,null,'Gráfico de evolução do relatório'),
  ('CETI Francival Rodrigues do Nascimento','Cajazeiras do Piauí','Ensino Médio',2021,3.7,null,null,null,null,'Gráfico de evolução do relatório'),
  ('CETI Francival Rodrigues do Nascimento','Cajazeiras do Piauí','Ensino Médio',2023,3.7,null,null,null,null,'Gráfico de evolução do relatório'),
  ('CETI Francival Rodrigues do Nascimento','Cajazeiras do Piauí','Ensino Médio',2025,4.3,4.330,1.00,265.54,261.19,'Painel do relatório 2025'),
  ('CETI João de Sousa Moura','Santo Inácio do Piauí','Ensino Médio',2017,3.5,null,null,null,null,'Gráfico de evolução do relatório'),
  ('CETI João de Sousa Moura','Santo Inácio do Piauí','Ensino Médio',2019,4.2,null,null,null,null,'Gráfico de evolução do relatório'),
  ('CETI João de Sousa Moura','Santo Inácio do Piauí','Ensino Médio',2021,4.4,null,null,null,null,'Gráfico de evolução do relatório'),
  ('CETI João de Sousa Moura','Santo Inácio do Piauí','Ensino Médio',2023,4.2,null,null,null,null,'Gráfico de evolução do relatório'),
  ('CETI João de Sousa Moura','Santo Inácio do Piauí','Ensino Médio',2025,5.5,5.490,1.00,310.52,295.62,'Painel do relatório 2025'),
  ('CETI Miguel Marinho','São Miguel do Fidalgo','Ensino Médio',2017,3.5,null,null,null,null,'Gráfico de evolução do relatório'),
  ('CETI Miguel Marinho','São Miguel do Fidalgo','Ensino Médio',2019,4.4,null,null,null,null,'Gráfico de evolução do relatório'),
  ('CETI Miguel Marinho','São Miguel do Fidalgo','Ensino Médio',2023,4.5,null,null,null,null,'Gráfico de evolução do relatório'),
  ('CETI Miguel Marinho','São Miguel do Fidalgo','Ensino Médio',2025,5.3,5.320,1.00,303.25,291.48,'Painel do relatório 2025'),
  ('CETI Orlando Carvalho','Oeiras','Ensino Médio',2017,3.5,null,null,null,null,'Gráfico de evolução do relatório'),
  ('CETI Orlando Carvalho','Oeiras','Ensino Médio',2019,3.7,null,null,null,null,'Gráfico de evolução do relatório'),
  ('CETI Orlando Carvalho','Oeiras','Ensino Médio',2023,4.4,null,null,null,null,'Gráfico de evolução do relatório'),
  ('CETI Orlando Carvalho','Oeiras','Ensino Médio',2025,6.0,5.970,1.00,295.82,345.81,'Painel do relatório 2025'),
  ('CETI Professor Balduíno Barbosa de Deus','Oeiras','Ensino Médio',2019,3.2,null,null,null,null,'Gráfico de evolução do relatório'),
  ('CETI Professor Balduíno Barbosa de Deus','Oeiras','Ensino Médio',2023,3.7,null,null,null,null,'Gráfico de evolução do relatório'),
  ('CETI Professor Balduíno Barbosa de Deus','Oeiras','Ensino Médio',2025,4.7,4.880,0.96,271.25,294.09,'Painel do relatório 2025'),
  ('CETI Rocha Neto','Oeiras','Ensino Médio',2017,4.5,null,null,null,null,'Gráfico de evolução do relatório'),
  ('CETI Rocha Neto','Oeiras','Ensino Médio',2019,4.8,null,null,null,null,'Gráfico de evolução do relatório'),
  ('CETI Rocha Neto','Oeiras','Ensino Médio',2021,4.5,null,null,null,null,'Gráfico de evolução do relatório'),
  ('CETI Rocha Neto','Oeiras','Ensino Médio',2023,4.9,null,null,null,null,'Gráfico de evolução do relatório'),
  ('CETI Rocha Neto','Oeiras','Ensino Médio',2025,5.2,5.160,1.00,292.27,291.71,'Painel do relatório 2025'),
  ('CETI Severo Maria Eulálio','Santa Cruz do Piauí','Ensino Médio',2019,4.0,null,null,null,null,'Gráfico de evolução do relatório'),
  ('CETI Severo Maria Eulálio','Santa Cruz do Piauí','Ensino Médio',2023,4.4,null,null,null,null,'Gráfico de evolução do relatório'),
  ('CETI Severo Maria Eulálio','Santa Cruz do Piauí','Ensino Médio',2025,4.5,4.510,1.00,268.01,271.22,'Painel do relatório 2025'),
  ('CETI São João Batista','São João da Varjota','Ensino Médio',2017,3.6,null,null,null,null,'Gráfico de evolução do relatório'),
  ('CETI São João Batista','São João da Varjota','Ensino Médio',2019,3.6,null,null,null,null,'Gráfico de evolução do relatório'),
  ('CETI São João Batista','São João da Varjota','Ensino Médio',2023,4.0,null,null,null,null,'Gráfico de evolução do relatório'),
  ('CETI São João Batista','São João da Varjota','Ensino Médio',2025,4.5,4.510,1.00,266.96,272.16,'Painel do relatório 2025'),
  ('CETI São Sebastião','Tanque do Piauí','Ensino Médio',2017,4.2,null,null,null,null,'Gráfico de evolução do relatório'),
  ('CETI São Sebastião','Tanque do Piauí','Ensino Médio',2019,4.7,null,null,null,null,'Gráfico de evolução do relatório'),
  ('CETI São Sebastião','Tanque do Piauí','Ensino Médio',2021,5.1,null,null,null,null,'Gráfico de evolução do relatório'),
  ('CETI São Sebastião','Tanque do Piauí','Ensino Médio',2023,4.7,null,null,null,null,'Gráfico de evolução do relatório'),
  ('CETI São Sebastião','Tanque do Piauí','Ensino Médio',2025,6.3,6.260,1.00,314.99,345.39,'Painel do relatório 2025'),
  ('CETI Wilson Nunes Martins Filho','Floresta do Piauí','Ensino Médio',2017,3.0,null,null,null,null,'Gráfico de evolução do relatório'),
  ('CETI Wilson Nunes Martins Filho','Floresta do Piauí','Ensino Médio',2019,3.6,null,null,null,null,'Gráfico de evolução do relatório'),
  ('CETI Wilson Nunes Martins Filho','Floresta do Piauí','Ensino Médio',2023,4.7,null,null,null,null,'Gráfico de evolução do relatório'),
  ('CETI Wilson Nunes Martins Filho','Floresta do Piauí','Ensino Médio',2025,5.9,6.240,0.94,319.39,339.54,'Painel do relatório 2025')
on conflict (escola_nome, etapa, ano)
do update set
  municipio=excluded.municipio,
  ideb=excluded.ideb,
  aprendizado=excluded.aprendizado,
  fluxo=excluded.fluxo,
  portugues=excluded.portugues,
  matematica=excluded.matematica,
  origem=excluded.origem;

insert into public.ideb_composicao_gre (resultado_id, incluida)
select r.id, true
from public.ideb_resultados r
left join public.ideb_composicao_gre c on c.resultado_id=r.id
where c.resultado_id is null;

create index if not exists idx_ideb_resultados_etapa_ano
  on public.ideb_resultados(etapa, ano);

create index if not exists idx_ideb_resultados_escola
  on public.ideb_resultados(escola_nome);
