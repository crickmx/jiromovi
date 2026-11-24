// node supabase/functions/_shared/correoExterno.test.mjs
import assert from 'node:assert/strict';
import {
  partirRespuestaPop, desEmpacarPuntos, parsearUidl, numerosNuevos,
  desplegarEncabezados, decodificarPalabras, parsearMensaje,
  trozarBase64, construirMensaje, codificarBase64Utf8,
  debeBorrarDelServidor, planDeConexion,
} from './correoExterno.ts';

const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');

// ── Respuestas del servidor POP3 ──────────────────────────────────────
const simple = partirRespuestaPop('+OK POP3 listo\r\n');
assert.equal(simple.ok, true);
assert.equal(simple.dato, 'POP3 listo');
assert.deepEqual(simple.lineas, []);

const multi = partirRespuestaPop('+OK\r\n1 100\r\n2 250\r\n.\r\n');
assert.equal(multi.ok, true);
assert.deepEqual(multi.lineas, ['1 100', '2 250'], 'el punto solo no es dato');

const error = partirRespuestaPop('-ERR Authentication failed.\r\n');
assert.equal(error.ok, false);
assert.equal(error.dato, 'Authentication failed.', 'sin el -ERR, listo para mostrar');

// Un punto a media línea es del mensaje; solo se deshace al principio.
assert.equal(desEmpacarPuntos('..esto era un punto\r\nnormal . punto\r\nyo..tambien'),
  '.esto era un punto\r\nnormal . punto\r\nyo..tambien');

// ── No volver a bajar lo mismo ────────────────────────────────────────
const uidl = parsearUidl(['1 AAA', '2 BBB', 'basura', '3 CCC']);
assert.deepEqual(uidl, [['1', 'AAA'], ['2', 'BBB'], ['3', 'CCC']]);
assert.deepEqual(numerosNuevos(uidl, new Set(['AAA'])), [['2', 'BBB'], ['3', 'CCC']]);
assert.deepEqual(numerosNuevos(uidl, new Set()), uidl, 'la primera vez baja todo');
assert.deepEqual(numerosNuevos(uidl, new Set(['AAA', 'BBB', 'CCC'])), [], 'la segunda, nada');

// ── Encabezados ───────────────────────────────────────────────────────
const ch = desplegarEncabezados('From: Juan <j@x.mx>\r\nSubject: Hola\r\n  mundo\r\nX-Nota: uno\r\n');
assert.equal(ch['from'], 'Juan <j@x.mx>');
assert.equal(ch['subject'], 'Hola mundo', 'una continuación con espacio pertenece al encabezado de arriba');
assert.equal(ch['x-nota'], 'uno', 'el nombre va en minúsculas para poder buscarlo');

// Palabras codificadas, partidas en dos (el espacio de en medio NO es del texto)
assert.equal(decodificarPalabras(`=?UTF-8?B?${b64('Cotización')}?= =?UTF-8?B?${b64(' de auto')}?=`), 'Cotización de auto');
// Una palabra codificada de verdad (con su envoltura) sí se decodifica…
assert.equal(decodificarPalabras('=?UTF-8?Q?=C3=A1rea?='), 'área');
// …y un `=C3=A1rea` suelto NO: eso es quoted-printable de un CUERPO, no una
// palabra codificada de encabezado. Dejarlo igual es lo correcto — confundir
// los dos casos rompería los asuntos que legítimamente traen un `=`.
assert.equal(decodificarPalabras('=C3=A1rea'), '=C3=A1rea');
assert.equal(decodificarPalabras('sin codificar'), 'sin codificar');
assert.equal(decodificarPalabras(''), '');

