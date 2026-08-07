// ============================================================================
// Cliente del módulo /alta — envoltura tipada sobre las edge functions.
// El wizard público NUNCA escribe directo en las tablas (RLS cerrado): todo
// pasa por estas funciones, autenticadas con la anon key + resume_token.
// ============================================================================

import { supabase } from '../supabase';

export type AltaTipo = 'con_cedula' | 'en_desarrollo';

export type AltaEstado =
  | 'draft' | 'in_progress' | 'identity_pending' | 'signature_pending'
  | 'awaiting_review' | 'approved' | 'rejected' | 'completed'
  | 'needs_retry' | 'resume_later' | 'human_review' | 'incomplete';

export interface AltaSession {
  id: string;
  folio: string;
  resume_token: string;
}

export interface AltaDatos {
  tipo_agente?: AltaTipo;
  nombre?: string;
  apellidos?: string;
  fecha_nacimiento?: string;
  curp?: string;
  rfc?: string;
  email?: string;
  whatsapp?: string;
  telefono?: string;
  razon_social?: string;
  regimen_fiscal?: string;
  codigo_postal_fiscal?: string;
  banco?: string;
  clabe?: string;
  cuenta_banco?: string;
  cedula?: string;
  cedula_vigencia?: string;
  poliza_rc_numero?: string;
  poliza_rc_aseguradora?: string;
  poliza_rc_vigencia?: string;
}

export type TipoDocumento =
  | 'ine_frente' | 'ine_reverso' | 'csf' | 'caratula_bancaria'
  | 'poliza_rc' | 'cedula' | 'comprobante_domicilio' | 'otro';

export interface DocumentoRegistrado {
  id: string;
  tipo_documento: string;
  nombre_archivo: string;
  size_bytes: number;
  mime_type: string;
}

const LS_KEY = 'alta_onboarding_session';

export function guardarSesionLocal(s: AltaSession): void {
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}
export function leerSesionLocal(): AltaSession | null {
  try { const v = localStorage.getItem(LS_KEY); return v ? JSON.parse(v) as AltaSession : null; } catch { return null; }
}
export function limpiarSesionLocal(): void {
  try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
}

async function invoke<T>(action: string, body: Record<string, unknown>, fn = 'alta-guardar'): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body: { action, ...body } });
  if (error) {
    // El cuerpo de error de la function suele traer {error, detalle}
    let detalle = error.message;
    try { const ctx = await (error as { context?: Response }).context?.json?.(); if (ctx?.error) detalle = ctx.error; } catch { /* ignore */ }
    throw new Error(detalle || 'Error de red');
  }
  if (data && (data as { error?: string }).error) throw new Error((data as { error: string; faltantes?: string[] }).error);
  return data as T;
}

export async function iniciarAlta(datos: AltaDatos, recaptchaToken?: string, brand?: string): Promise<AltaSession> {
  const data = await invoke<{ id: string; folio: string; resume_token: string }>('iniciar', {
    datos, recaptchaToken, brand, paso_actual: 'datos',
  });
  const s: AltaSession = { id: data.id, folio: data.folio, resume_token: data.resume_token };
  guardarSesionLocal(s);
  return s;
}

export async function guardarPaso(
  s: AltaSession,
  opts: { paso?: string; datos?: AltaDatos; paso_actual?: string; paso_estado?: string; orden?: number },
): Promise<void> {
  await invoke('guardar_paso', { alta_id: s.id, resume_token: s.resume_token, ...opts });
}

export async function subirDocumento(
  s: AltaSession, tipo: TipoDocumento, file: File,
): Promise<void> {
  const firma = await invoke<{ path: string; token: string; signedUrl: string }>('subir_url', {
    alta_id: s.id, resume_token: s.resume_token, tipo_documento: tipo, nombre_archivo: file.name, mime_type: file.type,
  });
  const { error: upErr } = await supabase.storage.from('altas-onboarding')
    .uploadToSignedUrl(firma.path, firma.token, file);
  if (upErr) throw new Error(upErr.message);
  await invoke('registrar_doc', {
    alta_id: s.id, resume_token: s.resume_token, tipo_documento: tipo,
    nombre_archivo: file.name, archivo_path: firma.path, size_bytes: file.size, mime_type: file.type,
  });
}

export interface AltaRetomada {
  alta: AltaDatos & { id: string; folio: string; estado: AltaEstado; tipo_agente?: AltaTipo; paso_actual?: string };
  pasos: { paso: string; estado: string }[];
  documentos: DocumentoRegistrado[];
}
export async function retomarAlta(s: AltaSession): Promise<AltaRetomada> {
  return await invoke<AltaRetomada>('retomar', { alta_id: s.id, resume_token: s.resume_token });
}

export async function consultarEstado(s: AltaSession): Promise<{ estado: AltaEstado; usuario_id: string | null; verificacion: string; firma: string }> {
  return await invoke('estado', { alta_id: s.id, resume_token: s.resume_token });
}

export async function reconciliar(s: AltaSession): Promise<{ estado: AltaEstado; usuario_id: string | null }> {
  return await invoke('reconciliar', { alta_id: s.id, resume_token: s.resume_token });
}

export async function enviarACincel(s: AltaSession): Promise<{ signUrl?: string; documento: string; proveedor: string }> {
  return await invoke('', { alta_id: s.id, resume_token: s.resume_token }, 'alta-enviar-cincel');
}
