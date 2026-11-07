// solicitar-eliminacion-cuenta
// ----------------------------------------------------------------------------
// Recibe una solicitud de eliminación de cuenta de MOVI o de Seguwallet.
// Requisito de App Store (5.1.1(v)) y Google Play (eliminación de cuenta).
//
// Dos caminos:
//  1. Desde la app, con sesión: Authorization: Bearer <JWT del usuario>.
//     Se toma el correo de la sesión, no del cuerpo.
//     · Seguwallet: además se BLOQUEA la cuenta al instante (ya no puede entrar)
//       y se cierra su sesión. Un Administrador completa la depuración.
//     · MOVI: la cuenta la da de alta la empresa y lleva comisiones y trámites;
//       se registra la solicitud y la baja la hace un Administrador.
//  2. Desde la página pública /legal/eliminar-cuenta.html, sin sesión y sin
//     Authorization: solo se registra con el correo que
//     escribieron; un Administrador verifica antes de actuar. No se bloquea
//     nada, para que nadie pueda tumbar la cuenta de otro sabiendo su correo.
//
// Body: { plataforma: 'movi' | 'seguwallet', motivo?: string, email?: string }
// Se despliega desde el dashboard (un solo archivo, sin imports de _shared)
// con "Verify JWT" APAGADO: la página pública no manda llave. La identidad
// se valida aquí adentro con auth.getUser().
// ----------------------------------------------------------------------------
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: cors });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  let body: { plataforma?: string; motivo?: string; email?: string };
  try { body = await req.json(); } catch { return json({ error: 'Cuerpo inválido' }, 400); }

  const plataforma = body.plataforma === 'seguwallet' ? 'seguwallet' : body.plataforma === 'movi' ? 'movi' : null;
  if (!plataforma) return json({ error: 'Plataforma inválida' }, 400);
  const motivo = (body.motivo || '').toString().slice(0, 1000) || null;

  // ¿Viene con la sesión de un usuario? Se le pregunta a Auth quién es; una
  // llave pública o un token inválido simplemente no devuelve usuario.
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  let authUserId: string | null = null;
  let email: string | null = null;
  if (token) {
    const { data } = await admin.auth.getUser(token);
    if (data?.user) {
      authUserId = data.user.id;
      email = (data.user.email || '').toLowerCase() || null;
    }
  }

  const origen = authUserId ? 'app' : 'web';
  if (!email) {
    const e = (body.email || '').toString().trim().toLowerCase();
    if (!EMAIL_RE.test(e)) return json({ error: 'Escribe un correo válido.' }, 400);
    email = e;
  }

  // Evita duplicados: una solicitud pendiente por correo y plataforma basta.
  const { data: previa } = await admin
    .from('solicitudes_eliminacion_cuenta')
    .select('id, creado_en')
    .eq('email', email).eq('plataforma', plataforma).eq('estado', 'pendiente')
    .limit(1);
  if (previa && previa.length > 0) {
    return json({ ok: true, ya_existia: true, solicitud_id: previa[0].id });
  }

  let cuentaBloqueada = false;
  if (authUserId && plataforma === 'seguwallet') {
    // Solo si de verdad es cliente de Seguwallet: nunca bloquear a un usuario
    // de MOVI que por alguna razón llegó por este camino.
    const { data: cliente } = await admin
      .from('seguwallet_customers').select('id').eq('auth_user_id', authUserId).limit(1);
    const { data: esMovi } = await admin.from('usuarios').select('id').eq('id', authUserId).limit(1);
    if (cliente && cliente.length > 0 && !(esMovi && esMovi.length > 0)) {
      const { error: banErr } = await admin.auth.admin.updateUserById(authUserId, { ban_duration: '876000h' });
      if (!banErr) {
        cuentaBloqueada = true;
        await admin.auth.admin.signOut(token).catch(() => {});
      } else {
        console.error('[solicitar-eliminacion-cuenta] no se pudo bloquear:', banErr.message);
      }
    }
  }

  const { data: fila, error } = await admin
    .from('solicitudes_eliminacion_cuenta')
    .insert({ auth_user_id: authUserId, plataforma, email, motivo, origen, cuenta_bloqueada: cuentaBloqueada })
    .select('id')
    .single();
  if (error) {
    console.error('[solicitar-eliminacion-cuenta] insert:', error.message);
    return json({ error: 'No se pudo registrar la solicitud. Intenta de nuevo.' }, 500);
  }

  // Aviso a Administradores (campanita, sin WhatsApp). Si falla, la solicitud ya quedó.
  try {
    const { data: admins } = await admin.from('usuarios').select('id').eq('rol', 'Administrador').eq('activo', true);
    const nombre = plataforma === 'seguwallet' ? 'Seguwallet' : 'MOVI';
    for (const a of admins || []) {
      const { error: nErr } = await admin.rpc('enviar_notificacion_individual', {
        p_user_id: a.id,
        p_titulo: `Solicitud de eliminación de cuenta (${nombre})`,
        p_mensaje: `${email} pidió eliminar su cuenta desde ${origen === 'app' ? 'la app' : 'la página web'}. Plazo: 30 días.`,
        p_modulo: 'admin',
        p_accion_url: null,
        p_enviar_whatsapp: false,
      });
      if (nErr) console.error('[solicitar-eliminacion-cuenta] aviso:', nErr.message);
    }
  } catch (e) {
    console.error('[solicitar-eliminacion-cuenta] aviso a admins:', e);
  }

  return json({ ok: true, solicitud_id: fila.id, cuenta_bloqueada: cuentaBloqueada });
});
