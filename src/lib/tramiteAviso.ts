// El texto de los avisos de trámite — el mismo que llega por WhatsApp.
//
// `enviar_notificacion_individual` manda el título y el mensaje TAL CUAL a
// WhatsApp, sin plantilla ni formato. Y el mensaje de "nuevo trámite" era solo
// el folio y el tipo: quien lo recibía tenía que entrar a MOVI para saber de
// quién era y de qué se trataba. Aquí se arma con lo que sirve para decidir si
// hay que atenderlo ya o puede esperar.

/** Lo máximo que se copia de las instrucciones. Un WhatsApp kilométrico no se lee. */
const MAX_INSTRUCCIONES = 280;

/** Textos de relleno que el alta guarda cuando nadie escribió nada. */
const SIN_CONTENIDO = ['sin descripción', 'sin descripcion', 'n/a', '-'];

export interface DatosAvisoTramite {
  folio: string;
  tipoLabel: string;
  solicitante?: string | null;
  oficina?: string | null;
  prioridad?: string | null;
  instrucciones?: string | null;
}

const vacio = (v?: string | null) => !v || !v.trim();

export function recortarInstrucciones(texto?: string | null): string {
  const limpio = (texto ?? '').replace(/\s+/g, ' ').trim();
  if (!limpio || SIN_CONTENIDO.includes(limpio.toLowerCase())) return '';
  return limpio.length <= MAX_INSTRUCCIONES
    ? limpio
    : `${limpio.slice(0, MAX_INSTRUCCIONES).trimEnd()}…`;
}

/**
 * Cuerpo del aviso. Las líneas que no tienen dato se omiten en vez de salir
 * vacías o con un guion: un aviso lleno de "—" se lee peor que uno corto.
 */
export function mensajeNuevoTramite(d: DatosAvisoTramite): string {
  const lineas = [`${d.folio} — ${d.tipoLabel}`];
  if (!vacio(d.solicitante)) lineas.push(`Solicitante: ${d.solicitante!.trim()}`);
  if (!vacio(d.oficina)) lineas.push(`Oficina: ${d.oficina!.trim()}`);
  if (!vacio(d.prioridad)) lineas.push(`Prioridad: ${d.prioridad!.trim()}`);

  const instrucciones = recortarInstrucciones(d.instrucciones);
  if (instrucciones) lineas.push('', instrucciones);

  return lineas.join('\n');
}
