/**
 * Solicitud de emisión Auna Oncosalud (formato "Solicitud para emisión de
 * póliza de seguro de salud individual" de Dentegra): qué se captura y qué
 * falta. Puro, sin Supabase — `npx tsx src/lib/aunaOncoSolicitud.test.mjs`.
 *
 * Sexo, fecha de nacimiento, estatura, peso y el cuestionario médico de cada
 * asegurado se capturan en la cotización; aquí solo se completa lo demás.
 */
import { analizarRFC, analizarCURP } from './rfcCurp';
import { PREGUNTAS_MEDICAS, EXTRAPRIMAS, edadCumplida, parentescoDe, type Asegurado } from './aunaOncoCotizador';

export interface Domicilio {
  calle: string;
  numExt: string;
  numInt: string;
  cp: string;
  colonia: string;
  municipio: string;
  ciudad: string;
  entidad: string;
  pais: string;
}

export interface Contratante {
  tipoPersona: 'fisica' | 'moral';
  /** Nombre(s) si es física, razón social si es moral. */
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  rfc: string;
  curp: string;
  /** Nacimiento si es física, constitución si es moral. */
  fechaNacimiento: string;
  sexo: 'F' | 'M' | '';
  entidadNacimiento: string;
  paisNacimiento: string;
  nacionalidad: string;
  telefono: string;
  email: string;
  ocupacion: string;
  serieFiel: string;
  domicilio: Domicilio;
  origenRecursos: 'actividad' | 'otro';
  origenOtro: string;
  destinoRecursos: 'seguro' | 'otro';
  destinoOtro: string;
}

export interface DatosAseguradoSolicitud {
  apellidoPaterno: string;
  apellidoMaterno: string;
  nombres: string;
  parentesco: string;
  /** Pregunta 3 del cuestionario. */
  actividad: string;
  /** Pregunta 4: qué medicamento toma de forma regular. */
  medicamentos: string;
  mismoDomicilio: boolean;
  domicilio: string;
}

export interface DetalleAfirmativo {
  id: string;
  aseguradoId: string;
  pregunta: number;
  diagnostico: string;
  fecha: string;
  medicamento: string;
  cirugia: string;
  clinica: string;
}

export interface Solicitud {
  contratante: Contratante;
  /** Por id del asegurado de la cotización. */
  asegurados: Record<string, DatosAseguradoSolicitud>;
  detalles: DetalleAfirmativo[];
  medico: { nombre: string; especialidad: string; direccion: string; telefono: string; email: string };
  tercero: { actua: boolean; nombre: string; parentesco: string; actoJuridico: string };
  pep: { es: boolean; detalle: string; vinculos: boolean; sociedad: string };
  envio: 'digital' | 'impresa';
  aceptaMercadotecnia: boolean | null;
  agente: { clave: string; participacion: string };
  lugar: string;
}

/** Mismos vínculos que admite la póliza (calculadora oficial de Auna). */
export const PARENTESCOS = ['Titular', 'Cónyuge', 'Hijo/a', 'Padre/Madre'];

const domicilioVacio = (): Domicilio => ({
  calle: '', numExt: '', numInt: '', cp: '', colonia: '', municipio: '', ciudad: '', entidad: '', pais: 'México',
});

/** Parte "Nombre Apellido1 Apellido2" para prellenar; se corrige a mano. */
export function partirNombre(completo: string): { nombres: string; apellidoPaterno: string; apellidoMaterno: string } {
  const p = completo.trim().split(/\s+/).filter(Boolean);
  if (p.length <= 1) return { nombres: p[0] ?? '', apellidoPaterno: '', apellidoMaterno: '' };
  if (p.length === 2) return { nombres: p[0], apellidoPaterno: p[1], apellidoMaterno: '' };
  return { nombres: p.slice(0, -2).join(' '), apellidoPaterno: p[p.length - 2], apellidoMaterno: p[p.length - 1] };
}

