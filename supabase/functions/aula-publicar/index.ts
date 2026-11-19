// aula-publicar
// ---------------------------------------------------------------------------
// Cierra el ciclo de una clase grabada: sube el video, transcribe el audio,
// genera la portada con IA y publica la lección en On Demand con su material
// de apoyo (transcripción, ficha del evento y adjuntos del chat).
//
// Acciones:
//   subir-url  (host)     URLs firmadas para subir video y audio directo a Storage
//   publicar   (host o service_role)  ejecuta transcripción + portada + publicación
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

const BUCKET_VIDEO = 'aula-grabaciones';
const BUCKET_PUBLICO = 'aula-adjuntos';
const MAX_DOCS = 5; // el módulo On Demand permite 5 documentos por lección

async function usuarioDe(req: Request) {
  const auth = req.headers.get('Authorization') ?? '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token) return { user: null, servicio: false };

  if (token === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) return { user: null, servicio: true };
  if (token.startsWith('sb_secret_')) return { user: null, servicio: true };
  if (token.startsWith('eyJ')) {
    try {
      const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4)));
      if (payload?.role === 'service_role') return { user: null, servicio: true };
    } catch {
      /* no es JWT */
    }
  }

  const { data } = await admin.auth.getUser(token);
  return { user: data.user ?? null, servicio: false };
}

async function puedeAdministrar(eventoId: string, usuarioId: string | null) {
  if (!usuarioId) return false;
  const { data } = await admin.rpc('aula_puede_administrar', {
    p_evento_id: eventoId,
    p_usuario_id: usuarioId,
  });
  return data === true;
}

function minutos(segundos: number | null | undefined) {
  const s = Math.max(0, Math.round(segundos ?? 0));
  return Math.max(1, Math.round(s / 60));
}

