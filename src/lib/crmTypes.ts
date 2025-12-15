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
  contacto_id: string;
  descripcion: string;
  tipo_actividad: TipoActividad;
  fecha_vencimiento: string;
  completada: boolean;
  fecha_completado?: string;
  asignado_a?: string;
  creado_por?: string;
  creado_en: string;
  actualizado_en: string;
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
