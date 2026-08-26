import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import * as XLSX from "npm:xlsx";

const LECTOR_URL = "https://lector.movi.digital";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STORAGE_BUCKET = "ticket-archivos";

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

function parseNum(v: string | null | undefined): number | null {
  if (!v) return null;
  const n = parseFloat(String(v).replace(/,/g, ""));
  return isNaN(n) ? null : n;
}

function parseDate(v: string | null | undefined): string | null {
  if (!v || v === "No encontrada") return null;
  const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const m2 = v.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (m2) return `${m2[3]}-${m2[2]}-${m2[1]}`;
  return null;
}

function buildMessage(campos: Record<string, string>, aseguradora?: string, subRamo?: string, folio?: string): string {
  const lineas = [
    folio && `Trámite: ${folio}`,
    campos.documento && `Póliza: ${campos.documento}`,
    aseguradora && `Aseguradora: ${aseguradora}`,
    subRamo && `Sub ramo: ${subRamo}`,
    campos.nombre_cliente && `Cliente: ${campos.nombre_cliente}`,
    campos.rfc && `RFC: ${campos.rfc}`,
    campos.desde && `Vigencia: ${campos.desde} – ${campos.hasta || ""}`,
    campos.prima_total && `Prima Total: $${campos.prima_total}`,
    campos.placas && `Placas: ${campos.placas}`,
    campos.serie && `Serie: ${campos.serie}`,
  ].filter(Boolean);
  return lineas.join("\n");
}

const SICAS_HEADERS = [
  "Entidad", "Apellido Paterno", "Apellido Materno", "Nombre",
  "Razón Social", "R.F.C.", "Grupo", "Ejecutivo de Cuenta", "Despacho",
  "Tipo Documento", "Documento", "Agente", "Forma Pago", "Moneda",
  "Sub Ramo", "Vendedor", "Renovación", "Fecha Antigüedad", "Desde", "Hasta",
  "Estatus", "Prima Neta", "Descuento", "Recargos", "Derechos", "Sub Total",
  "IVA", "Prima Total", "Concepto", "Serie", "Descripción", "Modelo", "Motor", "Placas",
];

function parseName(nombreCompleto: string | null, esMoral: boolean) {
  if (esMoral || !nombreCompleto) return { apellidoP: "", apellidoM: "", nombre: nombreCompleto ?? "" };
  const parts = nombreCompleto.trim().split(/\s+/);
  if (parts.length === 1) return { apellidoP: "", apellidoM: "", nombre: parts[0] };
  if (parts.length === 2) return { apellidoP: parts[0], apellidoM: "", nombre: parts[1] };
  return { apellidoP: parts[0], apellidoM: parts[1], nombre: parts.slice(2).join(" ") };
}

function buildSicasRow(d: Record<string, unknown>): unknown[] {
  const moral = d.entidad === 1;
  const { apellidoP, apellidoM, nombre } = parseName(d.nombre_completo as string | null, moral);
  return [
    d.entidad === 0 ? "Física" : d.entidad === 1 ? "Moral" : "",
    apellidoP, apellidoM, nombre,
    d.razon_social ?? "", d.rfc ?? "", "", d.ejecutivo_cuenta ?? "", "",
    d.tipo_documento ?? "Póliza", d.documento ?? "", d.agente_clave ?? "",
    d.forma_pago ?? "", d.moneda ?? "", d.sub_ramo ?? "", "",
    d.renovacion ?? "", d.fecha_antiguedad ?? "", d.desde ?? "", d.hasta ?? "",
    "Vigente",
    d.prima_neta ?? "", d.descuento ?? "", d.recargos ?? "", d.derechos ?? "",
    d.sub_total ?? "", d.iva ?? "", d.prima_total ?? "",
    d.concepto ?? "", d.serie ?? "", d.descripcion_veh ?? "",
    d.modelo ?? "", d.motor ?? "", d.placas ?? "",
  ];
}

