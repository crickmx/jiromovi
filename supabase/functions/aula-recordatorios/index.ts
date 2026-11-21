// aula-recordatorios
// ---------------------------------------------------------------------------
// Lo llama pg_cron cada minuto (job `aula-recordatorios`).
//
// 1) Detecta clases que empiezan en 30 y en 10 minutos y encola a su audiencia.
// 2) Drena la cola llamando a `enviar-correo-transaccional`, que resuelve
//    correo + WhatsApp + notificación in-app. El push nativo sale solo: el
//    trigger trg_push_nativo_notificaciones escucha los INSERT en notificaciones.
//
// Es idempotente: (evento, tipo) y (evento, usuario, tipo) son únicos.
// ---------------------------------------------------------------------------
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });
const ROLES = ['Agente', 'Empleado', 'Gerente', 'Administrador'];
const LOTE = 20;

/**
 * Solo el cron. El gateway convierte las llaves `sb_secret_` en un JWT con
 * role=service_role, así que se acepta tanto la llave legacy como ese JWT.
 */
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

async function encolar(evento: {
  id: string;
  titulo: string;
  fecha_inicio: string;
}, tipo: '30m' | '10m' | '5m' | 'invitacion', minutos: number) {
  // ¿Ya se encoló esta clase para este aviso?
  const { data: marca } = await admin
    .from('aula_recordatorios')
    .select('evento_id')
    .eq('evento_id', evento.id)
    .eq('tipo', tipo)
    .maybeSingle();
  if (marca) return 0;

  const { data: usuarios } = await admin
    .from('usuarios')
    .select('id')
    .in('rol', ROLES)
    .eq('activo', true)
    .is('deleted_at', null);
  const lista = (usuarios ?? []) as unknown as Array<{ id: string }>;
  if (!lista.length) return 0;

  const filas = lista.map((u) => ({
    evento_id: evento.id,
    usuario_id: u.id,
    tipo,
    estado: 'pendiente' as const,
  }));

  // El lote se parte porque supabase-js no acepta miles de filas de golpe.
  for (let i = 0; i < filas.length; i += 400) {
    await admin.from('aula_recordatorio_envios').upsert(filas.slice(i, i + 400), {
      onConflict: 'evento_id,usuario_id,tipo',
      ignoreDuplicates: true,
    });
  }

  await admin
    .from('aula_recordatorios')
    .insert({ evento_id: evento.id, tipo })
    .then(() => null, () => null);

  console.log(`aula-recordatorios: ${evento.id} ${tipo} → ${filas.length} destinatarios`);
  return filas.length;
}

