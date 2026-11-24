/**
 * Adaptador del cotizador BX+ Unikuz para el Multicotizador GMM.
 *
 * Todo el cálculo vive en `bxplusEngine`, que es el puerto fiel de las fórmulas del Excel.
 * Aquí solo se normalizan los valores que la UI guarda con nombres amigables.
 */

import type { BxplusQuoteInput, BxplusCalculationResult, QuotePerson } from './types';
import { calculateBxplus as calcularBxplusExacto, type TablaTarifaBx } from './bxplusEngine';

/**
 * El Excel nombra los niveles hospitalarios ELITE / PLUS / ESTANDAR. La UI histórica usa
 * Alto / Medio / Básico (y hay cotizaciones guardadas con esos valores), así que se
 * traducen antes de calcular.
 */
const NIVEL_HOSPITALARIO_MAP: Record<string, string> = {
  alto: 'ELITE',
  medio: 'PLUS',
  basico: 'ESTANDAR',
  'básico': 'ESTANDAR',
  elite: 'ELITE',
  plus: 'PLUS',
  estandar: 'ESTANDAR',
};

export function calcularBxplus(
  input: BxplusQuoteInput,
  people: QuotePerson[],
  tariffTablesRaw: TablaTarifaBx[],
  packageId: string
): BxplusCalculationResult {
  const nivel = NIVEL_HOSPITALARIO_MAP[String(input.nivel_hospitalario ?? '').trim().toLowerCase()]
    ?? input.nivel_hospitalario;

  return calcularBxplusExacto({ ...input, nivel_hospitalario: nivel }, people, tariffTablesRaw, packageId);
}

// Se conserva el nombre histórico que usa la pantalla.
export { calcularBxplus as calculateBxplus };
