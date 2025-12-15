import { supabase } from './supabase';
import type {
  CRMContacto,
  CRMCotizacion,
  CRMPoliza,
  CRMTarea,
  CRMNota,
  CRMCampoPersonalizado,
  CRMEtiqueta,
  CRMFuenteOrigen,
  TimelineItem,
  DashboardStats,
  FunnelData,
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

export async function obtenerUrlArchivoCRM(path: string) {
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
