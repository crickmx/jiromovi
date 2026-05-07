import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface WhatsAppPayload {
  phone: string;
  message: string;
  documents?: Array<{ fileName: string; filePath: string }>;
  ticket_id?: string;
}

async function getSignedUrl(
  supabase: ReturnType<typeof createClient>,
  filePath: string
): Promise<string | null> {
  // For full URLs, extract storage path and create a signed URL (bucket is private)
  if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
    const publicMatch = filePath.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/);
    if (publicMatch) {
      const bucket = publicMatch[1];
      const path = decodeURIComponent(publicMatch[2]);
      const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
      return data?.signedUrl || null;
    }
    // Already a signed URL or external URL - return as-is
    return filePath;
  }
  const { data } = await supabase.storage
    .from("ticket-archivos")
    .createSignedUrl(filePath, 3600);
  return data?.signedUrl || null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: WhatsAppPayload = await req.json();
    const { phone, message, documents, ticket_id } = payload;

    if (!phone || !message) {
      return new Response(
        JSON.stringify({ success: false, error: "phone and message are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get WhatsApp configuration
    const { data: config } = await supabase
      .from("whatsapp_configuracion")
      .select("api_key, channel_id_uuid, activo")
      .eq("activo", true)
      .maybeSingle();

    if (!config?.api_key) {
      return new Response(
        JSON.stringify({ success: false, error: "WhatsApp not configured or inactive" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cleanPhone = phone.replace(/[^0-9]/g, "");
    const chatId = cleanPhone.startsWith("52") ? cleanPhone : `52${cleanPhone}`;

    // Send text message
    const msgRes = await fetch("https://api.wazzup24.com/v3/message", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.api_key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channelId: config.channel_id_uuid,
        chatType: "whatsapp",
        chatId,
        text: message,
      }),
    });

    if (!msgRes.ok) {
      const errText = await msgRes.text();
      return new Response(
        JSON.stringify({ success: false, error: `Wazzup ${msgRes.status}: ${errText}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send documents if provided
    let documentsSent = 0;
    const failedDocuments: string[] = [];

    const docsToSend = documents || [];

    // If ticket_id provided and no explicit documents, fetch from ticket_archivos
    if (docsToSend.length === 0 && ticket_id) {
      const { data: files } = await supabase
        .from("ticket_archivos")
        .select("nombre, url")
        .eq("ticket_id", ticket_id)
        .order("fecha_subida", { ascending: false })
        .limit(10);

      if (files) {
        for (const f of files) {
          docsToSend.push({ fileName: f.nombre || "documento", filePath: f.url || "" });
        }
      }
    }

    for (const doc of docsToSend) {
      try {
        let url = doc.filePath;
        if (!url.startsWith("http")) {
          const signed = await getSignedUrl(supabase, url);
          if (!signed) {
            failedDocuments.push(doc.fileName);
            continue;
          }
          url = signed;
        }

        const docRes = await fetch("https://api.wazzup24.com/v3/message", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.api_key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            channelId: config.channel_id_uuid,
            chatType: "whatsapp",
            chatId,
            contentUri: url,
            fileName: doc.fileName,
          }),
        });

        if (docRes.ok) {
          documentsSent++;
        } else {
          failedDocuments.push(doc.fileName);
        }
      } catch {
        failedDocuments.push(doc.fileName);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message_sent: true,
        documents_sent: documentsSent,
        documents_failed: failedDocuments.length,
        failed_documents: failedDocuments,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error interno";
    console.error("enviar-whatsapp error:", error);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
