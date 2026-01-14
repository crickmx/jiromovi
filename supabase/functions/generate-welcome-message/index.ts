import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface WelcomeMessageRequest {
  context: Record<string, any>;
}

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing Authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { context } = await req.json() as WelcomeMessageRequest;

    console.log('=== GENERATE WELCOME MESSAGE ===');
    console.log('User ID:', user.id);
    console.log('Context keys:', Object.keys(context));

    // Sistema con instrucciones específicas
    const systemPrompt = `Eres un asistente inteligente integrado en la plataforma MOVI Digital, una plataforma tecnológica avanzada para agentes, empleados y gerentes del sector asegurador en México.
Tu objetivo es generar un mensaje breve, útil y personalizado que se mostrará en la tarjeta de bienvenida del dashboard principal del usuario al iniciar sesión.

REGLAS ESTRICTAS:
1. Genera un solo mensaje de máximo 2-3 renglones (40-70 palabras).
2. Sé amigable, cercano y profesional.
3. Aporta valor real (resumen, insight o sugerencia).
4. Tono positivo, claro y orientado a acción.
5. NO uses emojis.
6. NO uses signos de exclamación excesivos.
7. NO hagas preguntas directas.
8. NO uses frases genéricas tipo "Esperamos que tengas un excelente día".
9. NUNCA inventes métricas o datos que no estén en el contexto.
10. Habla en segunda persona (tienes, vas, puedes).

TIPOS DE ENFOQUE (elige UNO):
- Resumen rápido de estado
- Insight con base en datos
- Sugerencia accionable
- Mensaje de enfoque/motivación basado en datos reales
- Recordatorio inteligente de actividad próxima

Solo usa información que venga explícitamente en el contexto. Si un dato no está presente, no lo menciones.`;

    // Agregar semilla aleatoria para variación
    const seed = Math.random().toString(36).substring(7);
    const userPrompt = `Genera un mensaje de bienvenida personalizado para este usuario.

Contexto del usuario:
${JSON.stringify(context, null, 2)}

Variación: ${seed}

Genera SOLO el mensaje, sin explicaciones adicionales.`;

    const messages: OpenAIMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    console.log('Calling OpenAI API...');
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: messages,
        temperature: 0.8, // Mayor temperatura para más variación
        max_tokens: 150,
      }),
    });

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.text();
      console.error('OpenAI API error:', errorData);
      throw new Error(`OpenAI API error: ${openaiResponse.status}`);
    }

    const openaiData = await openaiResponse.json();
    const welcomeMessage = openaiData.choices[0].message.content.trim();

    console.log('Welcome message generated successfully');
    console.log('Message length:', welcomeMessage.length);

    return new Response(
      JSON.stringify({
        success: true,
        message: welcomeMessage,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error: any) {
    console.error('Error generating welcome message:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
