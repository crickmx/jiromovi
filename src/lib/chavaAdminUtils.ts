import { supabase } from './supabase';

export interface ChavaStats {
  total_documentos: number;
  total_fragmentos: number;
  total_carpetas: number;
  total_modulos: number;
  consultas_hoy: number;
  consultas_semana: number;
  consultas_mes: number;
  tokens_mes: number;
  errores_semana: number;
  satisfaccion_promedio: number;
  documentos_pendientes: number;
  jobs_activos: number;
}

export interface ChavaCarpeta {
  id: string;
  nombre: string;
  descripcion: string;
  carpeta_padre_id: string | null;
  icono: string;
  orden: number;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChavaDocumento {
  id: string;
  carpeta_id: string | null;
  titulo: string;
  descripcion: string;
  archivo_url: string | null;
  archivo_nombre: string | null;
  archivo_tipo: string | null;
  archivo_tamano: number;
  estado: 'pending' | 'processing' | 'ready' | 'error';
  version: number;
  acceso: string;
  contenido_extraido: string | null;
  total_fragmentos: number;
  subido_por: string | null;
  created_at: string;
  updated_at: string;
  carpeta?: ChavaCarpeta;
}

export interface ChavaModulo {
  id: string;
  nombre: string;
  ruta: string | null;
  descripcion: string;
  categoria: string;
  roles_permitidos: string[];
  funcionalidades: any[];
  relaciones: any[];
  ultima_indexacion: string | null;
  activo: boolean;
  created_at: string;
}

export interface ChavaConfigItem {
  id: string;
  clave: string;
  valor: any;
  descripcion: string;
  updated_at: string;
}

export interface ChavaConsultaLog {
  id: string;
  usuario_id: string | null;
  conversacion_id: string | null;
  pregunta: string | null;
  respuesta: string | null;
  fuentes_utilizadas: any[];
  tokens_entrada: number;
  tokens_salida: number;
  modelo: string | null;
  tiempo_respuesta_ms: number;
  satisfaccion: number | null;
  error: string | null;
  created_at: string;
  usuario?: { nombre_completo: string; rol: string } | null;
}

export interface ChavaEntrenamientoJob {
  id: string;
  tipo: string;
  referencia_id: string | null;
  estado: string;
  progreso: number;
  resultado: any;
  iniciado_por: string | null;
  iniciado_at: string | null;
  completado_at: string | null;
  error: string | null;
  created_at: string;
}

// === Stats ===
export async function getChavaStats(): Promise<ChavaStats | null> {
  const { data, error } = await supabase.rpc('get_chava_stats');
  if (error) {
    console.error('Error fetching chava stats:', error);
    return null;
  }
  return data as ChavaStats;
}

// === Folders ===
export async function getCarpetas(): Promise<ChavaCarpeta[]> {
  const { data } = await supabase
    .from('chava_carpetas')
    .select('*')
    .order('orden', { ascending: true });
  return data || [];
}

export async function createCarpeta(carpeta: Partial<ChavaCarpeta>): Promise<ChavaCarpeta | null> {
  const { data, error } = await supabase
    .from('chava_carpetas')
    .insert(carpeta)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateCarpeta(id: string, updates: Partial<ChavaCarpeta>): Promise<void> {
  const { error } = await supabase
    .from('chava_carpetas')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteCarpeta(id: string): Promise<void> {
  const { error } = await supabase
    .from('chava_carpetas')
    .update({ activo: false, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

// === Documents ===
export async function getDocumentos(carpetaId?: string): Promise<ChavaDocumento[]> {
  let query = supabase
    .from('chava_documentos')
    .select('*, carpeta:chava_carpetas(nombre)')
    .order('created_at', { ascending: false });

  if (carpetaId) {
    query = query.eq('carpeta_id', carpetaId);
  }

  const { data } = await query;
  return data || [];
}

export async function createDocumento(doc: Partial<ChavaDocumento>): Promise<ChavaDocumento | null> {
  const { data, error } = await supabase
    .from('chava_documentos')
    .insert(doc)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateDocumento(id: string, updates: Partial<ChavaDocumento>): Promise<void> {
  const { error } = await supabase
    .from('chava_documentos')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteDocumento(id: string): Promise<void> {
  const { error } = await supabase
    .from('chava_documentos')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function processDocumento(documentoId: string): Promise<any> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chava-process-document`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ documento_id: documentoId }),
    }
  );

  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Processing failed');
  return result;
}

export async function uploadDocumentFile(file: File, carpetaId?: string): Promise<string> {
  const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const filePath = carpetaId ? `${carpetaId}/${fileName}` : `general/${fileName}`;

  const { error } = await supabase.storage
    .from('chava-knowledge')
    .upload(filePath, file);

  if (error) throw error;

  const { data: urlData } = supabase.storage
    .from('chava-knowledge')
    .getPublicUrl(filePath);

  return urlData.publicUrl || filePath;
}

// === Modules ===
export async function getModulosDescubiertos(): Promise<ChavaModulo[]> {
  const { data } = await supabase
    .from('chava_modulos_descubiertos')
    .select('*')
    .eq('activo', true)
    .order('categoria', { ascending: true });
  return data || [];
}

// === Config ===
export async function getChavaConfig(): Promise<ChavaConfigItem[]> {
  const { data } = await supabase
    .from('chava_configuracion')
    .select('*')
    .order('clave', { ascending: true });
  return data || [];
}

export async function updateChavaConfig(clave: string, valor: any): Promise<void> {
  const { error } = await supabase
    .from('chava_configuracion')
    .update({ valor: JSON.stringify(valor), updated_at: new Date().toISOString() })
    .eq('clave', clave);
  if (error) throw error;
}

// === Audit Log ===
export async function getConsultasLog(limit = 50, offset = 0): Promise<ChavaConsultaLog[]> {
  const { data } = await supabase
    .from('chava_consultas_log')
    .select('*, usuario:usuarios(nombre_completo, rol)')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  return data || [];
}

// === Training Jobs ===
export async function getEntrenamientoJobs(): Promise<ChavaEntrenamientoJob[]> {
  const { data } = await supabase
    .from('chava_entrenamiento_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
  return data || [];
}

export async function createEntrenamientoJob(
  tipo: string,
  referenciaId?: string
): Promise<ChavaEntrenamientoJob | null> {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('chava_entrenamiento_jobs')
    .insert({
      tipo,
      referencia_id: referenciaId || null,
      estado: 'pending',
      iniciado_por: user?.id,
      iniciado_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}
