(() => {
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const store = window.PortalStore;
  const state = { user: null, schools: [], transport: [], visits: [], management: [], profiles: [], sectors: [] };
  const roleLabels = { admin:'Administrador', gerencia:'Gerência Regional', coordenacao:'Coordenação', tecnico:'Técnico da GRE', escola:'Escola' };
  const titles = { dashboard:'Apresentação', transporte:'Gerência Regional • Transporte', visitas:'Ensino e Aprendizagem • Visitas', gestao:'Gestão e Inspeção • Acompanhamento Escolar', administracao:'Administração', gestaoSetor:'Gestão', prestacao:'Prestação de Contas', escolas:'Escolas', usuarios:'Usuários e Permissões', configuracoes:'Configurações' };
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

  async function loadData(){
    try {
      const [schools, transport, visits, management] = await Promise.all(['schools','transport','visits','management'].map(store.list));
      Object.assign(state,{schools,transport,visits,management});
      if (isExecutive()) {
        const [profiles, sectors] = await Promise.all([store.listProfiles(), store.listSectors()]);
        Object.assign(state,{profiles,sectors});
      } else {
        state.profiles=[]; state.sectors=[];
      }
      renderAll();
    } catch(err){
      console.error(err);
      toast('Não foi possível carregar os dados. Verifique o banco e as permissões.');
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
    setText('#storageBadge','Banco online');
    const badge=$('#storageBadge'); if(badge) badge.className='badge online';
    setText('#dbStatusText','O sistema está conectado ao Supabase e os dados são gravados no banco online.');
    setText('#dashboardUserName', user.name || 'Usuário');
    setText('#dashboardUserRole', label);
    setText('#dashboardAvatar', (user.name || 'U').trim()[0].toUpperCase());
    setText('#dashboardStorage','Banco Supabase online');
  }

  async function boot(){
    setText('#todayLabel', new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long'}));
    const config = await store.init();
    updateConnectionUi(config);
    const user = await store.currentSession();
    if (user) await showApp(user); else showLogin();
  }

  function updateConnectionUi(config){
    const source = config?.source || store.getConfigSource?.() || 'none';
    const loginStatus = $('#loginDbStatus');
    const loginConfigBtn = $('#openDbConfig');
    const settingsConfigBtn = $('#openDbConfig2');
    if(source === 'vercel'){
      if(loginStatus) loginStatus.innerHTML = '<span class="connection-dot online"></span> Banco de dados conectado automaticamente';
      loginConfigBtn?.classList.add('hidden');
      if(settingsConfigBtn){ settingsConfigBtn.textContent = 'Gerenciado pela Vercel'; settingsConfigBtn.disabled = true; }
    } else if(source === 'local'){
      if(loginStatus) loginStatus.innerHTML = '<span class="connection-dot online"></span> Banco configurado neste navegador';
      loginConfigBtn?.classList.remove('hidden');
      if(settingsConfigBtn){ settingsConfigBtn.textContent = 'Configurar Supabase'; settingsConfigBtn.disabled = false; }
    } else {
      if(loginStatus) loginStatus.innerHTML = '<span class="connection-dot"></span> Banco online ainda não configurado na Vercel';
      loginConfigBtn?.classList.remove('hidden');
      if(settingsConfigBtn){ settingsConfigBtn.textContent = 'Configurar Supabase'; settingsConfigBtn.disabled = false; }
    }
  }

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

  function renderAll(){ renderStats(); renderDashboardLists(); renderSchools(); renderTransport(); renderVisits(); renderManagement(); renderUsers(); }
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

  function openDbConfig(){
    const source = store.getConfigSource?.() || 'none';
    if(source === 'vercel'){
      openModal('Banco conectado','Configuração automática',`<div class="info-banner"><strong>Supabase conectado automaticamente.</strong><br>As credenciais públicas estão configuradas nas Environment Variables do projeto na Vercel.</div><div class="modal-actions"><button type="button" data-close class="btn primary">Fechar</button></div>`);
      return;
    }
    const cfg = store.getConfig() || {};
    openModal('Conectar banco Supabase','Configuração técnica',`<form id="dbConfigForm" class="form-grid"><label class="full">Project URL<input name="url" value="${esc(cfg.url||'')}" placeholder="https://xxxx.supabase.co" required></label><label class="full">Publishable / anon key<textarea name="key" placeholder="sb_publishable_..." required>${esc(cfg.key||'')}</textarea></label><p class="hint full">Fallback técnico. Na produção, use as variáveis da Vercel. Nunca use service_role no navegador.</p><div class="modal-actions full"><button type="button" id="clearDbConfig" class="btn secondary">Remover configuração local</button><button class="btn primary">Salvar e testar</button></div></form>`);
  }

  function openSchoolForm(){
    if(!isManager()){ toast('Seu perfil não possui permissão para cadastrar escolas.'); return; }
    openModal('Nova escola','Cadastro central',`<form id="schoolForm" class="form-grid"><label class="full">Nome da escola<input name="nome" required></label><label>Código INEP<input name="inep"></label><label>Município<input name="municipio" required></label><label>Gestor(a)<input name="gestor"></label><label>Telefone<input name="telefone"></label><label class="full">E-mail<input name="email" type="email"></label><div class="modal-actions full"><button type="button" data-close class="btn secondary">Cancelar</button><button class="btn schools">Salvar escola</button></div></form>`);
  }

  function openTransportForm(item=null){
    if(!canManageTransport()){ toast('O agendamento de transporte é exclusivo da Gerência. Seu perfil possui somente visualização.'); return; }
    const editing=!!item;
    const statusSelect = editing ? `<label>Status<select name="status"><option ${item.status==='Solicitado'?'selected':''}>Solicitado</option><option ${item.status==='Confirmado'?'selected':''}>Confirmado</option><option ${item.status==='Realizado'?'selected':''}>Realizado</option><option ${item.status==='Cancelado'?'selected':''}>Cancelado</option></select></label>` : `<input type="hidden" name="status" value="Confirmado">`;
    openModal(editing?'Editar agendamento':'Novo agendamento','Gerência • Transporte',`<form id="transportForm" class="form-grid"><input type="hidden" name="id" value="${esc(item?.id||'')}"><label>Data<input name="data" type="date" value="${esc(String(item?.data||'').slice(0,10))}" required></label><label>Veículo<select name="veiculo" required><option ${item?.veiculo==='S10'?'selected':''}>S10</option><option ${item?.veiculo==='Logan'?'selected':''}>Logan</option><option ${item?.veiculo==='Polo'?'selected':''}>Polo</option></select></label><label class="full">Escola vinculada (opcional)<select name="escola_id">${schoolOptions(item?.escola_id||'')}</select></label><label>Município / destino<input name="destino" value="${esc(item?.destino||'')}" required></label><label>Responsável<input name="responsavel" value="${esc(item?.responsavel||state.user?.name||'')}" required></label><label>Horário de saída<input name="hora_saida" type="time" value="${esc(String(item?.hora_saida||'').slice(0,5))}" required></label><label>Previsão de retorno<input name="previsao_retorno" type="time" value="${esc(String(item?.previsao_retorno||'').slice(0,5))}" required></label><label class="full">Participantes<input name="participantes" value="${esc(item?.participantes||'')}" placeholder="Nomes separados por vírgula"></label><label class="full">Finalidade<textarea name="finalidade" required>${esc(item?.finalidade||'')}</textarea></label>${statusSelect}<div id="transportSharingAlert" class="full"></div><div class="modal-actions full"><button type="button" data-close class="btn secondary">Cancelar</button><button class="btn transport">${editing?'Salvar alterações':'Salvar agendamento'}</button></div></form>`);
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
    openModal('Nova visita técnica','Ensino e Aprendizagem',`<form id="visitForm" class="form-grid"><label>Data<input name="data" type="date" required></label><label>Horário<input name="horario" type="time"></label><label class="full">Escola<select name="escola_id" required>${schoolOptions()}</select></label><label>Técnico responsável<input name="tecnico" value="${esc(state.user?.name||'')}" required></label><label>Município<input name="municipio"></label><label class="full">Objetivo da visita<textarea name="objetivo" required></textarea></label><label class="full">Observações<textarea name="observacoes"></textarea></label><label class="full">Encaminhamentos<textarea name="encaminhamentos"></textarea></label><input type="hidden" name="status" value="Registrada"><div class="modal-actions full"><button type="button" data-close class="btn secondary">Cancelar</button><button class="btn visits">Salvar visita</button></div></form>`);
  }

  function openManagementForm(){
    openModal('Novo acompanhamento','Gestão e Inspeção',`<form id="managementForm" class="form-grid"><label class="full">Escola<select name="escola_id" required>${schoolOptions()}</select></label><label>Período<input name="periodo" placeholder="Ex.: Agosto/2026" required></label><label>Status<select name="status"><option>Em acompanhamento</option><option>Intervenção necessária</option><option>Concluída</option></select></label><label>Aulas previstas<input name="aulas_previstas" type="number" min="0" value="0"></label><label>Aulas dadas<input name="aulas_dadas" type="number" min="0" value="0"></label><label>Frequência (%)<input name="frequencia" type="number" min="0" max="100" step="0.01" value="0"></label><label>Média de notas<input name="media_notas" type="number" min="0" step="0.01" value="0"></label><label class="full">Intervenção / encaminhamento<textarea name="intervencao"></textarea></label><label class="full">Responsável<input name="responsavel" value="${esc(state.user?.name||'')}"></label><div class="modal-actions full"><button type="button" data-close class="btn secondary">Cancelar</button><button class="btn management">Salvar acompanhamento</button></div></form>`);
  }

  function openProfileForm(profile){
    if(!isExecutive()) return;
    const self=profile.id===state.user?.id;
    openModal('Editar usuário','Usuários e permissões',`<form id="profileForm" class="form-grid"><input type="hidden" name="id" value="${esc(profile.id)}"><label class="full">Nome<input name="nome" value="${esc(profile.nome||'')}" required></label><label class="full">E-mail<input value="${esc(profile.email||'')}" disabled></label><label>Perfil${self?`<input type="hidden" name="role" value="${esc(profile.role)}">`:''}<select name="role" ${self?'disabled':''}><option value="admin" ${profile.role==='admin'?'selected':''}>Administrador</option><option value="gerencia" ${profile.role==='gerencia'?'selected':''}>Gerência Regional</option><option value="coordenacao" ${profile.role==='coordenacao'?'selected':''}>Coordenação</option><option value="tecnico" ${profile.role==='tecnico'?'selected':''}>Técnico da GRE</option><option value="escola" ${profile.role==='escola'?'selected':''}>Escola</option></select></label><label>Setor<select name="setor_id">${sectorOptions(profile.setor_id||'')}</select></label><label class="full">Escola vinculada<select name="escola_id">${schoolOptions(profile.escola_id||'')}</select></label><label class="toggle-field full"><input type="checkbox" name="ativo" value="true" ${profile.ativo!==false?'checked':''}> <span>Usuário ativo</span></label>${self?'<p class="hint full">Para evitar bloquear seu próprio acesso por engano, o sistema não permite desativar a conta atualmente conectada.</p>':''}<div class="modal-actions full"><button type="button" data-close class="btn secondary">Cancelar</button><button class="btn primary">Salvar permissões</button></div></form>`);
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

  async function handleModalSubmit(e){
    const form=e.target; if(!(form instanceof HTMLFormElement)) return;
    try{
      if(form.id==='dbConfigForm'){
        e.preventDefault(); const d=formData(form); store.setConfig({url:d.url.trim(),key:d.key.trim()}); store.getSupabase(); toast('Configuração salva.'); closeModal(); location.reload(); return;
      }
      if(form.id==='schoolForm'){
        e.preventDefault(); if(!isManager()){ toast('Sem permissão.'); return; }
        const d=formData(form); await store.insert('schools',{...d,ativo:true,created_by:state.user?.id||null}); closeModal(); await loadData(); toast('Escola cadastrada.'); return;
      }
      if(form.id==='transportForm'){
        e.preventDefault(); if(!canManageTransport()){ toast('Somente a Gerência pode criar ou alterar agendamentos.'); return; }
        const d=formData(form); const id=d.id||null; delete d.id;
        if(timeToMinutes(d.previsao_retorno)<=timeToMinutes(d.hora_saida)){ toast('A previsão de retorno deve ser posterior ao horário de saída.'); return; }
        if(hasTransportConflict(d,id)){ toast(`Conflito: ${d.veiculo} já possui agendamento nesse intervalo.`); return; }
        const school=state.schools.find(s=>s.id===d.escola_id);
        const payload={...d,escola_id:d.escola_id||null,escola_nome:school?.nome||null};
        const sharing=findSharingCandidates(payload,id);
        if(id){
          const existing=state.transport.find(x=>x.id===id); if(!canEditTransport(existing)){ toast('Somente a Gerência pode editar.'); return; }
          await store.update('transport',id,payload); toast(sharing.length?'Agendamento atualizado. Atenção ao possível compartilhamento de transporte.':'Agendamento atualizado.');
        } else {
          payload.status='Confirmado'; payload.created_by=state.user?.id||null;
          await store.insert('transport',payload); toast(sharing.length?'Agendamento salvo. Há outra viagem compatível para possível compartilhamento.':'Agendamento salvo.');
        }
        const savedDate=payload.data;
        closeModal(); await loadData(); openTransportDay(savedDate); return;
      }
      if(form.id==='visitForm'){
        e.preventDefault(); const d=formData(form); const school=state.schools.find(s=>s.id===d.escola_id); await store.insert('visits',{...d,escola_nome:school?.nome||null,created_by:state.user?.id||null}); closeModal(); await loadData(); toast('Visita salva no histórico.'); return;
      }
      if(form.id==='managementForm'){
        e.preventDefault(); const d=formData(form); const school=state.schools.find(s=>s.id===d.escola_id); await store.insert('management',{...d,escola_nome:school?.nome||null,created_by:state.user?.id||null}); closeModal(); await loadData(); toast('Acompanhamento salvo.'); return;
      }
      if(form.id==='profileForm'){
        e.preventDefault(); if(!isExecutive()){ toast('Sem permissão.'); return; }
        const d=formData(form); const profile=state.profiles.find(p=>p.id===d.id); if(!profile) return;
        const isSelf=d.id===state.user?.id;
        const patch={nome:d.nome.trim(),role:d.role,setor_id:d.setor_id||null,escola_id:d.escola_id||null,ativo:form.elements.ativo.checked};
        if(isSelf && patch.ativo===false){ toast('Você não pode desativar sua própria conta.'); return; }
        await store.updateProfile(d.id,patch); closeModal(); await loadData(); toast('Permissões atualizadas.'); return;
      }
    }catch(err){ console.error(err); toast(err.message || 'Erro ao salvar.'); }
  }

  document.addEventListener('click', async e=>{
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
    if(['openDbConfig','openDbConfig2'].includes(e.target.id)) openDbConfig();
    if(e.target.id==='clearDbConfig'){ store.clearConfig(); closeModal(); toast('Configuração removida.'); setTimeout(()=>location.reload(),500); }
    if(e.target.id==='logoutBtn'){ await store.signOut(); state.user=null; showLogin(); }
    if(e.target.id==='quickAddHero') $('#quickAdd')?.click();
    if(e.target.id==='quickAdd'){
      openModal('Novo registro','Ação rápida',`<div class="roles-grid">${canManageTransport()?'<button class="btn transport" data-quick="transport">Transporte</button>':''}<button class="btn visits" data-quick="visit">Visita</button><button class="btn management" data-quick="management">Acompanhamento</button>${isManager()?'<button class="btn schools" data-quick="school">Escola</button>':''}</div>`);
    }
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
  document.addEventListener('input', e=>{
    if(e.target.closest('#transportForm') && ['data','escola_id','destino','hora_saida','previsao_retorno'].includes(e.target.name)) refreshTransportSharingAlert();
  });
  document.addEventListener('change', e=>{
    if(e.target.closest('#transportForm') && ['data','escola_id','destino','hora_saida','previsao_retorno'].includes(e.target.name)) refreshTransportSharingAlert();
  });
  boot();
})();
