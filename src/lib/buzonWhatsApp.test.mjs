// npx tsx src/lib/buzonWhatsApp.test.mjs
import assert from 'node:assert/strict';
import { filtrarConversaciones, contadores, noLeidosPorBuzon, esBuzon } from './buzonWhatsApp.ts';

const convs = [
  { id: 'm1', channel: 'wa_movi', status: 'open', unreadCount: 2, contactPhone: '5215512345678', lastMessage: 'Hola, quiero cotizar', nombre: 'José Pérez' },
  { id: 'm2', channel: 'wa_movi', status: 'open', unreadCount: 0, contactPhone: '5213311112222', lastMessage: 'Gracias', nombre: 'Ana' },
  { id: 'p1', channel: 'wa_personal', status: 'open', unreadCount: 1, contactPhone: '5598765432', lastMessage: 'Póliza lista', nombre: 'Luis' },
  { id: 'p2', channel: 'wa_personal', status: 'archived', unreadCount: 4, contactPhone: '5500000000', lastMessage: 'viejo', nombre: 'Archivado' },
];
const nombre = c => c.nombre;
const ids = l => l.map(c => c.id);
const f = (buzon, estado, busqueda = '') => ids(filtrarConversaciones(convs, { buzon, estado, busqueda, nombre }));

// Buzón
assert.deepEqual(f('all', 'open'), ['m1', 'm2', 'p1']);
assert.deepEqual(f('wa_movi', 'open'), ['m1', 'm2']);
assert.deepEqual(f('wa_personal', 'open'), ['p1']);
assert.deepEqual(f('wa_personal', 'archived'), ['p2']);
assert.deepEqual(f('wa_movi', 'archived'), [], 'WA MOVI no se archiva');

// No leídos: excluye archivadas aunque tengan pendientes
assert.deepEqual(f('all', 'unread'), ['m1', 'p1']);
assert.deepEqual(f('wa_movi', 'unread'), ['m1']);

// Búsqueda sin acentos, por teléfono con formato y por mensaje
assert.deepEqual(f('all', 'open', 'jose'), ['m1']);
assert.deepEqual(f('all', 'open', 'poliza'), ['p1']);
assert.deepEqual(f('all', 'open', '55 1234'), ['m1']);
assert.deepEqual(f('wa_personal', 'open', 'jose'), [], 'la búsqueda respeta el buzón');

// Contadores del buzón elegido (no de todo)
assert.deepEqual(contadores(convs, 'wa_movi'), { abiertas: 2, conNoLeidos: 1, mensajesNoLeidos: 2, archivadas: 0 });
assert.deepEqual(contadores(convs, 'all'), { abiertas: 3, conNoLeidos: 2, mensajesNoLeidos: 3, archivadas: 1 });
assert.deepEqual(noLeidosPorBuzon(convs), { all: 2, wa_movi: 1, wa_personal: 1 });

assert.equal(esBuzon('wa_movi'), true);
assert.equal(esBuzon('chat'), false);
console.log('buzonWhatsApp: OK');
