(() => {
  const CONFIG_KEY = 'portal8gre_supabase_config';

  let runtimeConfig = null;
  let configSource = 'none';
  let sb = null;

  function getSavedConfig() {
    try { return JSON.parse(localStorage.getItem(CONFIG_KEY)) || null; } catch { return null; }
  }

  function getConfig() { return runtimeConfig || getSavedConfig(); }

  function setConfig(config) {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    runtimeConfig = config;
    configSource = 'local';
    sb = null;
  }

  function clearConfig() {
    localStorage.removeItem(CONFIG_KEY);
    if (configSource === 'local') runtimeConfig = null;
    configSource = runtimeConfig ? configSource : 'none';
    sb = null;
  }

  function getConfigSource() { return configSource; }

  async function init() {
    if (location.protocol === 'http:' || location.protocol === 'https:') {
      try {
        const response = await fetch('/api/public-config', {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          cache: 'no-store'
        });
        if (response.ok) {
          const data = await response.json();
          if (data?.configured && data?.url && data?.key) {
            runtimeConfig = { url: data.url, key: data.key };
            configSource = 'vercel';
            sb = null;
            createSupabaseClient();
            return { configured: true, source: 'vercel' };
          }
        }
      } catch (err) {
        console.warn('Configuração automática indisponível:', err);
      }
    }

    const saved = getSavedConfig();
    if (saved?.url && saved?.key) {
      runtimeConfig = saved;
      configSource = 'local';
      sb = null;
      createSupabaseClient();
      return { configured: true, source: 'local' };
    }

    runtimeConfig = null;
    configSource = 'none';
    sb = null;
    return { configured: false, source: 'none' };
  }

  function createSupabaseClient() {
    const config = getConfig();
    if (!config?.url || !config?.key || !window.supabase?.createClient) return null;
    try {
      sb = window.supabase.createClient(config.url, config.key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });
      return sb;
    } catch {
      sb = null;
      return null;
    }
  }

  function getSupabase() { return sb || createSupabaseClient(); }
  function isOnlineMode() { return !!getSupabase(); }

  async function testConnection() {
    const client = getSupabase();
    if (!client) throw new Error('Configuração do Supabase indisponível.');
    const { error } = await client.from('setores').select('id').limit(1);
    if (error) throw error;
    return true;
  }

  async function getProfile(userId, email = '') {
    const client = getSupabase();
    const { data, error } = await client
      .from('profiles')
      .select('id,nome,role,setor_id,escola_id,ativo')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Perfil de acesso não encontrado. Procure o administrador do sistema.');
    if (data.ativo === false) throw new Error('Este usuário está inativo. Procure a Gerência ou o administrador.');
    return {
      id: userId,
      email,
      name: data.nome || email?.split('@')[0] || 'Usuário',
      role: data.role || 'tecnico',
      setor_id: data.setor_id || null,
      escola_id: data.escola_id || null,
      ativo: data.ativo !== false,
      online: true
    };
  }

  async function signIn(email, password) {
    const client = getSupabase();
    if (!client) throw new Error('Banco Supabase não configurado. O administrador deve configurar as variáveis do projeto na Vercel.');
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    try {
      return await getProfile(data.user.id, data.user.email);
    } catch (err) {
      await client.auth.signOut();
      throw err;
    }
  }

  async function signOut() {
    const client = getSupabase();
    if (client) await client.auth.signOut();
  }

  async function currentSession() {
    const client = getSupabase();
    if (!client) return null;
    const { data } = await client.auth.getUser();
    if (!data?.user) return null;
    try {
      return await getProfile(data.user.id, data.user.email);
    } catch {
      await client.auth.signOut();
      return null;
    }
  }

  const tableMap = {
    schools: 'escolas',
    transport: 'agendamentos_transporte',
    visits: 'visitas',
    management: 'acompanhamentos_gestao'
  };

  async function list(type) {
    const client = getSupabase();
    if (!client) throw new Error('Banco Supabase indisponível.');
    const table = tableMap[type];
    if (!table) throw new Error('Tipo de dado inválido.');
    const { data, error } = await client.from(table).select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function insert(type, record) {
    const client = getSupabase();
    if (!client) throw new Error('Banco Supabase indisponível.');
    const table = tableMap[type];
    if (!table) throw new Error('Tipo de dado inválido.');
    const { data, error } = await client.from(table).insert(record).select().single();
    if (error) throw error;
    return data;
  }


  async function listPublicTransport(accessKey) {
    const client = getSupabase();
    if (!client) throw new Error('Agenda indisponível.');
    if (!accessKey) throw new Error('Link de acesso inválido.');

    const { data, error } = await client.rpc('list_transport_motoristas', {
      access_key: accessKey
    });

    if (error) throw error;
    return data || [];
  }

  async function createTransport(record) {
    const client = getSupabase();
    if (!client) throw new Error('Banco Supabase indisponível.');

    const { data, error } = await client.rpc('create_transport_booking', {
      payload: record
    });

    if (error) throw error;
    return Array.isArray(data) ? (data[0] || null) : data;
  }

  async function update(type, id, patch) {
    const client = getSupabase();
    if (!client) throw new Error('Banco Supabase indisponível.');
    const table = tableMap[type];
    if (!table) throw new Error('Tipo de dado inválido.');
    const { data, error } = await client.from(table).update(patch).eq('id', id).select().single();
    if (error) throw error;
    return data;
  }

  async function remove(type, id) {
    const client = getSupabase();
    if (!client) throw new Error('Banco Supabase indisponível.');
    const table = tableMap[type];
    if (!table) throw new Error('Tipo de dado inválido.');
    const { error } = await client.from(table).delete().eq('id', id);
    if (error) throw error;
    return true;
  }

  async function listProfiles() {
    const client = getSupabase();
    if (!client) throw new Error('Banco Supabase indisponível.');
    const { data, error } = await client
      .from('profiles')
      .select('id,nome,role,setor_id,escola_id,ativo,created_at')
      .order('nome', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async function updateProfile(id, patch) {
    const client = getSupabase();
    if (!client) throw new Error('Banco Supabase indisponível.');
    const { data, error } = await client
      .from('profiles')
      .update(patch)
      .eq('id', id)
      .select('id,nome,role,setor_id,escola_id,ativo,created_at')
      .single();
    if (error) throw error;
    return data;
  }

  async function listSectors() {
    const client = getSupabase();
    if (!client) throw new Error('Banco Supabase indisponível.');
    const { data, error } = await client
      .from('setores')
      .select('id,nome,slug,ativo')
      .eq('ativo', true)
      .order('nome', { ascending: true });
    if (error) throw error;
    return data || [];
  }




  async function listIdebResults() {
    const client = getSupabase();
    if (!client) throw new Error('Serviço indisponível.');
    const { data, error } = await client
      .from('ideb_resultados')
      .select('*')
      .order('etapa', { ascending: true })
      .order('ano', { ascending: true })
      .order('escola_nome', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async function listIdebComposition() {
    const client = getSupabase();
    if (!client) throw new Error('Serviço indisponível.');
    const { data, error } = await client
      .from('ideb_composicao_gre')
      .select('resultado_id,incluida,updated_at');
    if (error) throw error;
    return data || [];
  }

  async function saveIdebComposition(items) {
    const client = getSupabase();
    if (!client) throw new Error('Serviço indisponível.');
    const user=(await client.auth.getUser()).data?.user;
    if(!user) throw new Error('Sessão expirada. Entre novamente.');
    if(!Array.isArray(items) || !items.length) return [];
    const payload=items.map(x=>({
      resultado_id:x.resultado_id,
      incluida:!!x.incluida,
      updated_by:user.id,
      updated_at:new Date().toISOString()
    }));
    const { data, error } = await client
      .from('ideb_composicao_gre')
      .upsert(payload,{onConflict:'resultado_id'})
      .select('resultado_id,incluida,updated_at');
    if(error) throw error;
    return data || [];
  }

  async function listClassReports() {
    const client = getSupabase();
    if (!client) throw new Error('Banco Supabase indisponível.');
    const { data, error } = await client.from('relatorios_aulas').select('*').order('data_referencia', { ascending: false }).order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function listClassItems(reportId) {
    const client = getSupabase();
    if (!client) throw new Error('Banco Supabase indisponível.');
    if (!reportId) return [];

    // O Supabase limita a quantidade de linhas retornadas por requisição.
    // Como o relatório do iSEDUC possui milhares de registros, buscamos
    // todas as páginas do resultado até terminar.
    const pageSize = 1000;
    let from = 0;
    const all = [];

    while (true) {
      const { data, error } = await client
        .from('aulas_relatorio_itens')
        .select('*')
        .eq('relatorio_id', reportId)
        .order('escola_nome', { ascending: true })
        .order('turma', { ascending: true })
        .order('disciplina', { ascending: true })
        .order('id', { ascending: true })
        .range(from, from + pageSize - 1);

      if (error) throw error;

      const page = data || [];
      all.push(...page);

      if (page.length < pageSize) break;
      from += pageSize;

      // Proteção contra loop indevido em caso de resposta anômala.
      if (from > 50000) {
        throw new Error('O relatório possui mais registros que o limite de segurança do Portal.');
      }
    }

    return all;
  }

  async function listTeacherMappings() {
    const client = getSupabase();
    if (!client) throw new Error('Banco Supabase indisponível.');
    const { data, error } = await client.from('aulas_professores').select('*').order('professor_nome');
    if (error) throw error;
    return data || [];
  }

  async function saveTeacherMapping(record) {
    const client = getSupabase();
    if (!client) throw new Error('Banco Supabase indisponível.');
    const payload={...record, updated_by:(await client.auth.getUser()).data?.user?.id||null};
    const { data, error } = await client.from('aulas_professores').upsert(payload,{onConflict:'escola_inep,id_turma,disciplina'}).select().single();
    if (error) throw error;
    return data;
  }

  async function saveClassImport(file, meta, rows) {
    const client = getSupabase();
    if (!client) throw new Error('Banco Supabase indisponível.');
    const user=(await client.auth.getUser()).data?.user;
    if(!user) throw new Error('Sessão expirada. Entre novamente.');
    const safe=(file.name||'relatorio.pdf').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9._-]+/g,'_');
    const path=`${meta.data_referencia}/${Date.now()}_${safe}`;
    const up=await client.storage.from('relatorios-aulas').upload(path,file,{contentType:'application/pdf',upsert:false});
    if(up.error) throw up.error;
    let report=null;
    try{
      const rep=await client.from('relatorios_aulas').insert({
        arquivo_nome:file.name,
        storage_path:path,
        data_referencia:meta.data_referencia,
        total_paginas:meta.total_paginas||0,
        total_registros:rows.length,
        total_escolas:meta.total_escolas||0,
        observacao:meta.observacao||null,
        uploaded_by:user.id
      }).select().single();
      if(rep.error) throw rep.error;
      report=rep.data;
      const prepared=rows.map(r=>({...r,relatorio_id:report.id}));
      for(let i=0;i<prepared.length;i+=400){
        const chunk=prepared.slice(i,i+400);
        const ins=await client.from('aulas_relatorio_itens').insert(chunk);
        if(ins.error) throw ins.error;
      }
      return report;
    }catch(err){
      await client.storage.from('relatorios-aulas').remove([path]);
      if(report?.id) await client.from('relatorios_aulas').delete().eq('id',report.id);
      throw err;
    }
  }

  async function getClassReportUrl(path) {
    const client = getSupabase();
    if (!client) throw new Error('Banco Supabase indisponível.');
    const { data, error } = await client.storage.from('relatorios-aulas').createSignedUrl(path, 600);
    if(error) throw error;
    return data?.signedUrl || null;
  }

  window.PortalStore = {
    init,
    getConfig,
    getConfigSource,
    setConfig,
    clearConfig,
    getSupabase,
    isOnlineMode,
    testConnection,
    signIn,
    signOut,
    currentSession,
    list,
    insert,
    createTransport,
    listPublicTransport,
    update,
    remove,
    listProfiles,
    updateProfile,
    listSectors,
    listIdebResults,
    listIdebComposition,
    saveIdebComposition,
    listClassReports,
    listClassItems,
    listTeacherMappings,
    saveTeacherMapping,
    saveClassImport,
    getClassReportUrl
  };
})();
