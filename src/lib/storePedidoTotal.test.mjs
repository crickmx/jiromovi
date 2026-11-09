// npx tsx src/lib/storePedidoTotal.test.mjs
import assert from 'node:assert';
import { importeArticulos, totalDelPedido } from './storePedidoTotal.ts';

const dos = [
  { cantidad: 2, precio_unitario: 325 },
  { cantidad: 1, precio_unitario: 150 },
];

// Lo de siempre: artículos solos.
assert.strictEqual(importeArticulos(dos), 800);

// Sin envío, el total es idéntico a lo que calculaba cada copia antes del
// 09/11. Si esto cambia, todos los pedidos existentes cambiaron de monto.
assert.strictEqual(totalDelPedido(dos), 800);
assert.strictEqual(totalDelPedido(dos, 0), 800);
assert.strictEqual(totalDelPedido(dos, null), 800);
assert.strictEqual(totalDelPedido(dos, undefined), 800);

// Y con envío, SUMA. Es el pedido entero de Ricardo del 09/11.
assert.strictEqual(totalDelPedido(dos, 185.5), 985.5);

// PostgREST devuelve numeric como texto. Si no se convierte, "185.50" se
// concatena en vez de sumarse y el total sale 800185.5 sin dar ningún error.
assert.strictEqual(totalDelPedido([{ cantidad: 2, precio_unitario: '325.00' }], '185.50'), 835.5);

// Los centavos. 19.99 x 3 en flotante da 59.97000000000001, y `estado_pago`
// compara con tolerancia de un centavo: sin redondear, un pedido pagado al
// exacto puede salir "debe".
assert.strictEqual(importeArticulos([{ cantidad: 3, precio_unitario: 19.99 }]), 59.97);
assert.strictEqual(totalDelPedido([{ cantidad: 3, precio_unitario: 19.99 }], 0.1), 60.07);

// Un pedido sin renglones no es un error, es un pedido en $0 — pero si trae
// envío capturado, ese sí se cobra.
assert.strictEqual(totalDelPedido([]), 0);
assert.strictEqual(totalDelPedido(null), 0);
assert.strictEqual(totalDelPedido(undefined, 120), 120);

// Basura en la base no debe volverse NaN: un NaN se propaga callado hasta el
// PDF y sale "$NaN" en la Orden de Compra.
assert.strictEqual(totalDelPedido([{ cantidad: null, precio_unitario: null }], 'abc'), 0);
assert.strictEqual(totalDelPedido([{ cantidad: 2 }], 50), 50);

console.log('storePedidoTotal: ok');
