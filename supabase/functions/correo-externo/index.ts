// Canal de correo externo: POP3 para recibir, SMTP para enviar, cualquier
// proveedor. NO toca el canal de IONOS: tablas propias, credencial propia y
// este archivo no importa nada de `ionos-webmail`.
//
//   POST { accion: 'probar',       canalId }
//   POST { accion: 'sincronizar',  canalId, limite? }
//   POST { accion: 'enviar',       canalId, para:[], cc:[], asunto, html, texto?, inReplyTo? }
//
// Todo lleva el JWT del usuario y se comprueba que el canal sea suyo. El
// secreto sale cifrado de `correo_externo_credenciales` y nunca se devuelve.

import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { emailCorsHeaders, forbiddenOriginResponse } from '../_shared/emailCors.ts';
import {
  construirMensaje, desEmpacarPuntos, debeBorrarDelServidor, numerosNuevos,
  parsearMensaje, parsearUidl, partirRespuestaPop, planDeConexion,
} from '../_shared/correoExterno.ts';

const MASTER_KEY_ENV = 'EMAIL_CREDENTIALS_MASTER_KEY';

/** Cuántos mensajes se bajan en una corrida. Una bandeja de 20.000 no cabe en
 *  los 150 s que dura un worker: se baja por tandas y la pantalla sigue. */
const LIMITE_POR_CORRIDA = 50;
/** Más grande que esto no se baja: se cuenta y se avisa. */
const MAX_BYTES = 2 * 1024 * 1024;
/** Presupuesto de tiempo de la corrida, por debajo del límite del worker. */
const PRESUPUESTO_MS = 100_000;

