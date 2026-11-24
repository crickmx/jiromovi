// Autocomprobación de la lógica del módulo de correo.
//   npx tsx src/lib/correo/correo.test.mjs
import assert from 'node:assert/strict';
import { resolverIdentidades, etiquetaIdentidad } from './identidadRemitente.ts';
import { correosDelHilo, asuntoBaseCliente } from './hiloCorreo.ts';
import { planearReglas, cumpleRegla } from './reglasCorreo.ts';
import { motivosSospecha, tieneImagenesExternas, cspCorreo } from './seguridadCorreo.ts';
import { parsearContactos } from './importarContactos.ts';
import { aplicarFiltros, resaltar, fechaRelativa, hayFiltros, FILTROS_VACIOS } from './filtrosCorreo.ts';

// ── Identificación del remitente ─────────────────────────────────────────
// Mismo criterio que analyze-email-for-tramite: email_laboral o email_personal, sin mayúsculas.
const usuarios = [
  { id: 'u1', nombre_completo: 'MATEO PRUEBAS', rol: 'Agente', puesto: 'Asesor', email_laboral: 'Mateo@Jiro.mx', email_personal: null, oficina: { nombre: 'Oficina Centro' } },
  { id: 'u2', nombre_completo: 'LAURA PRUEBAS', rol: 'Gerente', email_laboral: 'laura@jiro.mx', email_personal: 'laura@gmail.com' },
];
const crm = [{ id: 'c1', nombre_completo: 'Cliente Uno', email: 'cliente@empresa.com', tipo_contacto: 'Cliente' }, { id: 'c2', nombre_completo: 'Pisa', email: 'laura@gmail.com' }];
const contactos = [{ id: 'k1', nombre: 'Proveedor', apellido: 'X', email: 'prov@x.com', empresa: 'X SA' }];
const ids = resolverIdentidades(['mateo@jiro.mx', 'LAURA@gmail.com', 'cliente@empresa.com', 'prov@x.com', 'nadie@x.com'], usuarios, crm, contactos, { puedeVerFichaUsuario: false });
assert.equal(ids.get('mateo@jiro.mx').tipo, 'usuario');
assert.equal(ids.get('mateo@jiro.mx').empresa, 'Oficina Centro');
assert.equal(ids.get('mateo@jiro.mx').enlace, null, 'sin permiso no hay enlace a la ficha');
assert.equal(etiquetaIdentidad(ids.get('mateo@jiro.mx')), 'Agente');
assert.equal(ids.get('laura@gmail.com').tipo, 'usuario', 'usuario de MOVI gana al CRM');
assert.equal(etiquetaIdentidad(ids.get('laura@gmail.com')), 'MOVI');
assert.equal(ids.get('cliente@empresa.com').enlace, '/contactos/c1');
assert.equal(ids.get('prov@x.com').tipo, 'contacto');
assert.equal(ids.has('nadie@x.com'), false, 'sin identificar → no hay entrada, sin error');
assert.equal(etiquetaIdentidad(undefined), null);
assert.equal(resolverIdentidades(['mateo@jiro.mx'], usuarios, [], [], { puedeVerFichaUsuario: true }).get('mateo@jiro.mx').enlace, '/directorio/u1');

