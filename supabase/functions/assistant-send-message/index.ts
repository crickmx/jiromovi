import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface AssistantRequest {
  conversacion_id?: string;
  mensaje: string;
  modulo?: string;
  ruta?: string;
  parametros?: Record<string, any>;
  file_paths?: string[];
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

    const {
      conversacion_id,
      mensaje,
      modulo,
      ruta,
      parametros = {},
      file_paths = []
    } = await req.json() as AssistantRequest;

    console.log('=== ASSISTANT MESSAGE ===');
    console.log('User ID:', user.id);
    console.log('Module:', modulo);
    console.log('Route:', ruta);
    console.log('Files:', file_paths?.length || 0);

    // Get user context
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('nombre_completo, email_laboral, rol, oficina_id')
      .eq('id', user.id)
      .maybeSingle();

    // Get or create conversation
    let conversacionId = conversacion_id;

    if (!conversacionId) {
      console.log('Creating new assistant conversation...');
      const { data: newConversacion, error: conversacionError } = await supabase
        .from('conversaciones_chatgpt')
        .insert({
          usuario_id: user.id,
          titulo: mensaje.substring(0, 50) + (mensaje.length > 50 ? '...' : ''),
          es_asistente: true,
          modulo_origen: modulo || 'general',
        })
        .select()
        .single();

      if (conversacionError) {
        console.error('Error creating conversation:', conversacionError);
        throw conversacionError;
      }

      conversacionId = newConversacion.id;
      console.log('New conversation created:', conversacionId);
    }

    // Save user message
    console.log('Saving user message...');
    const { error: userMessageError } = await supabase
      .from('mensajes_chatgpt')
      .insert({
        conversacion_id: conversacionId,
        rol: 'user',
        contenido: mensaje,
        tokens_usados: 0,
      });

    if (userMessageError) {
      console.error('Error saving user message:', userMessageError);
      throw userMessageError;
    }

    // Build context-aware system prompt
    let systemPrompt = `Eres un asistente virtual inteligente de JIRO, una plataforma integral para agentes de seguros en México.

Tu objetivo es ayudar a los usuarios a navegar y utilizar la plataforma de manera eficiente, responder preguntas sobre seguros, y proporcionar información relevante basada en el contexto actual.

Usuario actual:
- Nombre: ${usuario?.nombre_completo || 'Usuario'}
- Email: ${usuario?.email_laboral || 'No disponible'}
- Rol: ${usuario?.rol || 'agente'}

Contexto actual:`;

    if (modulo) {
      systemPrompt += `\n- Módulo: ${modulo}`;
    }

    if (ruta) {
      systemPrompt += `\n- Ruta: ${ruta}`;
    }

    if (Object.keys(parametros).length > 0) {
      systemPrompt += `\n- Parámetros: ${JSON.stringify(parametros)}`;
    }

    systemPrompt += `\n\nInstrucciones:
1. Proporciona respuestas claras, concisas y útiles
2. Si el usuario pregunta cómo hacer algo en la plataforma, proporciona pasos específicos
3. Si preguntan sobre seguros (términos, coberturas, etc.), da explicaciones profesionales y técnicas
4. Si necesitas más información, pregunta de manera específica
5. Mantén un tono profesional pero amigable
6. Si no estás seguro de algo, admítelo honestamente
7. Puedes usar emojis ocasionalmente para hacer la conversación más amigable (📊, ✅, 📝, etc.)

Funcionalidades principales de JIRO:
- Dashboard con KPIs y estadísticas
- CRM para gestión de contactos y seguimiento
- Comisiones: cálculo y gestión automática
- Producción: análisis de ventas por vendedor
- GMM Cotizador: herramienta para cotizar seguros de gastos médicos
- Cédula A: curso completo para certificación de agentes
- Centro Digital: gestión documental
- Comunicados: noticias y actualizaciones
- Publicidad: gestión de campañas
- Chat: comunicación interna
- Y muchos más módulos especializados

Responde de manera útil y orientada a la acción.`;

    // Load conversation history
    console.log('Loading conversation history...');
    const { data: historialMensajes, error: historialError } = await supabase
      .from('mensajes_chatgpt')
      .select('rol, contenido')
      .eq('conversacion_id', conversacionId)
      .order('created_at', { ascending: true });

    if (historialError) {
      console.error('Error loading history:', historialError);
      throw historialError;
    }

    // Build messages array with system prompt
    const messages: OpenAIMessage[] = [
      { role: 'system', content: systemPrompt }
    ];

    // Add conversation history (skip any old system messages)
    historialMensajes
      .filter(m => m.rol !== 'system')
      .forEach(m => {
        messages.push({
          role: m.rol as 'user' | 'assistant',
          content: m.contenido,
        });
      });

    console.log('Calling OpenAI API...');
    console.log('Messages count:', messages.length);

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: messages,
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.text();
      console.error('OpenAI API error:', errorData);
      throw new Error(`OpenAI API error: ${openaiResponse.status} - ${errorData}`);
    }

    const openaiData = await openaiResponse.json();
    const assistantMessage = openaiData.choices[0].message.content;
    const tokensUsed = openaiData.usage?.total_tokens || 0;

    console.log('Saving assistant message...');
    console.log('Tokens used:', tokensUsed);

    const { error: assistantMessageError } = await supabase
      .from('mensajes_chatgpt')
      .insert({
        conversacion_id: conversacionId,
        rol: 'assistant',
        contenido: assistantMessage,
        tokens_usados: tokensUsed,
      });

    if (assistantMessageError) {
      console.error('Error saving assistant message:', assistantMessageError);
      throw assistantMessageError;
    }

    // Update conversation timestamp
    await supabase
      .from('conversaciones_chatgpt')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversacionId);

    console.log('Assistant response sent successfully');

    return new Response(
      JSON.stringify({
        success: true,
        conversacion_id: conversacionId,
        mensaje_id: null,
        respuesta: assistantMessage,
        mensaje: assistantMessage,
        tokens_usados: tokensUsed,
        respuesta_estructurada: null,
        modo_usado: 'general',
        router_confidence: null,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error: any) {
    console.error('Error in assistant-send-message:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        details: error.stack
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});