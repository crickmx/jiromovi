// ¿El lector sacó algo de verdad de este PDF?
//
// El Excel para SICAS se arma igual para todos los archivos, así que una póliza
// que no se pudo leer salía con una fila de aspecto normal: con el nombre del
// archivo, el vendedor, el despacho y "Vigente" puestos. Nada de eso lo extrajo
// el lector —sale del ticket o es un valor fijo— así que una fila con solo eso
// está vacía y hay que decirlo en el documento, no dejar que parezca buena.

/**
 * Columnas que NO prueban que la extracción funcionó.
 *
 * Las cinco primeras las pidió Ricardo: se arman solas o vienen del ticket.
 * `Observaciones` se suma porque es nuestra propia nota —si contara, el aviso
 * que escribimos aquí haría que la fila se diera por buena a sí misma.
 */
export const COLUMNAS_QUE_NO_CUENTAN = [
  'Nombre Archivo',
  'Estatus',
  'Vendedor',
  'Tipo Documento',
  'Despacho',
  'Observaciones',
];

export const AVISO_SIN_EXTRACCION = 'Datos no extraídos, se envía a entrenamiento';

const vacio = (v: unknown) =>
  v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

/**
 * `true` si alguna columna que SÍ depende del lector trae algo.
 *
 * `headers` y `fila` van en el mismo orden; si llegaran desparejos se compara
 * contra el más corto, que es preferible a leer una columna por otra.
 */
export function huboExtraccion(
  headers: string[],
  fila: unknown[],
  ignoradas: string[] = COLUMNAS_QUE_NO_CUENTAN,
): boolean {
  const fuera = new Set(ignoradas);
  const hasta = Math.min(headers.length, fila.length);
  for (let i = 0; i < hasta; i++) {
    if (fuera.has(headers[i])) continue;
    if (!vacio(fila[i])) return true;
  }
  return false;
}

/** Deja la fila lista para el Excel, marcada si no se extrajo nada. */
export function marcarSiNoSeExtrajo(
  headers: string[],
  fila: unknown[],
  ignoradas: string[] = COLUMNAS_QUE_NO_CUENTAN,
): unknown[] {
  if (huboExtraccion(headers, fila, ignoradas)) return fila;

  const i = headers.indexOf('Observaciones');
  if (i < 0) return fila;

  const marcada = [...fila];
  const previo = typeof marcada[i] === 'string' ? (marcada[i] as string).trim() : '';
  // Lo que ya decía la observación no se pierde: suele traer el motivo.
  marcada[i] = previo ? `${AVISO_SIN_EXTRACCION} — ${previo}` : AVISO_SIN_EXTRACCION;
  return marcada;
}