function respuesta(cors: Record<string, string>, cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

// ─── POP3 ───────────────────────────────────────────────────────────

type Conexion = Deno.TlsConn | Deno.Conn;

async function abrirConexion(host: string, plan: { modo: string; puerto: number }): Promise<Conexion> {
  if (plan.modo === 'tls') return await Deno.connectTls({ hostname: host, port: plan.puerto });
  return await Deno.connect({ hostname: host, port: plan.puerto, transport: 'tcp' });
}

/** Lector con buffer: POP3 y SMTP contestan cuando les da la gana. */
class Lector {
  private buf = '';
  // Un decodificador que se acuerda de los bytes a medias: un acento puede
  // partirse entre dos lecturas, y sin `stream` saldría como basura. En
  // español eso es cada tercer correo.
  private dec = new TextDecoder();
  constructor(private conn: Conexion) {}

  async linea(): Promise<string> {
    for (;;) {
      const i = this.buf.indexOf('\n');
      if (i >= 0) {
        const l = this.buf.slice(0, i).replace(/\r$/, '');
        this.buf = this.buf.slice(i + 1);
        return l;
      }
      const chunk = await this.leer();
      if (chunk === null) return this.buf.replace(/\r$/, '');
    }
  }

  private async leer(): Promise<string | null> {
    const b = new Uint8Array(65536);
    const n = await this.conn.read(b);
    if (n === null) return null;
    const t = this.dec.decode(b.subarray(0, n), { stream: true });
    this.buf += t;
    return t;
  }

  /** Respuesta completa: termina en el punto solo cuando es de varias líneas. */
  async respuesta(multilinea: boolean): Promise<ReturnType<typeof partirRespuestaPop>> {
    const primera = await this.linea();
    if (!multilinea) return partirRespuestaPop(primera);
    const lineas: string[] = [];
    for (;;) {
      const l = await this.linea();
      if (l === '.') break;
      lineas.push(l);
      if (lineas.length > 100_000) break; // cordura
    }
    return partirRespuestaPop([primera, ...lineas, '.'].join('\r\n'));
  }
}

async function escribir(conn: Conexion, texto: string) {
  await conn.write(new TextEncoder().encode(texto));
}

async function popComando(conn: Conexion, lector: Lector, cmd: string, multilinea = false) {
  await escribir(conn, `${cmd}\r\n`);
  return await lector.respuesta(multilinea);
}

/**
 * Entra al buzón. Devuelve el lector para seguir hablando, o el error tal
 * como lo dijo el servidor: en POP3 los mensajes de -ERR ("[AUTH] Invalid
 * credentials", "Account is locked") son justo lo que hay que enseñarle a la
 * persona.
 */
async function popEntrar(
  canal: { pop_host: string; pop_port: number; pop_tls: string; pop_usuario: string | null; email: string },
  secreto: string,
): Promise<{ ok: true; conn: Conexion; lector: Lector } | { ok: false; error: string }> {
  const plan = planDeConexion(canal.pop_tls, canal.pop_port, 'pop');
  let conn: Conexion;
  try {
    conn = await abrirConexion(canal.pop_host, plan);
  } catch (e) {
    return { ok: false, error: `No se pudo conectar (${plan.etiqueta}): ${e instanceof Error ? e.message : 'error de red'}` };
  }

  let lector = new Lector(conn);
  const saludo = await lector.respuesta(false);
  if (!saludo.ok) return { ok: false, error: `El servidor no saludó: ${saludo.dato}` };

  if (plan.modo === 'starttls') {
    const stls = await popComando(conn, lector, 'STLS');
    if (!stls.ok) {
      return { ok: false, error: `El servidor no acepta cifrado STARTTLS: ${stls.dato}. Prueba con TLS de entrada (995).` };
    }
    conn = await Deno.startTls(conn as Deno.TcpConn, { hostname: canal.pop_host });
    lector = new Lector(conn);
  }

  const usuario = canal.pop_usuario || canal.email;
  const r1 = await popComando(conn, lector, `USER ${usuario}`);
  if (!r1.ok) return { ok: false, error: `El usuario fue rechazado: ${r1.dato}` };

  const r2 = await popComando(conn, lector, `PASS ${secreto}`);
  if (!r2.ok) return { ok: false, error: `La contraseña fue rechazada: ${r2.dato}` };

  return { ok: true, conn, lector };
}

// ─── SMTP ───────────────────────────────────────────────────────────

interface EnvioSmtp {
  host: string; puerto: number; tls: string; usuario: string; secreto: string;
  requiereAuth: boolean; de: string; nombreDe: string;
  para: string[]; cc: string[]; asunto: string; html: string; texto?: string; inReplyTo?: string;
}

async function smtpEnviar(datos: EnvioSmtp): Promise<{ ok: boolean; error?: string }> {
  const plan = planDeConexion(datos.tls, datos.puerto, 'smtp');
  let conn: Conexion;
  try {
    conn = await abrirConexion(datos.host, plan);
  } catch (e) {
    return { ok: false, error: `No se pudo conectar (${plan.etiqueta}): ${e instanceof Error ? e.message : 'error de red'}` };
  }

  let lector = new Lector(conn);
  const limpiar = () => { try { conn.close(); } catch { /* da igual */ } };

  const esperar = async (codigo: string): Promise<string> => {
    const l = await lector.linea();
    if (!l.startsWith(codigo)) throw new Error(`SMTP esperaba ${codigo} y dijo: ${l.slice(0, 120)}`);
    return l;
  };
  const mandar = async (cmd: string, codigo: string) => { await escribir(conn, `${cmd}\r\n`); return await esperar(codigo); };

  try {
    await esperar('220');
    let ehlo = (await mandar('EHLO movi.digital', '250')).toUpperCase();

    if (plan.modo === 'starttls') {
      await mandar('STARTTLS', '220');
      conn = await Deno.startTls(conn as Deno.TcpConn, { hostname: datos.host });
      lector = new Lector(conn);
      ehlo = (await mandar('EHLO movi.digital', '250')).toUpperCase();
    }

    if (datos.requiereAuth) {
      const auth = ehlo.includes('AUTH');
      // LOGIN es lo que entienden todos; PLAIN solo si es lo único que anuncian.
      const soloPlain = auth && /AUTH[^\n]*PLAIN/.test(ehlo) && !/AUTH[^\n]*LOGIN/.test(ehlo);
      if (soloPlain) {
        const credencial = btoa(`\0${datos.usuario}\0${datos.secreto}`);
        await mandar(`AUTH PLAIN ${credencial}`, '235');
      } else {
        await mandar('AUTH LOGIN', '334');
        await mandar(btoa(datos.usuario), '334');
        await mandar(btoa(datos.secreto), '235');
      }
    }

    await mandar(`MAIL FROM:<${datos.de}>`, '250');
    for (const r of [...datos.para, ...datos.cc]) await mandar(`RCPT TO:<${r}>`, '250');
    await mandar('DATA', '354');

    const mensaje = construirMensaje({
      de: datos.de, nombreDe: datos.nombreDe, para: datos.para, cc: datos.cc,
      asunto: datos.asunto, cuerpoHtml: datos.html, cuerpoTexto: datos.texto, inReplyTo: datos.inReplyTo,
    });
    await escribir(conn, `${mensaje}\r\n.\r\n`);
    await esperar('250');
    try { await mandar('QUIT', '221'); } catch { /* da igual */ }
    limpiar();
    return { ok: true };
  } catch (e) {
    limpiar();
    return { ok: false, error: e instanceof Error ? e.message : 'falló el envío' };
  }
}

// ─── Handler ────────────────────────────────────────────────────────

interface Canal {
  id: string; usuario_id: string; nombre: string; email: string; nombre_remitente: string | null;
  pop_host: string; pop_port: number; pop_tls: string; pop_usuario: string | null;
  smtp_host: string; smtp_port: number; smtp_tls: string; smtp_requiere_auth: boolean;
  smtp_usuario: string | null; remitente_obligatorio: string | null; dejar_copia: boolean;
}

Deno.serve(async (req: Request) => {
  const cors = emailCorsHeaders(req);
  if (!cors) return forbiddenOriginResponse();
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: cors });
  if (req.method !== 'POST') return respuesta(cors, { error: 'Método no permitido' }, 405);

  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    const { data: { user }, error: authError } = await admin.auth.getUser(jwt);
    if (authError || !user) return respuesta(cors, { error: 'No autorizado' }, 401);

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const accion = String(body.accion ?? '');
    const canalId = String(body.canalId ?? '');
    if (!canalId) return respuesta(cors, { error: 'Falta el canal.', code: 'SIN_CANAL' }, 400);

    const { data: canal } = await admin
      .from('correo_externo_canales')
      .select('*')
      .eq('id', canalId)
      .eq('usuario_id', user.id)
      .maybeSingle<Canal>();
    if (!canal) return respuesta(cors, { error: 'Ese canal no es tuyo o no existe.', code: 'CANAL_AJENO' }, 404);

    const masterKey = Deno.env.get(MASTER_KEY_ENV);
    if (!masterKey) return respuesta(cors, { error: 'Falta la llave maestra de credenciales en el servidor.' }, 500);

    const { data: secreto } = await admin.rpc('correo_externo_cred_get', {
      p_canal_id: canalId,
      p_key: masterKey,
    });
    if (!secreto) {
      return respuesta(cors, { error: 'Este canal no tiene contraseña guardada. Vuelve a capturarla.', code: 'SIN_CREDENCIAL' }, 400);
    }

    const marcarEstado = async (estado: string, error: string | null) => {
      await admin.from('correo_externo_canales')
        .update({ estado_conexion: estado, ultimo_error: error, ultima_sincronizacion: new Date().toISOString() })
        .eq('id', canalId);
    };

    // ── Probar: entra a los dos lados y NO manda nada ────────────────
    if (accion === 'probar') {
      const pop = await popEntrar(canal, secreto);
      let popResultado: { ok: boolean; error?: string; mensajes?: number };
      if (pop.ok) {
        const stat = await popComando(pop.conn, pop.lector, 'STAT');
        const cuantos = parseInt(stat.dato.split(' ')[0] ?? '0', 10);
        popResultado = { ok: true, mensajes: Number.isNaN(cuantos) ? 0 : cuantos };
        try { await popComando(pop.conn, pop.lector, 'QUIT'); } catch { /* da igual */ }
        try { pop.conn.close(); } catch { /* da igual */ }
      } else {
        popResultado = { ok: false, error: pop.error };
      }

      // Del lado de salida se hace EHLO + AUTH y se corta: mandar un correo de
      // prueba sin que nadie lo pida es correo que le llega a alguien.
      const smtpResultado = await probarSmtp(canal, secreto);

      const todoBien = popResultado.ok && smtpResultado.ok;
      await marcarEstado(todoBien ? 'conectado' : 'error',
        todoBien ? null : `Entrada: ${popResultado.error ?? 'bien'} · Salida: ${smtpResultado.error ?? 'bien'}`);

      return respuesta(cors, { entrada: popResultado, salida: smtpResultado, ok: todoBien });
    }

    // ── Sincronizar: baja lo que no tenemos ─────────────────────────
    if (accion === 'sincronizar') {
      const limite = Math.min(Number(body.limite) || LIMITE_POR_CORRIDA, LIMITE_POR_CORRIDA);
      const pop = await popEntrar(canal, secreto);
      if (!pop.ok) {
        await marcarEstado('error', pop.error);
        return respuesta(cors, { error: pop.error, code: 'ENTRADA_FALLIDA' }, 502);
      }
      const { conn, lector } = pop;

      try {
        // UIDL es lo que evita volver a bajar todo. No todos los servidores lo
        // tienen: si no está, se deduplica por el hash del mensaje al bajarlo.
        const uidlResp = await popComando(conn, lector, 'UIDL', true);
        const uidl = uidlResp.ok ? parsearUidl(uidlResp.lineas) : [];
        const usaUidl = uidl.length > 0;

        // Los tamaños se piden UNA vez (LIST) y no en cada mensaje: con 50
        // mensajes eso son 50 vueltas de red de menos.
        const listResp = await popComando(conn, lector, 'LIST', true);
        const tamanos = new Map<string, number>();
        for (const l of listResp.lineas) {
          const m = l.match(/^(\d+)\s+(\d+)/);
          if (m) tamanos.set(m[1], Number(m[2]));
        }

        let numeros: Array<[string, string]> = [];
        if (usaUidl) {
          const { data: ya } = await admin.from('correo_externo_mensajes')
            .select('uid_servidor').eq('canal_id', canalId);
          const yaSet = new Set<string>(((ya ?? []) as Array<{ uid_servidor: string }>).map((r) => r.uid_servidor));
          numeros = numerosNuevos(uidl, yaSet);
        } else {
          numeros = [...tamanos.entries()].map(([num, tam]) => [num, String(tam)] as [string, string]);
        }

        const pendientes = numeros.length;
        const aBajar = numeros.slice(0, limite);
        const arranque = Date.now();
        let bajados = 0, omitidosPorTamano = 0, conAdjuntos = 0;
        const errores: string[] = [];

        for (const [num, dato] of aBajar) {
          if (Date.now() - arranque > PRESUPUESTO_MS) break;

          const tamano = tamanos.get(num) ?? 0;
          if (tamano > MAX_BYTES) { omitidosPorTamano++; continue; }

          const retr = await popComando(conn, lector, `RETR ${num}`, true);
          if (!retr.ok) { errores.push(`#${num}: ${retr.dato}`); continue; }

          const crudo = desEmpacarPuntos(retr.lineas.join('\r\n'));
          const m = parsearMensaje(crudo);
          const uid = usaUidl ? dato : `sha:${await sha256Hex(crudo)}`;

          const { error: insError } = await admin.from('correo_externo_mensajes').insert({
            canal_id: canalId,
            usuario_id: user.id,
            uid_servidor: uid,
            message_id: m.messageId,
            remitente_nombre: m.remitenteNombre,
            remitente_email: m.remitenteEmail,
            destinatarios: m.destinatarios,
            cc: m.cc,
            asunto: m.asunto,
            fecha: m.fecha,
            cuerpo_texto: m.texto,
            cuerpo_html: m.html,
            tiene_adjuntos: m.adjuntos.length > 0,
            tamano_bytes: tamano || crudo.length,
          });
          if (insError) {
            // 23505 = ya estaba (dos corridas a la vez). No es un error de verdad.
            if (!/duplicate key|23505/.test(insError.message)) errores.push(`#${num}: ${insError.message}`);
            continue;
          }

          bajados++;
          if (m.adjuntos.length) conAdjuntos++;
          if (debeBorrarDelServidor(canal.dejar_copia)) await popComando(conn, lector, `DELE ${num}`);
        }

        await popComando(conn, lector, 'QUIT');
        try { conn.close(); } catch { /* da igual */ }

        const quedan = Math.max(0, pendientes - bajados - omitidosPorTamano);
        const aviso = omitidosPorTamano
          ? `${omitidosPorTamano} mensaje(s) se quedaron en el servidor por pesar más de 2 MB.`
          : null;
        await marcarEstado(errores.length ? 'error' : 'conectado', errores.length ? errores.slice(0, 3).join(' · ') : aviso);

        return respuesta(cors, {
          bajados, pendientes, quedan, omitidos_por_tamano: omitidosPorTamano,
          con_adjuntos: conAdjuntos, aviso, errores: errores.slice(0, 5),
        });
      } catch (e) {
        try { conn.close(); } catch { /* da igual */ }
        const msg = e instanceof Error ? e.message : 'falló la sincronización';
        await marcarEstado('error', msg);
        return respuesta(cors, { error: msg, code: 'SINCRONIZACION_FALLIDA' }, 502);
      }
    }

    // ── Enviar ──────────────────────────────────────────────────────
    if (accion === 'enviar') {
      const para = (Array.isArray(body.para) ? body.para : []).map(String).filter((d) => d.includes('@'));
      const cc = (Array.isArray(body.cc) ? body.cc : []).map(String).filter((d) => d.includes('@'));
      const asunto = String(body.asunto ?? '').trim();
      if (para.length === 0 || !asunto) {
        return respuesta(cors, { error: 'Faltan destinatarios o asunto.', code: 'ENVIO_INCOMPLETO' }, 400);
      }

      const de = canal.remitente_obligatorio || canal.email;
      const envio = await smtpEnviar({
        host: canal.smtp_host, puerto: canal.smtp_port, tls: canal.smtp_tls,
        usuario: canal.smtp_usuario || canal.email,
        secreto,
        requiereAuth: canal.smtp_requiere_auth,
        de,
        nombreDe: canal.nombre_remitente || canal.email,
        para, cc, asunto,
        html: String(body.html ?? ''),
        texto: body.texto ? String(body.texto) : undefined,
        inReplyTo: body.inReplyTo ? String(body.inReplyTo) : undefined,
      });

      if (!envio.ok) {
        await marcarEstado('error', envio.error ?? null);
        return respuesta(cors, { error: envio.error ?? 'No se pudo enviar.', code: 'ENVIO_FALLIDO' }, 502);
      }

      // Copia en el buzón: POP3 no tiene carpeta de Enviados y sin esto lo que
      // sale no quedaría en ningún lado de MOVI.
      await admin.from('correo_externo_mensajes').insert({
        canal_id: canalId,
        usuario_id: user.id,
        uid_servidor: `enviado:${crypto.randomUUID()}`,
        message_id: null,
        remitente_nombre: canal.nombre_remitente || canal.email,
        remitente_email: de,
        destinatarios: para,
        cc,
        asunto,
        fecha: new Date().toISOString(),
        cuerpo_texto: body.texto ? String(body.texto) : null,
        cuerpo_html: String(body.html ?? ''),
        tiene_adjuntos: false,
        es_enviado: true,
        leido: true,
      });

      await marcarEstado('conectado', null);
      return respuesta(cors, { enviado: true, de, para });
    }

    return respuesta(cors, { error: `Acción desconocida: ${accion}` }, 400);
  } catch (error) {
    console.error('correo-externo:', error instanceof Error ? error.message : error);
    return respuesta(cors, { error: 'Error interno del canal.' }, 500);
  }
});

