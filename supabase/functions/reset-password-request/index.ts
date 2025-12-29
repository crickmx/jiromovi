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

    console.log('Procesando solicitud de recuperación para:', email);

    // Buscar usuario por email_laboral
    const { data: usuario, error: usuarioError } = await supabaseAdmin
      .from('usuarios')
      .select('id, nombre_completo, email_laboral')
      .eq('email_laboral', email)
      .maybeSingle();

    if (usuarioError) {
      console.error('Error al buscar usuario:', usuarioError);
    }

    // Si no encontramos usuario, buscar directamente en auth por email
    let authUser = null;
    let authEmail = email;

    if (usuario) {
      // Usuario encontrado en tabla usuarios, buscar en auth por ID
      console.log('Usuario encontrado en tabla usuarios:', usuario.id);

      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.getUserById(usuario.id);

      if (authError || !authData.user) {
        console.error('Error al obtener usuario de auth por ID:', authError);
      } else {
        authUser = authData.user;
        authEmail = authUser.email; // Usar el email real de auth
        console.log('Usuario auth encontrado por ID, email real:', authEmail);
      }
    } else {
      // No encontrado en usuarios, intentar buscar directamente en auth
      console.log('Usuario no encontrado en tabla usuarios, buscando en auth por email');

      const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers();

      if (authError) {
        console.error('Error al listar usuarios de auth:', authError);
        throw new Error('Error al verificar usuario');
      }

      authUser = authUsers.users.find(u => u.email === email);
    }

    if (!authUser) {
      console.log('Email no encontrado en auth:', email);
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Si el correo existe, recibirás instrucciones para recuperar tu contraseña'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Usuario autenticación confirmado:', authUser.id, 'Email:', authEmail);

    const { data: resetData, error: resetError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: authEmail, // Usar el email real de auth, no el email_laboral
    });

    if (resetError) {
      console.error('Error al generar link de recuperación:', resetError);
      throw new Error('Error al generar enlace de recuperación');
    }

    console.log('Link de recuperación generado');

    const resetUrl = resetData.properties.action_link;
    
    const emailData = {
      tipo: 'password_reset',
      destinatario: authEmail, // Enviar al email real de auth
      datos: {
        nombre: usuario?.nombre_completo || 'Usuario',
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