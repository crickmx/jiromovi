export type TipoContacto = 'Persona' | 'Empresa';

export type EstatusContacto =
  | 'Prospecto'
  | 'Cotización Presentada'
  | 'Negociación'
  | 'Cliente'
  | 'Perdido';

export type EstatusCotizacion =
  | 'Nueva'
  | 'Pendiente de Seguimiento'
  | 'Aprobada'
  | 'Rechazada/Perdida';

export type TipoActividad = 'Llamada' | 'Email' | 'Reunión' | 'Otro';

export type EstatusTarea = 'Pendiente' | 'En Proceso' | 'Completada';

export type PrioridadTarea = 'Alta' | 'Media' | 'Baja';

export type TipoCampoPersonalizado = 'Texto' | 'Número' | 'Fecha' | 'Selector';

export interface CRMContacto {
  id: string;
  tipo_contacto: TipoContacto;
  nombre_completo: string;
  celular: string;
  email?: string;
  fecha_nacimiento?: string;
  estatus: EstatusContacto;
  fuente_origen?: string;
  etiquetas_segmentacion: string[];
  fecha_creacion: string;
  fecha_conversion_cliente?: string;
  campos_personalizados: Record<string, any>;
  creado_por?: string;
  actualizado_en: string;
}

export interface CRMCotizacion {
  id: string;
  contacto_id: string;
  nombre_documento: string;
  fecha_presentacion: string;
  estatus_cotizacion: EstatusCotizacion;
  archivo_url?: string;
  monto_cotizado?: number;
  observaciones?: string;
  creado_por?: string;
  creado_en: string;
  actualizado_en: string;
}

export interface CRMPoliza {
  id: string;
  contacto_id: string;
  numero_poliza: string;
  tipo_ramo: string;
  compania_aseguradora: string;
  fecha_emision: string;
  fecha_vencimiento: string;
  prima_total: number;
  archivo_url?: string;
  observaciones?: string;
  creado_por?: string;
  creado_en: string;
  actualizado_en: string;
}

export interface CRMTarea {
  id: string;
  contacto_id?: string;
  board_id?: string | null;
  descripcion: string;
  tipo_actividad: TipoActividad;
  fecha_vencimiento: string;
  estatus: EstatusTarea;
  prioridad: PrioridadTarea;
  completada: boolean;
  fecha_completado?: string;
  asignado_a?: string;
  creado_por: string;
  creado_en: string;
  actualizado_en: string;
  crm_contactos?: {
    nombre_completo: string;
  };
  responsable?: {
    id: string;
    nombre: string;
    apellidos: string;
    avatar_url?: string;
  };
}

export interface CRMTareaAdjunto {
  id: string;
  tarea_id: string;
  nombre_archivo: string;
  archivo_url: string;
  tipo_mime?: string;
  tamano_bytes?: number;
  subido_por?: string;
  creado_en: string;
}

export interface CRMNota {
  id: string;
  contacto_id: string;
  contenido: string;
  creado_por?: string;
  creado_en: string;
  actualizado_en: string;
}

export interface CRMCampoPersonalizado {
  id: string;
  nombre_campo: string;
  etiqueta: string;
  tipo_campo: TipoCampoPersonalizado;
  opciones_selector: string[];
  requerido: boolean;
  activo: boolean;
  orden: number;
  creado_en: string;
}

export interface CRMEtiqueta {
  id: string;
  nombre: string;
  color: string;
  activo: boolean;
  creado_en: string;
}

export interface CRMFuenteOrigen {
  id: string;
  nombre: string;
  activo: boolean;
  creado_en: string;
}

export interface TimelineItem {
  id: string;
  tipo: 'cotizacion' | 'poliza' | 'tarea' | 'nota';
  titulo: string;
  descripcion: string;
  fecha: string;
  icono: string;
  color: string;
}

export interface DashboardStats {
  totalContactos: number;
  totalProspectos: number;
  totalClientes: number;
  totalCotizaciones: number;
  totalPolizas: number;
  primaTotal: number;
  tasaConversion: number;
}

export interface FunnelData {
  prospectos: number;
  cotizacionPresentada: number;
  negociacion: number;
  clientes: number;
}

export type MemberRole = 'owner' | 'admin' | 'editor' | 'viewer';

export interface CRMBoard {
  id: string;
  name: string;
  owner_user_id: string;
  owner_office_id?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface CRMBoardMember {
  id: string;
  board_id: string;
  user_id: string;
  member_role: MemberRole;
  added_by: string;
  created_at: string;
}

export interface CRMBoardActivity {
  id: string;
  board_id: string;
  actor_user_id: string;
  action: string;
  meta: Record<string, any>;
  created_at: string;
}

export interface CRMBoardListItem {
  board_id: string;
  board_name: string;
  is_owner: boolean;
  my_role: MemberRole;
  owner_name: string;
  owner_office: string;
  members_count: number;
  created_at: string;
  updated_at: string;
}

export interface CRMBoardMemberDetail {
  member_id: string;
  user_id: string;
  user_name: string;
  user_office: string;
  user_role_global: string;
  member_role: MemberRole;
  added_by_name: string;
  created_at: string;
}

export interface SearchableUser {
  id: string;
  nombre_completo: string;
  oficina_nombre: string;
  rol: string;
  avatar_url?: string;
}
