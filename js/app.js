(() => {
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const store = window.PortalStore;
  const state = { user: null, schools: [], transport: [], visits: [], management: [] };
  const roleLabels = { admin:'Administrador', gerencia:'Gerência Regional', coordenacao:'Coordenação', tecnico:'Técnico da GRE', escola:'Escola' };
  const titles = { dashboard:'Apresentação', transporte:'Gerência Regional • Transporte', visitas:'Ensino e Aprendizagem • Visitas', gestao:'Gestão e Inspeção • Acompanhamento Escolar', administracao:'Administração', gestaoSetor:'Gestão', prestacao:'Prestação de Contas', escolas:'Escolas', usuarios:'Usuários e Permissões', configuracoes:'Configurações' };
  let transportCalendarDate = new Date();
  const transportMonthNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  function toast(message) {
    const el = $('#toast'); el.textContent = message; el.classList.add('show');
    clearTimeout(window.__toastTimer); window.__toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
  }
  function esc(v=''){ return String(v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c])); }
  function fmtDate(v){ if(!v) return '—'; const [y,m,d]=String(v).slice(0,10).split('-'); return `${d}/${m}/${y}`; }
  function fmtDateLong(v){ if(!v) return ''; return new Date(`${String(v).slice(0,10)}T12:00:00`).toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'}); }
  function formData(form){ return Object.fromEntries(new FormData(form).entries()); }

  async function loadData(){
    try {
      const [schools, transport, visits, management] = await Promise.all(['schools','transport','visits','management'].map(store.list));
      Object.assign(state,{schools,transport,visits,management});
      renderAll();
    } catch(err){ console.error(err); toast('Não foi possível carregar os dados. Verifique a configuração do banco.'); }
  }

  function setUser(user){
    state.user = user;
    const label = roleLabels[user.role] || user.role;
    $('#welcomeName').textContent = user.name || 'Usuário';
    $('#userMiniName').textContent = user.name || 'Usuário';
    $('#userMiniRole').textContent = label;
    $('#userAvatar').textContent = (user.name || 'U').trim()[0].toUpperCase();
    $$('.admin-only').forEach(el => el.classList.toggle('hidden', !['admin','gerencia'].includes(user.role)));
    $('#storageBadge').textContent = user.online ? 'Banco online' : 'Modo demonstração';
    $('#storageBadge').className = `badge ${user.online ? 'online':'demo'}`;
    $('#dbStatusText').textContent = user.online ? 'O sistema está conectado ao Supabase e os dados são gravados no banco online.' : 'O sistema está usando armazenamento local apenas para demonstração.';
    const dashName = document.querySelector('#dashboardUserName'); if(dashName) dashName.textContent = user.name || 'Usuário';
    const dashRole = document.querySelector('#dashboardUserRole'); if(dashRole) dashRole.textContent = label;
    const dashAvatar = document.querySelector('#dashboardAvatar'); if(dashAvatar) dashAvatar.textContent = (user.name || 'U').trim()[0].toUpperCase();
    const dashStorage = document.querySelector('#dashboardStorage'); if(dashStorage) dashStorage.textContent = user.online ? 'Banco Supabase online' : 'Demonstração local';
  }

  async function boot(){
    $('#todayLabel').textContent = new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long'});
    const user = await store.currentSession();
    if (user) showApp(user); else showLogin();
  }
  function showLogin(){ $('#loginView').classList.remove('hidden'); $('#appView').classList.add('hidden'); }
  async function showApp(user){ $('#loginView').classList.add('hidden'); $('#appView').classList.remove('hidden'); setUser(user); await loadData(); navigate('dashboard'); }

  function navigate(view){
    $$('.view').forEach(v => v.classList.remove('active-view'));
    $$('.nav-item').forEach(v => v.classList.remove('active'));
    const target = document.getElementById(view); if(target) target.classList.add('active-view');
    const nav = $(`.nav-item[data-view="${view}"]`); if(nav) nav.classList.add('active');
    $('#pageTitle').textContent = titles[view] || 'Portal 8ª GRE';
    $('.sidebar').classList.remove('open');
  }

  function renderAll(){ renderStats(); renderDashboardLists(); renderSchools(); renderTransport(); renderVisits(); renderManagement(); }
  function renderStats(){
    $('#statTransport').textContent = state.transport.length;
    $('#statVisits').textContent = state.visits.length;
    $('#statSchools').textContent = state.schools.filter(s=>s.ativo !== false).length;
    $('#statInterventions').textContent = state.management.filter(m => !['Concluída','Concluido','Concluído'].includes(m.status)).length;
  }
  function renderDashboardLists(){
    const trans = [...state.transport].sort((a,b)=>String(a.data).localeCompare(String(b.data))).slice(0,4);
    $('#dashboardTransportList').innerHTML = trans.length ? trans.map(x=>`<div class="activity-item"><span class="activity-dot"></span><div><strong>${esc(fmtDate(x.data))} • ${esc(x.veiculo || '')}</strong><small>${esc(x.destino || x.escola_nome || 'Destino não informado')} — ${esc(x.responsavel || '')}</small></div></div>`).join('') : 'Nenhum agendamento cadastrado.';
    const visits = state.visits.slice(0,4);
    $('#dashboardVisitList').innerHTML = visits.length ? visits.map(x=>`<div class="activity-item"><span class="activity-dot" style="background:var(--green)"></span><div><strong>${esc(x.escola_nome || schoolName(x.escola_id))}</strong><small>${esc(fmtDate(x.data))} — ${esc(x.tecnico || '')}</small></div></div>`).join('') : 'Nenhuma visita cadastrada.';
  }
  function schoolName(id){ return state.schools.find(s=>s.id===id)?.nome || 'Escola não informada'; }
  function schoolOptions(selected=''){ return `<option value="">Selecione</option>` + state.schools.map(s=>`<option value="${esc(s.id)}" ${s.id===selected?'selected':''}>${esc(s.nome)} — ${esc(s.municipio||'')}</option>`).join(''); }

  function renderSchools(){
    const q = ($('#schoolSearch')?.value || '').toLowerCase();
    const rows = state.schools.filter(s => !q || [s.nome,s.municipio,s.inep,s.gestor].some(v=>String(v||'').toLowerCase().includes(q)));
    $('#schoolsEmpty').classList.toggle('hidden', rows.length>0);
    $('#schoolTable').innerHTML = rows.map(s=>`<tr><td><strong>${esc(s.nome)}</strong></td><td>${esc(s.inep||'—')}</td><td>${esc(s.municipio||'—')}</td><td>${esc(s.gestor||'—')}</td><td>${esc(s.telefone||s.email||'—')}</td><td><span class="status realizado">${s.ativo===false?'Inativa':'Ativa'}</span></td></tr>`).join('');
  }

  function transportVehicleClass(vehicle){ return vehicle==='S10'?'s10':vehicle==='Logan'?'logan':'polo'; }
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
      const shown=events.slice(0,3).map(x=>`<div class="calendar-event ${transportVehicleClass(x.veiculo)}" title="${esc(x.veiculo)} • ${esc(x.destino||x.escola_nome||'')}">${esc(x.veiculo)} • ${esc(x.destino||x.escola_nome||'Destino')}</div>`).join('');
      const more=events.length>3?`<div class="calendar-more">+${events.length-3} agendamento(s)</div>`:'';
      cells.push(`<button type="button" class="calendar-day ${key===todayKey?'today':''}" data-calendar-date="${key}"><span class="calendar-day-num">${d}</span><div class="calendar-events">${shown}${more}</div></button>`);
    }
    const total=first+days, remain=(7-(total%7))%7;
    for(let d=1;d<=remain;d++) cells.push(`<div class="calendar-day muted"><span class="calendar-day-num">${d}</span></div>`);
    grid.innerHTML=cells.join('');
  }

  function openTransportDay(key){
    const list=state.transport.filter(x=>String(x.data).slice(0,10)===key).sort((a,b)=>String(a.hora_saida||'').localeCompare(String(b.hora_saida||'')));
    const [y,m,d]=key.split('-').map(Number);
    const title=`${String(d).padStart(2,'0')} de ${transportMonthNames[m-1]} de ${y}`;
    if(!list.length){
      openModal(title,'Agenda do dia',`<div class="calendar-empty-day">Nenhum transporte agendado para esta data.<br><button type="button" class="btn transport" data-new-transport-date="${key}">+ Agendar transporte</button></div>`);
      return;
    }
    openModal(title,'Agenda do dia',`<div class="day-bookings">${list.map(x=>`<article class="day-booking"><div class="day-booking-head"><div><p class="eyebrow">${esc(x.status||'Solicitado')}</p><h3>${esc(x.finalidade||'Deslocamento')}</h3></div><span class="vehicle-chip ${transportVehicleClass(x.veiculo)}">${esc(x.veiculo||'—')}</span></div><div class="booking-detail-grid"><div class="booking-detail"><small>Escola / destino</small><strong>${esc(x.escola_nome||x.destino||'—')}</strong></div><div class="booking-detail"><small>Município / destino</small><strong>${esc(x.destino||'—')}</strong></div><div class="booking-detail"><small>Responsável</small><strong>${esc(x.responsavel||'—')}</strong></div><div class="booking-detail"><small>Quem irá</small><strong>${esc(x.participantes||'—')}</strong></div><div class="booking-detail"><small>Saída da 8ª GRE</small><strong>${esc(x.hora_saida||'—')}</strong></div><div class="booking-detail"><small>Previsão de retorno</small><strong>${esc(x.previsao_retorno||'—')}</strong></div></div><div class="booking-purpose"><strong>Finalidade:</strong> ${esc(x.finalidade||'—')}</div></article>`).join('')}</div>`);
  }

  function timeToMinutes(v){ if(!v) return null; const [h,m]=String(v).slice(0,5).split(':').map(Number); return h*60+m; }
  function hasTransportConflict(item){
    const start=timeToMinutes(item.hora_saida), end=timeToMinutes(item.previsao_retorno); if(start===null||end===null) return false;
    return state.transport.some(x=>String(x.data).slice(0,10)===item.data && x.veiculo===item.veiculo && x.status!=='Cancelado' && (()=>{ const a=timeToMinutes(x.hora_saida), b=timeToMinutes(x.previsao_retorno); return a!==null&&b!==null&&start<b&&end>a; })());
  }

  function renderTransport(){
    const q = ($('#transportSearch')?.value || '').toLowerCase(); const st = $('#transportStatusFilter')?.value || '';
    const rows = state.transport.filter(x=>(!st||x.status===st)&&(!q||[x.destino,x.escola_nome,x.responsavel,x.finalidade,x.veiculo].some(v=>String(v||'').toLowerCase().includes(q))));
    $('#transportEmpty').classList.toggle('hidden', rows.length>0);
    $('#transportTable').innerHTML = rows.map(x=>`<tr><td>${esc(fmtDate(x.data))}</td><td><strong>${esc(x.veiculo||'—')}</strong></td><td>${esc(x.destino||x.escola_nome||'—')}</td><td>${esc(x.responsavel||'—')}</td><td>${esc(x.hora_saida||'—')} ${x.previsao_retorno?`→ ${esc(x.previsao_retorno)}`:''}</td><td><span class="status ${String(x.status||'Solicitado').toLowerCase()}">${esc(x.status||'Solicitado')}</span></td><td><button class="action-btn" data-transport-status="${esc(x.id)}" title="Alterar status">⋯</button></td></tr>`).join('');
    ['S10','Logan','Polo'].forEach(v=>{ const id = v==='S10'?'countS10':v==='Logan'?'countLogan':'countPolo'; $('#'+id).textContent = state.transport.filter(x=>x.veiculo===v && x.status!=='Cancelado').length; });
    renderTransportCalendar();
  }

  function renderVisits(){
    const q = ($('#visitSearch')?.value||'').toLowerCase();
    const rows = state.visits.filter(x=>!q||[x.escola_nome,schoolName(x.escola_id),x.tecnico,x.municipio,x.objetivo,x.encaminhamentos].some(v=>String(v||'').toLowerCase().includes(q)));
    $('#visitsEmpty').classList.toggle('hidden',rows.length>0);
    $('#visitsList').innerHTML = rows.map(x=>`<article class="visit-card"><div class="visit-date"><small>Data</small><strong>${esc(fmtDate(x.data))}</strong><span>${esc(x.horario||'')}</span></div><div><h4>${esc(x.escola_nome||schoolName(x.escola_id))}</h4><p><strong>Técnico:</strong> ${esc(x.tecnico||'—')}</p><p><strong>Objetivo:</strong> ${esc(x.objetivo||'—')}</p>${x.encaminhamentos?`<p><strong>Encaminhamentos:</strong> ${esc(x.encaminhamentos)}</p>`:''}</div><span class="pill">${esc(x.status||'Registrada')}</span></article>`).join('');
  }

  function renderManagement(){
    const rows = state.management;
    $('#managementEmpty').classList.toggle('hidden', rows.length>0);
    $('#managementCards').innerHTML = rows.map(x=>`<article class="management-card"><div class="management-meta"><div><p class="eyebrow">${esc(x.periodo||'Acompanhamento')}</p><h3>${esc(x.escola_nome||schoolName(x.escola_id))}</h3></div><span class="status ${String(x.status||'Em acompanhamento').toLowerCase().replaceAll(' ','')==='concluída'?'realizado':'solicitado'}">${esc(x.status||'Em acompanhamento')}</span></div><div class="metrics"><div class="metric"><small>Aulas dadas</small><strong>${esc(x.aulas_dadas||'0')} / ${esc(x.aulas_previstas||'0')}</strong></div><div class="metric"><small>Frequência</small><strong>${esc(x.frequencia||'0')}%</strong></div><div class="metric"><small>Média de notas</small><strong>${esc(x.media_notas||'0')}</strong></div></div><div class="intervention"><strong>Intervenção:</strong> ${esc(x.intervencao||'Não informada')}<br><span class="muted">Responsável: ${esc(x.responsavel||'—')}</span></div></article>`).join('');
  }

  function openModal(title, eyebrow, html){ $('#modalTitle').textContent=title; $('#modalEyebrow').textContent=eyebrow; $('#modalBody').innerHTML=html; $('#modal').showModal(); }
  function closeModal(){ $('#modal').close(); }

  function openDbConfig(){
    const cfg = store.getConfig() || {};
    openModal('Conectar banco Supabase','Configuração técnica',`<form id="dbConfigForm" class="form-grid"><label class="full">Project URL<input name="url" value="${esc(cfg.url||'')}" placeholder="https://xxxx.supabase.co" required></label><label class="full">Publishable / anon key<textarea name="key" placeholder="sb_publishable_..." required>${esc(cfg.key||'')}</textarea></label><p class="hint full">Use apenas a chave pública (publishable/anon). Nunca cole a service_role no navegador. Antes de conectar, execute o arquivo <strong>supabase/schema.sql</strong> no SQL Editor do seu projeto.</p><div class="modal-actions full"><button type="button" id="clearDbConfig" class="btn secondary">Remover configuração</button><button class="btn primary">Salvar e testar</button></div></form>`);
  }

  function openSchoolForm(){
    openModal('Nova escola','Cadastro central',`<form id="schoolForm" class="form-grid"><label class="full">Nome da escola<input name="nome" required></label><label>Código INEP<input name="inep"></label><label>Município<input name="municipio" required></label><label>Gestor(a)<input name="gestor"></label><label>Telefone<input name="telefone"></label><label class="full">E-mail<input name="email" type="email"></label><div class="modal-actions full"><button type="button" data-close class="btn secondary">Cancelar</button><button class="btn schools">Salvar escola</button></div></form>`);
  }

  function openTransportForm(){
    openModal('Novo agendamento','Transporte',`<form id="transportForm" class="form-grid"><label>Data<input name="data" type="date" required></label><label>Veículo<select name="veiculo" required><option>S10</option><option>Logan</option><option>Polo</option></select></label><label class="full">Escola vinculada (opcional)<select name="escola_id">${schoolOptions()}</select></label><label>Município / destino<input name="destino" required></label><label>Responsável<input name="responsavel" value="${esc(state.user?.name||'')}" required></label><label>Horário de saída<input name="hora_saida" type="time" required></label><label>Previsão de retorno<input name="previsao_retorno" type="time" required></label><label class="full">Participantes<input name="participantes" placeholder="Nomes separados por vírgula"></label><label class="full">Finalidade<textarea name="finalidade" required></textarea></label><input type="hidden" name="status" value="Solicitado"><div class="modal-actions full"><button type="button" data-close class="btn secondary">Cancelar</button><button class="btn transport">Solicitar agendamento</button></div></form>`);
  }

  function openVisitForm(){
    openModal('Nova visita técnica','Ensino e Aprendizagem',`<form id="visitForm" class="form-grid"><label>Data<input name="data" type="date" required></label><label>Horário<input name="horario" type="time"></label><label class="full">Escola<select name="escola_id" required>${schoolOptions()}</select></label><label>Técnico responsável<input name="tecnico" value="${esc(state.user?.name||'')}" required></label><label>Município<input name="municipio"></label><label class="full">Objetivo da visita<textarea name="objetivo" required></textarea></label><label class="full">Observações<textarea name="observacoes"></textarea></label><label class="full">Encaminhamentos<textarea name="encaminhamentos"></textarea></label><input type="hidden" name="status" value="Registrada"><div class="modal-actions full"><button type="button" data-close class="btn secondary">Cancelar</button><button class="btn visits">Salvar visita</button></div></form>`);
  }

  function openManagementForm(){
    openModal('Novo acompanhamento','Gestão e Inspeção',`<form id="managementForm" class="form-grid"><label class="full">Escola<select name="escola_id" required>${schoolOptions()}</select></label><label>Período<input name="periodo" placeholder="Ex.: Agosto/2026" required></label><label>Status<select name="status"><option>Em acompanhamento</option><option>Intervenção necessária</option><option>Concluída</option></select></label><label>Aulas previstas<input name="aulas_previstas" type="number" min="0" value="0"></label><label>Aulas dadas<input name="aulas_dadas" type="number" min="0" value="0"></label><label>Frequência (%)<input name="frequencia" type="number" min="0" max="100" step="0.01" value="0"></label><label>Média de notas<input name="media_notas" type="number" min="0" step="0.01" value="0"></label><label class="full">Intervenção / encaminhamento<textarea name="intervencao"></textarea></label><label class="full">Responsável<input name="responsavel" value="${esc(state.user?.name||'')}"></label><div class="modal-actions full"><button type="button" data-close class="btn secondary">Cancelar</button><button class="btn management">Salvar acompanhamento</button></div></form>`);
  }

  async function handleModalSubmit(e){
    const form=e.target; if(!(form instanceof HTMLFormElement)) return;
    try{
      if(form.id==='dbConfigForm'){
        e.preventDefault(); const d=formData(form); store.setConfig({url:d.url.trim(),key:d.key.trim()});
        store.getSupabase(); toast('Configuração salva. Entre com uma conta do Supabase para testar.'); closeModal(); location.reload(); return;
      }
      if(form.id==='schoolForm'){
        e.preventDefault(); const d=formData(form); await store.insert('schools',{...d,ativo:true,created_by:state.user?.id||null}); closeModal(); await loadData(); toast('Escola cadastrada.'); return;
      }
      if(form.id==='transportForm'){
        e.preventDefault(); const d=formData(form);
        if(timeToMinutes(d.previsao_retorno)<=timeToMinutes(d.hora_saida)){ toast('A previsão de retorno deve ser posterior ao horário de saída.'); return; }
        if(hasTransportConflict(d)){ toast(`Conflito: ${d.veiculo} já possui agendamento nesse intervalo.`); return; }
        const school=state.schools.find(s=>s.id===d.escola_id); await store.insert('transport',{...d,escola_id:d.escola_id||null,escola_nome:school?.nome||null,created_by:state.user?.id||null}); closeModal(); await loadData(); toast('Agendamento salvo.'); return;
      }
      if(form.id==='visitForm'){
        e.preventDefault(); const d=formData(form); const school=state.schools.find(s=>s.id===d.escola_id); await store.insert('visits',{...d,escola_nome:school?.nome||null,created_by:state.user?.id||null}); closeModal(); await loadData(); toast('Visita salva no histórico.'); return;
      }
      if(form.id==='managementForm'){
        e.preventDefault(); const d=formData(form); const school=state.schools.find(s=>s.id===d.escola_id); await store.insert('management',{...d,escola_nome:school?.nome||null,created_by:state.user?.id||null}); closeModal(); await loadData(); toast('Acompanhamento salvo.'); return;
      }
    }catch(err){ console.error(err); toast(err.message || 'Erro ao salvar.'); }
  }

  document.addEventListener('click', async e=>{
    const nav=e.target.closest('[data-view]'); if(nav) navigate(nav.dataset.view);
    const go=e.target.closest('[data-go]'); if(go) navigate(go.dataset.go);
    if(e.target.id==='menuToggle') $('.sidebar').classList.toggle('open');
    if(e.target.id==='closeModal'||e.target.matches('[data-close]')) closeModal();
    if(e.target.id==='newSchoolBtn') openSchoolForm();
    if(e.target.id==='newTransportBtn') openTransportForm();
    if(e.target.id==='transportCalendarTab'){ $('#transportCalendarTab').classList.add('active'); $('#transportListTab').classList.remove('active'); $('#transportCalendarPanel').classList.remove('hidden'); $('#transportListPanel').classList.add('hidden'); }
    if(e.target.id==='transportListTab'){ $('#transportListTab').classList.add('active'); $('#transportCalendarTab').classList.remove('active'); $('#transportListPanel').classList.remove('hidden'); $('#transportCalendarPanel').classList.add('hidden'); }
    if(e.target.id==='transportPrevMonth'){ transportCalendarDate=new Date(transportCalendarDate.getFullYear(),transportCalendarDate.getMonth()-1,1); renderTransportCalendar(); }
    if(e.target.id==='transportNextMonth'){ transportCalendarDate=new Date(transportCalendarDate.getFullYear(),transportCalendarDate.getMonth()+1,1); renderTransportCalendar(); }
    if(e.target.id==='newVisitBtn') openVisitForm();
    if(e.target.id==='newManagementBtn') openManagementForm();
    if(['openDbConfig','openDbConfig2'].includes(e.target.id)) openDbConfig();
    if(e.target.id==='clearDbConfig'){ store.clearConfig(); closeModal(); toast('Configuração removida.'); setTimeout(()=>location.reload(),500); }
    if(e.target.id==='logoutBtn'){ await store.signOut(); state.user=null; showLogin(); }
    if(e.target.id==='quickAddHero'){ document.querySelector('#quickAdd')?.click(); }
    if(e.target.id==='quickAdd'){
      openModal('Novo registro','Ação rápida',`<div class="roles-grid"><button class="btn transport" data-quick="transport">Transporte</button><button class="btn visits" data-quick="visit">Visita</button><button class="btn management" data-quick="management">Acompanhamento</button><button class="btn schools" data-quick="school">Escola</button></div>`);
    }
    const quick=e.target.closest('[data-quick]'); if(quick){ const t=quick.dataset.quick; closeModal(); ({transport:openTransportForm,visit:openVisitForm,management:openManagementForm,school:openSchoolForm}[t])(); }
    const calendarDay=e.target.closest('[data-calendar-date]'); if(calendarDay){ openTransportDay(calendarDay.dataset.calendarDate); }
    const newDate=e.target.closest('[data-new-transport-date]'); if(newDate){ const date=newDate.dataset.newTransportDate; closeModal(); openTransportForm(); const input=document.querySelector('#transportForm input[name="data"]'); if(input) input.value=date; }
    const statusBtn=e.target.closest('[data-transport-status]'); if(statusBtn){ const id=statusBtn.dataset.transportStatus; const item=state.transport.find(x=>x.id===id); openModal('Alterar status','Transporte',`<form id="statusForm" class="form-stack"><input type="hidden" name="id" value="${esc(id)}"><label>Status<select name="status"><option ${item.status==='Solicitado'?'selected':''}>Solicitado</option><option ${item.status==='Confirmado'?'selected':''}>Confirmado</option><option ${item.status==='Realizado'?'selected':''}>Realizado</option><option ${item.status==='Cancelado'?'selected':''}>Cancelado</option></select></label><div class="modal-actions"><button type="button" data-close class="btn secondary">Cancelar</button><button class="btn transport">Salvar</button></div></form>`); }
  });

  document.addEventListener('submit', async e=>{
    if(e.target.id==='loginForm'){
      e.preventDefault(); const email=$('#loginEmail').value.trim(), password=$('#loginPassword').value;
      if(!email||!password){ toast('Informe e-mail e senha.'); return; }
      try{ const user=await store.signIn(email,password); await showApp(user); }catch(err){ toast(err.message||'Não foi possível entrar.'); }
      return;
    }
    if(e.target.id==='statusForm'){
      e.preventDefault(); const d=formData(e.target); try{ await store.update('transport',d.id,{status:d.status}); closeModal(); await loadData(); toast('Status atualizado.'); }catch(err){ toast(err.message||'Erro ao atualizar.'); } return;
    }
    await handleModalSubmit(e);
  });

  $('#demoLogin').addEventListener('click', async ()=>{
    const role=$('#demoRole').value; const user={id:'demo-user',name:role==='gerencia'?'Gerência Regional':'Usuário Demonstração',role,online:false}; store.setDemoSession(user); await showApp(user);
  });
  $('#schoolSearch').addEventListener('input',renderSchools);
  $('#transportSearch').addEventListener('input',renderTransport); $('#transportStatusFilter').addEventListener('change',renderTransport);
  $('#visitSearch').addEventListener('input',renderVisits);
  boot();
})();
