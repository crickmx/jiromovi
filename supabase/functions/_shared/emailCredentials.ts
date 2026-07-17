import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

type AdminClient = ReturnType<typeof createClient>;

const MASTER_KEY_ENV = 'EMAIL_CREDENTIALS_MASTER_KEY';

function getMasterKey(): string {
  const key = Deno.env.get(MASTER_KEY_ENV);
  if (!key) throw new Error(`${MASTER_KEY_ENV} no esta configurada en los secretos del proyecto`);
  return key;
}

/**
 * Devuelve la contraseña IMAP/SMTP del usuario, descifrada server-side.
 * Cae al valor legado en `email_configuraciones.password` (texto plano) solo
 * mientras existan filas creadas antes de la migración a `email_credenciales`
 * — quitar esa rama en cuanto se confirme la migración y se elimine esa columna.
 */
export async function getMailboxPassword(admin: AdminClient, usuarioId: string): Promise<string | null> {
  const masterKey = getMasterKey();
  const { data, error } = await admin.rpc('email_cred_get', { p_usuario_id: usuarioId, p_key: masterKey });
  if (!error && data) return data as string;

  try {
    const { data: legacy } = await admin
      .from('email_configuraciones')
      .select('password')
      .eq('usuario_id', usuarioId)
      .maybeSingle();
    return (legacy as { password?: string } | null)?.password ?? null;
  } catch {
    return null;
  }
}

/** Cifra y guarda la contraseña IMAP/SMTP del usuario. Nunca se persiste en texto plano. */
export async function setMailboxPassword(admin: AdminClient, usuarioId: string, plainPassword: string): Promise<void> {
  const masterKey = getMasterKey();
  const { error } = await admin.rpc('email_cred_set', {
    p_usuario_id: usuarioId,
    p_password: plainPassword,
    p_key: masterKey,
  });
  if (error) throw new Error(`No se pudo guardar la credencial cifrada: ${error.message}`);
}

/**
 * Igual que `getMailboxPassword` pero para las cuentas de correo del módulo
 * de Automatización IA (`ia_cuentas_correo`), donde la clave es el id de la
 * cuenta (no un usuario_id, porque son cuentas compartidas administradas por
 * Admins). Reutiliza la misma clave maestra (`EMAIL_CREDENTIALS_MASTER_KEY`).
 * Cae al valor legado en `ia_cuentas_correo.password_encrypted` (texto plano)
 * solo mientras existan filas creadas antes de la migración a
 * `ia_credenciales_correo` — quitar esa rama en cuanto se confirme la
 * migración y se elimine esa columna.
 */
export async function getIaMailboxPassword(admin: AdminClient, cuentaId: string): Promise<string | null> {
  const masterKey = getMasterKey();
  const { data, error } = await admin.rpc('ia_cred_get', { p_cuenta_id: cuentaId, p_key: masterKey });
  if (!error && data) return data as string;

  try {
    const { data: legacy } = await admin
      .from('ia_cuentas_correo')
      .select('password_encrypted')
      .eq('id', cuentaId)
      .maybeSingle();
    return (legacy as { password_encrypted?: string } | null)?.password_encrypted ?? null;
  } catch {
    return null;
  }
}

/** Cifra y guarda la contraseña de una cuenta de correo del módulo de Automatización IA. Nunca se persiste en texto plano. */
export async function setIaMailboxPassword(admin: AdminClient, cuentaId: string, plainPassword: string): Promise<void> {
  const masterKey = getMasterKey();
  const { error } = await admin.rpc('ia_cred_set', {
    p_cuenta_id: cuentaId,
    p_password: plainPassword,
    p_key: masterKey,
  });
  if (error) throw new Error(`No se pudo guardar la credencial cifrada: ${error.message}`);
}