function mmss(segundos: number) {
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  const s = segundos % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${p(m)}:${p(s)}` : `${m}:${p(s)}`;
}

// ── Transcripción ───────────────────────────────────────────────────────────
async function transcribir(audio: Uint8Array): Promise<string | null> {
  const key = Deno.env.get('OPENAI_API_KEY');
  if (!key) return null;
  if (audio.byteLength > 24 * 1024 * 1024) return null; // límite de la API

  const form = new FormData();
  form.append('file', new Blob([audio as unknown as BlobPart], { type: 'audio/webm' }), 'clase.webm');
  form.append('model', 'whisper-1');
  form.append('language', 'es');
  form.append('response_format', 'text');

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!res.ok) {
    console.error('whisper', res.status, await res.text());
    return null;
  }
  const texto = (await res.text()).trim();
  return texto.length > 20 ? texto : null;
}

// ── Portada con IA ──────────────────────────────────────────────────────────
async function generarPortada(titulo: string, categoria: string | null): Promise<{ url: string | null; error: string | null }> {
  const key = Deno.env.get('OPENAI_API_KEY');
  if (!key) return { url: null, error: 'Falta OPENAI_API_KEY' };

  const prompt = [
    'Portada corporativa horizontal para una clase en línea de seguros y capacitación profesional.',
    `Tema: "${titulo}".`,
    categoria ? `Categoría: ${categoria}.` : '',
    'Estilo: ilustración vectorial limpia y moderna, profesional y cálida, profundidad sutil,',
    'paleta azul corporativo #1C37E0 con blancos y un acento ámbar.',
    'Composición amplia con espacio negativo, sin texto, sin letras, sin logotipos, sin personas reconocibles.',
  ].join(' ');

  // Los nombres de modelo cambian con la cuenta: se pregunta cuáles hay.
  let disponibles: string[] = [];
  try {
    const lista = await fetch('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${key}` } });
    if (lista.ok) {
      const data = await lista.json();
      disponibles = (data?.data ?? []).map((m: { id: string }) => m.id).filter((id: string) => /image|dall|flux|sdxl/i.test(id));
    }
  } catch {
    /* si no se puede listar, se intenta con los nombres conocidos */
  }

  const candidatos = disponibles.length
    ? disponibles
    : ['gpt-image-1', 'dall-e-3', 'dall-e-2'];

  const modelos = candidatos.flatMap((model) =>
    model.includes('dall-e-2')
      ? [{ model, size: '1024x1024' }]
      : [{ model, size: '1536x1024' }, { model, size: '1024x1024' }],
  );
  let ultimoError: string | null = null;

  for (const cfg of modelos) {
    try {
      const res = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...cfg, n: 1, prompt }),
      });
      if (!res.ok) {
        const detalle = (await res.text()).slice(0, 200);
        ultimoError = [cfg.model + ': ' + detalle, ultimoError].filter(Boolean).join(' || ');
        console.error('portada', cfg.model, res.status, detalle);
        continue;
      }
      const data = await res.json();
      const item = data?.data?.[0];
      if (!item) continue;

      let bytes: Uint8Array;
      if (item.b64_json) {
        bytes = Uint8Array.from(atob(item.b64_json), (c) => c.charCodeAt(0));
      } else if (item.url) {
        const img = await fetch(item.url);
        bytes = new Uint8Array(await img.arrayBuffer());
      } else {
        continue;
      }

      const path = `portadas/${crypto.randomUUID()}.png`;
      const { error } = await admin.storage
        .from('aula-portadas')
        .upload(path, bytes, { contentType: 'image/png', upsert: false });
      if (error) {
        ultimoError = `storage: ${error.message}`;
        continue;
      }
      return { url: admin.storage.from('aula-portadas').getPublicUrl(path).data.publicUrl, error: null };
    } catch (e) {
      ultimoError = e instanceof Error ? e.message : String(e);
      console.error('portada', cfg.model, ultimoError);
    }
  }
  return { url: null, error: ultimoError ?? 'sin respuesta de OpenAI' };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  const { user, servicio } = await usuarioDe(req);
  if (!user && !servicio) return json({ error: 'No autenticado' }, 401);

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Cuerpo inválido' }, 400);
  }

  const accion = String(body.action ?? 'publicar');
  const eventoId = String(body.evento_id ?? '');
  if (!eventoId) return json({ error: 'evento_id es obligatorio' }, 400);

  try {
    const { data: evento } = await admin
      .from('aula_eventos')
      .select('id, titulo, descripcion, fecha_inicio, estado, leccion_id, categoria_id, portada_url, transcribir, creado_por')
      .eq('id', eventoId)
      .maybeSingle();
    if (!evento) return json({ error: 'Evento no encontrado' }, 404);

    if (!servicio && !(await puedeAdministrar(eventoId, user!.id))) {
      return json({ error: 'No tienes permiso sobre esta clase' }, 403);
    }

    if (accion === 'subir-url') {
      const tipo = String(body.tipo ?? 'video');
      const ext = String(body.ext ?? (tipo === 'audio' ? 'webm' : 'webm')).replace(/[^a-z0-9]/gi, '').slice(0, 6) || 'webm';
      const base = tipo === 'audio' ? 'audio' : 'video';
      const path = `${eventoId}/${base}-${Date.now()}.${ext}`;

      const { data, error } = await admin.storage
        .from(BUCKET_VIDEO)
        .createSignedUploadUrl(path);
      if (error) throw new Error(error.message || JSON.stringify(error));

      return json({ path, token: data.token, signedUrl: data.signedUrl });
    }

    // ── publicar ──
    const videoPath = body.video_path ? String(body.video_path) : null;
    const audioPath = body.audio_path ? String(body.audio_path) : null;
    const duracion = Number(body.duracion_segundos ?? 0) || null;
    const tamano = Number(body.tamano_bytes ?? 0) || null;
    const origen = body.origen === 'cloud' ? 'cloud' : 'local';

    if (!videoPath) return json({ error: 'Falta el video de la clase' }, 400);

    await admin.from('aula_grabaciones').upsert(
      {
        evento_id: eventoId,
        origen,
        video_path: videoPath,
        audio_path: audioPath,
        duracion_segundos: duracion,
        tamano_bytes: tamano,
        estado: 'procesando',
        completado_at: new Date().toISOString(),
      },
      { onConflict: 'evento_id,origen' },
    );

    const { data: urlData } = admin.storage.from(BUCKET_VIDEO).getPublicUrl(videoPath);
    const videoUrl = urlData.publicUrl;

    // 1) Transcripción
    let transcripcion: string | null = null;
    if (evento.transcribir && audioPath) {
      const { data: audio } = await admin.storage.from(BUCKET_VIDEO).download(audioPath);
      if (audio) transcripcion = await transcribir(new Uint8Array(await audio.arrayBuffer()));
    }

    // 2) Portada con IA (si ya hay una, se respeta)
    let portada = evento.portada_url as string | null;
    let portadaError: string | null = null;
    if (!portada) {
      let categoriaNombre: string | null = null;
      if (evento.categoria_id) {
        const { data: cat } = await admin
          .from('seguros_categories')
          .select('nombre')
          .eq('id', evento.categoria_id)
          .maybeSingle();
        categoriaNombre = cat?.nombre ?? null;
      }
      const gen = await generarPortada(evento.titulo as string, categoriaNombre);
      portada = gen.url;
      portadaError = gen.error;
      if (gen.error) console.error('aula-publicar: portada', gen.error);
    }

    // 3) Lección On Demand
    let leccionId = evento.leccion_id as string | null;
    const payloadLeccion = {
      titulo: evento.titulo as string,
      descripcion: (evento.descripcion as string | null) ?? null,
      miniatura_url: portada,
      video_url: videoUrl,
      duracion: minutos(duracion),
      es_grabacion: true,
      // Ojo: seguros_lessons.session_id apunta a seguros_sessions (el temario de
      // On Demand), no al evento. El vínculo clase→lección vive en
      // aula_eventos.leccion_id y aquí no se toca.
      fecha_creacion: evento.fecha_inicio ?? new Date().toISOString(),
      oficinas_asignadas: null,
    };

    if (leccionId) {
      await admin.from('seguros_lessons').update(payloadLeccion).eq('id', leccionId);
    } else {
      const { data: nueva, error } = await admin
        .from('seguros_lessons')
        .insert({ ...payloadLeccion, creado_por: user?.id ?? null })
        .select('id')
        .maybeSingle();
      if (error) throw new Error(error.message || JSON.stringify(error));
      leccionId = nueva!.id;
    }

    if (evento.categoria_id) {
      await admin
        .from('seguros_lesson_categories')
        .upsert(
          { lesson_id: leccionId, category_id: evento.categoria_id },
          { onConflict: 'lesson_id,category_id' },
        )
        .then(() => null, () => null);
    }

    // 4) Material de apoyo
    const docs: Array<{
      nombre_archivo: string;
      archivo_url: string;
      tipo_archivo: string;
      tamano_bytes: number | null;
      descripcion: string;
      orden: number;
    }> = [];

    const { data: invitados } = await admin
      .from('aula_invitados')
      .select('nombre, empresa')
      .eq('evento_id', eventoId)
      .order('primera_entrada');
    let { data: hosts } = await admin
      .from('aula_evento_hosts')
      .select('rol, usuarios(nombre_completo, nombre, apellidos)')
      .eq('evento_id', eventoId);

    // Clases creadas fuera de la UI (o antes de esta versión) no tienen host
    // registrado: se usa el creador del evento para que la ficha nunca salga vacía.
    if (!hosts?.length && evento.creado_por) {
      const { data: autor } = await admin
        .from('usuarios')
        .select('nombre_completo, nombre, apellidos')
        .eq('id', evento.creado_por as string)
        .maybeSingle();
      if (autor) hosts = [{ rol: 'host', usuarios: autor } as unknown as typeof hosts[number]];
    }

    type HostRow = { rol: string; usuarios?: { nombre_completo?: string; nombre?: string; apellidos?: string } | null };
    type InvitadoRow = { nombre: string; empresa: string };

    const ficha = [
      `# ${evento.titulo}`,
      '',
      evento.descripcion ? `${evento.descripcion}\n` : '',
      evento.fecha_inicio
        ? `**Fecha:** ${new Date(evento.fecha_inicio as string).toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' })}`
        : '',
      duracion ? `**Duración:** ${mmss(duracion)}` : '',
      '',
      '## Quiénes condujeron',
      ...((hosts ?? []) as unknown as HostRow[]).map((h) => {
        const u = h.usuarios;
        const nombre = u?.nombre_completo || [u?.nombre, u?.apellidos].filter(Boolean).join(' ') || 'Equipo MOVI';
        return `- ${nombre}${h.rol === 'host' ? ' (instructor)' : ' (co-instructor)'}`;
      }),
      '',
      '## Ponentes invitados',
      ...(((invitados ?? []) as unknown as InvitadoRow[]).length
        ? ((invitados ?? []) as unknown as InvitadoRow[]).map((i) => `- ${i.nombre} — ${i.empresa}`)
        : ['- Sin ponentes externos en esta sesión']),
    ].join('\n');

    const subirDoc = async (nombre: string, contenido: string, mime: string, descripcion: string, orden: number) => {
      const ext = nombre.split('.').pop() || 'txt';
      const path = `documentos/${eventoId}/${crypto.randomUUID()}.${ext}`;
      const bytes = new TextEncoder().encode(contenido);
      const { error } = await admin.storage
        .from(BUCKET_PUBLICO)
        .upload(path, bytes, { contentType: mime, upsert: false });
      if (error) return;
      const url = admin.storage.from(BUCKET_PUBLICO).getPublicUrl(path).data.publicUrl;
      docs.push({
        nombre_archivo: nombre,
        archivo_url: url,
        tipo_archivo: mime,
        tamano_bytes: bytes.byteLength,
        descripcion,
        orden,
      });
    };

    await subirDoc(
      'ficha-de-la-clase.md',
      ficha,
      'text/markdown; charset=utf-8',
      'Quién condujo la clase y qué ponentes invitados participaron.',
      1,
    );

    if (transcripcion) {
      await subirDoc(
        'transcripcion.md',
        `# Transcripción — ${evento.titulo}\n\n${transcripcion}\n`,
        'text/markdown; charset=utf-8',
        'Transcripción completa de la clase.',
        2,
      );
      const path = `${eventoId}/transcripcion-${Date.now()}.md`;
      await admin.storage
        .from(BUCKET_PUBLICO)
        .upload(path, new TextEncoder().encode(transcripcion), { contentType: 'text/plain; charset=utf-8' })
        .then(() => null, () => null);
    }

    // Adjuntos enviados en el chat (hasta completar el tope de 5 documentos)
    const { data: adjuntos } = await admin
      .from('aula_chat')
      .select('adjunto_path, adjunto_nombre, adjunto_bytes, adjunto_mime')
      .eq('evento_id', eventoId)
      .not('adjunto_path', 'is', null)
      .order('enviado_at');

    for (const a of adjuntos ?? []) {
      if (docs.length >= MAX_DOCS) break;
      const url = admin.storage.from(BUCKET_PUBLICO).getPublicUrl(a.adjunto_path as string).data.publicUrl;
      docs.push({
        nombre_archivo: (a.adjunto_nombre as string) || 'adjunto',
        archivo_url: url,
        tipo_archivo: (a.adjunto_mime as string) || 'application/octet-stream',
        tamano_bytes: (a.adjunto_bytes as number) ?? null,
        descripcion: 'Compartido durante la clase.',
        orden: docs.length + 1,
      });
    }

    if (docs.length) {
      await admin.from('seguros_lesson_documents').delete().eq('lesson_id', leccionId);
      await admin.from('seguros_lesson_documents').insert(
        docs.map((d) => ({ ...d, lesson_id: leccionId, creado_por: user?.id ?? null })),
      );
    }

    // 5) Cierre
    await admin
      .from('aula_grabaciones')
      .update({ estado: 'publicada', leccion_id: leccionId, transcripcion_origen: transcripcion ? 'whisper' : null })
      .eq('evento_id', eventoId)
      .eq('origen', origen);

    await admin
      .from('aula_eventos')
      .update({ leccion_id: leccionId, portada_url: portada })
      .eq('id', eventoId);

    return json({ ok: true, leccion_id: leccionId, portada_url: portada, portada_error: portadaError, documentos: docs.length, transcrito: !!transcripcion });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error interno';
    console.error('aula-publicar', accion, msg);
    await admin
      .from('aula_grabaciones')
      .update({ estado: 'error', error_mensaje: msg })
      .eq('evento_id', eventoId)
      .eq('origen', body.origen === 'cloud' ? 'cloud' : 'local')
      .then(() => null, () => null);
    return json({ error: msg }, 500);
  }
});