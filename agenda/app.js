
(() => {
  const ACCESS_STORAGE = 'agenda8gre_access';
  const CACHE_STORAGE = 'agenda8gre_transport_cache_v1';
  const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  let accessKey = '';
  let bookings = [];
  let calendarDate = new Date();
  let deferredPrompt = null;

  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];

  function esc(v=''){
    return String(v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
  }
  function dateKey(d){
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  function fmtDate(v){
    if(!v) return '—';
    const [y,m,d]=String(v).slice(0,10).split('-');
    return `${d}/${m}/${y}`;
  }
  function fmtTime(v){ return String(v||'').slice(0,5)||'—'; }
  function vehicleClass(v){ return v==='S10'?'s10':v==='Logan'?'logan':'polo'; }

  function setStatus(type,title,text){
    $('#statusDot').className = `status-dot ${type}`;
    $('#statusTitle').textContent = title;
    $('#statusText').textContent = text;
  }

  function saveAccessFromUrl(){
    const url = new URL(location.href);
    const key = url.searchParams.get('acesso');
    if(key){
      localStorage.setItem(ACCESS_STORAGE,key);
      url.searchParams.delete('acesso');
      history.replaceState({},'',url.pathname + (url.search ? url.search : ''));
      return key;
    }
    return localStorage.getItem(ACCESS_STORAGE)||'';
  }

  async function getPublicConfig(){
    const response = await fetch('/api/public-config',{cache:'no-store',headers:{Accept:'application/json'}});
    if(!response.ok) throw new Error('Agenda indisponível.');
    const data = await response.json();
    if(!data?.configured || !data?.url || !data?.key) throw new Error('Agenda indisponível.');
    return data;
  }

  async function fetchBookings(){
    const cfg = await getPublicConfig();
    const response = await fetch(`${cfg.url}/rest/v1/rpc/list_transport_motoristas`,{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'apikey':cfg.key,
        'Authorization':`Bearer ${cfg.key}`
      },
      body:JSON.stringify({access_key:accessKey}),
      cache:'no-store'
    });
    if(!response.ok) throw new Error('Acesso à agenda não autorizado.');
    const data = await response.json();
    return Array.isArray(data)?data:[];
  }

  function cacheBookings(items){
    try{
      localStorage.setItem(CACHE_STORAGE,JSON.stringify({savedAt:new Date().toISOString(),items}));
    }catch{}
  }
  function loadCached(){
    try{return JSON.parse(localStorage.getItem(CACHE_STORAGE)||'null')}catch{return null}
  }

  async function loadAgenda({silent=false}={}){
    if(!accessKey){
      $('#activationCard').classList.remove('hidden');
      $('#appContent').classList.add('hidden');
      setStatus('error','Este aparelho ainda não foi ativado','Abra o link fornecido pela 8ª GRE.');
      return;
    }
    if(!silent) setStatus('loading','Atualizando agenda...','Buscando os agendamentos mais recentes.');
    $('#refreshBtn').disabled = true;
    try{
      bookings = await fetchBookings();
      cacheBookings(bookings);
      $('#activationCard').classList.add('hidden');
      $('#appContent').classList.remove('hidden');
      const now = new Date();
      $('#lastUpdate').textContent = `Atualizado ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}`;
      setStatus('ok','Agenda atualizada','Os dados exibidos são os mais recentes.');
      renderAll();
    }catch(err){
      const cached = loadCached();
      if(cached?.items?.length){
        bookings = cached.items;
        $('#activationCard').classList.add('hidden');
        $('#appContent').classList.remove('hidden');
        const when = cached.savedAt ? new Date(cached.savedAt).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}) : '';
        $('#lastUpdate').textContent = when ? `Última atualização ${when}` : 'Dados salvos';
        setStatus('offline','Sem atualização no momento','Mostrando a última agenda salva neste celular.');
        renderAll();
      }else{
        $('#activationCard').classList.remove('hidden');
        $('#appContent').classList.add('hidden');
        setStatus('error','Não foi possível abrir a agenda','Use o link fornecido pela 8ª GRE e tente novamente.');
      }
      console.error(err);
    }finally{
      $('#refreshBtn').disabled = false;
    }
  }

  function currentMonthBookings(){
    const y=calendarDate.getFullYear(),m=calendarDate.getMonth();
    return bookings.filter(x=>{
      const d=String(x.data||'').slice(0,10);
      return d.startsWith(`${y}-${String(m+1).padStart(2,'0')}-`) && x.status!=='Cancelado';
    });
  }

  function renderCalendar(){
    const y=calendarDate.getFullYear(),m=calendarDate.getMonth();
    const label=`${MONTHS[m]} de ${y}`;
    $('#monthTitle').textContent=label;
    $('#toolbarMonth').textContent=label;

    const monthBookings=currentMonthBookings();
    const first=new Date(y,m,1), last=new Date(y,m+1,0);
    const today=dateKey(new Date());
    const cells=[];

    for(let i=0;i<first.getDay();i++) cells.push('<div class="day empty"></div>');

    for(let day=1;day<=last.getDate();day++){
      const key=`${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      const events=monthBookings
        .filter(x=>String(x.data||'').slice(0,10)===key)
        .sort((a,b)=>String(a.hora_saida||'').localeCompare(String(b.hora_saida||'')));
      const dots=events.slice(0,5).map(e=>`<i class="event-dot ${vehicleClass(e.veiculo)}"></i>`).join('');
      cells.push(`<button class="day ${events.length?'has-events':''} ${key===today?'today':''}" type="button" data-date="${key}">
        <span class="day-number">${day}</span>
        ${events.length?`<span class="event-dot-row">${dots}</span><span class="event-count">${events.length} agend.</span>`:''}
      </button>`);
    }
    $('#calendar').innerHTML=cells.join('');
  }

  function renderUpcoming(){
    const today=dateKey(new Date());
    const rows=[...bookings]
      .filter(x=>x.status!=='Cancelado' && String(x.data||'').slice(0,10)>=today)
      .sort((a,b)=>`${a.data||''}${a.hora_saida||''}`.localeCompare(`${b.data||''}${b.hora_saida||''}`))
      .slice(0,10);
    $('#upcomingList').innerHTML = rows.length ? rows.map(x=>`
      <button class="upcoming-item" type="button" data-date="${esc(String(x.data||'').slice(0,10))}">
        <span class="upcoming-date"><strong>${esc(fmtDate(x.data))}</strong><span>${esc(fmtTime(x.hora_saida))}</span></span>
        <span class="upcoming-main"><strong>${esc(x.destino||x.escola_nome||'Destino')}</strong><span>${esc(x.finalidade||'Deslocamento')}</span></span>
        <span class="vehicle ${vehicleClass(x.veiculo)}">${esc(x.veiculo||'—')}</span>
      </button>
    `).join('') : '<div class="empty-message">Nenhum deslocamento futuro registrado.</div>';
  }

  function renderAll(){ renderCalendar(); renderUpcoming(); }

  function openDay(key){
    const rows=bookings
      .filter(x=>x.status!=='Cancelado' && String(x.data||'').slice(0,10)===key)
      .sort((a,b)=>String(a.hora_saida||'').localeCompare(String(b.hora_saida||'')));
    const [y,m,d]=key.split('-').map(Number);
    $('#dayModalTitle').textContent=`${String(d).padStart(2,'0')} de ${MONTHS[m-1]} de ${y}`;
    $('#dayModalBody').innerHTML=rows.length?rows.map(x=>`
      <article class="day-booking">
        <div class="booking-head">
          <h3>${esc(x.finalidade||'Deslocamento')}</h3>
          <span class="vehicle ${vehicleClass(x.veiculo)}">${esc(x.veiculo||'—')}</span>
        </div>
        <div class="detail-grid">
          <div class="detail"><small>Escola / destino</small><strong>${esc(x.escola_nome||x.destino||'—')}</strong></div>
          <div class="detail"><small>Destino</small><strong>${esc(x.destino||'—')}</strong></div>
          <div class="detail"><small>Responsável</small><strong>${esc(x.responsavel||'—')}</strong></div>
          <div class="detail"><small>Quem irá</small><strong>${esc(x.participantes||'—')}</strong></div>
          <div class="detail"><small>Saída</small><strong>${esc(fmtTime(x.hora_saida))}</strong></div>
          <div class="detail"><small>Retorno previsto</small><strong>${esc(fmtTime(x.previsao_retorno))}</strong></div>
        </div>
      </article>
    `).join(''):'<div class="empty-message">Nenhum transporte agendado para esta data.</div>';
    $('#dayModal').classList.remove('hidden');
  }

  function closeDay(){ $('#dayModal').classList.add('hidden'); }
  function showInstallHelp(){ $('#installHelpModal').classList.remove('hidden'); }
  function closeInstallHelp(){ $('#installHelpModal').classList.add('hidden'); }

  function setupInstall(){
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if(isStandalone){
      $('#installCard').classList.add('hidden');
      return;
    }

    window.addEventListener('beforeinstallprompt', e=>{
      e.preventDefault();
      deferredPrompt=e;
      $('#installCard').classList.remove('hidden');
    });

    window.addEventListener('appinstalled',()=>{
      deferredPrompt=null;
      $('#installCard').classList.add('hidden');
      setStatus('ok','Aplicativo instalado','Agora você pode abrir a Agenda 8ª GRE pelo ícone do celular.');
    });

    $('#installBtn').addEventListener('click',async()=>{
      if(!deferredPrompt){ showInstallHelp(); return; }
      deferredPrompt.prompt();
      try{ await deferredPrompt.userChoice; }catch{}
      deferredPrompt=null;
    });
  }

  function registerServiceWorker(){
    if('serviceWorker' in navigator){
      navigator.serviceWorker.register('./sw.js').catch(console.error);
    }
  }

  function bindEvents(){
    $('#refreshBtn').addEventListener('click',()=>loadAgenda());
    $('#prevMonthBtn').addEventListener('click',()=>{calendarDate=new Date(calendarDate.getFullYear(),calendarDate.getMonth()-1,1);renderCalendar()});
    $('#nextMonthBtn').addEventListener('click',()=>{calendarDate=new Date(calendarDate.getFullYear(),calendarDate.getMonth()+1,1);renderCalendar()});
    $('#todayBtn').addEventListener('click',()=>{calendarDate=new Date();renderCalendar()});
    $('#helpInstallBtn').addEventListener('click',showInstallHelp);
    document.addEventListener('click',e=>{
      const dateButton=e.target.closest('[data-date]');
      if(dateButton){ openDay(dateButton.dataset.date); return; }
      if(e.target.closest('[data-close-modal]')) closeDay();
      if(e.target.closest('[data-close-help]')) closeInstallHelp();
    });
    document.addEventListener('visibilitychange',()=>{
      if(document.visibilityState==='visible' && accessKey) loadAgenda({silent:true});
    });
    window.addEventListener('online',()=>accessKey&&loadAgenda({silent:true}));
    setInterval(()=>{ if(document.visibilityState==='visible' && accessKey) loadAgenda({silent:true}); },5*60*1000);
  }

  async function boot(){
    accessKey=saveAccessFromUrl();
    setupInstall();
    registerServiceWorker();
    bindEvents();
    await loadAgenda();
  }

  boot();
})();
