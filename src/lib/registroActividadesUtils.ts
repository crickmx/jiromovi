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

  return ['Empleado', 'Gerente', 'Administrador'].includes(data.rol);
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
  try {
    // Obtener el siguiente folio
    const { data: folioData, error: folioError } = await supabase
      .rpc('generate_next_folio');

    if (folioError) {
      console.error('Error generating folio:', folioError);
      throw new Error('Error al generar el folio: ' + folioError.message);
    }

    const folio = folioData || `RA-${Date.now()}`;

    // Obtener estatus por defecto (primer estatus activo)
    const { data: estatusData, error: estatusError } = await supabase
      .from('ticket_estatus')
      .select('id')
      .eq('activo', true)
      .order('orden')
      .limit(1)
      .single();

    if (estatusError || !estatusData) {
      console.error('Error getting default status:', estatusError);
      throw new Error('No se encontró un estatus válido');
    }

    const ticketData = {
      folio,
      tipo_tramite: 'registro_actividad',
      activity_subtype_id: data.activity_subtype_id,
      requester_user_id: data.requester_user_id,
      insurance_type_id: data.insurance_type_id,
      insurers: data.insurers,
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

    console.log('Creating ticket with data:', ticketData);

    const { data: ticket, error } = await supabase
      .from('tickets')
      .insert(ticketData)
      .select()
      .single();

    if (error) {
      console.error('Error creating registro actividad:', error);
      throw new Error('Error al crear el registro: ' + (error.message || 'Error desconocido'));
    }

    if (!ticket) {
      throw new Error('No se pudo crear el registro');
    }

    console.log('Ticket created successfully:', ticket);
    return ticket;
  } catch (error: any) {
    console.error('Exception in createRegistroActividad:', error);
    throw error;
  }
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
