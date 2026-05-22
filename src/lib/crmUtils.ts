import { supabase } from './supabase';
import type {
  CRMContacto,
  CRMCotizacion,
  CRMPoliza,
  CRMTarea,
  CRMTareaAdjunto,
  CRMNota,
  CRMCampoPersonalizado,
  CRMEtiqueta,
  CRMFuenteOrigen,
  TimelineItem,
  DashboardStats,
  FunnelData,
  CRMBoardListItem,
  CRMBoardMemberDetail,
  MemberRole,
  SearchableUser,
} from './crmTypes';

export async function obtenerContactos() {
  const { data, error } = await supabase
    .from('crm_contactos')
    .select('*')
    .order('fecha_creacion', { ascending: false });

  if (error) throw error;
  return data as CRMContacto[];
}

export async function obtenerContactoPorId(id: string) {
  const { data, error } = await supabase
    .from('crm_contactos')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as CRMContacto;
}

export async function crearContacto(contacto: Partial<CRMContacto>, userId: string) {
  const { data, error } = await supabase
    .from('crm_contactos')
    .insert({
      ...contacto,
      creado_por: userId,
    })
    .select()
    .single();

  if (error) throw error;
  return data as CRMContacto;
}

export async function actualizarContacto(id: string, contacto: Partial<CRMContacto>) {
  const { data, error } = await supabase
    .from('crm_contactos')
    .update(contacto)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as CRMContacto;
}

export async function eliminarContacto(id: string) {
  const { error } = await supabase.from('crm_contactos').delete().eq('id', id);

  if (error) throw error;
}

export async function obtenerCotizacionesPorContacto(contactoId: string) {
  const { data, error } = await supabase
    .from('crm_cotizaciones')
    .select('*')
    .eq('contacto_id', contactoId)
    .order('fecha_presentacion', { ascending: false });

  if (error) throw error;
  return data as CRMCotizacion[];
}

export async function crearCotizacion(cotizacion: Partial<CRMCotizacion>, userId: string) {
  const { data, error } = await supabase
    .from('crm_cotizaciones')
    .insert({
      ...cotizacion,
      creado_por: userId,
    })
    .select()
    .single();

  if (error) throw error;
  return data as CRMCotizacion;
}

export async function actualizarCotizacion(id: string, cotizacion: Partial<CRMCotizacion>) {
  const { data, error } = await supabase
    .from('crm_cotizaciones')
    .update(cotizacion)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as CRMCotizacion;
}

export async function eliminarCotizacion(id: string) {
  const { error } = await supabase.from('crm_cotizaciones').delete().eq('id', id);

  if (error) throw error;
}

export async function obtenerPolizasPorContacto(contactoId: string) {
  const { data, error } = await supabase
    .from('crm_polizas')
    .select('*')
    .eq('contacto_id', contactoId)
    .order('fecha_emision', { ascending: false });

  if (error) throw error;
  return data as CRMPoliza[];
}

export async function crearPoliza(poliza: Partial<CRMPoliza>, userId: string) {
  const { data, error } = await supabase
    .from('crm_polizas')
    .insert({
      ...poliza,
      creado_por: userId,
    })
    .select()
    .single();

  if (error) throw error;
  return data as CRMPoliza;
}

export async function actualizarPoliza(id: string, poliza: Partial<CRMPoliza>) {
  const { data, error } = await supabase
    .from('crm_polizas')
    .update(poliza)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as CRMPoliza;
}

export async function eliminarPoliza(id: string) {
  const { error } = await supabase.from('crm_polizas').delete().eq('id', id);

  if (error) throw error;
}

export async function obtenerTareasPorContacto(contactoId: string) {
  const { data, error } = await supabase
    .from('crm_tareas')
    .select('*')
    .eq('contacto_id', contactoId)
    .order('fecha_vencimiento', { ascending: true });

  if (error) throw error;
  return data as CRMTarea[];
}

export async function obtenerTareasPendientes(limite: number = 5) {
  const { data, error } = await supabase
    .from('crm_tareas')
    .select('*, crm_contactos(nombre_completo)')
    .eq('completada', false)
    .order('fecha_vencimiento', { ascending: true })
    .limit(limite);

  if (error) throw error;
  return data;
}

