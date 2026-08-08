// ============================================================================
// Helpers compartidos del módulo /alta: cliente service_role, CORS, bitácora,
// transiciones de estado y folio. Sin lógica de proveedor (eso vive en providers).
// ============================================================================

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function preflight(req: Request): Response | null {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });
  return null;
}

export function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export type AltaEstado =
  | 'draft' | 'in_progress' | 'identity_pending' | 'signature_pending'
  | 'awaiting_review' | 'approved' | 'rejected' | 'completed'
  | 'needs_retry' | 'resume_later' | 'human_review' | 'incomplete';

export interface AltaRow {
  id: string;
  estado: AltaEstado;
  [k: string]: unknown;
}

/** Inserta un evento en la bitácora del alta (nunca lanza). */
export async function bitacora(
  db: SupabaseClient,
  altaId: string,
  evento: string,
  opts: {
    estadoAnterior?: AltaEstado | null;
    estadoNuevo?: AltaEstado | null;
    detalle?: Record<string, unknown>;
    actor?: 'sistema' | 'usuario' | 'admin' | 'webhook' | 'cron';
    actorUsuarioId?: string | null;
  } = {},
): Promise<void> {
  try {
    await db.from('alta_agente_bitacora').insert({
      alta_id: altaId,
      evento,
      estado_anterior: opts.estadoAnterior ?? null,
      estado_nuevo: opts.estadoNuevo ?? null,
      detalle: opts.detalle ?? {},
      actor: opts.actor ?? 'sistema',
      actor_usuario_id: opts.actorUsuarioId ?? null,
    });
  } catch (e) {
    console.error('[alta] bitacora error (no fatal):', e);
  }
}

/** Cambia el estado global del alta y deja constancia en la bitácora. */
export async function transicion(
  db: SupabaseClient,
  alta: AltaRow,
  nuevo: AltaEstado,
  evento: string,
  detalle: Record<string, unknown> = {},
  actor: 'sistema' | 'usuario' | 'admin' | 'webhook' | 'cron' = 'sistema',
): Promise<void> {
  const anterior = alta.estado;
  if (anterior === nuevo) {
    await bitacora(db, alta.id, evento, { estadoAnterior: anterior, estadoNuevo: nuevo, detalle, actor });
    return;
  }
  await db.from('alta_agente')
    .update({ estado: nuevo, estado_anterior: anterior })
    .eq('id', alta.id);
  alta.estado = nuevo;
  await bitacora(db, alta.id, evento, { estadoAnterior: anterior, estadoNuevo: nuevo, detalle, actor });
}

/** Folio legible y único: ALT-YYMMDD-XXXX. */
export function generarFolio(): string {
  const d = new Date();
  const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rnd = new Uint8Array(3);
  crypto.getRandomValues(rnd);
  const suf = Array.from(rnd).map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  return `ALT-${ymd}-${suf}`;
}

/**
 * Notifica a todos los Administradores activos (in-app + WhatsApp opcional) vía
 * `enviar_notificacion_global` con filtro por rol — no depende de plantillas
 * transaccionales, así que funciona sin registrar event_keys nuevos. Nunca lanza.
 */
export async function notificarAdmins(
  db: SupabaseClient,
  titulo: string,
  mensaje: string,
  linkUrl: string,
  enviarWhatsapp = false,
): Promise<boolean> {
  try {
    const { error } = await db.rpc('enviar_notificacion_global', {
      p_titulo: titulo,
      p_mensaje: mensaje,
      p_accion_url: linkUrl,
      p_filtros: { tipo: 'rol', rol: 'Administrador' },
      p_evento_id: null,
      p_enviar_whatsapp: enviarWhatsapp,
      p_enviado_por: null,
    });
    if (error) { console.error('[alta] notificarAdmins error (no fatal):', error.message); return false; }
    return true;
  } catch (e) {
    console.error('[alta] notificarAdmins error (no fatal):', e);
    return false;
  }
}
