import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface DeliveryPayload {
  createdBy: string;
  createdByName: string;
  vendor: {
    sicasId: string;
    sicasKey?: string;
    sicasName: string;
    email?: string;
    type?: string;
    moviUserId?: string;
    moviUserName?: string;
    officeId?: string;
    officeName?: string;
    managementId?: string;
    managementName?: string;
  };
  extraction: {
    successful: boolean;
    data: Record<string, string | undefined>;
  };
  coverFile: {
    path: string;
    name: string;
  };
  additionalFiles: Array<{ path: string; name: string; type: string; size: number }>;
  ticketAction: "new" | "existing";
  existingTicketId?: string;
  existingTicketFolio?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await anonClient.auth.getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: usuario } = await supabase
      .from("usuarios")
      .select("id, rol, nombre, apellidos, oficina_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!usuario || usuario.rol === "Agente") {
      return new Response(
        JSON.stringify({ success: false, error: "No tienes permisos para usar este modulo" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload: DeliveryPayload = await req.json();
    const ext = payload.extraction.data;
    const agentUserId = payload.vendor.moviUserId || user.id;
    const isExistingTicket = payload.ticketAction === "existing" && !!payload.existingTicketId;

    // Get status ID for "Emitido (Ganado)" - this is the final close status
    const { data: estatusGanadoData } = await supabase
      .from("ticket_estatus")
      .select("id")
      .eq("nombre", "Emitido (Ganado)")
      .eq("activo", true)
      .maybeSingle();

    // Fallback to "Emitido" if "Emitido (Ganado)" doesn't exist
    let estatusId = estatusGanadoData?.id;
    if (!estatusId) {
      const { data: estatusFallback } = await supabase
        .from("ticket_estatus")
        .select("id")
        .eq("nombre", "Emitido")
        .eq("activo", true)
        .maybeSingle();
      estatusId = estatusFallback?.id;
    }

    let ticketId: string;
    let ticketFolio: string;

    if (isExistingTicket) {
      // ===== FLOW A: Attach to existing ticket =====
      ticketId = payload.existingTicketId!;
      ticketFolio = payload.existingTicketFolio || "";

      // Verify the ticket exists
      const { data: existingTicket, error: ticketCheckErr } = await supabase
        .from("tickets")
        .select("id, folio, estatus_id, cerrado")
        .eq("id", ticketId)
        .maybeSingle();

      if (ticketCheckErr || !existingTicket) {
        return new Response(
          JSON.stringify({ success: false, error: "El tramite seleccionado no existe o fue eliminado" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      ticketFolio = existingTicket.folio || ticketFolio;

      // Close ticket as "Emitido (Ganado)"
      const updateFields: Record<string, unknown> = {
        resultado: "ganado",
        cerrado: true,
        cerrado_en: new Date().toISOString(),
        cerrado_por: user.id,
        poliza: ext.numeroPoliza || existingTicket.id,
      };
      if (estatusId) updateFields.estatus_id = estatusId;

      await supabase.from("tickets").update(updateFields).eq("id", ticketId);

      // Add comment with delivery details
      let comentario = `Poliza entregada por ${payload.createdByName}.\n\n`;
      if (payload.extraction.successful) {
        comentario += `Datos extraidos de caratula:\n`;
        if (ext.numeroPoliza) comentario += `- Poliza: ${ext.numeroPoliza}\n`;
        if (ext.nombreCliente) comentario += `- Asegurado: ${ext.nombreCliente}\n`;
        if (ext.descripcionVehiculo) comentario += `- Vehiculo: ${ext.descripcionVehiculo}\n`;
        if (ext.placas) comentario += `- Placas: ${ext.placas}\n`;
        if (ext.inicioVigencia && ext.finVigencia) comentario += `- Vigencia: ${ext.inicioVigencia} al ${ext.finVigencia}\n`;
        if (ext.primaTotal) comentario += `- Prima total: ${ext.primaTotal}\n`;
      } else {
        comentario += `(Los datos de la caratula no pudieron ser extraidos automaticamente)\n`;
      }
      comentario += `\nDocumentos adjuntos: Caratula + ${payload.additionalFiles.length} archivos adicionales.`;
      comentario += `\nTramite cerrado como Emitido (Ganado).`;

      await supabase.from("ticket_comentarios").insert({
        ticket_id: ticketId,
        usuario_id: user.id,
        contenido: comentario,
      });

      // Add historial entry
      await supabase.from("ticket_historial").insert({
        ticket_id: ticketId,
        usuario_id: user.id,
        accion: "entrega_poliza",
        detalle: {
          tipo: "entrega_poliza_agregada",
          poliza: ext.numeroPoliza || null,
          asegurado: ext.nombreCliente || null,
          prima_total: ext.primaTotal || null,
          archivos_adjuntos: 1 + payload.additionalFiles.length,
          cerrado_como: "Emitido (Ganado)",
        },
      });

      // Attach files
      const fileInserts = [];
      fileInserts.push({
        ticket_id: ticketId,
        usuario_id: user.id,
        nombre: `[Caratula] ${payload.coverFile.name}`,
        url: payload.coverFile.path,
        tipo: "application/pdf",
        tamano: 0,
      });
      for (const file of payload.additionalFiles) {
        fileInserts.push({
          ticket_id: ticketId,
          usuario_id: user.id,
          nombre: file.name,
          url: file.path,
          tipo: file.type,
          tamano: file.size,
        });
      }
      if (fileInserts.length > 0) {
        await supabase.from("ticket_archivos").insert(fileInserts);
      }

    } else {
      // ===== FLOW B: Create new ticket =====

      const { data: folioData } = await supabase.rpc("generate_next_folio");
      const folio = folioData || `RA-${Date.now()}`;

      const { data: activityType } = await supabase
        .from("tramite_activity_types")
        .select("id")
        .eq("nombre", "Emisión")
        .maybeSingle();

      const { data: insuranceType } = await supabase
        .from("insurance_types")
        .select("id")
        .eq("nombre", "Seguro de auto")
        .maybeSingle();

      const { data: insurer } = await supabase
        .from("aseguradoras")
        .select("id")
        .eq("nombre", "Qualitas")
        .maybeSingle();

      let descripcion = `Entrega de poliza generada desde el modulo Entrega de Polizas.\n\n`;
      if (payload.extraction.successful) {
        descripcion += `Datos extraidos de la caratula:\n`;
        descripcion += `- Aseguradora: Qualitas\n`;
        if (ext.tipoPoliza) descripcion += `- Tipo de poliza: ${ext.tipoPoliza}\n`;
        if (ext.numeroPoliza) descripcion += `- Numero de poliza: ${ext.numeroPoliza}\n`;
        if (ext.nombreCliente) descripcion += `- Cliente / asegurado: ${ext.nombreCliente}\n`;
        if (ext.rfcAsegurado) descripcion += `- RFC: ${ext.rfcAsegurado}\n`;
        if (ext.descripcionVehiculo) descripcion += `- Vehiculo: ${ext.descripcionVehiculo}\n`;
        if (ext.placas) descripcion += `- Placas: ${ext.placas}\n`;
        if (ext.serie) descripcion += `- Serie: ${ext.serie}\n`;
        if (ext.motor) descripcion += `- Motor: ${ext.motor}\n`;
        if (ext.inicioVigencia && ext.finVigencia) descripcion += `- Vigencia: ${ext.inicioVigencia} al ${ext.finVigencia}\n`;
        if (ext.formaPago) descripcion += `- Forma de pago: ${ext.formaPago}\n`;
        if (ext.moneda) descripcion += `- Moneda: ${ext.moneda}\n`;
        if (ext.primaNeta) descripcion += `- Prima neta: ${ext.primaNeta}\n`;
        if (ext.primaTotal) descripcion += `- Prima total: ${ext.primaTotal}\n`;
      } else {
        descripcion += `NOTA: No se pudieron extraer los datos de la caratula automaticamente.\n`;
      }

      descripcion += `\nVendedor asignado:\n`;
      descripcion += `- Vendedor SICAS: ${payload.vendor.sicasName}\n`;
      if (payload.vendor.sicasKey) descripcion += `- Clave vendedor: ${payload.vendor.sicasKey}\n`;
      if (payload.vendor.officeName) descripcion += `- Oficina: ${payload.vendor.officeName}\n`;
      if (payload.vendor.managementName) descripcion += `- Gerencia: ${payload.vendor.managementName}\n`;
      descripcion += `\nDocumentos adjuntos:\n`;
      descripcion += `- Caratula de seguro: ${payload.coverFile.name}\n`;
      descripcion += `- Documentos adicionales: ${payload.additionalFiles.length}\n`;

      const ticketInsert: Record<string, unknown> = {
        folio,
        tipo_tramite: "cotizacion_emision",
        activity_subtype_id: activityType?.id,
        agente_usuario_id: agentUserId,
        agente_id: agentUserId,
        insurance_type_id: insuranceType?.id,
        insurers: insurer?.id ? [insurer.id] : [],
        attending_user_id: user.id,
        assigned_to_user_id: user.id,
        request_datetime: new Date().toISOString(),
        prioridad: "Media",
        instrucciones: descripcion,
        estatus_id: estatusId,
        creado_por: user.id,
        poliza: ext.numeroPoliza || null,
        cerrado: true,
        cerrado_en: new Date().toISOString(),
        cerrado_por: user.id,
        resultado: "ganado",
      };

      const { data: ticket, error: ticketError } = await supabase
        .from("tickets")
        .insert(ticketInsert)
        .select("id, folio")
        .single();

      if (ticketError) {
        return new Response(
          JSON.stringify({ success: false, error: `Error al crear tramite: ${ticketError.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      ticketId = ticket.id;
      ticketFolio = ticket.folio;

      // Attach files
      const fileInserts = [];
      fileInserts.push({
        ticket_id: ticketId,
        usuario_id: user.id,
        nombre: `[Caratula] ${payload.coverFile.name}`,
        url: payload.coverFile.path,
        tipo: "application/pdf",
        tamano: 0,
      });
      for (const file of payload.additionalFiles) {
        fileInserts.push({
          ticket_id: ticketId,
          usuario_id: user.id,
          nombre: file.name,
          url: file.path,
          tipo: file.type,
          tamano: file.size,
        });
      }
      if (fileInserts.length > 0) {
        await supabase.from("ticket_archivos").insert(fileInserts);
      }

      // Create ticket assignment
      await supabase.from("ticket_asignaciones").insert({
        ticket_id: ticketId,
        ejecutivo_id: user.id,
        asignado_por: user.id,
      });
    }

    // ===== COMMON: SICAS registration status =====
    const hasMinimumSicasData = !!(
      ext.numeroPoliza &&
      ext.nombreCliente &&
      ext.inicioVigencia &&
      ext.finVigencia &&
      payload.vendor.sicasId &&
      payload.coverFile.path
    );

    const initialSicasStatus = hasMinimumSicasData ? "ready_to_register" : "manual_review_required";
    const reviewReason = hasMinimumSicasData
      ? null
      : [
          !ext.numeroPoliza && "Numero de poliza",
          !ext.nombreCliente && "Nombre del asegurado",
          !ext.inicioVigencia && "Inicio de vigencia",
          !ext.finVigencia && "Fin de vigencia",
          !payload.vendor.sicasId && "Vendedor SICAS",
        ].filter(Boolean).join(", ");

    // ===== Save delivery record =====
    const deliveryInsert = {
      created_by: user.id,
      created_by_name: payload.createdByName,
      vendor_sicas_id: payload.vendor.sicasId,
      vendor_sicas_key: payload.vendor.sicasKey || null,
      vendor_sicas_name: payload.vendor.sicasName,
      vendor_email: payload.vendor.email || null,
      vendor_type: payload.vendor.type || null,
      movi_user_id: payload.vendor.moviUserId || null,
      movi_user_name: payload.vendor.moviUserName || null,
      sicas_office_id: payload.vendor.officeId || null,
      sicas_office_name: payload.vendor.officeName || null,
      sicas_management_id: payload.vendor.managementId || null,
      sicas_management_name: payload.vendor.managementName || null,
      policy_number: ext.numeroPoliza || null,
      policy_type: ext.tipoPoliza || null,
      insured_name: ext.nombreCliente || null,
      insured_rfc: ext.rfcAsegurado || null,
      vehicle_description: ext.descripcionVehiculo || null,
      plates: ext.placas || null,
      vin: ext.serie || null,
      engine: ext.motor || null,
      payment_method: ext.formaPago || null,
      currency: ext.moneda || null,
      net_premium: ext.primaNeta || null,
      total_premium: ext.primaTotal || null,
      start_date: ext.inicioVigencia || null,
      end_date: ext.finVigencia || null,
      extracted_data: payload.extraction.data,
      extraction_successful: payload.extraction.successful,
      cover_file_path: payload.coverFile.path,
      cover_file_name: payload.coverFile.name,
      additional_files: payload.additionalFiles,
      additional_files_count: payload.additionalFiles.length,
      ticket_id: ticketId,
      ticket_folio: ticketFolio,
      ticket_status: "Emitido (Ganado)",
      status: "completado",
      sicas_registration_status: initialSicasStatus,
      sicas_manual_review_reason: reviewReason,
      ticket_action_type: isExistingTicket ? "existing_ticket" : "new_ticket",
      ticket_was_existing: isExistingTicket,
      ticket_closed_as_won: true,
      ticket_close_status: "Emitido (Ganado)",
      ticket_closed_at: new Date().toISOString(),
      ticket_closed_by: user.id,
    };

    const { data: delivery, error: deliveryError } = await supabase
      .from("policy_deliveries")
      .insert(deliveryInsert)
      .select("id")
      .single();

    if (deliveryError) {
      console.error("Error saving delivery:", deliveryError);
    }

    // ===== Notification (in-app) =====
    let notificationSent = false;
    try {
      const notifMsg = isExistingTicket
        ? `Se agrego una poliza a tu tramite ${ticketFolio} y fue cerrado como Emitido (Ganado).`
        : `Se te ha entregado una nueva poliza. Revisa el tramite de Emision ${ticketFolio}.`;

      await supabase.from("notificaciones").insert({
        usuario_id: agentUserId,
        tipo: "tramite",
        titulo: "Poliza entregada",
        mensaje: notifMsg,
        url: `/tramites/${ticketId}`,
        leida: false,
      });
      notificationSent = true;
    } catch (notifErr) {
      console.error("Notification error:", notifErr);
    }

    // ===== Email to vendor (best-effort) =====
    let emailSent = false;
    let emailError: string | null = null;

    if (payload.vendor.email) {
      try {
        const resendApiKey = Deno.env.get("RESEND_API_KEY");
        if (resendApiKey) {
          const emailBody = `
Hola ${payload.vendor.sicasName},

Se te ha entregado una nueva poliza en MOVI Digital.

Datos principales:
- Poliza: ${ext.numeroPoliza || "N/A"}
- Cliente: ${ext.nombreCliente || "N/A"}
- Vehiculo: ${ext.descripcionVehiculo || "N/A"}
- Vigencia: ${ext.inicioVigencia || "N/A"} al ${ext.finVigencia || "N/A"}
- Prima total: ${ext.primaTotal || "N/A"}

Puedes consultar el tramite completo en MOVI:
https://app.movi.digital/tramites/${ticketId}

Adjuntamos la caratula de seguro y los documentos adicionales incluidos en la entrega.

Saludos,
MOVI Digital
          `.trim();

          const emailRes = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${resendApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "MOVI Digital <notificaciones@movi.digital>",
              to: [payload.vendor.email],
              subject: `Nueva poliza entregada - ${ext.numeroPoliza || "Sin numero"}`,
              text: emailBody,
            }),
          });

          if (emailRes.ok) {
            emailSent = true;
          } else {
            const errText = await emailRes.text();
            emailError = `Email failed: ${emailRes.status} - ${errText}`;
          }
        } else {
          emailError = "RESEND_API_KEY not configured";
        }
      } catch (err) {
        emailError = err instanceof Error ? err.message : "Email send error";
      }
    } else {
      emailError = "El vendedor no tiene correo registrado";
    }

    // Update delivery with notification/email status
    if (delivery?.id) {
      await supabase
        .from("policy_deliveries")
        .update({
          email_sent: emailSent,
          email_error: emailError,
          notification_sent: notificationSent,
        })
        .eq("id", delivery.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        ticket: { id: ticketId, folio: ticketFolio },
        deliveryId: delivery?.id,
        emailSent,
        emailError,
        notificationSent,
        wasExistingTicket: isExistingTicket,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error interno del servidor";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
