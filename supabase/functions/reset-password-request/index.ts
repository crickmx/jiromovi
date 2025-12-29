import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface PasswordResetRequest {
  email: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { email }: PasswordResetRequest = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email es requerido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Procesando solicitud de recuperación para email_laboral:', email);

    // ✅ PASO 1: Buscar usuario por email_laboral (fuente de verdad)
    const { data: usuario, error: usuarioError } = await supabaseAdmin
      .from('usuarios')
      .select('id, nombre_completo, email_laboral')
      .eq('email_laboral', email)
      .maybeSingle();

    if (usuarioError) {
      console.error('Error al buscar usuario:', usuarioError);
    }

    if (!usuario) {
      console.log('Email_laboral no encontrado en usuarios:', email);
      // Por seguridad, siempre devolver éxito (no revelar si existe o no)
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Si el correo existe, recibirás instrucciones para recuperar tu contraseña'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Usuario encontrado:', usuario.id, 'email_laboral:', usuario.email_laboral);

    // ✅ PASO 2: Obtener usuario de auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.getUserById(usuario.id);

    if (authError || !authData.user) {
      console.error('Error al obtener usuario de auth:', authError);
      throw new Error('Usuario no encontrado en sistema de autenticación');
    }

    const authUser = authData.user;
    console.log('Usuario auth encontrado, email actual:', authUser.email);

    // ✅ PASO 3: Sincronizar auth.email con email_laboral si son diferentes
    if (authUser.email !== usuario.email_laboral) {
      console.log('🔄 Sincronizando auth.email:', authUser.email, '→', usuario.email_laboral);

      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        usuario.id,
        { email: usuario.email_laboral }
      );

      if (updateError) {
        console.error('Error al sincronizar email:', updateError);
        // Continuar de todas formas, usar email actual
      } else {
        console.log('✅ Email sincronizado correctamente');
      }
    }

    // ✅ PASO 4: Generar link de recuperación con email_laboral (fuente de verdad)
    // Construir URL completa para la página de reset password
    const appUrl = Deno.env.get('APP_URL') || 'https://app.movi.digital';
    const redirectUrl = `${appUrl}/reset-password`;

    const { data: resetData, error: resetError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: usuario.email_laboral, // ✅ SIEMPRE usar email_laboral
      options: {
        redirectTo: redirectUrl,
      },
    });

    if (resetError) {
      console.error('Error al generar link de recuperación:', resetError);
      throw new Error('Error al generar enlace de recuperación');
    }

    console.log('Link de recuperación generado');

    const resetUrl = resetData.properties.action_link;
    
    // ✅ Enviar al email_laboral (fuente de verdad)
    const emailData = {
      tipo: 'password_reset',
      destinatario: usuario.email_laboral,
      datos: {
        nombre: usuario.nombre_completo || 'Usuario',
        reset_link: resetUrl,
      }
    };

    console.log('Enviando correo transaccional...');

    const emailResponse = await fetch(`${supabaseUrl}/functions/v1/enviar-correo-transaccional`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify(emailData),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error('Error al enviar correo:', errorText);
      throw new Error('Error al enviar correo de recuperación');
    }

    const emailResult = await emailResponse.json();
    console.log('Correo enviado exitosamente:', emailResult);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Se ha enviado un correo con instrucciones para recuperar tu contraseña'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error en reset-password-request:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Error al procesar solicitud de recuperación',
        details: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});