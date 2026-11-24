/**
 * Utilidades de parsing para GMM Bx+
 * Normalizan valores de Excel que pueden venir en diferentes formatos
 */

/**
 * Convierte un porcentaje en varios formatos a número decimal
 * @param value - "10%", "10 %", 10, 0.10
 * @returns 0.10 (como número decimal)
 */
export function parsePercentToDecimal(value: any): number {
  if (value === null || value === undefined) {
    return 0;
  }

  // Si ya es un número
  if (typeof value === 'number') {
    // Si es menor a 1, asumimos que ya es decimal (0.10)
    if (value < 1) {
      return value;
    }
    // Si es mayor o igual a 1, asumimos que es porcentaje entero (10)
    return value / 100;
  }

  // Si es string
  if (typeof value === 'string') {
    // Limpiar espacios y símbolo de porcentaje
    const cleaned = value.trim().replace('%', '').trim();
    const num = parseFloat(cleaned);

    if (isNaN(num)) {
      console.warn(`parsePercentToDecimal: no se pudo parsear "${value}"`);
      return 0;
    }

    // Si es menor a 1, ya es decimal
    if (num < 1) {
      return num;
    }
    // Si es mayor o igual a 1, es porcentaje entero
    return num / 100;
  }

  console.warn(`parsePercentToDecimal: tipo inesperado ${typeof value}:`, value);
  return 0;
}

/**
 * Convierte un porcentaje en varios formatos a string normalizado
 * @param value - "10%", "10 %", 10, 0.10
 * @returns "10%" (como string)
 */
export function parsePercentToString(value: any): string {
  if (value === null || value === undefined) {
    return '0%';
  }

  // Si ya es string con %, limpiarlo y devolverlo
  if (typeof value === 'string' && value.includes('%')) {
    const cleaned = value.trim().replace('%', '').trim();
    const num = parseFloat(cleaned);
    return isNaN(num) ? '0%' : `${num}%`;
  }

  // Si es número
  if (typeof value === 'number') {
    // Si es menor a 1, es decimal (0.10 → "10%")
    if (value < 1) {
      return `${(value * 100).toFixed(0)}%`;
    }
    // Si es mayor o igual a 1, ya es porcentaje entero (10 → "10%")
    return `${value.toFixed(0)}%`;
  }

  // Si es string sin %
  if (typeof value === 'string') {
    const num = parseFloat(value.trim());
    if (isNaN(num)) {
      console.warn(`parsePercentToString: no se pudo parsear "${value}"`);
      return '0%';
    }
    // Si es menor a 1, es decimal
    if (num < 1) {
      return `${(num * 100).toFixed(0)}%`;
    }
    return `${num.toFixed(0)}%`;
  }

  console.warn(`parsePercentToString: tipo inesperado ${typeof value}:`, value);
  return '0%';
}

/**
 * Convierte dinero en varios formatos a número
 * @param value - "$40,000", "40000", 40000, "$40,000.00"
 * @returns 40000 (como número)
 */
export function parseMoney(value: any): number {
  if (value === null || value === undefined) {
    return 0;
  }

  // Si ya es número
  if (typeof value === 'number') {
    return value;
  }

  // Si es string
  if (typeof value === 'string') {
    // Limpiar $ , espacios
    const cleaned = value
      .trim()
      .replace(/\$/g, '')
      .replace(/,/g, '')
      .replace(/\s/g, '');

    const num = parseFloat(cleaned);

    if (isNaN(num)) {
      console.warn(`parseMoney: no se pudo parsear "${value}"`);
      return 0;
    }

    return num;
  }

  console.warn(`parseMoney: tipo inesperado ${typeof value}:`, value);
  return 0;
}

/**
 * Formatea dinero para mostrar en UI
 * @param value - número o NaN
 * @returns "$40,000" o "—" si es NaN/null
 */
export function formatMoneySafe(value: any): string {
  const num = typeof value === 'string' ? parseMoney(value) : value;

  if (num === null || num === undefined || isNaN(num)) {
    console.warn('formatMoneySafe: valor NaN o null, mostrando "—"');
    return '—';
  }

  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

/**
 * Normaliza un valor de coaseguro para usarlo como key en lookups
 * Siempre devuelve en formato "10%"
 */
export function normalizeCoaseguroKey(coaseguro: any): string {
  return parsePercentToString(coaseguro);
}

/**
 * Compara dos valores de coaseguro ignorando formato
 */
export function coasegurosMatch(a: any, b: any): boolean {
  const aStr = parsePercentToString(a);
  const bStr = parsePercentToString(b);
  return aStr === bStr;
}

/**
 * Valida y normaliza datos de tope_coaseguro de Excel
 * Limpia los valores y los convierte a números
 */
export function normalizeTopsCoaseguroTable(data: any[]): any[] {
  if (!Array.isArray(data)) {
    console.error('normalizeTopsCoaseguroTable: data no es un array');
    return [];
  }

  return data.map(row => {
    // Normalizar el coaseguro (col_0) a formato "10%"
    const coaseguro = normalizeCoaseguroKey(row.col_0);

    // Parsear tope contratado/inferior (col_1)
    const topeInferior = parseMoney(row.col_1);

    // Parsear tope superior (col_2) si existe
    const topeSuperior = row.col_2 ? parseMoney(row.col_2) : null;

    return {
      col_0: coaseguro,
      col_1: topeInferior,
      col_2: topeSuperior,
      // Mantener valores originales para debug
      _original: {
        col_0: row.col_0,
        col_1: row.col_1,
        col_2: row.col_2
      }
    };
  });
}

/**
 * Parsea la tabla de rangos de tope de coaseguro desde Excel
 * Formato esperado: coaseguro | tope_min | tope_max
 *
 * CRÍTICO: Valida que tope_min < tope_max y rechaza Excel si no cumple
 */
export function parseTopeCoaseguroRangos(data: any[]): any[] {
  if (!Array.isArray(data) || data.length === 0) {
    console.warn('parseTopeCoaseguroRangos: data vacía o inválida');
    return [];
  }

  const rangos = [];

  for (const row of data) {
    // Normalizar coaseguro a formato "10%"
    const coaseguro = normalizeCoaseguroKey(row.coaseguro || row.col_0);

    // Parsear tope_min (limpiando $, comas, espacios)
    const topeMin = parseMoney(row.tope_min || row.col_1);

    // Parsear tope_max
    const topeMax = parseMoney(row.tope_max || row.col_2);

    // VALIDACIÓN CRÍTICA: tope_min debe ser < tope_max
    if (topeMin >= topeMax) {
      throw new Error(
        `EXCEL INVÁLIDO: Para coaseguro "${coaseguro}", tope_min (${topeMin}) debe ser menor que tope_max (${topeMax})`
      );
    }

    // Validar que los valores sean números válidos
    if (isNaN(topeMin) || isNaN(topeMax) || topeMin <= 0 || topeMax <= 0) {
      throw new Error(
        `EXCEL INVÁLIDO: Para coaseguro "${coaseguro}", tope_min y tope_max deben ser números positivos válidos`
      );
    }

    rangos.push({
      coaseguro,
      tope_min: topeMin,
      tope_max: topeMax,
      tope_default: topeMin, // Por defecto usar el mínimo
    });
  }

  return rangos;
}
