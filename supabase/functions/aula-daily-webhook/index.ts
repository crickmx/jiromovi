// aula-daily-webhook
// ---------------------------------------------------------------------------
// Recibe los eventos de Daily. Su razón de ser: la grabación en la nube no
// depende de la PC del anfitrión, así que cuando el anfitrión se cae, esto es
// lo que rescata la clase.
//
// recording.ready  → descarga el MP4, lo copia a Supabase, lo publica en On Demand
//                    y borra la copia en Daily (para no pagar almacenamiento).
// recording.error  → deja la fila en error con el mensaje.
//
// Seguridad: firma HMAC de Daily si DAILY_WEBHOOK_SECRET está configurado.
// Sin firma, solo se acepta si la grabación existe de verdad en Daily.
// ---------------------------------------------------------------------------
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);

const DAILY_API = 'https://api.daily.co/v1';
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });

function dailyKey() {
  const key = Deno.env.get('DAILY_API_KEY');
  if (!key) throw new Error('Falta DAILY_API_KEY');
  return key;
}

async function daily(path: string, init: RequestInit = {}) {
  const res = await fetch(`${DAILY_API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${dailyKey()}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(String(body?.info || body?.error || `Daily ${res.status}`));
  return body;
}

async function firmarVerifica(raw: string, firma: string | null) {
  const secreto = Deno.env.get('DAILY_WEBHOOK_SECRET');
  if (!secreto) return 'sin_secreto';
  if (!firma) return 'invalida';

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secreto),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw)));
  const hex = Array.from(mac).map((b) => b.toString(16).padStart(2, '0')).join('');

  const limpia = firma.replace(/^sha256=/, '').toLowerCase();
  if (limpia.length !== hex.length) return 'invalida';
  let iguales = 0;
  for (let i = 0; i < hex.length; i++) iguales |= hex[i].charCodeAt(0) ^ limpia[i].charCodeAt(0);
  return iguales === 0 ? 'valida' : 'invalida';
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  const raw = await req.text();
  const firma = await firmarVerifica(raw, req.headers.get('x-webhook-signature'));
  if (firma === 'invalida') {
    console.warn('aula-daily-webhook: firma inválida');
    return json({ error: 'Firma inválida' }, 401);
  }

  // Segunda cerradura: si el webhook se creó con basicAuth en Daily, se exige.
  const basico = Deno.env.get('DAILY_WEBHOOK_BASIC');
  if (basico) {
    const recibido = (req.headers.get('authorization') ?? '').replace(/^Basic\s+/i, '');
    if (recibido !== btoa(basico)) {
      console.warn('aula-daily-webhook: basicAuth incorrecto');
      return json({ error: 'No autorizado' }, 401);
    }
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(raw);
  } catch {
    return json({ error: 'Cuerpo inválido' }, 400);
  }

  const tipo = String(payload.type ?? payload.event ?? '');
  const info = (payload.payload ?? payload) as Record<string, unknown>;

  try {
    if (tipo === 'recording.ready') {
      const recordingId = String(info.recording_id ?? info.id ?? '');
      const roomName = String(info.room_name ?? '');

      if (!recordingId) return json({ error: 'recording_id ausente' }, 400);

      // Verificación real: la grabación tiene que existir en Daily.
      const rec = await daily(`/recordings/${encodeURIComponent(recordingId)}`);
      const room = String(rec?.room_name ?? roomName);

      let eventoId: string | null = null;
      if (room.startsWith('aula-')) {
        const candidato = room.slice(5);
        const { data } = await admin.from('aula_eventos').select('id').eq('id', candidato).maybeSingle();
        eventoId = data?.id ?? null;
      }
      if (!eventoId) {
        const { data } = await admin
          .from('aula_eventos')
          .select('id')
          .eq('daily_room_name', room)
          .maybeSingle();
        eventoId = data?.id ?? null;
      }
      if (!eventoId) {
        console.warn('aula-daily-webhook: sala sin evento', room);
        return json({ ok: true, ignorado: 'sala desconocida' });
      }

      // ¿Ya está publicada la copia en nube? Evita trabajo doble por reintentos.
      const { data: previa } = await admin
        .from('aula_grabaciones')
        .select('estado')
        .eq('evento_id', eventoId)
        .eq('origen', 'cloud')
        .maybeSingle();
      if (previa?.estado === 'publicada') return json({ ok: true, ya_publicada: true });

      await admin.from('aula_grabaciones').upsert(
        {
          evento_id: eventoId,
          origen: 'cloud',
          daily_recording_id: recordingId,
          duracion_segundos: Number(rec?.duration ?? 0) || null,
          estado: 'procesando',
        },
        { onConflict: 'evento_id,origen' },
      );

      const link = await daily(`/recordings/${encodeURIComponent(recordingId)}/access-link`);
      const url = String(link?.download_link ?? '');
      if (!url) throw new Error('Daily no devolvió liga de descarga');

      const dl = await fetch(url);
      if (!dl.ok || !dl.body) throw new Error(`No se pudo descargar la grabación (${dl.status})`);

      const path = `${eventoId}/cloud-${recordingId}.mp4`;
      const tamano = Number(dl.headers.get('content-length') ?? 0) || null;

      let subido = false;
      try {
        // Subida en streaming: las grabaciones pesan cientos de MB.
        const { error } = await admin.storage
          .from('aula-grabaciones')
          .upload(path, dl.body as unknown as ReadableStream<Uint8Array>, {
            contentType: 'video/mp4',
            upsert: true,
            duplex: 'half',
          } as unknown as { contentType: string; upsert: boolean });
        if (error) throw error;
        subido = true;
      } catch (e) {
        console.warn('aula-daily-webhook: streaming falló, se reintenta en memoria', e);
        const buf = new Uint8Array(await new Response(await fetch(url).then((r) => r.body!)).arrayBuffer());
        const { error } = await admin.storage
          .from('aula-grabaciones')
          .upload(path, buf, { contentType: 'video/mp4', upsert: true });
        if (error) throw error;
        subido = true;
      }

      if (!subido) throw new Error('No se pudo guardar la grabación en Storage');

      // Publicar (transcripción + portada + lección + material)
      const resp = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/aula-publicar`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'publicar',
          evento_id: eventoId,
          video_path: path,
          duracion_segundos: Number(rec?.duration ?? 0) || null,
          tamano_bytes: tamano,
          origen: 'cloud',
        }),
      });

      const resultado = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(String(resultado?.error ?? `publicar ${resp.status}`));

      // Limpieza: la copia ya vive en Supabase.
      await daily(`/recordings/${encodeURIComponent(recordingId)}`, { method: 'DELETE' }).catch(() => null);

      return json({ ok: true, evento_id: eventoId, ...resultado });
    }

    if (tipo === 'recording.error') {
      const room = String(info.room_name ?? '');
      const { data } = await admin.from('aula_eventos').select('id').eq('daily_room_name', room).maybeSingle();
      if (data?.id) {
        await admin.from('aula_grabaciones').upsert(
          {
            evento_id: data.id,
            origen: 'cloud',
            estado: 'error',
            error_mensaje: String(info.error ?? info.message ?? 'Daily reportó un error de grabación'),
          },
          { onConflict: 'evento_id,origen' },
        );
      }
      return json({ ok: true });
    }

    return json({ ok: true, ignorado: tipo || 'sin tipo' });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error interno';
    console.error('aula-daily-webhook', tipo, msg);
    return json({ error: msg }, 500);
  }
});