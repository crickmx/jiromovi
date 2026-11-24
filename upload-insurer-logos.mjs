/**
 * Downloads insurer logos and uploads them to Supabase Storage.
 * Uses Wikimedia REST API for Wikipedia-hosted SVGs.
 * Run: node upload-insurer-logos.mjs
 */
import https from 'https';
import http from 'http';

const SUPABASE_URL = 'https://qhwvuuyjhcennqccgvse.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFod3Z1dXlqaGNlbm5xY2NndnNlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTcyMDk5MCwiZXhwIjoyMDc3Mjk2OTkwfQ.lmkRTcDPdTCpw4EAaljO-BFwfOA2_CO1ztFG_RWV0NE';

/**
 * Convert a Wikimedia Commons file page URL to its direct media URL
 * e.g. https://upload.wikimedia.org/wikipedia/commons/7/72/GNP_Seguros_logo.svg
 * → https://commons.wikimedia.org/wiki/Special:FilePath/GNP_Seguros_logo.svg
 */
function toWikimediaDirectUrl(url) {
  const match = url.match(/upload\.wikimedia\.org\/wikipedia\/commons\/[a-f0-9]\/[a-f0-9]{2}\/(.+)$/);
  if (match) {
    const filename = decodeURIComponent(match[1]);
    return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}`;
  }
  return url;
}

const LOGOS = [
  { id: 'ac35d819-93e2-455e-bff1-35743ba3f7e8', name: 'GNP Seguros',       file: 'gnp-seguros',      url: 'https://upload.wikimedia.org/wikipedia/commons/7/72/GNP_Seguros_logo.svg' },
  { id: '2db95286-2212-4b46-964d-5b1cb0cc5a07', name: 'AXA Seguros',       file: 'axa-seguros',      url: 'https://upload.wikimedia.org/wikipedia/commons/9/9e/AXA_Logo.svg' },
  { id: 'f997367b-96b7-42c9-871f-0ab6d8419e7d', name: 'Qualitas Seguros',  file: 'qualitas-seguros', url: 'https://upload.wikimedia.org/wikipedia/commons/3/32/Qualitas_Controladora_logo.svg' },
  { id: '34b1eedc-571a-436e-a937-502dc82b8554', name: 'Chubb Seguros',     file: 'chubb-seguros',    url: 'https://upload.wikimedia.org/wikipedia/commons/d/d1/Chubb_logo.svg' },
  { id: 'ccceaf69-96d6-4740-bc44-4da7fcd8b0d9', name: 'MAPFRE Mexico',     file: 'mapfre-mexico',    url: 'https://upload.wikimedia.org/wikipedia/commons/7/7e/Mapfre-logo.svg' },
  { id: '3698995f-361f-4cea-bf3d-a2996e59671b', name: 'HDI Seguros',       file: 'hdi-seguros',      url: 'https://upload.wikimedia.org/wikipedia/commons/b/bb/HDI_logo.svg' },
  { id: '33f31365-34d9-45ad-b91e-b9d2c001aada', name: 'Zurich Seguros',    file: 'zurich-seguros',   url: 'https://upload.wikimedia.org/wikipedia/commons/d/d0/Zurich_Insurance_Group_logo.svg' },
  { id: 'c432515d-aea0-4b6a-a3f0-5884f8af1224', name: 'MetLife Mexico',    file: 'metlife-mexico',   url: 'https://upload.wikimedia.org/wikipedia/commons/1/13/MetLife_logo_2016.svg' },
  { id: 'bc703421-53ef-4abb-b3cc-a186aaa52ac5', name: 'Allianz Mexico',    file: 'allianz-mexico',   url: 'https://upload.wikimedia.org/wikipedia/commons/1/13/Allianz_SE_logo.svg' },
  { id: '78970335-5489-4c76-826d-e2e26de33c67', name: 'Seguros Atlas',     file: 'seguros-atlas',    url: 'https://upload.wikimedia.org/wikipedia/commons/8/8d/Seguros_Atlas_logo.png' },
  { id: '41fa84b1-bb3d-4527-a2fb-2e5a9e95c73d', name: 'Seguros SURA',     file: 'seguros-sura',     url: 'https://upload.wikimedia.org/wikipedia/commons/5/5c/SURA_Asset_Management_logo.svg' },
  { id: 'fa6ffb3e-e8ea-4fb1-ae89-c99faa21776f', name: 'Bupa Mexico',       file: 'bupa-mexico',      url: 'https://upload.wikimedia.org/wikipedia/commons/a/a3/Bupa_logo.svg' },
  { id: '9800c450-22ce-4c5b-b060-3d6fee993b71', name: 'ANA Seguros',       file: 'ana-seguros',      url: 'https://upload.wikimedia.org/wikipedia/commons/6/69/ANA_Seguros_logo.png' },
  { id: 'b890ca44-0247-40dc-8c90-be4ce71f8a85', name: 'Inbursa Seguros',   file: 'inbursa-seguros',  url: 'https://upload.wikimedia.org/wikipedia/commons/0/0e/Grupo_Financiero_Inbursa_logo.svg' },
  { id: 'f4e40b45-249e-47f3-82f2-61c932b0b819', name: 'Banorte Seguros',   file: 'banorte-seguros',  url: 'https://upload.wikimedia.org/wikipedia/commons/8/89/Banorte_logo.svg' },
  { id: '9fd3c4cf-3562-4386-ae51-7639e147e263', name: 'BX+ Fianzas',       file: 'bxplus-fianzas',   url: 'https://upload.wikimedia.org/wikipedia/commons/e/e8/BX%2B_logo.svg' },
  { id: '961d8d33-afb2-41bb-a96f-baed9967bfcb', name: 'Liberty Fianzas',   file: 'liberty-fianzas',  url: 'https://upload.wikimedia.org/wikipedia/commons/6/62/Liberty_Mutual_logo.svg' },
  { id: '8aefd852-21ad-428d-b05b-c9110f93ddab', name: 'Afirme Seguros',    file: 'afirme-seguros',   url: 'https://upload.wikimedia.org/wikipedia/commons/7/72/Afirme_logo.svg' },
  { id: '2b5dbbef-68c5-4a38-ad30-61af4372b9bf', name: 'Mutuus',            file: 'mutuus-salud',     url: 'https://mutuus.mx/wp-content/uploads/2021/06/logo-mutuus.svg', skipSslVerify: true },
  { id: '03d84da7-13d0-4ac0-8c7f-1e300a7c56df', name: 'Dentegra',          file: 'dentegra-seguros', url: 'https://www.dentegra.com.mx/hubfs/logo-dentegra.svg', skipSslVerify: true },
  { id: '846e7ff2-eb9c-4d37-b1f3-17e219ee9c14', name: 'Aserta',            file: 'aserta-seguros',   url: 'https://www.aserta.com.mx/wp-content/uploads/2020/07/logo-aserta.svg', skipSslVerify: true },
  { id: '5ce06c08-fa10-4151-aaea-ade9474a6356', name: 'Insignia Life',     file: 'insignia-life',    url: 'https://www.insignialife.com.mx/wp-content/themes/insignia/assets/images/logo.svg', skipSslVerify: true },
  { id: '059cf958-9293-43c6-959b-579c284c2021', name: 'Proteccion Mutua',  file: 'proteccion-mutua', url: 'https://proteccionmutua.com.mx/wp-content/uploads/2020/08/logo.png', skipSslVerify: true },
  { id: '19f8a2d4-05b9-4ffe-8071-aa8807506f5c', name: 'HIR Seguros',       file: 'hir-seguros',      url: 'https://hirseguros.mx/wp-content/uploads/2021/03/logo-hir.svg', skipSslVerify: true },
  { id: '48f62fe2-04e4-4901-b827-6bf5bfa9b9ed', name: 'Thona Seguros',     file: 'thona-seguros',    url: 'https://thonaseguros.mx/wp-content/uploads/2023/05/logo-thona.svg', skipSslVerify: true },
  { id: '2f5494d3-828b-4a19-8279-b44833813590', name: 'Dorama Seguros',    file: 'dorama-seguros',   url: 'https://www.dorama.com.mx/assets/img/logo.png', skipSslVerify: true },
];

function fetchUrl(url, redirectCount = 0, skipSslVerify = false) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 8) return reject(new Error('Too many redirects'));

    // Convert Wikimedia upload URLs to Special:FilePath for proper redirect
    const fetchUrl = toWikimediaDirectUrl(url);

    const lib = fetchUrl.startsWith('https') ? https : http;
    const opts = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/svg+xml,image/png,image/jpeg,image/*,*/*;q=0.8',
        'Accept-Language': 'es-MX,es;q=0.9,en;q=0.8',
        'Referer': 'https://app.movi.digital/',
      },
      timeout: 20000,
    };
    if (skipSslVerify) opts.rejectUnauthorized = false;

    const req = lib.get(fetchUrl, opts, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let loc = res.headers.location;
        if (loc.startsWith('/')) {
          try { const u = new URL(fetchUrl); loc = u.origin + loc; } catch {}
        }
        res.resume();
        return resolve(fetchUrl(loc, redirectCount + 1, skipSslVerify));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} from ${fetchUrl}`));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ buffer: Buffer.concat(chunks), contentType: res.headers['content-type'] || 'image/png' }));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

