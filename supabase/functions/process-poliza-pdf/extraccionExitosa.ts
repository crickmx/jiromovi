// ¿El lector sacó algo de verdad de este PDF?
//
// El extractor responde `estado: "ok"` incluso cuando no reconoció casi nada:
// devuelve la clasificación (ramo, sub ramo, aseguradora) y los campos vacíos.
// Creerle a esa respuesta tenía tres consecuencias, todas vistas en producción:
// el Excel sacaba una fila de aspecto normal, el archivo decía "Datos
// extraídos" en pantalla, y el PDF NO se mandaba a entrenamiento — justo el que
// más falta hacía entrenar.
//
// Por eso la respuesta del extractor no basta: hace falta que haya llegado algo
// con lo que se pueda trabajar.

/**
 * Campos que prueban que la póliza se leyó de verdad.
 *
 * Es una lista de lo que SÍ cuenta, no de lo que se ignora: la clasificación
 * (`ramo`, `sub_ramo`, `aseguradora`) y los valores genéricos (`moneda`,
 * `forma_pago`) los acierta cualquiera por el formato del documento, sin haber
 * leído una sola línea. Pasó: una póliza sin un solo dato salió por buena
 * porque traía "Sub Ramo: Automóviles".
 */
export const CAMPOS_QUE_PRUEBAN_EXTRACCION = [
  'documento',      // número de póliza
  'rfc',
  'nombre_cliente',
  'prima_neta',
  'prima_total',
  'desde',
  'hasta',
  'serie',
  'placas',
  'agente_clave',
];

export const AVISO_SIN_EXTRACCION = 'Datos no extraídos, se envía a entrenamiento';

const vacio = (v: unknown) =>
  v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

/** `true` si al menos un campo identificador de la póliza trae algo. */
export function datosUtilesExtraidos(
  campos: Record<string, unknown> | null | undefined,
  cuentan: string[] = CAMPOS_QUE_PRUEBAN_EXTRACCION,
): boolean {
  if (!campos) return false;
  return cuentan.some(k => !vacio(campos[k]));
}

/** Deja la fila del Excel marcada cuando la extracción no sirvió. */
export function marcarSiNoSeExtrajo(
  headers: string[],
  fila: unknown[],
  extraccionOk: boolean,
): unknown[] {
  if (extraccionOk) return fila;

  const i = headers.indexOf('Observaciones');
  if (i < 0) return fila;

  const marcada = [...fila];
  const previo = typeof marcada[i] === 'string' ? (marcada[i] as string).trim() : '';
  // Lo que ya decía la observación no se pierde: suele traer el motivo.
  marcada[i] = previo ? `${AVISO_SIN_EXTRACCION} — ${previo}` : AVISO_SIN_EXTRACCION;
  return marcada;
}