// ── Hilos ────────────────────────────────────────────────────────────────
assert.equal(asuntoBaseCliente('RE: Fwd: Póliza 1'), 'póliza 1');
const actual = { uid: 3, messageId: '<c@x>', inReplyTo: '<b@x>', references: '<a@x> <b@x>', subject: 'Re: Póliza', fromEmail: 'cli@x.com', to: ['yo@jiro.mx'], date: '2026-11-03' };
const cand = [
  { uid: 1, folder: 'INBOX', messageId: '<a@x>', subject: 'Póliza', fromEmail: 'cli@x.com', to: ['yo@jiro.mx'], date: '2026-11-01' },
  { uid: 9, folder: 'Sent', messageId: '<b@x>', inReplyTo: '<a@x>', subject: 'Re: Póliza', fromEmail: 'yo@jiro.mx', to: ['cli@x.com'], date: '2026-11-02' },
  { uid: 3, folder: 'INBOX', messageId: '<c@x>', subject: 'Re: Póliza', fromEmail: 'cli@x.com', to: [], date: '2026-11-03' },
  { uid: 7, folder: 'INBOX', messageId: '<z@x>', subject: 'Póliza', fromEmail: 'otro@y.com', to: ['otra@y.com'], date: '2026-11-02' },
  { uid: 8, folder: 'INBOX', messageId: '<d@x>', references: '<c@x>', subject: 'Re: Póliza', fromEmail: 'cli@x.com', to: [], date: '2026-11-04' },
];
assert.deepEqual(correosDelHilo(actual, cand).map(c => c.uid), [1, 9, 8], 'hilo por referencias, sin el propio ni ajenos');

// ── Reglas ───────────────────────────────────────────────────────────────
const r = (o) => ({ id: 'r', nombre: 'r', campo: 'remitente', operador: 'contiene', valor: '', accion: 'marcar_leido', carpeta_destino: null, activa: true, orden: 0, ...o });
const correos = [
  { uid: 1, from: 'Boletín GNP', fromEmail: 'news@gnp.com.mx', subject: 'Novedades', seen: false },
  { uid: 2, from: 'Cliente', fromEmail: 'c@x.com', subject: 'Cotización urgente', seen: false },
  { uid: 3, from: 'Boletín', fromEmail: 'news@gnp.com.mx', subject: 'Otra', seen: true },
];
const plan = planearReglas([
  r({ id: 'a', valor: 'gnp.com.mx', accion: 'mover', carpeta_destino: 'Boletines', orden: 1 }),
  r({ id: 'b', campo: 'asunto', valor: 'cotizacion', orden: 2 }),
  r({ id: 'c', valor: 'news@', orden: 0, activa: false }),
], correos, 'INBOX');
assert.deepEqual(plan.map(p => [p.uid, p.regla.id]), [[1, 'a'], [2, 'b'], [3, 'a']]);
assert.equal(planearReglas([r({ valor: 'x', accion: 'mover', carpeta_destino: 'INBOX' })], correos, 'INBOX').length, 0, 'no mueve a la misma carpeta');
assert.equal(cumpleRegla(r({ operador: 'es', valor: 'C@X.COM' }), correos[1]), true);
assert.equal(cumpleRegla(r({ operador: 'empieza', campo: 'asunto', valor: 'cotiz' }), correos[1]), true);

// ── Seguridad ────────────────────────────────────────────────────────────
assert.deepEqual(motivosSospecha('Mateo', 'mateo@jiro.mx'), []);
assert.deepEqual(motivosSospecha('Banco', 'avisos@bbva.mx'), []);
assert.ok(motivosSospecha('GNP', 'pagos@gnp.com.mz').length > 0 || motivosSospecha('GNP', 'pagos@gpn.com.mx').length > 0);
assert.ok(motivosSospecha('Soporte', 'a@movi.digitall').some(m => m.includes('se parece')));
assert.ok(motivosSospecha('ricardo@jiro.mx', 'x@otro.com').some(m => m.includes('muestra')));
assert.ok(motivosSospecha('Equipo JIRO', 'aviso@gmail.com').some(m => m.includes('MOVI o JIRO')));
assert.ok(motivosSospecha('X', 'a@xn--jro-bpa.mx').length > 0);
assert.deepEqual(motivosSospecha('Cliente', 'cliente@empresa.com'), []);
assert.equal(tieneImagenesExternas('<img src="https://t.co/p.gif">'), true);
assert.equal(tieneImagenesExternas('<div style="background:url(\'//cdn/x.png\')">'), true);
assert.equal(tieneImagenesExternas('<img src="data:image/png;base64,AAA">'), false);
assert.match(cspCorreo(false), /img-src data: blob: cid:;/);
assert.match(cspCorreo(true), /img-src \*/);