// ── Un mensaje de verdad ──────────────────────────────────────────────
const simpleTxt = [
  'From: "María López" <maria@proveedor.com>',
  'To: agente@jiro.mx, otro@jiro.mx',
  'Cc: copia@jiro.mx',
  'Subject: Prueba',
  'Date: Mon, 17 Nov 2026 10:00:00 -0600',
  'Message-ID: <abc123@proveedor.com>',
  'Content-Type: text/plain; charset=utf-8',
  '',
  'Hola, adjunto lo prometido.',
].join('\r\n');
const m1 = parsearMensaje(simpleTxt);
assert.equal(m1.asunto, 'Prueba');
assert.equal(m1.remitenteEmail, 'maria@proveedor.com');
assert.equal(m1.remitenteNombre, 'María López');
assert.deepEqual(m1.destinatarios, ['agente@jiro.mx', 'otro@jiro.mx']);
assert.deepEqual(m1.cc, ['copia@jiro.mx']);
assert.equal(m1.messageId, 'abc123@proveedor.com', 'sin los <> de los extremos');
assert.equal(m1.fecha, new Date('Mon, 17 Nov 2026 10:00:00 -0600').toISOString(), 'la fecha se normaliza a ISO');
assert.match(m1.texto, /adjunto lo prometido/);
assert.deepEqual(m1.adjuntos, []);

// multipart/alternative en base64: el caso más común en la vida real
const multi2 = [
  'From: x@y.mx',
  'Subject: =?UTF-8?B?' + b64('Aviso de cobro') + '?=',
  'Content-Type: multipart/alternative; boundary="ALT"',
  '',
  '--ALT',
  'Content-Type: text/plain; charset=UTF-8',
  'Content-Transfer-Encoding: base64',
  '',
  b64('Buenos días, va el aviso.'),
  '--ALT',
  'Content-Type: text/html; charset=UTF-8',
  'Content-Transfer-Encoding: base64',
  '',
  b64('<p>Buenos días, <b>va el aviso</b>.</p>'),
  '--ALT--',
].join('\r\n');
const m2 = parsearMensaje(multi2);
assert.equal(m2.asunto, 'Aviso de cobro');
assert.equal(m2.texto, 'Buenos días, va el aviso.');
assert.match(m2.html, /<b>va el aviso<\/b>/);
assert.deepEqual(m2.adjuntos, []);

// multipart/mixed con adjunto: se avisa que lo hay y NO se cuelga el cuerpo
const conAdjunto = [
  'From: x@y.mx',
  'Subject: Con archivo',
  'Content-Type: multipart/mixed; boundary="MIX"',
  '',
  '--MIX',
  'Content-Type: text/plain; charset=utf-8',
  '',
  'Va la póliza.',
  '--MIX',
  'Content-Type: application/pdf; name="poliza.pdf"',
  'Content-Disposition: attachment; filename="poliza.pdf"',
  'Content-Transfer-Encoding: base64',
  '',
  b64('x'.repeat(300)),
  '--MIX--',
].join('\r\n');
const m3 = parsearMensaje(conAdjunto);
assert.equal(m3.texto.trim(), 'Va la póliza.', 'el adjunto no se come el cuerpo');
assert.equal(m3.adjuntos.length, 1);
assert.equal(m3.adjuntos[0].nombre, 'poliza.pdf');
assert.equal(m3.adjuntos[0].tipo, 'application/pdf');
assert.ok(m3.adjuntos[0].tamano > 200 && m3.adjuntos[0].tamano <= 300, 'el tamaño del adjunto se calcula del base64');

// Solo HTML: se usa como cuerpo y se ofrece igual algo de texto plano
const soloHtml = parsearMensaje(['From: a@b.mx', 'Content-Type: text/html; charset=utf-8', '', '<p>Hola &nbsp;<b>equipo</b></p>'].join('\r\n'));
assert.match(soloHtml.html, /Hola/);
assert.equal(soloHtml.texto, '');

// Latin-1 y quoted-printable
const latin = parsearMensaje(['From: a@b.mx', 'Subject: =?ISO-8859-1?Q?C=F3digo?=', 'Content-Type: text/plain; charset=iso-8859-1', 'Content-Transfer-Encoding: quoted-printable', '', 'Mar=EDa'].join('\r\n'));
assert.equal(latin.asunto, 'Código');
assert.equal(latin.texto, 'María');

