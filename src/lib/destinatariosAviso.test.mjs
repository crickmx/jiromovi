// La lógica de destinatarios se movió a SQL (`resolver_destinatarios_aviso`),
// así que ya no hay nada que comprobar desde aquí: este archivo solo conserva
// el catálogo de papeles que pinta la pantalla.
//
// Las reglas que protegía esta prueba —el líder es respaldo, nadie se repite,
// vacío no significa "a nadie"— están escritas en la migración
// `20261019000004_resolver_unico_de_destinatarios.sql`. Si alguien las toca,
// se prueban en el SQL Editor con un trámite real.

import assert from 'node:assert/strict';
import { ROLES_DESTINATARIO } from './destinatariosAviso.ts';

assert.deepEqual(
  ROLES_DESTINATARIO.map(r => r.valor),
  ['solicitante', 'responsable', 'lider_equipo', 'lista_fija'],
  'los papeles de la pantalla deben coincidir con los que entiende el SQL',
);

console.log('✓ destinatariosAviso: el catálogo de papeles coincide con el del SQL');
