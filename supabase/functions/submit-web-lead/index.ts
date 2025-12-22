import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface WebLeadData {
  slug: string;
  nombre: string;
  celular: string;
  email: string;
  seguro_interes: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { slug, nombre, celular, email, seguro_interes }: WebLeadData = await req.json();

    // Validar campos obligatorios
    if (!slug || !nombre || !celular || !email || !seguro_interes) {
      return new Response(
        JSON.stringify({ error: 'Todos los campos son obligatorios' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 1. Identificar al agente por el slug
    const { data: agente, error: agenteError } = await supabase
      .from('usuarios')
      .select('id, nombre_completo, email_laboral, celular_laboral, web_slug')
      .eq('web_slug', slug)
      .ilike('estado', 'activo')
      .maybeSingle();

    if (agenteError || !agente) {
      console.error('Error finding agent:', agenteError);
      return new Response(
        JSON.stringify({ error: 'Página no encontrada' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 2. Verificar si el contacto ya existe (anti-duplicados)
    const { data: existingContact, error: searchError } = await supabase
      .from('crm_contactos')
      .select('id')
      .eq('usuario_id', agente.id)
      .or(`celular.eq.${celular},email.eq.${email}`)
      .maybeSingle();

    if (searchError) {
      console.error('Error searching for existing contact:', searchError);
    }

    let contactId: string;

    if (existingContact) {
      // Actualizar contacto existente
      const { data: updatedContact, error: updateError } = await supabase
        .from('crm_contactos')
        .update({
          nombre,
          celular,
          email,
          tipo_seguro: seguro_interes,
          ultima_interaccion: new Date().toISOString(),
        })
        .eq('id', existingContact.id)
        .select('id')
        .single();

      if (updateError) {
        console.error('Error updating contact:', updateError);
        return new Response(
          JSON.stringify({
            error: 'Error al actualizar el contacto',
            details: updateError.message,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      contactId = updatedContact.id;
    } else {
      // Crear nuevo contacto
      const { data: newContact, error: insertError } = await supabase
        .from('crm_contactos')
        .insert({
          usuario_id: agente.id,
          nombre,
          celular,
          email,
          estatus: 'Prospecto',
          tipo_seguro: seguro_interes,
          origen: 'Mi Página Web',
          ultima_interaccion: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (insertError) {
        console.error('Error creating contact:', insertError);
        return new Response(
          JSON.stringify({
            error: 'Error al crear el contacto en el CRM',
            details: insertError.message,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      contactId = newContact.id;
    }

    // 3. Crear tarea de seguimiento
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { error: taskError } = await supabase
      .from('crm_tareas')
      .insert({
        usuario_id: agente.id,
        contacto_id: contactId,
        titulo: `Seguimiento: Lead desde Mi Página Web`,
        descripcion: `Solicitud desde Mi Página Web. Seguro de interés: ${seguro_interes}. Contactar al cliente para cotización.\n\nDatos:\n• Nombre: ${nombre}\n• Celular: ${celular}\n• Email: ${email}`,
        tipo: 'Llamada',
        prioridad: 'Alta',
        estado: 'Pendiente',
        fecha_vencimiento: tomorrow.toISOString().split('T')[0],
      });

    if (taskError) {
      console.error('Error creating task:', taskError);
      // No fallar si no se puede crear la tarea
    }

    // 4. Enviar notificaciones usando la plantilla
    const variables = {
      agent_name: agente.nombre_completo,
      client_name: nombre,
      client_phone: celular,
      client_email: email,
      insurance_type: seguro_interes,
    };

    // Llamar a la función de notificaciones
    const { error: notifError } = await supabase.rpc('enviar_notificacion_completa', {
      p_event_key: 'web_lead_nuevo',
      p_user_id: agente.id,
      p_variables: variables,
      p_link_url: `/crm/contactos/${contactId}`,
    });

    if (notifError) {
      console.error('Error sending notifications:', notifError);
      // No fallar si las notificaciones fallan
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Solicitud recibida exitosamente',
        contactId,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error processing web lead:', error);
    return new Response(
      JSON.stringify({
        error: 'Error al procesar la solicitud',
        details: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});