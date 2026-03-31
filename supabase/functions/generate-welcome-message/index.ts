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
    console.log('=== GENERATE WELCOME MESSAGE START ===');
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing Authorization header');
      throw new Error('Missing Authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    console.log('Environment check:');
    console.log('- SUPABASE_URL:', supabaseUrl ? 'SET' : 'MISSING');
    console.log('- SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceRoleKey ? 'SET' : 'MISSING');
    console.log('- OPENAI_API_KEY:', openaiApiKey ? 'SET (length: ' + openaiApiKey.length + ')' : 'MISSING');

    if (!openaiApiKey) {
      console.error('OPENAI_API_KEY not configured in environment variables');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'OPENAI_API_KEY not configured. Please set the environment variable in Supabase Dashboard.',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('Unauthorized:', userError?.message);
      throw new Error('Unauthorized');
    }

    console.log('User authenticated:', user.id);

    const { context } = await req.json() as WelcomeMessageRequest;

    console.log('Context received:');
    console.log('- Keys:', Object.keys(context));
    console.log('- Nombre:', context.nombre);
    console.log('- Rol:', context.rol);

    // Sistema con instrucciones específicas
    const systemPrompt = `Eres un colega amigable que saluda al usuario de MOVI Digital al iniciar su día de trabajo. Tu mensaje aparecerá en el dashboard como un saludo personal y cercano.

OBJETIVO:
Crear un mensaje cálido y humano que haga sentir al usuario bienvenido, reconocido y motivado, como si un compañero de confianza le estuviera hablando.

REGLAS ESTRICTAS:
1. SIEMPRE empieza con "Hola [nombre]" usando el primer nombre del usuario
2. Máximo 2-3 renglones (35-65 palabras total)
3. Tono conversacional y cercano, como hablarías con un colega
4. Usa lenguaje natural y cálido, evita sonar robótico o formal en exceso
5. NO uses emojis
6. NO uses signos de exclamación excesivos (máximo uno)
7. NO hagas preguntas directas al usuario
8. NUNCA inventes datos que no estén en el contexto
9. Habla en segunda persona (tienes, llevas, puedes)
10. Si mencionas números, hazlo de forma natural y conversacional

DATOS DISPONIBLES EN EL CONTEXTO:
El usuario puede tener información sobre:
- Producción y comisiones (mes actual y anterior)
- Tareas y cotizaciones del CRM
- Gamificación: nivel, XP, Jiro Coins, posición en ranking, racha de días activos
- Seguros Education: cursos en progreso, completados, horas de capacitación, sesiones live próximas, cursos nuevos
- Comunicados: comunicados sin leer, último comunicado publicado
- Trámites: trámites pendientes de atención, documentos por revisar
- Reservas de espacios próximas
- Eventos y capacitaciones próximas

PRIORIDAD DE INFORMACIÓN (de mayor a menor):
1. Comunicados sin leer o importantes
2. Cursos nuevos o sesiones live próximas
3. Gamificación (nivel reciente, logros, posición en ranking)
4. Tareas vencidas o trámites urgentes
5. Producción y comisiones destacables
6. Progreso en capacitación

TIPOS DE MENSAJES (elige UNO según el contexto):
- Recordatorio de comunicados o cursos importantes
- Reconocimiento de progreso en gamificación o capacitación
- Felicitación por logros recientes (nivel nuevo, curso completado)
- Recordatorio amable de pendientes importantes
- Motivación basada en datos reales
- Resumen útil del estado actual
- Observación positiva sobre tendencias

EJEMPLOS DEL TONO DESEADO:
"Hola María, llevas un mes sólido con $125,000 en producción. Revisar esas 3 cotizaciones pendientes podría darte un cierre fuerte."
"Hola Carlos, subiste al nivel 8 y estás en racha de 12 días. Tienes 2 cursos nuevos disponibles que podrían interesarte."
"Hola Laura, hay 3 comunicados sin leer y una sesión live mañana sobre GMM. Vale la pena revisarlos antes de empezar el día."
"Hola Roberto, completaste 2 cursos este mes y llevas 8 horas de capacitación. Ese compromiso con tu desarrollo profesional se nota."
"Hola Ana, estás en el puesto 5 del ranking nacional. Tienes 2 trámites pendientes que al cerrarlos podrían darte más puntos."

INSTRUCCIONES ESPECIALES:
- Si hay comunicados sin leer, mencionarlos tiene prioridad
- Si hay cursos nuevos o sesiones live próximas, motivar al usuario a tomarlos
- Si subió de nivel o tiene logros recientes en gamificación, reconocerlo
- Si completó cursos recientemente, felicitarlo
- Combina diferentes tipos de información cuando tenga sentido (ej: gamificación + educación)

Solo usa información del contexto. Si no hay datos interesantes, haz un saludo motivador breve sin inventar números.`;

    // Agregar semilla aleatoria para variación
    const seed = Math.random().toString(36).substring(7);
    const timestamp = new Date().toISOString();
    const userPrompt = `Genera un mensaje de bienvenida personalizado para este usuario.

Contexto del usuario:
${JSON.stringify(context, null, 2)}

Variación temporal: ${seed} - ${timestamp}

Genera SOLO el mensaje, sin explicaciones adicionales.`;

    const messages: OpenAIMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    console.log('Calling OpenAI API...');
    const openaiStartTime = Date.now();

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: messages,
        temperature: 0.9,
        max_tokens: 150,
      }),
    });

    const openaiDuration = Date.now() - openaiStartTime;
    console.log(`OpenAI Response: ${openaiResponse.status} (${openaiDuration}ms)`);

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.text();
      console.error('OpenAI API error:', errorData);
      return new Response(
        JSON.stringify({
          success: false,
          error: `OpenAI API error: ${openaiResponse.status}`,
          details: errorData.substring(0, 200),
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const openaiData = await openaiResponse.json();

    if (!openaiData.choices || openaiData.choices.length === 0) {
      console.error('OpenAI returned no choices');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'OpenAI returned no choices',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const welcomeMessage = openaiData.choices[0].message.content.trim();

    console.log('Welcome message generated successfully');
    console.log('Message length:', welcomeMessage.length);
    console.log('Message preview:', welcomeMessage.substring(0, 100));
    console.log('=== GENERATE WELCOME MESSAGE END ===');

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
    console.error('=== ERROR ===');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});