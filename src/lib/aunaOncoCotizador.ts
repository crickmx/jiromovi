/**
 * Precio de referencia Auna Oncosalud PLUS 2026 (Auna Seguros, S.A.).
 *
 * Reglas, textos legales y desglose alineados con la calculadora oficial de
 * Auna (preciosreferencia-oncosalud.netlify.app, 28/10) y con sus PDF del
 * Sistema de Emisión: es un PRECIO DE REFERENCIA, no una cotización oficial.
 *
 * Fuente: "Agentes Tradicionales 2026 - Tarifas sistema individual.xlsx"
 * (prima neta anual por persona, por quinquenio y sexo) y la cotización de
 * ejemplo de Auna para el desglose: recargo por pago fraccionado de 9.5%,
 * derechos e IVA. El Excel de tarifas trae una columna mensual con ~8.5%;
 * Ricardo decidió usar el 9.5% de la cotización real (27/10).
 *
 * Todo es puro, sin Supabase, para poder comprobarlo con
 * `npx tsx src/lib/aunaOncoCotizador.test.mjs`.
 */

export type Sexo = 'F' | 'M';
export type FormaPago = 'anual' | 'mensual';
/** Los únicos vínculos que la póliza permite asegurar como dependientes. */
export type Parentesco = 'Titular' | 'Cónyuge' | 'Hijo/a' | 'Padre/Madre';
export const PARENTESCOS_DEPENDIENTE: Parentesco[] = ['Cónyuge', 'Hijo/a', 'Padre/Madre'];
/** Hasta 5 dependientes por póliza (6 asegurados en total). */
export const MAX_DEPENDIENTES = 5;
/** Hijos/as: máximo 24 años 11 meses; si lo superan, se cotizan en póliza aparte. */
export const EDAD_MAXIMA_HIJO = 24;
export const REGIONES = ['CDMX', 'Monterrey', 'Guadalajara', 'Querétaro', 'Puebla', 'Otra'];
export const PRODUCTO = 'Oncosalud PLUS';
/** Clave de agente/promotor que va en los PDF y la solicitud (Ricardo, 28/10). */
export const CLAVE_AGENTE = 'DTJIRO';

/** Edad máxima de aceptación: 70 años 11 meses → edad cumplida 70. */
export const EDAD_MAXIMA = 70;
/** Derechos de póliza: $250 + IVA. */
export const DERECHOS_POLIZA = 250;
export const IVA = 0.16;
/** Recargo por pago fraccionado (mensual), sobre la prima neta con descuento. */
export const RECARGO_MENSUAL = 0.095;
export const LIMITE_ANUAL = 9_500_000;
export const VIGENCIA_TARIFAS = '31 de diciembre de 2026';

interface Quinquenio {
  etiqueta: string;
  desde: number;
  hasta: number;
  /** [Mujer, Hombre] */
  anual: [number, number];
}

// Prima neta anual por persona.
const TARIFAS: Quinquenio[] = [
  { etiqueta: '0-4',   desde: 0,  hasta: 4,  anual: [1120.55, 821.60] },
  { etiqueta: '5-9',   desde: 5,  hasta: 9,  anual: [2139.33, 1568.55] },
  { etiqueta: '10-14', desde: 10, hasta: 14, anual: [3955.87, 2900.47] },
  { etiqueta: '15-19', desde: 15, hasta: 19, anual: [5306.37, 3890.67] },
  { etiqueta: '20-24', desde: 20, hasta: 24, anual: [7505.00, 5502.69] },
  { etiqueta: '25-29', desde: 25, hasta: 29, anual: [8995.69, 6595.69] },
  { etiqueta: '30-34', desde: 30, hasta: 34, anual: [11584.20, 8493.61] },
  { etiqueta: '35-39', desde: 35, hasta: 39, anual: [13356.92, 9793.36] },
  { etiqueta: '40-44', desde: 40, hasta: 44, anual: [16171.86, 11857.29] },
  { etiqueta: '45-49', desde: 45, hasta: 49, anual: [18158.02, 13313.54] },
  { etiqueta: '50-54', desde: 50, hasta: 54, anual: [21315.67, 15628.78] },
  { etiqueta: '55-59', desde: 55, hasta: 59, anual: [23550.87, 17267.62] },
  { etiqueta: '60-64', desde: 60, hasta: 64, anual: [27123.22, 19886.90] },
  { etiqueta: '65-69', desde: 65, hasta: 69, anual: [29669.02, 21753.49] },
  { etiqueta: '70',    desde: 70, hasta: 70, anual: [33771.76, 24761.62] },
];

