// npx tsx src/components/ErrorBoundary.test.mjs
import assert from 'node:assert';
import { esErrorDeCarga } from './ErrorBoundary.tsx';

// El que Ricardo vio el 09/11 en beta, con una pestaña abierta desde antes de
// un despliegue. Firefox lo redacta así; Chrome dice otra cosa.
assert.ok(esErrorDeCarga(new TypeError(`can't access property "default", u._result is undefined`)));
assert.ok(esErrorDeCarga(new TypeError("Cannot read properties of undefined (reading 'default')" + ' _result')));
assert.ok(esErrorDeCarga(new TypeError('undefined is not an object (evaluating \'u._result.default\')')));

// Los de siempre, que ya funcionaban. Si alguno deja de entrar, la recarga
// automática se apagó para el caso más común.
assert.ok(esErrorDeCarga(new Error('Failed to fetch dynamically imported module: https://beta.movi.digital/_static/Deploy-abc.js')));
assert.ok(esErrorDeCarga(new Error('Loading chunk 42 failed.')));
assert.ok(esErrorDeCarga(new Error('error loading dynamically imported module')));
assert.ok(esErrorDeCarga(new Error('Importing a module script failed.')));
const chunk = new Error('algo'); chunk.name = 'ChunkLoadError';
assert.ok(esErrorDeCarga(chunk));
assert.ok(esErrorDeCarga('Failed to fetch dynamically imported module'), 'también acepta un string suelto');

// Y lo que NO debe recargar: un error de verdad de la app. Recargar ahí esconde
// el bug y le quita al usuario el mensaje que sirve para reportarlo.
assert.ok(!esErrorDeCarga(new TypeError("can't access property 'nombre' of undefined")));
assert.ok(!esErrorDeCarga(new Error('No se pudo guardar el pedido: permission denied')));
assert.ok(!esErrorDeCarga(new TypeError('pedido.detalle is undefined')));
assert.ok(!esErrorDeCarga(new Error('NetworkError when attempting to fetch resource.')));
assert.ok(!esErrorDeCarga(undefined));
assert.ok(!esErrorDeCarga(null));

console.log('esErrorDeCarga: ok');
