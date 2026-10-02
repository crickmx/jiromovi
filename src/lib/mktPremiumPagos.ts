// Cuentas del Plan Premium de un agente: qué debía, qué lleva pagado, qué falta.
//
// Hasta ahora de un Premium solo se guardaba el método de pago y una fecha de
// renovación, así que no había manera de saber si alguien estaba al corriente.
// Esto es la parte que se puede calcular sin tocar la base, y por eso vive
// aparte: es donde un error no da ningún síntoma —un saldo mal sumado se ve
// como un número cualquiera.

/**
 * Precio de CADA cobro del plan. No es el total del periodo.
 *
 * El plan mensual son $200 **al mes**, no $200 al año: tratarlo como total
 * decía que un agente debía $200 cuando en realidad debía $2,400, y la Orden de
 * Compra ofrecía 12 descuentos de $16.66.
 */
export const PRECIO_PREMIUM = {
  mensual: 200,
  anual: 2000,
} as const;

export type PlanPremium = keyof typeof PRECIO_PREMIUM;

/** Cuántas veces se cobra en un periodo contratado: 12 meses, o 1 año. */
export const COBROS_DEL_PERIODO = {
  mensual: 12,
  anual: 1,
} as const;

export interface PagoPremium {
  monto: number | string;
}

/** Suma de lo pagado. Acepta texto porque Postgres devuelve `numeric` así. */
export function totalPagado(pagos: PagoPremium[]): number {
  return pagos.reduce((suma, p) => suma + (Number(p.monto) || 0), 0);
}

/**
 * Lo que el agente debe por el periodo contratado completo.
 *
 * Mensual: $200 × 12 meses = $2,400. Anual: $2,000 de una vez.
 */
export function montoDelPlan(plan: PlanPremium | null | undefined): number {
  if (!plan) return 0;
  return (PRECIO_PREMIUM[plan] ?? 0) * (COBROS_DEL_PERIODO[plan] ?? 1);
}

/**
 * En cuántos cargos se reparte el periodo. No se configura: lo decide el plan.
 *
 * El mensual son 12 mensualidades y el anual un solo pago, sin plazos. Antes
 * esto salía de un campo que alguien llenaba a mano, y cualquier número que no
 * fuera 12 o 1 producía una Orden de Compra que no correspondía al plan.
 */
export function cobrosDelPlan(plan: PlanPremium | null | undefined): number {
  if (!plan) return 1;
  return COBROS_DEL_PERIODO[plan] ?? 1;
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

export { pesos } from './cobroDesglose';
