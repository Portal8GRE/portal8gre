(() => {
  const STORAGE_KEY = 'portal8gre_v01_data';
  const CONFIG_KEY = 'portal8gre_supabase_config';
  const SESSION_KEY = 'portal8gre_demo_session';

  const seed = {
    schools: [],
    transport: [],
    visits: [],
    management: []
  };

  let runtimeConfig = null;
  let configSource = 'none';
  let sb = null;

  function readLocal() {
    try {
      return { ...seed, ...(JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}) };
    } catch {
      return structuredClone(seed);
    }
  }

  function writeLocal(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function getSavedConfig() {
    try { return JSON.parse(localStorage.getItem(CONFIG_KEY)) || null; } catch { return null; }
  }

  function getConfig() {
    return runtimeConfig || getSavedConfig();
  }

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
    // Em produção na Vercel, a configuração é carregada automaticamente
    // de /api/public-config, alimentado pelas Environment Variables do projeto.
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

  function getDemoSession() {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)) || null; } catch { return null; }
  }

  function setDemoSession(session) { sessionStorage.setItem(SESSION_KEY, JSON.stringify(session)); }
  function clearDemoSession() { sessionStorage.removeItem(SESSION_KEY); }

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

  async function signIn(email, password) {
    const client = getSupabase();
    if (!client) throw new Error('Banco Supabase não configurado. O administrador deve configurar as variáveis do projeto na Vercel.');
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const { data: profileData } = await client.from('profiles').select('id,nome,role,setor_id').eq('id', data.user.id).maybeSingle();
    return {
      id: data.user.id,
      email: data.user.email,
      name: profileData?.nome || data.user.email?.split('@')[0] || 'Usuário',
      role: profileData?.role || 'tecnico',
      setor_id: profileData?.setor_id || null,
      online: true
    };
  }

  async function signOut() {
    const client = getSupabase();
    if (client) await client.auth.signOut();
    clearDemoSession();
  }

  async function currentSession() {
    const demo = getDemoSession();
    if (demo) return demo;
    const client = getSupabase();
    if (!client) return null;
    const { data } = await client.auth.getUser();
    if (!data?.user) return null;
    const { data: profileData } = await client.from('profiles').select('id,nome,role,setor_id').eq('id', data.user.id).maybeSingle();
    return {
      id: data.user.id,
      email: data.user.email,
      name: profileData?.nome || data.user.email?.split('@')[0] || 'Usuário',
      role: profileData?.role || 'tecnico',
      setor_id: profileData?.setor_id || null,
      online: true
    };
  }

  const tableMap = {
    schools: 'escolas',
    transport: 'agendamentos_transporte',
    visits: 'visitas',
    management: 'acompanhamentos_gestao'
  };

  async function list(type) {
    const client = getSupabase();
    if (!client) return readLocal()[type] || [];
    const table = tableMap[type];
    const { data, error } = await client.from(table).select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function insert(type, record) {
    const client = getSupabase();
    if (!client) {
      const data = readLocal();
      const item = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...record };
      data[type].unshift(item);
      writeLocal(data);
      return item;
    }
    const table = tableMap[type];
    const { data, error } = await client.from(table).insert(record).select().single();
    if (error) throw error;
    return data;
  }

  async function update(type, id, patch) {
    const client = getSupabase();
    if (!client) {
      const data = readLocal();
      const idx = data[type].findIndex(x => x.id === id);
      if (idx >= 0) data[type][idx] = { ...data[type][idx], ...patch, updated_at: new Date().toISOString() };
      writeLocal(data);
      return data[type][idx];
    }
    const table = tableMap[type];
    const { data, error } = await client.from(table).update(patch).eq('id', id).select().single();
    if (error) throw error;
    return data;
  }

  async function remove(type, id) {
    const client = getSupabase();
    if (!client) {
      const data = readLocal();
      data[type] = data[type].filter(x => x.id !== id);
      writeLocal(data);
      return;
    }
    const table = tableMap[type];
    const { error } = await client.from(table).delete().eq('id', id);
    if (error) throw error;
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
    setDemoSession,
    clearDemoSession,
    list,
    insert,
    update,
    remove
  };
})();