export function solicitudInicial(cliente: string, asegurados: Asegurado[]): Solicitud {
  const titular = asegurados[0];
  const nombreTitular = titular?.nombre.trim() || cliente;
  // Si el cliente es el titular, sus datos personales ya están en la cotización.
  const clienteEsTitular = !titular?.nombre.trim() || titular.nombre.trim().toLowerCase() === cliente.trim().toLowerCase();
  return {
    contratante: {
      tipoPersona: 'fisica',
      ...partirNombre(cliente),
      rfc: '', curp: '',
      fechaNacimiento: clienteEsTitular ? titular?.fechaNacimiento ?? '' : '',
      sexo: clienteEsTitular ? titular?.sexo ?? '' : '',
      entidadNacimiento: '', paisNacimiento: 'México', nacionalidad: 'Mexicana',
      telefono: '', email: '', ocupacion: '', serieFiel: '',
      domicilio: domicilioVacio(),
      origenRecursos: 'actividad', origenOtro: '',
      destinoRecursos: 'seguro', destinoOtro: '',
    },
    asegurados: Object.fromEntries(asegurados.map((a, i) => [a.id, {
      ...partirNombre(i === 0 ? nombreTitular : a.nombre),
      parentesco: parentescoDe(a, i),
      actividad: '',
      medicamentos: '',
      mismoDomicilio: true,
      domicilio: '',
    }])),
    detalles: [],
    medico: { nombre: '', especialidad: '', direccion: '', telefono: '', email: '' },
    tercero: { actua: false, nombre: '', parentesco: '', actoJuridico: '' },
    pep: { es: false, detalle: '', vinculos: false, sociedad: '' },
    envio: 'digital',
    aceptaMercadotecnia: null,
    agente: { clave: 'DTJIRO', participacion: '100' },
    lugar: '',
  };
}

export function preguntasDe(a: Asegurado) {
  return PREGUNTAS_MEDICAS.filter(p => !p.sexo || p.sexo === a.sexo);
}

/** Respuestas "sí" (pregunta 4 aparte: se detalla en el propio asegurado). */
export function afirmativas(a: Asegurado) {
  return preguntasDe(a).filter(p => a.respuestas[p.id] === true && p.num !== 4);
}

/**
 * Pone al día la solicitud con la cotización actual: agrega a los asegurados
 * nuevos (los quitados se ignoran) y, si P16 dice que fuma y en la cotización
 * se eligió un nivel de tabaquismo, lo propone como diagnóstico.
 */
export function sincronizar(s: Solicitud, cliente: string, asegurados: Asegurado[]): Solicitud {
  const base = solicitudInicial(cliente, asegurados);
  const aseg = { ...s.asegurados };
  asegurados.forEach((a, i) => {
    // El parentesco lo decide la cotización: es lo que se tarifó.
    aseg[a.id] = aseg[a.id] ? { ...aseg[a.id], parentesco: parentescoDe(a, i) } : base.asegurados[a.id];
  });
  const detalles = [...s.detalles];
  for (const a of asegurados) {
    if (!a.respuestas.p16) continue;
    const tabaco = EXTRAPRIMAS.find(e => e.grupo === 'tabaco' && a.extraprimas.includes(e.id));
    if (tabaco && !detalles.some(d => d.aseguradoId === a.id && d.pregunta === 16)) {
      detalles.push({ id: `${a.id}-16`, aseguradoId: a.id, pregunta: 16, diagnostico: tabaco.label, fecha: '', medicamento: '', cirugia: '', clinica: '' });
    }
  }
  return { ...s, asegurados: aseg, detalles };
}

const vacio = (v: string | null | undefined) => !v || !v.trim();

