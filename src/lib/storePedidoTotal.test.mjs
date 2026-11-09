// npx tsx src/lib/storePedidoTotal.test.mjs
import assert from 'node:assert';
import { importeArticulos, importeCargos, totalDelPedido } from './storePedidoTotal.ts';

const dos = [
  { cantidad: 2, precio_unitario: 325 },
  { cantidad: 1, precio_unitario: 150 },
];

// Lo de siempre: artículos solos.
assert.strictEqual(importeArticulos(dos), 800);

// Sin cargos, el total es idéntico a lo que calculaba cada copia antes del
// 09/11. Si esto cambia, todos los pedidos existentes cambiaron de monto.
assert.strictEqual(totalDelPedido(dos), 800);
assert.strictEqual(totalDelPedido(dos, []), 800);
assert.strictEqual(totalDelPedido(dos, null), 800);
assert.strictEqual(totalDelPedido(dos, undefined), 800);

// Un cargo: el envío de siempre.
assert.strictEqual(totalDelPedido(dos, [{ monto: 185.5 }]), 985.5);

// Y VARIOS, que es lo que pidió Ricardo: envío + producción express + lo que
// surja. Antes esto era una sola columna y no cabía más de uno.
assert.strictEqual(
  totalDelPedido(dos, [{ monto: 185.5 }, { monto: 400 }, { monto: 60.25 }]),
  1445.75,
);
assert.strictEqual(importeCargos([{ monto: 185.5 }, { monto: 400 }]), 585.5);
assert.strictEqual(importeCargos([]), 0);
assert.strictEqual(importeCargos(null), 0);

// PostgREST devuelve numeric como texto. Si no se convierte, "185.50" se
// concatena en vez de sumarse y el total sale 800185.5 sin dar ningún error.
assert.strictEqual(
  totalDelPedido([{ cantidad: 2, precio_unitario: '325.00' }], [{ monto: '185.50' }]),
  835.5,
);

// Los centavos. 19.99 x 3 en flotante da 59.97000000000001, y `estado_pago`
// compara con tolerancia de un centavo: sin redondear, un pedido pagado al
// exacto puede salir "debe".
assert.strictEqual(importeArticulos([{ cantidad: 3, precio_unitario: 19.99 }]), 59.97);
assert.strictEqual(totalDelPedido([{ cantidad: 3, precio_unitario: 19.99 }], [{ monto: 0.1 }]), 60.07);
// Y varios cargos con centavos sucios tienen que cuadrar igual.
assert.strictEqual(importeCargos([{ monto: 0.1 }, { monto: 0.2 }]), 0.3);

// Un pedido sin renglones no es un error, es un pedido en $0 — pero si trae
// cargos capturados, esos sí se cobran.
assert.strictEqual(totalDelPedido([]), 0);
assert.strictEqual(totalDelPedido(null), 0);
assert.strictEqual(totalDelPedido(undefined, [{ monto: 120 }]), 120);

// Basura en la base no debe volverse NaN: un NaN se propaga callado hasta el
// PDF y sale "$NaN" en la Orden de Compra.
assert.strictEqual(totalDelPedido([{ cantidad: null, precio_unitario: null }], [{ monto: 'abc' }]), 0);
assert.strictEqual(totalDelPedido([{ cantidad: 2 }], [{ monto: 50 }]), 50);
assert.strictEqual(importeCargos([{ monto: null }, { monto: 30 }]), 30);

console.log('storePedidoTotal: ok');
