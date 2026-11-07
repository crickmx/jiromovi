#!/usr/bin/env node
/**
 * Compila la parte web para una app nativa y la copia a su proyecto iOS/Android.
 *
 *   node scripts/native/build.mjs <movi|seguwallet> [sync|copy|open-ios|open-android]
 *
 * - Compila con VITE_APP_TARGET=<app> (App.tsx ya no depende del dominio).
 * - NO corre el postbuild web (no toca dist_backup, que es del deploy de Plesk).
 * - Luego `cap sync` (o copy/open) con CAP_APP=<app>, que elige el proyecto
 *   nativo correcto en native/<app>/ (ver capacitor.config.ts).
 *
 * Las variables VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY salen del .env igual
 * que en la build web. Sin ellas la app compila pero no puede iniciar sesión.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const [app, accion = 'sync'] = process.argv.slice(2);
if (!['movi', 'seguwallet'].includes(app)) {
  console.error('Uso: node scripts/native/build.mjs <movi|seguwallet> [sync|copy|open-ios|open-android]');
  process.exit(1);
}

const env = { ...process.env, VITE_APP_TARGET: app, CAP_APP: app };

function run(cmd, args) {
  console.log(`\n▶ ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, { stdio: 'inherit', env, shell: process.platform === 'win32' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

if (!existsSync('.env') && !process.env.VITE_SUPABASE_URL) {
  console.warn('⚠️  No hay .env ni VITE_SUPABASE_URL: la app no podrá conectarse a Supabase.');
}

if (accion === 'open-ios') { run('npx', ['cap', 'open', 'ios']); process.exit(0); }
if (accion === 'open-android') { run('npx', ['cap', 'open', 'android']); process.exit(0); }

run('node', ['--max-old-space-size=4096', 'node_modules/vite/bin/vite.js', 'build']);
run('npx', ['cap', accion === 'copy' ? 'copy' : 'sync']);
console.log(`\n✅ ${app}: web compilada y copiada a native/${app}/`);