// Lo que NO puede tumbar una sincronización
assert.doesNotThrow(() => parsearMensaje(''));
assert.doesNotThrow(() => parsearMensaje('basura sin encabezados ni nada'));
const truncado = parsearMensaje(['From: a@b.mx', 'Content-Type: text/plain', 'Content-Transfer-Encoding: base64', '', 'SG9sYQ'].join('\r\n'));
assert.equal(typeof truncado.texto, 'string', 'un base64 cortado devuelve algo, no explota');

// ── Armar lo que sale ─────────────────────────────────────────────────
assert.equal(trozarBase64('abcdefghij', 4), 'abcd\r\nefgh\r\nij');
const largo = 'x'.repeat(5000);
assert.ok(!trozarBase64(codificarBase64Utf8(largo)).split('\r\n').some((l) => l.length > 76), 'ninguna línea pasa de 76');

const enviado = construirMensaje({
  de: 'agente@jiro.mx', nombreDe: 'Agente MOVI', para: ['cliente@x.mx'],
  cc: ['copia@x.mx'], asunto: 'Póliza 123', cuerpoHtml: '<p>Va la póliza</p>',
});
assert.match(enviado, /^From: "Agente MOVI" <agente@jiro\.mx>/);
assert.match(enviado, /^To: cliente@x\.mx$/m);
assert.match(enviado, /^Cc: copia@x\.mx$/m);
assert.match(enviado, /^Subject: =\?UTF-8\?B\?/m, 'el asunto va codificado para que los acentos no se rompan');
assert.equal(Buffer.from(enviado.match(/Subject: =\?UTF-8\?B\?([^?]+)\?=/)[1], 'base64').toString('utf8'), 'Póliza 123');
assert.match(enviado, /MIME-Version: 1\.0/);
// Lo que de verdad corta un envío: un renglón que sea SOLO un punto, porque
// eso termina el DATA a la mitad. Y ningún renglón puede pasar de 998.
for (const msg of [enviado, construirMensaje({ de: 'a@b.mx', nombreDe: 'A', para: ['c@d.mx'], asunto: 'X', cuerpoHtml: '.otra vez', cuerpoTexto: '.tambien' })]) {
  const lineas = msg.split('\r\n');
  assert.ok(!lineas.includes('.'), 'ningún renglón queda como un punto solo');
  assert.ok(lineas.every((l) => l.length <= 998), 'ningún renglón pasa de 998 caracteres');
}

// Con texto alternativo sale multipart; sin él, solo HTML
assert.match(construirMensaje({ de: 'a@b.mx', nombreDe: 'A', para: ['c@d.mx'], asunto: 'X', cuerpoHtml: '<p>h</p>' }), /Content-Type: text\/html/);
assert.match(construirMensaje({ de: 'a@b.mx', nombreDe: 'A', para: ['c@d.mx'], asunto: 'X', cuerpoHtml: '<p>h</p>', cuerpoTexto: 'h' }), /multipart\/alternative/);

// ── Decisiones explícitas ─────────────────────────────────────────────
// Borrar de la cuenta de alguien es irreversible: si nadie lo dijo, no se borra.
assert.equal(debeBorrarDelServidor(undefined), false);
assert.equal(debeBorrarDelServidor(null), false);
assert.equal(debeBorrarDelServidor(true), false, '"dejar copia" encendido: no se borra nada del servidor');
assert.equal(debeBorrarDelServidor(false), true, 'solo se borra del servidor si lo apagaron a propósito');

assert.deepEqual(planDeConexion('ssl', 995, 'pop'), { modo: 'tls', puerto: 995, etiqueta: 'TLS de entrada en el puerto 995' });
assert.equal(planDeConexion('starttls', 587, 'smtp').modo, 'starttls');
assert.equal(planDeConexion('ninguno', 0, 'pop').puerto, 110, 'sin cifrado va al puerto de siempre');
assert.equal(planDeConexion('ninguno', 0, 'smtp').puerto, 25);

console.log('correoExterno: OK');
