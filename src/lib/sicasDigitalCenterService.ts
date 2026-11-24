import { supabase } from './supabase';
import type { CentroDigitalParams, CentroDigitalResult } from './sicasDigitalCenterTypes';

export async function getSicasDigitalCenter(params: CentroDigitalParams): Promise<CentroDigitalResult> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return {
      success: false,
      entity_type: params.entityType,
      entity_id: '',
      files: [],
      folders: [],
      total_files: 0,
      has_files: false,
      source: 'sicas_live',
      error: 'No hay sesion activa',
    };
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const url = `${supabaseUrl}/functions/v1/sicas-digital-center`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      'X-Client-Info': 'movi-digital-app',
      Apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    let errorMsg = `HTTP ${response.status}`;
    try {
      const errBody = await response.json();
      errorMsg = errBody.error || errorMsg;
    } catch { /* ignore */ }
    return {
      success: false,
      entity_type: params.entityType,
      entity_id: '',
      files: [],
      folders: [],
      total_files: 0,
      has_files: false,
      source: 'sicas_live',
      error: errorMsg,
    };
  }

  return response.json();
}