// Follow redirects manually (for Special:FilePath which redirects to actual file)
async function fetchWithRedirects(startUrl, skipSslVerify = false, depth = 0) {
  if (depth > 8) throw new Error('Too many redirects');
  return new Promise((resolve, reject) => {
    const resolvedUrl = toWikimediaDirectUrl(startUrl);
    const lib = resolvedUrl.startsWith('https') ? https : http;
    const opts = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/svg+xml,image/png,image/jpeg,image/*,*/*;q=0.9',
        'Accept-Language': 'es-MX,es;q=0.9,en;q=0.8',
      },
      timeout: 25000,
    };
    if (skipSslVerify) opts.rejectUnauthorized = false;

    lib.get(resolvedUrl, opts, (res) => {
      if (res.statusCode >= 301 && res.statusCode <= 308 && res.headers.location) {
        let next = res.headers.location;
        if (next.startsWith('/')) {
          try { const u = new URL(resolvedUrl); next = u.origin + next; } catch {}
        }
        res.resume();
        resolve(fetchWithRedirects(next, skipSslVerify, depth + 1));
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ buffer: Buffer.concat(chunks), contentType: res.headers['content-type'] || 'application/octet-stream' }));
      res.on('error', reject);
    }).on('error', reject).on('timeout', function() { this.destroy(); reject(new Error('Timeout')); });
  });
}

