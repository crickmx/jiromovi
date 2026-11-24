// Análisis de RFC y CURP para los campos del FormBuilder.
//
// Qué contiene cada uno — importa porque se confunden seguido:
//   RFC física (13): 4 letras + AAMMDD (nacimiento) + 3 homoclave
//   RFC moral  (12): 3 letras + AAMMDD (constitución) + 3 homoclave
//   CURP       (18): 4 letras + AAMMDD + sexo + entidad + 3 consonantes + 2 verif.
//
// El RFC NO lleva sexo ni entidad: esos solo salen del CURP.

export type TipoPersona = 'fisica' | 'moral';
export type Sexo = 'H' | 'M';

/** RFCs genéricos del SAT: válidos por definición, no cumplen dígito verificador. */
export const RFC_GENERICO_NACIONAL = 'XAXX010101000';
export const RFC_GENERICO_EXTRANJERO = 'XEXX010101000';

export interface AnalisisRFC {
  valido: boolean;
  /** Motivo por el que no es válido, listo para mostrar al usuario. */
  error?: string;
  /** Formato correcto pero el dígito verificador no cuadra: probable error de captura. */
  advertencia?: string;
  tipoPersona?: TipoPersona;
  /** ISO YYYY-MM-DD. Nacimiento si es física, constitución si es moral. */
  fecha?: string;
  tieneHomoclave: boolean;
  esGenerico: boolean;
}

export interface AnalisisCURP {
  valido: boolean;
  error?: string;
  fecha?: string;
  sexo?: Sexo;
  /** Clave de 2 letras, p. ej. "DF". */
  entidadClave?: string;
  entidadNombre?: string;
}

/** Entidades de registro del CURP (RENAPO). */
export const ENTIDADES_CURP: Record<string, string> = {
  AS: 'Aguascalientes', BC: 'Baja California', BS: 'Baja California Sur',
  CC: 'Campeche', CL: 'Coahuila', CM: 'Colima', CS: 'Chiapas', CH: 'Chihuahua',
  DF: 'Ciudad de México', DG: 'Durango', GT: 'Guanajuato', GR: 'Guerrero',
  HG: 'Hidalgo', JC: 'Jalisco', MC: 'Estado de México', MN: 'Michoacán',
  MS: 'Morelos', NT: 'Nayarit', NL: 'Nuevo León', OC: 'Oaxaca', PL: 'Puebla',
  QT: 'Querétaro', QR: 'Quintana Roo', SP: 'San Luis Potosí', SL: 'Sinaloa',
  SR: 'Sonora', TC: 'Tabasco', TS: 'Tamaulipas', TL: 'Tlaxcala',
  VZ: 'Veracruz', YN: 'Yucatán', ZS: 'Zacatecas', NE: 'Nacido en el extranjero',
};

/**
 * AAMMDD → ISO. El siglo se decide por el año actual: un RFC con año 30 hoy es
 * 1930, no 2030, porque nadie tramita algo con fecha futura.
 */
