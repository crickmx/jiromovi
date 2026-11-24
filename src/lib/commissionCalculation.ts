/**
 * Módulo centralizado para cálculo de comisiones
 * REGLA ÚNICA: Comisión = Importe × (PorPart / 100)
 *
 * Este módulo es la ÚNICA fuente de verdad para:
 * - Parsing de números desde Excel
 * - Cálculo de comisiones
 * - Validación de datos
 *
 * NUNCA usar prima_neta como base de comisión
 */

/**
 * Parsing robusto de números desde Excel (formato mexicano)
 * Soporta:
 * - Strings con $, comas, espacios: "$1,234.56" → 1234.56
 * - Negativos: "-$1,234.56" → -1234.56
 * - Decimales: "90.909" → 90.909
 * - Porcentajes: "25%" → 25
 * - Ya números: 1234.56 → 1234.56
 */
export function parseNumberMx(value: any): number {
  if (typeof value === 'number') {
    return isFinite(value) ? value : 0;
  }

  if (value === null || value === undefined || value === '') {
    return 0;
  }

  let str = String(value).trim();

  // Si es porcentaje, remover %
  const isPercentage = str.endsWith('%');
  if (isPercentage) {
    str = str.slice(0, -1).trim();
  }

  // Remover $, espacios, comas
  str = str.replace(/[$\s,]/g, '');

  // Parsear
  const num = parseFloat(str);

  if (!isFinite(num)) {
    return 0;
  }

  return num;
}

/**
 * Redondeo a 2 decimales (para montos monetarios)
 */
