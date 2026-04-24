const crypto = require('crypto');

module.exports = async function handler(req, res) {
  const method = req.method;

  if (method !== 'GET' && method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Validasi internal API key
  const incomingKey = req.headers['x-api-key'];
  if (incomingKey !== process.env.INTERNAL_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const user_code = process.env.IFG_USER_CODE;
  const secret_key = process.env.IFG_SECRET_KEY;

  if (!user_code || !secret_key) {
    return res.status(500).json({ error: 'Server tidak dikonfigurasi' });
  }

  const params = method === 'POST' ? req.body : req.query;
  const { ref_id, player_id, server_id, kode_produk } = params || {};

  if (!ref_id || !player_id || !kode_produk) {
    return res.status(400).json({ error: 'Missing: ref_id, player_id, kode_produk' });
  }

  const signature = crypto
    .createHash('md5')
    .update(`${user_code}:${secret_key}:${ref_id}`)
    .digest('hex');

  const body = {
    user_code,
    ref_id,
    player_id: String(player_id),
    server_id: String(server_id || ''),
    kode_produk,
    signature,
  };

  console.log('[ORDER] Payload:', JSON.stringify({ ...body, signature: '***' }));

  const URLS = [
    'https://api.www.ifgameshop.com/v1/transaksi',
    'https://api.ifgameshop.com/v1/transaksi',
  ];

  let lastError = null;

  for (const url of URLS) {
    try {
      console.log('[ORDER] Mencoba:', url);
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      });

      const data = await response.json();
      console.log('[ORDER] Berhasil dari:', url, JSON.stringify(data));
      return res.status(200).json(data);

    } catch (err) {
      console.log('[ORDER] Gagal dari', url, ':', err.message);
      lastError = err;
    }
  }

  console.error('[ORDER] Semua URL gagal:', lastError?.message);
  return res.status(500).json({ error: 'Gagal menghubungi provider: ' + lastError?.message });
};
