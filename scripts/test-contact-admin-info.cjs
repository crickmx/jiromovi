const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'src/pages/ContactosCRM.tsx'), 'utf8');
const types = fs.readFileSync(path.join(root, 'src/lib/contactosTypes.ts'), 'utf8');
const migrationPath = path.join(root, 'supabase/migrations/20260903000000_contactos_admin_agente_oficina.sql');

test('the unified contact contract includes agent and office labels', () => {
  assert.match(types, /agente_nombre:\s*string \| null/);
  assert.match(types, /oficina_nombre:\s*string \| null/);
});

test('only administrators receive the ownership column and cards block', () => {
  assert.match(page, /isAdmin\s*&&\s*\(\s*<th[^>]*>Agente \/ Oficina<\/th>/s);
  assert.match(page, /isAdmin\s*&&\s*\(\s*<td[^>]*>[\s\S]*?c\.agente_nombre[\s\S]*?c\.oficina_nombre[\s\S]*?<\/td>/s);
  assert.match(page, /isAdmin\s*&&[\s\S]*?Agente[\s\S]*?c\.agente_nombre[\s\S]*?Oficina[\s\S]*?c\.oficina_nombre/s);
});

test('the RPC resolves ownership and only exposes it to administrators', () => {
  assert.ok(fs.existsSync(migrationPath), 'ownership RPC migration must exist');
  const migration = fs.readFileSync(migrationPath, 'utf8');
  assert.match(migration, /LEFT JOIN usuarios[^\n]+owner/i);
  assert.match(migration, /LEFT JOIN oficinas[^\n]+office/i);
  assert.match(migration, /CASE WHEN v_rol = 'Administrador' THEN[\s\S]*?owner\.nombre_completo/s);
  assert.match(migration, /CASE WHEN v_rol = 'Administrador' THEN[\s\S]*?office\.nombre/s);
});