type NotifConfig = {
  notificar_agente: boolean;
  notificar_grupos: string[];
  plantilla_agente: string | null;
  plantilla_equipo: string | null;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "Solo POST" }, 405);

  let ticket_id: string, archivo_id: string;
  try {
    const body = await req.json();
    ticket_id = body.ticket_id;
    archivo_id = body.archivo_id;
    if (!ticket_id || !archivo_id) throw new Error("ticket_id y archivo_id son requeridos");
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Body inválido" }, 400);
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // 1. Obtener ticket
  const { data: ticket } = await sb
    .from("tickets")
    .select("tipo_tramite, agente_id, folio")
    .eq("id", ticket_id)
    .single();
  if (!ticket) return json({ ok: false, error: "Ticket no encontrado" }, 404);

  // 2. Verificar si hay config activa para este tipo de trámite
  const [{ data: tipoRow }, { data: catRow }] = await Promise.all([
    sb.from("ticket_tipos").select("id").eq("value", ticket.tipo_tramite).maybeSingle(),
    sb.from("maestro_adjunto_categorias").select("id").eq("nombre", "Póliza PDF").maybeSingle(),
  ]);

  let config: NotifConfig | null = null;
  if (tipoRow && catRow) {
    const { data: cfg } = await sb
      .from("poliza_pdf_extraccion_config")
      .select("notificar_agente, notificar_grupos, plantilla_agente, plantilla_equipo")
      .eq("ticket_tipo_id", tipoRow.id)
      .eq("categoria_id", catRow.id)
      .eq("activo", true)
      .maybeSingle();
    config = cfg;
  }

  // Sin config activa → no procesar
  if (!config) return json({ ok: true, estado: "no_configurado" });

  // 3. Marcar pendiente
  await sb.from("poliza_datos_extraidos").upsert(
    { ticket_id, archivo_id, estado: "pendiente" },
    { onConflict: "archivo_id" }
  );

  try {
    // 4. Obtener info del archivo
    const { data: archivo, error: archivoErr } = await sb
      .from("ticket_archivos")
      .select("url, nombre")
      .eq("id", archivo_id)
      .single();
    if (archivoErr || !archivo) throw new Error("Archivo no encontrado");

    // 5. Extraer path del storage y generar signed URL
    const match = archivo.url.match(/ticket-archivos\/(.+)$/);
    if (!match) throw new Error("No se pudo extraer el path del archivo");
    const storagePath = decodeURIComponent(match[1]);

    const { data: signed, error: signedErr } = await sb.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(storagePath, 300);
    if (signedErr || !signed) throw new Error("No se pudo generar URL firmada del PDF");

    // 6. Descargar PDF
    const pdfResp = await fetch(signed.signedUrl);
    if (!pdfResp.ok) throw new Error(`Error descargando PDF: ${pdfResp.status}`);
    const pdfBytes = await pdfResp.arrayBuffer();

    // 7. Llamar al extractor Python en lector.movi.digital
    const formData = new FormData();
    formData.append("files", new Blob([pdfBytes], { type: "application/pdf" }), archivo.nombre || "poliza.pdf");

    const extractResp = await fetch(`${LECTOR_URL}/api/extraer-poliza-registro`, {
      method: "POST",
      body: formData,
    });
    if (!extractResp.ok) {
      const errText = await extractResp.text();
      throw new Error(`Extractor error ${extractResp.status}: ${errText}`);
    }

    const extracted: {
      aseguradora?: string;
      ramo?: string;
      sub_ramo?: string;
      estado?: string;
      campos?: Record<string, string>;
    } = await extractResp.json();

    const campos = extracted.campos || {};
    const rfc = campos.rfc;
    const entidad = rfc ? (rfc.length <= 12 ? 1 : 0) : null;

    // 8. Guardar en poliza_datos_extraidos
    const { error: saveErr } = await sb.from("poliza_datos_extraidos").upsert({
      ticket_id,
      archivo_id,
      estado: extracted.estado || "ok",
      aseguradora: extracted.aseguradora ?? null,
      ramo: extracted.ramo ?? null,
      sub_ramo: extracted.sub_ramo ?? null,
      entidad,
      nombre_completo: campos.nombre_cliente ?? null,
      razon_social: entidad === 1 ? (campos.nombre_cliente ?? null) : null,
      rfc: rfc ?? null,
      tipo_documento: "Póliza",
      documento: campos.documento ?? null,
      agente_clave: campos.agente_clave ?? null,
      agente_nombre: campos.agente_nombre ?? null,
      forma_pago: campos.forma_pago ?? null,
      moneda: campos.moneda ?? null,
      desde: parseDate(campos.desde),
      hasta: parseDate(campos.hasta),
      prima_neta: parseNum(campos.prima_neta),
      descuento: parseNum(campos.descuento),
      recargos: parseNum(campos.recargos),
      derechos: parseNum(campos.derechos),
      sub_total: parseNum(campos.sub_total),
      iva: parseNum(campos.iva),
      prima_total: parseNum(campos.prima_total),
      concepto: campos.descripcion_veh ?? null,
      serie: campos.serie ?? null,
      descripcion_veh: campos.descripcion_veh ?? null,
      modelo: campos.modelo ?? null,
      motor: campos.motor ?? null,
      placas: campos.placas ?? null,
      cp: campos.cp ?? null,
      colonia: campos.colonia ?? null,
      municipio: campos.municipio ?? null,
    }, { onConflict: "archivo_id" });

    if (saveErr) throw new Error(`Error guardando: ${saveErr.message}`);

    // 8b. Generar y adjuntar XLSX para SICAS
    let xlsxError: string | null = null;
    try {
      const datosRow: Record<string, unknown> = {
        entidad, nombre_completo: campos.nombre_cliente ?? null,
        razon_social: entidad === 1 ? (campos.nombre_cliente ?? null) : null,
        rfc: rfc ?? null, ejecutivo_cuenta: null, renovacion: null,
        tipo_documento: "Póliza", documento: campos.documento ?? null,
        agente_clave: campos.agente_clave ?? null, forma_pago: campos.forma_pago ?? null,
        moneda: campos.moneda ?? null, sub_ramo: extracted.sub_ramo ?? null,
        desde: parseDate(campos.desde), hasta: parseDate(campos.hasta),
        prima_neta: parseNum(campos.prima_neta), descuento: parseNum(campos.descuento),
        recargos: parseNum(campos.recargos), derechos: parseNum(campos.derechos),
        sub_total: parseNum(campos.sub_total), iva: parseNum(campos.iva),
        prima_total: parseNum(campos.prima_total), concepto: campos.descripcion_veh ?? null,
        serie: campos.serie ?? null, descripcion_veh: campos.descripcion_veh ?? null,
        modelo: campos.modelo ?? null, motor: campos.motor ?? null, placas: campos.placas ?? null,
      };
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([SICAS_HEADERS, buildSicasRow(datosRow)]);
      XLSX.utils.book_append_sheet(wb, ws, "SICAS");
      const xlsxArr: number[] = XLSX.write(wb, { type: "array", bookType: "xlsx" });
      const xlsxBytes = new Uint8Array(xlsxArr);
      const xlsxName = `${ticket.folio ?? ticket_id}-SICAS.xlsx`;
      // Path dentro del folder del ticket para respetar las políticas del bucket
      const xlsxPath = `${ticket_id}/sicas/${xlsxName}`;
      const { error: uploadXlsxErr } = await sb.storage
        .from(STORAGE_BUCKET)
        .upload(xlsxPath, xlsxBytes, {
          contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          upsert: true,
        });
      if (uploadXlsxErr) throw new Error(`Upload XLSX: ${uploadXlsxErr.message}`);
      const { data: { publicUrl: xlsxUrl } } = sb.storage.from(STORAGE_BUCKET).getPublicUrl(xlsxPath);
      const { error: insertXlsxErr } = await sb.from("ticket_archivos").insert({
        ticket_id,
        usuario_id: ticket.agente_id ?? null,
        nombre: xlsxName,
        url: xlsxUrl,
        tipo: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        tamano: xlsxBytes.byteLength,
        categoria_id: catRow?.id ?? null,
      });
      if (insertXlsxErr) throw new Error(`Insert ticket_archivos XLSX: ${insertXlsxErr.message}`);
    } catch (xlsxErr) {
      xlsxError = xlsxErr instanceof Error ? xlsxErr.message : "Error generando XLSX";
      console.error("XLSX generation error:", xlsxError);
    }

    const mensaje = buildMessage(campos, extracted.aseguradora, extracted.sub_ramo, ticket.folio);
    const ticketUrl = `/tramites/${ticket_id}`;

    // 9. Notificar al agente
    if (config.notificar_agente !== false && ticket.agente_id) {
      const texto = config.plantilla_agente
        ? config.plantilla_agente
            .replace("{folio}", ticket.folio ?? "")
            .replace("{numero_poliza}", campos.documento ?? "")
            .replace("{aseguradora}", extracted.aseguradora ?? "")
            .replace("{cliente}", campos.nombre_cliente ?? "")
            .replace("{desde}", campos.desde ?? "")
            .replace("{hasta}", campos.hasta ?? "")
            .replace("{prima_total}", campos.prima_total ?? "")
            .replace("{placas}", campos.placas ?? "")
        : `El PDF de tu póliza fue recibido en el trámite ${ticket.folio ?? ticket_id}.\n\nDatos extraídos:\n${mensaje}`;

      await sb.rpc("crear_notificacion", {
        p_usuario_id: ticket.agente_id,
        p_tipo: "tramite_documento_cargado",
        p_titulo: "Datos de póliza extraídos",
        p_mensaje: texto,
        p_url: ticketUrl,
      });
    }

    // 10. Notificar equipos configurados
    const grupos: string[] = config.notificar_grupos ?? [];
    if (grupos.length > 0) {
      const textoEquipo = config.plantilla_equipo
        ? config.plantilla_equipo
            .replace("{folio}", ticket.folio ?? "")
            .replace("{numero_poliza}", campos.documento ?? "")
            .replace("{aseguradora}", extracted.aseguradora ?? "")
            .replace("{cliente}", campos.nombre_cliente ?? "")
            .replace("{agente_nombre}", campos.agente_nombre ?? "")
            .replace("{desde}", campos.desde ?? "")
            .replace("{hasta}", campos.hasta ?? "")
            .replace("{prima_total}", campos.prima_total ?? "")
            .replace("{placas}", campos.placas ?? "")
        : `Nueva póliza lista para captura en SICAS.\nTrámite: ${ticket.folio ?? ticket_id}\n\n${mensaje}`;

      for (const grupoId of grupos) {
        const { data: miembros } = await sb
          .from("tramites_grupos_miembros")
          .select("usuario_id")
          .eq("grupo_id", grupoId)
          .eq("activo", true);

        for (const m of miembros ?? []) {
          await sb.rpc("crear_notificacion", {
            p_usuario_id: m.usuario_id,
            p_tipo: "tramite_documento_cargado",
            p_titulo: "Póliza lista para captura en SICAS",
            p_mensaje: textoEquipo,
            p_url: ticketUrl,
          });
        }
      }
    }

    // 11. Insertar comentario con datos extraídos en el trámite
    await sb.from("ticket_comentarios").insert({
      ticket_id,
      usuario_id: ticket.agente_id ?? null,
      mensaje: `Datos extraídos de póliza:\n${mensaje}`,
    }).catch(() => {}); // fire-and-forget, no bloquea si falla

    return json({ ok: true, estado: extracted.estado || "ok", ...(xlsxError ? { xlsx_error: xlsxError } : {}) });

  } catch (err) {
    const message = err instanceof Error ? err.message : "Error interno";
    await sb.from("poliza_datos_extraidos").upsert(
      { ticket_id, archivo_id, estado: "error", error_detalle: message },
      { onConflict: "archivo_id" }
    );
    return json({ ok: false, error: message }, 500);
  }
});