async function drenar() {
  const { data: pendientes } = await admin
    .from('aula_recordatorio_envios')
    .select('id, evento_id, usuario_id, tipo, intentos, aula_eventos(titulo, descripcion, portada_url, fecha_inicio, fecha_fin)')
    .eq('estado', 'pendiente')
    .order('creado_en')
    .limit(LOTE);

  if (!pendientes?.length) return { enviados: 0, errores: 0 };

  let enviados = 0;
  let errores = 0;

  for (const fila of pendientes) {
    const evento = (fila as unknown as { aula_eventos?: { titulo: string; descripcion: string | null; portada_url: string | null; fecha_inicio: string | null; fecha_fin: string | null } }).aula_eventos;
    if (!evento) {
      await admin.from('aula_recordatorio_envios').update({ estado: 'error', error: 'evento ausente' }).eq('id', fila.id);
      errores++;
      continue;
    }

    const minutos = fila.tipo === '10m' ? 10 : fila.tipo === '5m' ? 5 : 30;
    const inicio = evento.fecha_inicio ? new Date(evento.fecha_inicio) : null;
    const fin = evento.fecha_fin ? new Date(evento.fecha_fin) : null;
    const duracion =
      inicio && fin && fin > inicio ? ` · ${Math.round((fin.getTime() - inicio.getTime()) / 60_000)} min` : '';
    const hora = inicio
      ? inicio.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City' })
      : '';
    const fecha = inicio
      ? inicio.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Mexico_City' })
      : '';

    const { data: hosts } = await admin
      .from('aula_evento_hosts')
      .select('usuario_id')
      .eq('evento_id', fila.evento_id)
      .eq('usuario_id', fila.usuario_id)
      .maybeSingle();

    // Invitación y recordatorio de 10 minutos llevan a la clase y salen por
    // correo y WhatsApp; el aviso de 30 minutos va solo por correo para no
    // saturar el canal.
    const eventKey =
      fila.tipo === 'invitacion'
        ? 'aula_invitacion_clase'
        : fila.tipo === '10m'
          ? 'aula_recordatorio_10'
          : hosts
            ? 'aula_recordatorio'
            : 'aula_recordatorio_email';

    // Enlace directo a la sala de esa clase (no al listado).
    const urlClase = `${Deno.env.get('APP_URL') ?? 'https://app.movi.digital'}/seguros-education/aula-virtual/${fila.evento_id}`;

    try {
      const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/enviar-correo-transaccional`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event_key: eventKey,
          user_id: fila.usuario_id,
          variables: {
            // `capacitacion` es el nombre nuevo; `clase` se mantiene por las
            // plantillas viejas que aún lo usen.
            capacitacion: evento.titulo,
            clase: evento.titulo,
            minutos: String(minutos),
            hora,
            fecha,
            duracion,
            descripcion: evento.descripcion?.trim() || 'Te esperamos en el Aula Virtual de Seguros Education.',
            imagen: evento.portada_url || `${Deno.env.get('APP_URL') ?? 'https://app.movi.digital'}/movirecurso_11.png`,
            url: urlClase,
          },
        }),
      });

      if (!res.ok) throw new Error(`plantilla ${res.status}`);
      enviados++;
      await admin
        .from('aula_recordatorio_envios')
        .update({ estado: 'enviado', enviado_en: new Date().toISOString() })
        .eq('id', fila.id);
    } catch (e) {
      errores++;
      const intentos = (fila.intentos ?? 0) + 1;
      await admin
        .from('aula_recordatorio_envios')
        .update({
          intentos,
          estado: intentos >= 3 ? 'error' : 'pendiente',
          error: e instanceof Error ? e.message : 'error',
        })
        .eq('id', fila.id);
    }
  }

  return { enviados, errores };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json({ ok: true });

  const auth = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!esServicio(auth)) return json({ error: 'No autorizado' }, 401);

  // `dry_run` encola sin enviar: sirve para probar el motor sin mandar correos.
  let cuerpo: Record<string, unknown> = {};
  try {
    cuerpo = await req.json();
  } catch {
    /* el cron manda cuerpo vacío */
  }

  try {
    const ahora = Date.now();
    const { data: proximos } = await admin
      .from('aula_eventos')
      .select('id, titulo, fecha_inicio')
      .eq('estado', 'programado')
      .not('fecha_inicio', 'is', null)
      .gte('fecha_inicio', new Date(ahora - 60_000).toISOString())
      .lte('fecha_inicio', new Date(ahora + 31 * 60_000).toISOString());

    let encolados = 0;
    for (const evento of proximos ?? []) {
      const faltan = Math.round((new Date(evento.fecha_inicio!).getTime() - ahora) / 60_000);
      if (faltan <= 31 && faltan >= 29) encolados += await encolar(evento, '30m', 30);
      else if (faltan <= 11 && faltan >= 9) encolados += await encolar(evento, '10m', 10);
    }

    const drenado = cuerpo.dry_run ? { enviados: 0, errores: 0, seco: true } : await drenar();
    return json({ ok: true, encolados, ...drenado });
  } catch (e) {
    console.error('aula-recordatorios', e);
    return json({ error: e instanceof Error ? e.message : 'Error interno' }, 500);
  }
});