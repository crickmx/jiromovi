// Cómo se lee un campo del formulario cuando NO se puede editar.
//
// Un trámite se abre muchas más veces para consultarlo que para cambiarlo —está
// cerrado, o quien mira no tiene permiso— y aun así se pintaban inputs grises
// deshabilitados: 38px de alto cada uno, con borde y fondo, para mostrar un dato
// que cabe en una línea de 20px. Esto los convierte en texto.

export interface CampoParaTexto {
  tipo: string;
  config?: { opciones?: { label: string; slug: string }[] } | null;
}

/** Lo que se muestra cuando el campo está vacío. Nunca una línea en blanco. */
export const SIN_DATO = '—';

/**
 * Tipos que siguen necesitando su propio render aunque no se puedan editar.
 *
 * `adjunto` tiene que seguir listando los archivos (y dejar descargarlos) y
 * `reporte_protegido` tiene su propio panel con metadatos: convertirlos a una
 * línea de texto perdería información real, no solo altura.
 */
export const TIPOS_CON_LECTURA_PROPIA = ['adjunto', 'reporte_protegido'];

function etiquetaDeOpcion(campo: CampoParaTexto, valor: string): string {
  return campo.config?.opciones?.find(o => o.slug === valor)?.label ?? valor;
}

/** Texto legible del valor de un campo. */
export function textoDeValor(campo: CampoParaTexto, valor: any): string {
  if (valor === undefined || valor === null || valor === '') return SIN_DATO;

  if (Array.isArray(valor)) {
    if (valor.length === 0) return SIN_DATO;
    return valor.map(v => etiquetaDeOpcion(campo, String(v))).join(', ');
  }

  switch (campo.tipo) {
    case 'booleano':
      return valor === true || valor === 'true' ? 'Sí' : 'No';

    case 'fecha': {
      // Las fechas vienen como 'YYYY-MM-DD'. Partirlas a mano evita el corrimiento
      // de un día que produce `new Date('2026-01-31')`, que se interpreta en UTC.
      const m = String(valor).match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (!m) return String(valor);
      return `${m[3]}/${m[2]}/${m[1]}`;
    }

    case 'porcentaje':
      return `${valor}%`;

    case 'dropdown':
    case 'estatus':
      return etiquetaDeOpcion(campo, String(valor));

    case 'seleccion_multiple':
      // Varias pantallas lo guardan como texto separado por comas, no como arreglo.
      return String(valor).split(',').map(v => etiquetaDeOpcion(campo, v.trim())).filter(Boolean).join(', ') || SIN_DATO;

    default:
      return String(valor);
  }
}
