import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

const clip = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Solicitud inválida' }, 400);
  }

  // Honeypot: los bots llenan campos ocultos; se responde OK sin guardar.
  if (clip(body.website, 200)) return json({ success: true, id: null });

  const nombre = clip(body.nombre, 120);
  const email = clip(body.email, 254).toLowerCase();
  const telefono = clip(body.telefono, 30);
  const mensaje = clip(body.mensaje, 2000);
  const pagina = clip(body.pagina, 500);
  const origen = clip(body.origen, 100) || 'Seguros Education Landing';
  const userAgent = clip(body.user_agent, 400);

  if (!nombre || !EMAIL_RE.test(email)) return json({ error: 'Nombre y un correo válido son obligatorios' }, 400);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: lead, error: leadError } = await supabase
    .from('seguros_education_leads')
    .insert({
      nombre,
      telefono: telefono || null,
      email,
      mensaje: mensaje || null,
      origen,
      pagina: pagina || null,
      user_agent: userAgent || null,
    })
    .select('id')
    .single();
  if (leadError) console.error('seguros-education-lead insert:', leadError.message);

  const emailOk = await notificar(supabase, { nombre, email, telefono, mensaje, pagina });

  // Solo se reporta error si el lead no quedó registrado en ningún lado.
  if (leadError && !emailOk) return json({ error: 'No fue posible registrar la solicitud' }, 500);
  return json({ success: true, id: lead?.id ?? null });
});

async function notificar(
  supabase: ReturnType<typeof createClient>,
  l: { nombre: string; email: string; telefono: string; mensaje: string; pagina: string },
) {
  const { data: config } = await supabase
    .from('correo_configuracion')
    .select('resend_api_key, remitente_email, remitente_nombre')
    .eq('activo', true)
    .eq('tipo_integracion', 'resend')
    .limit(1)
    .maybeSingle();
  const apiKey = Deno.env.get('RESEND_API_KEY') || config?.resend_api_key;
  if (!apiKey) {
    console.error('seguros-education-lead: falta RESEND_API_KEY');
    return false;
  }
  const to = Deno.env.get('SE_LEADS_NOTIFY_EMAIL') || 'ccjimenez@jiro.com.mx';
  const from = `${config?.remitente_nombre || 'MOVI Digital'} <${config?.remitente_email || 'notificaciones@movi.digital'}>`;
  const row = (label: string, value: string) => `<tr>
      <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;font-size:13px;color:#64748b;font-weight:600;width:120px;vertical-align:top;">${label}</td>
      <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;font-size:14px;color:#0f172a;">${value}</td>
    </tr>`;
  const fecha = new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' });
  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:linear-gradient(135deg,#0D6EFD,#00c8e0);padding:28px 32px;border-radius:12px 12px 0 0;">
        <h1 style="color:white;margin:0;font-size:20px;font-weight:700;">Nuevo Lead — Seguros Education</h1>
        <p style="color:rgba(255,255,255,0.8);margin:6px 0 0;font-size:14px;">seguros.education | ${fecha}</p>
      </div>
      <div style="background:#f8fafc;padding:28px 32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;">
        <table style="width:100%;border-collapse:collapse;">
          ${row('Nombre', `<strong>${esc(l.nombre)}</strong>`)}
          ${row('Correo', `<a href="mailto:${esc(l.email)}" style="color:#0D6EFD;">${esc(l.email)}</a>`)}
          ${l.telefono ? row('Teléfono', esc(l.telefono)) : ''}
          ${l.mensaje ? row('Mensaje', esc(l.mensaje).replace(/\n/g, '<br>')) : ''}
          ${row('Origen', esc(l.pagina || 'seguros.education'))}
        </table>
        <div style="margin-top:24px;padding:16px;background:#eff6ff;border-radius:8px;border:1px solid #bfdbfe;">
          <p style="margin:0;font-size:13px;color:#1e40af;"><strong>Acción recomendada:</strong> contactar al prospecto dentro de las próximas 24 horas.</p>
        </div>
      </div>
    </div>`;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], reply_to: l.email, subject: `Nuevo lead en Seguros Education — ${l.nombre}`, html }),
    });
    if (!res.ok) console.error('seguros-education-lead resend:', res.status, await res.text());
    return res.ok;
  } catch (e) {
    console.error('seguros-education-lead resend:', e);
    return false;
  }
}
