const crypto = require('crypto');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const payload = req.body;
    const authHeader = req.headers['authorization'] || '';
    const { ref_id, status, trx_id, sn, message, sisa_saldo, price } = payload || {};

    console.log('[WEBHOOK] Diterima:', JSON.stringify(payload));

    // ── 1. Validasi field wajib ──
    if (!ref_id || !status) {
      return res.status(400).json({ error: 'Missing ref_id or status' });
    }

    // ── 2. Ambil env variables ──
    const user_code = process.env.IFG_USER_CODE;
    const secret_key = process.env.IFG_SECRET_KEY;
    const internal_api_key = process.env.INTERNAL_API_KEY;
    const app_id = '69eae6c9e023d4c0d1b0b40d';

    if (!user_code || !secret_key || !internal_api_key) {
      console.error('[WEBHOOK] Env variables belum diisi!');
      return res.status(500).json({ error: 'Server not configured' });
    }

    // ── 3. Verifikasi signature dari IFGameshop ──
    const expectedSig = crypto
      .createHash('md5')
      .update(`${user_code}:${secret_key}:${ref_id}`)
      .digest('hex');

    const received = authHeader.replace(/^Bearer\s+/i, '').trim().toLowerCase();

    if (received !== expectedSig.toLowerCase()) {
      console.log('[WEBHOOK] Auth GAGAL. Expected:', expectedSig, 'Got:', authHeader);
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log('[WEBHOOK] Auth OK! ref_id:', ref_id, 'status:', status);

    // ── 4. Update transaksi di Base44 ──
    const updateRes = await fetch(
      `https://app.base44.com/api/apps/${app_id}/functions/updateTransaction`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': internal_api_key
        },
        body: JSON.stringify({
          ref_id,
          status: /sukses/i.test(String(status)) ? 'Sukses' : 'Gagal',
          trx_id: trx_id || '',
          sn: sn || '',
          message: message || '',
          sisa_saldo: sisa_saldo ? Number(sisa_saldo) : 0,
          price: price ? Number(price) : 0
        })
      }
    );

    const updateData = await updateRes.json();
    console.log('[WEBHOOK] Base44 response:', updateRes.status, JSON.stringify(updateData));

    if (!updateRes.ok) {
      console.error('[WEBHOOK] Gagal update Base44:', updateData);
    }

    // ── 5. Selalu return 200 agar IFGameshop tidak retry ──
    return res.status(200).json({ status: 'ok' });

  } catch (err) {
    console.error('[WEBHOOK] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
