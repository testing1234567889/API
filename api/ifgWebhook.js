import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { createHash } from 'node:crypto';

// Webhook endpoint called by IFGameshop when a transaction finishes.
// Register this function's public URL in IFGameshop dashboard.
// Auth: Authorization header must equal MD5(user_code:secret_key:ref_id).
Deno.serve(async (req) => {
  try {
    // ── 1. Parse body ──
let payload = {};
const rawText = await req.text();
console.log('[WEBHOOK] Raw body:', rawText);
console.log('[WEBHOOK] Headers:', JSON.stringify(Object.fromEntries(req.headers)));

try {
  payload = JSON.parse(rawText);
} catch {
  // Coba parse form-data/urlencoded
  const params = new URLSearchParams(rawText);
  for (const [k, v] of params) payload[k] = v;
}
console.log('[WEBHOOK] Parsed payload:', JSON.stringify(payload));

    // ── 2. Required fields ──
    if (!ref_id || !status) {
      console.log('[WEBHOOK] Bad request: missing ref_id or status');
      return Response.json({ error: 'Bad Request: missing fields' }, { status: 400 });
    }

    // ── 3. Verify signature ──
    const user_code = Deno.env.get('IFG_USER_CODE');
    const secret_key = Deno.env.get('IFG_SECRET_KEY');
    if (!user_code || !secret_key) {
      return Response.json({ error: 'Server not configured' }, { status: 500 });
    }
    const expectedSignature = createHash('md5')
      .update(`${user_code}:${secret_key}:${ref_id}`)
      .digest('hex');

    // Accept with or without "Bearer " prefix, case-insensitive compare
    const received = authHeader.replace(/^Bearer\s+/i, '').trim().toLowerCase();
    if (received !== expectedSignature.toLowerCase()) {
      console.log(`[WEBHOOK] Auth gagal. Expected: ${expectedSignature}, Got: ${authHeader}`);
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── 4. Find transaction ──
    const base44 = createClientFromRequest(req);
    const txns = await base44.asServiceRole.entities.Transaction.filter({ ref_id });
    if (!txns || txns.length === 0) {
      console.log(`[WEBHOOK] Transaksi tidak ditemukan untuk ref_id: ${ref_id}`);
      return Response.json({ error: 'Transaction not found' }, { status: 404 });
    }
    const txn = txns[0];

    // ── 5. Idempotency: skip if already final ──
    if (txn.status === 'Sukses' || txn.status === 'Gagal') {
      console.log(`[WEBHOOK] Transaksi ${ref_id} sudah final (${txn.status}), skip.`);
      return Response.json({ status: 'ok', note: 'already processed' });
    }

    // ── 6. Update based on provider status ──
    const update = {};
    if (/sukses/i.test(String(status))) {
      update.status = 'Sukses';
      if (trx_id) update.trx_id = String(trx_id);
      if (sn) update.sn = String(sn);
      if (price !== undefined) update.cost = Number(price);
      if (sisa_saldo !== undefined) update.sisa_saldo = Number(sisa_saldo);
      if (message) update.message = String(message);
      console.log(`[WEBHOOK] Transaksi ${ref_id} berhasil. SN: ${sn}`);
    } else if (/gagal/i.test(String(status))) {
      update.status = 'Gagal';
      if (message) update.message = String(message);
      if (sisa_saldo !== undefined) update.sisa_saldo = Number(sisa_saldo);
      console.log(`[WEBHOOK] Transaksi ${ref_id} gagal. Pesan: ${message}`);
    } else {
      console.log(`[WEBHOOK] Status tidak dikenal: ${status}, biarkan pending.`);
    }

    if (Object.keys(update).length > 0) {
      await base44.asServiceRole.entities.Transaction.update(txn.id, update);
    }

    // Refresh cached provider saldo jika ada
    if (sisa_saldo !== undefined) {
      try {
        const existing = await base44.asServiceRole.entities.SaldoProvider.list('-created_date', 1);
        const patch = {
          sisa_saldo: Number(sisa_saldo),
          last_checked_at: new Date().toISOString(),
          last_message: 'From webhook',
        };
        if (existing && existing.length > 0) {
          await base44.asServiceRole.entities.SaldoProvider.update(existing[0].id, patch);
        } else {
          await base44.asServiceRole.entities.SaldoProvider.create(patch);
        }
      } catch (e) { console.error('saldo cache update failed', e); }
    }

    // ── 7. Always 200 to prevent retries ──
    return Response.json({ status: 'ok' });
  } catch (error) {
    console.error('[WEBHOOK] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});