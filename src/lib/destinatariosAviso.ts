// A quién se le avisa de un trámite, según los papeles configurados en
// Admin › Transaccionales (`correo_tipos_notificacion.destinatarios_roles`).
//
// Vive aparte y sin cliente de Supabase para poder comprobarse
// (`destinatariosAviso.test.mjs`): equivocarse aquí no da error, solo deja a
// alguien sin enterarse — el peor tipo de falla, la que no se ve.

/** Los papeles que puede tener alguien frente a un trámite. */
export type RolDestinatario = 'solicitante' | 'responsable' | 'lider_equipo' | 'lista_fija';

export const ROLES_DESTINATARIO: { valor: RolDestinatario; label: string; ayuda: string }[] = [
  { valor: 'solicitante', label: 'Solicitante', ayuda: 'El agente para quien es el trámite' },
  { valor: 'responsable', label: 'Responsable', ayuda: 'A quien se le asignó el trámite' },
  { valor: 'lider_equipo', label: 'Líder del equipo', ayuda: 'Solo si el trámite no tiene responsable' },
  { valor: 'lista_fija', label: 'Lista fija', ayuda: 'Los destinatarios de abajo, siempre los mismos' },
];

export interface PersonasDelTramite {
  solicitanteId?: string | null;
  responsableId?: string | null;
  liderEquipoId?: string | null;
  listaFija?: string[];
}

/**
 * Resuelve la lista final de personas a avisar.
 *
 * Dos reglas que no son obvias:
 *
 * 1. **El líder solo entra si no hay responsable.** Es un respaldo, no un
 *    segundo destinatario: con los dos puestos, un trámite ya asignado le
 *    llegaría también a su jefe cada vez, y eso cansa a quien lo recibe hasta
 *    que deja de leerlos.
 * 2. **Sin roles configurados se devuelve vacío**, para que quien llama use su
 *    camino de siempre. Una configuración en blanco no debe significar "no
 *    avisarle a nadie" — eso apagaría avisos en silencio.
 *
 * Nunca repite a la misma persona, aunque sea el solicitante y el responsable
 * a la vez.
 */
export function destinatariosDelAviso(
  roles: string[] | null | undefined,
  personas: PersonasDelTramite,
): string[] {
  const pedidos = new Set((roles ?? []).map((r) => r.trim()).filter(Boolean));
  if (pedidos.size === 0) return [];

  const ids: (string | null | undefined)[] = [];

  if (pedidos.has('solicitante')) ids.push(personas.solicitanteId);
  if (pedidos.has('responsable')) ids.push(personas.responsableId);
  if (pedidos.has('lider_equipo') && !personas.responsableId) ids.push(personas.liderEquipoId);
  if (pedidos.has('lista_fija')) ids.push(...(personas.listaFija ?? []));

  return Array.from(new Set(ids.filter((id): id is string => !!id)));
}
