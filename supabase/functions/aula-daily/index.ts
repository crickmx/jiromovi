// aula-daily
// ---------------------------------------------------------------------------
// Puerta única a la API de Daily para el Aula Virtual de Seguros Education.
// La API key vive SOLO en los secretos de esta función: nunca llega al navegador.
//
// Acciones:
//   crear-sala     (admin del evento)  crea/reutiliza la sala privada del evento
//   token-entrada  (autenticado)       devuelve room_url + meeting token según rol
//   iniciar        (host)              en_vivo + arranca la grabación EN LA NUBE
//   finalizar      (host)              detiene grabación, invalida el link y borra la sala
//   estado         (autenticado)       estado del evento (respaldo si falla realtime)
// ---------------------------------------------------------------------------
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

const DAILY_API = 'https://api.daily.co/v1';

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);

function dailyKey() {
  const key = Deno.env.get('DAILY_API_KEY');
  if (!key) throw new Error('Daily no está configurado (falta DAILY_API_KEY)');
  return key;
}

async function daily(path: string, init: RequestInit = {}) {
  const res = await fetch(`${DAILY_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${dailyKey()}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.info || body?.error || `Daily ${res.status}`;
    throw new Error(String(msg));
  }
  return body;
}

async function getUser(req: Request) {
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return null;
  const { data } = await admin.auth.getUser(auth.slice(7));
  return data.user ?? null;
}

type Evento = {
  id: string;
  titulo: string;
  estado: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  creado_por: string | null;
  daily_room_name: string | null;
  daily_room_url: string | null;
  max_participantes: number | null;
  grabar: boolean;
  link_token: string | null;
  link_activo: boolean;
};

async function cargarEvento(eventoId: string): Promise<Evento | null> {
  const { data } = await admin
    .from('aula_eventos')
    .select('id, titulo, estado, fecha_inicio, fecha_fin, creado_por, daily_room_name, daily_room_url, max_participantes, grabar, link_token, link_activo')
    .eq('id', eventoId)
    .maybeSingle();
  return (data as Evento) ?? null;
}

async function rolDe(eventoId: string, usuarioId: string) {
  const { data: usuario } = await admin
    .from('usuarios')
    .select('id, rol, nombre_completo, nombre, apellidos, estado')
    .eq('id', usuarioId)
    .maybeSingle();

  const { data: host } = await admin
    .from('aula_evento_hosts')
    .select('rol')
    .eq('evento_id', eventoId)
    .eq('usuario_id', usuarioId)
    .maybeSingle();

  let rol: 'host' | 'cohost' | 'oyente' = 'oyente';
  if (host?.rol === 'host') rol = 'host';
  else if (host?.rol === 'cohost') rol = 'cohost';

  const nombre =
    usuario?.nombre_completo ||
    [usuario?.nombre, usuario?.apellidos].filter(Boolean).join(' ') ||
    'Usuario MOVI';

  const esAdmin =
    usuario?.rol === 'Administrador' ||
    (usuario?.rol === 'Gerente' &&
      (
        await admin.rpc('tiene_permiso_admin_en_modulo', {
          p_usuario_id: usuarioId,
          p_modulo_codigo: 'seguros_education',
        })
      ).data === true);

  return { rol, nombre, rolSistema: usuario?.rol as string | undefined, esAdmin: !!esAdmin };
}

function unix(iso: string | null, fallbackMs: number) {
  if (!iso) return Math.floor(fallbackMs / 1000);
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? Math.floor(t / 1000) : Math.floor(fallbackMs / 1000);
}

async function asegurarSala(evento: Evento, creador: string) {
  if (evento.daily_room_name) {
    // La sala ya existe: se refresca la caducidad por si movieron la fecha.
    const exp = unix(evento.fecha_fin, Date.now() + 4 * 3600_000) + 7200;
    await daily(`/rooms/${encodeURIComponent(evento.daily_room_name)}`, {
      method: 'POST',
      body: JSON.stringify({
        properties: { exp, eject_at_room_exp: true },
      }),
    }).catch(() => null);
    return { room_name: evento.daily_room_name, room_url: evento.daily_room_url };
  }

  const name = `aula-${evento.id}`;
  const exp = unix(evento.fecha_fin, Date.now() + 4 * 3600_000) + 7200;

  const room = await daily('/rooms', {
    method: 'POST',
    body: JSON.stringify({
      name,
      privacy: 'private',
      properties: {
        exp,
        eject_at_room_exp: true,
        max_participants: evento.max_participantes ?? 100,
        enable_screenshare: true,
        enable_chat: false,
        enable_people_ui: false,
        enable_prejoin_ui: false,
        enable_network_ui: true,
        enable_recording: 'cloud',
        lang: 'es',
      },
    }),
  });

  await admin
    .from('aula_eventos')
    .update({ daily_room_name: room.name ?? name, daily_room_url: room.url ?? null })
    .eq('id', evento.id);

  if (!evento.link_token) {
    await admin
      .from('aula_eventos')
      .update({ link_token: crypto.randomUUID().replace(/-/g, '') })
      .eq('id', evento.id);
  }

  console.log('aula-daily: sala creada', name, 'por', creador);
  return { room_name: room.name ?? name, room_url: room.url ?? null };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  const user = await getUser(req);
  if (!user) return json({ error: 'No autenticado' }, 401);

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    /* cuerpo vacío */
  }

  const accion = String(body.action ?? '');
  const eventoId = String(body.evento_id ?? '');
  if (!eventoId) return json({ error: 'evento_id es obligatorio' }, 400);

  try {
    const evento = await cargarEvento(eventoId);
    if (!evento) return json({ error: 'Evento no encontrado' }, 404);

    const { rol, nombre, esAdmin } = await rolDe(eventoId, user.id);
    const puedeAdministrar = esAdmin || rol === 'host' || rol === 'cohost';

    if (accion === 'crear-sala') {
      if (!puedeAdministrar) return json({ error: 'No tienes permiso para esta clase' }, 403);
      const sala = await asegurarSala(evento, user.id);
      const { data: actualizado } = await admin
        .from('aula_eventos')
        .select('link_token, daily_room_name, daily_room_url')
        .eq('id', eventoId)
        .maybeSingle();
      return json({ ...sala, link_token: actualizado?.link_token ?? null });
    }

    if (accion === 'token-entrada') {
      if (evento.estado === 'finalizado' || evento.estado === 'cancelado') {
        return json({ error: 'Esta clase ya terminó' }, 410);
      }
      if (!evento.daily_room_name) {
        if (!puedeAdministrar) return json({ error: 'La sala todavía no está lista' }, 409);
        await asegurarSala(evento, user.id);
      }
      const sala = await cargarEvento(eventoId);
      if (!sala?.daily_room_name) return json({ error: 'No se pudo preparar la sala' }, 500);

      const exp = unix(sala.fecha_fin, Date.now() + 4 * 3600_000) + 7200;
      const properties: Record<string, unknown> = {
        room_name: sala.daily_room_name,
        user_name: nombre.slice(0, 60),
        user_id: user.id.slice(0, 36),
        exp,
        eject_at_token_exp: true,
      };

      if (rol === 'host' || esAdmin) {
        properties.is_owner = true;
        properties.enable_screenshare = true;
      } else if (rol === 'cohost') {
        properties.is_owner = false;
        properties.enable_screenshare = true;
        properties.permissions = { canAdmin: ['participants'] };
      } else {
        properties.is_owner = false;
        properties.enable_screenshare = false;
        properties.start_audio_off = true;
        properties.start_video_off = true;
        properties.permissions = { canSend: ['audio', 'video'] };
      }

      const token = await daily('/meeting-tokens', {
        method: 'POST',
        body: JSON.stringify({ properties }),
      });

      return json({
        room_url: sala.daily_room_url,
        room_name: sala.daily_room_name,
        token: token.token,
        rol: rol === 'oyente' && esAdmin ? 'host' : rol,
        nombre,
      });
    }

    if (accion === 'iniciar') {
      if (!puedeAdministrar) return json({ error: 'Solo quien conduce la clase puede iniciarla' }, 403);
      if (!evento.daily_room_name) await asegurarSala(evento, user.id);
      const sala = await cargarEvento(eventoId);

      await admin
        .from('aula_eventos')
        .update({ estado: 'en_vivo', link_activo: true })
        .eq('id', eventoId);

      // La grabación en nube la arranca el servidor: no depende de la PC del anfitrión.
      let grabacion: { ok: boolean; error?: string } = { ok: false };
      if (evento.grabar) {
        try {
          await daily(`/rooms/${encodeURIComponent(sala!.daily_room_name!)}/recordings/start`, {
            method: 'POST',
            body: JSON.stringify({}),
          });
          grabacion = { ok: true };
          await admin.from('aula_grabaciones').upsert(
            { evento_id: eventoId, origen: 'cloud', estado: 'grabando' },
            { onConflict: 'evento_id,origen' },
          );
        } catch (e) {
          grabacion = { ok: false, error: e instanceof Error ? e.message : 'error' };
          await admin.from('aula_grabaciones').upsert(
            {
              evento_id: eventoId,
              origen: 'cloud',
              estado: 'error',
              error_mensaje: grabacion.error ?? 'No se pudo iniciar la grabación en la nube',
            },
            { onConflict: 'evento_id,origen' },
          );
          console.error('aula-daily: grabación en nube no arrancó', grabacion.error);
        }
      }

      return json({ ok: true, grabacion });
    }

    if (accion === 'finalizar') {
      if (!puedeAdministrar) return json({ error: 'Solo quien conduce la clase puede finalizarla' }, 403);

      if (evento.daily_room_name && evento.grabar) {
        await daily(`/rooms/${encodeURIComponent(evento.daily_room_name)}/recordings/stop`, {
          method: 'POST',
          body: JSON.stringify({}),
        }).catch(() => null);
      }

      await admin
        .from('aula_eventos')
        .update({ estado: 'finalizado', link_activo: false })
        .eq('id', eventoId);

      await admin
        .from('aula_participantes')
        .update({ salido_at: new Date().toISOString(), mano_levantada: false })
        .eq('evento_id', eventoId)
        .is('salido_at', null);

      if (evento.daily_room_name) {
        await daily(`/rooms/${encodeURIComponent(evento.daily_room_name)}`, {
          method: 'DELETE',
        }).catch(() => null);
      }

      return json({ ok: true });
    }

    if (accion === 'estado') {
      return json({
        estado: evento.estado,
        empezado: !!evento.fecha_inicio,
        link_activo: evento.link_activo,
        sala_lista: !!evento.daily_room_name,
      });
    }

    return json({ error: `Acción no soportada: ${accion}` }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error interno';
    console.error('aula-daily', accion, msg);
    return json({ error: msg }, 500);
  }
});