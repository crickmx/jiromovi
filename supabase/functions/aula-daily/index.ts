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

const MAX_SALA = 200;
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
  link_token_asistente: string | null;
  link_activo: boolean;
};

async function cargarEvento(eventoId: string): Promise<Evento | null> {
  const { data } = await admin
    .from('aula_eventos')
    .select('id, titulo, estado, fecha_inicio, fecha_fin, creado_por, daily_room_name, daily_room_url, max_participantes, grabar, link_token, link_token_asistente, link_activo')
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
  // Los dos links de invitación se garantizan SIEMPRE, también cuando la sala
  // ya existía: antes solo se generaban al crear la sala, así que los eventos
  // anteriores se quedaban sin link de oyentes para siempre.
  const tokens: Record<string, string | boolean> = {};
  if (!evento.link_token) tokens.link_token = crypto.randomUUID().replace(/-/g, '');
  if (!evento.link_token_asistente) tokens.link_token_asistente = crypto.randomUUID().replace(/-/g, '');
  // Un evento que sigue en pie nunca debe tener los links apagados: al
  // finalizar se apagan, pero si se reabre o se reprograma hay que reconectar.
  if (!evento.link_activo && evento.estado !== 'finalizado' && evento.estado !== 'cancelado') {
    tokens.link_activo = true;
    evento.link_activo = true;
  }
  if (Object.keys(tokens).length > 0) {
    await admin.from('aula_eventos').update(tokens).eq('id', evento.id);
    Object.assign(evento, tokens);
  }

  if (evento.daily_room_name) {
    // La sala ya existe: se refresca la caducidad por si movieron la fecha.
    const exp = unix(evento.fecha_fin, Date.now() + 4 * 3600_000) + 7200;
    await daily(`/rooms/${encodeURIComponent(evento.daily_room_name)}`, {
      method: 'POST',
      body: JSON.stringify({
        // Las salas creadas antes del cambio llevaban tope: se sube al máximo
        // que permite la plataforma para que no rechace oyentes.
        properties: { exp, eject_at_room_exp: true, max_participants: MAX_SALA },
      }),
    }).catch(() => null);
    return { room_name: evento.daily_room_name, room_url: evento.daily_room_url };
  }

  const name = `aula-${evento.id}`;
  const exp = unix(evento.fecha_fin, Date.now() + 4 * 3600_000) + 7200;

  const propiedades = {
    exp,
    eject_at_room_exp: true,
    // Sin tope propio: los eventos son siempre abiertos. Daily aplica su
    // máximo de plataforma (200 por sala); más que eso se contrata allá.
    max_participants: MAX_SALA,
    enable_screenshare: true,
    enable_chat: false,
    enable_people_ui: false,
    enable_prejoin_ui: false,
    enable_network_ui: true,
    lang: 'es',
  };

  // La grabación en nube es de plan de pago: si Daily la rechaza, la clase
  // igual se crea y queda la grabación local del navegador.
  let room;
  try {
    room = await daily('/rooms', {
      method: 'POST',
      body: JSON.stringify({ name, privacy: 'private', properties: { ...propiedades, enable_recording: 'cloud' } }),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (/already exists/i.test(msg)) {
      // La sala quedó creada en Daily y la fila no se guardó (o se reintentó).
      const existente = await daily(`/rooms/${encodeURIComponent(name)}`);
      room = existente;
    } else if (/recording|plan/i.test(msg)) {
      console.warn('aula-daily: sala sin grabación en nube —', msg);
      room = await daily('/rooms', {
        method: 'POST',
        body: JSON.stringify({ name, privacy: 'private', properties: propiedades }),
      });
      await admin.from('aula_grabaciones').upsert(
        {
          evento_id: evento.id,
          origen: 'cloud',
          estado: 'error',
          error_mensaje: 'La grabación en nube requiere plan de pago en Daily. Se grabó solo en el navegador.',
        },
        { onConflict: 'evento_id,origen' },
      );
    } else {
      throw e;
    }
  }

  await admin
    .from('aula_eventos')
    .update({ daily_room_name: room.name ?? name, daily_room_url: room.url ?? null })
    .eq('id', evento.id);

  console.log('aula-daily: sala creada', name, 'por', creador);
  return { room_name: room.name ?? name, room_url: room.url ?? null };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    /* cuerpo vacío */
  }

  const accion = String(body.action ?? '');
  const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();

  const esServicio = (() => {
    const envKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (bearer && bearer === envKey) return true;
    if (bearer.startsWith('sb_secret_')) return true;
    if (!bearer.startsWith('eyJ')) return false;
    try {
      const b64 = bearer.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4)))?.role === 'service_role';
    } catch {
      return false;
    }
  })();

  // Registro del webhook en Daily. Se hace desde aquí para que la API key no
  // salga de los secretos. Solo lo dispara el cron o un administrador.
  if (accion === 'configurar-webhook') {
    if (!esServicio) return json({ error: 'Solo el servicio puede configurar el webhook' }, 403);
    try {
      const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/aula-daily-webhook`;
      const basico = String(body.basic_auth ?? '');

      const lista = await daily('/webhooks');
      const previos = (lista?.data ?? []).filter((w: { url?: string }) => w.url === url);
      for (const w of previos) {
        await daily(`/webhooks/${w.id}`, { method: 'DELETE' }).catch(() => null);
      }

      const nuevo = await daily('/webhooks', {
        method: 'POST',
        body: JSON.stringify({
          url,
          ...(basico ? { basicAuth: basico } : {}),
          eventTypes: ['recording.ready', 'recording.error'],
          retryType: 'exponential',
        }),
      });

      return json({ ok: true, url, reemplazados: previos.length, webhook: nuevo });
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : 'No se pudo registrar el webhook' }, 500);
    }
  }

  // Sondeo de grabaciones en la nube. Los webhooks de Daily son de plan de pago,
  // así que este es el camino que no depende de que el anfitrión siga conectado.
  if (accion === 'recoger-grabaciones') {
    if (!esServicio) return json({ error: 'Solo el servicio puede recoger grabaciones' }, 403);
    try {
      const { data: eventos } = await admin
        .from('aula_eventos')
        .select('id, daily_room_name, estado')
        .not('daily_room_name', 'is', null)
        .in('estado', ['en_vivo', 'finalizado'])
        .order('fecha_inicio', { ascending: false })
        .limit(40);

      let recogidas = 0;
      for (const ev of eventos ?? []) {
        const { data: ya } = await admin
          .from('aula_grabaciones')
          .select('estado, daily_recording_id')
          .eq('evento_id', ev.id)
          .eq('origen', 'cloud')
          .maybeSingle();

        if (ya?.estado === 'publicada' || ya?.daily_recording_id) continue;

        const lista = await daily(`/recordings?room_name=${encodeURIComponent(ev.daily_room_name as string)}`);
        const listas = (lista?.data ?? []).filter((r: { status?: string }) => r.status === 'finished');
        if (!listas.length) continue;

        const rec = listas.sort((a: { start_ts?: number }, b: { start_ts?: number }) => (b.start_ts ?? 0) - (a.start_ts ?? 0))[0];

        const resp = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/aula-daily-webhook`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'recording.ready',
            payload: { recording_id: rec.id, room_name: ev.daily_room_name },
          }),
        });
        if (resp.ok) recogidas += 1;
        await resp.body?.cancel().catch(() => null);
      }

      return json({ ok: true, recogidas });
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : 'No se pudieron recoger las grabaciones' }, 500);
    }
  }

  const user = await getUser(req);
  if (!user) return json({ error: 'No autenticado' }, 401);

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
        .select('link_token, link_token_asistente, daily_room_name, daily_room_url')
        .eq('id', eventoId)
        .maybeSingle();
      return json({
        ...sala,
        link_token: actualizado?.link_token ?? null,
        link_token_asistente: actualizado?.link_token_asistente ?? null,
      });
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

      const rolFinal = rol === 'oyente' && esAdmin ? 'host' : rol;

      return json({
        room_url: sala.daily_room_url,
        room_name: sala.daily_room_name,
        token: token.token,
        rol: rolFinal,
        nombre,
        // Solo quien conduce recibe los tokens de los links de invitación.
        // El origen lo pone el navegador, así beta y producción no se mezclan.
        link_token: rolFinal !== 'oyente' ? sala.link_token : null,
        link_token_asistente: rolFinal !== 'oyente' ? sala.link_token_asistente : null,
      });
    }

    // Encola la invitación a toda la plantilla. El envío real lo hace el cron
    // `aula-recordatorios`, que ya sabe mandar correo + WhatsApp e in-app.
    if (accion === 'invitar') {
      if (!puedeAdministrar) return json({ error: 'No tienes permiso para esta clase' }, 403);
      if (!evento.fecha_inicio) return json({ error: 'La clase necesita fecha y hora' }, 400);

      const { data: usuarios } = await admin
        .from('usuarios')
        .select('id')
        .in('rol', ['Agente', 'Empleado', 'Gerente', 'Administrador'])
        .eq('activo', true)
        .is('deleted_at', null);

      const lista = (usuarios ?? []) as Array<{ id: string }>;
      if (lista.length === 0) return json({ ok: true, encolados: 0 });

      const filas = lista.map((u) => ({
        evento_id: eventoId,
        usuario_id: u.id,
        tipo: 'invitacion' as const,
        estado: 'pendiente' as const,
      }));

      for (let i = 0; i < filas.length; i += 400) {
        await admin.from('aula_recordatorio_envios').upsert(filas.slice(i, i + 400), {
          onConflict: 'evento_id,usuario_id,tipo',
          ignoreDuplicates: true,
        });
      }

      return json({ ok: true, encolados: filas.length });
    }

    if (accion === 'grabacion-iniciar') {
      if (!puedeAdministrar) return json({ error: 'Solo quien conduce la clase puede grabarla' }, 403);
      if (!evento.grabar) return json({ ok: true, omitido: 'La clase no se graba' });
      if (!evento.daily_room_name) return json({ error: 'La sala todavía no está lista' }, 409);

      try {
        await daily(`/rooms/${encodeURIComponent(evento.daily_room_name)}/recordings/start`, {
          method: 'POST',
          body: JSON.stringify({}),
        });
        await admin.from('aula_grabaciones').upsert(
          { evento_id: eventoId, origen: 'cloud', estado: 'grabando', error_mensaje: null },
          { onConflict: 'evento_id,origen' },
        );
        return json({ ok: true });
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'No se pudo grabar en la nube';
        await admin.from('aula_grabaciones').upsert(
          { evento_id: eventoId, origen: 'cloud', estado: 'error', error_mensaje: msg },
          { onConflict: 'evento_id,origen' },
        );
        return json({ ok: false, error: msg });
      }
    }

    if (accion === 'iniciar') {
      if (!puedeAdministrar) return json({ error: 'Solo quien conduce la clase puede iniciarla' }, 403);
      if (!evento.daily_room_name) await asegurarSala(evento, user.id);
      const sala = await cargarEvento(eventoId);

      await admin
        .from('aula_eventos')
        .update({ estado: 'en_vivo', link_activo: true })
        .eq('id', eventoId);

      // La grabación en nube se arranca cuando el anfitrión ya está dentro de la
      // sala (accion `grabacion-iniciar`): Daily no deja grabar una sala vacía.
      return json({ ok: true, grabacion: { ok: false, pendiente: 'Se inicia al entrar a la sala' } });
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

    if (accion === 'eliminar') {
      if (!puedeAdministrar) return json({ error: 'No tienes permiso para esta clase' }, 403);

      // La sala en Daily se borra primero: si quedara viva, seguirían entrando
      // por el enlace a una clase que ya no existe.
      if (evento.daily_room_name) {
        await daily(`/rooms/${encodeURIComponent(evento.daily_room_name)}`, { method: 'DELETE' }).catch(() => null);
      }

      const { error: errBaja } = await admin.from('aula_eventos').delete().eq('id', eventoId);
      if (errBaja) return json({ error: errBaja.message }, 400);

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