async function uploadToStorage(storagePath, buffer, contentType) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/insurance-carriers-logos/${storagePath}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': contentType,
      'x-upsert': 'true',
    },
    body: buffer,
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`Storage ${res.status}: ${t}`); }
}

async function updateDb(id, storagePath) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/seguwallet_insurers?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'apikey': SERVICE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({ logo_local_path: storagePath, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`DB ${res.status}: ${t}`); }
}

const EXT_MAP = { 'image/svg+xml': 'svg', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/webp': 'webp' };
function guessExt(contentType, url) {
  const mime = contentType.split(';')[0].trim();
  if (EXT_MAP[mime]) return EXT_MAP[mime];
  if (url.toLowerCase().endsWith('.svg')) return 'svg';
  if (url.toLowerCase().endsWith('.png')) return 'png';
  return 'png';
}

const results = { ok: [], failed: [] };

for (const logo of LOGOS) {
  process.stdout.write(`  ${logo.name.padEnd(32)} → `);
  try {
    const { buffer, contentType } = await fetchWithRedirects(logo.url, logo.skipSslVerify || false);
    const ext = guessExt(contentType, logo.url);
    const storagePath = `logos/${logo.file}.${ext}`;
    await uploadToStorage(storagePath, buffer, contentType.split(';')[0].trim() || 'image/png');
    await updateDb(logo.id, storagePath);
    console.log(`OK  logos/${logo.file}.${ext}  (${(buffer.length/1024).toFixed(1)}KB)`);
    results.ok.push({ name: logo.name, path: storagePath });
  } catch (err) {
    console.log(`FAIL  ${err.message}`);
    results.failed.push({ name: logo.name, error: err.message });
  }
}

console.log('\n=== SUMMARY ===');
console.log(`OK:   ${results.ok.length} / ${LOGOS.length}`);
if (results.failed.length > 0) {
  console.log(`FAIL: ${results.failed.length}`);
  results.failed.forEach(f => console.log(`  - ${f.name}: ${f.error}`));
}
