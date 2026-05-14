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
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

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

    console.log('Procesando solicitud de recuperacion para email_laboral:', email);

    // Step 1: Find user by email_laboral (source of truth)
    const { data: usuario, error: usuarioError } = await supabaseAdmin
      .from('usuarios')
      .select('id, nombre, apellidos, nombre_completo, email_laboral')
      .eq('email_laboral', email)
      .maybeSingle();

    if (usuarioError) {
      console.error('Error al buscar usuario:', usuarioError);
    }

    if (!usuario) {
      console.log('Email_laboral no encontrado en usuarios:', email);
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Si el correo existe, recibiras instrucciones para recuperar tu contrasena'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Usuario encontrado:', usuario.id, 'email_laboral:', usuario.email_laboral);

    // Step 2: Get auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.getUserById(usuario.id);

    if (authError || !authData.user) {
      console.error('Error al obtener usuario de auth:', authError);
      throw new Error('Usuario no encontrado en sistema de autenticacion');
    }

    const authUser = authData.user;
    console.log('Usuario auth encontrado, email actual:', authUser.email);

    // Step 3: Sync auth.email with email_laboral if different
    if (authUser.email !== usuario.email_laboral) {
      console.log('Sincronizando auth.email:', authUser.email, '->', usuario.email_laboral);

      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        usuario.id,
        { email: usuario.email_laboral, email_confirm: true }
      );

      if (updateError) {
        console.error('Error al sincronizar email:', updateError);
      } else {
        console.log('Email sincronizado correctamente');
      }
    }

    // Step 4: Ensure email is confirmed (prevent confirmation loop)
    if (!authUser.email_confirmed_at) {
      await supabaseAdmin.auth.admin.updateUserById(usuario.id, {
        email_confirm: true,
      });
      console.log('Email confirmado automaticamente para usuario:', usuario.id);
    }

    // Step 5: Generate recovery link
    const appUrl = 'https://app.movi.digital';
    const redirectUrl = `${appUrl}/reset-password`;

    const { data: resetData, error: resetError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: usuario.email_laboral,
      options: {
        redirectTo: redirectUrl,
      },
    });

    if (resetError) {
      console.error('Error al generar link de recuperacion:', resetError);
      throw new Error('Error al generar enlace de recuperacion');
    }

    console.log('Link de recuperacion generado');

    const resetUrl = resetData.properties.action_link;
    const userName = usuario.nombre_completo || `${usuario.nombre || ''} ${usuario.apellidos || ''}`.trim() || 'Usuario';

    // Step 6: Send email directly via Resend
    if (!resendApiKey) {
      console.error('RESEND_API_KEY no configurada');
      throw new Error('Servicio de correo no configurado');
    }

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f7fa;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f7fa; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.07);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #0E23E2 0%, #1a3af5 100%); padding: 32px 40px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">MOVI Digital</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="color: #1a1a2e; margin: 0 0 16px; font-size: 22px; font-weight: 600;">Recuperar Contrasena</h2>
              <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
                Hola <strong>${userName}</strong>,
              </p>
              <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
                Recibimos una solicitud para restablecer la contrasena de tu cuenta en MOVI Digital. Haz clic en el boton de abajo para crear una nueva contrasena:
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 16px 0 32px;">
                    <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #0E23E2 0%, #1a3af5 100%); color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                      Restablecer Contrasena
                    </a>
                  </td>
                </tr>
              </table>
              <p style="color: #718096; font-size: 14px; line-height: 1.5; margin: 0 0 16px;">
                Si no solicitaste este cambio, puedes ignorar este correo. Tu contrasena actual seguira siendo la misma.
              </p>
              <p style="color: #718096; font-size: 14px; line-height: 1.5; margin: 0;">
                Este enlace expira en 24 horas por seguridad.
              </p>
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0 16px;" />
              <p style="color: #a0aec0; font-size: 12px; margin: 0;">
                Si el boton no funciona, copia y pega este enlace en tu navegador:<br>
                <a href="${resetUrl}" style="color: #0E23E2; word-break: break-all;">${resetUrl}</a>
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 24px 40px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="color: #a0aec0; font-size: 12px; margin: 0;">
                MOVI Digital - Tu plataforma integral de seguros
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const emailPayload = {
      from: 'MOVI Digital <notificaciones@movi.digital>',
      to: [usuario.email_laboral],
      subject: 'Recuperar tu contrasena - MOVI Digital',
      html: emailHtml,
    };

    console.log('Enviando correo via Resend a:', usuario.email_laboral);

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
    });

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text();
      console.error('Error Resend:', resendResponse.status, errorText);
      throw new Error(`Error al enviar correo: ${resendResponse.status}`);
    }

    const emailResult = await resendResponse.json();
    console.log('Correo enviado exitosamente:', emailResult);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Se ha enviado un correo con instrucciones para recuperar tu contrasena'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Error en reset-password-request:', message);

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Error al procesar solicitud de recuperacion',
        details: message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
