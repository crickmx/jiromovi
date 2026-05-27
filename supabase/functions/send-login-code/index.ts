import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Charset excludes ambiguous chars: 0/O, 1/I/l
const CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;
const EXPIRES_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const RATE_LIMIT_MINUTES = 2; // min time between new code requests per email

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
  if (digits.startsWith('521')) return digits;
  if (digits.startsWith('52') && digits.length === 12) return '5' + digits;
  if (digits.startsWith('1') && digits.length === 11) return '52' + digits.slice(1);
  if (digits.length === 10) return '521' + digits;
  return digits;
}

function buildEmailHtml(platform: 'movi' | 'seguwallet', userName: string, code: string, magicLink: string): string {
  const isMovi = platform === 'movi';
  const brandName = isMovi ? 'MOVI Digital' : 'Seguwallet';
  const brandColor = isMovi ? '#0b2d6b' : '#0a1e5e';
  const accentColor = isMovi ? '#1a56db' : '#1c37e0';
  const greeting = userName ? `Hola, ${userName}` : 'Hola';

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Tu código de acceso a ${brandName}</title>
</head>
<body style="margin:0;padding:0;background:#f4f7fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fb;padding:40px 16px;">
  <tr><td align="center">
    <table width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
      <!-- Header -->
      <tr><td style="background:${brandColor};padding:28px 32px;text-align:center;">
        <div style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">${brandName}</div>
        <div style="font-size:13px;color:rgba(255,255,255,0.6);margin-top:4px;">Código de acceso seguro</div>
      </td></tr>
      <!-- Body -->
      <tr><td style="padding:36px 32px;">
        <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#111827;">${greeting}</p>
        <p style="margin:0 0 28px;font-size:14px;color:#6b7280;line-height:1.6;">
          Solicitaste acceso a <strong>${brandName}</strong>. Usa el siguiente código o el botón para ingresar.
        </p>
        <!-- Code box -->
        <div style="background:#f8faff;border:2px solid ${accentColor};border-radius:12px;padding:24px;text-align:center;margin-bottom:28px;">
          <div style="font-size:11px;font-weight:600;color:#6b7280;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:8px;">Tu código de acceso</div>
          <div style="font-size:40px;font-weight:800;color:${brandColor};letter-spacing:10px;font-family:'Courier New',monospace;">${code}</div>
          <div style="font-size:12px;color:#9ca3af;margin-top:8px;">Válido por ${EXPIRES_MINUTES} minutos · Un solo uso</div>
        </div>
        <!-- Magic link button -->
        <div style="text-align:center;margin-bottom:28px;">
          <a href="${magicLink}" style="display:inline-block;background:${accentColor};color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:10px;letter-spacing:0.02em;">
            Ingresar directamente →
          </a>
          <div style="font-size:11px;color:#9ca3af;margin-top:10px;">O copia este enlace: <span style="color:${accentColor};">${magicLink}</span></div>
        </div>
        <!-- Security notice -->
        <div style="background:#fef3c7;border-radius:8px;padding:14px 16px;">
          <p style="margin:0;font-size:12px;color:#92400e;line-height:1.5;">
            <strong>Aviso de seguridad:</strong> Si no solicitaste este acceso, ignora este mensaje. Tu cuenta permanece segura.
          </p>
        </div>
      </td></tr>
      <!-- Footer -->
      <tr><td style="border-top:1px solid #f0f0f0;padding:20px 32px;text-align:center;">
        <p style="margin:0;font-size:11px;color:#9ca3af;">© ${new Date().getFullYear()} ${brandName} · Grupo JIRO</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
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
      // Look up in usuarios table by email_laboral
      const { data: usuario } = await supabase
        .from('usuarios')
        .select('id, nombre, email_laboral, celular_laboral')
        .eq('email_laboral', identifier)
        .eq('estado', 'activo')
        .is('deleted_at', null)
        .maybeSingle();

      if (!usuario) {
        // Don't reveal if user exists — always return success-like response
        return new Response(JSON.stringify({ success: true }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      userId = usuario.id;
      userEmail = usuario.email_laboral;
      userPhone = usuario.celular_laboral;
      userName = usuario.nombre;

    } else {
      // Seguwallet: look up by email in seguwallet_customers
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

    // ── Rate limit: prevent spam (1 code per RATE_LIMIT_MINUTES per user) ─────
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

    // ── Invalidate any previous unused tokens ─────────────────────────────────
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

    // ── Build magic link ───────────────────────────────────────────────────────
    const baseUrl = platform === 'movi' ? 'https://app.movi.digital' : 'https://app.seguwallet.mx';
    const magicLink = `${baseUrl}/auth/magic?token=${magicToken}&platform=${platform}`;

    // ── Send email via Resend ─────────────────────────────────────────────────
    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (resendKey && userEmail) {
      const brandName = platform === 'movi' ? 'MOVI Digital' : 'Seguwallet';
      const fromEmail = platform === 'movi' ? 'noreply@movi.digital' : 'noreply@seguwallet.mx';
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: `${brandName} <${fromEmail}>`,
            to: [userEmail],
            subject: `Tu código de acceso: ${code}`,
            html: buildEmailHtml(platform, userName || '', code, magicLink),
          }),
        });
      } catch (emailErr) {
        console.error('Error sending email:', emailErr);
        // Don't fail the whole request if email fails
      }
    }

    // ── Send WhatsApp if phone available ──────────────────────────────────────
    if (userPhone) {
      const brandName = platform === 'movi' ? 'MOVI' : 'Seguwallet';
      const normalizedPhone = normalizePhone(userPhone);
      const whatsappMsg = `Tu código de acceso a ${brandName} es: *${code}*\n\nTambién puedes ingresar aquí:\n${magicLink}\n\n_Este acceso vence en ${EXPIRES_MINUTES} minutos._`;

      try {
        // Check if WhatsApp (Wazzup) is configured
        const { data: wazzupConfig } = await supabase
          .from('notificaciones_config')
          .select('wazzup_api_key, wazzup_channel_id')
          .eq('activo', true)
          .maybeSingle();

        if (wazzupConfig?.wazzup_api_key && wazzupConfig?.wazzup_channel_id) {
          await fetch('https://api.wazzup24.com/v3/message', {
            method: 'POST',
            headers: {
              'X-Authorization': `Bearer ${wazzupConfig.wazzup_api_key}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              channelId: wazzupConfig.wazzup_channel_id,
              chatType: 'whatsapp',
              chatId: normalizedPhone,
              text: whatsappMsg,
            }),
          });
        }
      } catch (waErr) {
        console.error('Error sending WhatsApp:', waErr);
        // Don't fail if WhatsApp fails
      }
    }

    // ── Return success (without leaking code) ────────────────────────────────
    const maskedEmail = userEmail
      ? userEmail.replace(/^(.{2})(.*)(@.*)$/, (_, a, b, c) => a + '*'.repeat(Math.max(1, b.length - 1)) + b.slice(-1) + c)
      : null;

    return new Response(JSON.stringify({
      success: true,
      email_sent: !!userEmail,
      whatsapp_sent: !!userPhone,
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
