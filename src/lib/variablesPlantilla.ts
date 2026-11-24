// Las variables que de verdad se pueden usar en una plantilla de trámite.
//
// Esta lista existe porque la pantalla ofrecía nombres que el motor no entrega
// —`{{folio_tramite}}`, `{{usuario_nombre}}`, `{{fecha_creacion}}`— y el
// resultado era un WhatsApp con las etiquetas y los valores en blanco. El
// motor borra lo que no puede sustituir, así que un nombre equivocado NO da
// error: deja un hueco, y nadie se entera hasta que el aviso ya salió.
//
// Si se agrega una variable al despachador (`allVariables` en
// `ticket-notification-dispatcher`), hay que agregarla aquí. Es la única forma
// de que la pantalla ofrezca lo que existe y nada más.

export interface VariablePlantilla {
  /** Se escribe como {{nombre}} */
  nombre: string;
  descripcion: string;
  ejemplo: string;
  grupo: string;
}

export const VARIABLES_TRAMITE: VariablePlantilla[] = [
  { nombre: 'folio', descripcion: 'Folio del trámite', ejemplo: 'TK294FA', grupo: 'Trámite' },
  { nombre: 'tipo_tramite', descripcion: 'Tipo de trámite', ejemplo: 'Cotización', grupo: 'Trámite' },
  { nombre: 'estatus', descripcion: 'Estatus actual', ejemplo: 'Iniciado', grupo: 'Trámite' },
  { nombre: 'prioridad', descripcion: 'Prioridad', ejemplo: 'Media', grupo: 'Trámite' },
  { nombre: 'instrucciones', descripcion: 'Lo que se pide, recortado', ejemplo: 'Cotizar Ford 2024…', grupo: 'Trámite' },

  { nombre: 'solicitante', descripcion: 'Agente para quien es el trámite', ejemplo: 'RICARDO JIMÉNEZ', grupo: 'Personas' },
  { nombre: 'oficina', descripcion: 'Oficina del solicitante', ejemplo: 'Jiro Corporativo', grupo: 'Personas' },
  { nombre: 'agente_nombre', descripcion: 'Quien recibe el aviso', ejemplo: 'YURI AGUILAR', grupo: 'Personas' },
  { nombre: 'creado_por', descripcion: 'Quien dio de alta el trámite', ejemplo: 'DIANA JIMÉNEZ', grupo: 'Personas' },

  { nombre: 'url', descripcion: 'Liga directa al trámite', ejemplo: 'https://app.movi.digital/tramites/…', grupo: 'Enlaces' },
];

/**
 * Nombre de la variable de un campo del formulario.
 *
 * Van con prefijo para que nunca choquen con las de arriba: un tipo de trámite
 * podría tener un campo con clave `folio` y pisaría al folio real del trámite.
 */
export function variableDeCampo(key: string): string {
  return `campo_${key}`;
}

export interface CampoDeTipo {
  key: string;
  label: string;
  tipo: string;
  tipoTramiteLabel: string;
}

/** Las de un campo del formulario, listas para la misma lista que las fijas. */
export function variablesDeCampos(campos: CampoDeTipo[]): VariablePlantilla[] {
  return campos.map((c) => ({
    nombre: variableDeCampo(c.key),
    descripcion: c.label,
    ejemplo: c.tipoTramiteLabel,
    grupo: c.tipoTramiteLabel,
  }));
}

/** Lo que de verdad se usó en un texto, para poder avisar de lo que no existe. */
export function variablesUsadas(texto: string): string[] {
  const encontradas = texto.match(/\{\{\s*([\w.]+)\s*\}\}/g) ?? [];
  return Array.from(new Set(encontradas.map((v) => v.replace(/[{}\s]/g, ''))));
}

/**
 * Las que el motor no va a poder sustituir.
 *
 * No se bloquea el guardado: puede haber variables nuevas que alguien agregue
 * al despachador antes de actualizar esta lista. Se avisa y ya — mejor una
 * advertencia de más que no poder guardar algo que sí funciona.
 */
export function variablesDesconocidas(texto: string, conocidas: string[]): string[] {
  const set = new Set(conocidas);
  return variablesUsadas(texto).filter((v) => !set.has(v));
}
