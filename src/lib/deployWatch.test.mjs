// Autocomprobación del seguimiento del build.
//   npx tsx src/lib/deployWatch.test.mjs
//
// Lo delicado es el caso de "no respondió": durante un deploy el servidor se
// reinicia y las peticiones fallan. Si eso se tomara como error, la pantalla
// diría que algo salió mal justo cuando todo va bien.

import assert from 'node:assert/strict';
import { estadoDeBuild, huellaDeBuild, ESPERA_MAXIMA_MS, puedeSeguirse } from './deployWatch.ts';

const previo = '1000';

// Todavía el mismo commit: sigue esperando.
assert.equal(estadoDeBuild({ huellaPrevia: previo, remoto: { version: previo }, transcurridoMs: 30_000 }), 'esperando');

// El servidor no contesta (se está reiniciando): sigue esperando, no es error.
assert.equal(estadoDeBuild({ huellaPrevia: previo, remoto: null, transcurridoMs: 30_000 }), 'esperando');

// Commit nuevo: terminó.
assert.equal(estadoDeBuild({ huellaPrevia: previo, remoto: { version: '2000' }, transcurridoMs: 90_000 }), 'listo');

// Terminó aunque se haya pasado del tiempo: lo que manda es el commit.
assert.equal(estadoDeBuild({ huellaPrevia: previo, remoto: { version: '2000' }, transcurridoMs: ESPERA_MAXIMA_MS + 1 }), 'listo');

// Se acabó la espera y el sitio responde pero con el commit viejo.
assert.equal(estadoDeBuild({ huellaPrevia: previo, remoto: { version: previo }, transcurridoMs: ESPERA_MAXIMA_MS }), 'tardo_demasiado');

// Se acabó la espera y el sitio nunca respondió: es otra cosa, y se dice distinto.
assert.equal(estadoDeBuild({ huellaPrevia: previo, remoto: null, transcurridoMs: ESPERA_MAXIMA_MS }), 'sin_respuesta');

// Sin commit previo conocido, cualquier commit remoto ya es señal de build nuevo.
assert.equal(estadoDeBuild({ huellaPrevia: null, remoto: { version: '3000' }, transcurridoMs: 0 }), 'listo');

// Un version.json sin commitHash no puede confirmar nada.
assert.equal(estadoDeBuild({ huellaPrevia: previo, remoto: {}, transcurridoMs: 10_000 }), 'esperando');

// ── El caso que lo rompía: redesplegar SIN commits nuevos ───────────────────
// El commit no cambia, pero `version` sí (es Date.now() del build). Antes esto
// se quedaba en "esperando" hasta rendirse, con el build ya terminado.
assert.equal(
  estadoDeBuild({ huellaPrevia: '1000', remoto: { version: '2000', commitHash: 'mismo' }, transcurridoMs: 60_000 }),
  'listo',
  'mismo commit pero build nuevo: debe darse por terminado',
);
// Y el mismo build no se confunde con uno nuevo.
assert.equal(
  estadoDeBuild({ huellaPrevia: '1000', remoto: { version: '1000', commitHash: 'mismo' }, transcurridoMs: 60_000 }),
  'esperando',
);

// La huella prefiere `version`; `commitHash` es solo respaldo de builds viejos.
assert.equal(huellaDeBuild({ version: '7', commitHash: 'abc' }), '7');
assert.equal(huellaDeBuild({ commitHash: 'abc' }), 'abc');
assert.equal(huellaDeBuild(null), null);
assert.equal(huellaDeBuild({}), null);

// Solo se sigue el sitio en el que estás parado.
assert.equal(puedeSeguirse('beta', 'beta.movi.digital'), true);
assert.equal(puedeSeguirse('produccion', 'beta.movi.digital'), false);
assert.equal(puedeSeguirse('produccion', 'movi.digital'), true);
// Producción vive en app.movi.digital; movi.digital a secas es el WordPress.
assert.equal(puedeSeguirse('produccion', 'app.movi.digital'), true);
assert.equal(puedeSeguirse('beta', 'app.movi.digital'), false);
assert.equal(puedeSeguirse('beta', 'localhost'), false);

console.log('✓ deployWatch: un servidor que no contesta a media construcción no se confunde con un error');