// ── Importar contactos ───────────────────────────────────────────────────
const csv = 'Nombre;Apellidos;Correo electrónico;Teléfono;Empresa\nJosé;Pérez;JOSE@x.com;555;ACME\nSin;Correo;;1;\n"Ana, Ma";López;ana@y.mx;;\nJosé;Dup;jose@x.com;;';
assert.deepEqual(parsearContactos('a.csv', csv), [
  { nombre: 'José', apellido: 'Pérez', email: 'jose@x.com', telefono: '555', empresa: 'ACME' },
  { nombre: 'Ana, Ma', apellido: 'López', email: 'ana@y.mx', telefono: null, empresa: null },
]);
const gcsv = 'Name,E-mail 1 - Value,Phone 1 - Value,Organization 1 - Name\nLuis Gómez Ruiz,luis@z.com,+52 55,Z SA';
assert.deepEqual(parsearContactos('google.csv', gcsv), [{ nombre: 'Luis', apellido: 'Gómez Ruiz', email: 'luis@z.com', telefono: '+52 55', empresa: 'Z SA' }]);
const vcf = 'BEGIN:VCARD\r\nVERSION:3.0\r\nN:Ruiz;Marta;;;\r\nFN:Marta Ruiz\r\nEMAIL;TYPE=INTERNET:marta@q.com\r\nTEL;TYPE=CELL:5512\r\nORG:Q;Ventas\r\nEND:VCARD\r\nBEGIN:VCARD\r\nFN:Sin correo\r\nEND:VCARD';
assert.deepEqual(parsearContactos('c.vcf', vcf), [{ nombre: 'Marta', apellido: 'Ruiz', email: 'marta@q.com', telefono: '5512', empresa: 'Q' }]);
assert.deepEqual(parsearContactos('x.csv', 'solo,cabecera'), []);

// ── Filtros y resaltado ──────────────────────────────────────────────────
const ahora = new Date('2026-11-10T12:00:00');
const lista = [
  { id: 1, seen: false, hasAttachments: true, date: '2026-11-10T09:00:00', from: 'Ana', fromEmail: 'ana@x.com' },
  { id: 2, seen: true, hasAttachments: false, date: '2026-11-05T09:00:00', from: 'Luis', fromEmail: 'luis@y.com' },
  { id: 3, seen: true, hasAttachments: true, date: '2026-09-01T09:00:00', from: 'Ana', fromEmail: 'ana@x.com' },
];
const f = (o) => aplicarFiltros(lista, { ...FILTROS_VACIOS, ...o }, ahora).map(m => m.id);
assert.deepEqual(f({}), [1, 2, 3]);
assert.deepEqual(f({ noLeidos: true }), [1]);
assert.deepEqual(f({ conAdjuntos: true }), [1, 3]);
assert.deepEqual(f({ fecha: 'hoy' }), [1]);
assert.deepEqual(f({ fecha: '7d' }), [1, 2]);
assert.deepEqual(f({ remitente: 'ANA' }), [1, 3]);
assert.equal(hayFiltros(FILTROS_VACIOS), false);
assert.deepEqual(resaltar('Cotización de póliza', 'poliza'), [{ t: 'Cotización de ', hit: false }, { t: 'póliza', hit: true }]);
assert.deepEqual(resaltar('aXa aXa', 'axa').filter(p => p.hit).length, 2);
assert.deepEqual(resaltar('hola', ''), [{ t: 'hola', hit: false }]);
assert.equal(fechaRelativa('2026-11-10T11:30:00', ahora), 'Hace 30 min');
assert.equal(fechaRelativa('2026-11-09T11:30:00', ahora), 'Ayer');
assert.equal(fechaRelativa('nada', ahora), 'nada');
console.log('correo: OK');
