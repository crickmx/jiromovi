// Primer paso de "conectar con Google / con Microsoft".
//
// Recibe el JWT del usuario y devuelve la URL a la que hay que mandar el
// navegador. Aquí NO se guarda nada de la cuenta: primero el proveedor tiene
// que dar su consentimiento, y eso lo recibe `email-oauth-callback`.
//
// Por qué hace falta: Outlook SOLO entra por OAuth2 (Microsoft cerró la
// contraseña para las cuentas personales el 16/09/2024), y Google Workspace
// tampoco acepta ya contraseñas de aplicación.

import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { emailCorsHeaders, forbiddenOriginResponse } from '../_shared/emailCors.ts';
import { configDeProveedor, proveedorOauthDe, urlDeAutorizacion, VARIABLES_OAUTH } from '../_shared/emailOauth.ts';

function respuesta(corsHeaders: Record<string, string>, cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function base64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

async function sha256Hex(valor: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(valor));
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req: Request) => {
  const corsHeaders = emailCorsHeaders(req);
  if (!corsHeaders) return forbiddenOriginResponse();
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== 'POST') return respuesta(corsHeaders, { error: 'Método no permitido' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    const { data: { user }, error: authError } = await admin.auth.getUser(jwt);
    if (authError || !user) return respuesta(corsHeaders, { error: 'No autorizado' }, 401);

    const body = await req.json().catch(() => ({})) as {
      proveedor?: string; email?: string; configuracionId?: string; volverA?: string;
    };

    const proveedor = proveedorOauthDe(body.proveedor);
    if (!proveedor) {
      return respuesta(corsHeaders, {
        error: 'Ese proveedor no entra por OAuth. Usa correo y contraseña (o contraseña de aplicación).',
        code: 'PROVEEDOR_SIN_OAUTH',
      }, 400);
    }

    const email = String(body.email ?? '').trim().toLowerCase();
    if (!email.includes('@')) {
      return respuesta(corsHeaders, { error: 'Falta el correo de la cuenta.', code: 'EMAIL_REQUERIDO' }, 400);
    }

    const cfg = configDeProveedor(proveedor, Deno.env.toObject(), supabaseUrl);
    if (!cfg) {
      const v = VARIABLES_OAUTH[proveedor];
      // Se le dice al usuario lo justo: que falta conectar el proveedor en el
      // servidor. Los nombres de las variables son para quien lo administra y
      // van sin valores.
      return respuesta(corsHeaders, {
        error: 'Todavía no está conectado el proveedor en el servidor.',
        code: 'OAUTH_NO_CONFIGURADO',
        detalle: `Sin ${v.id}`,
      }, 409);
    }

    // Un buzón, una sola cuenta de MOVI (mismo criterio que el alta por
    // contraseña y que el índice único sobre lower(email)).
    const { data: ocupante } = await admin
      .from('email_configuraciones')
      .select('usuario_id')
      .ilike('email', email)
      .neq('usuario_id', user.id)
      .maybeSingle();
    if (ocupante) {
      return respuesta(corsHeaders, {
        error: 'Ese correo ya está configurado por otra persona en MOVI. Cada buzón puede estar en una sola cuenta.',
        code: 'EMAIL_EN_USO',
      }, 409);
    }

    // Si se está reconectando una cuenta que ya existe, tiene que ser suya.
    let configuracionId: string | null = null;
    if (body.configuracionId) {
      const { data: cuenta } = await admin
        .from('email_configuraciones')
        .select('id')
        .eq('id', body.configuracionId)
        .eq('usuario_id', user.id)
        .maybeSingle();
      if (!cuenta) return respuesta(corsHeaders, { error: 'Esa cuenta no es tuya.', code: 'CUENTA_AJENA' }, 403);
      configuracionId = cuenta.id;
    }

    // El state es de un solo uso y va y vuelve por la barra de direcciones: se
    // guarda su HASH, así que quien lea la tabla no puede reusarlo.
    const state = base64url(crypto.getRandomValues(new Uint8Array(32)));
    const expiraEn = new Date(Date.now() + 10 * 60_000).toISOString();

    // Limpieza oportunista de lo viejo; nunca es condición para seguir.
    await admin.from('email_oauth_estados')
      .delete()
      .lt('expira_en', new Date(Date.now() - 3_600_000).toISOString());

    const { error: insError } = await admin.from('email_oauth_estados').insert({
      estado_hash: await sha256Hex(state),
      usuario_id: user.id,
      configuracion_id: configuracionId,
      proveedor: body.proveedor,
      email_esperado: email,
      volver_a: body.volverA ?? null,
      expira_en: expiraEn,
    });
    if (insError) return respuesta(corsHeaders, { error: insError.message }, 500);

    return respuesta(corsHeaders, {
      url: urlDeAutorizacion(cfg, state),
      expira_en: expiraEn,
      proveedor: body.proveedor,
    });
  } catch (error) {
    console.error('email-oauth-start:', error instanceof Error ? error.message : error);
    return respuesta(corsHeaders, { error: 'No se pudo iniciar la conexión.' }, 500);
  }
});
