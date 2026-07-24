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

    const systemPrompt = `Eres un asistente experto en reconciliar nombres de personas entre dos sistemas de una aseguradora mexicana.
Los agentes SICAS están en formato "APELLIDO_PATERNO APELLIDO_MATERNO NOMBRE(S)" (todo mayúsculas).
Los usuarios MOVI tienen nombre y apellidos por separado (pueden tener tildes y mayúsculas mixtas).
Tu tarea: para cada usuario MOVI sin mapeo, encuentra al agente SICAS más probable.
Responde ÚNICAMENTE con un JSON con el campo "sugerencias" (array). Cada sugerencia:
  - user_id: string
  - agente_id: string
  - confianza: número entre 0 y 1
  - razon: cadena breve (máx 60 chars)
Incluye SOLO sugerencias con confianza >= 0.65. Si no hay match claro, no incluyas al usuario.`;

    const userPrompt = `Usuarios MOVI sin mapeo (${usuarios.length}):
${usuarios.map(u => `  [${u.id}] ${u.nombre} ${u.apellidos} <${u.email}>`).join('\n')}

Agentes SICAS disponibles (${agentes.length}):
${agentes.map(a => `  [${a.id}] ${a.nombre}`).join('\n')}`;

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
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
