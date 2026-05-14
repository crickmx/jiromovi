/**
 * Tipos TypeScript para el módulo de Registro de Actividades
 */

export type AreaCategoria = 'Comercial' | 'Operaciones';

export interface TipoTramiteConfig {
  value: string;
  label: string;
  area: AreaCategoria;
  tipoAplicable: string;
}

export const TIPO_TRAMITE_OPTIONS: TipoTramiteConfig[] = [
  { value: 'cotizacion_emision',              label: 'Cotización / Emisión',     area: 'Comercial',    tipoAplicable: 'general' },
  { value: 'correccion_poliza_registrada',    label: 'Corrección de póliza',     area: 'Operaciones',  tipoAplicable: 'general' },
  { value: 'correccion_comisiones',           label: 'Corrección de comisiones', area: 'Operaciones',  tipoAplicable: 'general' },
  { value: 'registro_poliza',                 label: 'Registro de póliza',       area: 'Operaciones',  tipoAplicable: 'general' },
  { value: 'solicitud_comisiones_pendientes', label: 'Solicitud de comisiones',  area: 'Operaciones',  tipoAplicable: 'solicitud_comisiones' },
  { value: 'cambio_bancario',                 label: 'Cambio bancario',          area: 'Operaciones',  tipoAplicable: 'general' },
  { value: 'renovaciones',                    label: 'Renovaciones',             area: 'Comercial',    tipoAplicable: 'general' },
  { value: 'cobranza',                        label: 'Cobranza',                 area: 'Comercial',    tipoAplicable: 'general' },
  { value: 'otros_comercial',                 label: 'Otros',                    area: 'Comercial',    tipoAplicable: 'general' },
  { value: 'formulario_cotizacion',           label: 'Formulario de cotización', area: 'Comercial',    tipoAplicable: 'general' },
];

export const COMMERCIAL_TICKET_TYPES = ['renovaciones', 'cobranza', 'otros_comercial'] as const;

export function isCommercialTicketType(tipo: string): boolean {
  return COMMERCIAL_TICKET_TYPES.includes(tipo as typeof COMMERCIAL_TICKET_TYPES[number]);
}

export function getTipoTramiteLabel(tipo: string): string {
  return TIPO_TRAMITE_OPTIONS.find(t => t.value === tipo)?.label ?? tipo.replace(/_/g, ' ');
}

export function getTipoTramiteArea(tipo: string): AreaCategoria {
  return TIPO_TRAMITE_OPTIONS.find(t => t.value === tipo)?.area ?? 'Operaciones';
}

export function getTipoTramitesByArea(area: AreaCategoria): TipoTramiteConfig[] {
  return TIPO_TRAMITE_OPTIONS.filter(t => t.area === area);
}

export const AREA_CONFIG: Record<AreaCategoria, { color: string; bg: string; border: string }> = {
  Comercial:    { color: 'text-sky-700',     bg: 'bg-sky-50',     border: 'border-sky-200' },
  Operaciones:  { color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200' },
};

export interface TramiteActivityType {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface InsuranceType {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Aseguradora {
  id: string;
  nombre: string;
  nombre_corto: string | null;
  logo_url: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface RegistroActividadFormData {
  activity_subtype_id: string;
  agente_usuario_id: string;
  insurance_type_id: string;
  insurers: string[];
  attending_user_id: string;
  request_datetime: string;
  completion_datetime?: string;
  estatus_nombre: string;
  prioridad: 'Alta' | 'Media' | 'Baja';
  instrucciones: string;
}

export interface UsuarioOficina {
  id: string;
  nombre_completo: string;
  rol: string;
  oficina_id: string | null;
  oficina_nombre: string | null;
}

// Estatus del flujo de negocio para Cotización/Emisión
export const REGISTRO_ACTIVIDAD_ESTATUS = [
  { nombre: 'Iniciado',              color: '#6b7280', resultado: 'en_progreso', esFinal: false },
  { nombre: 'Cotizado',              color: '#3b82f6', resultado: 'en_progreso', esFinal: false },
  { nombre: 'Espera Aseguradora',    color: '#f97316', resultado: 'en_progreso', esFinal: false },
  { nombre: 'Espera Agente',         color: '#eab308', resultado: 'en_progreso', esFinal: false },
  { nombre: 'Emitido (Ganado)',      color: '#10b981', resultado: 'ganado',      esFinal: true  },
  { nombre: 'No Emitido (Perdido)',  color: '#ef4444', resultado: 'perdido',     esFinal: true  },
] as const;

export type EstatusRegistroActividad = typeof REGISTRO_ACTIVIDAD_ESTATUS[number]['nombre'];

export const ESTATUS_FINALES: readonly string[] = ['Emitido (Ganado)', 'No Emitido (Perdido)'];

export function getEstatusConfig(nombre: string) {
  return REGISTRO_ACTIVIDAD_ESTATUS.find(e => e.nombre === nombre) ?? {
    nombre,
    color: '#6b7280',
    resultado: 'en_progreso' as const,
    esFinal: false,
  };
}

export function getEstatusColor(nombre: string): string {
  return getEstatusConfig(nombre).color;
}

export function isEstatusFinal(nombre: string): boolean {
  return ESTATUS_FINALES.includes(nombre);
}

export function isCotizacionEmisionType(activityTypeName: string): boolean {
  const normalized = activityTypeName.toLowerCase();
  return normalized.includes('cotizaci') || normalized.includes('emisi');
}

export function getResultadoColor(resultado: string | null): string {
  switch (resultado) {
    case 'ganado':      return '#10b981';
    case 'perdido':     return '#ef4444';
    case 'en_progreso': return '#f59e0b';
    default:            return '#6b7280';
  }
}

export function getResultadoLabel(resultado: string | null): string {
  switch (resultado) {
    case 'ganado':      return 'Emitido (Ganado)';
    case 'perdido':     return 'No Emitido (Perdido)';
    case 'en_progreso': return 'En Proceso';
    default:            return 'Sin clasificar';
  }
}

export function validateRegistroActividadForm(
  data: Partial<RegistroActividadFormData>
): string[] {
  const errors: string[] = [];

  if (!data.activity_subtype_id) {
    errors.push('El tipo de trámite es obligatorio');
  }

  if (!data.agente_usuario_id) {
    errors.push('El agente es obligatorio');
  }

  if (!data.insurance_type_id) {
    errors.push('El tipo de seguro es obligatorio');
  }

  if (!data.insurers || data.insurers.length === 0) {
    errors.push('Debe seleccionar al menos una aseguradora');
  }

  if (!data.attending_user_id) {
    errors.push('Quién atiende es obligatorio');
  }

  if (!data.request_datetime) {
    errors.push('La fecha y hora de solicitud es obligatoria');
  }

  if (!data.estatus_nombre) {
    errors.push('El estatus es obligatorio');
  }

  if (
    isEstatusFinal(data.estatus_nombre ?? '') &&
    !data.completion_datetime
  ) {
    errors.push('Cuando el trámite es final (Emitido/No Emitido) debe especificar la fecha de finalización');
  }

  if (
    data.completion_datetime &&
    data.request_datetime &&
    new Date(data.completion_datetime) < new Date(data.request_datetime)
  ) {
    errors.push('La fecha de finalización no puede ser anterior a la fecha de solicitud');
  }

  return errors;
}
