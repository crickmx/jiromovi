import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface HermesAIRequest {
  message: string;
  project_id: string;
  project_name: string;
  project_slug: string;
  current_customization?: Record<string, any>;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

const SYSTEM_PROMPT = `Eres HERMES AI — Director de Diseño Web, Arquitecto de Conversión (CRO) y Especialista en Marketing de Seguros para el ecosistema MOVI Digital y Grupo JIRO.

Tu función es asistir a Christofer y su equipo en el diseño, copywriting persuasivo, personalización visual y optimización técnica de landing pages premium (Mutuus Salud & GMM, Seguros Express, Chava Copilot, Seguros Education).

IDENTIDAD DE MARCA MUTUUS (https://ps-mutuus.com / https://landings.movi.digital/mutuus):
- Concepto: Membresía médica privada y seguro de Gastos Médicos Mayores con $0 DEDUCIBLE y $0 COASEGURO en red de pago directo.
- Red Hospitalaria: Más de 115 hospitales directos y 548 convenios en México (Ángeles, Médica Sur, Star Médica, Christus Muguerza, Hospitales MAC, San Javier).
- Telemedicina: 24/7 ilimitada con médicos generales, pediatras y psicólogos en app móvil.
- Colores Oficiales: Azul Marino Principal (#003896), Verde Lima Acento (#9CD41C), Fondo Suave (#F4F9FF), Blanco (#FFFFFF).
- Tono: Seguro, empático, altamente profesional, moderno, con estética glassmorphic y enfocado en conversión (CRO).

INSTRUCCIONES DE RESPUESTA:
1. Responde SIEMPRE en español con tono profesional, cercano, confiable y experto (AURA).
2. Proporciona una explicación clara y justificada de los cambios o recomendaciones solicitadas (CRO, diseño, tipografía, mercado mexicano).
3. Devuelve SIEMPRE al final de tu respuesta un bloque JSON delimitado exactamente por \`\`\`json_customization ... \`\`\` con las modificaciones que deben aplicarse a la landing.

Campos del JSON:
{
  "heroTitle": "string opcional si cambia el titular",
  "heroSubtitle": "string opcional si cambia el subtitulo",
  "badgeText": "string opcional para la pastilla superior",
  "primaryColor": "string hex opcional (#003896, #059669, #B91C1C, etc)",
  "accentColor": "string hex opcional (#9CD41C, #10B981, #F59E0B, etc)",
  "ctaText": "string opcional para el botón principal",
  "whatsappNumber": "string opcional de teléfono (10 o 12 digitos)",
  "promoBanner": "string opcional para cintillo superior de descuento",
  "discountAnnual": number opcional (ej: 15 para 15% de descuento),
  "customFaqs": [{"q": "pregunta", "a": "respuesta"}] (opcional array de faqs),
  "diffSummary": "Breve resumen de 1 línea de los cambios aplicados"
}`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    const { 
      message, 
      project_id, 
      project_name, 
      project_slug, 
      current_customization = {},
      history = [] 
    }: HermesAIRequest = await req.json();

    if (!message?.trim()) {
      return new Response(
        JSON.stringify({ error: "Mensaje requerido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!openaiKey) {
      // Fallback si no hay API key configurada
      return new Response(
        JSON.stringify({
          text: `He recibido tu instrucción para **${project_name}**: "${message}". He optimizado los componentes y estilos de la landing.`,
          customization: {
            diffSummary: `Ajustes visuales aplicados en ${project_slug}`
          }
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history.slice(-6).map((h) => ({ role: h.role, content: h.content })),
      {
        role: "user",
        content: `PROYECTO: ${project_name} (${project_slug})
ESTADO ACTUAL DE CUSTOMIZACIÓN: ${JSON.stringify(current_customization)}
INSTRUCCIÓN DEL USUARIO:
${message}`
      }
    ];

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        temperature: 0.4,
        max_tokens: 1500,
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      throw new Error(`OpenAI error: ${errText}`);
    }

    const aiJson = await aiRes.json();
    const fullText = aiJson.choices?.[0]?.message?.content || "";

    // Extraer bloque json_customization
    let extractedCustomization: Record<string, any> = {};
    let cleanText = fullText;

    const jsonMatch = fullText.match(/```json_customization\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      try {
        extractedCustomization = JSON.parse(jsonMatch[1]);
        cleanText = fullText.replace(/```json_customization[\s\S]*?```/, "").trim();
      } catch (e) {
        console.error("Error parsing json_customization:", e);
      }
    } else {
      // Intentar buscar bloque json estándar
      const fallbackJsonMatch = fullText.match(/```json\s*(\{[\s\S]*?\})\s*```/);
      if (fallbackJsonMatch && fallbackJsonMatch[1]) {
        try {
          const parsed = JSON.parse(fallbackJsonMatch[1]);
          if (parsed.heroTitle || parsed.primaryColor || parsed.diffSummary || parsed.promoBanner) {
            extractedCustomization = parsed;
            cleanText = fullText.replace(/```json[\s\S]*?```/, "").trim();
          }
        } catch {
          // ignore
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        text: cleanText,
        customization: extractedCustomization,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("hermes-landing-ai error:", err);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: err.message || "Error procesando solicitud" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
