import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2';

export interface SyncCursor {
  module: string;
  keycode: string;
  last_success_at: string | null;
  last_cursor_date: string | null;
  last_page: number;
  sync_frequency_hours: number;
  incremental_days_buffer: number;
}

export interface SyncRun {
  run_id?: string;
  module: string;
  keycode: string;
  report_name?: string;
  from_date?: string;
  to_date?: string;
  pages_requested: number;
  items_per_page: number;
  records_fetched: number;
  records_upserted: number;
  records_failed: number;
  status: 'running' | 'success' | 'partial' | 'failed';
  error_message?: string;
  started_at: string;
  finished_at?: string;
  duration_seconds?: number;
}

export function generateHash(data: any): string {
  const str = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

export async function getCursor(
  supabase: SupabaseClient,
  module: string,
  keycode: string
): Promise<SyncCursor | null> {
  const { data, error } = await supabase
    .from('sicas_sync_cursors')
    .select('*')
    .eq('module', module)
    .eq('keycode', keycode)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('[Cursor] Error fetching cursor:', error);
    return null;
  }

  return data;
}

export async function updateCursor(
  supabase: SupabaseClient,
  module: string,
  keycode: string,
  updates: {
    last_success_at?: string;
    last_cursor_date?: string;
    last_page?: number;
    total_synced?: number;
    last_run_id?: string;
  }
): Promise<void> {
  const { error } = await supabase
    .from('sicas_sync_cursors')
    .upsert({
      module,
      keycode,
      ...updates,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'module,keycode',
    });

  if (error) {
    console.error('[Cursor] Error updating cursor:', error);
    throw error;
  }
}

export async function createSyncRun(
  supabase: SupabaseClient,
  run: Omit<SyncRun, 'run_id'>
): Promise<string> {
  const { data, error } = await supabase
    .from('sicas_sync_runs')
    .insert(run)
    .select('run_id')
    .single();

  if (error) {
    console.error('[SyncRun] Error creating sync run:', error);
    throw error;
  }

  return data.run_id;
}

export async function updateSyncRun(
  supabase: SupabaseClient,
  runId: string,
  updates: Partial<SyncRun>
): Promise<void> {
  const { error } = await supabase
    .from('sicas_sync_runs')
    .update(updates)
    .eq('run_id', runId);

  if (error) {
    console.error('[SyncRun] Error updating sync run:', error);
    throw error;
  }
}

export async function mapVendorToUser(
  supabase: SupabaseClient,
  vendNombre: string
): Promise<{ usuario_id: string | null; oficina_id: string | null }> {
  const { data: mapping } = await supabase
    .from('sicas_mapeo_vendedores')
    .select('usuario_id, usuarios(oficina_id)')
    .eq('vend_nombre', vendNombre)
    .single();

  if (mapping) {
    return {
      usuario_id: mapping.usuario_id,
      oficina_id: (mapping.usuarios as any)?.oficina_id || null,
    };
  }

  return { usuario_id: null, oficina_id: null };
}

export function formatDateForSicas(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseFloat(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return isNaN(parsed) ? null : parsed;
}

export function parseDate(value: any): string | null {
  if (!value) return null;
  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) return null;
    return date.toISOString();
  } catch {
    return null;
  }
}

export function getPeriodKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const startOfWeek = new Date(date);
  startOfWeek.setDate(date.getDate() - date.getDay());
  const weekStart = formatDateForSicas(startOfWeek);
  return `${year}-${month}-W${weekStart}`;
}
