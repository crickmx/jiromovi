import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json().catch(() => ({})) as {
      bandeja_id?: string;
      limit?: number;
      dry_run?: boolean;
    };

    const limit = Math.min(body.limit || 10, 30);
    const dryRun = body.dry_run || false;

    // Get active robots for classification context
    const { data: robots } = await supabase
      .from("ia_robots")
      .select("id, nombre, codigo, descripcion, palabras_clave, estado")
      .eq("estado", "activo");

    if (!robots || robots.length === 0) {
      return new Response(JSON.stringify({ message: "No hay robots activos para clasificar.", classified: 0 }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get pending emails from bandeja
    let emailQuery = supabase
      .from("ia_bandeja")
      .select("id, remitente, destinatario, asunto, cuerpo_texto, fecha_correo, cuenta_correo_id")
      .eq("estado_procesamiento", "pendiente")
      .order("fecha_correo", { ascending: true })
      .limit(limit);

    if (body.bandeja_id) {
      emailQuery = supabase
        .from("ia_bandeja")
        .select("id, remitente, destinatario, asunto, cuerpo_texto, fecha_correo, cuenta_correo_id")
        .eq("id", body.bandeja_id);
    }

    const { data: emails, error: emailErr } = await emailQuery;
    if (emailErr) {
      return new Response(JSON.stringify({ error: "Error al obtener emails.", detail: emailErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!emails || emails.length === 0) {
      return new Response(JSON.stringify({ message: "No hay emails pendientes de clasificar.", classified: 0 }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: { id: string; subject: string; robot_code: string | null; confidence: number }[] = [];

    for (const email of emails) {
      const classification = openaiKey
        ? await classifyWithAI(openaiKey, email, robots)
        : classifyWithKeywords(email, robots);

      if (!dryRun) {
        // Update bandeja with classification
        const nuevoEstado = classification.robotCode ? "completado" : "no_clasificado";
        await supabase
          .from("ia_bandeja")
          .update({
            estado_procesamiento: nuevoEstado,
            robot_id: classification.robotId || null,
            razon_clasificacion: classification.reason,
            coincidencia_pct: Math.round(classification.confidence * 100),
            updated_at: new Date().toISOString(),
          })
          .eq("id", email.id);

        // Log to bitacora
        await supabase
          .from("ia_bitacora")
          .insert({
            correo_id: email.id,
            robot_id: classification.robotId || null,
            accion: "clasificacion",
            detalle: {
              robot_code: classification.robotCode,
              confidence: classification.confidence,
              reason: classification.reason,
              dry_run: dryRun,
            },
            estado: classification.robotCode ? "exito" : "pendiente",
          });
      }

      results.push({
        id: email.id,
        subject: email.asunto,
        robot_code: classification.robotCode,
        confidence: classification.confidence,
      });
    }

    return new Response(JSON.stringify({
      success: true,
      classified: results.length,
      dry_run: dryRun,
      results,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("ia-classify-email error:", err);
    return new Response(JSON.stringify({ error: "Error interno del servidor.", detail: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

interface ClassificationResult {
  robotId: string | null;
  robotCode: string | null;
  confidence: number;
  reason: string;
}

async function classifyWithAI(
  apiKey: string,
  email: { asunto: string; remitente: string; cuerpo_texto: string },
  robots: { id: string; nombre: string; codigo: string; descripcion: string; palabras_clave: string[] | null }[],
): Promise<ClassificationResult> {
  const robotDescriptions = robots.map(r =>
    `- Código: "${r.codigo}" | Nombre: "${r.nombre}" | Descripción: ${r.descripcion} | Palabras clave: ${(r.palabras_clave || []).join(", ")}`
  ).join("\n");

  const prompt = `Eres un clasificador de emails para una agencia de seguros. Tu tarea es determinar cuál robot debe procesar este email.

ROBOTS DISPONIBLES:
${robotDescriptions}

EMAIL A CLASIFICAR:
- De: ${email.remitente}
- Asunto: ${email.asunto}
- Preview del cuerpo: ${email.cuerpo_texto?.substring(0, 800) || "(vacío)"}

INSTRUCCIONES:
1. Analiza el email y determina si corresponde a alguno de los robots disponibles.
2. Si no corresponde a ninguno, responde con codigo "none".
3. Responde SOLO con un JSON válido con esta estructura:
{"codigo": "codigo_del_robot", "confianza": 0.85, "razon": "breve explicación"}

La confianza debe ser un número entre 0 y 1. Solo asigna robot si la confianza es > 0.6.`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      console.error("OpenAI API error:", response.status);
      return classifyWithKeywords(email, robots);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim() || "";

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return classifyWithKeywords(email, robots);

    const parsed = JSON.parse(jsonMatch[0]);
    const code = parsed.codigo || parsed.code || "none";
    const confidence = Math.min(1, Math.max(0, parsed.confianza || parsed.confidence || 0));

    if (code === "none" || confidence < 0.6) {
      return { robotId: null, robotCode: null, confidence, reason: parsed.razon || "No clasificado" };
    }

    const matchedRobot = robots.find(r => r.codigo === code);
    if (!matchedRobot) {
      return { robotId: null, robotCode: null, confidence: 0, reason: "Robot no encontrado" };
    }

    return {
      robotId: matchedRobot.id,
      robotCode: matchedRobot.codigo,
      confidence,
      reason: parsed.razon || parsed.reason || "Clasificado por IA",
    };

  } catch (err: any) {
    console.error("AI classification error:", err.message);
    return classifyWithKeywords(email, robots);
  }
}

function classifyWithKeywords(
  email: { asunto: string; remitente: string; cuerpo_texto: string },
  robots: { id: string; nombre: string; codigo: string; palabras_clave: string[] | null }[],
): ClassificationResult {
  const searchText = `${email.asunto} ${email.remitente} ${email.cuerpo_texto || ""}`.toLowerCase();

  let bestMatch: { robot: typeof robots[0]; score: number } | null = null;

  for (const robot of robots) {
    const keywords = robot.palabras_clave || [];
    if (keywords.length === 0) continue;

    let matchCount = 0;
    for (const kw of keywords) {
      if (searchText.includes(kw.toLowerCase())) matchCount++;
    }

    if (matchCount > 0) {
      const score = matchCount / keywords.length;
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { robot, score };
      }
    }
  }

  if (bestMatch && bestMatch.score >= 0.3) {
    return {
      robotId: bestMatch.robot.id,
      robotCode: bestMatch.robot.codigo,
      confidence: Math.min(0.85, bestMatch.score + 0.2),
      reason: `Clasificado por palabras clave (${Math.round(bestMatch.score * 100)}% match)`,
    };
  }

  return { robotId: null, robotCode: null, confidence: 0, reason: "Sin coincidencia de palabras clave" };
}
