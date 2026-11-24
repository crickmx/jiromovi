// Comprobar un token OAuth contra IMAP, sin traerlo de vuelta al módulo puro.
//
// `emailOauth.ts` se queda sin Deno ni red a propósito: es el que tiene prueba
// con `node` (ver `emailOauth.test.mjs`). Lo que necesita el runtime de Deno
// vive aquí, y lo usan la edge function que conecta una cuenta y —en cuanto el
// gestor lea cuentas externas— también `ionos-webmail`.

import { saslXoauth2 } from './emailOauth.ts';

export interface ResultadoImap {
  ok: boolean;
  error?: string;
}

/**
 * ¿Este token sirve de verdad para entrar a este buzón?
 *
 * Se comprueba ANTES de guardar nada. Hay dos motivos por los que un token
 * válido no abre el buzón, y los dos se ven aquí y no tres días después
 * cuando la persona abre su bandeja:
 *   · el token se emitió sin el scope de IMAP (Google exige
 *     `https://mail.google.com/`, Microsoft `IMAP.AccessAsUser.All`), y
 *   · la cuenta tiene IMAP apagado — que es como viene Outlook personal
 *     hasta que su dueño lo prende en Ajustes → Reenvío e IMAP.
 */
export async function verificarImapXoauth2(
  host: string,
  port: number,
  usuario: string,
  accessToken: string,
): Promise<ResultadoImap> {
  let conn: Deno.TlsConn | null = null;
  try {
    conn = await Deno.connectTls({ hostname: host, port });
    const decoder = new TextDecoder();

    const leer = async (): Promise<string> => {
      const buf = new Uint8Array(16384);
      const n = await conn!.read(buf);
      return n === null ? '' : decoder.decode(buf.subarray(0, n));
    };

    const saludo = await leer();
    if (!saludo.includes('OK')) {
      return { ok: false, error: `El servidor no saludó: ${saludo.slice(0, 80)}` };
    }

    // Dos pasos, sin SASL-IR: es la forma que aceptan Google y Microsoft.
    await conn.write(new TextEncoder().encode('A1 AUTHENTICATE XOAUTH2\r\n'));
    const continuacion = await leer();
    if (!continuacion.startsWith('+')) {
      return { ok: false, error: `El servidor no pidió la credencial: ${continuacion.slice(0, 80)}` };
    }

    await conn.write(new TextEncoder().encode(saslXoauth2(usuario, accessToken) + '\r\n'));
    const respuesta = await leer();
    if (!respuesta.includes('A1 OK')) {
      // El servidor explica el motivo; se devuelve crudo y corto porque lo que
      // dice ("IMAP is disabled", "Invalid credentials") es justo lo que hay
      // que enseñarle a la persona.
      return { ok: false, error: respuesta.replace(/\s+/g, ' ').trim().slice(0, 200) };
    }

    try { await conn.write(new TextEncoder().encode('A2 LOGOUT\r\n')); } catch { /* da igual */ }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'no se pudo conectar' };
  } finally {
    try { conn?.close(); } catch { /* da igual */ }
  }
}
