import { supabase } from './supabase';

export interface TelefoniaConfig {
  id: string;
  pbx_url: string;
  api_mode: 'mock' | 'live';
  auto_sync: boolean;
  sync_interval_minutes: number;
  created_at: string;
  updated_at: string;
}

export interface TelefoniaOficinaConfig {
  id: string;
  oficina_id: string;
  rango_inicio: number;
  rango_fin: number;
  prefijo: string;
  descripcion: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
  oficina?: { nombre: string };
}

export interface TelefoniaUsuario {
  id: string;
  usuario_id: string;
  extension: string;
  tipo: 'sip' | 'iax' | 'virtual';
  estado: 'activo' | 'inactivo' | 'suspendido';
  yeastar_extension_id: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
  usuario?: { nombre: string; apellido: string; email: string; oficina_id: string };
}

export interface TelefoniaExtension {
  id: string;
  extension: string;
  oficina_id: string | null;
  nombre_display: string;
  estado: 'disponible' | 'asignada' | 'reservada' | 'fuera_servicio';
  usuario_asignado_id: string | null;
  yeastar_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  oficina?: { nombre: string };
  usuario?: { nombre: string; apellido: string };
}

export interface TelefoniaSyncLog {
  id: string;
  tipo: 'create' | 'update' | 'delete' | 'bulk_sync' | 'test_connection';
  estado: 'pendiente' | 'en_proceso' | 'completado' | 'error';
  usuario_admin_id: string | null;
  detalles: Record<string, unknown>;
  resultado: Record<string, unknown> | null;
  error_mensaje: string | null;
  created_at: string;
  completed_at: string | null;
}

// ── Edge Function Proxy ─────────────────────────────────────────────────────

