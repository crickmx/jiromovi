// Autocomprobación de la solicitud de emisión Auna Oncosalud.
//   npx tsx src/lib/aunaOncoSolicitud.test.mjs
//
// Lo caro aquí es dejar pasar una solicitud incompleta: Dentegra la devuelve
// (o la toma como reticencia) si falta una respuesta del cuestionario.

import assert from 'node:assert/strict';
import { solicitudInicial, faltantes, partirNombre } from './aunaOncoSolicitud.ts';

assert.deepEqual(partirNombre('Ronald Edgar Tisza Huaman'), { nombres: 'Ronald Edgar', apellidoPaterno: 'Tisza', apellidoMaterno: 'Huaman' });
assert.deepEqual(partirNombre('Ana Ruiz'), { nombres: 'Ana', apellidoPaterno: 'Ruiz', apellidoMaterno: '' });

const hoy = new Date(2026, 9, 27);
const todasNo = (sexo) => Object.fromEntries(
  ['p4','p5','p6','p9','p10','p11','p12','p13','p14','p15','p16','p17', sexo === 'F' ? 'p7' : 'p8'].map(k => [k, false]));
const aseg = [
  { id: 'a', nombre: 'Ronald Edgar Tisza Huaman', sexo: 'M', fechaNacimiento: '1969-12-17', estatura: 1.75, peso: 80, respuestas: todasNo('M'), extraprimas: [] },
];
const s = solicitudInicial('Ronald Edgar Tisza Huaman', aseg);
// El cliente es el titular: hereda fecha y sexo de la cotización
assert.equal(s.contratante.fechaNacimiento, '1969-12-17');
assert.equal(s.contratante.sexo, 'M');
assert.equal(s.asegurados.a.parentesco, 'Titular');

// Recién creada le falta lo del contratante, pero no lo del cuestionario
const f0 = faltantes(s, aseg, hoy);
assert.ok(f0.includes('Contratante: RFC'));
assert.ok(!f0.some(x => x.includes('cuestionario')));

// Completa
Object.assign(s.contratante, { rfc: 'TIHR691217AB1', entidadNacimiento: 'Nuevo León', telefono: '5512345678', email: 'r@x.mx', ocupacion: 'Contador' });
Object.assign(s.contratante.domicilio, { calle: 'Reforma', numExt: '10', cp: '06600', colonia: 'Juárez', municipio: 'Cuauhtémoc', ciudad: 'CDMX', entidad: 'CDMX' });
s.asegurados.a.actividad = 'Contador';
s.aceptaMercadotecnia = false;
s.lugar = 'Ciudad de México';
const f1 = faltantes(s, aseg, hoy).filter(x => !x.startsWith('Contratante: RFC —'));
assert.deepEqual(f1, [], f1.join(' | '));

// Una pregunta sin responder bloquea
const sinP9 = [{ ...aseg[0], respuestas: { ...aseg[0].respuestas } }];
delete sinP9[0].respuestas.p9;
assert.ok(faltantes(s, sinP9, hoy).some(x => x.includes('P9')));

// Un "sí" exige detalle y médico tratante
const conSi = [{ ...aseg[0], respuestas: { ...aseg[0].respuestas, p11: true } }];
const f2 = faltantes(s, conSi, hoy);
assert.ok(f2.some(x => x.includes('afirmativa P11')));
assert.ok(f2.some(x => x.startsWith('Médico tratante')));
s.detalles.push({ id: 'd', aseguradoId: 'a', pregunta: 11, diagnostico: 'Hepatitis B', fecha: '2020', medicamento: '', cirugia: '', clinica: '' });
s.medico = { nombre: 'Dr. X', especialidad: '', direccion: '', telefono: '555', email: '' };
assert.ok(!faltantes(s, conSi, hoy).some(x => x.includes('P11') || x.startsWith('Médico')));

// P4 sí → pide el medicamento
const conP4 = [{ ...aseg[0], respuestas: { ...aseg[0].respuestas, p4: true } }];
assert.ok(faltantes(s, conP4, hoy).some(x => x.includes('(P4)')));

// Contratante menor de edad
s.contratante.fechaNacimiento = '2010-01-01';
assert.ok(faltantes(s, aseg, hoy).includes('Contratante: debe ser mayor de edad'));

console.log('✓ aunaOncoSolicitud: todo bien');