function fechaDesde(aa: string, mm: string, dd: string): string | null {
  const anio2 = Number(aa), mes = Number(mm), dia = Number(dd);
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  const cortePorSiglo = Number(String(new Date().getFullYear()).slice(2));
  const anio = anio2 <= cortePorSiglo ? 2000 + anio2 : 1900 + anio2;
  const d = new Date(Date.UTC(anio, mes - 1, dia));
  // Rechaza fechas que no existen (31 de febrero se desbordaría a marzo).
  if (d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return null;
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/** Tabla del SAT para el dígito verificador. */
const VALORES = '0123456789ABCDEFGHIJKLMN&OPQRSTUVWXYZ Ñ';

function digitoVerificadorOk(rfc: string): boolean {
  // Para moral (12) se antepone un espacio: el algoritmo siempre opera sobre 12
  // caracteres base más el verificador.
  const base = rfc.length === 12 ? ' ' + rfc.slice(0, 11) : rfc.slice(0, 12);
  const esperado = rfc[rfc.length - 1];
  let suma = 0;
  for (let i = 0; i < 12; i++) {
    const v = VALORES.indexOf(base[i]);
    if (v < 0) return false;
    suma += v * (13 - i);
  }
  const resto = suma % 11;
  const calculado = resto === 0 ? '0' : resto === 10 ? 'A' : String(11 - resto);
  return calculado === esperado;
}

export function analizarRFC(valor: string): AnalisisRFC {
  const rfc = (valor || '').trim().toUpperCase().replace(/[\s-]/g, '');

  if (!rfc) return { valido: false, tieneHomoclave: false, esGenerico: false };

  if (rfc === RFC_GENERICO_NACIONAL || rfc === RFC_GENERICO_EXTRANJERO) {
    return {
      valido: true, tieneHomoclave: true, esGenerico: true,
      tipoPersona: 'fisica', fecha: '2001-01-01',
    };
  }

  // Sin homoclave: 10 (física) u 11 (moral). Se reconoce para poder pedir
  // confirmación en vez de rechazarlo — hay capturas legítimas así.
  const sinHomoclave = /^[A-ZÑ&]{3,4}\d{6}$/.test(rfc);
  if (sinHomoclave) {
    const letras = rfc.length - 6;
    const fecha = fechaDesde(rfc.slice(letras, letras + 2), rfc.slice(letras + 2, letras + 4), rfc.slice(letras + 4, letras + 6));
    if (!fecha) return { valido: false, error: 'La fecha dentro del RFC no existe.', tieneHomoclave: false, esGenerico: false };
    return {
      valido: true, tieneHomoclave: false, esGenerico: false,
      tipoPersona: letras === 4 ? 'fisica' : 'moral', fecha,
    };
  }

  const fisica = /^[A-ZÑ&]{4}\d{6}[A-Z\d]{3}$/.test(rfc);
  const moral = /^[A-ZÑ&]{3}\d{6}[A-Z\d]{3}$/.test(rfc);
  if (!fisica && !moral) {
    return {
      valido: false, tieneHomoclave: false, esGenerico: false,
      error: rfc.length < 12
        ? 'El RFC está incompleto: debe tener 12 (moral) o 13 (física) caracteres.'
        : 'El RFC no tiene el formato correcto: letras, luego 6 dígitos de fecha, luego la homoclave.',
    };
  }

  const letras = fisica ? 4 : 3;
  const fecha = fechaDesde(rfc.slice(letras, letras + 2), rfc.slice(letras + 2, letras + 4), rfc.slice(letras + 4, letras + 6));
  if (!fecha) {
    return { valido: false, error: 'La fecha dentro del RFC no existe.', tieneHomoclave: true, esGenerico: false };
  }

  return {
    valido: true,
    tieneHomoclave: true,
    esGenerico: false,
    tipoPersona: fisica ? 'fisica' : 'moral',
    fecha,
    // Advertencia y no error: hay RFCs antiguos en circulación que no cuadran,
    // y rechazarlos de tajo bloquearía capturas legítimas.
    advertencia: digitoVerificadorOk(rfc) ? undefined : 'El dígito verificador no coincide. Revisa que esté bien capturado.',
  };
}

export function analizarCURP(valor: string): AnalisisCURP {
  const curp = (valor || '').trim().toUpperCase().replace(/[\s-]/g, '');
  if (!curp) return { valido: false };

  if (!/^[A-ZÑ]{4}\d{6}[HM][A-Z]{2}[B-DF-HJ-NP-TV-ZÑ]{3}[A-Z\d]\d$/.test(curp)) {
    return {
      valido: false,
      error: curp.length !== 18
        ? 'El CURP debe tener 18 caracteres.'
        : 'El CURP no tiene el formato correcto.',
    };
  }

  const fecha = fechaDesde(curp.slice(4, 6), curp.slice(6, 8), curp.slice(8, 10));
  if (!fecha) return { valido: false, error: 'La fecha dentro del CURP no existe.' };

  const entidadClave = curp.slice(11, 13);
  const entidadNombre = ENTIDADES_CURP[entidadClave];
  if (!entidadNombre) return { valido: false, error: `La entidad "${entidadClave}" del CURP no existe.` };

  return { valido: true, fecha, sexo: curp[10] as Sexo, entidadClave, entidadNombre };
}

/** Datos que un RFC o CURP puede aportar, para mapearlos a otros campos. */
export const DATOS_EXTRAIBLES = {
  rfc: [
    { clave: 'tipo_persona', label: 'Tipo de persona (física/moral)' },
    { clave: 'fecha',        label: 'Fecha de nacimiento o constitución' },
  ],
  curp: [
    { clave: 'fecha',    label: 'Fecha de nacimiento' },
    { clave: 'sexo',     label: 'Sexo' },
    { clave: 'entidad',  label: 'Entidad de registro' },
  ],
  codigo_postal: [
    { clave: 'colonia',   label: 'Colonia' },
    { clave: 'municipio', label: 'Municipio' },
    { clave: 'estado',    label: 'Estado' },
  ],
} as const;
