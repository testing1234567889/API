const crypto = require('crypto');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { ref_id, player_id, server_id, kode_produk } = req.body || {};

  // Validasi internal API key
  const incomingKey = req.headers['x-api-key'];
  if (incomingKey !== process.env.INTERNAL_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!ref_id || !player_id || !kode_produk) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const user_code = process.env.IFG_USER_CODE;
  const secret_key = process.env.IFG_SECRET_KEY;

  // Generate signature MD5
  const signature = crypto
    .createHash('md5')
    .update(`${user_code}:${secret_key}:${ref_id}`)
    .digest('hex');

  try {
    console.log('[ORDER] Kirim ke IFGameshop:', { ref_id, player_id, server_id, kode_produk });

    const response = await fetch('https://api.www.ifgameshop.com/v1/transaksi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_code,
        ref_id,
        player_id,
        server_id: server_id || '',
        kode_produk,
        signature
      })
    });

    const data = await response.json();
    console.log('[ORDER] Response IFGameshop:', JSON.stringify(data));

    return res.status(200).json(data);

  } catch (err) {
    console.error('[ORDER] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
