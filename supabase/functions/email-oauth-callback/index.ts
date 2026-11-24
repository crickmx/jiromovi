// Segundo paso de "conectar con Google / con Microsoft": a dónde vuelve el
// navegador después de que la persona aceptó.
//
// NO lleva JWT: el proveedor redirige el navegador aquí y no hay sesión de
// MOVI en esa petición. Lo que la protege es el `state`: es de un solo uso,
// vive 10 minutos y en la tabla está su hash, no su valor. Sin el state no se
// canjea nada.
//
// Al terminar, redirige a la aplicación con el resultado en la barra de
// direcciones — nunca devuelve tokens al navegador.

import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { blobDesdeTokens, configDeProveedor, cuerpoDelIntercambio, proveedorOauthDe, tokensDeRespuesta } from '../_shared/emailOauth.ts';
import { verificarImapXoauth2 } from '../_shared/imapXOauth2.ts';
import { setMailboxPasswordDeCuenta, setMailboxTipoDeCuenta } from '../_shared/emailCredentials.ts';

async function sha256Hex(valor: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(valor));
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** A dónde volver. Solo a orígenes permitidos: no se redirige a donde diga el state. */
function destinoPermitido(volverA: string | null): string {
  const permitidos = (Deno.env.get('MOVI_ALLOWED_ORIGINS') ?? '')
    .split(',').map((v: string) => v.trim()).filter(Boolean);
  const porDefecto = permitidos[0] ?? '';
  if (!volverA) return porDefecto;
  try {
    const u = new URL(volverA);
    return permitidos.includes(u.origin) ? `${u.origin}${u.pathname}` : porDefecto;
  } catch {
    return porDefecto;
  }
}

