// Autocomprobación del seguimiento del build.
//   npx tsx src/lib/deployWatch.test.mjs
//
// Lo delicado es el caso de "no respondió": durante un deploy el servidor se
// reinicia y las peticiones fallan. Si eso se tomara como error, la pantalla
// diría que algo salió mal justo cuando todo va bien.

import assert from 'node:assert/strict';
import { estadoDeBuild, ESPERA_MAXIMA_MS, puedeSeguirse } from './deployWatch.ts';

const previo = 'aaa111';

// Todavía el mismo commit: sigue esperando.
assert.equal(estadoDeBuild({ commitPrevio: previo, remoto: { commitHash: previo }, transcurridoMs: 30_000 }), 'esperando');

// El servidor no contesta (se está reiniciando): sigue esperando, no es error.
assert.equal(estadoDeBuild({ commitPrevio: previo, remoto: null, transcurridoMs: 30_000 }), 'esperando');

// Commit nuevo: terminó.
assert.equal(estadoDeBuild({ commitPrevio: previo, remoto: { commitHash: 'bbb222' }, transcurridoMs: 90_000 }), 'listo');

// Terminó aunque se haya pasado del tiempo: lo que manda es el commit.
assert.equal(estadoDeBuild({ commitPrevio: previo, remoto: { commitHash: 'bbb222' }, transcurridoMs: ESPERA_MAXIMA_MS + 1 }), 'listo');

// Se acabó la espera y el sitio responde pero con el commit viejo.
assert.equal(estadoDeBuild({ commitPrevio: previo, remoto: { commitHash: previo }, transcurridoMs: ESPERA_MAXIMA_MS }), 'tardo_demasiado');

// Se acabó la espera y el sitio nunca respondió: es otra cosa, y se dice distinto.
assert.equal(estadoDeBuild({ commitPrevio: previo, remoto: null, transcurridoMs: ESPERA_MAXIMA_MS }), 'sin_respuesta');

// Sin commit previo conocido, cualquier commit remoto ya es señal de build nuevo.
assert.equal(estadoDeBuild({ commitPrevio: null, remoto: { commitHash: 'ccc333' }, transcurridoMs: 0 }), 'listo');

// Un version.json sin commitHash no puede confirmar nada.
assert.equal(estadoDeBuild({ commitPrevio: previo, remoto: {}, transcurridoMs: 10_000 }), 'esperando');

// Solo se sigue el sitio en el que estás parado.
assert.equal(puedeSeguirse('beta', 'beta.movi.digital'), true);
assert.equal(puedeSeguirse('produccion', 'beta.movi.digital'), false);
assert.equal(puedeSeguirse('produccion', 'movi.digital'), true);
// Producción vive en app.movi.digital; movi.digital a secas es el WordPress.
assert.equal(puedeSeguirse('produccion', 'app.movi.digital'), true);
assert.equal(puedeSeguirse('beta', 'app.movi.digital'), false);
assert.equal(puedeSeguirse('beta', 'localhost'), false);

console.log('✓ deployWatch: un servidor que no contesta a media construcción no se confunde con un error');
