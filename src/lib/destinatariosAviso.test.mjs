// Autocomprobación de a quién se le avisa.
//   npx tsx src/lib/destinatariosAviso.test.mjs
//
// Lo que se protege: que nadie quede sin aviso y que nadie lo reciba dos veces.
// Un error aquí no da ningún síntoma — solo alguien que no se enteró.

import assert from 'node:assert/strict';
import { destinatariosDelAviso } from './destinatariosAviso.ts';

const personas = {
  solicitanteId: 'sol',
  responsableId: 'resp',
  liderEquipoId: 'lider',
  listaFija: ['fija1', 'fija2'],
};

// Sin configurar: vacío, para que quien llama use su camino de siempre.
assert.deepEqual(destinatariosDelAviso([], personas), []);
assert.deepEqual(destinatariosDelAviso(null, personas), []);

// Cada papel por separado.
assert.deepEqual(destinatariosDelAviso(['solicitante'], personas), ['sol']);
assert.deepEqual(destinatariosDelAviso(['responsable'], personas), ['resp']);
assert.deepEqual(destinatariosDelAviso(['lista_fija'], personas), ['fija1', 'fija2']);

// El líder es RESPALDO: con responsable puesto, no entra.
assert.deepEqual(destinatariosDelAviso(['responsable', 'lider_equipo'], personas), ['resp']);
// Sin responsable, sí.
assert.deepEqual(
  destinatariosDelAviso(['responsable', 'lider_equipo'], { ...personas, responsableId: null }),
  ['lider'],
);

// La misma persona en dos papeles sale una vez.
assert.deepEqual(
  destinatariosDelAviso(['solicitante', 'responsable'], { solicitanteId: 'x', responsableId: 'x' }),
  ['x'],
);

// Papeles configurados cuya persona no existe no inventan destinatarios.
assert.deepEqual(destinatariosDelAviso(['solicitante'], { solicitanteId: null }), []);

console.log('✓ destinatariosAviso: el líder es respaldo, nadie se repite, vacío no significa "a nadie"');