export async function crearTarea(tarea: Partial<CRMTarea>, userId: string) {
  const { data, error } = await supabase
    .from('crm_tareas')
    .insert({
      ...tarea,
      creado_por: userId,
    })
    .select()
    .single();

  if (error) throw error;
  return data as CRMTarea;
}

export async function actualizarTarea(id: string, tarea: Partial<CRMTarea>) {
  const { data, error } = await supabase
    .from('crm_tareas')
    .update(tarea)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as CRMTarea;
}

export async function eliminarTarea(id: string) {
  const { error } = await supabase.from('crm_tareas').delete().eq('id', id);

  if (error) throw error;
}

// ========================================
// FUNCIONES DE ADJUNTOS DE TAREAS
// ========================================

export async function obtenerAdjuntosTarea(tareaId: string) {
  const { data, error } = await supabase
    .from('crm_tareas_adjuntos')
    .select('*')
    .eq('tarea_id', tareaId)
    .order('creado_en', { ascending: true });

  if (error) throw error;
  return data as CRMTareaAdjunto[];
}

export async function subirAdjuntoTarea(
  tareaId: string,
  archivo: File,
  userId: string
): Promise<CRMTareaAdjunto> {
  // 1. Verificar que no se exceda el límite de 5 adjuntos
  const adjuntosActuales = await obtenerAdjuntosTarea(tareaId);
  if (adjuntosActuales.length >= 5) {
    throw new Error('No se pueden agregar más de 5 adjuntos por tarea');
  }

  // 2. Validar tamaño del archivo (máximo 50MB)
  const MAX_SIZE = 50 * 1024 * 1024; // 50MB
  if (archivo.size > MAX_SIZE) {
    throw new Error('El archivo no puede superar los 50MB');
  }

  // 3. Subir archivo a storage
  const fileExt = archivo.name.split('.').pop();
  const fileName = `${userId}/${tareaId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from('crm-tareas-adjuntos')
    .upload(fileName, archivo);

  if (uploadError) throw uploadError;

  // 4. Obtener URL pública del archivo
  const { data: urlData } = supabase.storage
    .from('crm-tareas-adjuntos')
    .getPublicUrl(fileName);

  // 5. Crear registro en la tabla
  const { data, error } = await supabase
    .from('crm_tareas_adjuntos')
    .insert({
      tarea_id: tareaId,
      nombre_archivo: archivo.name,
      archivo_url: urlData.publicUrl,
      tipo_mime: archivo.type,
      tamano_bytes: archivo.size,
      subido_por: userId,
    })
    .select()
    .single();

  if (error) throw error;
  return data as CRMTareaAdjunto;
}

export async function eliminarAdjuntoTarea(adjuntoId: string) {
  // 1. Obtener información del adjunto
  const { data: adjunto, error: fetchError } = await supabase
    .from('crm_tareas_adjuntos')
    .select('archivo_url')
    .eq('id', adjuntoId)
    .single();

  if (fetchError) throw fetchError;
  if (!adjunto) throw new Error('Adjunto no encontrado');

  // 2. Extraer el path del archivo desde la URL
  const url = new URL(adjunto.archivo_url);
  const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/crm-tareas-adjuntos\/(.+)/);

  if (pathMatch && pathMatch[1]) {
    const filePath = pathMatch[1];

    // 3. Eliminar archivo de storage
    const { error: deleteFileError } = await supabase.storage
      .from('crm-tareas-adjuntos')
      .remove([filePath]);

    if (deleteFileError) {
      console.error('Error al eliminar archivo de storage:', deleteFileError);
    }
  }

  // 4. Eliminar registro de la base de datos
  const { error: deleteDbError } = await supabase
    .from('crm_tareas_adjuntos')
    .delete()
    .eq('id', adjuntoId);

  if (deleteDbError) throw deleteDbError;
}

export async function descargarAdjuntoTarea(adjunto: CRMTareaAdjunto) {
  // Extraer el path del archivo desde la URL
  const url = new URL(adjunto.archivo_url);
  const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/crm-tareas-adjuntos\/(.+)/);

  if (!pathMatch || !pathMatch[1]) {
    throw new Error('No se pudo obtener el path del archivo');
  }

  const filePath = pathMatch[1];

  // Descargar el archivo
  const { data, error } = await supabase.storage
    .from('crm-tareas-adjuntos')
    .download(filePath);

  if (error) throw error;
  if (!data) throw new Error('No se pudo descargar el archivo');

  // Crear un objeto URL y descargarlo
  const blob = new Blob([data], { type: adjunto.tipo_mime || 'application/octet-stream' });
  const blobUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = adjunto.nombre_archivo;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(blobUrl);
}

export async function obtenerNotasPorContacto(contactoId: string) {
  const { data, error } = await supabase
    .from('crm_notas')
    .select('*, usuarios(nombre, apellidos)')
    .eq('contacto_id', contactoId)
    .order('creado_en', { ascending: false });

  if (error) throw error;
  return data;
}

export async function crearNota(nota: Partial<CRMNota>, userId: string) {
  const { data, error } = await supabase
    .from('crm_notas')
    .insert({
      ...nota,
      creado_por: userId,
    })
    .select()
    .single();

  if (error) throw error;
  return data as CRMNota;
}

export async function eliminarNota(id: string) {
  const { error } = await supabase.from('crm_notas').delete().eq('id', id);

  if (error) throw error;
}

export async function obtenerCamposPersonalizados() {
  const { data, error } = await supabase
    .from('crm_campos_personalizados')
    .select('*')
    .eq('activo', true)
    .order('orden', { ascending: true });

  if (error) throw error;
  return data as CRMCampoPersonalizado[];
}

export async function obtenerEtiquetas() {
  const { data, error } = await supabase
    .from('crm_etiquetas')
    .select('*')
    .eq('activo', true)
    .order('nombre', { ascending: true });

  if (error) throw error;
  return data as CRMEtiqueta[];
}

export async function obtenerFuentesOrigen() {
  const { data, error } = await supabase
    .from('crm_fuentes_origen')
    .select('*')
    .eq('activo', true)
    .order('nombre', { ascending: true });

  if (error) throw error;
  return data as CRMFuenteOrigen[];
}

export async function obtenerTimelinePorContacto(contactoId: string): Promise<TimelineItem[]> {
  const [cotizaciones, polizas, tareas, notas] = await Promise.all([
    obtenerCotizacionesPorContacto(contactoId),
    obtenerPolizasPorContacto(contactoId),
    obtenerTareasPorContacto(contactoId),
    obtenerNotasPorContacto(contactoId),
  ]);

  const timeline: TimelineItem[] = [];

  cotizaciones.forEach((cot) => {
    timeline.push({
      id: cot.id,
      tipo: 'cotizacion',
      titulo: `Cotización: ${cot.nombre_documento}`,
      descripcion: `Estatus: ${cot.estatus_cotizacion}`,
      fecha: cot.fecha_presentacion,
      icono: 'FileText',
      color: 'blue',
    });
  });

  polizas.forEach((pol) => {
    timeline.push({
      id: pol.id,
      tipo: 'poliza',
      titulo: `Póliza: ${pol.numero_poliza}`,
      descripcion: `${pol.tipo_ramo} - ${pol.compania_aseguradora}`,
      fecha: pol.fecha_emision,
      icono: 'Shield',
      color: 'green',
    });
  });

  tareas
    .filter((t) => t.completada)
    .forEach((tarea) => {
      timeline.push({
        id: tarea.id,
        tipo: 'tarea',
        titulo: `Tarea completada: ${tarea.tipo_actividad}`,
        descripcion: tarea.descripcion,
        fecha: tarea.fecha_completado || tarea.creado_en,
        icono: 'CheckCircle',
        color: 'purple',
      });
    });

  notas.forEach((nota) => {
    timeline.push({
      id: nota.id,
      tipo: 'nota',
      titulo: 'Nota',
      descripcion: nota.contenido,
      fecha: nota.creado_en,
      icono: 'MessageSquare',
      color: 'gray',
    });
  });

  return timeline.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
}

export async function obtenerEstadisticasDashboard(): Promise<DashboardStats> {
  const [contactos, cotizaciones, polizas] = await Promise.all([
    supabase.from('crm_contactos').select('estatus'),
    supabase.from('crm_cotizaciones').select('id'),
    supabase.from('crm_polizas').select('prima_total'),
  ]);

  const totalContactos = contactos.data?.length || 0;
  const totalProspectos = contactos.data?.filter((c) => c.estatus === 'Prospecto').length || 0;
  const totalClientes = contactos.data?.filter((c) => c.estatus === 'Cliente').length || 0;
  const totalCotizaciones = cotizaciones.data?.length || 0;
  const totalPolizas = polizas.data?.length || 0;
  const primaTotal =
    polizas.data?.reduce((sum, p) => sum + (parseFloat(p.prima_total as any) || 0), 0) || 0;
  const tasaConversion = totalContactos > 0 ? (totalClientes / totalContactos) * 100 : 0;

  return {
    totalContactos,
    totalProspectos,
    totalClientes,
    totalCotizaciones,
    totalPolizas,
    primaTotal,
    tasaConversion,
  };
}

export async function obtenerDatosFunnel(): Promise<FunnelData> {
  const { data } = await supabase.from('crm_contactos').select('estatus');

  const contactos = data || [];

  return {
    prospectos: contactos.filter((c) => c.estatus === 'Prospecto').length,
    cotizacionPresentada: contactos.filter((c) => c.estatus === 'Cotización Presentada').length,
    negociacion: contactos.filter((c) => c.estatus === 'Negociación').length,
    clientes: contactos.filter((c) => c.estatus === 'Cliente').length,
  };
}

export async function subirArchivoCRM(file: File, path: string) {
  const { data, error } = await supabase.storage.from('crm-documentos').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });

  if (error) throw error;
  return data;
}

export function obtenerUrlArchivoCRM(path: string) {
  const { data } = supabase.storage.from('crm-documentos').getPublicUrl(path);
  return data.publicUrl;
}

export async function descargarArchivoCRM(path: string, nombreArchivo: string) {
  const { data, error } = await supabase.storage.from('crm-documentos').download(path);

  if (error) throw error;

  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function abrirArchivoCRM(path: string) {
  const url = obtenerUrlArchivoCRM(path);
  window.open(url, '_blank');
}

export async function eliminarArchivoCRM(path: string) {
  const { error } = await supabase.storage.from('crm-documentos').remove([path]);
  if (error) throw error;
}

export function esCumpleanosHoy(fecha_nacimiento?: string): boolean {
  if (!fecha_nacimiento) return false;

  const today = new Date();
  const birthDate = new Date(fecha_nacimiento);

  return (
    birthDate.getDate() === today.getDate() &&
    birthDate.getMonth() === today.getMonth()
  );
}

export function formatearFechaNacimiento(fecha_nacimiento?: string): string {
  if (!fecha_nacimiento) return '';

  const birthDate = new Date(fecha_nacimiento);
  const day = birthDate.getDate();
  const month = birthDate.getMonth() + 1;

  return `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}`;
}

export function calcularEdad(fecha_nacimiento?: string): number | null {
  if (!fecha_nacimiento) return null;

  const today = new Date();
  const birthDate = new Date(fecha_nacimiento);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return age;
}

// ============================================================
// TABLEROS COMPARTIDOS - SHARED BOARDS
// ============================================================

export async function listarTableros(): Promise<CRMBoardListItem[]> {
  const { data, error } = await supabase.rpc('crm_list_boards_for_user');

  if (error) throw error;
  return (data || []) as CRMBoardListItem[];
}

export async function crearTablero(name: string, ownerOfficeId?: string): Promise<string> {
  const { data, error } = await supabase.rpc('crm_create_board', {
    p_name: name,
    p_owner_office_id: ownerOfficeId || null,
  });

  if (error) throw error;
  return data as string;
}

export async function invitarMiembro(
  boardId: string,
  userId: string,
  memberRole: MemberRole
): Promise<string> {
  const { data, error } = await supabase.rpc('crm_invite_member', {
    p_board_id: boardId,
    p_user_id: userId,
    p_member_role: memberRole,
  });

  if (error) throw error;
  return data as string;
}

export async function actualizarRolMiembro(
  boardId: string,
  userId: string,
  newRole: MemberRole
): Promise<boolean> {
  const { data, error } = await supabase.rpc('crm_update_member_role', {
    p_board_id: boardId,
    p_user_id: userId,
    p_new_role: newRole,
  });

  if (error) throw error;
  return data as boolean;
}

export async function removerMiembro(boardId: string, userId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('crm_remove_member', {
    p_board_id: boardId,
    p_user_id: userId,
  });

  if (error) throw error;
  return data as boolean;
}

export async function obtenerMiembrosTablero(boardId: string): Promise<CRMBoardMemberDetail[]> {
  const { data, error } = await supabase.rpc('crm_get_board_members', {
    p_board_id: boardId,
  });

  if (error) throw error;
  return (data || []) as CRMBoardMemberDetail[];
}

export async function buscarUsuariosParaCompartir(query: string): Promise<SearchableUser[]> {
  const { data, error } = await supabase
    .from('usuarios')
    .select(
      `
      id,
      nombre,
      apellidos,
      rol,
      oficina_id,
      imagen_perfil_url,
      oficinas!inner(nombre)
    `
    )
    .or(
      `nombre.ilike.%${query}%,apellidos.ilike.%${query}%,email_laboral.ilike.%${query}%`
    )
    .in('rol', ['Empleado', 'Gerente', 'Administrador'])
    .eq('activo', true)
    .limit(20);

  if (error) throw error;

  return (
    data?.map((u: any) => ({
      id: u.id,
      nombre_completo: `${u.nombre} ${u.apellidos}`,
      oficina_nombre: u.oficinas?.nombre || 'Sin oficina',
      rol: u.rol,
      avatar_url: u.imagen_perfil_url,
    })) || []
  );
}

export async function eliminarTablero(boardId: string): Promise<void> {
  const { error } = await supabase
    .from('crm_boards')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', boardId);

  if (error) throw error;
}

export async function renombrarTablero(boardId: string, newName: string): Promise<void> {
  const { error } = await supabase
    .from('crm_boards')
    .update({ name: newName })
    .eq('id', boardId);

  if (error) throw error;
}

// ============================================================
// ENHANCED DASHBOARD FUNCTIONS
// ============================================================

export interface CRMDashboardKPIs {
  leadsNuevos: number;
  leadsContactados: number;
  tareasVencidas: number;
  tareasHoy: number;
  sinSeguimiento: number;
}

export interface CRMUserPreferences {
  id?: string;
  default_view: string;
  dashboard_blocks: string[];
  table_columns: string[];
  saved_filters: any[];
  no_contact_hours: number;
  automations_active: boolean;
}

export async function obtenerKPIsDashboard(): Promise<CRMDashboardKPIs> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();
  const hace24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const [contactosRes, tareasRes] = await Promise.all([
    supabase.from('crm_contactos').select('id, estatus, fecha_creacion, actualizado_en'),
    supabase.from('crm_tareas').select('id, fecha_vencimiento, completada, estatus').eq('completada', false),
  ]);

  const contactos = contactosRes.data || [];
  const tareas = tareasRes.data || [];

  const leadsNuevos = contactos.filter(
    (c) => c.estatus === 'Prospecto' && c.fecha_creacion >= hace24h
  ).length;

  const leadsContactados = contactos.filter(
    (c) => c.estatus !== 'Prospecto' && c.estatus !== 'Perdido'
  ).length;

  const tareasVencidas = tareas.filter(
    (t) => new Date(t.fecha_vencimiento) < now
  ).length;

  const tareasHoy = tareas.filter((t) => {
    const fv = t.fecha_vencimiento;
    return fv >= todayStart && fv <= todayEnd;
  }).length;

  const sinSeguimiento = contactos.filter((c) => {
    if (c.estatus !== 'Prospecto') return false;
    const lastUpdate = new Date(c.actualizado_en || c.fecha_creacion);
    return (now.getTime() - lastUpdate.getTime()) > 24 * 60 * 60 * 1000;
  }).length;

  return { leadsNuevos, leadsContactados, tareasVencidas, tareasHoy, sinSeguimiento };
}

export async function obtenerTareasVencidas(limite: number = 10) {
  const { data, error } = await supabase
    .from('crm_tareas')
    .select('*, crm_contactos(nombre_completo)')
    .eq('completada', false)
    .lt('fecha_vencimiento', new Date().toISOString())
    .order('fecha_vencimiento', { ascending: true })
    .limit(limite);

  if (error) throw error;
  return data || [];
}

export async function obtenerTareasHoy(limite: number = 10) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();

  const { data, error } = await supabase
    .from('crm_tareas')
    .select('*, crm_contactos(nombre_completo)')
    .eq('completada', false)
    .gte('fecha_vencimiento', todayStart)
    .lte('fecha_vencimiento', todayEnd)
    .order('fecha_vencimiento', { ascending: true })
    .limit(limite);

  if (error) throw error;
  return data || [];
}

export async function obtenerLeadsNuevos(limite: number = 10) {
  const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('crm_contactos')
    .select('*')
    .eq('estatus', 'Prospecto')
    .gte('fecha_creacion', hace24h)
    .order('fecha_creacion', { ascending: false })
    .limit(limite);

  if (error) throw error;
  return (data || []) as CRMContacto[];
}

export async function obtenerLeadsSinSeguimiento(limite: number = 10) {
  const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('crm_contactos')
    .select('*')
    .eq('estatus', 'Prospecto')
    .lt('actualizado_en', hace24h)
    .order('actualizado_en', { ascending: true })
    .limit(limite);

  if (error) throw error;
  return (data || []) as CRMContacto[];
}

export async function obtenerPreferenciasUsuarioCRM(userId: string): Promise<CRMUserPreferences> {
  const { data, error } = await supabase
    .from('crm_user_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    return {
      default_view: 'dashboard',
      dashboard_blocks: ['leads_nuevos', 'tareas_vencidas', 'tareas_hoy', 'sin_seguimiento', 'seguimiento_cotizaciones'],
      table_columns: ['nombre_completo', 'celular', 'estatus', 'fuente_origen', 'tipo_seguro', 'fecha_creacion'],
      saved_filters: [],
      no_contact_hours: 24,
      automations_active: true,
    };
  }

  return {
    id: data.id,
    default_view: data.default_view,
    dashboard_blocks: data.dashboard_blocks || [],
    table_columns: data.table_columns || [],
    saved_filters: data.saved_filters || [],
    no_contact_hours: data.no_contact_hours,
    automations_active: data.automations_active,
  };
}

export async function guardarPreferenciasUsuarioCRM(
  userId: string,
  prefs: Partial<CRMUserPreferences>
): Promise<void> {
  const { error } = await supabase
    .from('crm_user_preferences')
    .upsert(
      { user_id: userId, ...prefs, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );

  if (error) throw error;
}

export async function completarTareaRapido(tareaId: string): Promise<void> {
  const { error } = await supabase
    .from('crm_tareas')
    .update({
      completada: true,
      estatus: 'Completada',
      fecha_completado: new Date().toISOString(),
      actualizado_en: new Date().toISOString(),
    })
    .eq('id', tareaId);

  if (error) throw error;
}

export async function reprogramarTarea(tareaId: string, nuevaFecha: string): Promise<void> {
  const { error } = await supabase
    .from('crm_tareas')
    .update({
      fecha_vencimiento: nuevaFecha,
      actualizado_en: new Date().toISOString(),
    })
    .eq('id', tareaId);

  if (error) throw error;
}

export async function cambiarEtapaContacto(
  contactoId: string,
  nuevaEtapa: string,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from('crm_contactos')
    .update({
      estatus: nuevaEtapa,
      actualizado_en: new Date().toISOString(),
      ...(nuevaEtapa === 'Cliente' ? { fecha_conversion_cliente: new Date().toISOString() } : {}),
    })
    .eq('id', contactoId);

  if (error) throw error;

  await supabase.from('crm_notas').insert({
    contacto_id: contactoId,
    contenido: `Etapa cambiada a: ${nuevaEtapa}`,
    creado_por: userId,
  });
}