function volver(destino: string, params: Record<string, string>): Response {
  const u = new URL(destino || 'https://app.movi.digital/');
  u.searchParams.set('correo', params.resultado);
  for (const [k, v] of Object.entries(params)) {
    if (k !== 'resultado') u.searchParams.set(k, v.slice(0, 300));
  }
  return new Response(null, { status: 302, headers: { Location: u.toString(), 'Cache-Control': 'no-store' } });
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const q = url.searchParams;
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let destino = destinoPermitido(null);

  try {
    // El proveedor puede contestar con un error en vez de un código (la
    // persona canceló, o el administrador no autorizó la aplicación).
    const errorProveedor = q.get('error');
    if (errorProveedor) {
      return volver(destinoPermitido(null), {
        resultado: 'cancelado',
        motivo: 'PROVEEDOR_RECHAZO',
        detalle: q.get('error_description') ?? errorProveedor,
      });
    }

    const code = q.get('code') ?? '';
    const state = q.get('state') ?? '';
    if (!code || !state) {
      return volver(destino, { resultado: 'error', motivo: 'SIN_CODIGO', detalle: 'El proveedor no devolvió un código.' });
    }

    const { data: fila } = await admin
      .from('email_oauth_estados')
      .select('*')
      .eq('estado_hash', await sha256Hex(state))
      .maybeSingle();

    if (!fila) {
      return volver(destino, { resultado: 'error', motivo: 'STATE_INVALIDO', detalle: 'Ese intento de conexión no es nuestro o ya se usó.' });
    }
    destino = destinoPermitido(fila.volver_a);

    if (fila.usado_en) {
      return volver(destino, { resultado: 'error', motivo: 'STATE_USADO', detalle: 'Ese intento de conexión ya se había usado.' });
    }
    if (new Date(fila.expira_en).getTime() < Date.now()) {
      return volver(destino, { resultado: 'error', motivo: 'STATE_VENCIDO', detalle: 'Tardaste más de 10 minutos en autorizar. Inténtalo otra vez.' });
    }

    // Se marca como usado ANTES de canjear: si algo falla después, ese state ya
    // no sirve y hay que empezar de nuevo (que es lo correcto).
    const { data: marcado } = await admin
      .from('email_oauth_estados')
      .update({ usado_en: new Date().toISOString() })
      .eq('estado_hash', fila.estado_hash)
      .is('usado_en', null)
      .select('estado_hash');
    if (!marcado?.length) {
      return volver(destino, { resultado: 'error', motivo: 'STATE_USADO', detalle: 'Ese intento de conexión ya se había usado.' });
    }

    const proveedor = proveedorOauthDe(fila.proveedor);
    if (!proveedor) {
      return volver(destino, { resultado: 'error', motivo: 'PROVEEDOR_DESCONOCIDO', detalle: fila.proveedor });
    }
    const cfg = configDeProveedor(proveedor, Deno.env.toObject(), Deno.env.get('SUPABASE_URL')!);
    if (!cfg) {
      return volver(destino, { resultado: 'error', motivo: 'OAUTH_NO_CONFIGURADO', detalle: 'Falta configurar el cliente OAuth en el servidor.' });
    }

    // ── Canje del código ─────────────────────────────────────────────
    const resp = await fetch(cfg.token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: cuerpoDelIntercambio(cfg, code),
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      console.error('canje falló:', JSON.stringify(json).slice(0, 400));
      const detalle = String(json.error_description ?? json.error ?? `HTTP ${resp.status}`);
      return volver(destino, { resultado: 'error', motivo: 'CANJE_FALLIDO', detalle });
    }

    let tokens;
    try {
      tokens = tokensDeRespuesta(json);
    } catch (e) {
      return volver(destino, { resultado: 'error', motivo: 'SIN_REFRESH', detalle: e instanceof Error ? e.message : 'respuesta incompleta' });
    }

    const email = fila.email_esperado;

    // ── La cuenta: la que ya existía, o una nueva ────────────────────
    let configuracionId: string | null = fila.configuracion_id;
    let recienCreada = false;

    if (!configuracionId) {
      const { data: preset } = await admin
        .from('email_proveedores_preset')
        .select('imap_host, imap_port, smtp_host, smtp_port')
        .eq('proveedor', fila.proveedor)
        .maybeSingle();

      if (!preset?.imap_host || !preset?.smtp_host) {
        return volver(destino, { resultado: 'error', motivo: 'SIN_PRESET', detalle: 'No hay servidor configurado para ese proveedor.' });
      }

      // Se vuelve a comprobar el "un buzón, una cuenta": entre el primer paso
      // y este pudo alguien más configurarlo.
      const { data: ocupante } = await admin
        .from('email_configuraciones')
        .select('usuario_id')
        .ilike('email', email)
        .neq('usuario_id', fila.usuario_id)
        .maybeSingle();
      if (ocupante) {
        return volver(destino, { resultado: 'error', motivo: 'EMAIL_EN_USO', detalle: 'Ese correo ya está configurado por otra persona en MOVI.' });
      }

      const { count: yaTiene } = await admin
        .from('email_configuraciones')
        .select('id', { count: 'exact', head: true })
        .eq('usuario_id', fila.usuario_id);
      const esPrimera = (yaTiene ?? 0) === 0;

      const { data: nueva, error: insError } = await admin
        .from('email_configuraciones')
        .insert({
          usuario_id: fila.usuario_id,
          email,
          proveedor: fila.proveedor,
          imap_host: preset.imap_host,
          imap_port: preset.imap_port,
          smtp_host: preset.smtp_host,
          smtp_port: preset.smtp_port,
          use_tls: true,
          activa: true,
          // La primera cuenta de alguien es la principal: es la que usan los
          // avisos y los trámites, que no saben de varias cuentas.
          es_principal: esPrimera,
        })
        .select('id')
        .single();
      if (insError || !nueva) {
        return volver(destino, { resultado: 'error', motivo: 'CUENTA_NO_CREADA', detalle: insError?.message ?? 'sin respuesta' });
      }
      configuracionId = nueva.id;
      recienCreada = true;
    }

    // ── ¿El token abre el buzón de verdad? ───────────────────────────
    if (!configuracionId) {
      return volver(destino, { resultado: 'error', motivo: 'CUENTA_NO_CREADA', detalle: 'No se pudo identificar la cuenta.' });
    }
    const cuentaId: string = configuracionId;

    const { data: cuenta } = await admin
      .from('email_configuraciones')
      .select('id, imap_host, imap_port')
      .eq('id', cuentaId)
      .single();

    const prueba = await verificarImapXoauth2(
      cuenta?.imap_host ?? '',
      cuenta?.imap_port ?? 993,
      email,
      tokens.access_token,
    );

    if (!prueba.ok) {
      // No se guarda un token que no sirve: es mejor que la pantalla diga por
      // qué ahora, con el mensaje del servidor, que una cuenta que "está" y no
      // abre nada.
      if (recienCreada) await admin.from('email_configuraciones').delete().eq('id', cuentaId);
      console.error('IMAP rechazó el token:', prueba.error);
      const esImapApagado = /disabled|not enabled|IMAP/i.test(prueba.error ?? '');
      return volver(destino, {
        resultado: 'error',
        motivo: 'IMAP_FALLIDO',
        detalle: esImapApagado
          ? 'Tu cuenta no tiene IMAP encendido. Actívalo en los ajustes del correo y vuelve a intentarlo.'
          : (prueba.error ?? 'No se pudo entrar al buzón con la autorización que diste.'),
      });
    }

    // ── Guardar (cifrado) ────────────────────────────────────────────
    await setMailboxPasswordDeCuenta(admin, cuentaId, blobDesdeTokens(tokens));
    await setMailboxTipoDeCuenta(admin, cuentaId, 'oauth');
    await admin
      .from('email_configuraciones')
      .update({ estado_conexion: 'conectado', ultima_sincronizacion: new Date().toISOString() })
      .eq('id', cuentaId);

    return volver(destino, { resultado: 'conectado', cuenta: cuentaId, correo_dir: email });
  } catch (error) {
    console.error('email-oauth-callback:', error instanceof Error ? error.message : error);
    return volver(destino, { resultado: 'error', motivo: 'INESPERADO', detalle: 'No se pudo terminar la conexión.' });
  }
});
