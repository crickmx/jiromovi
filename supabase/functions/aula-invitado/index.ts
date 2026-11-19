// aula-invitado
// ---------------------------------------------------------------------------
// Única puerta sin login del Aula Virtual. Verify JWT apagado a propósito:
// el invitado externo entra con el link del evento + nombre y empresa.
//
// Acciones:
//   join     { token, nombre, empresa, avatar? }  → crea/reutiliza invitado + meeting token
//   mensaje  { sesion, texto }                    → chat del invitado (validado por sesión)
//   adjunto  { sesion, nombre, mime, base64 }     → archivo al chat (máx 4 MB)
//   salir    { sesion }                           → cierra la asistencia
//
// El link caduca solo: al finalizar la clase, link_activo pasa a false.
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

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);

const DAILY_API = 'https://api.daily.co/v1';
const MAX_ADJUNTO = 4 * 1024 * 1024;

async function daily(path: string, init: RequestInit = {}) {
  const key = Deno.env.get('DAILY_API_KEY');
  if (!key) throw new Error('Daily no está configurado');
  const res = await fetch(`${DAILY_API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(String(body?.info || body?.error || `Daily ${res.status}`));
  return body;
}

const limpio = (v: unknown, max: number) =>
  String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

// Límite simple por IP: evita que un link filtrado se use como puerta abierta.
const intentos = new Map<string, { n: number; hasta: number }>();
function permitido(ip: string) {
  const ahora = Date.now();
  const actual = intentos.get(ip);
  if (!actual || actual.hasta < ahora) {
    intentos.set(ip, { n: 1, hasta: ahora + 60_000 });
    return true;
  }
  if (actual.n >= 8) return false;
  actual.n += 1;
  return true;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'desconocida';
  if (!permitido(ip)) return json({ error: 'Demasiados intentos, espera un minuto' }, 429);

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Cuerpo inválido' }, 400);
  }

  const accion = String(body.action ?? 'join');

  try {
    // ── Chat y adjuntos del invitado: se validan por sesión, no por link ──
    if (accion === 'mensaje' || accion === 'adjunto') {
      const sesion = String(body.sesion ?? '');
      if (!sesion) return json({ error: 'Sesión inválida' }, 401);

      const { data: part } = await admin
        .from('aula_participantes')
        .select('id, evento_id, nombre, rol, salido_at')
        .eq('sesion_token', sesion)
        .maybeSingle();

      if (!part) return json({ error: 'Sesión inválida' }, 401);
      if (part.salido_at) return json({ error: 'Tu sesión ya terminó' }, 410);

      if (accion === 'mensaje') {
        const texto = String(body.texto ?? '').trim().slice(0, 2000);
        if (!texto) return json({ error: 'Mensaje vacío' }, 400);
        const { data, error } = await admin
          .from('aula_chat')
          .insert({
            evento_id: part.evento_id,
            autor_tipo: 'invitado',
            autor_id: part.id,
            autor_nombre: part.nombre,
            autor_rol: 'ponente',
            texto,
          })
          .select('id')
          .maybeSingle();
        if (error) throw error;
        return json({ ok: true, id: data?.id });
      }

      const nombre = limpio(body.nombre, 120) || 'archivo';
      const mime = String(body.mime ?? 'application/octet-stream');
      const b64 = String(body.base64 ?? '').replace(/^data:[^;]+;base64,/, '');
      if (!b64) return json({ error: 'Archivo vacío' }, 400);

      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      if (bytes.byteLength > MAX_ADJUNTO) return json({ error: 'El archivo supera 4 MB' }, 413);

      const ext = (nombre.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8);
      const path = `${part.evento_id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await admin.storage
        .from('aula-adjuntos')
        .upload(path, bytes, { contentType: mime, upsert: false });
      if (upErr) throw upErr;

      const { data: pub } = admin.storage.from('aula-adjuntos').getPublicUrl(path);

      const { data, error } = await admin
        .from('aula_chat')
        .insert({
          evento_id: part.evento_id,
          autor_tipo: 'invitado',
          autor_id: part.id,
          autor_nombre: part.nombre,
          autor_rol: 'ponente',
          adjunto_path: path,
          adjunto_nombre: nombre,
          adjunto_bytes: bytes.byteLength,
          adjunto_mime: mime,
        })
        .select('id')
        .maybeSingle();
      if (error) throw error;

      return json({ ok: true, id: data?.id, url: pub.publicUrl });
    }

    if (accion === 'mensajes') {
      const sesion = String(body.sesion ?? '');
      if (!sesion) return json({ error: 'Sesión inválida' }, 401);

      const { data: part } = await admin
        .from('aula_participantes')
        .select('id, evento_id')
        .eq('sesion_token', sesion)
        .maybeSingle();
      if (!part) return json({ error: 'Sesión inválida' }, 401);

      const { data } = await admin
        .from('aula_chat')
        .select('id, autor_nombre, autor_rol, texto, adjunto_path, adjunto_nombre, adjunto_mime, enviado_at')
        .eq('evento_id', part.evento_id)
        .eq('borrado', false)
        .order('enviado_at', { ascending: false })
        .limit(120);

      const mensajes = ((data ?? []) as unknown as Array<{
        id: string;
        autor_nombre: string;
        autor_rol: string | null;
        texto: string | null;
        adjunto_path: string | null;
        adjunto_nombre: string | null;
        adjunto_mime: string | null;
        enviado_at: string;
      }>).reverse().map((m) => ({
        ...m,
        adjunto_url: m.adjunto_path
          ? admin.storage.from('aula-adjuntos').getPublicUrl(m.adjunto_path).data.publicUrl
          : null,
      }));

      return json({ mensajes });
    }

    if (accion === 'salir') {
      const sesion = String(body.sesion ?? '');
      if (sesion) {
        await admin
          .from('aula_participantes')
          .update({ salido_at: new Date().toISOString(), mano_levantada: false })
          .eq('sesion_token', sesion)
          .is('salido_at', null);
      }
      return json({ ok: true });
    }

    // ── Entrada ──
    const token = limpio(body.token, 64);
    const nombre = limpio(body.nombre, 80);
    const empresa = limpio(body.empresa, 80);

    if (!token) return json({ error: 'Link inválido' }, 400);

    // Solo para mostrar el nombre de la clase antes de pedir los datos.
    if (accion === 'info') {
      const { data } = await admin
        .from('aula_eventos')
        .select('titulo, estado, link_activo, fecha_inicio, fecha_fin')
        .eq('link_token', token)
        .maybeSingle();
      if (!data) return json({ error: 'Este link no es válido' }, 404);
      if (!data.link_activo || data.estado === 'finalizado' || data.estado === 'cancelado') {
        return json({ error: 'Esta clase ya terminó' }, 410);
      }
      return json({
        clase: data.titulo,
        estado: data.estado,
        fecha_inicio: data.fecha_inicio,
        fecha_fin: data.fecha_fin,
      });
    }
    if (nombre.length < 2) return json({ error: 'Escribe tu nombre' }, 400);
    if (empresa.length < 2) return json({ error: 'Escribe tu empresa' }, 400);

    const { data: evento } = await admin
      .from('aula_eventos')
      .select('id, titulo, estado, link_activo, daily_room_name, daily_room_url, fecha_inicio, fecha_fin, max_participantes, grabar')
      .eq('link_token', token)
      .maybeSingle();

    if (!evento) return json({ error: 'Este link no es válido' }, 404);
    if (!evento.link_activo || evento.estado === 'finalizado' || evento.estado === 'cancelado') {
      return json({ error: 'Esta clase ya terminó' }, 410);
    }
    if (!evento.daily_room_name || !evento.daily_room_url) {
      return json({ error: 'La sala todavía no está lista. Intenta en un momento.' }, 409);
    }

    // Cupo: cuántos están dentro ahora mismo (los invitados que reingresan no suman).
    const { count } = await admin
      .from('aula_participantes')
      .select('id', { count: 'exact', head: true })
      .eq('evento_id', evento.id)
      .is('salido_at', null);

    const { data: previo } = await admin
      .from('aula_invitados')
      .select('id, entradas')
      .eq('evento_id', evento.id)
      .ilike('nombre', nombre)
      .ilike('empresa', empresa)
      .maybeSingle();

    const tope = evento.max_participantes ?? 100;
    const { count: abiertos } = await admin
      .from('aula_participantes')
      .select('id', { count: 'exact', head: true })
      .eq('evento_id', evento.id)
      .is('salido_at', null)
      .eq('invitado_id', previo?.id ?? '00000000-0000-0000-0000-000000000000');

    if ((count ?? 0) >= tope && (abiertos ?? 0) === 0) {
      return json({ error: 'La clase alcanzó su cupo máximo' }, 409);
    }

    // Avatar opcional (data URL ya reducida en el navegador).
    let avatarUrl: string | null = null;
    const avatar = String(body.avatar ?? '');
    if (avatar.startsWith('data:image/') && avatar.length < 900_000) {
      const [, meta, b64] = avatar.match(/^data:(image\/[a-z+]+);base64,(.+)$/i) ?? [];
      if (meta && b64) {
        try {
          const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
          const ext = meta.includes('png') ? 'png' : 'jpg';
          const path = `invitados/${evento.id}/${crypto.randomUUID()}.${ext}`;
          const { error } = await admin.storage
            .from('aula-portadas')
            .upload(path, bytes, { contentType: meta, upsert: false });
          if (!error) {
            avatarUrl = admin.storage.from('aula-portadas').getPublicUrl(path).data.publicUrl;
          }
        } catch {
          /* el avatar es opcional: si falla, se sigue sin foto */
        }
      }
    }

    let invitadoId = previo?.id ?? null;
    if (invitadoId) {
      await admin
        .from('aula_invitados')
        .update({
          ultima_entrada: new Date().toISOString(),
          entradas: (previo?.entradas ?? 0) + 1,
          ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
        })
        .eq('id', invitadoId);
    } else {
      const { data: nuevo, error } = await admin
        .from('aula_invitados')
        .insert({ evento_id: evento.id, nombre, empresa, avatar_url: avatarUrl })
        .select('id')
        .maybeSingle();
      if (error) throw error;
      invitadoId = nuevo!.id;
    }

    const exp = Math.floor(
      (evento.fecha_fin ? new Date(evento.fecha_fin).getTime() : Date.now() + 4 * 3600_000) / 1000,
    ) + 7200;

    const tk = await daily('/meeting-tokens', {
      method: 'POST',
      body: JSON.stringify({
        properties: {
          room_name: evento.daily_room_name,
          user_name: `${nombre} · ${empresa}`.slice(0, 60),
          user_id: `inv-${invitadoId!.slice(0, 32)}`,
          is_owner: false,
          exp,
          eject_at_token_exp: true,
          enable_screenshare: true,
          permissions: { canSend: ['audio', 'video', 'screenVideo', 'screenAudio'] },
        },
      }),
    });

    const sesion = crypto.randomUUID();

    const { data: participante, error: pErr } = await admin
      .from('aula_participantes')
      .insert({
        evento_id: evento.id,
        invitado_id: invitadoId,
        rol: 'ponente',
        nombre: `${nombre} · ${empresa}`,
        sesion_token: sesion,
      })
      .select('id')
      .maybeSingle();
    if (pErr) throw pErr;

    return json({
      evento_id: evento.id,
      room_name: evento.daily_room_name,
      room_url: evento.daily_room_url,
      token: tk.token,
      sesion,
      participante_id: participante?.id,
      invitado_id: invitadoId,
      nombre,
      empresa,
      avatar_url: avatarUrl,
      clase: evento.titulo,
      grabar: evento.grabar,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error interno';
    console.error('aula-invitado', accion, msg);
    return json({ error: msg }, 500);
  }
});