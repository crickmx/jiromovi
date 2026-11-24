// npx tsx src/lib/cobroDesglose.test.mjs
import assert from 'node:assert';
import { desglosarFormaPago, planDeCobro, pesos } from './cobroDesglose.ts';

// La forma de pago de Store trae los dos datos pegados.
assert.deepStrictEqual(desglosarFormaPago('3 Quincenal'), { parcialidades: 3, frecuencia: 'Quincenal' });
assert.deepStrictEqual(desglosarFormaPago('12 Meses'), { parcialidades: 12, frecuencia: 'Meses' });
assert.deepStrictEqual(desglosarFormaPago('Contado'), { parcialidades: 1, frecuencia: null });
assert.deepStrictEqual(desglosarFormaPago(''), { parcialidades: 1, frecuencia: null });
assert.deepStrictEqual(desglosarFormaPago(null), { parcialidades: 1, frecuencia: null });
// Valor viejo sin frecuencia real: mejor nada que "cada Parcialidades".
assert.deepStrictEqual(desglosarFormaPago('2 Parcialidades'), { parcialidades: 2, frecuencia: null });

// Los centavos tienen que cuadrar: 2000 entre 3 no da redondo.
const p3 = planDeCobro(2000, 3, 'Quincenal');
assert.strictEqual(p3.montoPorParcialidad, 666.66);
assert.strictEqual(p3.ultimaParcialidad, 666.68);
assert.strictEqual(p3.ultimaAjusta, true);
assert.strictEqual(
  Math.round((p3.montoPorParcialidad * 2 + p3.ultimaParcialidad) * 100), 200000,
  'la suma de las parcialidades tiene que dar el total exacto',
);

// Cuando sí cuadra, no se inventa un ajuste.
const p4 = planDeCobro(2000, 4, 'Mensual');
assert.strictEqual(p4.montoPorParcialidad, 500);
assert.strictEqual(p4.ultimaAjusta, false);

// Un pago único no se parte.
const p1 = planDeCobro(200, 1);
assert.strictEqual(p1.montoPorParcialidad, 200);
assert.strictEqual(p1.ultimaAjusta, false);

// Cero o basura no truena ni divide entre cero.
assert.strictEqual(planDeCobro(100, 0).parcialidades, 1);
assert.strictEqual(planDeCobro(0, 3).montoPorParcialidad, 0);

assert.strictEqual(pesos(2000), '$2,000.00');
assert.strictEqual(pesos(666.6), '$666.60');

console.log('✓ cobroDesglose: las parcialidades suman el total exacto y la forma de pago se lee igual en los dos módulos');
