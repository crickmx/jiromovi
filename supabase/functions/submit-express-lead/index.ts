import { createClient } from 'npm:@supabase/supabase-js@2';

// Endpoint público de captura de leads de seguros.express (Parte B.3 / D.1 / F).
// Crea el lead, dispara la primera notificación por anillos a los agentes
// habilitados en alcance, y manda la confirmación al visitante (identidad
// Seguwallet). CORS abierto (endpoint público, mismo criterio que submit-web-lead)
// — cubre seguros.express, beta.movi.digital y localhost de dev.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface ExpressLeadData {
  nombre?: string;
  telefono?: string;
  email?: string;
  tipo_seguro_interes?: string;
  lat?: number | null;
  lng?: number | null;
  direccion_manual?: string | null;
  ubicacion_metodo?: 'gps' | 'manual' | null;
  recaptchaToken?: string;
}

function render(tpl: string | null | undefined, vars: Record<string, string>): string {
  let out = tpl || '';
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{{${k}}}`).join(v ?? '');
  }
  return out;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const recaptchaSecretKey = Deno.env.get('RECAPTCHA_SECRET_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: ExpressLeadData = await req.json();
    const nombre = (body.nombre || '').trim();
    const telefono = (body.telefono || '').trim();
    const email = (body.email || '').trim();
    const tipoSeguro = (body.tipo_seguro_interes || '').trim();
    const lat = typeof body.lat === 'number' ? body.lat : null;
    const lng = typeof body.lng === 'number' ? body.lng : null;
    const direccionManual = (body.direccion_manual || '').trim() || null;
    const ubicacionMetodo = body.ubicacion_metodo === 'gps' || body.ubicacion_metodo === 'manual'
      ? body.ubicacion_metodo : (lat != null && lng != null ? 'gps' : (direccionManual ? 'manual' : null));

    // Campos mínimos.
    if (!nombre || !telefono) {
      return new Response(
        JSON.stringify({ success: false, error: 'Nombre y teléfono son obligatorios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // reCAPTCHA v3 (mismo patrón que submit-web-lead).
    let recaptchaScore: number | null = null;
    if (recaptchaSecretKey) {
      const recaptchaResponse = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `secret=${recaptchaSecretKey}&response=${body.recaptchaToken || ''}`,
      });
      const recaptchaResult = await recaptchaResponse.json();
      recaptchaScore = typeof recaptchaResult.score === 'number' ? recaptchaResult.score : null;
      if (!recaptchaResult.success || (recaptchaScore !== null && recaptchaScore < 0.5)) {
        return new Response(
          JSON.stringify({ success: false, error: 'No pudimos verificar tu solicitud. Intenta de nuevo.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Config del motor (anillo inicial).
    const { data: config } = await supabase
      .from('express_leads_config').select('*').eq('id', 1).maybeSingle();
    const anilloInicial = config?.anillo_km_inicial ?? 5;

    // Crear el lead ya en estado 'notificado' (vamos a notificar ahora mismo).
    const { data: lead, error: insertError } = await supabase
      .from('express_leads')
      .insert({
        nombre, telefono, email: email || null,
        tipo_seguro_interes: tipoSeguro || null,
        lat, lng, direccion_manual: direccionManual,
        ubicacion_metodo: ubicacionMetodo,
        anillo_km_actual: anilloInicial,
        estado: 'notificado',
        ultima_expansion_at: new Date().toISOString(),
        recaptcha_score: recaptchaScore,
        origen: 'seguros.express',
      })
      .select('*')
      .single();

    if (insertError || !lead) {
      console.error('Error creating express lead:', insertError);
      return new Response(
        JSON.stringify({ success: false, error: 'No se pudo registrar la solicitud' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Primera notificación por anillos a los agentes en alcance.
    let notificados = 0;
    try {
      const { data: agentes } = await supabase
        .rpc('express_agentes_pendientes_notificar', { p_lead_id: lead.id });
      for (const ag of (agentes || [])) {
        const distancia = ag.distancia_km != null ? Math.round(Number(ag.distancia_km)) : null;
        const ubicacionFrase = distancia != null
          ? ` a ~${distancia} km de ti`
          : (direccionManual ? ` (${direccionManual})` : '');
        const variables = {
          tipo_seguro: tipoSeguro || 'seguro',
          ubicacion_frase: ubicacionFrase,
          distancia_km: distancia != null ? String(distancia) : '',
          url: '/mi-crm/leads-seguros-express',
        };
        await supabase.rpc('send_transactional_notification', {
          p_event_key: 'express_lead_nuevo',
          p_user_id: ag.usuario_id,
          p_variables: variables,
          p_link_url: '/mi-crm/leads-seguros-express',
        });
        // Push web VAPID (canal adicional del lado interno).
        try {
          await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
            body: JSON.stringify({
              usuario_id: ag.usuario_id,
              title: 'Nuevo lead cerca · seguros.express',
              body: `Hay un lead de ${tipoSeguro || 'seguro'}${ubicacionFrase}. Tómalo para ver sus datos.`,
              url: '/mi-crm/leads-seguros-express',
              tag: `express-lead-${lead.id}`,
            }),
          });
        } catch (pushErr) {
          console.error('Push notification error (non-fatal):', pushErr);
        }
        await supabase.from('express_lead_agentes_notificados').insert({
          lead_id: lead.id, usuario_id: ag.usuario_id, anillo_km: lead.anillo_km_actual,
        });
        notificados++;
      }
    } catch (notifErr) {
      console.error('Error notifying agents (non-fatal):', notifErr);
    }

    // Confirmación al visitante (identidad Seguwallet) — sólo si dejó email.
    if (email) {
      try {
        const { data: tpl } = await supabase
          .from('transactional_notification_templates')
          .select('email_subject_template, email_body_template')
          .eq('event_key', 'express_lead_confirmacion_visitante')
          .maybeSingle();
        const vVars = { nombre, tipo_seguro: tipoSeguro || 'seguro' };
        const subject = render(tpl?.email_subject_template, vVars) || 'Recibimos tu solicitud de cotización';
        const html = render(tpl?.email_body_template, vVars)
          || `<p>Hola ${nombre}, recibimos tu solicitud. Un asesor te contactará pronto.</p>`;
        await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
          body: JSON.stringify({ to: email, subject, html }),
        });
      } catch (emailErr) {
        console.error('Visitor confirmation email error (non-fatal):', emailErr);
      }
    }

    return new Response(
      JSON.stringify({ success: true, lead_id: lead.id, notificados }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error processing express lead:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Error al procesar la solicitud' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