// ── Extraprimas ──────────────────────────────────────────────────────────────
// Matriz "TOP 10 extraprimas" de Auna. Son las más frecuentes, no las únicas:
// la extraprima definitiva la fija la suscripción médica.

export interface Extraprima {
  id: string;
  label: string;
  pct: number;
  /** Las de un mismo grupo se excluyen entre sí (solo un nivel de tabaquismo). */
  grupo?: string;
  sexo?: Sexo;
}

export const EXTRAPRIMAS: Extraprima[] = [
  { id: 'tab_leve',      label: 'Tabaquismo leve (1 o 2 cigarros al día)',      pct: 0.20, grupo: 'tabaco' },
  { id: 'tab_moderado',  label: 'Tabaquismo moderado (3 a 10 cigarros al día)', pct: 0.30, grupo: 'tabaco' },
  { id: 'tab_intenso',   label: 'Tabaquismo intenso (11 o más cigarros al día)', pct: 0.50, grupo: 'tabaco' },
  { id: 'exfumador',     label: 'Exfumador reciente (menos de 12 meses)',       pct: 0.15, grupo: 'tabaco' },
  { id: 'obesidad_3',    label: 'Obesidad grado III',                           pct: 0.30 },
  { id: 'lupus',         label: 'Lupus',                                        pct: 0.30 },
  { id: 'hepatitis',     label: 'Hepatitis B y C',                              pct: 0.50 },
  { id: 'pancreatitis',  label: 'Pancreatitis',                                 pct: 0.30 },
  { id: 'menopausia_th', label: 'Menopausia con terapia hormonal de sustitución', pct: 0.20, sexo: 'F' },
  { id: 'cervicitis',    label: 'Cervicitis - endocervicitis',                  pct: 0.30, sexo: 'F' },
];

// ── Cuestionario médico (solicitud Dentegra, preguntas 4 a 17) ───────────────

export interface PreguntaMedica {
  id: string;
  num: number;
  texto: string;
  sexo?: Sexo;
  /** Un "sí" aquí no tiene extraprima de tabla: lo decide suscripción. */
  requiereSuscripcion?: boolean;
}

export const PREGUNTAS_MEDICAS: PreguntaMedica[] = [
  { id: 'p4',  num: 4,  texto: '¿Toma o ingiere algún medicamento de forma regular?' },
  { id: 'p5',  num: 5,  texto: '¿Tiene, ha tenido o está siendo estudiado por cáncer o alguna enfermedad oncológica?', requiereSuscripcion: true },
  { id: 'p6',  num: 6,  texto: '¿Se ha realizado o tiene pendiente la realización o resultados de biopsia o anatomía patológica de alguna endoscopia, colonoscopia, mamografía, ecografía de mamas o cirugía?', requiereSuscripcion: true },
  { id: 'p7',  num: 7,  texto: '¿Le han realizado alguna mamografía o ecografía de mamas en la que le hayan indicado realizarse una biopsia?', sexo: 'F', requiereSuscripcion: true },
  { id: 'p8',  num: 8,  texto: '¿Está en tratamiento por alguna enfermedad o molestia de la próstata?', sexo: 'M', requiereSuscripcion: true },
  { id: 'p9',  num: 9,  texto: '¿Tiene, ha tenido o está siendo estudiado por alguna enfermedad de la sangre o los ganglios? (leucemia, linfomas, policitemia vera, etc.)', requiereSuscripcion: true },
  { id: 'p10', num: 10, texto: '¿Ha sido diagnosticado o recibe atención o tratamiento de tumores benignos o malignos? (cáncer, leucemia, linfomas, Hodgkin, melanomas, carcinomas, sarcomas, tumores neuroendocrinos, etc.)', requiereSuscripcion: true },
  { id: 'p11', num: 11, texto: '¿Tiene, ha tenido o está siendo estudiado por cirrosis, hepatitis crónica, hepatitis C, hemocromatosis o insuficiencia hepática?', requiereSuscripcion: true },
  { id: 'p12', num: 12, texto: '¿Está siendo estudiado o tiene diagnóstico de SIDA o es seropositivo al VIH?', requiereSuscripcion: true },
  { id: 'p13', num: 13, texto: '¿Tiene, ha tenido o está siendo estudiado por insuficiencia renal o respiratoria, EPOC, esófago de Barrett, pólipos de colon-recto o virus del papiloma?', requiereSuscripcion: true },
  { id: 'p14', num: 14, texto: '¿Tiene alguna condición de salud que aún no tenga diagnóstico definitivo?', requiereSuscripcion: true },
  { id: 'p15', num: 15, texto: '¿Tiene diagnóstico o está siendo estudiado por síndrome de Lynch?', requiereSuscripcion: true },
  { id: 'p16', num: 16, texto: '¿Fuma o ha fumado, en forma habitual o recurrente, en algún momento de su vida?' },
  { id: 'p17', num: 17, texto: '¿Ha sido rechazada su afiliación a alguna aseguradora, o tiene o ha tenido cobertura restringida o parcial en otra?', requiereSuscripcion: true },
];

