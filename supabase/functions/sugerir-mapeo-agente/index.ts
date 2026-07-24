import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing Authorization header');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) throw new Error('OPENAI_API_KEY not configured');

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Unauthorized');

    const { usuarios, agentes } = await req.json() as {
      usuarios: { id: string; nombre: string; apellidos: string; email: string }[];
      agentes:  { id: string; nombre: string }[];
    };

    if (!usuarios?.length || !agentes?.length) {
      return new Response(JSON.stringify({ sugerencias: [] }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = `Eres un experto en reconciliación de nombres entre dos sistemas de RH de una aseguradora mexicana.

REGLAS ESTRICTAS — léelas antes de hacer cualquier sugerencia:
1. Los agentes SICAS están en formato "APELLIDO_PATERNO APELLIDO_MATERNO NOMBRE(S)" (todo mayúsculas, sin tildes).
   Ejemplo: "GARCIA SAUCEDO KAREN JEANETH" → apellido paterno: GARCIA, materno: SAUCEDO, nombre: KAREN JEANETH.
2. Los usuarios MOVI tienen campo "nombre" y campo "apellidos" separados (pueden tener tildes y mayúsculas mixtas).
   Ejemplo: nombre="Karen Jeaneth", apellidos="García Saucedo".
3. Para sugerir un match, AL MENOS DOS tokens del nombre completo del usuario MOVI deben aparecer en el nombre del agente SICAS (ignorando tildes y mayúsculas).
   - "GARCIA SAUCEDO KAREN JEANETH" ↔ "Karen Jeaneth García Saucedo" → confianza 0.97 ✓ (4 tokens coinciden)
   - "MENA GOMEZ AARON" ↔ "Aarón Mena Gómez" → confianza 0.95 ✓ (3 tokens coinciden)
   - "BELMAN VAZQUEZ DAMIAN" ↔ "Aaron Alexis Rosas Geraldo" → NO incluir, cero tokens coinciden ✗
4. Si no hay al menos 2 tokens en común, NO incluyas esa sugerencia aunque la confianza fuera alta.
5. Umbral mínimo: confianza >= 0.80. Por debajo, omite la sugerencia.
6. Un agente solo puede aparecer en UNA sugerencia (el mejor match). Si varios usuarios comparten tokens con el mismo agente, solo elige el más parecido.

Responde ÚNICAMENTE con JSON: { "sugerencias": [ { "user_id", "agente_id", "confianza", "razon" } ] }
razon: cadena breve describiendo qué tokens coincidieron (máx 60 chars).`;

    const userPrompt = `Usuarios MOVI sin mapeo (${usuarios.length}):
${usuarios.map(u => `  [${u.id}] nombre="${u.nombre}" apellidos="${u.apellidos}" email="${u.email}"`).join('\n')}

Agentes SICAS disponibles (${agentes.length}):
${agentes.map(a => `  [${a.id}] ${a.nombre}`).join('\n')}

Analiza token por token. Solo incluye matches donde al menos 2 tokens coincidan (sin tildes, sin importar mayúsculas).`;

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0,
      }),
    });

    if (!openaiResponse.ok) {
      const err = await openaiResponse.text();
      throw new Error(`OpenAI error ${openaiResponse.status}: ${err}`);
    }

    const openaiData = await openaiResponse.json();
    const content = JSON.parse(openaiData.choices[0].message.content);

    return new Response(JSON.stringify({ sugerencias: content.sugerencias ?? [] }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('sugerir-mapeo-agente:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
