import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface GenerateCopyRequest {
  diseno_id: string;
}

interface AICopyResult {
  apertura: string;
  desarrollo: string;
  cta: string;
  firma: string;
  url_web: string;
  hashtags: string[];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    if (!openaiKey) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { diseno_id }: GenerateCopyRequest = await req.json();

    if (!diseno_id) {
      return new Response(
        JSON.stringify({ error: "diseno_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the design with its template data
    const { data: diseno } = await supabase
      .from("publicidad_disenos")
      .select(`
        id, usuario_id, texto_personalizado, metadata,
        publicidad_plantillas(titulo, categoria, ramo, tipo)
      `)
      .eq("id", diseno_id)
      .eq("usuario_id", user.id)
      .maybeSingle();

    if (!diseno) {
      return new Response(
        JSON.stringify({ error: "Diseno not found or not owned by user" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch user's brand data (Mi Marca)
    const { data: usuario } = await supabase
      .from("usuarios")
      .select("id, nombre_completo, nombre_publico, mi_logotipo_url, celular_laboral, email_laboral, web_slug, oficina_id")
      .eq("id", user.id)
      .maybeSingle();

    // Fetch user's web page for brand colors and custom text
    const { data: webPage } = await supabase
      .from("user_web_pages")
      .select("primary_color, secondary_color, custom_text, is_published")
      .eq("usuario_id", user.id)
      .maybeSingle();

    // Fetch office name for context
    let oficinaNombre = "";
    if (usuario?.oficina_id) {
      const { data: oficina } = await supabase
        .from("oficinas")
        .select("nombre")
        .eq("id", usuario.oficina_id)
        .maybeSingle();
      oficinaNombre = oficina?.nombre || "";
    }

    // Build context for the AI
    const plantilla = diseno.publicidad_plantillas as any;
    const categoria = plantilla?.categoria || "General";
    const ramo = plantilla?.ramo || "Seguros";
    const nombreAgente = usuario?.nombre_publico || usuario?.nombre_completo || "Agente";
    const webUrl = usuario?.web_slug
      ? `agentedeseguros.website/${usuario.web_slug}`
      : "";
    const telefono = usuario?.celular_laboral || "";

    const brandContext = {
      nombre: nombreAgente,
      oficina: oficinaNombre,
      colores: webPage ? { primario: webPage.primary_color, secundario: webPage.secondary_color } : null,
      url_web: webUrl,
      telefono,
      email: usuario?.email_laboral || "",
    };

    // Generate copy with OpenAI
    const systemPrompt = `Eres un experto redactor de marketing digital para agentes de seguros en Mexico. Tu trabajo es generar copy de alta calidad para publicaciones en redes sociales basandote en el diseno y la marca personal del agente.

REGLAS ESTRICTAS:
- Escribe en espanol de Mexico, tono profesional pero cercano
- NUNCA uses emojis
- MAXIMO 550 caracteres por seccion (compatibilidad WhatsApp)
- Se conciso, impactante y orientado a la accion
- Usa datos del agente (nombre, telefono, web) para personalizar
- Adapta el tono segun la categoria y ramo del diseno
- Los hashtags deben ser relevantes al ramo, sin # repetidos

FORMATO DE RESPUESTA (JSON estricto):
{
  "apertura": "Frase de gancho inicial que capture atencion (1-2 oraciones)",
  "desarrollo": "Cuerpo del mensaje con propuesta de valor y beneficios (2-3 oraciones)",
  "cta": "Llamada a la accion clara y directa (1 oracion)",
  "firma": "Cierre con nombre del agente y dato de contacto",
  "url_web": "URL de la pagina web del agente si existe",
  "hashtags": ["array", "de", "hashtags", "relevantes"]
}`;

    const userPrompt = `Genera copy para una publicacion de marketing con estos datos:

DISENO:
- Categoria: ${categoria}
- Ramo de seguros: ${ramo}
- Titulo de plantilla: ${plantilla?.titulo || "Sin titulo"}

MARCA DEL AGENTE:
- Nombre: ${brandContext.nombre}
- Oficina: ${brandContext.oficina || "Independiente"}
- Color de marca: ${brandContext.colores?.primario || "No definido"}
- URL Web: ${brandContext.url_web || "No tiene"}
- Telefono: ${brandContext.telefono || "No proporcionado"}
- Email: ${brandContext.email || "No proporcionado"}

INSTRUCCIONES ADICIONALES:
- El copy debe complementar visualmente el diseno de categoria "${categoria}"
- Enfocate en el ramo "${ramo}" con terminologia apropiada
- Si el ramo es GMM, habla de salud y bienestar familiar
- Si es Vida, enfocate en proteccion y legado
- Si es Autos, enfocate en tranquilidad al volante
- Si es Danos, habla de proteccion patrimonial
- Genera exactamente 5 hashtags relevantes`;

    const completionResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.8,
        max_tokens: 1000,
        response_format: { type: "json_object" },
      }),
    });

    if (!completionResponse.ok) {
      const errText = await completionResponse.text();
      throw new Error(`OpenAI error: ${errText}`);
    }

    const completionData = await completionResponse.json();
    const rawContent = completionData.choices[0]?.message?.content || "{}";
    const tokensUsed = (completionData.usage?.prompt_tokens || 0) + (completionData.usage?.completion_tokens || 0);

    let aiCopy: AICopyResult;
    try {
      aiCopy = JSON.parse(rawContent);
    } catch {
      throw new Error("Failed to parse AI response as JSON");
    }

    // Validate structure
    if (!aiCopy.apertura || !aiCopy.desarrollo || !aiCopy.cta) {
      throw new Error("AI response missing required fields");
    }

    // Ensure hashtags is an array
    if (!Array.isArray(aiCopy.hashtags)) {
      aiCopy.hashtags = [];
    }

    // Override url_web with actual user URL if available
    if (brandContext.url_web) {
      aiCopy.url_web = brandContext.url_web;
    }

    // Override firma with formatted agent name
    if (!aiCopy.firma || aiCopy.firma.length < 3) {
      aiCopy.firma = brandContext.nombre;
      if (brandContext.telefono) {
        aiCopy.firma += ` | ${brandContext.telefono}`;
      }
    }

    // Get current version
    const { data: currentDesign } = await supabase
      .from("publicidad_disenos")
      .select("ai_copy_version")
      .eq("id", diseno_id)
      .single();

    const newVersion = (currentDesign?.ai_copy_version || 0) + 1;

    // Save the generated copy
    const { error: updateError } = await supabase
      .from("publicidad_disenos")
      .update({
        ai_copy: aiCopy,
        ai_copy_generated_at: new Date().toISOString(),
        ai_copy_version: newVersion,
        ai_copy_editado_manual: false,
        ai_copy_original: aiCopy,
        ai_copy_modelo: "gpt-4o-mini",
        ai_copy_metadata: {
          tokens_usados: tokensUsed,
          brand_context: brandContext,
          categoria,
          ramo,
          generated_at: new Date().toISOString(),
        },
      })
      .eq("id", diseno_id);

    if (updateError) {
      throw new Error(`Error saving copy: ${updateError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        copy: aiCopy,
        version: newVersion,
        tokens_usados: tokensUsed,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("generate-design-copy error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Error interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
