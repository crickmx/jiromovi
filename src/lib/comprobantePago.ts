// Validación del comprobante que se adjunta a un pago del Plan Premium.
//
// Se revisa antes de subir nada: un archivo rechazado por el servidor deja al
// usuario con un error críptico y, peor, con el pago a medio registrar.

export const BUCKET_COMPROBANTES = 'mkt-premium-comprobantes';

/** Lo que acepta: un comprobante es un PDF o la foto/captura del movimiento. */
export const EXTENSIONES_COMPROBANTE = ['pdf', 'jpg', 'jpeg', 'png'];
export const ACCEPT_COMPROBANTE = '.pdf,.jpg,.jpeg,.png';

/** 10 MB. Una foto de celular ronda los 3-6 MB; un PDF de banco, menos de 1. */
export const MAX_BYTES_COMPROBANTE = 10 * 1024 * 1024;

export function extensionDe(nombre: string): string {
  const i = nombre.lastIndexOf('.');
  return i === -1 ? '' : nombre.slice(i + 1).toLowerCase();
}

/** `null` si el archivo sirve; si no, el texto exacto que se le muestra. */
export function validarComprobante(archivo: { name: string; size: number }): string | null {
  const ext = extensionDe(archivo.name);
  if (!EXTENSIONES_COMPROBANTE.includes(ext)) {
    return `"${archivo.name}" no es un formato aceptado. Debe ser PDF, JPG o PNG.`;
  }
  if (archivo.size > MAX_BYTES_COMPROBANTE) {
    const mb = (archivo.size / 1024 / 1024).toFixed(1);
    return `El archivo pesa ${mb} MB y el máximo son 10 MB.`;
  }
  // Un archivo de 0 bytes sube sin error y después no se puede abrir.
  if (archivo.size === 0) return 'El archivo está vacío.';
  return null;
}

/**
 * Ruta dentro del bucket.
 *
 * Empieza con el id del agente porque la política de lectura compara contra la
 * primera carpeta para dejar que cada quien vea su propio comprobante. El
 * nombre original NO se usa en la ruta: trae acentos, espacios y a veces datos
 * personales. Se guarda aparte, en la columna `comprobante_nombre`.
 */
export function rutaComprobante(usuarioId: string, pagoId: string, nombreArchivo: string): string {
  const ext = extensionDe(nombreArchivo) || 'bin';
  return `${usuarioId}/${pagoId}.${ext}`;
}
