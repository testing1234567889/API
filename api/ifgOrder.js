// Coba beberapa URL IFGameshop
const IFG_URLS = [
  'https://api.ifgameshop.com/v1/transaksi',
  'https://www.ifgameshop.com/api/v1/transaksi',
  'https://api.www.ifgameshop.com/v1/transaksi'
];

let data = null;
let lastError = null;

for (const url of IFG_URLS) {
  try {
    console.log('[ORDER] Mencoba URL:', url);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000) // timeout 10 detik per URL
    });
    data = await response.json();
    console.log('[ORDER] Berhasil via:', url, JSON.stringify(data));
    break; // Kalau berhasil, stop loop
  } catch (err) {
    console.log('[ORDER] Gagal via', url, ':', err.message);
    lastError = err;
  }
}

if (!data) {
  throw new Error(`Semua URL gagal. Error terakhir: ${lastError?.message}`);
}

return res.status(200).json(data);
