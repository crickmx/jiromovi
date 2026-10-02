// Cuentas del Plan Premium de un agente: qué debía, qué lleva pagado, qué falta.
//
// Hasta ahora de un Premium solo se guardaba el método de pago y una fecha de
// renovación, así que no había manera de saber si alguien estaba al corriente.
// Esto es la parte que se puede calcular sin tocar la base, y por eso vive
// aparte: es donde un error no da ningún síntoma —un saldo mal sumado se ve
// como un número cualquiera.

/** Precios vigentes del plan. Si cambian, se cambian aquí. */
export const PRECIO_PREMIUM = {
  mensual: 200,
  anual: 2000,
} as const;

export type PlanPremium = keyof typeof PRECIO_PREMIUM;

export interface PagoPremium {
  monto: number | string;
}

/** Suma de lo pagado. Acepta texto porque Postgres devuelve `numeric` así. */
export function totalPagado(pagos: PagoPremium[]): number {
  return pagos.reduce((suma, p) => suma + (Number(p.monto) || 0), 0);
}

/**
 * Lo que el agente debía por el periodo contratado.
 *
 * `parcialidades` solo divide el cobro, no lo cambia: pagar en 12 partes no
 * hace que el plan cueste más. Por eso no entra en esta cuenta.
 */
export function montoDelPlan(plan: PlanPremium | null | undefined): number {
  if (!plan) return 0;
  return PRECIO_PREMIUM[plan] ?? 0;
}

export interface SaldoPremium {
  esperado: number;
  pagado: number;
  /** Positivo = falta por cobrar. Negativo = pagó de más. */
  saldo: number;
  estado: 'al_corriente' | 'debe' | 'a_favor' | 'sin_plan';
}

/**
 * Estado de cuenta del periodo.
 *
 * Los centavos se redondean antes de comparar: sin eso, un plan de 2000 pagado
 * en tres parcialidades de 666.67 da un saldo de -0.01 y la pantalla diría que
 * el agente pagó de más por un centavo de redondeo.
 */
export function saldoPremium(plan: PlanPremium | null | undefined, pagos: PagoPremium[]): SaldoPremium {
  const esperado = montoDelPlan(plan);
  const pagado = Math.round(totalPagado(pagos) * 100) / 100;
  const saldo = Math.round((esperado - pagado) * 100) / 100;

  if (!plan) return { esperado: 0, pagado, saldo: 0, estado: 'sin_plan' };
  // `<=`, no `<`: con `<`, un saldo de exactamente un centavo —el caso que
  // esta tolerancia viene a cubrir— se seguía reportando como deuda o como
  // saldo a favor. Lo cazó la autocomprobación.
  if (Math.abs(saldo) <= 0.01) return { esperado, pagado, saldo: 0, estado: 'al_corriente' };
  return { esperado, pagado, saldo, estado: saldo > 0 ? 'debe' : 'a_favor' };
}

export function pesos(n: number): string {
  return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 });
}
