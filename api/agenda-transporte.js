export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ message: 'Método não permitido.' });
  }

  const access = typeof req.query?.acesso === 'string' ? req.query.acesso : '';
  if (!access) {
    return res.status(401).json({ message: 'Link de acesso inválido.' });
  }

  const supabaseUrl = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const supabaseKey = String(process.env.SUPABASE_PUBLISHABLE_KEY || '');

  if (!supabaseUrl || !supabaseKey) {
    return res.status(503).json({
      message: 'Configuração do banco não encontrada na Vercel.'
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/rpc/list_transport_motoristas`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'apikey': supabaseKey
        },
        body: JSON.stringify({ access_key: access }),
        signal: controller.signal
      }
    );

    const bodyText = await response.text();

    let body;
    try {
      body = bodyText ? JSON.parse(bodyText) : [];
    } catch {
      body = { message: bodyText || 'Resposta inválida do banco.' };
    }

    if (!response.ok) {
      const message =
        body?.message ||
        body?.error_description ||
        body?.hint ||
        `O banco respondeu com status ${response.status}.`;

      return res.status(response.status).json({
        message,
        status: response.status
      });
    }

    return res.status(200).json(Array.isArray(body) ? body : []);
  } catch (error) {
    const detail =
      error?.name === 'AbortError'
        ? 'Tempo de conexão com o banco excedido.'
        : (error?.message || 'Falha desconhecida de conexão.');

    console.error('Agenda 8ª GRE - conexão Supabase:', error);

    return res.status(502).json({
      message: `Falha de conexão com o banco: ${detail}`
    });
  } finally {
    clearTimeout(timeout);
  }
}
