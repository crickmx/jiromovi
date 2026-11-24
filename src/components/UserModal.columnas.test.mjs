// node src/components/UserModal.columnas.test.mjs
//
// El patrón #1 de este proyecto, en su forma más cara: el modal de usuario
// ESCRIBE una columna que nunca LEYÓ. El campo sale vacío en pantalla y, al
// guardar, el `|| null` de ese campo vacío se escribe encima del dato bueno.
//
// Ya mordió al menos cinco veces: `web_slug` ("fix(directorio): cargar slug
// personalizado"), `banco`/`clabe` (que por eso tienen su propio candado),
// `rol_id` (06/11) y, el 23/11, dieciséis de golpe — fecha de nacimiento,
// fecha de ingreso, régimen fiscal, días de vacaciones, extensión, equipo
// asignado y la ubicación.
//
// TypeScript no puede atrapar esto: la lista de columnas es una CADENA.
// Por eso la comprobación se hace sobre el texto de los archivos.
//
// La regla que vigila, que es la que se rompió:
//   una columna que se escribe FUERA del bloque `if (perfilCompletoCargado)`
//   tiene que venir en el `.select()` de la lista que abre el modal.

import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const aqui = dirname(fileURLToPath(import.meta.url));
const lee = (p) => readFileSync(join(aqui, p), 'utf8');

const modal = lee('./UserModal.tsx');

// ── Lo que la LISTA le pasa al modal ───────────────────────────────────────
const directorio = lee('../pages/Directorio.tsx');
const mSelect = directorio.match(/\.select\('(id, nombre, apellidos[^']*)'\)/);
assert.ok(mSelect, 'no se encontró el .select() de usuarios en Directorio.tsx');
const deLaLista = new Set(mSelect[1].split(',').map((c) => c.trim()));

// ── Lo que el modal ESCRIBE al editar ──────────────────────────────────────
const ini = modal.indexOf('const updateData: Partial<UsuarioModal> = {');
const fin = modal.indexOf('const updateRequest = {', ini);
assert.ok(ini !== -1 && fin > ini, 'no se encontró el bloque updateData; ¿se renombró?');
const trozo = modal.slice(ini, fin);

// Las del literal `{ ... }` y las de `updateData.x = ...`, separadas por si
// están dentro o fuera de la guarda.
const guarda = trozo.indexOf('if (perfilCompletoCargado) {');
assert.ok(
  guarda !== -1,
  'desapareció la guarda `if (perfilCompletoCargado)`: sin ella, una lectura fallida del perfil\n' +
  'vuelve a escribir null encima de las columnas que el modal no alcanzó a cargar.',
);
const fuera = trozo.slice(0, guarda);
const dentro = trozo.slice(guarda);

const columnasDe = (texto) => new Set([
  ...(texto.match(/^\s{10}(\w+):/gm) || []).map((l) => l.trim().replace(':', '')),
  ...(texto.match(/updateData\.(\w+) =/g) || []).map((l) => l.replace('updateData.', '').replace(' =', '')),
]);

const escritasFuera = columnasDe(fuera);
const escritasDentro = columnasDe(dentro);

// Lo que no tiene por qué venir en la lista:
const exentas = new Set([
  'updated_at', 'ubicacion_updated_at',  // marcas de tiempo, se ponen al vuelo
  'banco', 'clabe',                      // privadas (obtenerDatosPrivados) y con su propio candado
  'rol_id',                              // condicional: solo se manda si trae valor
  'imagen_perfil_url', 'mi_logotipo_url',// salen de la subida de archivos, no del formulario
]);

const sinRespaldo = [...escritasFuera].filter((c) => !deLaLista.has(c) && !exentas.has(c)).sort();

assert.deepStrictEqual(
  sinRespaldo, [],
  `\n\nEstas columnas se escriben SIN candado y la lista no las trae: ${sinRespaldo.join(', ')}.\n` +
  `Al guardar se irían en null/vacío encima del dato bueno.\n` +
  `Arreglo: muévelas dentro del bloque "if (perfilCompletoCargado)" de UserModal.tsx,\n` +
  `o agrégalas al .select() de Directorio.tsx (y a USUARIO_COLUMNAS si falta).\n`,
);

// Y lo de dentro de la guarda sí tiene que poder leerse del perfil completo.
const columnas = lee('../lib/usuarioColumnas.ts');
const legibles = new Set(
  (columnas.match(/export const USUARIO_COLUMNAS = \[([\s\S]*?)\]\.join/)[1].match(/'(\w+)'/g) || [])
    .map((c) => c.replaceAll("'", '')),
);
assert.ok(legibles.size > 40, 'no se pudo leer USUARIO_COLUMNAS; revisa el formato de la lista');

const noLegibles = [...escritasDentro].filter((c) => !legibles.has(c) && !exentas.has(c)).sort();
assert.deepStrictEqual(
  noLegibles, [],
  `\n\nEl modal lee el perfil con USUARIO_COLUMNAS, y estas no están ahí: ${noLegibles.join(', ')}.\n` +
  `Llegarían como undefined, el formulario las pintaría vacías y el guardado las borraría.\n` +
  `Agrégalas a USUARIO_COLUMNAS en src/lib/usuarioColumnas.ts y dales\n` +
  `"grant select (columna) on public.usuarios to authenticated;" en la base.\n`,
);

console.log(
  `UserModal — ok: ${escritasFuera.size} columnas sin candado, todas en el .select() de la lista; ` +
  `${escritasDentro.size} detrás de la guarda, todas en USUARIO_COLUMNAS.`,
);
