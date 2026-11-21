// whatsapp-reconectar
// ---------------------------------------------------------------------------
// Lo llama pg_cron cada 5 minutos.
//
// El servidor de WhatsApp (Baileys) guarda las credenciales en disco, pero el
// estado del socket vive en memoria. Cuando el contenedor se reinicia —deploy,
// caída, reciclado de la plataforma— todas las sesiones quedan desconectadas
// hasta que alguien abre la página y pulsa "Conectar".
//
// Esta función las revive sola: pide `connect` para cada sesión marcada como
// `auto_reconnect`, que reengancha desde las credenciales sin pedir QR.
// ---------------------------------------------------------------------------
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });

const SERVER = Deno.env.get('WHATSAPP_SERVER_URL') ?? '';
const API_KEY = Deno.env.get('WHATSAPP_SERVER_API_KEY') ?? '';

/** Espera mínima entre intentos para no martillar al servidor. */
const ESPERA_MS = 2 * 60_000;
/** Tope de intentos seguidos: si el teléfono cerró sesión, deja de insistir. */
const MAX_INTENTOS = 3;

function esServicio(token: string) {
  if (!token) return false;
  if (token === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) return true;
  if (token.startsWith('sb_secret_')) return true;
  if (!token.startsWith('eyJ')) return false;
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4)));
    return payload?.role === 'service_role';
  } catch {
    return false;
  }
}

type Sesion = {
  id: string;
  user_id: string;
  status: string;
  phone_number: string | null;
  intentos_reconexion: number | null;
  ultimo_intento_reconexion: string | null;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json({ ok: true });

  const auth = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!esServicio(auth)) return json({ error: 'No autorizado' }, 401);

  if (!SERVER || !API_KEY) {
    return json({ ok: false, error: 'WHATSAPP_SERVER_URL o WHATSAPP_SERVER_API_KEY sin configurar' }, 500);
  }

  let cuerpo: Record<string, unknown> = {};
  try {
    cuerpo = await req.json();
  } catch {
    /* el cron manda cuerpo vacío */
  }
  const seco = cuerpo.dry_run === true;

  const { data } = await admin
    .from('whatsapp_sessions')
    .select('id, user_id, status, phone_number, intentos_reconexion, ultimo_intento_reconexion')
    .eq('auto_reconnect', true)
    // 'qr_pending' significa que ya hay un QR en pantalla: volver a pedir
    // connect generaría uno nuevo y rompería el que la persona está escaneando.
    .in('status', ['disconnected', 'error'])
    .lt('intentos_reconexion', MAX_INTENTOS)
    .order('ultimo_intento_reconexion', { ascending: true, nullsFirst: true })
    .limit(25);

  const sesiones = (data ?? []) as Sesion[];
  if (seco) return json({ ok: true, seco: true, candidatas: sesiones.length });

  let reconectadas = 0;
  let pendientes = 0;
  let errores = 0;

  for (const sesion of sesiones) {
    // Sin credenciales en disco no hay nada que revivir: si nunca tuvo teléfono,
    // es una sesión que quedó a medias y la limpia el usuario.
    if (!sesion.phone_number) continue;

    const ultimo = sesion.ultimo_intento_reconexion ? new Date(sesion.ultimo_intento_reconexion).getTime() : 0;
    if (Date.now() - ultimo < ESPERA_MS) continue;

    const intentos = (sesion.intentos_reconexion ?? 0) + 1;

    try {
      const resp = await fetch(`${SERVER}/session/${sesion.user_id}/connect`, {
        method: 'POST',
        headers: { 'x-api-key': API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sesion.user_id }),
        signal: AbortSignal.timeout(25000),
      });

      const datos = await resp.json().catch(() => ({} as Record<string, unknown>));
      const estado = String(
        (datos as Record<string, unknown>).status ??
          ((datos as Record<string, unknown>).connected ? 'connected' : 'desconocido'),
      );

      if (estado === 'connected' || estado === 'already_connected') {
        reconectadas += 1;
        await admin
          .from('whatsapp_sessions')
          .update({
            status: 'connected',
            disconnected_at: null,
            error_message: null,
            intentos_reconexion: 0,
            ultimo_intento_reconexion: new Date().toISOString(),
          })
          .eq('id', sesion.id);
      } else {
        pendientes += 1;
        await admin
          .from('whatsapp_sessions')
          .update({
            status: estado === 'qr_pending' ? 'qr_pending' : sesion.status,
            intentos_reconexion: intentos,
            error_message: `Reconexión automática ${intentos}/${MAX_INTENTOS} (${estado})`,
            ultimo_intento_reconexion: new Date().toISOString(),
          })
          .eq('id', sesion.id);
      }
    } catch (e) {
      errores += 1;
      await admin
        .from('whatsapp_sessions')
        .update({
          intentos_reconexion: intentos,
          error_message: `Servidor de WhatsApp sin respuesta: ${e instanceof Error ? e.message : 'error'}`,
          ultimo_intento_reconexion: new Date().toISOString(),
        })
        .eq('id', sesion.id);
    }
  }

  return json({ ok: true, revisadas: sesiones.length, reconectadas, pendientes, errores });
});