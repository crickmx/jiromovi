const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'src/pages/ContactosCRM.tsx'), 'utf8');
const types = fs.readFileSync(path.join(root, 'src/lib/contactosTypes.ts'), 'utf8');
const ownershipMigrationPath = path.join(root, 'supabase/migrations/20260903000001_contactos_propietario_obligatorio.sql');
const migrationPath = path.join(root, 'supabase/migrations/20260903000002_contactos_admin_agente_oficina_propietario.sql');

test('the unified contact contract includes agent and office labels', () => {
  assert.match(types, /agente_nombre:\s*string \| null/);
  assert.match(types, /oficina_nombre:\s*string \| null/);
});

test('only administrators receive the ownership column and cards block', () => {
  assert.match(page, /isAdmin\s*&&\s*\(\s*<th[^>]*>Agente \/ Oficina<\/th>/s);
  assert.match(page, /isAdmin\s*&&\s*\(\s*<td[^>]*>[\s\S]*?c\.agente_nombre[\s\S]*?c\.oficina_nombre[\s\S]*?<\/td>/s);
  assert.match(page, /isAdmin\s*&&[\s\S]*?Agente[\s\S]*?c\.agente_nombre[\s\S]*?Oficina[\s\S]*?c\.oficina_nombre/s);
});

test('every CRM contact gets an explicit owner and office', () => {
  assert.ok(fs.existsSync(ownershipMigrationPath), 'mandatory ownership migration must exist');
  const migration = fs.readFileSync(ownershipMigrationPath, 'utf8');
  assert.match(migration, /ADD COLUMN IF NOT EXISTS agente_id uuid/i);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS oficina_id uuid/i);
  assert.match(migration, /COALESCE\(NEW\.agente_id, NEW\.creado_por, auth\.uid\(\)\)/i);
  assert.match(migration, /NEW\.oficina_id := v_oficina_id/i);
  assert.match(migration, /ALTER COLUMN agente_id SET NOT NULL/i);
  assert.match(migration, /ALTER COLUMN oficina_id SET NOT NULL/i);
  assert.match(migration, /BEFORE INSERT OR UPDATE OF agente_id, creado_por/i);
  assert.match(migration, /trg_crm_contactos_creator_immutable/i);
  assert.match(migration, /USING \(agente_id = \(SELECT auth\.uid\(\)\)\)/i);
});

test('assigned leads transfer the contact to the assigned agent', () => {
  const migration = fs.readFileSync(ownershipMigrationPath, 'utf8');
  assert.match(migration, /express_leads[\s\S]*?agente_asignado_id[\s\S]*?crm_contacto_id/s);
  assert.match(migration, /UPDATE public\.crm_contactos[\s\S]*?agente_id = NEW\.agente_asignado_id/s);
});

test('the RPC resolves the explicit owner and office and only exposes labels to administrators', () => {
  assert.ok(fs.existsSync(migrationPath), 'ownership RPC migration must exist');
  const migration = fs.readFileSync(migrationPath, 'utf8');
  assert.match(migration, /LEFT JOIN usuarios owner ON owner\.id = c\.agente_id/i);
  assert.match(migration, /LEFT JOIN oficinas office ON office\.id = c\.oficina_id/i);
  assert.match(migration, /CASE WHEN v_rol = 'Administrador' THEN[\s\S]*?owner\.nombre_completo/s);
  assert.match(migration, /CASE WHEN v_rol = 'Administrador' THEN[\s\S]*?office\.nombre/s);
});
