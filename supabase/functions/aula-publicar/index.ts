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
/**
 * Portada de la clase.
 *
 * El arte de fondo lo genera la IA, pero el texto NO: los modelos de imagen
 * escriben mal el español. El título, quién conduce y los ponentes invitados
 * con su empresa se componen encima en SVG, así siempre salen legibles y con
 * la identidad de Seguros Education.
 */

function escaparXml(t: string) {
  return t
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Corta el texto en líneas de `max` caracteres sin partir palabras. */
function envolver(texto: string, max: number, maxLineas: number): string[] {
  const palabras = texto.split(/\s+/).filter(Boolean);
  const lineas: string[] = [];
  let actual = '';
  for (const palabra of palabras) {
    const candidato = actual ? `${actual} ${palabra}` : palabra;
    if (candidato.length <= max) {
      actual = candidato;
    } else {
      if (actual) lineas.push(actual);
      actual = palabra;
      if (lineas.length === maxLineas) break;
    }
  }
  if (actual && lineas.length < maxLineas) lineas.push(actual);
  if (lineas.length === maxLineas) {
    const ultima = lineas[maxLineas - 1];
    const resto = palabras.join(' ').slice(lineas.join(' ').length).trim();
    if (resto.length > 0 && !ultima.endsWith('…')) {
      lineas[maxLineas - 1] = `${ultima.replace(/\s+\S*$/, '')}…`;
    }
  }
  return lineas;
}

async function generarFondo(titulo: string, categoria: string | null): Promise<{ dataUri: string | null; error: string | null }> {
  const key = Deno.env.get('OPENAI_API_KEY');
  if (!key) return { dataUri: null, error: 'Falta OPENAI_API_KEY' };

  const prompt = [
    'Ilustración de fondo horizontal para una clase en línea de seguros y capacitación profesional.',
    `Tema: "${titulo}".`,
    categoria ? `Categoría: ${categoria}.` : '',
    'Estilo vectorial limpio y moderno, azul corporativo #1C37E0 con blancos y acento ámbar.',
    'Composición con la mitad inferior despejada y oscura para poner texto encima.',
    'Sin texto, sin letras, sin números, sin logotipos, sin marcas de agua, sin personas reconocibles.',
  ].join(' ');

  let disponibles: string[] = [];
  try {
    const lista = await fetch('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${key}` } });
    if (lista.ok) {
      const data = await lista.json();
      disponibles = (data?.data ?? []).map((m: { id: string }) => m.id).filter((id: string) => /image|dall|flux|sdxl/i.test(id));
    }
  } catch {
    /* se intenta con los nombres conocidos */
  }

  const candidatos = disponibles.length ? disponibles : ['gpt-image-1', 'dall-e-3'];
  const modelos = candidatos.flatMap((model) =>
    model.includes('dall-e-3')
      ? [{ model, size: '1792x1024' }]
      : [{ model, size: '1536x1024' }, { model, size: '1024x1024' }],
  );

  let ultimoError: string | null = null;
  for (const cfg of modelos) {
    try {
      const res = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...cfg, n: 1, prompt, output_format: 'jpeg', output_compression: 80 }),
      });
      if (!res.ok) {
        const detalle = (await res.text()).slice(0, 200);
        ultimoError = [ultimoError, `${cfg.model}: ${detalle}`].filter(Boolean).join(' || ');
        continue;
      }
      const data = await res.json();
      const item = data?.data?.[0];
      if (!item) continue;

      if (item.b64_json) return { dataUri: `data:image/jpeg;base64,${item.b64_json}`, error: null };
      if (item.url) {
        const img = await fetch(item.url);
        const buf = new Uint8Array(await img.arrayBuffer());
        let bin = '';
        for (let i = 0; i < buf.length; i += 8192) {
          bin += String.fromCharCode(...buf.subarray(i, i + 8192));
        }
        return { dataUri: `data:image/jpeg;base64,${btoa(bin)}`, error: null };
      }
    } catch (e) {
      ultimoError = e instanceof Error ? e.message : String(e);
    }
  }
  return { dataUri: null, error: ultimoError ?? 'sin respuesta de OpenAI' };
}