// ── Cálculo ──────────────────────────────────────────────────────────────────

export interface Asegurado {
  id: string;
  nombre: string;
  /** Las cotizaciones guardadas antes del 28/10 no lo traen: se infiere por posición. */
  parentesco?: Parentesco;
  sexo: Sexo;
  /** yyyy-mm-dd */
  fechaNacimiento: string;
  estatura?: number | null; // metros
  peso?: number | null;     // kg
  respuestas: Record<string, boolean>;
  extraprimas: string[];
}

export function edadCumplida(fechaNacimiento: string, alDia: Date): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fechaNacimiento);
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  let edad = alDia.getFullYear() - y;
  const mesHoy = alDia.getMonth() + 1;
  if (mesHoy < mo || (mesHoy === mo && alDia.getDate() < d)) edad--;
  return edad;
}

export function quinquenioDe(edad: number): Quinquenio | null {
  return TARIFAS.find(q => edad >= q.desde && edad <= q.hasta) ?? null;
}

export function imc(estatura?: number | null, peso?: number | null): number | null {
  if (!estatura || !peso || estatura <= 0) return null;
  return peso / (estatura * estatura);
}

/** IMC ≥ 40 es obesidad grado III (la única que está en la matriz). */
export function sugiereObesidadIII(a: Pick<Asegurado, 'estatura' | 'peso'>): boolean {
  const v = imc(a.estatura, a.peso);
  return v != null && v >= 40;
}

