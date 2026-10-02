// Autocomprobación de las cuentas del Plan Premium.
//   npx tsx src/lib/mktPremiumPagos.test.mjs
//
// Un saldo mal calculado no da ningún síntoma: se ve como un número cualquiera.
// Por eso se comprueba justo lo que puede salir mal sin que nadie lo note —los
// centavos de redondeo y los montos que llegan como texto desde Postgres.

import assert from 'node:assert/strict';
import { totalPagado, montoDelPlan, cobrosDelPlan, saldoPremium, PRECIO_PREMIUM, COBROS_DEL_PERIODO } from './mktPremiumPagos.ts';

// ── Postgres devuelve `numeric` como texto ─────────────────────────────────
assert.equal(totalPagado([{ monto: '200.00' }, { monto: '150.50' }]), 350.5);
assert.equal(totalPagado([{ monto: 200 }, { monto: '150.5' }]), 350.5);
assert.equal(totalPagado([]), 0);
// Un valor basura no debe tumbar la suma ni contar como NaN.
assert.equal(totalPagado([{ monto: 'x' }, { monto: 100 }]), 100);

// El precio del plan es por COBRO, no por periodo: el mensual son 12 de $200.
assert.equal(montoDelPlan('mensual'), 2400, '$200 al mes durante 12 meses');
assert.equal(montoDelPlan('mensual'), PRECIO_PREMIUM.mensual * COBROS_DEL_PERIODO.mensual);
assert.equal(montoDelPlan('anual'), 2000, 'el anual se cobra una vez al año');
assert.equal(montoDelPlan(null), 0);

// El calendario del mensual no lo cambia el campo de parcialidades.
assert.equal(cobrosDelPlan('mensual'), 12);
assert.equal(cobrosDelPlan('mensual', 3), 12, 'el mensual son 12 meses aunque alguien escriba otra cosa');
// El anual sí se difiere.
assert.equal(cobrosDelPlan('anual'), 1);
assert.equal(cobrosDelPlan('anual', 4), 4);
assert.equal(cobrosDelPlan('anual', 0), 1, 'cero parcialidades no divide entre cero');
assert.equal(cobrosDelPlan(null), 1);

// ── Sin plan no hay cuenta que hacer ───────────────────────────────────────
{
  const s = saldoPremium(null, [{ monto: 500 }]);
  assert.equal(s.estado, 'sin_plan');
  assert.equal(s.saldo, 0, 'sin plan no se puede deber nada');
  assert.equal(s.pagado, 500, 'pero lo pagado sí se sigue viendo');
}

// ── Debe, al corriente, a favor ────────────────────────────────────────────
assert.equal(saldoPremium('anual', []).estado, 'debe');
assert.equal(saldoPremium('anual', []).saldo, 2000);
assert.equal(saldoPremium('anual', [{ monto: 2000 }]).estado, 'al_corriente');
assert.equal(saldoPremium('anual', [{ monto: 2500 }]).estado, 'a_favor');
assert.equal(saldoPremium('anual', [{ monto: 2500 }]).saldo, -500);
assert.equal(saldoPremium('mensual', [{ monto: 200 }]).estado, 'debe', 'un mes pagado de doce sigue debiendo');
assert.equal(saldoPremium('mensual', [{ monto: 2400 }]).estado, 'al_corriente');

// ── El centavo de redondeo: el caso que motivó la función ──────────────────
// 2000 en tres parcialidades son 666.67 cada una = 2000.01. Sin redondear, la
// pantalla diría que el agente pagó de más por un centavo.
{
  const s = saldoPremium('anual', [{ monto: 666.67 }, { monto: 666.67 }, { monto: 666.67 }]);
  assert.equal(s.estado, 'al_corriente', `un centavo de redondeo no es un saldo a favor (saldo: ${s.saldo})`);
  assert.equal(s.saldo, 0);
}
// Y al revés: 666.66 × 3 = 1999.98, dos centavos de menos, tampoco es una deuda.
assert.equal(
  saldoPremium('anual', [{ monto: 666.66 }, { monto: 666.66 }, { monto: 666.66 }]).estado,
  'debe',
  'dos centavos sí superan el umbral de un centavo y se reportan',
);

// ── Un peso de diferencia SÍ se tiene que ver ──────────────────────────────
assert.equal(saldoPremium('anual', [{ monto: 1999 }]).estado, 'debe');
assert.equal(saldoPremium('anual', [{ monto: 1999 }]).saldo, 1);

console.log('✓ mktPremiumPagos: el saldo no inventa deudas ni saldos a favor por centavos');