function componerPortada(datos: {
  titulo: string;
  fondo: string | null;
  instructores: string[];
  invitados: Array<{ nombre: string; empresa: string }>;
  fecha: string | null;
}) {
  const W = 1536;
  const H = 864;
  const M = 96;

  const lineasTitulo = envolver(datos.titulo, 34, 3);

  // Bloque inferior: se apila desde abajo hacia arriba para que nunca se
  // encime con el título, sin importar cuántos ponentes haya.
  const pie: Array<{ clase: string; texto: string }> = [];
  if (datos.instructores.length) {
    pie.push({ clase: 'instructor', texto: `Imparte: ${datos.instructores.join(' · ')}` });
  }
  for (const g of datos.invitados.slice(0, 3)) {
    pie.push({ clase: 'invitado', texto: `${g.nombre} · ${g.empresa}` });
  }

  const PASO = 38;
  const yUltima = H - 140;
  const yPrimera = yUltima - (pie.length - 1) * PASO;
  const yDivisor = yPrimera - 46;
  const yTituloUltima = yDivisor - 40;
  const yTituloPrimera = yTituloUltima - (lineasTitulo.length - 1) * 76;

  const titulo = lineasTitulo
    .map((l, i) => `<text x="${M}" y="${yTituloPrimera + i * 76}" class="titulo">${escaparXml(l)}</text>`)
    .join('');

  const pieSvg = pie
    .map((l, i) => `<text x="${M}" y="${yPrimera + i * PASO}" class="${l.clase}">${escaparXml(l.texto)}</text>`)
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="velo" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0b1444" stop-opacity="0.10"/>
      <stop offset="42%" stop-color="#0b1444" stop-opacity="0.62"/>
      <stop offset="100%" stop-color="#050b2e" stop-opacity="0.96"/>
    </linearGradient>
    <linearGradient id="marca" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#1C37E0"/>
      <stop offset="100%" stop-color="#22d3ee"/>
    </linearGradient>
    <style>
      .marca { font-family: Sora, Manrope, Helvetica, Arial, sans-serif; font-size: 22px; font-weight: 700; letter-spacing: 5px; fill: #dbeafe; }
      .titulo { font-family: Sora, Manrope, Helvetica, Arial, sans-serif; font-size: 64px; font-weight: 700; fill: #ffffff; letter-spacing: -1.5px; }
      .instructor { font-family: Manrope, Helvetica, Arial, sans-serif; font-size: 26px; font-weight: 600; fill: #e0e7ff; }
      .invitado { font-family: Manrope, Helvetica, Arial, sans-serif; font-size: 25px; font-weight: 500; fill: #fcd34d; }
      .pie { font-family: Sora, Manrope, Helvetica, Arial, sans-serif; font-size: 20px; font-weight: 600; fill: #ffffff; opacity: 0.72; }
      .fecha { font-family: Manrope, Helvetica, Arial, sans-serif; font-size: 19px; font-weight: 500; fill: #c7d2fe; opacity: 0.8; }
    </style>
  </defs>

  ${datos.fondo
    ? `<image href="${datos.fondo}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>`
    : `<rect width="${W}" height="${H}" fill="#0b1444"/>
       <circle cx="1260" cy="150" r="300" fill="#1C37E0" opacity="0.35"/>
       <circle cx="1420" cy="330" r="180" fill="#22d3ee" opacity="0.18"/>`}

  <rect width="${W}" height="${H}" fill="url(#velo)"/>
  <rect x="0" y="0" width="${W}" height="10" fill="url(#marca)"/>

  <rect x="${M}" y="${M}" width="52" height="6" rx="3" fill="#22d3ee"/>
  <text x="${M + 70}" y="${M + 10}" class="marca">SEGUROS EDUCATION</text>

  ${titulo}

  <line x1="${M}" y1="${yDivisor}" x2="${W - M}" y2="${yDivisor}" stroke="#ffffff" stroke-opacity="0.16" stroke-width="2"/>

  ${pieSvg}

  <text x="${W - M}" y="${H - 54}" text-anchor="end" class="pie">MOVI Digital</text>
  ${datos.fecha ? `<text x="${W - M}" y="${H - 88}" text-anchor="end" class="fecha">${escaparXml(datos.fecha)}</text>` : ''}
</svg>`;
}

async function publicarPortada(svg: string): Promise<{ url: string | null; error: string | null }> {
  const path = `portadas/${crypto.randomUUID()}.svg`;
  const { error } = await admin.storage
    .from('aula-portadas')
    .upload(path, new TextEncoder().encode(svg), { contentType: 'image/svg+xml', upsert: false });
  if (error) return { url: null, error: error.message };
  return { url: admin.storage.from('aula-portadas').getPublicUrl(path).data.publicUrl, error: null };
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

    // 2) Portada: fondo con IA + texto compuesto (título, quién imparte y
    //    ponentes invitados con su empresa). Si ya existe, se respeta.
    let portada = evento.portada_url as string | null;
    let portadaError: string | null = null;

    // Quién condujo y quiénes fueron invitados: sirve para la portada y la ficha.
    let { data: hosts } = await admin
      .from('aula_evento_hosts')
      .select('rol, usuarios(nombre_completo, nombre, apellidos)')
      .eq('evento_id', eventoId)
      .order('rol');
    if (!hosts?.length && evento.creado_por) {
      const { data: autor } = await admin
        .from('usuarios')
        .select('nombre_completo, nombre, apellidos')
        .eq('id', evento.creado_por as string)
        .maybeSingle();
      if (autor) hosts = [{ rol: 'host', usuarios: autor } as unknown as typeof hosts[number]];
    }

    const { data: invitados } = await admin
      .from('aula_invitados')
      .select('nombre, empresa')
      .eq('evento_id', eventoId)
      .order('primera_entrada');

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

      const fondo = await generarFondo(evento.titulo as string, categoriaNombre);
      if (fondo.error) console.error('aula-publicar: fondo', fondo.error);

      const nombreDe = (row: { usuarios?: { nombre_completo?: string; nombre?: string; apellidos?: string } | null }) =>
        row.usuarios?.nombre_completo ||
        [row.usuarios?.nombre, row.usuarios?.apellidos].filter(Boolean).join(' ') ||
        'Equipo MOVI';

      const svg = componerPortada({
        titulo: evento.titulo as string,
        fondo: fondo.dataUri,
        instructores: (hosts ?? []).map((h) => nombreDe(h as never)),
        invitados: (invitados ?? []) as Array<{ nombre: string; empresa: string }>,
        fecha: evento.fecha_inicio
          ? new Date(evento.fecha_inicio as string).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
          : null,
      });

      const subida = await publicarPortada(svg);
      portada = subida.url;
      portadaError = fondo.error ?? subida.error;
      if (subida.error) console.error('aula-publicar: portada', subida.error);
    }

    // 3) Lección en On Demand (se crea o se actualiza si la clase se republica)
    let leccionId = evento.leccion_id as string | null;
    const payloadLeccion = {
      titulo: evento.titulo as string,
      descripcion: (evento.descripcion as string | null) ?? null,
      miniatura_url: portada,
      video_url: videoUrl,
      duracion: minutos(duracion),
      es_grabacion: true,
      // seguros_lessons.session_id apunta a seguros_sessions (el temario de On
      // Demand), no al evento. El vínculo clase→lección vive en
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
        .upsert({ lesson_id: leccionId, category_id: evento.categoria_id }, { onConflict: 'lesson_id,category_id' })
        .then(() => null, () => null);
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

    // 4) Material de apoyo
    const docs: Array<{
      nombre_archivo: string;
      archivo_url: string;
      tipo_archivo: string;
      tamano_bytes: number | null;
      descripcion: string;
      orden: number;
    }> = [];

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