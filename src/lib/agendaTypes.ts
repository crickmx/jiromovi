export type AgendaModalidad = 'presencial' | 'telefono' | 'google_meet' | 'jitsi';

export const AGENDA_MODALIDAD_LABELS: Record<AgendaModalidad, string> = {
  presencial: 'Presencial',
  telefono: 'Llamada telefónica',
  google_meet: 'Google Meet (próximamente)',
  jitsi: 'Videollamada (Jitsi Meet)',
};

export interface AgendaCalendario {
  id: string;
  user_id: string;
  marca: string | null;
  nombre: string;
  color: string;
  zona_horaria: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface AgendaTipoCita {
  id: string;
  calendario_id: string;
  user_id: string;
  nombre: string;
  slug: string;
  descripcion: string | null;
  color: string | null;
  duracion_minutos: number;
  buffer_antes_minutos: number;
  buffer_despues_minutos: number;
  anticipacion_minima_minutos: number;
  limite_reservas_por_dia: number | null;
  modalidades: AgendaModalidad[];
  direccion: string | null;
  telefono_organizador: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface AgendaReglaDisponibilidad {
  id: string;
  calendario_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  activo: boolean;
}

export interface AgendaExcepcionDisponibilidad {
  id: string;
  calendario_id: string;
  fecha: string;
  todo_el_dia: boolean;
  start_time: string | null;
  end_time: string | null;
  motivo: string | null;
}

export interface AgendaReserva {
  id: string;
  tipo_cita_id: string;
  calendario_id: string;
  user_id: string;
  invitado_nombre: string;
  invitado_email: string;
  invitado_telefono: string | null;
  invitado_notas: string | null;
  modalidad: AgendaModalidad;
  ubicacion_detalle: string | null;
  meeting_url: string | null;
  start_at: string;
  end_at: string;
  zona_horaria_invitado: string | null;
  status: 'confirmada' | 'cancelada' | 'reprogramada';
  cancelado_en: string | null;
  cancelado_motivo: string | null;
  created_at: string;
}

export interface AgendaWebsiteBloque {
  id: string;
  user_id: string;
  tipo_cita_id: string;
  visible: boolean;
  orden: number;
}

export const WEEKDAY_LABELS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

/** Zonas horarias más usadas por agentes MOVI (México) */
export const ZONAS_HORARIAS_MX = [
  { value: 'America/Mexico_City', label: 'Ciudad de México (Centro)' },
  { value: 'America/Cancun', label: 'Cancún (Sureste)' },
  { value: 'America/Chihuahua', label: 'Chihuahua (Pacífico)' },
  { value: 'America/Tijuana', label: 'Tijuana (Noroeste)' },
];

// ── Datos que devuelve agenda_public_get_event_type (página pública) ──

export interface AgendaPublicEventType {
  organizador: { nombre_completo: string };
  calendario: {
    id: string;
    nombre: string;
    color: string;
    zona_horaria: string;
  };
  tipo_cita: {
    id: string;
    nombre: string;
    slug: string;
    descripcion: string | null;
    color: string | null;
    duracion_minutos: number;
    buffer_antes_minutos: number;
    buffer_despues_minutos: number;
    anticipacion_minima_minutos: number;
    limite_reservas_por_dia: number | null;
    modalidades: AgendaModalidad[];
    direccion: string | null;
    telefono_organizador: string | null;
  };
  reglas: Array<{ weekday: number; start_time: string; end_time: string }>;
  excepciones: Array<{ fecha: string; todo_el_dia: boolean; start_time: string | null; end_time: string | null }>;
  ocupados: Array<{ start_at: string; end_at: string }>;
}

export interface AgendaCrearReservaResult {
  id: string;
  start_at: string;
  end_at: string;
  modalidad: AgendaModalidad;
  meeting_url: string | null;
  ubicacion_detalle: string | null;
  tipo_cita_nombre: string;
  zona_horaria: string;
}

export interface AgendaWebsiteBloquePublico {
  tipo_cita_id: string;
  nombre: string;
  slug: string;
  descripcion: string | null;
  duracion_minutos: number;
  orden: number;
}
