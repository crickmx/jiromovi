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