export function round2(value: number): number {
  if (!isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

/**
 * FUNCIÓN ÚNICA Y CENTRALIZADA DE CÁLCULO DE COMISIÓN
 *
 * Esta es la ÚNICA fórmula válida para calcular comisiones.
 * Se aplica a TODOS los ramos sin excepción.
 *
 * @param importe_base - Base de comisión (columna Importe del Excel)
 * @param porcentaje - Porcentaje de comisión (columna PorPart del Excel)
 * @returns Comisión calculada redondeada a 2 decimales
 *
 * @example
 * // Vehículos: Importe $392.91, PorPart 100%
 * calculateCommission(392.91, 100) // → 392.91
 *
 * @example
 * // A&E: Importe $7,062.48, PorPart 100%
 * calculateCommission(7062.48, 100) // → 7062.48
 *
 * @example
 * // Vida: Importe $6,178.43, PorPart 100%
 * calculateCommission(6178.43, 100) // → 6178.43
 *
 * @example
 * // PorPart decimal: Importe $970.79, PorPart 90.909%
 * calculateCommission(970.79, 90.909) // → 882.62
 */
export function calculateCommission(importe_base: number, porcentaje: number): number {
  // Validar inputs
  if (!isFinite(importe_base) || !isFinite(porcentaje)) {
    return 0;
  }

  // Si cualquiera es 0, la comisión es 0
  if (importe_base === 0 || porcentaje === 0) {
    return 0;
  }

  // Fórmula única: Comisión = Importe × (PorPart / 100)
  const comision = importe_base * (porcentaje / 100);

  return round2(comision);
}

/**
 * Validar que los campos obligatorios existan y sean válidos
 */
export interface ValidationResult {
  valid: boolean;
  warnings: Array<{
    code: string;
    message: string;
    field?: string;
    value?: any;
  }>;
  canCalculateCommission: boolean;
}

export function validateCommissionData(data: {
  importe?: any;
  porcentaje?: any;
  prima_neta?: any;
  poliza?: string;
  ramo?: string;
}): ValidationResult {
  const warnings: ValidationResult['warnings'] = [];
  let canCalculateCommission = true;

  // Parsear valores
  const importe = parseNumberMx(data.importe);
  const porcentaje = parseNumberMx(data.porcentaje);
  const prima_neta = parseNumberMx(data.prima_neta);

  // Validar Importe (OBLIGATORIO para calcular comisión)
  if (!data.importe || importe === 0) {
    warnings.push({
      code: 'MISSING_IMPORTE',
      message: 'Columna Importe faltante o en 0. No se puede calcular comisión.',
      field: 'importe',
      value: data.importe
    });
    canCalculateCommission = false;
  }

  // Validar PorPart (OBLIGATORIO para calcular comisión)
  if (!data.porcentaje || porcentaje === 0) {
    warnings.push({
      code: 'MISSING_PORCENTAJE',
      message: 'Columna PorPart faltante o en 0. No se puede calcular comisión.',
      field: 'porcentaje',
      value: data.porcentaje
    });
    canCalculateCommission = false;
  }

  // ADVERTENCIA CRÍTICA: Si Importe == PrimaNeta (posible bug)
  if (importe > 0 && prima_neta > 0 && Math.abs(importe - prima_neta) < 0.01) {
    warnings.push({
      code: 'IMPORTE_EQUALS_PRIMA',
      message: `ADVERTENCIA: Importe (${importe}) es igual a PrimaNeta (${prima_neta}). Verificar que sean columnas diferentes.`,
      field: 'importe'
    });
  }

  // Info: PrimaNeta es solo informativa
  if (!data.prima_neta) {
    warnings.push({
      code: 'INFO_NO_PRIMA',
      message: 'PrimaNeta no proporcionada (solo informativo, no afecta cálculo).',
      field: 'prima_neta'
    });
  }

  return {
    valid: warnings.length === 0,
    warnings,
    canCalculateCommission
  };
}

/**
 * Calcular comisión con validación completa
 * Retorna el resultado del cálculo más información de validación
 */
export interface CommissionCalculationResult {
  commission: number;
  importe_base: number;
  porcentaje: number;
  prima_neta_info: number;
  validation: ValidationResult;
  calculation_method: 'standard' | 'zero_by_missing_data';
  calculation_details: string;
}

export function calculateCommissionWithValidation(data: {
  importe?: any;
  porcentaje?: any;
  prima_neta?: any;
  poliza?: string;
  ramo?: string;
}): CommissionCalculationResult {
  // Parsear todos los valores
  const importe_base = parseNumberMx(data.importe);
  const porcentaje = parseNumberMx(data.porcentaje);
  const prima_neta_info = parseNumberMx(data.prima_neta);

  // Validar
  const validation = validateCommissionData(data);

  // Calcular comisión
  let commission = 0;
  let calculation_method: CommissionCalculationResult['calculation_method'] = 'standard';
  let calculation_details = '';

  if (validation.canCalculateCommission) {
    commission = calculateCommission(importe_base, porcentaje);
    calculation_method = 'standard';
    calculation_details = `Comisión = ${importe_base} × (${porcentaje} / 100) = ${commission}`;
  } else {
    commission = 0;
    calculation_method = 'zero_by_missing_data';
    calculation_details = 'Comisión = 0 (datos faltantes: ' +
      validation.warnings.map(w => w.field).filter(Boolean).join(', ') + ')';
  }

  return {
    commission,
    importe_base,
    porcentaje,
    prima_neta_info,
    validation,
    calculation_method,
    calculation_details
  };
}

/**
 * Tests unitarios inline (para verificación rápida)
 */
export function runCommissionTests(): { passed: number; failed: number; results: any[] } {
  const tests = [
    {
      name: 'Vehículos: Importe $392.91, PorPart 100%',
      input: { importe: 392.91, porcentaje: 100 },
      expected: 392.91
    },
    {
      name: 'A&E: Importe $7,062.48, PorPart 100%',
      input: { importe: 7062.48, porcentaje: 100 },
      expected: 7062.48
    },
    {
      name: 'Vida: Importe $6,178.43, PorPart 100%',
      input: { importe: 6178.43, porcentaje: 100 },
      expected: 6178.43
    },
    {
      name: 'PorPart decimal: Importe $970.79, PorPart 90.909%',
      input: { importe: 970.79, porcentaje: 90.909 },
      expected: 882.62
    },
    {
      name: 'Parse string con $: "$1,234.56"',
      input: { importe: '$1,234.56', porcentaje: 100 },
      expected: 1234.56
    },
    {
      name: 'Parse negativo: "-$500.00"',
      input: { importe: '-$500.00', porcentaje: 100 },
      expected: -500.00
    },
    {
      name: 'Parse porcentaje string: "25%"',
      input: { importe: 1000, porcentaje: '25%' },
      expected: 250.00
    },
    {
      name: 'Importe 0 → comisión 0',
      input: { importe: 0, porcentaje: 100 },
      expected: 0
    },
    {
      name: 'PorPart 0 → comisión 0',
      input: { importe: 1000, porcentaje: 0 },
      expected: 0
    }
  ];

  const results = tests.map(test => {
    const result = calculateCommission(
      parseNumberMx(test.input.importe),
      parseNumberMx(test.input.porcentaje)
    );
    const passed = Math.abs(result - test.expected) < 0.01;
    return {
      ...test,
      result,
      passed
    };
  });

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  return { passed, failed, results };
}
