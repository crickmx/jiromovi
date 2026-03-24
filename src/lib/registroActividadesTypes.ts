/**
 * Tipos TypeScript para el módulo de Registro de Actividades
 */

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
  agente_usuario_id: string; // Campo unificado: antes era requester_user_id
  insurance_type_id: string;
  insurers: string[]; // Array de UUIDs de aseguradoras
  attending_user_id: string;
  request_datetime: string;
  completion_datetime?: string;
  progress_percent: 0 | 50 | 100; // Iniciado, En Proceso, Terminado
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

// DEPRECADO: Los estatus ahora se obtienen dinámicamente de la base de datos
// usando getTicketEstatus() en registroActividadesUtils.ts
// Se mantienen estas constantes solo para compatibilidad con código existente

// Opciones de estatus para tipo "Cotización / Emisión"
export const COTIZACION_EMISION_STATUS_OPTIONS = [
  { value: 'Iniciado', label: 'Iniciado', color: '#6b7280', resultado: 'en_progreso' },
  { value: 'En Proceso', label: 'En Proceso', color: '#f59e0b', resultado: 'en_progreso' },
  { value: 'Emitido', label: 'Emitido', color: '#10b981', resultado: 'ganado' },
  { value: 'No Emitido', label: 'No Emitido', color: '#ef4444', resultado: 'perdido' }
] as const;

// Opciones de estatus genéricas para tipo "Otro"
export const PROGRESS_OPTIONS = [
  { value: 0, label: 'Iniciado' },
  { value: 50, label: 'En Proceso' },
  { value: 100, label: 'Terminado' }
] as const;

export function getProgressLabel(percent: number): string {
  if (percent === 0) return 'Iniciado';
  if (percent === 100) return 'Terminado';
  return 'En Proceso';
}

export function getStatusFromProgress(percent: number): string {
  if (percent === 0) return 'Pendiente';
  if (percent === 100) return 'Finalizado';
  return 'En proceso';
}

// Helper para determinar si un tipo de trámite es "Cotización / Emisión"
export function isCotizacionEmisionType(activityTypeName: string): boolean {
  const normalized = activityTypeName.toLowerCase();
  return normalized.includes('cotizaci') || normalized.includes('emisi');
}

// Helper para obtener el color según el resultado
export function getResultadoColor(resultado: string | null): string {
  switch (resultado) {
    case 'ganado':
      return '#10b981'; // Verde
    case 'perdido':
      return '#ef4444'; // Rojo
    case 'en_progreso':
      return '#f59e0b'; // Naranja
    default:
      return '#6b7280'; // Gris
  }
}

// Helper para obtener el label según el resultado
export function getResultadoLabel(resultado: string | null): string {
  switch (resultado) {
    case 'ganado':
      return 'Emitido';
    case 'perdido':
      return 'No Emitido';
    case 'en_progreso':
      return 'En Proceso';
    default:
      return 'Sin clasificar';
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

  if (data.progress_percent === undefined || data.progress_percent === null) {
    errors.push('El avance es obligatorio');
  }

  if (
    data.progress_percent === 100 &&
    !data.completion_datetime
  ) {
    errors.push('Cuando el avance es 100%, debe especificar la fecha de finalización');
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
