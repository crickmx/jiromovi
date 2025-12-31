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
  recaptchaToken: string;
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
    const recaptchaSecretKey = Deno.env.get('RECAPTCHA_SECRET_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { slug, nombre, celular, email, seguro_interes, recaptchaToken }: WebLeadData = await req.json();

    // Validar campos obligatorios
    if (!slug || !nombre || !celular || !email || !seguro_interes || !recaptchaToken) {
      return new Response(
        JSON.stringify({ error: 'Todos los campos son obligatorios' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validar reCAPTCHA v3 token
    const recaptchaResponse = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `secret=${recaptchaSecretKey}&response=${recaptchaToken}`,
    });

    const recaptchaResult = await recaptchaResponse.json();

    if (!recaptchaResult.success) {
      console.error('reCAPTCHA verification failed:', recaptchaResult);
      return new Response(
        JSON.stringify({
          error: 'Verificación de reCAPTCHA fallida. Por favor intenta nuevamente.',
          success: false,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // reCAPTCHA v3 devuelve un score entre 0.0 y 1.0
    // 1.0 = muy probablemente humano, 0.0 = muy probablemente bot
    // Rechazar si el score es menor a 0.5 (umbral recomendado por Google)
    if (recaptchaResult.score < 0.5) {
      console.warn('reCAPTCHA score too low:', recaptchaResult.score);
      return new Response(
        JSON.stringify({
          error: 'Lo sentimos, no pudimos verificar tu solicitud. Por favor intenta nuevamente más tarde.',
          success: false,
        }),
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
      .eq('creado_por', agente.id)
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
          nombre_completo: nombre,
          celular,
          email,
          campos_personalizados: {
            tipo_seguro: seguro_interes,
          },
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
          creado_por: agente.id,
          tipo_contacto: 'Persona',
          nombre_completo: nombre,
          celular,
          email,
          estatus: 'Prospecto',
          fuente_origen: 'Mi Página Web',
          campos_personalizados: {
            tipo_seguro: seguro_interes,
          },
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
        creado_por: agente.id,
        contacto_id: contactId,
        descripcion: `Seguimiento: Lead desde Mi Página Web\n\nSolicitud desde Mi Página Web. Seguro de interés: ${seguro_interes}. Contactar al cliente para cotización.\n\nDatos:\n• Nombre: ${nombre}\n• Celular: ${celular}\n• Email: ${email}`,
        tipo_actividad: 'Llamada',
        prioridad: 'Alta',
        estatus: 'Pendiente',
        fecha_vencimiento: tomorrow.toISOString(),
      });

    if (taskError) {
      console.error('Error creating task:', taskError);
      // No fallar si no se puede crear la tarea
    }

    // 4. Enviar notificaciones transaccionales por todos los canales
    const variables = {
      agent_name: agente.nombre_completo,
      client_name: nombre,
      client_phone: celular,
      client_email: email,
      insurance_type: seguro_interes,
    };

    // Llamar a la función de notificaciones transaccionales
    const { data: notifId, error: notifError } = await supabase.rpc('send_transactional_notification', {
      p_event_key: 'web_lead_nuevo',
      p_user_id: agente.id,
      p_variables: variables,
      p_link_url: `/mi-crm/contactos/${contactId}`,
    });

    if (notifError) {
      console.error('Error sending notifications:', notifError);
      // No fallar si las notificaciones fallan
    } else {
      console.log('Notifications sent successfully. In-app notification ID:', notifId);
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