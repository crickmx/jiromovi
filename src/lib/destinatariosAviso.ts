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

// La LÓGICA de a quién se le avisa ya no vive aquí.
//
// Estaba escrita dos veces —en este archivo y dentro de las funciones SQL que
// usan los triggers— y eran dos copias de las mismas reglas en dos lenguajes:
// el tipo de duplicación que nunca da error, solo hace que un día los dos
// caminos empiecen a avisar distinto.
//
// Ahora la decide `resolver_destinatarios_aviso(p_ticket_id, p_codigo_tipo)`
// en la base, y el frontend la consulta por RPC. Aquí solo queda el catálogo
// de papeles, que es lo que la pantalla necesita para pintar los botones.
