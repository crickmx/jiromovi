// npx tsx supabase/functions/ionos-webmail/lotes.test.mjs
import assert from 'node:assert/strict';
import { enLotes, uidsDe, llegoAlTope, LIMITE_POR_MINUTO, UIDS_POR_COMANDO } from './lotes.ts';

// ── enLotes ────────────────────────────────────────────────────────
assert.deepEqual(enLotes([], 3), [], 'sin elementos no hay lotes');
assert.deepEqual(enLotes([1, 2, 3], 3), [[1, 2, 3]]);
assert.deepEqual(enLotes([1, 2, 3, 4], 3), [[1, 2, 3], [4]], 'el sobrante va en su propio lote');

// Un lote de exactamente el tope no se parte en dos.
assert.equal(enLotes(Array.from({ length: UIDS_POR_COMANDO }, (_, i) => i + 1), UIDS_POR_COMANDO).length, 1);
// Uno más sí.
assert.equal(enLotes(Array.from({ length: UIDS_POR_COMANDO + 1 }, (_, i) => i + 1), UIDS_POR_COMANDO).length, 2);
// Los trozos, juntos otra vez, son la entrada completa y en el mismo orden.
const muchos = Array.from({ length: 1000 }, (_, i) => i + 1);
assert.deepEqual(enLotes(muchos, UIDS_POR_COMANDO).flat(), muchos);

// ── uidsDe ─────────────────────────────────────────────────────────
// Lote (lo que manda el gestor hoy).
assert.deepEqual(uidsDe({ uids: [4, 8, 15] }), [4, 8, 15]);
// Uid suelto (clientes anteriores: la lista de correos, una carpeta a la vez).
assert.deepEqual(uidsDe({ uid: 7 }), [7]);
// El lote manda cuando vienen los dos.
assert.deepEqual(uidsDe({ uid: 7, uids: [1, 2] }), [1, 2]);
// Basura fuera, sin mandar nada raro al servidor.
assert.deepEqual(uidsDe({ uids: [0, -3, 'x', null, undefined, 1.5, '12', 9] }), [12, 9]);
assert.deepEqual(uidsDe({ uids: '8' }), [], 'una cadena no es un lote');
assert.deepEqual(uidsDe({}), []);
// El caso que rompía la pantalla: uid 0 (falsy) no es un UID.
assert.deepEqual(uidsDe({ uid: 0 }), []);

// ── llegoAlTope ────────────────────────────────────────────────────
assert.equal(llegoAlTope(0), false);
assert.equal(llegoAlTope(LIMITE_POR_MINUTO - 1), false);
assert.equal(llegoAlTope(LIMITE_POR_MINUTO), true, 'el tope se alcanza al llegar, no al pasar');
assert.equal(llegoAlTope(LIMITE_POR_MINUTO + 50), true);
// Si la tabla no existe, `count` llega en null y la función pasa 0: deja pasar.
assert.equal(llegoAlTope(0), false);

console.log('lotes: OK');
