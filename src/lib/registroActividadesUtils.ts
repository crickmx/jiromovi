/**
 * Utilidades para el módulo de Registro de Actividades
 */

import { supabase } from './supabase';
import type {
  TramiteActivityType,
  InsuranceType,
  Aseguradora,
  UsuarioOficina
} from './registroActividadesTypes';

/**
 * Verifica si el usuario actual puede acceder a Registro de Actividades
 */
export async function canAccessRegistroActividades(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data } = await supabase
    .from('usuarios')
    .select('rol')
    .eq('id', user.id)
    .single();

  if (!data) return false;

  // Roles permitidos con mayúscula inicial como están en la BD
  const rolesPermitidos = ['Empleado', 'Gerente', 'Administrador'];
  return rolesPermitidos.includes(data.rol);
}

/**
 * Obtiene todos los tipos de trámite activos
 */
export async function getTramiteActivityTypes(): Promise<TramiteActivityType[]> {
  const { data, error } = await supabase
    .from('tramite_activity_types')
    .select('*')
    .eq('activo', true)
    .order('nombre');

  if (error) {
    console.error('Error loading activity types:', error);
    return [];
  }

  return data || [];
}

/**
 * Obtiene todos los tipos de seguro activos
 */
export async function getInsuranceTypes(): Promise<InsuranceType[]> {
  const { data, error } = await supabase
    .from('insurance_types')
    .select('*')
    .eq('activo', true)
    .order('nombre');

  if (error) {
    console.error('Error loading insurance types:', error);
    return [];
  }

  return data || [];
}

/**
 * Obtiene todas las aseguradoras activas
 */
export async function getAseguradoras(): Promise<Aseguradora[]> {
  const { data, error } = await supabase
    .from('aseguradoras')
    .select('*')
    .eq('activo', true)
    .order('nombre');

  if (error) {
    console.error('Error loading aseguradoras:', error);
    return [];
  }

  return data || [];
}

/**
 * Obtiene usuarios de la oficina que pueden ser solicitantes
 */
export async function getOfficeUsersForRequester(): Promise<UsuarioOficina[]> {
  const { data, error } = await supabase
    .rpc('get_office_users_for_requester');

  if (error) {
    console.error('Error loading office users:', error);
    return [];
  }

  return data || [];
}

/**
 * Obtiene usuarios que pueden atender (Empleado, Gerente, Admin)
 */
export async function getUsersWhoCanAttend(): Promise<UsuarioOficina[]> {
  const { data, error } = await supabase
    .rpc('get_users_who_can_attend');

  if (error) {
    console.error('Error loading users who can attend:', error);
    return [];
  }

  return data || [];
}

/**
 * Crea un nuevo registro de actividad
 */
export async function createRegistroActividad(data: {
  activity_subtype_id: string;
  requester_user_id: string;
  insurance_type_id: string;
  insurers: string[];
  attending_user_id: string;
  request_datetime: string;
  completion_datetime?: string;
  progress_percent: number;
  prioridad: string;
  instrucciones: string;
  creado_por: string;
}) {
  // Obtener el siguiente folio
  const { data: folioData } = await supabase
    .rpc('generate_next_folio');

  const folio = folioData || `RA-${Date.now()}`;

  // Obtener estatus por defecto (primer estatus activo)
  const { data: estatusData } = await supabase
    .from('ticket_estatus')
    .select('id')
    .eq('activo', true)
    .order('orden')
    .limit(1)
    .single();

  if (!estatusData) {
    throw new Error('No se encontró un estatus válido');
  }

  const ticketData = {
    folio,
    tipo_tramite: 'registro_actividad',
    activity_subtype_id: data.activity_subtype_id,
    requester_user_id: data.requester_user_id,
    insurance_type_id: data.insurance_type_id,
    insurers: JSON.stringify(data.insurers),
    attending_user_id: data.attending_user_id,
    request_datetime: data.request_datetime,
    completion_datetime: data.completion_datetime || null,
    progress_percent: data.progress_percent,
    prioridad: data.prioridad,
    instrucciones: data.instrucciones,
    estatus_id: estatusData.id,
    creado_por: data.creado_por,
    assigned_to_user_id: data.attending_user_id,
  };

  const { data: ticket, error } = await supabase
    .from('tickets')
    .insert(ticketData)
    .select()
    .single();

  if (error) {
    console.error('Error creating registro actividad:', error);
    throw error;
  }

  return ticket;
}

/**
 * Actualiza un registro de actividad existente
 */
export async function updateRegistroActividad(
  ticketId: string,
  data: {
    activity_subtype_id?: string;
    requester_user_id?: string;
    insurance_type_id?: string;
    insurers?: string[];
    attending_user_id?: string;
    request_datetime?: string;
    completion_datetime?: string;
    progress_percent?: number;
    prioridad?: string;
    instrucciones?: string;
  }
) {
  const updateData: any = {
    ...data,
    ultima_modificacion: new Date().toISOString(),
  };

  if (data.insurers) {
    updateData.insurers = JSON.stringify(data.insurers);
  }

  if (data.attending_user_id) {
    updateData.assigned_to_user_id = data.attending_user_id;
  }

  const { data: ticket, error } = await supabase
    .from('tickets')
    .update(updateData)
    .eq('id', ticketId)
    .select()
    .single();

  if (error) {
    console.error('Error updating registro actividad:', error);
    throw error;
  }

  return ticket;
}

/**
 * Formatea una fecha para input datetime-local
 */
export function formatDateTimeForInput(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Formatea una fecha desde input datetime-local a ISO string
 */
export function formatDateTimeFromInput(dateTimeLocal: string): string {
  return new Date(dateTimeLocal).toISOString();
}
