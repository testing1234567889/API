const crypto = require('crypto');

module.exports = async function handler(req, res) {
  // Support GET dan POST
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

  // Ambil params dari body (POST) atau query (GET)
  const params = method === 'POST' ? req.body : req.query;
  const { ref_id, player_id, server_id, kode_produk } = params || {};

  if (!ref_id || !player_id || !kode_produk) {
    return res.status(400).json({ error: 'Missing required fields: ref_id, player_id, kode_produk' });
  }

  try {
    let ifgResponse;

    if (method === 'GET') {
      // ── GET: semua param di URL termasuk SECRET langsung ──
      const url = new URL('https://api.www.ifgameshop.com/v1/transaksi');
      url.searchParams.set('user_code', user_code);
      url.searchParams.set('ref_id', ref_id);
      url.searchParams.set('player_id', player_id);
      url.searchParams.set('server_id', server_id || '');
      url.searchParams.set('kode_produk', kode_produk);
      url.searchParams.set('secret', secret_key);

      console.log('[ORDER GET] URL:', url.toString().replace(secret_key, '***'));
      ifgResponse = await fetch(url.toString());

    } else {
      // ── POST: signature MD5 di body ──
      const signature = crypto
        .createHash('md5')
        .update(`${user_code}:${secret_key}:${ref_id}`)
        .digest('hex');

      const body = {
        user_code,
        ref_id,
        player_id,
        server_id: server_id || '',
        kode_produk,
        signature
      };

      console.log('[ORDER POST] Body:', JSON.stringify({ ...body, signature: '***' }));
      ifgResponse = await fetch('https://api.www.ifgameshop.com/v1/transaksi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    }

    const data = await ifgResponse.json();
    console.log('[ORDER] Response IFGameshop:', JSON.stringify(data));
    return res.status(200).json(data);

  } catch (err) {
    console.error('[ORDER] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
