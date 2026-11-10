// Identificación del contacto de WhatsApp — debe seguir igual tras el rediseño.
//   npx tsx src/lib/unifiedContactCenter.test.mjs
import assert from 'node:assert/strict';
import { buildContactNameMap, normalizeMexicanPhone, resolveNameByPhone } from './unifiedContactCenter.ts';

assert.equal(normalizeMexicanPhone('+52 1 55 1234 5678'), '5512345678');
assert.equal(normalizeMexicanPhone('525512345678'), '5512345678');
assert.equal(normalizeMexicanPhone('55-1234-5678'), '5512345678');

// Prioridad: CRM > usuario interno > nombre de WhatsApp
const map = buildContactNameMap(
  [{ celular: '5512345678', nombre_completo: 'Cliente CRM' }],
  [
    { contact_phone: '5215512345678', contact_name: 'pushName A' },
    { contact_phone: '5213300000000', metadata: { pushName: 'Solo WhatsApp' } },
    { contact_phone: '5214400000000', contact_name: 'pushName vendedor' },
  ],
  [
    { celular_laboral: '+52 55 1234 5678', nombre: 'Interno', apellidos: 'Pisa CRM' },
    { celular_laboral: '4400000000', nombre: 'Vendedora', apellidos: 'Interna' },
  ],
);
assert.equal(resolveNameByPhone('5215512345678', map), 'Cliente CRM', 'CRM gana');
assert.equal(resolveNameByPhone('524400000000', map), 'Vendedora Interna', 'usuario interno gana a WhatsApp');
assert.equal(resolveNameByPhone('3300000000', map), 'Solo WhatsApp');
assert.equal(resolveNameByPhone('9999999999', map), null, 'sin identificar → null, sin error');
console.log('unifiedContactCenter: OK');
