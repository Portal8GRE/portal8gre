export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  const url = process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || '';

  if (!url || !key) {
    return res.status(503).json({
      configured: false,
      message: 'Supabase ainda não foi configurado nas variáveis de ambiente da Vercel.'
    });
  }

  return res.status(200).json({
    configured: true,
    url,
    key
  });
}
