import type { ProductId, BnvQuoteInput, BnpQuoteInput, BxplusQuoteInput } from './types';
import { DEFAULT_BXPLUS_COVERAGES } from './types';

/**
 * Valores por omisión de cada producto. Viven aquí (y no en la UI) para que la
 * página del multicotizador y el configurador de opciones arranquen con los
 * mismos parámetros.
 */
export const DEFAULT_BNV_INPUT: BnvQuoteInput = {
  region_zone: 'Zona 1', suma_asegurada: 10, deducible: 15, coaseguro: 10,
  tope_coaseguro: 30000, client_type: 'Normal', asistencia_extranjero: false, forma_pago: 'Anual',
};

export const DEFAULT_BNP_INPUT: BnpQuoteInput = {
  region_zone: 'Zona 1', suma_asegurada: 50, deducible: 35, coaseguro: 20,
  client_type: 'Nuevo negocio', maternidad_titular: false, maternidad_conyuge: false,
  asistencia_extranjero: false, cobertura_catastrofica_extranjero: false, forma_pago: 'Anual',
};

export const DEFAULT_BXPLUS_INPUT: BxplusQuoteInput = {
  // Valores por omisión del propio cotizador Excel (hoja Cotizador, E37:E41).
  estado: 'CIUDAD DE MEXICO', nivel_hospitalario: 'PLUS', tabulador: 'PALADIO-60,000',
  suma_asegurada: '5000000', deducible: '17000', coaseguro: '0.1', forma_pago: 'Anual',
  coverages: { ...DEFAULT_BXPLUS_COVERAGES },
};

export function getDefaultInput(product: ProductId): BnvQuoteInput | BnpQuoteInput | BxplusQuoteInput {
  if (product === 'BNV') return { ...DEFAULT_BNV_INPUT };
  if (product === 'BNP') return { ...DEFAULT_BNP_INPUT };
  return { ...DEFAULT_BXPLUS_INPUT, coverages: { ...DEFAULT_BXPLUS_COVERAGES } };
}

/** Orden en el que se ofrecen las opciones sugeridas (una por aseguradora). */
export const PRODUCT_ORDER: ProductId[] = ['BNV', 'BNP', 'BXPLUS'];

/**
 * Siguiente producto libre para una opción nueva: el primero que todavía no
 * tenga ninguna opción. Si ya están los tres, se rota por el orden.
 */
export function nextFreeProduct(usados: ProductId[], totalOpciones: number): ProductId {
  const enUso = new Set(usados);
  const libre = PRODUCT_ORDER.find(p => !enUso.has(p));
  if (libre) return libre;
  return PRODUCT_ORDER[totalOpciones % PRODUCT_ORDER.length];
}
