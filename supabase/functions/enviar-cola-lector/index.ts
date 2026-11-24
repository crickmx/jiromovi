/**
 * enviar-cola-lector — drena la bandeja de salida hacia lector.movi.digital
 *
 * `process-poliza-pdf` deja una fila en `lector_cola_entrenamiento` por cada PDF
 * que no se pudo extraer. Esta función agrupa esas filas por trámite y las manda
 * al endpoint de la cola del lector, donde su equipo las cataloga a mano para
 * entrenar al extractor.
 *
 * La invoca un cron cada 5 min (ver 20260921000001_lector_cola_outbox.sql). Nada
 * se pierde si un envío falla: la fila se queda sin `enviado_en` y el siguiente
 * ciclo la reintenta hasta MAX_INTENTOS.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LECTOR_API_KEY = Deno.env.get("MOVI_BETA_API_KEY") ?? "";

const COLA_URL = "https://lector.movi.digital/api/integraciones/movi_beta/cola";
const STORAGE_BUCKET = "ticket-archivos";

// Topes del endpoint del lector (documentados por su equipo).
const MAX_ARCHIVOS_POR_ENVIO = 30;
const MAX_BYTES_POR_ARCHIVO = 15 * 1024 * 1024;
// Su rate limit admite ráfagas de 10 y 6/min sostenidos. Con el cron cada 5 min
// esto son ~2 envíos/min, muy por debajo del límite de reposo.
const MAX_TICKETS_POR_CORRIDA = 10;
const PAUSA_ENTRE_ENVIOS_MS = 1000;
const MAX_INTENTOS = 5;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface FilaCola {
  id: string;
  ticket_id: string;
  archivo_url: string;
  intentos: number;
  archivo: { nombre: string | null } | null;
  ticket: { folio: string | null } | null;
}

/** El bucket es privado; la ruta vive dentro de la URL guardada. */
function rutaStorage(archivoUrl: string): string | null {
  const m = archivoUrl.match(/ticket-archivos\/(.+)$/);
  return m ? decodeURIComponent(m[1]) : null;
}

