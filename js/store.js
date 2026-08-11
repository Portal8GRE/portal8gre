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

  async function update(type, id, patch) {
    const client = getSupabase();
    if (!client) throw new Error('Banco Supabase indisponível.');
    const table = tableMap[type];
    if (!table) throw new Error('Tipo de dado inválido.');
    const { data, error } = await client.from(table).update(patch).eq('id', id).select().single();
    if (error) throw error;
    return data;
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
    update,
    listProfiles,
    updateProfile,
    listSectors
  };
})();
