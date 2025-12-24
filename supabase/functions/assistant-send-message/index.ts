import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { conversacion_id, mensaje, modulo, ruta, parametros } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    const intentCode = classifyIntent(mensaje, modulo);

    const promptTemplate = getPromptForIntent(intentCode);

    let respuestaTexto = '';
    let respuestaEstructurada = null;

    if (openaiApiKey) {
      const systemPrompt = `Eres Mi Asistente de MOVI Digital, plataforma para agentes de seguros. Personalidad: profesional pero cercano, claro y orientado a acción. REGLAS: 1) Nunca inventes datos. 2) Si faltan datos, dilo claramente. 3) Responde en JSON estructurado cuando sea posible. 4) Español mexicano, tuteo. 5) Incluye al menos 1 acción concreta.`;

      const userPrompt = `${promptTemplate}\n\nContexto: Módulo ${modulo}, Ruta ${ruta}\n\nPregunta del usuario: ${mensaje}`;

      const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 1000,
        }),
      });

      if (openaiResponse.ok) {
        const data = await openaiResponse.json();
        respuestaTexto = data.choices[0]?.message?.content || 'No pude generar una respuesta.';

        try {
          const jsonMatch = respuestaTexto.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            respuestaEstructurada = JSON.parse(jsonMatch[0]);
          }
        } catch (e) {
          console.log('Response is not structured JSON');
        }
      }
    } else {
      respuestaTexto = getFallbackResponse(intentCode, modulo);
    }

    const { data: mensajeData, error: mensajeError } = await supabase
      .from('mensajes_chatgpt')
      .insert({
        conversacion_id,
        rol: 'assistant',
        contenido: respuestaTexto,
        respuesta_estructurada_json: respuestaEstructurada,
        tiene_acciones: respuestaEstructurada ? true : false,
      })
      .select()
      .single();

    if (mensajeError) throw mensajeError;

    await supabase
      .from('conversaciones_chatgpt')
      .update({
        updated_at: new Date().toISOString(),
        intent_detectado: intentCode,
      })
      .eq('id', conversacion_id);

    return new Response(
      JSON.stringify({
        conversacion_id,
        mensaje_id: mensajeData.id,
        respuesta: respuestaTexto,
        respuesta_estructurada: respuestaEstructurada,
        intent_detectado: intentCode,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function classifyIntent(mensaje: string, modulo: string): string {
  const mensajeNorm = mensaje.toLowerCase();

  if (mensajeNorm.includes('comision') || mensajeNorm.includes('explica')) {
    return 'commission_explain';
  }
  if (mensajeNorm.includes('produccion') || mensajeNorm.includes('desempeño')) {
    return 'performance_summary';
  }
  if (mensajeNorm.includes('prioridad') || mensajeNorm.includes('hoy')) {
    return 'daily_priorities';
  }
  if (mensajeNorm.includes('contacto') || mensajeNorm.includes('cliente')) {
    return 'client_outreach_plan';
  }
  if (mensajeNorm.includes('renovar') || mensajeNorm.includes('renovacion')) {
    return 'renewals_forecast';
  }
  if (mensajeNorm.includes('tramite') || mensajeNorm.includes('estado')) {
    return 'tramite_status_helper';
  }
  if (mensajeNorm.includes('navegar') || mensajeNorm.includes('como')) {
    return 'navigation_help';
  }

  if (modulo === 'comisiones') return 'commission_explain';
  if (modulo === 'produccion') return 'performance_summary';
  if (modulo === 'crm') return 'client_outreach_plan';
  if (modulo === 'tramites') return 'tramite_status_helper';
  if (modulo === 'dashboard') return 'dashboard_summary';

  return 'navigation_help';
}

function getPromptForIntent(intentCode: string): string {
  const prompts: Record<string, string> = {
    commission_explain: 'Explica la comisión en detalle con tabla de conceptos en formato JSON.',
    performance_summary: 'Analiza el desempeño del agente con tendencias en formato JSON.',
    daily_priorities: 'Crea una lista priorizada de tareas en formato JSON.',
    client_outreach_plan: 'Identifica clientes prioritarios para contactar en formato JSON.',
    renewals_forecast: 'Lista pólizas próximas a renovar en formato JSON.',
    tramite_status_helper: 'Explica el estado del trámite y siguientes pasos en formato JSON.',
    navigation_help: 'Muestra opciones de navegación organizadas en formato JSON.',
    dashboard_summary: 'Genera un resumen ejecutivo con KPIs en formato JSON.',
  };

  return prompts[intentCode] || 'Responde la pregunta del usuario de manera útil en formato JSON.';
}

function getFallbackResponse(intentCode: string, modulo: string): string {
  const responses: Record<string, string> = {
    commission_explain: 'Para ver el detalle de tus comisiones, ve a la sección Mis Comisiones.',
    performance_summary: 'Para ver tu desempeño y producción, ve a Mi Producción.',
    daily_priorities: 'Para ver tus tareas pendientes, ve a Mi CRM > Tareas.',
    client_outreach_plan: 'Para gestionar tus contactos, ve a Mi CRM > Contactos.',
    renewals_forecast: 'Para ver renovaciones próximas, revisa las pólizas en Mi CRM.',
    tramite_status_helper: 'Para ver el estado de tus trámites, ve a la sección Trámites.',
    navigation_help: 'Puedes navegar por las diferentes secciones usando el menú lateral.',
    dashboard_summary: 'Para ver un resumen general, ve al Dashboard.',
  };

  return responses[intentCode] || `Estás en el módulo ${modulo}. ¿En qué puedo ayudarte?`;
}