/** EHLO + AUTH y se corta. No manda correo: un envío de prueba le llega a alguien. */
async function probarSmtp(canal: Canal, secreto: string): Promise<{ ok: boolean; error?: string }> {
  const plan = planDeConexion(canal.smtp_tls, canal.smtp_port, 'smtp');
  let conn: Conexion;
  try {
    conn = await abrirConexion(canal.smtp_host, plan);
  } catch (e) {
    return { ok: false, error: `No se pudo conectar (${plan.etiqueta}): ${e instanceof Error ? e.message : 'error de red'}` };
  }
  let lector = new Lector(conn);
  try {
    const saludo = await lector.linea();
    if (!saludo.startsWith('220')) return { ok: false, error: `El servidor no saludó: ${saludo.slice(0, 80)}` };

    await escribir(conn, 'EHLO movi.digital\r\n');
    let ehlo = '';
    for (;;) {
      const l = await lector.linea();
      ehlo += `${l}\n`;
      if (l.startsWith('250 ')) break;
    }

    if (plan.modo === 'starttls') {
      await escribir(conn, 'STARTTLS\r\n');
      const r = await lector.linea();
      if (!r.startsWith('220')) return { ok: false, error: `El servidor no acepta STARTTLS: ${r.slice(0, 80)}. Prueba con TLS de entrada (465).` };
      conn = await Deno.startTls(conn as Deno.TcpConn, { hostname: canal.smtp_host });
      lector = new Lector(conn);
      await escribir(conn, 'EHLO movi.digital\r\n');
      ehlo = '';
      for (;;) {
        const l = await lector.linea();
        ehlo += `${l}\n`;
        if (l.startsWith('250 ')) break;
      }
    }

    if (canal.smtp_requiere_auth) {
      const usuario = canal.smtp_usuario || canal.email;
      const soloPlain = /AUTH[^\n]*PLAIN/i.test(ehlo) && !/AUTH[^\n]*LOGIN/i.test(ehlo);
      if (soloPlain) {
        await escribir(conn, `AUTH PLAIN ${btoa(`\0${usuario}\0${secreto}`)}\r\n`);
        const r = await lector.linea();
        if (!r.startsWith('235')) return { ok: false, error: `Credenciales rechazadas: ${r.slice(0, 120)}` };
      } else {
        await escribir(conn, 'AUTH LOGIN\r\n');
        if (!(await lector.linea()).startsWith('334')) return { ok: false, error: 'El servidor no pidió usuario' };
        await escribir(conn, `${btoa(usuario)}\r\n`);
        if (!(await lector.linea()).startsWith('334')) return { ok: false, error: 'El servidor no pidió contraseña' };
        await escribir(conn, `${btoa(secreto)}\r\n`);
        const r = await lector.linea();
        if (!r.startsWith('235')) return { ok: false, error: `Credenciales rechazadas: ${r.slice(0, 120)}` };
      }
    }

    try { await escribir(conn, 'QUIT\r\n'); } catch { /* da igual */ }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'falló la prueba' };
  } finally {
    try { conn.close(); } catch { /* da igual */ }
  }
}

async function sha256Hex(valor: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(valor));
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}
