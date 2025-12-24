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
      const systemPrompt = 'Eres Mi Asistente de MOVI Digital, plataforma para agentes de seguros. Personalidad: profesional pero cercano, claro y orientado a accion. REGLAS: 1) Nunca inventes datos. 2) Si faltan datos, dilo claramente. 3) SIEMPRE responde SOLO con JSON valido, sin texto adicional, sin markdown, sin explicaciones. 4) NO uses bloques de codigo ```json, responde unicamente el JSON puro. 5) Espanol mexicano, tuteo. 6) Incluye al menos 1 accion concreta en el array actions.';

      const userPrompt = `${promptTemplate}\n\nContexto: Modulo ${modulo}, Ruta ${ruta}\n\nPregunta del usuario: ${mensaje}\n\nResponde unicamente con JSON valido, sin texto adicional.`;

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
          max_tokens: 1500,
        }),
      });

      if (openaiResponse.ok) {
        const data = await openaiResponse.json();
        respuestaTexto = data.choices[0]?.message?.content || 'No pude generar una respuesta.';

        try {
          let jsonText = respuestaTexto.trim();
          
          const markdownMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
          if (markdownMatch) {
            jsonText = markdownMatch[1].trim();
          }
          
          const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            jsonText = jsonMatch[0];
          }
          
          respuestaEstructurada = JSON.parse(jsonText);
          
          if (respuestaEstructurada && respuestaEstructurada.type) {
            respuestaTexto = getTextFromStructuredResponse(respuestaEstructurada);
          }
        } catch (e) {
          console.error('Error parsing JSON:', e);
          console.log('Raw response:', respuestaTexto);
        }
      }
    } else {
      respuestaTexto = getFallbackResponse(intentCode, modulo);
      respuestaEstructurada = getFallbackStructuredResponse(intentCode);
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
  if (mensajeNorm.includes('produccion') || mensajeNorm.includes('desempeno')) {
    return 'performance_summary';
  }
  if (mensajeNorm.includes('prioridad') || mensajeNorm.includes('hoy') || mensajeNorm.includes('primero')) {
    return 'daily_priorities';
  }
  if (mensajeNorm.includes('contacto') || mensajeNorm.includes('cliente') || mensajeNorm.includes('llamar')) {
    return 'client_outreach_plan';
  }
  if (mensajeNorm.includes('renovar') || mensajeNorm.includes('renovacion') || mensajeNorm.includes('vencer')) {
    return 'renewals_forecast';
  }
  if (mensajeNorm.includes('tramite') || mensajeNorm.includes('estado') || mensajeNorm.includes('siguiente')) {
    return 'tramite_status_helper';
  }
  if (mensajeNorm.includes('navegar') || mensajeNorm.includes('como') || mensajeNorm.includes('donde')) {
    return 'navigation_help';
  }
  if (mensajeNorm.includes('resumen') || mensajeNorm.includes('dashboard') || mensajeNorm.includes('general')) {
    return 'dashboard_summary';
  }
  if (mensajeNorm.includes('venta') || mensajeNorm.includes('oportunidad') || mensajeNorm.includes('cruzada')) {
    return 'cross_sell_opportunities';
  }
  if (mensajeNorm.includes('mensaje') || mensajeNorm.includes('whatsapp') || mensajeNorm.includes('email')) {
    return 'message_generator';
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
    commission_explain: 'Genera JSON con type:"commission_explain", table:{headers:[], rows:[]}, explanation:string, actions:[{type:"navigate", label:string, destination:string}]',
    performance_summary: 'Genera JSON con type:"performance_summary", insights:string, actions:[{type:"navigate", label:string, destination:string}]',
    daily_priorities: 'Genera JSON con type:"priority_list", items:[{title:string, description:string, priority:"alta"|"media"|"baja"}]',
    client_outreach_plan: 'Genera JSON con type:"outreach_plan", clients:[{name:string, reason:string, suggested_product:string}]',
    renewals_forecast: 'Genera JSON con type:"renewals_forecast", renewals:[{client:string, policy:string, expiry_date:string, premium:number}], actions:[]',
    tramite_status_helper: 'Genera JSON con type:"tramite_status", timeline:[{step:string, status:"completed"|"current"|"pending"}], next_step:string, actions:[]',
    navigation_help: 'Genera JSON con type:"navigation_help", categories:[{name:string, actions:[{type:"navigate", label:string, destination:string, icon:string}]}]',
    dashboard_summary: 'Genera JSON con type:"dashboard_summary", kpis:[{icon:string, value:string, label:string, trend:{value:string, direction:"up"|"down"|"neutral"}}], actions:[]',
    cross_sell_opportunities: 'Genera JSON con type:"cross_sell", opportunities:[{client:string, current_products:[], suggested_products:[], score:number, reason:string}], actions:[]',
    message_generator: 'Genera JSON con type:"message_generator", message:string, variables:{}, actions:[{type:"copy", label:"Copiar mensaje", destination:"clipboard"}]',
  };

  return prompts[intentCode] || 'Responde en formato JSON con type:"text", text:string, actions:[]';
}

function getTextFromStructuredResponse(response: any): string {
  switch (response.type) {
    case 'dashboard_summary':
      return `Aqui esta tu resumen con ${response.kpis?.length || 0} KPIs principales.`;
    case 'performance_summary':
      return response.insights || 'Analisis de desempeno generado.';
    case 'commission_explain':
      return response.explanation || 'Desglose de comision generado.';
    case 'priority_list':
      return `Tienes ${response.items?.length || 0} prioridades identificadas.`;
    case 'outreach_plan':
      return `${response.clients?.length || 0} clientes prioritarios para contactar.`;
    case 'renewals_forecast':
      return `${response.renewals?.length || 0} renovaciones proximas.`;
    case 'text':
      return response.text || '';
    default:
      return 'Respuesta generada.';
  }
}

function getFallbackResponse(intentCode: string, modulo: string): string {
  const responses: Record<string, string> = {
    commission_explain: 'Para ver el detalle de tus comisiones, ve a la seccion Mis Comisiones.',
    performance_summary: 'Para ver tu desempeno y produccion, ve a Mi Produccion.',
    daily_priorities: 'Para ver tus tareas pendientes, ve a Mi CRM > Tareas.',
    client_outreach_plan: 'Para gestionar tus contactos, ve a Mi CRM > Contactos.',
    renewals_forecast: 'Para ver renovaciones proximas, revisa las polizas en Mi CRM.',
    tramite_status_helper: 'Para ver el estado de tus tramites, ve a la seccion Tramites.',
    navigation_help: 'Puedes navegar por las diferentes secciones usando el menu lateral.',
    dashboard_summary: 'Para ver un resumen general, ve al Dashboard.',
  };

  return responses[intentCode] || `Estas en el modulo ${modulo}. En que puedo ayudarte?`;
}

function getFallbackStructuredResponse(intentCode: string): any {
  const responses: Record<string, any> = {
    navigation_help: {
      type: 'navigation_help',
      categories: [
        {
          name: 'Principal',
          actions: [
            { type: 'navigate', label: 'Dashboard', destination: '/dashboard', icon: 'Home' },
            { type: 'navigate', label: 'Mis Comisiones', destination: '/mis-comisiones', icon: 'DollarSign' },
            { type: 'navigate', label: 'Mi Produccion', destination: '/mi-produccion', icon: 'TrendingUp' },
            { type: 'navigate', label: 'Mi CRM', destination: '/mi-crm/contactos', icon: 'Users' },
          ],
        },
      ],
    },
  };

  return responses[intentCode] || null;
}
