insert into public.ideb_resultados
  (escola_nome, municipio, etapa, ano, ideb, aprendizado, fluxo, portugues, matematica, origem)
values
  ('CETI Farmacêutico João Carvalho', 'Oeiras', 'Ensino Médio', 2019, 3.2, null, null, null, null, 'Gráfico de evolução do relatório'),
  ('CETI Farmacêutico João Carvalho', 'Oeiras', 'Ensino Médio', 2025, 4.8, 4.840, 1.00, 281.75, 280.08, 'Painel do relatório 2025')
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
where r.escola_nome='CETI Farmacêutico João Carvalho'
  and r.etapa='Ensino Médio'
  and c.resultado_id is null;
