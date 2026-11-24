import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface AnalyzeRequest {
  subject: string;
  from: string;
  fromEmail: string;
  to: string[];
  cc: string[];
  date: string;
  bodyText: string | null;
  bodyHtml: string | null;
  attachments: { filename: string; contentType: string; size: number }[];
}

interface AIAnalysis {
  summary: string;
  request_type: string;
  suggested_procedure_type: string;
  priority: "baja" | "media" | "alta" | "urgente";
  important_data: {
    client_name: string;
    insured_name: string;
    policy_number: string;
    insurance_company: string;
    line_of_business: string;
    effective_date: string;
    expiration_date: string;
    amount: string;
    phone: string;
    email: string;
    deadline: string;
    notes: string;
  };
  suggested_next_action: string;
  attachments_summary: {
    filename: string;
    possible_document_type: string;
    relevance: "alta" | "media" | "baja";
  }[];
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");

    const { data: senderUser } = await supabase
      .from("usuarios")
      .select("id, rol, oficina_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!senderUser || !["Administrador", "Gerente", "Empleado", "Ejecutivo"].includes(senderUser.rol)) {
      throw new Error("No tienes permiso para analizar correos");
    }

    const email = await req.json() as AnalyzeRequest;

    if (!email.subject && !email.bodyText && !email.bodyHtml) {
      throw new Error("El correo no tiene contenido para analizar");
    }

    // Detect agent by email address
    let detectedAgent: { id: string; nombre_completo: string; oficina_id: string | null; method: string } | null = null;

    if (email.fromEmail) {
      const normalizedEmail = email.fromEmail.toLowerCase().trim();
      const { data: agents } = await supabase
        .from("usuarios")
        .select("id, nombre_completo, oficina_id, email_laboral, email_personal")
        .or(`email_laboral.ilike.${normalizedEmail},email_personal.ilike.${normalizedEmail}`)
        .eq("activo", true)
        .limit(5);

      if (agents && agents.length === 1) {
        detectedAgent = {
          id: agents[0].id,
          nombre_completo: agents[0].nombre_completo || "Sin nombre",
          oficina_id: agents[0].oficina_id,
          method: "automatic",
        };
      } else if (agents && agents.length > 1) {
        detectedAgent = {
          id: agents[0].id,
          nombre_completo: agents[0].nombre_completo || "Sin nombre",
          oficina_id: agents[0].oficina_id,
          method: "suggested",
        };
      }
    }

    // Check for existing tramite from this email
    let existingTramite: { id: string; folio: string } | null = null;
    if (email.fromEmail) {
      const { data: existing } = await supabase
        .from("tickets")
        .select("id, folio")
        .eq("canal_origen", "email")
        .eq("source_email_from_email", email.fromEmail.toLowerCase())
        .eq("source_email_subject", email.subject || "")
        .limit(1)
        .maybeSingle();

      if (existing) existingTramite = existing;
    }

    // AI analysis
    let analysis: AIAnalysis | null = null;

    if (openaiKey) {
      const bodyContent = email.bodyText || (email.bodyHtml ? stripHtml(email.bodyHtml) : "");
      const truncatedBody = bodyContent.substring(0, 3000);

      const attachmentsList = email.attachments.map(a => `- ${a.filename} (${a.contentType}, ${(a.size / 1024).toFixed(0)} KB)`).join("\n");

      const prompt = `Eres un asistente experto en seguros en México. Analiza este correo electrónico y extrae información relevante para crear un trámite operativo.

CORREO:
De: ${email.from} <${email.fromEmail}>
Para: ${email.to.join(", ")}
${email.cc.length > 0 ? `CC: ${email.cc.join(", ")}` : ""}
Fecha: ${email.date}
Asunto: ${email.subject || "(Sin asunto)"}

CUERPO:
${truncatedBody || "(Sin contenido)"}

ADJUNTOS:
${attachmentsList || "(Sin adjuntos)"}

Responde SOLO con un JSON válido con esta estructura exacta:
{
  "summary": "Resumen breve operativo del correo (max 150 palabras)",
  "request_type": "Tipo de solicitud identificada",
  "suggested_procedure_type": "cotizacion_emision|renovaciones|cobranza|registro_poliza|otros_comercial",
  "priority": "baja|media|alta|urgente",
  "important_data": {
    "client_name": "",
    "insured_name": "",
    "policy_number": "",
    "insurance_company": "",
    "line_of_business": "",
    "effective_date": "",
    "expiration_date": "",
    "amount": "",
    "phone": "",
    "email": "",
    "deadline": "",
    "notes": ""
  },
  "suggested_next_action": "Acción sugerida",
  "attachments_summary": [{"filename": "", "possible_document_type": "", "relevance": "alta|media|baja"}]
}

Reglas:
- Si no encuentras un dato, deja el campo como string vacío "".
- No inventes datos que no están en el correo.
- suggested_procedure_type debe ser uno de los valores listados.
- Para priority: urgente si hay fecha límite cercana, alta si requiere acción inmediata, media por defecto, baja si es informativo.
- Sé conciso y operativo en el resumen.`;

      try {
        const openaiResp = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${openaiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.3,
            max_tokens: 1200,
            response_format: { type: "json_object" },
          }),
        });

        if (openaiResp.ok) {
          const aiData = await openaiResp.json();
          const content = aiData.choices?.[0]?.message?.content;
          if (content) {
            analysis = JSON.parse(content) as AIAnalysis;
          }
        }
      } catch {
        // AI analysis is optional - continue without it
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        analysis,
        detectedAgent,
        existingTramite,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : "Error desconocido";
    return new Response(
      JSON.stringify({ success: false, error: errMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
