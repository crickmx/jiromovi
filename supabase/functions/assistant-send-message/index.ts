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

    let respuestaTexto = '';
    let respuestaEstructurada = null;

    if (openaiApiKey) {
      const systemPrompt = `Eres Mi Asistente de MOVI Digital, un asistente virtual para agentes de seguros.

PERSONALIDAD:
- Profesional pero cercano y amigable
- Claro, conciso y orientado a la acción
- Hablas en español mexicano usando "tú"

REGLAS ESTRICTAS:
1. NUNCA inventes datos, cifras o información que no tengas
2. Si no tienes datos reales, explica cómo el usuario puede encontrarlos en la plataforma
3. Responde SOLO con JSON válido, sin texto adicional, sin markdown, sin bloques de código
4. NO uses \`\`\`json, responde únicamente el JSON puro
5. Sé conversacional y útil, guía al usuario a las secciones correctas
6. Incluye acciones concretas que el usuario pueda hacer ahora
7. Si el usuario pregunta por datos específicos, guíalo a dónde verlos en lugar de inventar

FORMATO DE RESPUESTA:
Siempre responde con JSON con esta estructura:
{
  "type": "text",
  "text": "Tu respuesta conversacional aquí",
  "actions": [
    {"type": "navigate", "label": "Ver [Sección]", "destination": "/ruta", "icon": "IconName"}
  ]
}`;

      const userPrompt = `Contexto: El usuario está en ${modulo} (ruta: ${ruta})

Pregunta del usuario: ${mensaje}

Responde de forma útil y conversacional. Si el usuario pregunta por datos específicos (comisiones, producción, clientes, etc.), explica dónde puede verlos en la plataforma en lugar de inventar información.

Responde únicamente con JSON válido, sin texto adicional.`;

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
      respuestaTexto = 'Por favor configura la API de OpenAI para usar el asistente.';
      respuestaEstructurada = {
        type: 'text',
        text: respuestaTexto,
        actions: []
      };
    }

    const { data: mensajeData, error: mensajeError } = await supabase
      .from('mensajes_chatgpt')
      .insert({
        conversacion_id,
        rol: 'assistant',
        contenido: respuestaTexto,
        respuesta_estructurada_json: respuestaEstructurada,
        tiene_acciones: respuestaEstructurada?.actions?.length > 0,
      })
      .select()
      .single();

    if (mensajeError) throw mensajeError;

    await supabase
      .from('conversaciones_chatgpt')
      .update({
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversacion_id);

    return new Response(
      JSON.stringify({
        conversacion_id,
        mensaje_id: mensajeData.id,
        respuesta: respuestaTexto,
        respuesta_estructurada: respuestaEstructurada,
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

function getTextFromStructuredResponse(response: any): string {
  if (response.type === 'text' && response.text) {
    return response.text;
  }
  return 'Respuesta generada.';
}