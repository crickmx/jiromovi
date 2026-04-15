/**
 * Utilidades para el módulo de Registro de Actividades
 */

import { supabase } from './supabase';
import { isEstatusFinal } from './registroActividadesTypes';
import type {
  TramiteActivityType,
  InsuranceType,
  Aseguradora,
  UsuarioOficina
} from './registroActividadesTypes';

export async function canAccessRegistroActividades(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data } = await supabase
    .from('usuarios')
    .select('rol')
    .eq('id', user.id)
    .maybeSingle();

  if (!data) return false;
  return ['Empleado', 'Gerente', 'Administrador'].includes(data.rol);
}

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

export async function getUsersByOffice(oficinaId?: string): Promise<UsuarioOficina[]> {
  let query = supabase
    .from('usuarios')
    .select(`
      id,
      nombre_completo,
      rol,
      oficina_id,
      oficinas:oficina_id (nombre)
    `)
    .eq('estado', 'activo')
    .order('nombre_completo');

  if (oficinaId) {
    query = query.eq('oficina_id', oficinaId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error loading users by office:', error);
    return [];
  }

  return (data || []).map((u: any) => ({
    id: u.id,
    nombre_completo: u.nombre_completo,
    rol: u.rol,
    oficina_id: u.oficina_id,
    oficina_nombre: u.oficinas?.nombre || null
  }));
}

export async function getUsersWhoCanAttend(): Promise<UsuarioOficina[]> {
  const { data, error } = await supabase
    .from('usuarios')
    .select(`
      id,
      nombre_completo,
      rol,
      oficina_id,
      oficinas:oficina_id (nombre)
    `)
    .eq('estado', 'activo')
    .in('rol', ['Empleado', 'Gerente', 'Administrador'])
    .order('nombre_completo');

  if (error) {
    console.error('Error loading users who can attend:', error);
    return [];
  }

  return (data || []).map((u: any) => ({
    id: u.id,
    nombre_completo: u.nombre_completo,
    rol: u.rol,
    oficina_id: u.oficina_id,
    oficina_nombre: u.oficinas?.nombre || null
  }));
}

/**
 * Obtiene los estatus de registro de actividad desde la base de datos.
 * Solo devuelve los estatus aplicables a 'registro_actividad'.
 */
export async function getTicketEstatusRegistroActividad(): Promise<Array<{
  id: string;
  nombre: string;
  color: string;
  orden: number;
}>> {
  const { data, error } = await supabase
    .from('ticket_estatus')
    .select('id, nombre, color, orden, tipo_aplicable')
    .eq('activo', true)
    .order('orden');

  if (error) {
    console.error('Error loading ticket estatus:', error);
    return [];
  }

  if (!data) return [];

  return data.filter((e: any) =>
    !e.tipo_aplicable ||
    e.tipo_aplicable.includes('registro_actividad')
  );
}

/**
 * Backward-compatible alias used in old call sites
 */
export async function getTicketEstatus(tipoTramite?: string): Promise<Array<{
  id: string;
  nombre: string;
  color: string;
  orden: number;
}>> {
  return getTicketEstatusRegistroActividad();
}

export async function createRegistroActividad(data: {
  activity_subtype_id: string;
  agente_usuario_id: string;
  insurance_type_id: string;
  insurers: string[];
  attending_user_id: string;
  request_datetime: string;
  completion_datetime?: string;
  estatus_nombre: string;
  prioridad: string;
  instrucciones: string;
  creado_por: string;
}) {
  try {
    const { data: folioData, error: folioError } = await supabase
      .rpc('generate_next_folio');

    if (folioError) throw new Error('Error al generar el folio: ' + folioError.message);

    const folio = folioData || `RA-${Date.now()}`;

    const { data: estatusData, error: estatusError } = await supabase
      .from('ticket_estatus')
      .select('id')
      .eq('nombre', data.estatus_nombre)
      .eq('activo', true)
      .maybeSingle();

    let estatusId: string;

    if (estatusError || !estatusData) {
      const { data: defaultEstatus } = await supabase
        .from('ticket_estatus')
        .select('id')
        .eq('activo', true)
        .order('orden')
        .limit(1)
        .maybeSingle();

      if (!defaultEstatus) throw new Error('No se encontró un estatus válido');
      estatusId = defaultEstatus.id;
    } else {
      estatusId = estatusData.id;
    }

    const esFinal = isEstatusFinal(data.estatus_nombre);

    const ticketData: any = {
      folio,
      tipo_tramite: 'registro_actividad',
      activity_subtype_id: data.activity_subtype_id,
      agente_usuario_id: data.agente_usuario_id,
      insurance_type_id: data.insurance_type_id,
      insurers: data.insurers,
      attending_user_id: data.attending_user_id,
      request_datetime: data.request_datetime,
      completion_datetime: data.completion_datetime || null,
      prioridad: data.prioridad,
      instrucciones: data.instrucciones,
      estatus_id: estatusId,
      creado_por: data.creado_por,
      agente_id: data.agente_usuario_id,
      assigned_to_user_id: data.attending_user_id,
      cerrado: esFinal,
    };

    if (esFinal) {
      ticketData.fecha_cierre = data.completion_datetime || new Date().toISOString();
    }

    const { data: ticket, error } = await supabase
      .from('tickets')
      .insert(ticketData)
      .select()
      .single();

    if (error) throw new Error('Error al crear el registro: ' + (error.message || 'Error desconocido'));
    if (!ticket) throw new Error('No se pudo crear el registro');

    return ticket;
  } catch (error: any) {
    console.error('Exception in createRegistroActividad:', error);
    throw error;
  }
}

export async function updateRegistroActividad(
  ticketId: string,
  data: {
    activity_subtype_id?: string;
    agente_usuario_id?: string;
    insurance_type_id?: string;
    insurers?: string[];
    attending_user_id?: string;
    request_datetime?: string;
    completion_datetime?: string;
    estatus_nombre?: string;
    prioridad?: string;
    instrucciones?: string;
  }
) {
  const updateData: any = {
    ultima_modificacion: new Date().toISOString(),
  };

  if (data.activity_subtype_id !== undefined) updateData.activity_subtype_id = data.activity_subtype_id;
  if (data.agente_usuario_id !== undefined) {
    updateData.agente_usuario_id = data.agente_usuario_id;
    updateData.agente_id = data.agente_usuario_id;
  }
  if (data.insurance_type_id !== undefined) updateData.insurance_type_id = data.insurance_type_id;
  if (data.insurers !== undefined) updateData.insurers = data.insurers;
  if (data.attending_user_id !== undefined) {
    updateData.attending_user_id = data.attending_user_id;
    updateData.assigned_to_user_id = data.attending_user_id;
  }
  if (data.request_datetime !== undefined) updateData.request_datetime = data.request_datetime;
  if (data.completion_datetime !== undefined) updateData.completion_datetime = data.completion_datetime;
  if (data.prioridad !== undefined) updateData.prioridad = data.prioridad;
  if (data.instrucciones !== undefined) updateData.instrucciones = data.instrucciones;

  // Resolve estatus_id from nombre
  if (data.estatus_nombre) {
    const { data: estatusData } = await supabase
      .from('ticket_estatus')
      .select('id')
      .eq('nombre', data.estatus_nombre)
      .eq('activo', true)
      .maybeSingle();

    if (estatusData) {
      updateData.estatus_id = estatusData.id;
    }

    if (isEstatusFinal(data.estatus_nombre)) {
      updateData.cerrado = true;
      updateData.fecha_cierre = data.completion_datetime || new Date().toISOString();
    }
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

export function formatDateTimeForInput(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function formatDateTimeFromInput(dateTimeLocal: string): string {
  return new Date(dateTimeLocal).toISOString();
}