export function pctExtraprima(ids: string[]): number {
  return ids.reduce((s, id) => s + (EXTRAPRIMAS.find(e => e.id === id)?.pct ?? 0), 0);
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** El primero siempre es el titular; un dependiente sin parentesco guardado se toma como cónyuge. */
export function parentescoDe(a: Pick<Asegurado, 'parentesco'>, indice: number): Parentesco {
  if (indice === 0) return 'Titular';
  return a.parentesco && a.parentesco !== 'Titular' ? a.parentesco : 'Cónyuge';
}

export interface LineaAsegurado {
  id: string;
  nombre: string;
  parentesco: Parentesco;
  sexo: Sexo;
  fechaNacimiento: string;
  edad: number | null;
  quinquenio: string | null;
  primaBase: number;
  extraprimaPct: number;
  extraprima: number;
  primaNeta: number;
  /** Prima + 9.5% de ese asegurado cuando el pago es mensual (igual a primaNeta en anual). */
  primaConRecargo: number;
  error?: string;
  requiereSuscripcion: boolean;
  alertas: string[];
}

export interface ResultadoCotizacion {
  formaPago: FormaPago;
  lineas: LineaAsegurado[];
  primaNetaTotal: number;
  extraprimaTotal: number;
  descuentoPct: number;
  descuento: number;
  recargoFraccionado: number;
  derechos: number;
  subtotal: number;
  iva: number;
  primaTotal: number;
  primerRecibo: number;
  reciboSubsecuente: number | null;
  numRecibos: number;
  valido: boolean;
  requiereSuscripcion: boolean;
}

export function cotizar(
  asegurados: Asegurado[],
  formaPago: FormaPago,
  descuentoPct: number,
  alDia: Date = new Date(),
): ResultadoCotizacion {
  const lineas: LineaAsegurado[] = asegurados.map((a, i) => {
    const parentesco = parentescoDe(a, i);
    const edad = edadCumplida(a.fechaNacimiento, alDia);
    const alertas: string[] = [];
    let error: string | undefined;
    const q = edad == null ? null : quinquenioDe(edad);
    if (edad == null) error = 'Falta la fecha de nacimiento';
    else if (edad < 0) error = 'Fecha de nacimiento futura';
    else if (edad > EDAD_MAXIMA) error = `Edad ${edad}: la edad máxima de aceptación es 70 años 11 meses`;
    else if (parentesco === 'Hijo/a' && edad > EDAD_MAXIMA_HIJO) {
      error = `Edad ${edad}: los hijos/as se aseguran hasta los 24 años 11 meses. Cotízalo en una póliza aparte.`;
    }

    const idx = a.sexo === 'F' ? 0 : 1;
    const base = q && !error ? q.anual[idx] : 0;
    const extraPct = pctExtraprima(a.extraprimas);
    const extra = r2(base * extraPct);

    const siRespondidas = PREGUNTAS_MEDICAS.filter(p => a.respuestas[p.id] && (!p.sexo || p.sexo === a.sexo));
    const requiereSuscripcion = siRespondidas.some(p => p.requiereSuscripcion);
    if (requiereSuscripcion) {
      alertas.push(`Respondió "sí" en ${siRespondidas.filter(p => p.requiereSuscripcion).map(p => `P${p.num}`).join(', ')}: sujeto a valoración de suscripción médica`);
    }
    const fumaSinNivel = a.respuestas.p16 && !a.extraprimas.some(id => EXTRAPRIMAS.find(e => e.id === id)?.grupo === 'tabaco');
    if (fumaSinNivel) alertas.push('Declaró que fuma o fumó: indica el nivel de tabaquismo para aplicar la extraprima');
    if (sugiereObesidadIII(a) && !a.extraprimas.includes('obesidad_3')) {
      alertas.push(`IMC ${imc(a.estatura, a.peso)!.toFixed(1)}: corresponde a obesidad grado III`);
    }

    return {
      id: a.id,
      nombre: a.nombre,
      parentesco,
      sexo: a.sexo,
      fechaNacimiento: a.fechaNacimiento,
      edad,
      quinquenio: q?.etiqueta ?? null,
      primaBase: base,
      extraprimaPct: extraPct,
      extraprima: extra,
      primaNeta: r2(base + extra),
      primaConRecargo: r2((base + extra) * (formaPago === 'mensual' ? 1 + RECARGO_MENSUAL : 1)),
      error,
      requiereSuscripcion,
      alertas,
    };
  });

  const d = Math.min(Math.max(descuentoPct || 0, 0), 100) / 100;
  const primaNetaTotal = r2(lineas.reduce((s, l) => s + l.primaNeta, 0));
  const extraprimaTotal = r2(lineas.reduce((s, l) => s + l.extraprima, 0));
  const descuento = r2(primaNetaTotal * d);
  const recargoFraccionado = formaPago === 'mensual' ? r2((primaNetaTotal - descuento) * RECARGO_MENSUAL) : 0;
  const derechos = lineas.length ? DERECHOS_POLIZA : 0;
  const subtotal = r2(primaNetaTotal - descuento + recargoFraccionado + derechos);
  const iva = r2(subtotal * IVA);
  const primaTotal = r2(subtotal + iva);

  // Los derechos (con su IVA) se cobran completos en el primer recibo.
  const derechosConIva = r2(derechos * (1 + IVA));
  let primerRecibo = primaTotal;
  let reciboSubsecuente: number | null = null;
  const numRecibos = formaPago === 'mensual' ? 12 : 1;
  if (formaPago === 'mensual') {
    reciboSubsecuente = r2((primaTotal - derechosConIva) / 12);
    primerRecibo = r2(primaTotal - reciboSubsecuente * 11);
  }

  return {
    formaPago,
    lineas,
    primaNetaTotal,
    extraprimaTotal,
    descuentoPct: d * 100,
    descuento,
    recargoFraccionado,
    derechos,
    subtotal,
    iva,
    primaTotal,
    primerRecibo,
    reciboSubsecuente,
    numRecibos,
    valido: lineas.length > 0 && lineas.length <= MAX_DEPENDIENTES + 1
      && lineas.every(l => !l.error && l.nombre.trim() !== ''),
    requiereSuscripcion: lineas.some(l => l.requiereSuscripcion),
  };
}

export const AVISO_IMPORTANTE =
  'Los precios y condiciones presentados en este documento son una estimación preliminar basada en la información inicial proporcionada por el cliente. Debido a que la emisión de la póliza está sujeta a un proceso de suscripción médica y evaluación de riesgo, el precio final y las condiciones de cobertura pueden ser ajustados o modificados según los resultados del historial médico, informes clínicos o requisitos adicionales solicitados por la compañía aseguradora.';

// ── Textos de Auna para el precio de referencia (calculadora oficial, 28/10) ──

export const AVISO_NO_OFICIAL =
  'Precio de referencia — no es una cotización oficial. La cotización oficial se emite en el Sistema de Emisión Auna.';

export const AVISO_REFERENCIA =
  'Precio de Referencia: los precios emitidos son exclusivamente referenciales y no constituyen una cotización oficial, oferta vinculante ni póliza de seguro, quedando la emisión de un precio definitivo sujeto a los procesos de suscripción establecidos por Auna Seguros.';

export const NOTAS_REFERENCIA = [
  'Este documento contiene una referencia de precio y no constituye una cotización oficial, oferta vinculante, aceptación del riesgo, ni póliza de seguro, quedando la emisión de un precio definitivo sujeto a los procesos de suscripción médica y administrativa establecidos por Auna Seguros.',
  'Para contratar, el solicitante debe ser mayor de edad y completar la solicitud del seguro y el cuestionario médico que forma parte del proceso de suscripción.',
  'El producto está sujeto a un Periodo de carencia: 180 días desde el inicio de vigencia de la póliza para hacer uso de todas las coberturas.',
];

export const AVISO_PRIVACIDAD =
  'Auna Seguros, S.A., con domicilio en Av. Insurgentes Sur 1458, pisos 19 y 20, Colonia Actipan, Alcaldía Benito Juárez, C.P. 03230, Ciudad de México, utilizó los datos personales exclusivamente para generar el precio de referencia solicitado. Para más información acerca del tratamiento y de los derechos que puede hacer valer, Usted puede acceder al aviso de privacidad integral en https://www.aunaseguros.com.mx/';

/** "Información a considerar para realizar el cálculo (leerlo antes de compartir)". */
export const INFO_CALCULO = [
  'Recargo por pago mensual: 9.5%, aplicado sobre la prima base de cada asegurado (titular y dependientes), no sobre el total consolidado.',
  'Derechos de emisión: $250.00 MXN + IVA (= $290.00), fijos por póliza y se cobran una sola vez, sin importar el número de asegurados ni la forma de pago.',
  'IVA 16% aplicado sobre (prima neta total + recargo, si es mensual) y, por separado, sobre los derechos de emisión.',
  'Anual: el primer recibo es un pago de contado por la prima total completa; no hay recibos subsecuentes en el mismo periodo de vigencia.',
  'Mensual: el total con IVA (sin derechos) se divide entre 12 para obtener el recibo subsecuente; el primer recibo es ese mismo monto más los derechos de emisión con IVA ($290.00).',
  'Límite anual por asegurado: $9,500,000.00 MXN, deducible $0 y copago 0% en Red Cerrada.',
  'La edad se calcula a la fecha del ejercicio y se agrupa en quinquenios (0-4, 5-9 …) igual que la tarifa base. Edad máxima de aceptación: 70 años 11 meses.',
  'Hasta 5 dependientes por póliza (6 asegurados en total). Solo se cubre cónyuge, padres/madres e hijos/as; los hijos/as deben tener máximo 24 años 11 meses, si la superan se cotizan en una póliza aparte.',
  'Este resultado es un precio de referencia, no una cotización oficial. La cotización oficial y vinculante se emite en el Sistema de Emisión Auna.',
];
