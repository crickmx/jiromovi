import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface ChatGPTRequest {
  conversacion_id?: string;
  mensaje: string;
  model?: string;
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

    const { conversacion_id, mensaje, model = 'gpt-4o-mini' } = await req.json() as ChatGPTRequest;

    console.log('=== CHATGPT QUERY ===');
    console.log('User ID:', user.id);
    console.log('Conversation ID:', conversacion_id);
    console.log('Model:', model);

    let conversacionId = conversacion_id;

    if (!conversacionId) {
      console.log('Creating new conversation...');
      const { data: newConversacion, error: conversacionError } = await supabase
        .from('conversaciones_chatgpt')
        .insert({
          usuario_id: user.id,
          titulo: mensaje.substring(0, 50) + (mensaje.length > 50 ? '...' : ''),
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

    const messages: OpenAIMessage[] = historialMensajes.map(m => ({
      role: m.rol as 'system' | 'user' | 'assistant',
      content: m.contenido,
    }));

    console.log('Calling OpenAI API...');
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: 0.7,
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

    console.log('Response sent successfully');

    return new Response(
      JSON.stringify({
        success: true,
        conversacion_id: conversacionId,
        mensaje: assistantMessage,
        tokens_usados: tokensUsed,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error: any) {
    console.error('Error in chatgpt-query:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});