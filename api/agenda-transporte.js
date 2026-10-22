const SUPABASE_URL = 'https://ovgjufzykmkorlibipg.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_M6yFvMRUFUqWENePWlOzag_rASAXtPk';

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

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/list_transport_motoristas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'apikey': SUPABASE_PUBLISHABLE_KEY
      },
      body: JSON.stringify({ access_key: access })
    });

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
        `Supabase respondeu com status ${response.status}.`;

      return res.status(response.status).json({ message });
    }

    return res.status(200).json(Array.isArray(body) ? body : []);
  } catch (error) {
    console.error('Agenda 8ª GRE - falha ao consultar Supabase:', error);
    return res.status(502).json({
      message: 'O Portal não conseguiu consultar o banco de agendamentos.'
    });
  }
}
