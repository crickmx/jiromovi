// Uso: SUPABASE_SERVICE_KEY=<service_role_key> node scripts/upload-brandkit.mjs
// Obtén el service role key en: Supabase Dashboard → Settings → API → service_role

import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';

// Leer VITE_SUPABASE_URL de .env.local automáticamente
const envPath = new URL('../.env.local', import.meta.url).pathname;
if (existsSync(envPath)) {
  readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
    const eq = line.indexOf('=');
    if (eq === -1) return;
    const k = line.slice(0, eq).trim();
    const v = line.slice(eq + 1).trim();
    if (k && !process.env[k]) process.env[k] = v;
  });
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('\n❌ Faltan variables de entorno.');
  console.error('   Uso: SUPABASE_SERVICE_KEY=eyJ... node scripts/upload-brandkit.mjs');
  console.error('   Obtén el service_role key en: Supabase Dashboard → Settings → API\n');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const BUCKET = 'recursos-marca';
const SRC = join(process.env.HOME, 'Downloads/brandkit');

const MIME = {
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg':  'image/svg+xml',
  '.pdf':  'application/pdf',
  '.zip':  'application/zip',
  '.ttf':  'font/ttf',
  '.otf':  'font/otf',
};

async function ensureBucket() {
  const { error } = await supabase.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: 52428800,
    allowedMimeTypes: [...Object.values(MIME), 'application/octet-stream'],
  });
  if (error && !/already exist/i.test(error.message ?? '')) throw error;
  console.log(`✓ Bucket "${BUCKET}" listo`);
}

async function uploadFile(localPath, bucketPath) {
  const content = readFileSync(localPath);
  const ct = MIME[extname(localPath).toLowerCase()] ?? 'application/octet-stream';
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(bucketPath, content, { contentType: ct, upsert: true });
  if (error) { console.error(`  ✗ ${bucketPath}: ${error.message}`); return false; }
  console.log(`  ✓ ${bucketPath}`);
  return true;
}

async function uploadDir(localSub, bucketPrefix) {
  const dir = join(SRC, localSub);
  if (!existsSync(dir)) { console.log(`  (no encontrado: ${localSub})`); return { ok: 0, fail: 0 }; }
  const files = readdirSync(dir).filter(f => !f.startsWith('.'));
  console.log(`\n📁 ${localSub}/ → ${bucketPrefix}  (${files.length} archivos)`);
  let ok = 0, fail = 0;
  for (const f of files) {
    if (await uploadFile(join(dir, f), `${bucketPrefix}${f}`)) ok++; else fail++;
  }
  return { ok, fail };
}

async function main() {
  console.log(`\n🚀 Subiendo Brand Kit JIRO\n   Destino: ${SUPABASE_URL}\n   Origen:   ${SRC}\n`);

  await ensureBucket();

  const results = await Promise.all([
    uploadDir('logos', 'logos/'),
    uploadDir('icons', 'iconos/'),
    uploadDir('fonts', 'fuentes/'),
  ]);

  const palettePath = join(SRC, 'paleta-original.png');
  if (existsSync(palettePath)) {
    console.log('\n🎨 Paleta de color');
    await uploadFile(palettePath, 'otros/paleta-original.png');
  }

  const ok   = results.reduce((s, r) => s + r.ok,   0);
  const fail = results.reduce((s, r) => s + r.fail, 0);

  console.log(`\n${'─'.repeat(52)}`);
  console.log(`✅ ${ok} archivos subidos${fail ? `  ⚠️  ${fail} fallidos` : ''}`);
  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SIGUIENTE PASO — ejecuta en Supabase Dashboard → SQL Editor:

create policy "recursos-marca authenticated"
on storage.objects to authenticated
using  (bucket_id = 'recursos-marca')
with check (bucket_id = 'recursos-marca');

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
}

main().catch(e => { console.error('\n❌', e.message); process.exit(1); });
