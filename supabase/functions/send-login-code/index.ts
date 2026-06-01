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

function normalizePhoneMX(phone: string): string {
  const p = phone.replace(/\D/g, '');
  if (p.startsWith('521') && p.length === 13) return p;
  if (p.startsWith('52') && p.length === 12) return '521' + p.slice(2);
  if (p.length === 10) return '521' + p;
  if (p.startsWith('1') && p.length === 11) return '52' + p;
  return p;
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
  <title>Código de Acceso</title>
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

function buildFallbackEmailBody(brandName: string, userName: string, code: string): string {
  const greeting = userName ? `Hola, ${userName}` : 'Hola';
  const accentColor = brandName === 'Seguwallet' ? '#0d9488' : '#0b2d6b';
  const bgColor = brandName === 'Seguwallet' ? '#f0fdfa' : '#f8faff';
  return `
<div style="background:${accentColor};padding:28px 32px;text-align:center;margin:-32px -32px 0 -32px;">
  <div style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">${brandName}</div>
  <div style="font-size:13px;color:rgba(255,255,255,0.6);margin-top:4px;">Código de acceso seguro</div>
</div>
<div style="padding:32px 0 0 0;">
  <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#111827;">${greeting}</p>
  <p style="margin:0 0 28px;font-size:14px;color:#6b7280;line-height:1.6;">Solicitaste acceso a <strong>${brandName}</strong>. Usa el siguiente código para ingresar.</p>
  <div style="background:${bgColor};border:2px solid ${accentColor};border-radius:12px;padding:24px;text-align:center;margin-bottom:28px;">
    <div style="font-size:11px;font-weight:600;color:#6b7280;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:8px;">Tu código de acceso</div>
    <div style="font-size:40px;font-weight:800;color:${accentColor};letter-spacing:10px;font-family:'Courier New',monospace;">${code}</div>
    <div style="font-size:12px;color:#9ca3af;margin-top:8px;">Válido por ${EXPIRES_MINUTES} minutos · Un solo uso</div>
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
      platform: 'movi' | 'seguwallet' | 'chava';
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
    } else if (platform === 'chava') {
      // Chava AI users — look up chava_agente_users first
      const { data: chavaUser } = await supabase
        .from('chava_agente_users')
        .select('id, auth_user_id, email, nombre_completo, whatsapp, estatus')
        .eq('email', identifier)
        .maybeSingle();

      if (chavaUser && chavaUser.estatus !== 'inactivo' && chavaUser.estatus !== 'bloqueado') {
        userId = chavaUser.auth_user_id;
        userEmail = chavaUser.email;
        userPhone = chavaUser.whatsapp;
        userName = chavaUser.nombre_completo;
      } else if (!chavaUser) {
        // Fallback: check if this is a MOVI user (usuarios table)
        const { data: moviUser } = await supabase
          .from('usuarios')
          .select('id, nombre, apellidos, email_laboral, celular_laboral, estado')
          .eq('email_laboral', identifier)
          .is('deleted_at', null)
          .maybeSingle();

        if (moviUser && moviUser.estado === 'activo') {
          // Auto-provision chava_agente_users record for this MOVI user
          const authEmail = identifier;
          const { data: authUser } = await supabase.auth.admin.getUserByEmail(authEmail);
          const authId = authUser?.user?.id || null;

          if (authId) {
            const fullName = [moviUser.nombre, moviUser.apellidos].filter(Boolean).join(' ');
            const { data: existing } = await supabase
              .from('chava_agente_users')
              .select('id, auth_user_id')
              .eq('auth_user_id', authId)
              .maybeSingle();

            if (!existing) {
              await supabase.from('chava_agente_users').insert({
                auth_user_id: authId,
                nombre_completo: fullName,
                email: identifier,
                whatsapp: moviUser.celular_laboral || null,
                tipo_usuario: 'agente_movi',
                estatus: 'activo',
              });
            }

            userId = authId;
            userEmail = identifier;
            userPhone = moviUser.celular_laboral || null;
            userName = moviUser.nombre;
          }
        }

        if (!userId) {
          // Fallback: check if this is a Seguwallet customer
          const { data: swCustomer } = await supabase
            .from('seguwallet_customers')
            .select('auth_user_id, email, full_name, phone, whatsapp, status')
            .eq('email', identifier)
            .maybeSingle();

          if (swCustomer && swCustomer.status === 'active') {
            const authId = swCustomer.auth_user_id;
            const { data: existing } = await supabase
              .from('chava_agente_users')
              .select('id')
              .eq('auth_user_id', authId)
              .maybeSingle();

            if (!existing) {
              await supabase.from('chava_agente_users').insert({
                auth_user_id: authId,
                nombre_completo: swCustomer.full_name,
                email: identifier,
                whatsapp: swCustomer.whatsapp || swCustomer.phone || null,
                tipo_usuario: 'particular',
                estatus: 'activo',
              });
            }

            userId = authId;
            userEmail = identifier;
            userPhone = swCustomer.whatsapp || swCustomer.phone || null;
            userName = swCustomer.full_name;
          }
        }

        if (!userId) {
          // User not found in any table — silent success
          return new Response(JSON.stringify({ success: true }), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } else {
        // Blocked or inactive chava user — silent success
        return new Response(JSON.stringify({ success: true }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
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

    // ── Generate code ─────────────────────────────────────────────────────────
    const code = generateCode();
    const codeHash = await sha256(code.toUpperCase());
    const magicTokenHash = await sha256(crypto.randomUUID());

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

    // ── Build template vars ────────────────────────────────────────────────────
    const brandName = platform === 'seguwallet' ? 'Seguwallet' : platform === 'chava' ? 'Chava AI' : 'MOVI Digital';
    const templateCode = platform === 'seguwallet' ? 'acceso_passwordless_seguwallet' : 'acceso_passwordless';

    const vars: Record<string, string> = {
      nombre: userName || '',
      codigo: code,
      plataforma: brandName,
      minutos_validez: String(EXPIRES_MINUTES),
    };

    // ── Load template from DB ──────────────────────────────────────────────────
    const { data: typeRow } = await supabase
      .from('correo_tipos_notificacion')
      .select('id')
      .eq('codigo', templateCode)
      .maybeSingle();

    let emailSubject = `Tu código de acceso a ${brandName}: ${code}`;
    let emailBody = buildFallbackEmailBody(brandName, userName || '', code);
    let whatsappText = `Tu código de acceso a *${brandName}* es:\n\n*${code}*\n\n_Válido por ${EXPIRES_MINUTES} minutos. Un solo uso._`;

    let templateResendChannelId: string | null = null;
    let templateWazzupChannelId: string | null = null;

    if (typeRow?.id) {
      const { data: tpl } = await supabase
        .from('correo_plantillas')
        .select('asunto, html_cuerpo, whatsapp_plantilla, resend_channel_id, wazzup24_channel_id')
        .eq('tipo_notificacion_id', typeRow.id)
        .maybeSingle();

      if (tpl) {
        if (tpl.asunto) emailSubject = substituteVars(tpl.asunto, vars);
        if (tpl.html_cuerpo) emailBody = substituteVars(tpl.html_cuerpo, vars);
        if (tpl.whatsapp_plantilla) whatsappText = substituteVars(tpl.whatsapp_plantilla, vars);
        templateResendChannelId = tpl.resend_channel_id;
        templateWazzupChannelId = tpl.wazzup24_channel_id;
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

    const isFullDocument = emailBody.trimStart().toLowerCase().startsWith('<!doctype');
    const finalEmailHtml = isFullDocument ? emailBody : wrapWithLayout(emailBody, header, footer);

    // ── Resolve email channel config ──────────────────────────────────────────
    let resendApiKey: string | null = null;
    let fromEmail: string;
    let fromName: string;
    let emailChannelId: string | null = null;
    let emailChannelName: string | null = null;

    if (templateResendChannelId) {
      const { data: ch } = await supabase
        .from('notification_channels')
        .select('id, name, config, is_active')
        .eq('id', templateResendChannelId)
        .maybeSingle();

      if (ch?.is_active && ch.config) {
        resendApiKey = ch.config.api_key;
        fromEmail = ch.config.from_email;
        fromName = ch.config.from_name || brandName;
        emailChannelId = ch.id;
        emailChannelName = ch.name;
      }
    }

    if (!resendApiKey) {
      const { data: defaultCh } = await supabase
        .from('notification_channels')
        .select('id, name, config, is_active')
        .eq('type', 'email_resend')
        .eq('is_default', true)
        .eq('is_active', true)
        .maybeSingle();

      if (defaultCh?.config) {
        resendApiKey = defaultCh.config.api_key;
        fromEmail = defaultCh.config.from_email;
        fromName = defaultCh.config.from_name || brandName;
        emailChannelId = defaultCh.id;
        emailChannelName = defaultCh.name;
      } else {
        fromEmail = platform === 'movi' ? 'noresponder@movi.digital' : 'seguwallet@movi.digital';
        fromName = brandName;
      }
    }

    // ── Resolve WhatsApp channel config ───────────────────────────────────────
    let waApiKey: string | null = null;
    let waChannelId: string | null = null;
    let waChannelName: string | null = null;
    let waConfigChannelId: string | null = null;

    if (templateWazzupChannelId) {
      const { data: ch } = await supabase
        .from('notification_channels')
        .select('id, name, config, is_active')
        .eq('id', templateWazzupChannelId)
        .maybeSingle();

      if (ch?.is_active && ch.config) {
        waApiKey = ch.config.api_key;
        waConfigChannelId = ch.config.channel_id;
        waChannelId = ch.id;
        waChannelName = ch.name;
      }
    }

    if (!waApiKey) {
      const { data: defaultCh } = await supabase
        .from('notification_channels')
        .select('id, name, config, is_active')
        .eq('type', 'whatsapp_wazzup24')
        .eq('is_default', true)
        .eq('is_active', true)
        .maybeSingle();

      if (defaultCh?.config) {
        waApiKey = defaultCh.config.api_key;
        waConfigChannelId = defaultCh.config.channel_id;
        waChannelId = defaultCh.id;
        waChannelName = defaultCh.name;
      } else {
        const { data: legacyWa } = await supabase
          .from('whatsapp_configuracion')
          .select('api_key, channel_id_uuid, activo')
          .eq('activo', true)
          .maybeSingle();

        if (legacyWa?.api_key) {
          waApiKey = legacyWa.api_key;
          waConfigChannelId = legacyWa.channel_id_uuid;
        }
      }
    }

    // ── Send email via Resend ─────────────────────────────────────────────────
    let emailSent = false;
    let emailError: string | null = null;

    if (resendApiKey && userEmail) {
      try {
        const resend = new Resend(resendApiKey);
        const { error: emailErr } = await resend.emails.send({
          from: `${fromName!} <${fromEmail!}>`,
          to: [userEmail],
          subject: emailSubject,
          html: finalEmailHtml,
        });
        if (emailErr) {
          console.error('Resend error:', emailErr);
          emailError = typeof emailErr === 'string' ? emailErr : JSON.stringify(emailErr);
        } else {
          emailSent = true;
        }
      } catch (emailEx: any) {
        console.error('Error sending email:', emailEx);
        emailError = emailEx?.message || 'Unknown email error';
      }
    }

    // Log email delivery
    // Note: destinatario_id / usuario_id only applies to MOVI users (in 'usuarios' table).
    // Seguwallet customers have auth_user_id but no row in 'usuarios', so we omit these FKs.
    if (userEmail) {
      await supabase.from('correo_historial_envios').insert({
        tipo_notificacion_id: typeRow?.id || null,
        tipo_notificacion_codigo: templateCode,
        tipo_codigo: templateCode,
        destinatario_email: userEmail,
        destinatario_nombre: userName,
        ...(platform === 'movi' ? { destinatario_id: userId, usuario_id: userId } : {}),
        estado: emailSent ? 'enviado' : (resendApiKey ? 'fallido' : 'fallido'),
        error_mensaje: emailError,
        canal_envio: 'email',
        proveedor: 'resend',
        channel_id: emailChannelId,
        channel_name: emailChannelName,
        channel_type: 'email_resend',
        fecha_envio: emailSent ? new Date().toISOString() : null,
      });
    }

    // ── Send WhatsApp via Wazzup ──────────────────────────────────────────────
    let whatsappSent = false;
    let whatsappError: string | null = null;

    if (userPhone && waApiKey && waConfigChannelId) {
      const normalizedPhone = normalizePhoneMX(userPhone);
      try {
        const waRes = await fetch('https://api.wazzup24.com/v3/message', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${waApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            channelId: waConfigChannelId,
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
          whatsappError = `${waRes.status}: ${waBody.slice(0, 200)}`;
        }
      } catch (waErr: any) {
        console.error('Error sending WhatsApp:', waErr);
        whatsappError = waErr?.message || 'Unknown WhatsApp error';
      }
    }

    // Log WhatsApp delivery
    if (userPhone) {
      await supabase.from('correo_historial_envios').insert({
        tipo_notificacion_id: typeRow?.id || null,
        tipo_notificacion_codigo: templateCode,
        tipo_codigo: templateCode,
        destinatario_nombre: userName,
        ...(platform === 'movi' ? { destinatario_id: userId, usuario_id: userId } : {}),
        numero_destino: userPhone,
        estado: whatsappSent ? 'enviado' : 'fallido',
        error_mensaje: whatsappError,
        canal_envio: 'whatsapp',
        proveedor: 'wazzup24',
        channel_id: waChannelId,
        channel_name: waChannelName,
        channel_type: 'whatsapp_wazzup24',
        fecha_envio: whatsappSent ? new Date().toISOString() : null,
      });
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
