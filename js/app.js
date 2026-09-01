(() => {
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const store = window.PortalStore;
  const state = { user: null, schools: [], transport: [], visits: [], management: [], profiles: [], sectors: [], classReports: [], classItems: [], teacherMappings: [], activeClassReportId: null, aulasModuleReady: true, idebResults: [], idebComposition: [], idebModuleReady: true };
  const roleLabels = { admin:'Administrador', gerencia:'Gerência Regional', coordenacao:'Coordenação', tecnico:'Técnico da GRE', visualizacao:'Visualização', escola:'Escola' };
  const titles = { dashboard:'Apresentação', transporte:'Gerência Regional • Transporte', ensino:'Ensino e Aprendizagem', visitas:'Ensino e Aprendizagem • Visitas', ideb:'Ensino e Aprendizagem • IDEB das Escolas', gestao:'Gestão e Inspeção • Acompanhamento Escolar', administracao:'Administração', prestacao:'Prestação de Contas', escolas:'Escolas', usuarios:'Usuários e Permissões', aulas:'Gestão e Inspeção • Acompanhamento de Aulas' };
  let transportCalendarDate = new Date();
  const transportMonthNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  function toast(message) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(window.__toastTimer);
    window.__toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
  }
  function esc(v=''){ return String(v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c])); }
  function fmtDate(v){ if(!v) return '—'; const [y,m,d]=String(v).slice(0,10).split('-'); return `${d}/${m}/${y}`; }
  function formData(form){ return Object.fromEntries(new FormData(form).entries()); }
  function setText(selector, value){ const el=$(selector); if(el) el.textContent=value; }
  function isExecutive(){ return ['admin','gerencia'].includes(state.user?.role); }
  function isManager(){ return ['admin','gerencia','coordenacao'].includes(state.user?.role); }
  function canManageTransport(){ return ['admin','gerencia'].includes(state.user?.role); }
  function canEditTransport(){ return canManageTransport(); }
  function canChangeTransportStatus(){ return canManageTransport(); }
  function canManageAulas(){ return ['admin','gerencia','coordenacao'].includes(state.user?.role); }
  function canManageIdeb(){ return ['admin','gerencia','coordenacao'].includes(state.user?.role); }
  function isReadOnly(){ return state.user?.role === 'visualizacao'; }
  function canWriteOperational(){ return ['admin','gerencia','coordenacao','tecnico'].includes(state.user?.role); }

  async function loadData(){
    try {
      const [schools, transport, visits, management] = await Promise.all(['schools','transport','visits','management'].map(store.list));
      Object.assign(state,{schools,transport,visits,management});
      if (isExecutive()) state.profiles=await store.listProfiles(); else state.profiles=[];
      if (isManager()) state.sectors=await store.listSectors(); else state.sectors=[];
      try{
        const [idebResults,idebComposition]=await Promise.all([store.listIdebResults(),store.listIdebComposition()]);
        state.idebResults=idebResults;
        state.idebComposition=idebComposition;
        state.idebModuleReady=true;
      }catch(idebErr){
        console.warn('Módulo IDEB ainda não inicializado:',idebErr);
        state.idebResults=[]; state.idebComposition=[]; state.idebModuleReady=false;
      }
      try{
        state.classReports=await store.listClassReports();
        if(!state.activeClassReportId && state.classReports.length) state.activeClassReportId=state.classReports[0].id;
        if(state.activeClassReportId && !state.classReports.some(r=>r.id===state.activeClassReportId)) state.activeClassReportId=state.classReports[0]?.id||null;
        state.classItems=state.activeClassReportId ? await store.listClassItems(state.activeClassReportId) : [];
        state.aulasModuleReady=true;
      }catch(aulasErr){
        console.warn('Módulo de aulas ainda não inicializado:', aulasErr);
        state.classReports=[]; state.classItems=[]; state.activeClassReportId=null; state.aulasModuleReady=false;
      }
      renderAll();
    } catch(err){
      console.error(err);
      toast('Não foi possível carregar as informações. Tente novamente em instantes.');
    }
  }

  function setUser(user){
    state.user = user;
    const label = roleLabels[user.role] || user.role;
    setText('#userMiniName', user.name || 'Usuário');
    setText('#userMiniRole', label);
    setText('#userAvatar', (user.name || 'U').trim()[0].toUpperCase());
    $$('.admin-only').forEach(el => el.classList.toggle('hidden', !isExecutive()));
    const schoolBtn=$('#newSchoolBtn'); if(schoolBtn) schoolBtn.classList.toggle('hidden', !isManager());
    const transportBtn=$('#newTransportBtn'); if(transportBtn) transportBtn.classList.toggle('hidden', !canManageTransport());
    const aulasBtn=$('#newAulasReportBtn'); if(aulasBtn) aulasBtn.classList.toggle('hidden', !canManageAulas());
    const idebBtn=$('#editIdebCompositionBtn'); if(idebBtn) idebBtn.classList.toggle('hidden', !canManageIdeb());
    const visitBtn=$('#newVisitBtn'); if(visitBtn) visitBtn.classList.toggle('hidden', !canWriteOperational());
    const managementBtn=$('#newManagementBtn'); if(managementBtn) managementBtn.classList.toggle('hidden', !canWriteOperational());
    setText('#dashboardUserName', user.name || 'Usuário');
    setText('#dashboardUserRole', label);
    setText('#dashboardAvatar', (user.name || 'U').trim()[0].toUpperCase());
  }

  async function boot(){
    const config = await store.init();
    updateConnectionUi(config);
    const user = await store.currentSession();
    if (user) await showApp(user); else showLogin();
  }

  function updateConnectionUi(config){ return; }

  function showLogin(){ $('#loginView')?.classList.remove('hidden'); $('#appView')?.classList.add('hidden'); }
  async function showApp(user){ $('#loginView')?.classList.add('hidden'); $('#appView')?.classList.remove('hidden'); setUser(user); await loadData(); navigate('dashboard'); }

  function navigate(view){
    if(view==='usuarios' && !isExecutive()){ toast('Apenas Gerência e Administrador podem gerenciar usuários.'); return; }
    $$('.view').forEach(v => v.classList.remove('active-view'));
    $$('.nav-item').forEach(v => v.classList.remove('active'));
    document.getElementById(view)?.classList.add('active-view');
    $(`.nav-item[data-view="${view}"]`)?.classList.add('active');
    setText('#pageTitle', titles[view] || 'Portal 8ª GRE');
    $('.sidebar')?.classList.remove('open');
  }

  function renderAll(){ renderStats(); renderDashboardLists(); renderSchools(); renderTransport(); renderVisits(); renderManagement(); renderUsers(); renderAulas(); renderIdeb(); }
  function renderStats(){
    setText('#statTransport', state.transport.filter(x=>x.status!=='Cancelado').length);
    setText('#statVisits', state.visits.length);
    setText('#statSchools', state.schools.filter(s=>s.ativo !== false).length);
    setText('#statInterventions', state.management.filter(m => !['Concluída','Concluido','Concluído'].includes(m.status)).length);
  }
  function renderDashboardLists(){
    const trans = [...state.transport].filter(x=>x.status!=='Cancelado').sort((a,b)=>`${a.data||''}${a.hora_saida||''}`.localeCompare(`${b.data||''}${b.hora_saida||''}`)).slice(0,4);
    const transEl=$('#dashboardTransportList');
    if(transEl) transEl.innerHTML = trans.length ? trans.map(x=>`<div class="activity-item"><span class="activity-dot"></span><div><strong>${esc(fmtDate(x.data))} • ${esc(x.veiculo || '')}</strong><small>${esc(x.destino || x.escola_nome || 'Destino não informado')} — ${esc(x.responsavel || '')}</small></div></div>`).join('') : 'Nenhum agendamento cadastrado.';
    const visits = state.visits.slice(0,4);
    const visitEl=$('#dashboardVisitList');
    if(visitEl) visitEl.innerHTML = visits.length ? visits.map(x=>`<div class="activity-item"><span class="activity-dot" style="background:var(--green)"></span><div><strong>${esc(x.escola_nome || schoolName(x.escola_id))}</strong><small>${esc(fmtDate(x.data))} — ${esc(x.tecnico || '')}</small></div></div>`).join('') : 'Nenhuma visita cadastrada.';
  }
  function schoolName(id){ return state.schools.find(s=>s.id===id)?.nome || 'Escola não informada'; }
  function sectorName(id){ return state.sectors.find(s=>s.id===id)?.nome || '—'; }
  function schoolOptions(selected=''){ return `<option value="">Selecione</option>` + state.schools.filter(s=>s.ativo!==false).map(s=>`<option value="${esc(s.id)}" ${s.id===selected?'selected':''}>${esc(s.nome)} — ${esc(s.municipio||'')}</option>`).join(''); }
  function sectorOptions(selected=''){ return `<option value="">Sem setor vinculado</option>` + state.sectors.map(s=>`<option value="${esc(s.id)}" ${s.id===selected?'selected':''}>${esc(s.nome)}</option>`).join(''); }



  function idebCompositionMap(){
    return new Map(state.idebComposition.map(x=>[x.resultado_id,x.incluida!==false]));
  }

  function idebIncluded(row){
    const map=idebCompositionMap();
    return map.has(row.id) ? map.get(row.id) : true;
  }

  function idebRows(stage=null,year=null){
    return state.idebResults.filter(r=>(!stage||r.etapa===stage)&&(!year||Number(r.ano)===Number(year)));
  }

  function idebYears(stage){
    return [...new Set(idebRows(stage).map(r=>Number(r.ano)))].sort((a,b)=>b-a);
  }

  function idebPrevious(row){
    return state.idebResults
      .filter(r=>r.escola_nome===row.escola_nome && r.etapa===row.etapa && Number(r.ano)<Number(row.ano))
      .sort((a,b)=>Number(b.ano)-Number(a.ano))[0] || null;
  }

  function fmtIdeb(v){
    const n=Number(v);
    return Number.isFinite(n)?n.toFixed(1).replace('.',','):'—';
  }

  function fmtSigned(v){
    const n=Number(v);
    if(!Number.isFinite(n)) return '—';
    return `${n>0?'+':''}${n.toFixed(1).replace('.',',')}`;
  }

  function idebEvolutionClass(v){
    if(v===null || v===undefined || !Number.isFinite(Number(v))) return 'neutral';
    return Number(v)>0.05?'up':Number(v)<-0.05?'down':'stable';
  }

  function idebAverage(rows){
    const vals=rows.map(r=>Number(r.ideb)).filter(Number.isFinite);
    return vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null;
  }

  function idebRegionalSeries(stage){
    const years=[...new Set(idebRows(stage).map(r=>Number(r.ano)))].sort((a,b)=>a-b);
    return years.map(ano=>{
      const rows=idebRows(stage,ano).filter(idebIncluded);
      return {ano,valor:idebAverage(rows),n:rows.length};
    }).filter(x=>x.valor!==null);
  }

  function idebLineSvg(points,opts={}){
    if(!points.length) return '<div class="empty-block">Sem histórico para exibir.</div>';
    const W=680,H=250,padL=44,padR=24,padT=22,padB=42;
    const vals=points.map(p=>Number(p.valor));
    let min=Math.min(...vals),max=Math.max(...vals);
    min=Math.max(0,Math.floor((min-.5)*2)/2);
    max=Math.min(10,Math.ceil((max+.5)*2)/2);
    if(max-min<1){min=Math.max(0,min-.5);max=Math.min(10,max+.5);}
    const x=i=>points.length===1?W/2:padL+i*(W-padL-padR)/(points.length-1);
    const y=v=>padT+(max-v)*(H-padT-padB)/(max-min||1);
    const poly=points.map((p,i)=>`${x(i)},${y(p.valor)}`).join(' ');
    const grids=Array.from({length:5},(_,i)=>{
      const val=min+(max-min)*i/4;
      return `<line x1="${padL}" y1="${y(val)}" x2="${W-padR}" y2="${y(val)}" class="ideb-grid-line"/><text x="${padL-8}" y="${y(val)+4}" text-anchor="end" class="ideb-axis-text">${val.toFixed(1).replace('.',',')}</text>`;
    }).join('');
    const labels=points.map((p,i)=>`<text x="${x(i)}" y="${H-14}" text-anchor="middle" class="ideb-axis-text">${p.ano}</text>`).join('');
    const dots=points.map((p,i)=>`<g><circle cx="${x(i)}" cy="${y(p.valor)}" r="5" class="ideb-chart-dot"/><text x="${x(i)}" y="${y(p.valor)-10}" text-anchor="middle" class="ideb-chart-value">${fmtIdeb(p.valor)}</text></g>`).join('');
    return `<svg viewBox="0 0 ${W} ${H}" class="ideb-svg" role="img" aria-label="${esc(opts.label||'Evolução do IDEB')}">${grids}<polyline points="${poly}" class="ideb-chart-line"/>${dots}${labels}</svg>`;
  }

  function syncIdebFilters(){
    const stage=$('#idebStageFilter')?.value||'Ensino Médio';
    const years=idebYears(stage);
    const yearEl=$('#idebYearFilter');
    if(!yearEl) return;
    const current=Number(yearEl.value)||years[0];
    yearEl.innerHTML=years.map(y=>`<option value="${y}">${y}</option>`).join('');
    yearEl.value=years.includes(current)?String(current):String(years[0]||2025);
  }

  function renderIdeb(){
    const table=$('#idebTable');
    if(!table) return;

    const manageBtn=$('#editIdebCompositionBtn');
    if(manageBtn) manageBtn.classList.toggle('hidden',!canManageIdeb());

    if(!state.idebModuleReady){
      $('#idebNotice').innerHTML='<strong>Módulo temporariamente indisponível.</strong><span>Procure a administração do Portal 8ª GRE.</span>';
      table.innerHTML='';
      return;
    }

    syncIdebFilters();

    const stage=$('#idebStageFilter')?.value||'Ensino Médio';
    const year=Number($('#idebYearFilter')?.value)||idebYears(stage)[0]||2025;
    const sort=$('#idebSort')?.value||'ideb_desc';
    const q=($('#idebSearch')?.value||'').trim().toLocaleLowerCase('pt-BR');

    const allRows=idebRows(stage,year);
    const included=allRows.filter(idebIncluded);
    const avg=idebAverage(included);
    const sortedIncluded=[...included].sort((a,b)=>Number(b.ideb)-Number(a.ideb));
    const maxRow=sortedIncluded[0]||null;
    const minRow=sortedIncluded.at(-1)||null;

    const series=idebRegionalSeries(stage);
    const seriesIndex=series.findIndex(x=>x.ano===year);
    const currentPoint=series[seriesIndex]||null;
    const previousPoint=seriesIndex>0?series[seriesIndex-1]:null;
    const greEvolution=currentPoint&&previousPoint?currentPoint.valor-previousPoint.valor:null;

    setText('#idebKpiAverage',avg===null?'—':fmtIdeb(avg));
    setText('#idebKpiAverageNote',`${stage} • ${year}`);
    setText('#idebKpiSchools',included.length);
    setText('#idebKpiSchoolsNote',`${allRows.length} escola(s) com resultado`);
    setText('#idebKpiMax',maxRow?fmtIdeb(maxRow.ideb):'—');
    setText('#idebKpiMaxSchool',maxRow?.escola_nome||'—');
    setText('#idebKpiMin',minRow?fmtIdeb(minRow.ideb):'—');
    setText('#idebKpiMinSchool',minRow?.escola_nome||'—');
    setText('#idebKpiEvolution',greEvolution===null?'—':fmtSigned(greEvolution));
    setText('#idebKpiEvolutionNote',previousPoint?`${previousPoint.ano} → ${year}`:'Sem edição anterior consolidada');

    const chart=$('#idebGreChart');
    if(chart) chart.innerHTML=idebLineSvg(series,{label:`Média IDEB da 8ª GRE - ${stage}`});

    const schoolEvolution=included.map(r=>{
      const prev=idebPrevious(r);
      return {r,prev,evol:prev?Number(r.ideb)-Number(prev.ideb):null};
    });
    const advances=schoolEvolution.filter(x=>x.evol!==null&&x.evol>.05).length;
    const drops=schoolEvolution.filter(x=>x.evol!==null&&x.evol<-.05).length;
    const stable=schoolEvolution.filter(x=>x.evol!==null&&Math.abs(x.evol)<=.05).length;
    const avgLearning=idebAverage(included.filter(r=>r.aprendizado!==null).map(r=>({ideb:r.aprendizado})));
    const avgFlow=idebAverage(included.filter(r=>r.fluxo!==null).map(r=>({ideb:r.fluxo})));

    const analysis=$('#idebAnalysis');
    if(analysis){
      analysis.innerHTML=included.length?`
        <p>Na edição <strong>${year}</strong>, a média simples das <strong>${included.length}</strong> escolas selecionadas em <strong>${esc(stage)}</strong> é <strong>${fmtIdeb(avg)}</strong>.</p>
        ${previousPoint?`<p>Em relação a <strong>${previousPoint.ano}</strong>, a média regional ${greEvolution>0?'aumentou':greEvolution<0?'diminuiu':'permaneceu estável'} em <strong>${fmtSigned(greEvolution)}</strong> ponto(s).</p>`:''}
        <div class="ideb-analysis-badges">
          <span class="up">↑ ${advances} avançaram</span>
          <span class="stable">→ ${stable} mantiveram</span>
          <span class="down">↓ ${drops} recuaram</span>
        </div>
        ${year===2025&&avgLearning!==null?`<p>Nos componentes de 2025, o aprendizado médio é <strong>${avgLearning.toFixed(2).replace('.',',')}</strong> e o fluxo médio é <strong>${avgFlow.toFixed(2).replace('.',',')}</strong>.</p>`:''}
        <p class="hint">A composição utilizada no cálculo pode ser ajustada para cada edição.</p>
      `:'<div class="empty-block">Nenhuma escola selecionada para esta edição.</div>';
    }

    let display=allRows.filter(r=>!q||[r.escola_nome,r.municipio].some(v=>String(v||'').toLocaleLowerCase('pt-BR').includes(q)));
    display=display.map(r=>{
      const prev=idebPrevious(r);
      return {...r,_prev:prev,_evol:prev?Number(r.ideb)-Number(prev.ideb):null};
    }).sort((a,b)=>{
      if(sort==='ideb_asc') return Number(a.ideb)-Number(b.ideb);
      if(sort==='evol_desc') return (b._evol??-99)-(a._evol??-99);
      if(sort==='evol_asc') return (a._evol??99)-(b._evol??99);
      if(sort==='school_asc') return String(a.escola_nome).localeCompare(String(b.escola_nome),'pt-BR');
      return Number(b.ideb)-Number(a.ideb);
    });

    setText('#idebResultCount',`${display.length} escola${display.length===1?'':'s'}`);
    $('#idebEmpty')?.classList.toggle('hidden',display.length>0);

    table.innerHTML=display.map(r=>{
      const includedNow=idebIncluded(r);
      const cls=idebEvolutionClass(r._evol);
      return `<tr class="${includedNow?'':'ideb-row-excluded'}">
        <td class="school-cell"><strong>${esc(r.escola_nome)}</strong></td>
        <td>${esc(r.municipio||'—')}</td>
        <td><strong class="ideb-score">${fmtIdeb(r.ideb)}</strong></td>
        <td>${r._prev?`${r._prev.ano}: ${fmtIdeb(r._prev.ideb)}`:'—'}</td>
        <td><span class="ideb-evol ${cls}">${r._evol===null?'—':fmtSigned(r._evol)}</span></td>
        <td>${r.aprendizado!==null&&r.aprendizado!==undefined?Number(r.aprendizado).toFixed(2).replace('.',','):'—'}</td>
        <td>${r.fluxo!==null&&r.fluxo!==undefined?Number(r.fluxo).toFixed(2).replace('.',','):'—'}</td>
        <td><span class="ideb-gre-status ${includedNow?'included':'excluded'}">${includedNow?'Considerada':'Fora do cálculo'}</span></td>
        <td><button class="action-btn" type="button" data-ideb-school="${esc(r.id)}">Analisar</button></td>
      </tr>`;
    }).join('');
  }

  function openIdebSchool(rowId){
    const row=state.idebResults.find(r=>r.id===rowId);
    if(!row) return;
    const hist=state.idebResults
      .filter(r=>r.escola_nome===row.escola_nome&&r.etapa===row.etapa)
      .sort((a,b)=>Number(a.ano)-Number(b.ano));
    const current=hist.find(r=>Number(r.ano)===2025)||hist.at(-1);
    const points=hist.map(r=>({ano:Number(r.ano),valor:Number(r.ideb)}));
    const first=hist[0],last=hist.at(-1),accum=first&&last?Number(last.ideb)-Number(first.ideb):null;

    openModal(
      row.escola_nome,
      `${row.etapa} • Evolução do IDEB`,
      `<div class="ideb-school-modal">
        <div class="ideb-school-summary">
          <div><small>Último IDEB</small><strong>${fmtIdeb(last?.ideb)}</strong><span>${last?.ano||''}</span></div>
          <div><small>Evolução acumulada</small><strong class="${idebEvolutionClass(accum)}">${accum===null?'—':fmtSigned(accum)}</strong><span>${first?.ano||''} → ${last?.ano||''}</span></div>
          <div><small>Município</small><strong class="text-value">${esc(row.municipio||'—')}</strong><span>${esc(row.etapa)}</span></div>
        </div>
        <div class="ideb-modal-chart">${idebLineSvg(points,{label:`Evolução do IDEB - ${row.escola_nome}`})}</div>
        ${current&&Number(current.ano)===2025?`
          <div class="ideb-component-grid">
            <div><small>Aprendizado 2025</small><strong>${Number(current.aprendizado).toFixed(2).replace('.',',')}</strong></div>
            <div><small>Fluxo 2025</small><strong>${Number(current.fluxo).toFixed(2).replace('.',',')}</strong></div>
            <div><small>Português</small><strong>${Number(current.portugues).toFixed(2).replace('.',',')}</strong></div>
            <div><small>Matemática</small><strong>${Number(current.matematica).toFixed(2).replace('.',',')}</strong></div>
          </div>
        `:''}
        <div class="table-wrap"><table class="mini-history-table"><thead><tr><th>Edição</th><th>IDEB</th><th>GRE</th></tr></thead><tbody>
          ${[...hist].reverse().map(r=>`<tr><td>${r.ano}</td><td><strong>${fmtIdeb(r.ideb)}</strong></td><td>${idebIncluded(r)?'Considerada':'Fora do cálculo'}</td></tr>`).join('')}
        </tbody></table></div>
        <p class="hint">Fonte: relatórios IDEB/INEP enviados à 8ª GRE.</p>
        <div class="modal-actions"><button type="button" data-close class="btn primary">Fechar</button></div>
      </div>`
    );
  }

  function openIdebComposition(){
    if(!canManageIdeb()){ toast('Seu perfil possui acesso somente para consulta.'); return; }
    const stage=$('#idebStageFilter')?.value||'Ensino Médio';
    const year=Number($('#idebYearFilter')?.value)||2025;
    const rows=idebRows(stage,year).sort((a,b)=>String(a.escola_nome).localeCompare(String(b.escola_nome),'pt-BR'));

    openModal(
      'Definir escolas da GRE',
      `${stage} • IDEB ${year}`,
      `<div class="ideb-composition">
        <p>Marque somente as escolas que pertenciam à <strong>8ª GRE</strong> no período da avaliação desta edição. Essa seleção será usada na média e nos indicadores regionais.</p>
        <div class="ideb-composition-actions">
          <button id="idebSelectAll" type="button" class="btn secondary small">Selecionar todas</button>
          <button id="idebClearAll" type="button" class="btn secondary small">Limpar seleção</button>
          <strong id="idebCompositionCount"></strong>
        </div>
        <div class="ideb-composition-list">
          ${rows.map(r=>`<label class="ideb-check-row"><input type="checkbox" data-ideb-composition="${esc(r.id)}" ${idebIncluded(r)?'checked':''}><span><strong>${esc(r.escola_nome)}</strong><small>${esc(r.municipio||'')} • IDEB ${fmtIdeb(r.ideb)}</small></span></label>`).join('')}
        </div>
        <div class="modal-actions">
          <button type="button" data-close class="btn secondary">Cancelar</button>
          <button id="saveIdebCompositionBtn" type="button" class="btn ideb-btn">Salvar composição da GRE</button>
        </div>
      </div>`
    );
    updateIdebCompositionCount();
  }

  function updateIdebCompositionCount(){
    const checks=$$('[data-ideb-composition]');
    const selected=checks.filter(c=>c.checked).length;
    setText('#idebCompositionCount',`${selected} de ${checks.length} selecionadas`);
  }

  async function saveIdebComposition(){
    const checks=$$('[data-ideb-composition]');
    if(!checks.length) return;
    const btn=$('#saveIdebCompositionBtn');
    try{
      if(btn){btn.disabled=true;btn.textContent='Salvando...';}
      const items=checks.map(c=>({resultado_id:c.dataset.idebComposition,incluida:c.checked}));
      const saved=await store.saveIdebComposition(items);
      const map=new Map(saved.map(x=>[x.resultado_id,x]));
      state.idebComposition=state.idebComposition.filter(x=>!map.has(x.resultado_id));
      state.idebComposition.push(...saved);
      closeModal();
      renderIdeb();
      toast('Composição da GRE atualizada.');
    }catch(err){
      console.error(err);
      toast('Não foi possível salvar a composição.');
    }finally{
      if(btn&&document.body.contains(btn)){btn.disabled=false;btn.textContent='Salvar composição da GRE';}
    }
  }

  const AULAS_CALENDAR = {
    '2026/1':{start:'2026-02-19',end:'2026-07-11'},
    '2026/2':{start:'2026-07-30',end:'2026-12-22'}
  };
  let pendingAulasImport=null;

  function localDate(v){ const [y,m,d]=String(v).slice(0,10).split('-').map(Number); return new Date(y,m-1,d,12,0,0); }
  function countWeekdays(start,end){
    let a=localDate(start), b=localDate(end), n=0;
    for(let d=new Date(a); d<=b; d.setDate(d.getDate()+1)){ const w=d.getDay(); if(w!==0&&w!==6) n++; }
    return n;
  }
  function expectedAulas(row,refDate){
    const cfg=AULAS_CALENDAR[row.periodo]; const total=Number(row.carga_horaria_total||0); if(!cfg||!refDate) return 0;
    const ref=String(refDate).slice(0,10); if(ref<cfg.start) return 0; if(ref>=cfg.end) return Math.round(total);
    const all=countWeekdays(cfg.start,cfg.end), elapsed=countWeekdays(cfg.start,ref);
    return all ? Math.round(total*(elapsed/all)) : 0;
  }
  function currentAulasReport(){ return state.classReports.find(r=>r.id===state.activeClassReportId)||null; }

  function normalizeAulasText(v=''){
    return String(v||'').replace(/\uFFFE|\uFFFF|\u0000/g,' ').replace(/\s+/g,' ').trim();
  }

  function modalidadeFromTurma(turma=''){
    const t=normalizeAulasText(turma).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
    if(t.includes('EJA')) return 'EJA';
    if(/^EF/.test(t) || t.includes('FUND ') || t.includes('FUND-') || t.includes('FUNDAMENTAL')) return 'Ensino Fundamental';
    if(/^EM/.test(t) || t.includes(' SERIE') || t.includes('ENSINO MEDIO')) return 'Ensino Médio';
    return 'Outros';
  }

  function directLessonHours(row){
    const ac=Number(row.aulas_confirmadas||0), ch=Number(row.carga_horaria_confirmada||0);
    if(ac>0 && ch>0) return ch/ac;
    const aa=Number(row.aulas_aguardando_confirmacao||0), ah=Number(row.aguardando_confirmacao_h||0);
    if(aa>0 && ah>0) return ah/aa;
    return 0;
  }

  function median(values){
    const v=values.filter(x=>Number.isFinite(x)&&x>0).sort((a,b)=>a-b);
    if(!v.length) return 0;
    const i=Math.floor(v.length/2);
    return v.length%2?v[i]:(v[i-1]+v[i])/2;
  }

  function lessonHoursForRow(row){
    const own=directLessonHours(row);
    if(own>0) return own;
    const turmaRates=state.classItems.filter(x=>String(x.escola_inep||'')===String(row.escola_inep||'') && String(x.id_turma||'')===String(row.id_turma||'')).map(directLessonHours);
    return median(turmaRates)||1;
  }

  function totalPlannedLessons(row){
    const h=Number(row.carga_horaria_total||0), d=lessonHoursForRow(row);
    return d>0?Math.round(h/d):Math.round(h);
  }

  function expectedAulas(row,refDate){
    const cfg=AULAS_CALENDAR[row.periodo], total=totalPlannedLessons(row);
    if(!cfg||!refDate) return 0;
    const ref=String(refDate).slice(0,10);
    if(ref<cfg.start) return 0;
    if(ref>=cfg.end) return total;
    const all=countWeekdays(cfg.start,cfg.end), elapsed=countWeekdays(cfg.start,ref);
    return all?Math.round(total*(elapsed/all)):0;
  }

  function aulasRowMetrics(row,refDate){
    const totalPlanned=totalPlannedLessons(row), expected=expectedAulas(row,refDate);
    const conf=Number(row.aulas_confirmadas||0), awaiting=Number(row.aulas_aguardando_confirmacao||0);
    const registered=conf+awaiting, missing=Math.max(expected-registered,0);
    const rate=expected?Math.min(100,(registered/expected)*100):(registered>0?100:0);
    return {totalPlanned,expected,conf,awaiting,registered,missing,rate};
  }

  function aulasStatus(rate){ return rate>=95?['Em dia','ok']:rate>=85?['Atenção','warn']:['Crítico','crit']; }

  function populateSelect(el,values,placeholder){
    if(!el) return;
    const cur=el.value;
    const values2=[...new Set(values.filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'pt-BR'));
    el.innerHTML=`<option value="">${placeholder}</option>`+values2.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');
    if(values2.some(v=>String(v)===String(cur))) el.value=cur;
  }

  function syncAulasFilterOptions(){
    const schoolEl=$('#aulasSchoolFilter'), modalityEl=$('#aulasModalityFilter');
    populateSelect(schoolEl,state.classItems.map(r=>r.escola_nome),'Todas as escolas');

    const school=schoolEl?.value||'';
    let scope=state.classItems.filter(r=>!school||r.escola_nome===school);

    populateSelect(modalityEl,scope.map(r=>modalidadeFromTurma(r.turma)),'Todas as modalidades');
    const modality=modalityEl?.value||'';
    if(modality) scope=scope.filter(r=>modalidadeFromTurma(r.turma)===modality);

    const period=$('#aulasPeriodFilter')?.value||'';
    if(period) scope=scope.filter(r=>r.periodo===period);

    populateSelect($('#aulasSubjectFilter'),scope.map(r=>r.disciplina),'Todas as disciplinas');
    populateSelect($('#aulasClassFilter'),scope.map(r=>r.turma),'Todas as turmas');
  }

  function filteredAulasRows(){
    const school=$('#aulasSchoolFilter')?.value||'', modality=$('#aulasModalityFilter')?.value||'';
    const subject=$('#aulasSubjectFilter')?.value||'', turma=$('#aulasClassFilter')?.value||'';
    const period=$('#aulasPeriodFilter')?.value||'', sort=$('#aulasSort')?.value||'registro_asc';
    const q=($('#aulasSearch')?.value||'').trim().toLocaleLowerCase('pt-BR'), ref=currentAulasReport()?.data_referencia;

    const rows=state.classItems.filter(r=>{
      if(school&&r.escola_nome!==school) return false;
      if(modality&&modalidadeFromTurma(r.turma)!==modality) return false;
      if(subject&&r.disciplina!==subject) return false;
      if(turma&&r.turma!==turma) return false;
      if(period&&r.periodo!==period) return false;
      if(q && ![r.escola_nome,r.municipio,r.turma,r.disciplina,modalidadeFromTurma(r.turma)].some(v=>String(v||'').toLocaleLowerCase('pt-BR').includes(q))) return false;
      return true;
    });

    return rows.sort((a,b)=>{
      const ma=aulasRowMetrics(a,ref), mb=aulasRowMetrics(b,ref);
      if(sort==='registro_desc') return mb.rate-ma.rate;
      if(sort==='faltas_desc') return mb.missing-ma.missing || ma.rate-mb.rate;
      if(sort==='aguardando_desc') return mb.awaiting-ma.awaiting || ma.rate-mb.rate;
      if(sort==='escola_asc') return String(a.escola_nome||'').localeCompare(String(b.escola_nome||''),'pt-BR') || String(a.turma||'').localeCompare(String(b.turma||''),'pt-BR');
      if(sort==='disciplina_asc') return String(a.disciplina||'').localeCompare(String(b.disciplina||''),'pt-BR') || String(a.escola_nome||'').localeCompare(String(b.escola_nome||''),'pt-BR');
      return ma.rate-mb.rate;
    });
  }

  function renderAulas(){
    const table=$('#aulasTable'); if(!table) return;
    const importBtn=$('#newAulasReportBtn'); if(importBtn) importBtn.classList.toggle('hidden',!canManageAulas());

    if(!state.aulasModuleReady){
      $('#aulasUpdateBanner').innerHTML='<strong>Módulo temporariamente indisponível.</strong><span>Procure a administração do Portal 8ª GRE.</span>';
      table.innerHTML=''; $('#aulasEmpty')?.classList.remove('hidden'); return;
    }

    const report=currentAulasReport();
    if(report) $('#aulasUpdateBanner').innerHTML=`<strong>Última atualização: ${esc(fmtDate(report.data_referencia))}</strong><span>Importado em ${esc(new Date(report.created_at).toLocaleString('pt-BR'))} • ${esc(report.arquivo_nome)} • ${Number(report.total_registros||0).toLocaleString('pt-BR')} registros</span>`;
    else $('#aulasUpdateBanner').innerHTML='<strong>Nenhum relatório importado.</strong><span>A Coordenação de Gestão e Inspeção pode importar o PDF “Comparativo de Previsão de Aulas com Aulas Ministradas”.</span>';

    syncAulasFilterOptions();
    const rows=filteredAulasRows(), ref=report?.data_referencia;
    const totals=rows.reduce((a,r)=>{
      const m=aulasRowMetrics(r,ref);
      a.total+=m.totalPlanned; a.expected+=m.expected; a.conf+=m.conf; a.awaiting+=m.awaiting; a.missing+=m.missing; a.registered+=m.registered;
      return a;
    },{total:0,expected:0,conf:0,awaiting:0,missing:0,registered:0});

    setText('#aulasKpiTotal',totals.total.toLocaleString('pt-BR'));
    setText('#aulasKpiExpected',totals.expected.toLocaleString('pt-BR'));
    setText('#aulasKpiConfirmed',totals.conf.toLocaleString('pt-BR'));
    setText('#aulasKpiAwaiting',totals.awaiting.toLocaleString('pt-BR'));
    setText('#aulasKpiMissing',totals.missing.toLocaleString('pt-BR'));
    setText('#aulasKpiRate',totals.expected?`${(totals.registered/totals.expected*100).toFixed(1).replace('.',',')}%`:'—');
    setText('#aulasResultCount',`${rows.length.toLocaleString('pt-BR')} registros`);
    $('#aulasEmpty')?.classList.toggle('hidden',rows.length>0);

    table.innerHTML=rows.slice(0,3000).map(r=>{
      const m=aulasRowMetrics(r,ref), [lab,cls]=aulasStatus(m.rate);
      return `<tr>
        <td class="school-cell"><strong>${esc(r.escola_nome||'—')}</strong><small class="muted">${esc(r.municipio||'')}</small></td>
        <td><span class="modality-pill">${esc(modalidadeFromTurma(r.turma))}</span></td>
        <td>${esc(r.turma||'—')}</td>
        <td class="subject-cell">${esc(r.disciplina||'—')}</td>
        <td>${m.totalPlanned}</td><td><strong>${m.expected}</strong></td><td>${m.conf}</td><td>${m.awaiting}</td><td>${m.missing}</td>
        <td><strong>${m.rate.toFixed(1).replace('.',',')}%</strong></td><td><span class="aulas-status ${cls}">${lab}</span></td>
      </tr>`;
    }).join('');

    renderAulasRanking(rows,ref); renderAulasHistory();
  }

  function renderAulasRanking(rows,ref){
    const el=$('#aulasRanking'); if(!el) return;
    const map={};
    rows.forEach(r=>{
      const k=r.escola_nome||'Escola', m=aulasRowMetrics(r,ref);
      if(!map[k])map[k]={e:k,expected:0,registered:0};
      map[k].expected+=m.expected; map[k].registered+=m.registered;
    });
    const dir=$('#aulasRankingOrder')?.value||'asc';
    const list=Object.values(map).map(x=>({...x,rate:x.expected?x.registered/x.expected*100:0})).sort((a,b)=>dir==='desc'?b.rate-a.rate:a.rate-b.rate).slice(0,12);
    el.innerHTML=list.length?list.map(x=>`<div class="ranking-row"><strong>${esc(x.e)}</strong><div class="ranking-bar"><i style="width:${Math.max(2,Math.min(100,x.rate))}%"></i></div><span>${x.rate.toFixed(1).replace('.',',')}%</span></div>`).join(''):'<div class="empty-block">Sem dados para classificar.</div>';
  }

  function renderAulasHistory(){
    const el=$('#aulasHistory'); if(!el) return;
    el.innerHTML=state.classReports.length?state.classReports.slice(0,8).map(r=>`<div class="history-row ${r.id===state.activeClassReportId?'active':''}"><div><strong>Dados até ${esc(fmtDate(r.data_referencia))}</strong><small>${esc(r.arquivo_nome)} • ${Number(r.total_registros||0).toLocaleString('pt-BR')} registros</small></div><div class="history-actions"><button class="btn secondary small" type="button" data-view-aulas-report="${esc(r.id)}">Ver</button><button class="pdf-link" type="button" data-open-aulas-pdf="${esc(r.id)}">PDF</button></div></div>`).join(''):'<div class="empty-block">Nenhuma atualização registrada.</div>';
  }

  function openAulasImportForm(){
    if(!canManageAulas()){ toast('Somente Gerência/Coordenação podem importar o relatório.'); return; }
    openModal('Importar relatório do iSEDUC','Gestão e Inspeção • Acompanhamento de Aulas',`<form id="aulasImportForm" class="form-grid" onsubmit="return false;"><label class="full">PDF — Comparativo de Previsão de Aulas com Aulas Ministradas<input id="aulasPdfFile" type="file" accept="application/pdf,.pdf" required></label><label>Data de referência dos dados<input id="aulasReferenceDate" type="date" value="${new Date().toISOString().slice(0,10)}" required></label><label>Observação<input id="aulasObservation" placeholder="Ex.: Relatório semanal de Gestão e Inspeção"></label><div class="full"><div class="calendar-pill">Calendário: 19/02–11/07 • retorno 30/07 • término 22/12</div></div><div id="aulasParseStatus" class="full hint">O leitor percorre todas as páginas e confere quantos registros foram detectados e reconhecidos. A importação é bloqueada se houver perda relevante de linhas.</div><div class="modal-actions full"><button type="button" data-close class="btn secondary">Cancelar</button><button id="analyzeAulasPdfBtn" type="button" class="btn aulas-btn">Analisar PDF completo</button></div></form>`);
  }

  function groupPdfLines(items){
    const groups=[];
    const sorted=[...items].filter(i=>normalizeAulasText(i.str)).sort((a,b)=>b.transform[5]-a.transform[5] || a.transform[4]-b.transform[4]);
    for(const item of sorted){
      const y=item.transform[5];
      let g=groups.find(x=>Math.abs(x.y-y)<3.2);
      if(!g){g={y,items:[]};groups.push(g)}
      g.items.push(item);
    }
    return groups.sort((a,b)=>b.y-a.y).map(g=>({y:g.y,items:g.items.sort((a,b)=>a.transform[4]-b.transform[4])}));
  }

  function numericCellValue(parts){
    const m=normalizeAulasText((parts||[]).join(' ')).match(/-?\d+(?:[.,]\d+)?/);
    if(!m)return null;
    const n=Number(m[0].replace(',','.'));
    return Number.isFinite(n)?n:null;
  }

  function cleanPdfCell(parts){ return normalizeAulasText((parts||[]).join(' ')).replace(/\b\d{6}\b/g,' ').replace(/\s+/g,' ').trim(); }
  function appendPdfCols(target,source){ for(let i=0;i<8;i++) if(source[i]?.length) target[i].push(...source[i]); }

  async function parseAulasPdf(file,onProgress){
    if(!window.pdfjsLib) throw new Error('Leitor de PDF não carregado. Atualize a página e tente novamente.');
    window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    const pdf=await window.pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise;
    const rows=[], warnings=[], schools=new Set();
    let periodo='',municipio='',escolaInep='',escolaNome='',detectedRecords=0;

    for(let p=1;p<=pdf.numPages;p++){
      const page=await pdf.getPage(p), vp=page.getViewport({scale:1}), tc=await page.getTextContent(), lines=groupPdfLines(tc.items), w=vp.width;
      detectedRecords += tc.items.reduce((n,it)=>n+((normalizeAulasText(it.str).match(/\b\d{6}\b/g)||[]).length),0);

      let pending=Array.from({length:8},()=>[]), pendingLines=0;
      const reset=()=>{pending=Array.from({length:8},()=>[]);pendingLines=0};

      const finish=()=>{
        const all=normalizeAulasText(pending.flat().join(' '));
        const id=(normalizeAulasText(pending[0].join(' ')).match(/\b\d{6}\b/)||all.match(/\b\d{6}\b/))?.[0]||'';
        const turma=cleanPdfCell(pending[1]), disc=cleanPdfCell(pending[2]);
        const nums=[3,4,5,6,7].map(i=>numericCellValue(pending[i]));
        if(!id||!turma||!disc||nums.some(v=>v===null)) return false;
        if(!periodo||!escolaNome){warnings.push(`Página ${p}: registro ${id} sem contexto de escola/período.`);reset();return true}
        rows.push({periodo,municipio,escola_inep:escolaInep,escola_nome:escolaNome,id_turma:id,turma,disciplina:disc,carga_horaria_total:nums[0],carga_horaria_confirmada:nums[1],aulas_confirmadas:Math.round(nums[2]),aguardando_confirmacao_h:nums[3],aulas_aguardando_confirmacao:Math.round(nums[4])});
        reset(); return true;
      };

      for(const line of lines){
        const full=normalizeAulasText(line.items.map(i=>normalizeAulasText(i.str)).filter(Boolean).join(' '));
        if(!full)continue;
        let m=full.match(/ANO LETIVO:\s*(\d{4}\/\d)/i); if(m){periodo=m[1];reset();continue}
        m=full.match(/MUNICIPIO:\s*(.+)$/i); if(m){municipio=normalizeAulasText(m[1]);reset();continue}
        m=full.match(/ESCOLA:\s*(\d{8})\s*-\s*(.+)$/i); if(m){escolaInep=m[1];escolaNome=normalizeAulasText(m[2]);schools.add(escolaInep);reset();continue}
        if(/COMPARATIVO DE PREVISÃO|SECRETARIA ESTADUAL|SUPERINTENDÊNCIA|GOVERNO DO ESTADO|DISCIPLINA|CARGA\s+HORÁRIA|IDTURMA|AULAS\s+CONFIRMADAS|AGUARDANDO\s+CONFIRMAÇÃO|DESENVOLVIDO PELA|PÁGINA\s+\d+\s+A\s+\d+|^\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}/i.test(full))continue;

        const cols=[[],[],[],[],[],[],[],[]];
        for(const it of line.items){
          const s=normalizeAulasText(it.str); if(!s)continue;
          const x=(it.transform[4]+(it.width||0)/2)/w;
          const c=x<.105?0:x<.315?1:x<.585?2:x<.68?3:x<.785?4:x<.875?5:x<.955?6:7;
          cols[c].push(s);
        }
        if(!cols.some(x=>x.length))continue;

        appendPdfCols(pending,cols); pendingLines++;
        if(finish())continue;

        const ids=(normalizeAulasText(pending.flat().join(' ')).match(/\b\d{6}\b/g)||[]);
        if(ids.length>1||pendingLines>8){
          warnings.push(`Página ${p}: bloco multilinha não reconhecido integralmente (${ids[0]||'sem ID'}).`);
          reset();
        }
      }

      if(pending.flat().some(Boolean)){
        const ids=(normalizeAulasText(pending.flat().join(' ')).match(/\b\d{6}\b/g)||[]);
        if(ids.length)warnings.push(`Página ${p}: registro ${ids[0]} ficou incompleto ao final da página.`);
      }

      onProgress?.(p,pdf.numPages,rows.length,detectedRecords);
    }

    const recognitionRate=detectedRecords?rows.length/detectedRecords*100:0;
    return {rows,pages:pdf.numPages,schools:schools.size,warnings,detectedRecords,recognitionRate};
  }

  async function analyzeAulasPdf(){
    const file=$('#aulasPdfFile')?.files?.[0], ref=$('#aulasReferenceDate')?.value, obs=$('#aulasObservation')?.value||''; if(!file){toast('Selecione o PDF.');return} if(!ref){toast('Informe a data de referência.');return}
    const btn=$('#analyzeAulasPdfBtn'), status=$('#aulasParseStatus'); if(btn){btn.disabled=true;btn.textContent='Lendo PDF...'};
    try{
      const parsed=await parseAulasPdf(file,(p,total,recognized,detected)=>{ if(status)status.innerHTML=`Lendo página <strong>${p}</strong> de <strong>${total}</strong> • reconhecidos: <strong>${recognized.toLocaleString('pt-BR')}</strong> • IDs detectados: <strong>${detected.toLocaleString('pt-BR')}</strong>`; });
      if(parsed.rows.length<1) throw new Error('Nenhuma linha do relatório foi reconhecida. Confirme se este é o PDF “Comparativo de Previsão de Aulas com Aulas Ministradas”.');
      const schoolMap=new Map(state.schools.map(s=>[String(s.inep||'').replace(/\D/g,''),s.id])); parsed.rows=parsed.rows.map(r=>({...r,escola_id:schoolMap.get(String(r.escola_inep||'').replace(/\D/g,''))||null}));
      pendingAulasImport={file,meta:{data_referencia:ref,total_paginas:parsed.pages,total_escolas:parsed.schools,observacao:obs},rows:parsed.rows,warnings:parsed.warnings,detectedRecords:parsed.detectedRecords,recognitionRate:parsed.recognitionRate};
      showAulasImportPreview();
    }catch(err){console.error(err);toast(err.message||'Erro ao analisar PDF.'); if(status)status.textContent=err.message||'Erro ao analisar PDF.';}
    finally{if(btn){btn.disabled=false;btn.textContent='Analisar PDF'}}
  }
  function showAulasImportPreview(){
    const p=pendingAulasImport;if(!p)return;
    const sample=p.rows.slice(0,12), detected=Number(p.detectedRecords||0), recognized=p.rows.length, rate=Number(p.recognitionRate||0);
    const canSave=detected>0 && rate>=99.5;
    openModal('Prévia da importação','Gestão e Inspeção • iSEDUC',`
      <div class="import-preview-stats import-preview-stats-5">
        <div><small>Páginas lidas</small><strong>${p.meta.total_paginas}</strong></div>
        <div><small>Registros detectados</small><strong>${detected.toLocaleString('pt-BR')}</strong></div>
        <div><small>Reconhecidos</small><strong>${recognized.toLocaleString('pt-BR')}</strong></div>
        <div><small>Leitura</small><strong>${rate.toFixed(1).replace('.',',')}%</strong></div>
        <div><small>Escolas</small><strong>${p.meta.total_escolas}</strong></div>
      </div>
      ${canSave?`<div class="import-success"><strong>Leitura validada.</strong> O relatório pode ser salvo.</div>`:`<div class="import-warnings critical-import"><strong>Importação bloqueada:</strong> o PDF possui ${detected.toLocaleString('pt-BR')} registros detectados e ${recognized.toLocaleString('pt-BR')} reconhecidos (${rate.toFixed(1).replace('.',',')}%). Nenhum dado será salvo para evitar painel incompleto.</div>`}
      <div class="import-preview-table"><table><thead><tr><th>Escola</th><th>Modalidade</th><th>Período</th><th>Turma</th><th>Disciplina</th><th>CH total</th><th>Confirmadas</th><th>Aguardando</th></tr></thead><tbody>${sample.map(r=>`<tr><td>${esc(r.escola_nome)}</td><td>${esc(modalidadeFromTurma(r.turma))}</td><td>${esc(r.periodo)}</td><td>${esc(r.turma)}</td><td>${esc(r.disciplina)}</td><td>${r.carga_horaria_total}</td><td>${r.aulas_confirmadas}</td><td>${r.aulas_aguardando_confirmacao}</td></tr>`).join('')}</tbody></table></div>
      <p class="hint">Arquivo: ${esc(p.file.name)}. O PDF original ficará disponível no histórico do Portal.</p>
      <div class="modal-actions"><button type="button" data-close class="btn secondary">Cancelar</button><button type="button" id="confirmAulasImportBtn" class="btn aulas-btn" ${canSave?'':'disabled'}>Confirmar e salvar</button></div>
    `);
  }
  async function confirmAulasImport(){
    if(!pendingAulasImport)return; const btn=$('#confirmAulasImportBtn'); if(btn){btn.disabled=true;btn.textContent='Salvando...'}
    try{ const rep=await store.saveClassImport(pendingAulasImport.file,pendingAulasImport.meta,pendingAulasImport.rows); state.activeClassReportId=rep.id; pendingAulasImport=null; closeModal(); await loadData(); navigate('aulas'); toast('Relatório importado e salvo no histórico.'); }
    catch(err){console.error(err);toast(err.message||'Erro ao salvar relatório.'); if(btn){btn.disabled=false;btn.textContent='Confirmar e salvar'}}
  }
  function renderSchools(){
    const table=$('#schoolTable'), empty=$('#schoolsEmpty'); if(!table||!empty) return;
    const q = ($('#schoolSearch')?.value || '').toLowerCase();
    const rows = state.schools.filter(s => !q || [s.nome,s.municipio,s.inep,s.gestor].some(v=>String(v||'').toLowerCase().includes(q)));
    empty.classList.toggle('hidden', rows.length>0);
    table.innerHTML = rows.map(s=>`<tr><td><strong>${esc(s.nome)}</strong></td><td>${esc(s.inep||'—')}</td><td>${esc(s.municipio||'—')}</td><td>${esc(s.gestor||'—')}</td><td>${esc(s.telefone||s.email||'—')}</td><td><span class="status realizado">${s.ativo===false?'Inativa':'Ativa'}</span></td></tr>`).join('');
  }

  function transportVehicleClass(vehicle){ return vehicle==='S10'?'s10':vehicle==='Logan'?'logan':'polo'; }
  function statusClass(status='Solicitado'){ return String(status).toLowerCase().replaceAll(' ','').replaceAll('í','i').replaceAll('á','a'); }
  function renderTransportCalendar(){
    const grid=$('#transportCalendar'), label=$('#transportMonthLabel'); if(!grid||!label) return;
    const y=transportCalendarDate.getFullYear(), m=transportCalendarDate.getMonth();
    label.textContent=`${transportMonthNames[m]} de ${y}`;
    const first=new Date(y,m,1).getDay(), days=new Date(y,m+1,0).getDate(), prevDays=new Date(y,m,0).getDate();
    const today=new Date(), todayKey=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    const cells=[];
    for(let i=first-1;i>=0;i--) cells.push(`<div class="calendar-day muted"><span class="calendar-day-num">${prevDays-i}</span></div>`);
    for(let d=1;d<=days;d++){
      const key=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const events=state.transport.filter(x=>String(x.data).slice(0,10)===key && x.status!=='Cancelado').sort((a,b)=>String(a.hora_saida||'').localeCompare(String(b.hora_saida||'')));
      const sharingIds=new Set(findSharingCandidatesForDate(key).flatMap(g=>g.items.map(i=>i.id)));
      const shown=events.slice(0,3).map(x=>`<div class="calendar-event ${transportVehicleClass(x.veiculo)} ${sharingIds.has(x.id)?'sharing':''}" title="${esc(x.veiculo)} • ${esc(x.destino||x.escola_nome||'')}">${sharingIds.has(x.id)?'⚠ ':''}${esc(x.veiculo)} • ${esc(x.destino||x.escola_nome||'Destino')}</div>`).join('');
      const more=events.length>3?`<div class="calendar-more">+${events.length-3} agendamento(s)</div>`:'';
      cells.push(`<button type="button" class="calendar-day ${key===todayKey?'today':''}" data-calendar-date="${key}"><span class="calendar-day-num">${d}</span><div class="calendar-events">${shown}${more}</div></button>`);
    }
    const total=first+days, remain=(7-(total%7))%7;
    for(let d=1;d<=remain;d++) cells.push(`<div class="calendar-day muted"><span class="calendar-day-num">${d}</span></div>`);
    grid.innerHTML=cells.join('');
  }

  function transportActionButtons(item){
    if(!canManageTransport()) return '';
    const out=[
      `<button class="btn secondary small" type="button" data-edit-transport="${esc(item.id)}">Editar</button>`,
      `<button class="btn danger-outline small" type="button" data-delete-transport="${esc(item.id)}">Excluir</button>`
    ];
    if(item.status==='Solicitado') out.push(`<button class="btn transport small" type="button" data-set-transport-status="${esc(item.id)}" data-status="Confirmado">Confirmar</button>`);
    if(item.status==='Confirmado') out.push(`<button class="btn primary small" type="button" data-set-transport-status="${esc(item.id)}" data-status="Realizado">Marcar realizado</button>`);
    if(!['Cancelado','Realizado'].includes(item.status)) out.push(`<button class="btn danger-outline small" type="button" data-set-transport-status="${esc(item.id)}" data-status="Cancelado">Cancelar</button>`);
    return `<div class="booking-actions">${out.join('')}</div>`;
  }

  function transportDetailsHtml(item){
    return `<article class="day-booking"><div class="day-booking-head"><div><p class="eyebrow">${esc(item.status||'Solicitado')}</p><h3>${esc(item.finalidade||'Deslocamento')}</h3></div><span class="vehicle-chip ${transportVehicleClass(item.veiculo)}">${esc(item.veiculo||'—')}</span></div><div class="booking-detail-grid"><div class="booking-detail"><small>Escola / destino</small><strong>${esc(item.escola_nome||item.destino||'—')}</strong></div><div class="booking-detail"><small>Município / destino</small><strong>${esc(item.destino||'—')}</strong></div><div class="booking-detail"><small>Responsável</small><strong>${esc(item.responsavel||'—')}</strong></div><div class="booking-detail"><small>Quem irá</small><strong>${esc(item.participantes||'—')}</strong></div><div class="booking-detail"><small>Saída da 8ª GRE</small><strong>${esc(item.hora_saida||'—')}</strong></div><div class="booking-detail"><small>Previsão de retorno</small><strong>${esc(item.previsao_retorno||'—')}</strong></div></div><div class="booking-purpose"><strong>Finalidade:</strong> ${esc(item.finalidade||'—')}</div>${transportActionButtons(item)}</article>`;
  }

  function normTransportText(v=''){
    return String(v||'').trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  }

  function sameSchoolOrCity(a,b){
    const sameSchool = a.escola_id && b.escola_id && a.escola_id===b.escola_id;
    const cityA=normTransportText(a.destino), cityB=normTransportText(b.destino);
    const sameCity = cityA && cityB && cityA===cityB;
    return sameSchool || sameCity;
  }

  function findSharingCandidates(item, ignoreId=null){
    const date=String(item.data||'').slice(0,10);
    if(!date) return [];
    return state.transport
      .filter(x=>x.id!==ignoreId && x.status!=='Cancelado' && String(x.data||'').slice(0,10)===date && sameSchoolOrCity(item,x))
      .sort((a,b)=>String(a.hora_saida||'').localeCompare(String(b.hora_saida||'')));
  }

  function findSharingCandidatesForDate(key){
    const day=state.transport.filter(x=>x.status!=='Cancelado' && String(x.data||'').slice(0,10)===key);
    const groups=[];
    const seen=new Set();
    for(const item of day){
      if(seen.has(item.id)) continue;
      const related=day.filter(x=>x.id!==item.id && sameSchoolOrCity(item,x));
      if(related.length){
        const items=[item,...related].filter((x,i,arr)=>arr.findIndex(y=>y.id===x.id)===i);
        items.forEach(x=>seen.add(x.id));
        groups.push({items});
      }
    }
    return groups;
  }

  function sharingAlertHtml(item, ignoreId=null){
    const matches=findSharingCandidates(item,ignoreId);
    if(!matches.length) return '';
    return `<div class="transport-sharing-alert"><strong>⚠ Possibilidade de compartilhar o transporte</strong><p>Já existe ${matches.length===1?'uma viagem':'viagens'} para a mesma escola ou município nesta data. Verifique se as equipes podem utilizar o mesmo veículo e/ou horário.</p><div class="sharing-list">${matches.map(x=>`<div><strong>${esc(x.hora_saida||'—')} • ${esc(x.veiculo||'—')}</strong><span>${esc(x.escola_nome||x.destino||'Destino')} • retorno ${esc(x.previsao_retorno||'—')}</span></div>`).join('')}</div></div>`;
  }

  function openTransportDay(key){
    const list=state.transport.filter(x=>String(x.data).slice(0,10)===key).sort((a,b)=>String(a.hora_saida||'').localeCompare(String(b.hora_saida||'')));
    const [y,m,d]=key.split('-').map(Number);
    const title=`${String(d).padStart(2,'0')} de ${transportMonthNames[m-1]} de ${y}`;
    const addButton=canManageTransport()?`<div class="day-add-transport"><button type="button" class="btn transport" data-new-transport-date="${key}">+ Novo agendamento nesta data</button></div>`:'';
    const groups=findSharingCandidatesForDate(key);
    const alert=groups.length?`<div class="transport-sharing-alert day-alert"><strong>⚠ Atenção: há deslocamentos para a mesma escola ou município</strong><p>Conversem com as equipes para verificar a possibilidade de compartilharem veículo e/ou horário.</p></div>`:'';
    if(!list.length){
      openModal(title,'Agenda do dia',`<div class="calendar-empty-day">Nenhum transporte agendado para esta data.${addButton}</div>`);
      return;
    }
    openModal(title,'Agenda do dia',`${alert}<div class="day-bookings">${list.map(transportDetailsHtml).join('')}</div>${addButton}`);
  }

  function timeToMinutes(v){ if(!v) return null; const [h,m]=String(v).slice(0,5).split(':').map(Number); return h*60+m; }
  function hasTransportConflict(item, ignoreId=null){
    const start=timeToMinutes(item.hora_saida), end=timeToMinutes(item.previsao_retorno); if(start===null||end===null) return false;
    return state.transport.some(x=>x.id!==ignoreId && String(x.data).slice(0,10)===item.data && x.veiculo===item.veiculo && x.status!=='Cancelado' && (()=>{ const a=timeToMinutes(x.hora_saida), b=timeToMinutes(x.previsao_retorno); return a!==null&&b!==null&&start<b&&end>a; })());
  }

  function renderTransport(){
    const table=$('#transportTable'), empty=$('#transportEmpty'); if(!table||!empty) return;
    const q = ($('#transportSearch')?.value || '').toLowerCase(); const st = $('#transportStatusFilter')?.value || '';
    const rows = [...state.transport].filter(x=>(!st||x.status===st)&&(!q||[x.destino,x.escola_nome,x.responsavel,x.finalidade,x.veiculo].some(v=>String(v||'').toLowerCase().includes(q)))).sort((a,b)=>`${b.data||''}${b.hora_saida||''}`.localeCompare(`${a.data||''}${a.hora_saida||''}`));
    empty.classList.toggle('hidden', rows.length>0);
    table.innerHTML = rows.map(x=>`<tr><td>${esc(fmtDate(x.data))}</td><td><strong>${esc(x.veiculo||'—')}</strong></td><td>${esc(x.destino||x.escola_nome||'—')}</td><td>${esc(x.responsavel||'—')}</td><td>${esc(x.hora_saida||'—')} ${x.previsao_retorno?`→ ${esc(x.previsao_retorno)}`:''}</td><td><span class="status ${statusClass(x.status)}">${esc(x.status||'Solicitado')}</span></td><td><button class="action-btn" data-view-transport="${esc(x.id)}" title="Ver detalhes">•••</button></td></tr>`).join('');
    ['S10','Logan','Polo'].forEach(v=>{ const id = v==='S10'?'countS10':v==='Logan'?'countLogan':'countPolo'; setText('#'+id, state.transport.filter(x=>x.veiculo===v && x.status!=='Cancelado').length); });
    renderTransportCalendar();
  }

  function renderVisits(){
    const listEl=$('#visitsList'), empty=$('#visitsEmpty'); if(!listEl||!empty) return;
    const q = ($('#visitSearch')?.value||'').toLowerCase();
    const rows = state.visits.filter(x=>!q||[x.escola_nome,schoolName(x.escola_id),x.tecnico,x.municipio,x.objetivo,x.encaminhamentos].some(v=>String(v||'').toLowerCase().includes(q)));
    empty.classList.toggle('hidden',rows.length>0);
    listEl.innerHTML = rows.map(x=>`<article class="visit-card"><div class="visit-date"><small>Data</small><strong>${esc(fmtDate(x.data))}</strong><span>${esc(x.horario||'')}</span></div><div><h4>${esc(x.escola_nome||schoolName(x.escola_id))}</h4><p><strong>Técnico:</strong> ${esc(x.tecnico||'—')}</p><p><strong>Objetivo:</strong> ${esc(x.objetivo||'—')}</p>${x.encaminhamentos?`<p><strong>Encaminhamentos:</strong> ${esc(x.encaminhamentos)}</p>`:''}</div><span class="pill">${esc(x.status||'Registrada')}</span></article>`).join('');
  }

  function renderManagement(){
    const cards=$('#managementCards'), empty=$('#managementEmpty'); if(!cards||!empty) return;
    const rows = state.management;
    empty.classList.toggle('hidden', rows.length>0);
    cards.innerHTML = rows.map(x=>`<article class="management-card"><div class="management-meta"><div><p class="eyebrow">${esc(x.periodo||'Acompanhamento')}</p><h3>${esc(x.escola_nome||schoolName(x.escola_id))}</h3></div><span class="status ${['Concluída','Concluido','Concluído'].includes(x.status)?'realizado':'solicitado'}">${esc(x.status||'Em acompanhamento')}</span></div><div class="metrics"><div class="metric"><small>Aulas dadas</small><strong>${esc(x.aulas_dadas||'0')} / ${esc(x.aulas_previstas||'0')}</strong></div><div class="metric"><small>Frequência</small><strong>${esc(x.frequencia||'0')}%</strong></div><div class="metric"><small>Média de notas</small><strong>${esc(x.media_notas||'0')}</strong></div></div><div class="intervention"><strong>Intervenção:</strong> ${esc(x.intervencao||'Não informada')}<br><span class="muted">Responsável: ${esc(x.responsavel||'—')}</span></div></article>`).join('');
  }

  function renderUsers(){
    const table=$('#usersTable'), empty=$('#usersEmpty'); if(!table||!empty) return;
    if(!isExecutive()) { table.innerHTML=''; empty.classList.remove('hidden'); return; }
    const q=($('#userSearch')?.value||'').toLowerCase();
    const rows=state.profiles.filter(p=>!q||[p.nome,p.email,roleLabels[p.role],sectorName(p.setor_id),schoolName(p.escola_id)].some(v=>String(v||'').toLowerCase().includes(q)));
    empty.classList.toggle('hidden',rows.length>0);
    table.innerHTML=rows.map(p=>`<tr><td><strong>${esc(p.nome||'Sem nome')}</strong><br><small class="muted">${esc(p.email||'')}</small></td><td>${esc(roleLabels[p.role]||p.role)}</td><td>${esc(sectorName(p.setor_id))}</td><td>${esc(p.escola_id?schoolName(p.escola_id):'—')}</td><td><span class="status ${p.ativo===false?'cancelado':'realizado'}">${p.ativo===false?'Inativo':'Ativo'}</span></td><td><button class="action-btn" data-edit-profile="${esc(p.id)}" title="Editar permissões">Editar</button></td></tr>`).join('');
  }

  function openModal(title, eyebrow, html){ setText('#modalTitle',title); setText('#modalEyebrow',eyebrow); const body=$('#modalBody'); if(body) body.innerHTML=html; $('#modal')?.showModal(); }
  function closeModal(){ const modal=$('#modal'); if(modal?.open) modal.close(); }

  function openSchoolForm(){
    if(!isManager()){ toast('Seu perfil não possui permissão para cadastrar escolas.'); return; }
    openModal('Nova escola','Cadastro central',`<form id="schoolForm" class="form-grid"><label class="full">Nome da escola<input name="nome" required></label><label>Código INEP<input name="inep"></label><label>Município<input name="municipio" required></label><label>Gestor(a)<input name="gestor"></label><label>Telefone<input name="telefone"></label><label class="full">E-mail<input name="email" type="email"></label><div class="modal-actions full"><button type="button" data-close class="btn secondary">Cancelar</button><button class="btn schools">Salvar escola</button></div></form>`);
  }

  function openTransportForm(item=null){
    if(!canManageTransport()){ toast('O agendamento de transporte é exclusivo da Gerência. Seu perfil possui somente visualização.'); return; }
    const editing=!!item;
    const statusSelect = editing ? `<label>Status<select name="status"><option ${item.status==='Solicitado'?'selected':''}>Solicitado</option><option ${item.status==='Confirmado'?'selected':''}>Confirmado</option><option ${item.status==='Realizado'?'selected':''}>Realizado</option><option ${item.status==='Cancelado'?'selected':''}>Cancelado</option></select></label>` : `<input type="hidden" name="status" value="Confirmado">`;
    openModal(editing?'Editar agendamento':'Novo agendamento','Gerência • Transporte',`<form id="transportForm" class="form-grid" onsubmit="return false;"><input type="hidden" name="id" value="${esc(item?.id||'')}"><label>Data<input name="data" type="date" value="${esc(String(item?.data||'').slice(0,10))}" required></label><label>Veículo<select name="veiculo" required><option ${item?.veiculo==='S10'?'selected':''}>S10</option><option ${item?.veiculo==='Logan'?'selected':''}>Logan</option><option ${item?.veiculo==='Polo'?'selected':''}>Polo</option></select></label><label class="full">Escola vinculada (opcional)<select name="escola_id">${schoolOptions(item?.escola_id||'')}</select></label><label>Município / destino<input name="destino" value="${esc(item?.destino||'')}" required></label><label>Responsável<input name="responsavel" value="${esc(item?.responsavel||state.user?.name||'')}" required></label><label>Horário de saída<input name="hora_saida" type="time" value="${esc(String(item?.hora_saida||'').slice(0,5))}" required></label><label>Previsão de retorno<input name="previsao_retorno" type="time" value="${esc(String(item?.previsao_retorno||'').slice(0,5))}" required></label><label class="full">Participantes<input name="participantes" value="${esc(item?.participantes||'')}" placeholder="Nomes separados por vírgula"></label><label class="full">Finalidade<textarea name="finalidade" required>${esc(item?.finalidade||'')}</textarea></label>${statusSelect}<div id="transportSharingAlert" class="full"></div><div class="modal-actions full"><button type="button" data-close class="btn secondary">Cancelar</button><button type="button" class="btn transport" data-save-transport>${editing?'Salvar alterações':'Salvar agendamento'}</button></div></form>`);
    setTimeout(()=>refreshTransportSharingAlert(),0);
  }

  function refreshTransportSharingAlert(){
    const form=$('#transportForm'); if(!form) return;
    const d=formData(form);
    const school=state.schools.find(s=>s.id===d.escola_id);
    const item={...d,escola_id:d.escola_id||null,escola_nome:school?.nome||null};
    const target=$('#transportSharingAlert');
    if(target) target.innerHTML=sharingAlertHtml(item,d.id||null);
  }

  function openTransportItem(item){
    openModal(`Agendamento • ${fmtDate(item.data)}`,'Transporte',`<div class="day-bookings">${transportDetailsHtml(item)}</div>`);
  }

  function openVisitForm(){
    if(!canWriteOperational()){ toast('Seu perfil possui acesso somente para visualização.'); return; }
    openModal('Nova visita técnica','Ensino e Aprendizagem',`<form id="visitForm" class="form-grid"><label>Data<input name="data" type="date" required></label><label>Horário<input name="horario" type="time"></label><label class="full">Escola<select name="escola_id" required>${schoolOptions()}</select></label><label>Técnico responsável<input name="tecnico" value="${esc(state.user?.name||'')}" required></label><label>Município<input name="municipio"></label><label class="full">Objetivo da visita<textarea name="objetivo" required></textarea></label><label class="full">Observações<textarea name="observacoes"></textarea></label><label class="full">Encaminhamentos<textarea name="encaminhamentos"></textarea></label><input type="hidden" name="status" value="Registrada"><div class="modal-actions full"><button type="button" data-close class="btn secondary">Cancelar</button><button class="btn visits">Salvar visita</button></div></form>`);
  }

  function openManagementForm(){
    if(!canWriteOperational()){ toast('Seu perfil possui acesso somente para visualização.'); return; }
    openModal('Novo acompanhamento','Gestão e Inspeção',`<form id="managementForm" class="form-grid"><label class="full">Escola<select name="escola_id" required>${schoolOptions()}</select></label><label>Período<input name="periodo" placeholder="Ex.: Agosto/2026" required></label><label>Status<select name="status"><option>Em acompanhamento</option><option>Intervenção necessária</option><option>Concluída</option></select></label><label>Aulas previstas<input name="aulas_previstas" type="number" min="0" value="0"></label><label>Aulas dadas<input name="aulas_dadas" type="number" min="0" value="0"></label><label>Frequência (%)<input name="frequencia" type="number" min="0" max="100" step="0.01" value="0"></label><label>Média de notas<input name="media_notas" type="number" min="0" step="0.01" value="0"></label><label class="full">Intervenção / encaminhamento<textarea name="intervencao"></textarea></label><label class="full">Responsável<input name="responsavel" value="${esc(state.user?.name||'')}"></label><div class="modal-actions full"><button type="button" data-close class="btn secondary">Cancelar</button><button class="btn management">Salvar acompanhamento</button></div></form>`);
  }

  function openProfileForm(profile){
    if(!isExecutive()) return;
    const self=profile.id===state.user?.id;
    openModal('Editar usuário','Usuários e permissões',`<form id="profileForm" class="form-grid" onsubmit="return false;"><input type="hidden" name="id" value="${esc(profile.id)}"><label class="full">Nome<input name="nome" value="${esc(profile.nome||'')}" required></label><label class="full">E-mail<input value="${esc(profile.email||'')}" disabled></label><label>Perfil${self?`<input type="hidden" name="role" value="${esc(profile.role)}">`:''}<select name="role" ${self?'disabled':''}><option value="admin" ${profile.role==='admin'?'selected':''}>Administrador</option><option value="gerencia" ${profile.role==='gerencia'?'selected':''}>Gerência Regional</option><option value="coordenacao" ${profile.role==='coordenacao'?'selected':''}>Coordenação</option><option value="tecnico" ${profile.role==='tecnico'?'selected':''}>Técnico da GRE</option><option value="visualizacao" ${profile.role==='visualizacao'?'selected':''}>Visualização</option><option value="escola" ${profile.role==='escola'?'selected':''}>Escola</option></select></label><label>Setor<select name="setor_id">${sectorOptions(profile.setor_id||'')}</select></label><label class="full">Escola vinculada<select name="escola_id">${schoolOptions(profile.escola_id||'')}</select></label><label class="toggle-field full"><input type="checkbox" name="ativo" value="true" ${profile.ativo!==false?'checked':''}> <span>Usuário ativo</span></label>${self?'<p class="hint full">Para evitar bloquear seu próprio acesso por engano, o sistema não permite desativar a conta atualmente conectada.</p>':''}<div class="modal-actions full"><button type="button" data-close class="btn secondary">Cancelar</button><button type="button" class="btn primary" data-save-profile>Salvar</button></div></form>`);
  }

  async function updateTransportStatus(id,status){
    const item=state.transport.find(x=>x.id===id); if(!item) return;
    if(!canChangeTransportStatus(item)){ toast('Somente a Gerência pode alterar o agendamento de transporte.'); return; }
    try{ await store.update('transport',id,{status}); closeModal(); await loadData(); toast(`Agendamento atualizado para ${status}.`); }catch(err){ console.error(err); toast(err.message||'Erro ao atualizar agendamento.'); }
  }

  function confirmDeleteTransport(item){
    if(!canManageTransport()){ toast('Somente a Gerência pode excluir agendamentos.'); return; }
    openModal('Excluir agendamento?','Gerência • Transporte',`<div class="delete-confirm"><p>Você está prestes a excluir o agendamento de <strong>${esc(fmtDate(item.data))}</strong>, veículo <strong>${esc(item.veiculo||'—')}</strong>, destino <strong>${esc(item.escola_nome||item.destino||'—')}</strong>.</p><p class="hint">A exclusão será registrada no histórico de auditoria.</p><div class="modal-actions"><button type="button" data-close class="btn secondary">Voltar</button><button type="button" class="btn danger" data-confirm-delete-transport="${esc(item.id)}">Excluir agendamento</button></div></div>`);
  }

  async function deleteTransportItem(id){
    const item=state.transport.find(x=>x.id===id); if(!item) return;
    if(!canManageTransport()){ toast('Somente a Gerência pode excluir agendamentos.'); return; }
    const date=String(item.data||'').slice(0,10);
    try{
      await store.remove('transport',id);
      closeModal();
      await loadData();
      toast('Agendamento excluído. Você pode criar um novo agendamento para a mesma data.');
      openTransportDay(date);
    }catch(err){
      console.error(err);
      toast(err.message||'Erro ao excluir agendamento.');
    }
  }


  async function saveTransportForm(){
    const form = $('#transportForm');
    if(!form) return;

    if(!canManageTransport()){
      toast('Somente a Gerência pode criar ou alterar agendamentos.');
      return;
    }

    // Usa a validação HTML sem disparar submit nativo.
    if(!form.reportValidity()) return;

    try{
      const d=formData(form);
      const id=d.id||null;
      delete d.id;

      if(timeToMinutes(d.previsao_retorno)<=timeToMinutes(d.hora_saida)){
        toast('A previsão de retorno deve ser posterior ao horário de saída.');
        return;
      }

      if(hasTransportConflict(d,id)){
        toast(`Conflito: ${d.veiculo} já possui agendamento nesse intervalo.`);
        return;
      }

      const school=state.schools.find(s=>s.id===d.escola_id);
      const payload={
        ...d,
        escola_id:d.escola_id||null,
        escola_nome:school?.nome||null
      };

      const sharing=findSharingCandidates(payload,id);
      let savedRecordId = id || null;

      if(id){
        const existing=state.transport.find(x=>x.id===id);
        if(!canEditTransport(existing)){
          toast('Somente a Gerência pode editar.');
          return;
        }

        await store.update('transport',id,payload);
        toast(
          sharing.length
            ? 'Agendamento atualizado. Atenção ao possível compartilhamento de transporte.'
            : 'Agendamento atualizado.'
        );
      } else {
        payload.status='Confirmado';
        delete payload.created_by;

        // NOVO AGENDAMENTO: usa a RPC segura criada na V0.6.3.
        const saved = await store.createTransport(payload);

        if(!saved || !saved.id){
          throw new Error('Não foi possível concluir o agendamento.');
        }

        savedRecordId = saved.id;

        toast(
          sharing.length
            ? 'Agendamento salvo. Há outra viagem compatível para possível compartilhamento.'
            : 'Agendamento salvo.'
        );
      }

      const savedDate=payload.data;
      closeModal();
      await loadData();

      // Confirma pelo UUID retornado pelo próprio Supabase.
      // Evita falso erro causado por formatos diferentes de horário
      // (ex.: "08:00" no formulário e "08:00:00" no PostgreSQL).
      const existsAfterReload = savedRecordId
        ? state.transport.some(x=>x.id===savedRecordId)
        : true;

      if(!existsAfterReload){
        // O INSERT já foi confirmado pelo RPC. Se a leitura imediata ainda
        // não refletir o registro, não acusamos falha de gravação.
        console.warn('Agendamento criado, mas ainda não apareceu na leitura imediata.', savedRecordId);
      }

      openTransportDay(savedDate);
    }catch(err){
      console.error('Erro ao salvar transporte:', err);
      const msg = err?.message || 'Erro ao salvar.';
      toast(msg);
      openModal(
        'Não foi possível salvar',
        'Agendamento de Transporte',
        `<div class="delete-confirm">
          <p>Não foi possível concluir o agendamento. Tente novamente.</p>
          <div class="modal-actions">
            <button type="button" data-close class="btn primary">Fechar</button>
          </div>
        </div>`
      );
    }
  }


  async function saveProfileForm(){
    const form=$('#profileForm');
    if(!form) return;
    if(!isExecutive()){
      toast('Você não possui permissão para alterar usuários.');
      return;
    }
    if(!form.reportValidity()) return;

    const btn=form.querySelector('[data-save-profile]');
    const original=btn?.textContent||'Salvar';

    try{
      if(btn){ btn.disabled=true; btn.textContent='Salvando...'; }

      const d=formData(form);
      const profile=state.profiles.find(p=>p.id===d.id);
      if(!profile) throw new Error('Usuário não localizado.');

      const isSelf=d.id===state.user?.id;
      const patch={
        nome:String(d.nome||'').trim(),
        role:d.role,
        setor_id:d.setor_id||null,
        escola_id:d.escola_id||null,
        ativo:form.elements.ativo.checked
      };

      if(!patch.nome) throw new Error('Informe o nome do usuário.');
      if(isSelf && patch.ativo===false){
        throw new Error('Você não pode desativar sua própria conta.');
      }

      const saved=await store.updateProfile(d.id,patch);
      if(!saved?.id) throw new Error('Não foi possível salvar as alterações.');

      // Atualiza imediatamente a linha da tabela, sem depender de recarregar a página.
      const idx=state.profiles.findIndex(p=>p.id===d.id);
      if(idx>=0) state.profiles[idx]={...state.profiles[idx],...saved,...patch};

      closeModal();
      renderUsers();
      toast('Usuário atualizado com sucesso.');
    }catch(err){
      console.error('Erro ao atualizar usuário:',err);
      const msg=err?.message||'Não foi possível salvar as alterações.';
      toast(msg);
      openModal(
        'Não foi possível salvar',
        'Usuários e Permissões',
        `<div class="delete-confirm">
          <p>${esc(msg)}</p>
          <div class="modal-actions">
            <button type="button" data-close class="btn primary">Fechar</button>
          </div>
        </div>`
      );
    }finally{
      if(btn && document.body.contains(btn)){
        btn.disabled=false;
        btn.textContent=original;
      }
    }
  }

  async function handleModalSubmit(e){
    const form=e.target; if(!(form instanceof HTMLFormElement)) return;
    try{
      if(form.id==='schoolForm'){
        e.preventDefault(); if(!isManager()){ toast('Sem permissão.'); return; }
        const d=formData(form); await store.insert('schools',{...d,ativo:true,created_by:state.user?.id||null}); closeModal(); await loadData(); toast('Escola cadastrada.'); return;
      }
      if(form.id==='transportForm'){
        e.preventDefault();
        await saveTransportForm();
        return;
      }
      if(form.id==='visitForm'){
        e.preventDefault(); if(!canWriteOperational()){ toast('Seu perfil possui acesso somente para visualização.'); return; } const d=formData(form); const school=state.schools.find(s=>s.id===d.escola_id); await store.insert('visits',{...d,escola_nome:school?.nome||null,created_by:state.user?.id||null}); closeModal(); await loadData(); toast('Visita salva no histórico.'); return;
      }
      if(form.id==='managementForm'){
        e.preventDefault(); if(!canWriteOperational()){ toast('Seu perfil possui acesso somente para visualização.'); return; } const d=formData(form); const school=state.schools.find(s=>s.id===d.escola_id); await store.insert('management',{...d,escola_nome:school?.nome||null,created_by:state.user?.id||null}); closeModal(); await loadData(); toast('Acompanhamento salvo.'); return;
      }
      if(form.id==='profileForm'){
        e.preventDefault();
        await saveProfileForm();
        return;
      }
    }catch(err){
      console.error(err);
      const msg = err?.message || 'Erro ao salvar.';
      toast(msg);
      if(form?.id==='transportForm'){
        openModal(
          'Não foi possível salvar',
          'Agendamento de Transporte',
          `<div class="delete-confirm">
            <p>Não foi possível concluir o agendamento. Tente novamente.</p>
            <div class="modal-actions">
              <button type="button" data-close class="btn primary">Fechar</button>
            </div>
          </div>`
        );
      }
    }
  }

  document.addEventListener('click', async e=>{
    if(e.target.id==='editIdebCompositionBtn'){ openIdebComposition(); return; }
    if(e.target.id==='idebSelectAll'){ $$('[data-ideb-composition]').forEach(c=>c.checked=true); updateIdebCompositionCount(); return; }
    if(e.target.id==='idebClearAll'){ $$('[data-ideb-composition]').forEach(c=>c.checked=false); updateIdebCompositionCount(); return; }
    if(e.target.id==='saveIdebCompositionBtn'){ await saveIdebComposition(); return; }
    const idebSchool=e.target.closest('[data-ideb-school]'); if(idebSchool){ openIdebSchool(idebSchool.dataset.idebSchool); return; }
    const saveProfile=e.target.closest('[data-save-profile]');
    if(saveProfile){
      e.preventDefault();
      await saveProfileForm();
      return;
    }
    const saveTransport=e.target.closest('[data-save-transport]');
    if(saveTransport){
      e.preventDefault();
      await saveTransportForm();
      return;
    }
    if(e.target.id==='newAulasReportBtn') openAulasImportForm();
    if(e.target.id==='analyzeAulasPdfBtn') await analyzeAulasPdf();
    if(e.target.id==='confirmAulasImportBtn') await confirmAulasImport();
    if(e.target.id==='clearAulasFilters'){ ['aulasSchoolFilter','aulasModalityFilter','aulasSubjectFilter','aulasClassFilter','aulasPeriodFilter','aulasSearch'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';}); const s=$('#aulasSort'); if(s)s.value='registro_asc'; syncAulasFilterOptions(); renderAulas(); }
    const viewAulasReport=e.target.closest('[data-view-aulas-report]'); if(viewAulasReport){ state.activeClassReportId=viewAulasReport.dataset.viewAulasReport; try{state.classItems=await store.listClassItems(state.activeClassReportId); renderAulas();}catch(err){toast(err.message||'Erro ao abrir histórico.');} }
    const openAulasPdf=e.target.closest('[data-open-aulas-pdf]'); if(openAulasPdf){ const rep=state.classReports.find(r=>r.id===openAulasPdf.dataset.openAulasPdf); if(rep){try{const url=await store.getClassReportUrl(rep.storage_path); if(url)window.open(url,'_blank','noopener');}catch(err){toast(err.message||'Não foi possível abrir o PDF.');}} }

    const nav=e.target.closest('[data-view]'); if(nav) navigate(nav.dataset.view);
    const go=e.target.closest('[data-go]'); if(go) navigate(go.dataset.go);
    if(e.target.id==='menuToggle') $('.sidebar')?.classList.toggle('open');
    if(e.target.id==='closeModal'||e.target.matches('[data-close]')) closeModal();
    if(e.target.id==='newSchoolBtn') openSchoolForm();
    if(e.target.id==='newTransportBtn') openTransportForm();
    if(e.target.id==='transportCalendarTab'){ $('#transportCalendarTab')?.classList.add('active'); $('#transportListTab')?.classList.remove('active'); $('#transportCalendarPanel')?.classList.remove('hidden'); $('#transportListPanel')?.classList.add('hidden'); }
    if(e.target.id==='transportListTab'){ $('#transportListTab')?.classList.add('active'); $('#transportCalendarTab')?.classList.remove('active'); $('#transportListPanel')?.classList.remove('hidden'); $('#transportCalendarPanel')?.classList.add('hidden'); }
    if(e.target.id==='transportPrevMonth'){ transportCalendarDate=new Date(transportCalendarDate.getFullYear(),transportCalendarDate.getMonth()-1,1); renderTransportCalendar(); }
    if(e.target.id==='transportNextMonth'){ transportCalendarDate=new Date(transportCalendarDate.getFullYear(),transportCalendarDate.getMonth()+1,1); renderTransportCalendar(); }
    if(e.target.id==='newVisitBtn') openVisitForm();
    if(e.target.id==='newManagementBtn') openManagementForm();
    if(e.target.id==='logoutBtn'){ await store.signOut(); state.user=null; showLogin(); }
    const quick=e.target.closest('[data-quick]'); if(quick){ const t=quick.dataset.quick; closeModal(); ({transport:openTransportForm,visit:openVisitForm,management:openManagementForm,school:openSchoolForm}[t])(); }
    const calendarDay=e.target.closest('[data-calendar-date]'); if(calendarDay) openTransportDay(calendarDay.dataset.calendarDate);
    const newDate=e.target.closest('[data-new-transport-date]'); if(newDate){ const date=newDate.dataset.newTransportDate; closeModal(); openTransportForm(); const input=$('#transportForm input[name="data"]'); if(input) input.value=date; }
    const viewTransport=e.target.closest('[data-view-transport]'); if(viewTransport){ const item=state.transport.find(x=>x.id===viewTransport.dataset.viewTransport); if(item) openTransportItem(item); }
    const editTransport=e.target.closest('[data-edit-transport]'); if(editTransport){ const item=state.transport.find(x=>x.id===editTransport.dataset.editTransport); closeModal(); if(item) openTransportForm(item); }
    const setStatus=e.target.closest('[data-set-transport-status]'); if(setStatus) await updateTransportStatus(setStatus.dataset.setTransportStatus,setStatus.dataset.status);
    const deleteTransport=e.target.closest('[data-delete-transport]'); if(deleteTransport){ const item=state.transport.find(x=>x.id===deleteTransport.dataset.deleteTransport); if(item) confirmDeleteTransport(item); }
    const confirmDelete=e.target.closest('[data-confirm-delete-transport]'); if(confirmDelete) await deleteTransportItem(confirmDelete.dataset.confirmDeleteTransport);
    const editProfile=e.target.closest('[data-edit-profile]'); if(editProfile){ const profile=state.profiles.find(p=>p.id===editProfile.dataset.editProfile); if(profile) openProfileForm(profile); }
  });

  document.addEventListener('submit', async e=>{
    if(e.target.id==='loginForm'){
      e.preventDefault(); const email=$('#loginEmail')?.value.trim(), password=$('#loginPassword')?.value;
      if(!email||!password){ toast('Informe e-mail e senha.'); return; }
      try{ const user=await store.signIn(email,password); await showApp(user); }catch(err){ toast(err.message||'Não foi possível entrar.'); }
      return;
    }
    await handleModalSubmit(e);
  });

  $('#schoolSearch')?.addEventListener('input',renderSchools);
  $('#transportSearch')?.addEventListener('input',renderTransport);
  $('#transportStatusFilter')?.addEventListener('change',renderTransport);
  $('#visitSearch')?.addEventListener('input',renderVisits);
  $('#userSearch')?.addEventListener('input',renderUsers);
  ['aulasSchoolFilter','aulasModalityFilter','aulasPeriodFilter'].forEach(id=>document.getElementById(id)?.addEventListener('change',()=>{syncAulasFilterOptions();renderAulas();}));
  ['aulasSubjectFilter','aulasClassFilter','aulasSort','aulasRankingOrder'].forEach(id=>document.getElementById(id)?.addEventListener('change',renderAulas));
  $('#aulasSearch')?.addEventListener('input',renderAulas);
  document.addEventListener('input', e=>{
    if(e.target.closest('#transportForm') && ['data','escola_id','destino','hora_saida','previsao_retorno'].includes(e.target.name)) refreshTransportSharingAlert();
  });
  document.addEventListener('change', e=>{
    if(e.target.closest('#transportForm') && ['data','escola_id','destino','hora_saida','previsao_retorno'].includes(e.target.name)) refreshTransportSharingAlert();
  });
  $('#idebStageFilter')?.addEventListener('change',()=>{syncIdebFilters();renderIdeb();});
  $('#idebYearFilter')?.addEventListener('change',renderIdeb);
  $('#idebSort')?.addEventListener('change',renderIdeb);
  $('#idebSearch')?.addEventListener('input',renderIdeb);
  document.addEventListener('change',e=>{ if(e.target.matches('[data-ideb-composition]')) updateIdebCompositionCount(); });

  boot();
})();
