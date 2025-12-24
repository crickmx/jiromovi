import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface UserContext {
  id: string;
  nombre: string;
  apellidos: string;
  email: string;
  rol: string;
  oficina_nombre?: string;
}

async function getUserContext(supabase: any, conversacionId: string): Promise<UserContext | null> {
  const { data: conv } = await supabase
    .from('conversaciones_chatgpt')
    .select('usuario_id')
    .eq('id', conversacionId)
    .single();

  if (!conv) return null;

  const { data: user } = await supabase
    .from('usuarios')
    .select(`
      id,
      nombre,
      apellidos,
      email,
      rol,
      oficinas:oficina_id(nombre)
    `)
    .eq('id', conv.usuario_id)
    .single();

  if (!user) return null;

  return {
    id: user.id,
    nombre: user.nombre,
    apellidos: user.apellidos,
    email: user.email,
    rol: user.rol,
    oficina_nombre: user.oficinas?.nombre
  };
}

async function getRelevantData(supabase: any, userId: string, mensaje: string, modulo: string) {
  const mensajeNorm = mensaje.toLowerCase();
  const context: any = {};

  if (mensajeNorm.includes('comision') || mensajeNorm.includes('pago') || mensajeNorm.includes('ultimas comisiones') || mensajeNorm.includes('resumen') || mensajeNorm.includes('cuanto') && modulo === 'comisiones') {
    const { data: comisiones } = await supabase
      .from('commission_details')
      .select('*')
      .eq('usuario_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (comisiones && comisiones.length > 0) {
      const total = comisiones.reduce((sum: number, c: any) => sum + (c.comision_neta || 0), 0);
      context.comisiones = {
        total_ultimas: total,
        cantidad_registros: comisiones.length,
        detalle: comisiones.map((c: any) => ({
          cliente: c.nombre_asegurado,
          monto: c.comision_neta,
          fecha: c.created_at
        }))
      };
    } else {
      context.comisiones = { mensaje: 'No se encontraron comisiones registradas' };
    }
  }

  if (mensajeNorm.includes('produccion') || mensajeNorm.includes('ventas') || mensajeNorm.includes('poliza')) {
    const { data: produccion } = await supabase
      .from('production_records')
      .select('*')
      .eq('usuario_id', userId)
      .order('fecha_emision', { ascending: false })
      .limit(10);

    if (produccion && produccion.length > 0) {
      context.produccion = {
        total_polizas: produccion.length,
        detalle: produccion.map((p: any) => ({
          cliente: p.nombre_cliente,
          concepto: p.concepto,
          prima: p.prima_total,
          fecha: p.fecha_emision
        }))
      };
    } else {
      context.produccion = { mensaje: 'No se encontraron registros de producción' };
    }
  }

  if (mensajeNorm.includes('cafe') || mensajeNorm.includes('tienda') || mensajeNorm.includes('producto') || mensajeNorm.includes('cuanto cuesta') || mensajeNorm.includes('precio') || mensajeNorm.includes('bolsa')) {
    const { data: productos } = await supabase
      .from('store_productos')
      .select('*')
      .eq('disponible', true);

    if (productos && productos.length > 0) {
      context.productos_tienda = productos.map((p: any) => ({
        nombre: p.nombre,
        precio: p.precio,
        categoria: p.categoria,
        descripcion: p.descripcion
      }));
    } else {
      context.productos_tienda = { mensaje: 'No hay productos disponibles en la tienda' };
    }
  }

  if (mensajeNorm.includes('cliente') || mensajeNorm.includes('contacto') || modulo === 'crm') {
    const { data: contactos } = await supabase
      .from('crm_contactos')
      .select('*')
      .eq('usuario_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (contactos && contactos.length > 0) {
      context.contactos = {
        total: contactos.length,
        detalle: contactos.map((c: any) => ({
          nombre: c.nombre,
          telefono: c.telefono,
          email: c.email
        }))
      };
    }
  }

  if (mensajeNorm.includes('tarea') || mensajeNorm.includes('pendiente') || mensajeNorm.includes('hacer')) {
    const { data: tareas } = await supabase
      .from('crm_tareas')
      .select('*')
      .eq('usuario_id', userId)
      .eq('completada', false)
      .order('fecha_vencimiento', { ascending: true })
      .limit(5);

    if (tareas && tareas.length > 0) {
      context.tareas_pendientes = {
        total: tareas.length,
        detalle: tareas.map((t: any) => ({
          titulo: t.titulo,
          fecha_vencimiento: t.fecha_vencimiento,
          prioridad: t.prioridad
        }))
      };
    }
  }

  return context;
}

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
      const userContext = await getUserContext(supabase, conversacion_id);
      const relevantData = userContext ? await getRelevantData(supabase, userContext.id, mensaje, modulo) : {};

      const systemPrompt = `Eres Mi Asistente de MOVI Digital, un asistente virtual para agentes de seguros.

PERSONALIDAD:
- Profesional pero cercano y amigable
- Claro, conciso y orientado a la acción
- Hablas en español mexicano usando "tú"

REGLAS ESTRICTAS:
1. USA los datos reales que te proporciono en el contexto
2. Si tienes datos reales, responde directamente con esa información
3. Si NO tienes datos, guía al usuario a dónde puede encontrarlos
4. Responde SOLO con JSON válido, sin texto adicional, sin markdown, sin bloques de código
5. NO uses \`\`\`json, responde únicamente el JSON puro
6. Sé conversacional y útil
7. Incluye acciones concretas que el usuario pueda hacer ahora
8. USA ÚNICAMENTE las rutas de la lista RUTAS DISPONIBLES (abajo)

RUTAS DISPONIBLES EN LA PLATAFORMA:
- /dashboard - Panel principal
- /perfil - Perfil del usuario
- /mi-crm/contactos - Lista de contactos
- /mi-crm/tareas - Tareas y seguimientos
- /mi-crm/reportes - Reportes de CRM
- /mi-produccion - Mi producción personal
- /mis-comisiones - Mis comisiones
- /produccion/por-vendedor - Producción del equipo (gerentes/admin)
- /tramites - Trámites
- /comunicados - Comunicados
- /store - Tienda
- /espacio-jiro - Reservas de espacios
- /vacaciones - Solicitudes de vacaciones
- /seguros-education - Academia digital
- /gmm/cotizador - Cotizador GMM
- /directorio - Directorio de usuarios

FORMATO DE RESPUESTA:
Siempre responde con JSON con esta estructura:
{
  "type": "text",
  "text": "Tu respuesta conversacional aquí",
  "actions": [
    {"type": "navigate", "label": "Ver [Sección]", "destination": "/ruta", "icon": "IconName"}
  ]
}

ICONOS DISPONIBLES (Lucide React):
Home, Users, DollarSign, TrendingUp, CheckSquare, FileText, Briefcase, Calendar, GraduationCap, Calculator, BookOpen, Bell, Settings`;

      let userPrompt = `DATOS DEL USUARIO:
- Nombre: ${userContext?.nombre} ${userContext?.apellidos}
- Email: ${userContext?.email}
- Rol: ${userContext?.rol}
${userContext?.oficina_nombre ? `- Oficina: ${userContext.oficina_nombre}` : ''}

DATOS REALES DISPONIBLES:
${JSON.stringify(relevantData, null, 2)}

CONTEXTO: El usuario está en ${modulo} (ruta: ${ruta})

PREGUNTA DEL USUARIO: ${mensaje}

INSTRUCCIONES:
- Si tienes datos reales arriba, úsalos directamente en tu respuesta
- Sé específico con números, nombres y fechas cuando los tengas
- Si no tienes los datos exactos que pide, guíalo a dónde puede verlos
- Sé conversacional y amigable
- Responde únicamente con JSON válido, sin texto adicional.`;

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