async function callYeastarProxy(action: string, payload?: Record<string, unknown>): Promise<any> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('No hay sesion activa');

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const response = await fetch(`${supabaseUrl}/functions/v1/yeastar-proxy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ action, payload }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error(errData.error || `Error ${response.status}`);
  }

  return response.json();
}

// ── Config CRUD ──────────────────────────────────────────────────────────────

export async function getConfig(): Promise<TelefoniaConfig | null> {
  const { data, error } = await supabase
    .from('telefonia_config')
    .select('*')
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertConfig(config: Partial<TelefoniaConfig>): Promise<TelefoniaConfig> {
  const existing = await getConfig();
  if (existing) {
    const { data, error } = await supabase
      .from('telefonia_config')
      .update({ ...config, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase
    .from('telefonia_config')
    .insert(config)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── Office Ranges ────────────────────────────────────────────────────────────

export async function getOficinasConfig(): Promise<TelefoniaOficinaConfig[]> {
  const { data, error } = await supabase
    .from('telefonia_oficinas_config')
    .select('*, oficina:oficinas(nombre)')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map(d => ({ ...d, oficina: d.oficina as any }));
}

export async function createOficinaConfig(config: {
  oficina_id: string;
  rango_inicio: number;
  rango_fin: number;
  prefijo?: string;
  descripcion?: string;
}): Promise<TelefoniaOficinaConfig> {
  const { data, error } = await supabase
    .from('telefonia_oficinas_config')
    .insert(config)
    .select('*, oficina:oficinas(nombre)')
    .single();
  if (error) throw error;
  return { ...data, oficina: data.oficina as any };
}

export async function updateOficinaConfig(id: string, updates: Partial<TelefoniaOficinaConfig>): Promise<void> {
  const { error } = await supabase
    .from('telefonia_oficinas_config')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteOficinaConfig(id: string): Promise<void> {
  const { error } = await supabase
    .from('telefonia_oficinas_config')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ── Extensions Catalog ───────────────────────────────────────────────────────

export async function getExtensiones(): Promise<TelefoniaExtension[]> {
  const { data, error } = await supabase
    .from('telefonia_extensiones')
    .select('*, oficina:oficinas(nombre), usuario:usuarios!telefonia_extensiones_usuario_asignado_id_fkey(nombre, apellido)')
    .order('extension', { ascending: true });
  if (error) throw error;
  return (data || []).map(d => ({ ...d, oficina: d.oficina as any, usuario: d.usuario as any }));
}

export async function createExtension(ext: {
  extension: string;
  oficina_id?: string;
  nombre_display?: string;
}): Promise<TelefoniaExtension> {
  const { data, error } = await supabase
    .from('telefonia_extensiones')
    .insert(ext)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateExtension(id: string, updates: Partial<TelefoniaExtension>): Promise<void> {
  const { error } = await supabase
    .from('telefonia_extensiones')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteExtension(id: string): Promise<void> {
  const { error } = await supabase
    .from('telefonia_extensiones')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function bulkCreateExtensions(extensions: Array<{
  extension: string;
  oficina_id?: string;
  nombre_display?: string;
}>): Promise<number> {
  const { data, error } = await supabase
    .from('telefonia_extensiones')
    .insert(extensions)
    .select();
  if (error) throw error;
  return data?.length || 0;
}

// ── User-Extension Assignments ───────────────────────────────────────────────

export async function getUsuariosAsignados(): Promise<TelefoniaUsuario[]> {
  const { data, error } = await supabase
    .from('telefonia_usuarios')
    .select('*, usuario:usuarios(nombre, apellido, email, oficina_id)')
    .order('extension', { ascending: true });
  if (error) throw error;
  return (data || []).map(d => ({ ...d, usuario: d.usuario as any }));
}

export async function assignExtension(params: {
  usuario_id: string;
  extension: string;
  tipo?: 'sip' | 'iax' | 'virtual';
}): Promise<TelefoniaUsuario> {
  const { data, error } = await supabase
    .from('telefonia_usuarios')
    .insert(params)
    .select()
    .single();
  if (error) throw error;

  await supabase
    .from('telefonia_extensiones')
    .update({ estado: 'asignada', usuario_asignado_id: params.usuario_id, updated_at: new Date().toISOString() })
    .eq('extension', params.extension);

  return data;
}

export async function unassignExtension(id: string, extension: string): Promise<void> {
  const { error } = await supabase
    .from('telefonia_usuarios')
    .delete()
    .eq('id', id);
  if (error) throw error;

  await supabase
    .from('telefonia_extensiones')
    .update({ estado: 'disponible', usuario_asignado_id: null, updated_at: new Date().toISOString() })
    .eq('extension', extension);
}

// ── Sync Logs ────────────────────────────────────────────────────────────────

export async function getSyncLogs(limit = 50): Promise<TelefoniaSyncLog[]> {
  const { data, error } = await supabase
    .from('telefonia_sync_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function createSyncLog(log: {
  tipo: TelefoniaSyncLog['tipo'];
  estado: TelefoniaSyncLog['estado'];
  usuario_admin_id?: string;
  detalles?: Record<string, unknown>;
}): Promise<TelefoniaSyncLog> {
  const { data, error } = await supabase
    .from('telefonia_sync_logs')
    .insert(log)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateSyncLog(id: string, updates: Partial<TelefoniaSyncLog>): Promise<void> {
  const { error } = await supabase
    .from('telefonia_sync_logs')
    .update(updates)
    .eq('id', id);
  if (error) throw error;
}

// ── Yeastar Proxy Connector (via Edge Function) ─────────────────────────────

export interface YeastarExtensionPayload {
  number: string;
  first_name: string;
  last_name: string;
  email_addr?: string;
  user_password?: string;
  registration_password?: string;
}

export async function testYeastarConnection(): Promise<{ success: boolean; message: string }> {
  return callYeastarProxy('test_connection');
}

export async function syncUserToYeastar(
  payload: YeastarExtensionPayload,
  mode: 'create' | 'update' = 'create'
): Promise<{ success: boolean; message: string; yeastarId?: string }> {
  const action = mode === 'create' ? 'create_extension' : 'update_extension';
  return callYeastarProxy(action, payload as unknown as Record<string, unknown>);
}

export async function deleteYeastarExtension(extensionNumber: string): Promise<{ success: boolean; message: string }> {
  return callYeastarProxy('delete_extension', { number: extensionNumber });
}

export async function listYeastarExtensions(): Promise<{ success: boolean; extensions?: unknown[]; message?: string }> {
  return callYeastarProxy('list_extensions');
}

// ── Auto-assign next available extension for an office ────────────────────────

export async function getNextAvailableExtension(oficinaId: string): Promise<string | null> {
  const { data: rangeData } = await supabase
    .from('telefonia_oficinas_config')
    .select('rango_inicio, rango_fin, prefijo')
    .eq('oficina_id', oficinaId)
    .eq('activo', true)
    .limit(1)
    .maybeSingle();

  if (!rangeData) return null;

  const { data: usedExts } = await supabase
    .from('telefonia_extensiones')
    .select('extension')
    .eq('oficina_id', oficinaId)
    .in('estado', ['asignada', 'reservada']);

  const usedSet = new Set((usedExts || []).map(e => e.extension));
  const prefix = rangeData.prefijo || '';

  for (let num = rangeData.rango_inicio; num <= rangeData.rango_fin; num++) {
    const ext = `${prefix}${num}`;
    if (!usedSet.has(ext)) return ext;
  }

  return null;
}

// ── Bulk sync preview ────────────────────────────────────────────────────────

export interface BulkSyncPreviewItem {
  usuario_id: string;
  nombre: string;
  apellido: string;
  email: string;
  oficina_nombre: string;
  extension_actual: string | null;
  extension_propuesta: string | null;
  accion: 'crear' | 'actualizar' | 'sin_cambios' | 'sin_rango';
}

export async function generateBulkSyncPreview(): Promise<BulkSyncPreviewItem[]> {
  const { data: usuarios } = await supabase
    .from('usuarios')
    .select('id, nombre, apellido, email, oficina_id, extension_telefonica, oficina:oficinas(nombre)')
    .eq('activo', true)
    .not('oficina_id', 'is', null)
    .order('nombre');

  if (!usuarios) return [];

  const { data: asignaciones } = await supabase
    .from('telefonia_usuarios')
    .select('usuario_id, extension');

  const asignacionMap = new Map((asignaciones || []).map(a => [a.usuario_id, a.extension]));

  const { data: rangos } = await supabase
    .from('telefonia_oficinas_config')
    .select('oficina_id, rango_inicio, rango_fin, prefijo')
    .eq('activo', true);

  const rangoMap = new Map((rangos || []).map(r => [r.oficina_id, r]));

  const { data: extUsadas } = await supabase
    .from('telefonia_extensiones')
    .select('extension, oficina_id, estado');

  const usedByOffice = new Map<string, Set<string>>();
  for (const ext of extUsadas || []) {
    if (ext.oficina_id && (ext.estado === 'asignada' || ext.estado === 'reservada')) {
      if (!usedByOffice.has(ext.oficina_id)) usedByOffice.set(ext.oficina_id, new Set());
      usedByOffice.get(ext.oficina_id)!.add(ext.extension);
    }
  }

  const preview: BulkSyncPreviewItem[] = [];
  const newAssignments = new Map<string, Set<string>>();

  for (const u of usuarios) {
    const oficina = u.oficina as any;
    const existingExt = asignacionMap.get(u.id);
    const rango = rangoMap.get(u.oficina_id!);

    if (existingExt) {
      preview.push({
        usuario_id: u.id,
        nombre: u.nombre || '',
        apellido: u.apellido || '',
        email: u.email || '',
        oficina_nombre: oficina?.nombre || '',
        extension_actual: existingExt,
        extension_propuesta: existingExt,
        accion: 'sin_cambios',
      });
      continue;
    }

    if (!rango) {
      preview.push({
        usuario_id: u.id,
        nombre: u.nombre || '',
        apellido: u.apellido || '',
        email: u.email || '',
        oficina_nombre: oficina?.nombre || '',
        extension_actual: null,
        extension_propuesta: null,
        accion: 'sin_rango',
      });
      continue;
    }

    const officeUsed = usedByOffice.get(u.oficina_id!) || new Set();
    const officeNew = newAssignments.get(u.oficina_id!) || new Set();
    const prefix = rango.prefijo || '';
    let found: string | null = null;

    for (let num = rango.rango_inicio; num <= rango.rango_fin; num++) {
      const ext = `${prefix}${num}`;
      if (!officeUsed.has(ext) && !officeNew.has(ext)) {
        found = ext;
        break;
      }
    }

    if (!newAssignments.has(u.oficina_id!)) newAssignments.set(u.oficina_id!, new Set());
    if (found) newAssignments.get(u.oficina_id!)!.add(found);

    preview.push({
      usuario_id: u.id,
      nombre: u.nombre || '',
      apellido: u.apellido || '',
      email: u.email || '',
      oficina_nombre: oficina?.nombre || '',
      extension_actual: null,
      extension_propuesta: found,
      accion: found ? 'crear' : 'sin_rango',
    });
  }

  return preview;
}
