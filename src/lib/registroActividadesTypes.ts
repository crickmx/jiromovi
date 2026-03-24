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
