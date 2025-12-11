import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface EmailRequest {
  to: string;
  subject: string;
  html: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { to, subject, html } = await req.json() as EmailRequest;

    console.log('=== SEND DIRECT EMAIL ===');
    console.log('To:', to);
    console.log('Subject:', subject);

    if (!to || !subject || !html) {
      throw new Error('Missing required fields: to, subject, html');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    console.log('Loading email configuration from database...');
    const { data: config, error: configError } = await supabase
      .from('correo_configuracion')
      .select('remitente_email, remitente_nombre, resend_api_key')
      .eq('activo', true)
      .maybeSingle();

    if (configError) {
      console.error('Error loading email config:', configError);
      throw new Error('Error loading email configuration');
    }

    if (!config) {
      throw new Error('No active email configuration found');
    }

    console.log('Email config loaded:');
    console.log('  From Name:', config.remitente_nombre);
    console.log('  From Email:', config.remitente_email);

    const resendApiKey = config.resend_api_key || Deno.env.get('RESEND_API_KEY') || 're_hdUhQ6MB_BEiDto4R5NKZDwsaxvWMLeeW';
    const resend = new Resend(resendApiKey);

    const fromAddress = config.remitente_email;
    const fromName = config.remitente_nombre;

    console.log('Sending email via Resend...');
    console.log('From:', `${fromName} <${fromAddress}>`);

    const { data, error } = await resend.emails.send({
      from: `${fromName} <${fromAddress}>`,
      to: [to],
      subject: subject,
      html: html,
    });

    if (error) {
      console.error('Resend error:', error);
      throw error;
    }

    console.log('Email sent successfully. ID:', data?.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Email sent successfully',
        resend_id: data?.id,
        to,
        subject,
        from: `${fromName} <${fromAddress}>`
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error: any) {
    console.error('Error sending email:', error);

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