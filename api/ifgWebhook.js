const crypto = require('crypto');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const payload = req.body;
    const authHeader = req.headers['authorization'] || '';
    const { ref_id, status, trx_id, sn, message, sisa_saldo, price } = payload || {};

    console.log('[WEBHOOK] ref_id:', ref_id, 'status:', status);
    console.log('[WEBHOOK] payload:', JSON.stringify(payload));

    if (!ref_id || !status) {
      return res.status(400).json({ error: 'Missing ref_id or status' });
    }

    const user_code = process.env.IFG_USER_CODE;
    const secret_key = process.env.IFG_SECRET_KEY;

    if (!user_code || !secret_key) {
      return res.status(500).json({ error: 'Server not configured' });
    }

    const expectedSig = crypto.createHash('md5')
      .update(`${user_code}:${secret_key}:${ref_id}`)
      .digest('hex');

    const received = authHeader.replace(/^Bearer\s+/i, '').trim().toLowerCase();

    if (received !== expectedSig.toLowerCase()) {
      console.log('[WEBHOOK] Auth gagal. Expected:', expectedSig, 'Got:', authHeader);
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log('[WEBHOOK] Auth OK! Transaksi', ref_id, '->', status);
    return res.status(200).json({ status: 'ok' });

  } catch (err) {
    console.error('[WEBHOOK] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
