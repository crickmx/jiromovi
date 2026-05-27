import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;
const EXPIRES_MINUTES = 10;
const RATE_LIMIT_MINUTES = 2;

function generateCode(): string {
  const arr = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => CHARSET[b % CHARSET.length]).join('');
}

async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  let normalized: string;
  if (digits.startsWith('521') && digits.length === 13) {
    normalized = digits;
  } else if (digits.startsWith('52') && digits.length === 12) {
    normalized = '521' + digits.slice(2);
  } else if (digits.startsWith('1') && digits.length === 11) {
    normalized = '52' + digits.slice(1);
  } else if (digits.length === 10) {
    normalized = '521' + digits;
  } else {
    normalized = digits;
  }
  return '+' + normalized;
}

function substituteVars(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
}

function wrapWithLayout(body: string, header: string, footer: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>MOVI Digital</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;padding:20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          ${header ? `<tr><td>${header}</td></tr>` : ''}
          <tr>
            <td style="padding:32px;">
              ${body}
            </td>
          </tr>
          ${footer ? `<tr><td>${footer}</td></tr>` : ''}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// Fallback email body (no DOCTYPE/html — will be wrapped by wrapWithLayout)
function buildFallbackEmailBody(brandName: string, userName: string, code: string, magicLink: string): string {
  const greeting = userName ? `Hola, ${userName}` : 'Hola';
  return `
<div style="background:#0b2d6b;padding:28px 32px;text-align:center;margin:-32px -32px 0 -32px;">
  <div style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">${brandName}</div>
  <div style="font-size:13px;color:rgba(255,255,255,0.6);margin-top:4px;">Código de acceso seguro</div>
</div>
<div style="padding:32px 0 0 0;">
  <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#111827;">${greeting}</p>
  <p style="margin:0 0 28px;font-size:14px;color:#6b7280;line-height:1.6;">Solicitaste acceso a <strong>${brandName}</strong>. Usa el siguiente código o el botón para ingresar.</p>
  <div style="background:#f8faff;border:2px solid #1a56db;border-radius:12px;padding:24px;text-align:center;margin-bottom:28px;">
    <div style="font-size:11px;font-weight:600;color:#6b7280;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:8px;">Tu código de acceso</div>
    <div style="font-size:40px;font-weight:800;color:#0b2d6b;letter-spacing:10px;font-family:'Courier New',monospace;">${code}</div>
    <div style="font-size:12px;color:#9ca3af;margin-top:8px;">Válido por ${EXPIRES_MINUTES} minutos · Un solo uso</div>
  </div>
  <div style="text-align:center;margin-bottom:28px;">
    <a href="${magicLink}" style="display:inline-block;background:#1a56db;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:10px;">Ingresar directamente →</a>
    <div style="font-size:11px;color:#9ca3af;margin-top:10px;">O copia: <span style="color:#1a56db;">${magicLink}</span></div>
  </div>
  <div style="background:#fef3c7;border-radius:8px;padding:14px 16px;">
    <p style="margin:0;font-size:12px;color:#92400e;line-height:1.5;"><strong>Aviso de seguridad:</strong> Si no solicitaste este acceso, ignora este mensaje.</p>
  </div>
</div>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { email, phone, platform } = await req.json() as {
      email?: string;
      phone?: string;
      platform: 'movi' | 'seguwallet';
    };

    const identifier = email?.trim().toLowerCase() || phone?.trim();
    if (!identifier) {
      return new Response(JSON.stringify({ error: 'Se requiere correo electrónico.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Find user ──────────────────────────────────────────────────────────────
    let userId: string | null = null;
    let userEmail: string | null = null;
    let userPhone: string | null = null;
    let userName: string | null = null;

    if (platform === 'movi') {
      const { data: usuario } = await supabase
        .from('usuarios')
        .select('id, nombre, email_laboral, celular_laboral')
        .eq('email_laboral', identifier)
        .eq('estado', 'activo')
        .is('deleted_at', null)
        .maybeSingle();

      if (!usuario) {
        return new Response(JSON.stringify({ success: true }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      userId = usuario.id;
      userEmail = usuario.email_laboral;
      userPhone = usuario.celular_laboral;
      userName = usuario.nombre;
    } else {
      const { data: customer } = await supabase
        .from('seguwallet_customers')
        .select('id, auth_user_id, email, full_name, phone, whatsapp, status')
        .eq('email', identifier)
        .maybeSingle();

      if (!customer || customer.status === 'blocked' || customer.status === 'inactive') {
        return new Response(JSON.stringify({ success: true }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      userId = customer.auth_user_id;
      userEmail = customer.email;
      userPhone = customer.whatsapp || customer.phone;
      userName = customer.full_name;
    }

    if (!userId) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Rate limit ─────────────────────────────────────────────────────────────
    const { data: recentToken } = await supabase
      .from('passwordless_login_tokens')
      .select('created_at')
      .eq('user_id', userId)
      .eq('platform', platform)
      .is('used_at', null)
      .gte('created_at', new Date(Date.now() - RATE_LIMIT_MINUTES * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recentToken) {
      return new Response(JSON.stringify({
        error: 'Espera un momento antes de solicitar otro código.',
        retry_after: RATE_LIMIT_MINUTES * 60,
      }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Invalidate previous unused tokens ─────────────────────────────────────
    await supabase
      .from('passwordless_login_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('platform', platform)
      .is('used_at', null);

    // ── Generate code and magic token ─────────────────────────────────────────
    const code = generateCode();
    const magicToken = crypto.randomUUID();
    const [codeHash, magicTokenHash] = await Promise.all([
      sha256(code.toUpperCase()),
      sha256(magicToken),
    ]);

    const expiresAt = new Date(Date.now() + EXPIRES_MINUTES * 60 * 1000).toISOString();

    const { error: insertError } = await supabase
      .from('passwordless_login_tokens')
      .insert({
        user_id: userId,
        platform,
        email: userEmail || identifier,
        phone: userPhone,
        code_hash: codeHash,
        magic_token_hash: magicTokenHash,
        expires_at: expiresAt,
        attempts: 0,
      });

    if (insertError) {
      console.error('Error inserting token:', insertError);
      return new Response(JSON.stringify({ error: 'Error interno. Intenta de nuevo.' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Build magic link and template vars ────────────────────────────────────
    const baseUrl = platform === 'movi' ? 'https://app.movi.digital' : 'https://app.seguwallet.mx';
    const magicLink = `${baseUrl}/auth/magic?token=${magicToken}&platform=${platform}`;
    const brandName = platform === 'movi' ? 'MOVI Digital' : 'Seguwallet';

    const vars: Record<string, string> = {
      nombre: userName || '',
      codigo: code,
      magic_link: magicLink,
      plataforma: brandName,
      minutos_validez: String(EXPIRES_MINUTES),
    };

    // ── Load template from DB ──────────────────────────────────────────────────
    const { data: typeRow } = await supabase
      .from('correo_tipos_notificacion')
      .select('id')
      .eq('codigo', 'acceso_passwordless')
      .maybeSingle();

    let emailSubject = `Tu código de acceso a ${brandName}: ${code}`;
    let emailBody = buildFallbackEmailBody(brandName, userName || '', code, magicLink);
    let whatsappText = `Tu código de acceso a ${brandName} es: *${code}*\n\nTambién puedes ingresar aquí:\n${magicLink}\n\n_Este acceso vence en ${EXPIRES_MINUTES} minutos._`;

    if (typeRow?.id) {
      const { data: tpl } = await supabase
        .from('correo_plantillas')
        .select('asunto, html_cuerpo, whatsapp_plantilla')
        .eq('tipo_notificacion_id', typeRow.id)
        .maybeSingle();

      if (tpl) {
        if (tpl.asunto) emailSubject = substituteVars(tpl.asunto, vars);
        if (tpl.html_cuerpo) emailBody = substituteVars(tpl.html_cuerpo, vars);
        if (tpl.whatsapp_plantilla) whatsappText = substituteVars(tpl.whatsapp_plantilla, vars);
      }
    }

    // ── Load global email layout (header/footer) ──────────────────────────────
    const { data: layoutData } = await supabase
      .from('email_global_settings')
      .select('header_html, footer_html')
      .eq('activo', true)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    const header = layoutData?.header_html || '';
    const footer = layoutData?.footer_html || '';

    // If the body is a full HTML document (has DOCTYPE), use as-is; otherwise wrap with layout
    const isFullDocument = emailBody.trimStart().toLowerCase().startsWith('<!doctype');
    const finalEmailHtml = isFullDocument ? emailBody : wrapWithLayout(emailBody, header, footer);

    // ── Load email config from DB ─────────────────────────────────────────────
    const { data: emailConfig } = await supabase
      .from('correo_configuracion')
      .select('remitente_email, remitente_nombre, resend_api_key')
      .eq('activo', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const resendApiKey = emailConfig?.resend_api_key || Deno.env.get('RESEND_API_KEY');
    const fromEmail = emailConfig?.remitente_email || (platform === 'movi' ? 'noresponder@movi.digital' : 'noreply@seguwallet.mx');
    const fromName = emailConfig?.remitente_nombre || brandName;

    // ── Send email via Resend ─────────────────────────────────────────────────
    let emailSent = false;
    if (resendApiKey && userEmail) {
      try {
        const resend = new Resend(resendApiKey);
        const { error: emailErr } = await resend.emails.send({
          from: `${fromName} <${fromEmail}>`,
          to: [userEmail],
          subject: emailSubject,
          html: finalEmailHtml,
        });
        if (emailErr) {
          console.error('Resend error:', emailErr);
        } else {
          emailSent = true;
        }
      } catch (emailEx) {
        console.error('Error sending email:', emailEx);
      }
    }

    // ── Send WhatsApp via Wazzup ──────────────────────────────────────────────
    let whatsappSent = false;
    if (userPhone) {
      const normalizedPhone = normalizePhone(userPhone);
      try {
        const { data: waConfig } = await supabase
          .from('whatsapp_configuracion')
          .select('api_key, channel_id_uuid, activo')
          .eq('activo', true)
          .maybeSingle();

        if (waConfig?.api_key && waConfig?.channel_id_uuid) {
          const waRes = await fetch('https://api.wazzup24.com/v3/message', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${waConfig.api_key}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              channelId: waConfig.channel_id_uuid,
              chatType: 'whatsapp',
              chatId: normalizedPhone,
              text: whatsappText,
            }),
          });
          if (waRes.ok) {
            whatsappSent = true;
          } else {
            const waBody = await waRes.text();
            console.error('Wazzup error:', waRes.status, waBody, 'phone:', normalizedPhone);
          }
        } else {
          console.log('WhatsApp not configured or inactive');
        }
      } catch (waErr) {
        console.error('Error sending WhatsApp:', waErr);
      }
    }

    // ── Return success ────────────────────────────────────────────────────────
    const maskedEmail = userEmail
      ? userEmail.replace(/^(.{2})(.*)(@.*)$/, (_, a, b, c) => a + '*'.repeat(Math.max(1, b.length - 1)) + b.slice(-1) + c)
      : null;

    return new Response(JSON.stringify({
      success: true,
      email_sent: emailSent,
      whatsapp_sent: whatsappSent,
      masked_email: maskedEmail,
      expires_minutes: EXPIRES_MINUTES,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('send-login-code error:', err);
    return new Response(JSON.stringify({ error: 'Error interno del servidor.' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