/** Lo que falta para poder emitir la solicitud. Vacío = completa. */
export function faltantes(s: Solicitud, asegurados: Asegurado[], hoy: Date = new Date()): string[] {
  const f: string[] = [];
  const c = s.contratante;
  const fisica = c.tipoPersona === 'fisica';

  if (vacio(c.nombres)) f.push(fisica ? 'Contratante: nombre(s)' : 'Contratante: razón social');
  if (fisica && vacio(c.apellidoPaterno)) f.push('Contratante: apellido paterno');
  const rfc = analizarRFC(c.rfc);
  if (vacio(c.rfc)) f.push('Contratante: RFC');
  else if (!rfc.valido) f.push(`Contratante: RFC — ${rfc.error ?? 'formato inválido'}`);
  if (!vacio(c.curp) && !analizarCURP(c.curp).valido) f.push('Contratante: CURP con formato inválido');
  if (vacio(c.fechaNacimiento)) f.push(fisica ? 'Contratante: fecha de nacimiento' : 'Contratante: fecha de constitución');
  else if (fisica) {
    const edad = edadCumplida(c.fechaNacimiento, hoy);
    if (edad != null && edad < 18) f.push('Contratante: debe ser mayor de edad');
  }
  if (fisica && !c.sexo) f.push('Contratante: sexo');
  if (fisica && vacio(c.entidadNacimiento)) f.push('Contratante: entidad federativa de nacimiento');
  if (vacio(c.paisNacimiento)) f.push('Contratante: país de nacimiento');
  if (vacio(c.nacionalidad)) f.push('Contratante: nacionalidad');
  if (vacio(c.telefono)) f.push('Contratante: teléfono');
  if (vacio(c.email)) f.push('Contratante: correo electrónico');
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email.trim())) f.push('Contratante: correo electrónico inválido');
  if (vacio(c.ocupacion)) f.push('Contratante: ocupación o actividad');
  const d = c.domicilio;
  ([['calle', 'calle'], ['numExt', 'número exterior'], ['cp', 'código postal'], ['colonia', 'colonia'],
    ['municipio', 'municipio o alcaldía'], ['ciudad', 'ciudad'], ['entidad', 'entidad federativa'], ['pais', 'país']] as const)
    .forEach(([k, label]) => { if (vacio(d[k])) f.push(`Domicilio: ${label}`); });
  if (!vacio(d.cp) && !/^\d{5}$/.test(d.cp.trim())) f.push('Domicilio: el código postal lleva 5 dígitos');
  if (c.origenRecursos === 'otro' && vacio(c.origenOtro)) f.push('Origen de los recursos: especifica');
  if (c.destinoRecursos === 'otro' && vacio(c.destinoOtro)) f.push('Destino de los recursos: especifica');

  if (s.tercero.actua && vacio(s.tercero.nombre)) f.push('Actúa a nombre de un tercero: nombre del tercero');
  if (s.pep.es && vacio(s.pep.detalle)) f.push('Persona políticamente expuesta: puesto, fecha y parentesco');
  if (s.aceptaMercadotecnia == null) f.push('Consentimiento de datos: indica si acepta o no los fines adicionales');

  asegurados.forEach((a, i) => {
    const etiqueta = i === 0 ? 'Titular' : `Dependiente A${i}`;
    const da = s.asegurados[a.id];
    if (!da) { f.push(`${etiqueta}: faltan sus datos`); return; }
    if (vacio(da.nombres)) f.push(`${etiqueta}: nombre(s)`);
    if (vacio(da.apellidoPaterno)) f.push(`${etiqueta}: apellido paterno`);
    if (vacio(da.parentesco)) f.push(`${etiqueta}: parentesco`);
    if (!da.mismoDomicilio && vacio(da.domicilio)) f.push(`${etiqueta}: domicilio`);
    if (!a.estatura) f.push(`${etiqueta}: estatura (en la cotización)`);
    if (!a.peso) f.push(`${etiqueta}: peso (en la cotización)`);
    if (vacio(da.actividad)) f.push(`${etiqueta}: actividad profesional`);
    const sinResponder = preguntasDe(a).filter(p => a.respuestas[p.id] === undefined);
    if (sinResponder.length) f.push(`${etiqueta}: cuestionario sin responder (${sinResponder.map(p => `P${p.num}`).join(', ')})`);
    if (a.respuestas.p4 && vacio(da.medicamentos)) f.push(`${etiqueta}: cuál medicamento toma (P4)`);
    for (const p of afirmativas(a)) {
      const det = s.detalles.find(x => x.aseguradoId === a.id && x.pregunta === p.num);
      if (!det || vacio(det.diagnostico)) f.push(`${etiqueta}: detalle de la respuesta afirmativa P${p.num}`);
    }
  });

  const hayAfirmativas = asegurados.some(a => afirmativas(a).length > 0 || a.respuestas.p4);
  if (hayAfirmativas && (vacio(s.medico.nombre) || vacio(s.medico.telefono))) {
    f.push('Médico tratante: nombre y teléfono (hay respuestas afirmativas)');
  }
  if (vacio(s.lugar)) f.push('Lugar de firma');
  return f;
}
