import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { nombre, telefono, email, mensaje, origen, pagina, user_agent, fecha } = body;

    if (!nombre?.trim() || !email?.trim()) {
      return new Response(
        JSON.stringify({ error: 'Nombre y correo son obligatorios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Save lead to seguros_education_leads table (create if not exists via upsert)
    const { data: lead, error: leadError } = await supabase
      .from('seguros_education_leads')
      .insert({
        nombre: nombre.trim(),
        telefono: telefono?.trim() || null,
        email: email.trim().toLowerCase(),
        mensaje: mensaje?.trim() || null,
        origen: origen || 'Seguros Education Landing',
        pagina: pagina || null,
        user_agent: user_agent || null,
        created_at: fecha || new Date().toISOString(),
      })
      .select('id')
      .single();

    if (leadError) {
      // Table might not exist yet — still send the notification
      console.error('Lead insert error (non-fatal):', leadError.message);
    }

    // 2. Send email notification to ccjimenez@jiro.com.mx via send-email function
    const notificationEmail = {
      to: 'ccjimenez@jiro.com.mx',
      subject: `Nuevo lead en Seguros Education — ${nombre.trim()}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #0D6EFD, #00c8e0); padding: 28px 32px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 20px; font-weight: 700;">Nuevo Lead — Seguros Education</h1>
            <p style="color: rgba(255,255,255,0.8); margin: 6px 0 0; font-size: 14px;">seguros.education | ${new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}</p>
          </div>
          <div style="background: #f8fafc; padding: 28px 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #64748b; font-weight: 600; width: 120px;">Nombre</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #0f172a; font-weight: 600;">${nombre.trim()}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #64748b; font-weight: 600;">Correo</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #0f172a;"><a href="mailto:${email.trim()}" style="color: #0D6EFD;">${email.trim()}</a></td>
              </tr>
              ${telefono ? `<tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #64748b; font-weight: 600;">Teléfono</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #0f172a;"><a href="tel:${telefono.trim()}" style="color: #0D6EFD;">${telefono.trim()}</a></td>
              </tr>` : ''}
              ${mensaje ? `<tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #64748b; font-weight: 600; vertical-align: top;">Mensaje</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #0f172a;">${mensaje.trim()}</td>
              </tr>` : ''}
              <tr>
                <td style="padding: 10px 0; font-size: 13px; color: #64748b; font-weight: 600;">Origen</td>
                <td style="padding: 10px 0; font-size: 13px; color: #64748b;">${pagina || 'seguros.education'}</td>
              </tr>
            </table>
            <div style="margin-top: 24px; padding: 16px; background: #eff6ff; border-radius: 8px; border: 1px solid #bfdbfe;">
              <p style="margin: 0; font-size: 13px; color: #1e40af;">
                <strong>Accion recomendada:</strong> Contactar al prospecto dentro de las proximas 24 horas para maximizar la conversion.
              </p>
            </div>
          </div>
        </div>
      `,
    };

    // Call send-email edge function
    try {
      await fetch(`${supabaseUrl}/functions/v1/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify(notificationEmail),
      });
    } catch (emailErr) {
      console.error('Email notification error (non-fatal):', emailErr);
    }

    return new Response(
      JSON.stringify({ success: true, id: lead?.id || null }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('seguros-education-lead error:', err);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
