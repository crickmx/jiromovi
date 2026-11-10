// npx tsx supabase/functions/ionos-webmail/snippet.test.mjs
import assert from 'node:assert/strict';
import { fragmentoDeCorreo, asuntoBase, imapQuoted, aTextoPlano } from './snippet.ts';

assert.equal(fragmentoDeCorreo('Hola Ricardo,\r\n\r\nTe envío la póliza.', 'text/plain; charset=utf-8', '8bit'), 'Hola Ricardo, Te envío la póliza.');
assert.equal(fragmentoDeCorreo('Hola =C3=A1rea de cobranza', 'text/plain; charset="utf-8"', 'quoted-printable'), 'Hola área de cobranza');
const b64 = Buffer.from('Cotización de auto 2024', 'utf8').toString('base64');
assert.equal(fragmentoDeCorreo(b64, 'text/plain; charset=utf-8', 'base64'), 'Cotización de auto 2024');

const multi = [
  '--XYZ', 'Content-Type: multipart/alternative; boundary="ALT"', '',
  '--ALT', 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: quoted-printable', '',
  'Buenos d=C3=ADas, adjunto la factura.', '',
  '--ALT', 'Content-Type: text/html; charset=UTF-8', '', '<p>Buenos días</p>', '--ALT--',
  '--XYZ', 'Content-Type: application/pdf', 'Content-Disposition: attachment; filename="f.pdf"', '', 'JVBERi0x',
].join('\r\n');
assert.equal(fragmentoDeCorreo(multi, 'multipart/mixed; boundary="XYZ"', ''), 'Buenos días, adjunto la factura.');

const soloHtml = ['--B', 'Content-Type: text/html; charset=utf-8', '', '<style>p{}</style><p>Hola&nbsp;<b>equipo</b></p><br>Saludos', '--B--'].join('\r\n');
assert.equal(fragmentoDeCorreo(soloHtml, 'multipart/alternative; boundary=B', ''), 'Hola equipo Saludos');

// Corte de cuerpo a medias (base64 truncado) no truena
assert.equal(typeof fragmentoDeCorreo(b64.slice(0, 7), 'text/plain', 'base64'), 'string');
assert.equal(fragmentoDeCorreo('', 'text/plain', ''), '');
assert.equal(fragmentoDeCorreo('x'.repeat(300), 'text/plain', '').length, 161);
assert.equal(fragmentoDeCorreo('Gracias. On Mon, 3 Nov 2026 Juan <j@x.com> wrote: > viejo', 'text/plain', ''), 'Gracias.');

assert.equal(asuntoBase('RE: Fwd: RV: Póliza 123'), 'Póliza 123');
assert.equal(asuntoBase('Re[2]: hola'), 'hola');
assert.equal(imapQuoted('a "b" \\ c\r\nd'), '"a \\"b\\" \\\\ c d"');
assert.equal(aTextoPlano('&aacute; &#241; &#x41;', false), 'á ñ A');
console.log('snippet: OK');

// Respuesta IMAP real de dos mensajes
import { parsearFragmentos } from './snippet.ts';
const hv = (b, n) => { const m = b.match(new RegExp(`^${n}:\\s*(.+)$`, 'mi')); return m ? m[1].trim() : null; };
const h1 = 'Content-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\n';
const t1 = 'Hola, env=C3=ADo cotizaci=C3=B3n';
const h2 = 'Content-Type: text/plain\r\n\r\n';
const t2 = 'Segundo';
const resp = `* 1 FETCH (UID 41 BODY[HEADER.FIELDS (CONTENT-TYPE CONTENT-TRANSFER-ENCODING)] {${h1.length}}\r\n${h1} BODY[TEXT]<0> {${t1.length}}\r\n${t1})\r\n`
  + `* 2 FETCH (UID 42 BODY[HEADER.FIELDS (CONTENT-TYPE CONTENT-TRANSFER-ENCODING)] {${h2.length}}\r\n${h2} BODY[TEXT]<0> {${t2.length}}\r\n${t2})\r\nA9 OK FETCH completed\r\n`;
const mp = parsearFragmentos(resp, hv);
assert.equal(mp.get(41), 'Hola, envío cotización');
assert.equal(mp.get(42), 'Segundo');
console.log('parsearFragmentos: OK');