/** El endpoint rechaza el lote completo si un nombre no termina en .pdf. */
function nombrePdf(nombre: string | null, fallbackId: string): string {
  const base = (nombre || `${fallbackId}.pdf`).trim();
  return base.toLowerCase().endsWith(".pdf") ? base : `${base}.pdf`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  if (!LECTOR_API_KEY) {
    return json({ ok: false, error: "MOVI_BETA_API_KEY no configurada en los secrets" }, 500);
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data: filas, error: errFilas } = await sb
    .from("lector_cola_entrenamiento")
    .select(
      "id, ticket_id, archivo_url, intentos, archivo:ticket_archivos!archivo_id(nombre), ticket:tickets!ticket_id(folio)",
    )
    .is("enviado_en", null)
    .lt("intentos", MAX_INTENTOS)
    .order("creado_en", { ascending: true });

  if (errFilas) return json({ ok: false, error: errFilas.message }, 500);
  if (!filas?.length) return json({ ok: true, tickets: 0, archivos: 0, mensaje: "Nada pendiente" });

  // Agrupar por trámite: el lector quiere un envío por ticket, no uno por archivo.
  const porTicket = new Map<string, FilaCola[]>();
  for (const f of filas as unknown as FilaCola[]) {
    const lista = porTicket.get(f.ticket_id) ?? [];
    if (lista.length < MAX_ARCHIVOS_POR_ENVIO) lista.push(f);
    porTicket.set(f.ticket_id, lista);
  }

  let ticketsEnviados = 0;
  let archivosEnviados = 0;
  let omitidos = 0;
  const errores: string[] = [];
  let frenadoPorRateLimit = false;

  for (const [ticketId, lote] of [...porTicket].slice(0, MAX_TICKETS_POR_CORRIDA)) {
    const folio = lote[0].ticket?.folio || ticketId;

    // Un ticket_id repetido puede devolver 409 según su doc; con un sufijo por
    // envío nunca lo tocamos y el trámite sigue siendo legible del lado de ellos.
    const { data: previos } = await sb
      .from("lector_cola_entrenamiento")
      .select("ticket_id_enviado")
      .eq("ticket_id", ticketId)
      .not("ticket_id_enviado", "is", null);
    const yaUsados = new Set((previos ?? []).map((p) => p.ticket_id_enviado));
    const idEnvio = yaUsados.size === 0 ? folio : `${folio}-${yaUsados.size + 1}`;

    // Descargar y validar ANTES de armar el lote: un solo archivo inválido hace
    // que el endpoint rechace el envío completo.
    const fd = new FormData();
    fd.append("ticket_id", idEnvio);
    const idsEnLote: string[] = [];

    for (const fila of lote) {
      const ruta = rutaStorage(fila.archivo_url);
      if (!ruta) {
        await descartar(sb, fila, "No se pudo derivar la ruta de storage desde archivo_url");
        omitidos++;
        continue;
      }

      const { data: blob, error: errBajar } = await sb.storage.from(STORAGE_BUCKET).download(ruta);
      if (errBajar || !blob) {
        await reintentar(sb, fila, `No se pudo descargar el PDF: ${errBajar?.message ?? "sin detalle"}`);
        omitidos++;
        continue;
      }

      if (blob.size > MAX_BYTES_POR_ARCHIVO) {
        await descartar(sb, fila, `Supera el límite de 15 MB (${(blob.size / 1024 / 1024).toFixed(1)} MB)`);
        omitidos++;
        continue;
      }

      fd.append("archivos", blob, nombrePdf(fila.archivo?.nombre ?? null, fila.id));
      idsEnLote.push(fila.id);
    }

    if (idsEnLote.length === 0) continue;

    let resp: Response;
    try {
      resp = await fetch(COLA_URL, {
        method: "POST",
        headers: { "X-API-Key": LECTOR_API_KEY },
        body: fd,
      });
    } catch (e) {
      const msg = `Red: ${(e as Error).message}`;
      errores.push(`${idEnvio}: ${msg}`);
      await Promise.all(lote.filter((f) => idsEnLote.includes(f.id)).map((f) => reintentar(sb, f, msg)));
      continue;
    }

    // 202 = aceptado. 409 = ese ticket_id ya estaba registrado; su doc indica
    // tratarlo como éxito idempotente, no como error.
    if (resp.status === 202 || resp.status === 409) {
      await sb
        .from("lector_cola_entrenamiento")
        .update({ enviado_en: new Date().toISOString(), ticket_id_enviado: idEnvio, error_envio: null })
        .in("id", idsEnLote);
      ticketsEnviados++;
      archivosEnviados += idsEnLote.length;
    } else if (resp.status === 429) {
      // Nos pasamos de su rate limit: cortar la corrida, el cron retoma en 5 min.
      errores.push(`${idEnvio}: 429 rate limit, se reintenta en la siguiente corrida`);
      frenadoPorRateLimit = true;
      break;
    } else {
      const detalle = await resp.text().catch(() => "");
      const msg = `HTTP ${resp.status}: ${detalle.slice(0, 300)}`;
      errores.push(`${idEnvio}: ${msg}`);
      await Promise.all(lote.filter((f) => idsEnLote.includes(f.id)).map((f) => reintentar(sb, f, msg)));
    }

    await dormir(PAUSA_ENTRE_ENVIOS_MS);
  }

  return json({
    ok: true,
    tickets: ticketsEnviados,
    archivos: archivosEnviados,
    omitidos,
    ...(frenadoPorRateLimit ? { frenado_por_rate_limit: true } : {}),
    ...(errores.length ? { errores } : {}),
  });
});

/** Falla transitoria: suma un intento y deja la fila para el siguiente ciclo. */
async function reintentar(sb: ReturnType<typeof createClient>, fila: FilaCola, motivo: string) {
  await sb
    .from("lector_cola_entrenamiento")
    .update({ intentos: fila.intentos + 1, error_envio: motivo })
    .eq("id", fila.id);
}

/** Falla que no se arregla reintentando (archivo muy grande, ruta rota). */
async function descartar(sb: ReturnType<typeof createClient>, fila: FilaCola, motivo: string) {
  await sb
    .from("lector_cola_entrenamiento")
    .update({ intentos: MAX_INTENTOS, error_envio: motivo })
    .eq("id", fila.id);
}
