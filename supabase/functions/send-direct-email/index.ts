import "jsr:@supabase/functions-js/edge-runtime.d.ts";
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
  from_name?: string;
  from_email?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { to, subject, html, from_name, from_email } = await req.json() as EmailRequest;

    console.log('=== SEND DIRECT EMAIL ===');
    console.log('To:', to);
    console.log('Subject:', subject);

    if (!to || !subject || !html) {
      throw new Error('Missing required fields: to, subject, html');
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY') || 're_hdUhQ6MB_BEiDto4R5NKZDwsaxvWMLeeW';
    const resend = new Resend(resendApiKey);

    const fromAddress = from_email || 'notificaciones@jiro.mx';
    const fromName = from_name || 'MOVI Digital';

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
        subject
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
