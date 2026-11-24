/**
 * Servicio unificado para ingesta de comisiones desde Excel
 *
 * Usado por:
 * - ComisionesUpload (Nuevo Lote - upload directo)
 * - convert-import-to-commission-batches (Convertir import a lote)
 *
 * Garantiza que ambos flujos usen:
 * - La misma validación de columnas
 * - El mismo mapeo de campos
 * - El mismo cálculo de comisión
 * - La misma normalización de datos
 */

// ============================================================================
// DEFINICIÓN DE COLUMNAS OBLIGATORIAS Y SINÓNIMOS
// ============================================================================

export interface ColumnSynonyms {
  primary: string;
  synonyms: string[];
  required: boolean;
  description: string;
}

/**
 * Mapa de columnas con sus sinónimos aceptados
 * La normalización debe ser: lowercase, sin acentos, sin espacios, sin caracteres especiales
 */
export const COLUMN_DEFINITIONS: Record<string, ColumnSynonyms> = {
  fpago: {
    primary: 'FPago',
    synonyms: ['fpago', 'fecha', 'fechapago', 'fecha_pago'],
    required: true,
    description: 'Fecha de pago (obligatoria)'
  },
  email: {
    primary: 'Email',
    synonyms: ['email', 'emailagente', 'email_agente', 'mail', 'correo'],
    required: true,
    description: 'Email del agente (obligatorio)'
  },
  ramo: {
    primary: 'Ramo',
    synonyms: ['ramo', 'branch', 'tipo'],
    required: true,
    description: 'Ramo del seguro (obligatorio)'
  },
  aseguradora: {
    primary: 'Aseguradora',
    synonyms: ['aseguradora', 'ciaabreviacion', 'cia', 'compania', 'insurer', 'insurance'],
    required: true,
    description: 'Aseguradora o compañía (obligatorio)'
  },
  importe: {
    primary: 'Importe',
    synonyms: ['importe', 'importebase', 'importe_base', 'base', 'baseamount', 'monto'],
    required: true,
    description: 'Importe base para cálculo de comisión (obligatorio)'
  },
  porpart: {
    primary: 'PorPart',
    synonyms: ['porpart', 'porcentaje', 'percentage', 'pct', 'comisionpct', '%'],
    required: true,
    description: 'Porcentaje de comisión (obligatorio, ej: 25 = 25%)'
  },
  poliza: {
    primary: 'Poliza',
    synonyms: ['poliza', 'documento', 'policy', 'nopoliza', 'numeropoliza'],
    required: true,
    description: 'Número de póliza o documento (obligatorio)'
  },
  // Columnas opcionales
  primaneta: {
    primary: 'PrimaNeta',
    synonyms: ['primaneta', 'prima_neta', 'netpremium', 'prima'],
    required: false,
    description: 'Prima neta (opcional, solo informativo, NO se usa para cálculo)'
  },
  nombreasegurado: {
    primary: 'NombreAsegurado',
    synonyms: ['nombreasegurado', 'asegurado', 'nombrecompleto', 'nombre_completo', 'insured', 'cliente'],
    required: false,
    description: 'Nombre del asegurado (opcional)'
  },
  concepto: {
    primary: 'Concepto',
    synonyms: ['concepto', 'concept', 'descripcion', 'detalle'],
    required: false,
    description: 'Concepto o descripción (opcional)'
  }
};

// ============================================================================
// NORMALIZACIÓN DE HEADERS
// ============================================================================

/**
 * Normaliza un header para comparación
 * - lowercase
 * - sin acentos
 * - sin espacios
 * - sin caracteres especiales
 */
export function normalizeColumnName(name: string): string {
  if (!name) return '';

  let normalized = name.toString().trim().toLowerCase();

  // Remover acentos
  normalized = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Remover espacios, guiones, puntos, underscores
  normalized = normalized.replace(/[\s\-_.]/g, '');

  return normalized;
}

/**
 * Mapea los headers del excel a las columnas estándar
 * Retorna un mapa: columnStandard => headerOriginal
 */
export function mapExcelHeaders(excelHeaders: string[]): {
  mappedColumns: Record<string, string>;
  detectedColumns: string[];
  missingRequired: string[];
  unmappedHeaders: string[];
} {
  const mappedColumns: Record<string, string> = {};
  const detectedColumns: string[] = [];
  const unmappedHeaders: string[] = [];

  // Normalizar todos los headers del excel
  const normalizedHeaders = new Map<string, string>();
  for (const header of excelHeaders) {
    const normalized = normalizeColumnName(header);
    if (normalized) {
      normalizedHeaders.set(normalized, header);
    }
  }

  // Intentar mapear cada columna definida
  for (const [standardKey, definition] of Object.entries(COLUMN_DEFINITIONS)) {
    let found = false;

    // Buscar en sinónimos
    for (const synonym of definition.synonyms) {
      if (normalizedHeaders.has(synonym)) {
        const originalHeader = normalizedHeaders.get(synonym)!;
        mappedColumns[standardKey] = originalHeader;
        detectedColumns.push(originalHeader);
        found = true;
        break;
      }
    }

    if (!found && definition.required) {
      // Columna requerida no encontrada
    }
  }

  // Identificar headers que no se mapearon a ninguna columna conocida
  for (const header of excelHeaders) {
    if (!detectedColumns.includes(header)) {
      unmappedHeaders.push(header);
    }
  }

  // Identificar columnas requeridas faltantes
  const missingRequired: string[] = [];
  for (const [standardKey, definition] of Object.entries(COLUMN_DEFINITIONS)) {
    if (definition.required && !mappedColumns[standardKey]) {
      missingRequired.push(definition.primary);
    }
  }

  return {
    mappedColumns,
    detectedColumns,
    missingRequired,
    unmappedHeaders
  };
}

// ============================================================================
// VALIDACIÓN Y NORMALIZACIÓN DE DATOS
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: Array<{
    field: string;
    reason: string;
    value?: any;
  }>;
}

/**
 * Normaliza un valor numérico
 * Acepta: números, strings con $, comas, espacios, etc.
 */
export function normalizeNumeric(value: any): number {
  if (value === null || value === undefined || value === '') return 0;

  if (typeof value === 'number') {
    return isNaN(value) ? 0 : value;
  }

  if (typeof value === 'string') {
    // Remover símbolos de moneda, comas, espacios
    let cleaned = value.replace(/[$,\s]/g, '').trim();

    // Remover % si existe (para porcentajes)
    cleaned = cleaned.replace(/%/g, '');

    if (cleaned === '' || cleaned === '-') return 0;

    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }

  return 0;
}

/**
 * Normaliza un texto
 */
export function normalizeText(value: any, defaultValue: string = ''): string {
  if (value === null || value === undefined) return defaultValue;
  const str = String(value).trim();
  return str || defaultValue;
}

/**
 * Normaliza email a lowercase sin espacios
 */
export function normalizeEmail(value: any): string {
  if (!value) return '';
  return String(value).trim().toLowerCase();
}

/**
 * Normaliza fecha a formato YYYY-MM-DD
 */
export function normalizeDate(value: any): string | null {
  if (!value) return null;

  // Si es número de Excel (serial date)
  if (typeof value === 'number') {
    const excelEpoch = new Date(1900, 0, 1);
    const daysOffset = value - 2; // Excel cuenta desde 1900-01-01 (con bug del año 1900)
    const resultDate = new Date(excelEpoch.getTime() + daysOffset * 24 * 60 * 60 * 1000);
    return resultDate.toISOString().split('T')[0];
  }

  // Si es string
  if (typeof value === 'string') {
    // Formato DD/MM/YYYY
    if (value.includes('/')) {
      const parts = value.split('/');
      if (parts.length === 3) {
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[2];
        return `${year}-${month}-${day}`;
      }
    }

    // Formato YYYY-MM-DD (ya normalizado)
    if (value.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return value;
    }

    // Intentar parse directo
    try {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    } catch {
      // Ignore
    }
  }

  return null;
}

// ============================================================================
// MODELO DE DATOS ESTANDARIZADO
// ============================================================================

/**
 * Modelo de datos estándar para una fila de comisión
 * Este es el formato que SIEMPRE se usa internamente
 */
export interface StandardCommissionRow {
  // Campos obligatorios
  fpago: string;                    // Fecha de pago (YYYY-MM-DD)
  agent_email: string;              // Email del agente (normalizado)
  ramo: string;                     // Ramo
  aseguradora: string;              // Aseguradora
  importe_base: number;             // Base para cálculo (CRÍTICO: NO usar prima_neta)
  porcentaje: number;               // Porcentaje (ej: 25 = 25%)
  poliza: string;                   // Número de póliza

  // Campos calculados
  comision_calculada: number;       // Importe × (PorPart / 100)

  // Campos opcionales
  prima_neta_info?: number;         // Prima neta (SOLO informativo, NO se usa para cálculo)
  nombre_asegurado?: string;        // Nombre del asegurado
  concepto?: string;                // Concepto o descripción

  // Metadata
  raw_row: Record<string, any>;     // Fila original para debugging
}

/**
 * Convierte una fila de Excel mapeada al modelo estándar
 * REGLA DE ORO: Comisión = Importe × (PorPart / 100)
 */
export function parseStandardRow(
  excelRow: Record<string, any>,
  mappedColumns: Record<string, string>
): { row: StandardCommissionRow | null; validation: ValidationResult } {
  const errors: Array<{ field: string; reason: string; value?: any }> = [];

  // Extraer campos usando el mapeo
  const fpagoRaw = mappedColumns.fpago ? excelRow[mappedColumns.fpago] : null;
  const emailRaw = mappedColumns.email ? excelRow[mappedColumns.email] : null;
  const ramoRaw = mappedColumns.ramo ? excelRow[mappedColumns.ramo] : null;
  const aseguradoraRaw = mappedColumns.aseguradora ? excelRow[mappedColumns.aseguradora] : null;
  const importeRaw = mappedColumns.importe ? excelRow[mappedColumns.importe] : null;
  const porpartRaw = mappedColumns.porpart ? excelRow[mappedColumns.porpart] : null;
  const polizaRaw = mappedColumns.poliza ? excelRow[mappedColumns.poliza] : null;

  // Opcionales
  const primaNetaRaw = mappedColumns.primaneta ? excelRow[mappedColumns.primaneta] : null;
  const nombreAseguradoRaw = mappedColumns.nombreasegurado ? excelRow[mappedColumns.nombreasegurado] : null;
  const conceptoRaw = mappedColumns.concepto ? excelRow[mappedColumns.concepto] : null;

  // Normalizar
  const fpago = normalizeDate(fpagoRaw);
  const agent_email = normalizeEmail(emailRaw);
  const ramo = normalizeText(ramoRaw);
  const aseguradora = normalizeText(aseguradoraRaw);
  const importe_base = normalizeNumeric(importeRaw);
  const porcentaje = normalizeNumeric(porpartRaw);
  const poliza = normalizeText(polizaRaw);

  const prima_neta_info = primaNetaRaw ? normalizeNumeric(primaNetaRaw) : undefined;
  const nombre_asegurado = nombreAseguradoRaw ? normalizeText(nombreAseguradoRaw) : undefined;
  const concepto = conceptoRaw ? normalizeText(conceptoRaw) : undefined;

  // Validar campos obligatorios
  if (!fpago || fpago === 'N/A') {
    errors.push({ field: 'FPago', reason: 'Fecha de pago es requerida y debe ser válida', value: fpagoRaw });
  }

  if (!agent_email || agent_email === '') {
    errors.push({ field: 'Email', reason: 'Email del agente es requerido', value: emailRaw });
  }

  if (!ramo || ramo === '') {
    errors.push({ field: 'Ramo', reason: 'Ramo es requerido', value: ramoRaw });
  }

  if (!aseguradora || aseguradora === '') {
    errors.push({ field: 'Aseguradora', reason: 'Aseguradora es requerida', value: aseguradoraRaw });
  }

  if (!importe_base || importe_base <= 0) {
    errors.push({ field: 'Importe', reason: 'Importe base debe ser mayor a 0', value: importeRaw });
  }

  if (porcentaje === undefined || porcentaje === null) {
    errors.push({ field: 'PorPart', reason: 'Porcentaje es requerido', value: porpartRaw });
  }

  if (!poliza || poliza === '') {
    errors.push({ field: 'Poliza', reason: 'Número de póliza es requerido', value: polizaRaw });
  }

  // Si hay errores, retornar null
  if (errors.length > 0) {
    return {
      row: null,
      validation: { valid: false, errors }
    };
  }

  // CÁLCULO CORRECTO: Comisión = Importe × (PorPart / 100)
  // IMPORTANTE: NO usar prima_neta para el cálculo
  const comision_calculada = importe_base * (porcentaje / 100);

  const standardRow: StandardCommissionRow = {
    fpago: fpago!,
    agent_email: agent_email!,
    ramo: ramo!,
    aseguradora: aseguradora!,
    importe_base,
    porcentaje,
    poliza: poliza!,
    comision_calculada,
    prima_neta_info,
    nombre_asegurado,
    concepto,
    raw_row: { ...excelRow }
  };

  return {
    row: standardRow,
    validation: { valid: true, errors: [] }
  };
}

// ============================================================================
// FUNCIONES PÚBLICAS PARA USO EN FRONTEND Y BACKEND
// ============================================================================

/**
 * Valida que un archivo Excel tenga las columnas requeridas
 * Retorna el mapeo de columnas si es válido
 */
export function validateExcelStructure(excelHeaders: string[]): {
  valid: boolean;
  mappedColumns?: Record<string, string>;
  detectedColumns?: string[];
  missingRequired?: string[];
  error?: string;
  suggestions?: string[];
} {
  const result = mapExcelHeaders(excelHeaders);

  if (result.missingRequired.length > 0) {
    const suggestions: string[] = [];

    for (const missing of result.missingRequired) {
      const definition = Object.values(COLUMN_DEFINITIONS).find(d => d.primary === missing);
      if (definition) {
        suggestions.push(`${missing}: aceptamos también ${definition.synonyms.join(', ')}`);
      }
    }

    return {
      valid: false,
      detectedColumns: result.detectedColumns,
      missingRequired: result.missingRequired,
      error: `Faltan columnas obligatorias: ${result.missingRequired.join(', ')}`,
      suggestions
    };
  }

  return {
    valid: true,
    mappedColumns: result.mappedColumns,
    detectedColumns: result.detectedColumns
  };
}

/**
 * Procesa un array de filas de Excel y las convierte al modelo estándar
 * Retorna filas válidas y errores de validación
 */
export function processExcelRows(
  excelRows: Record<string, any>[],
  mappedColumns: Record<string, string>
): {
  validRows: StandardCommissionRow[];
  invalidRows: Array<{
    rowIndex: number;
    errors: Array<{ field: string; reason: string; value?: any }>;
    rawData: Record<string, any>;
  }>;
} {
  const validRows: StandardCommissionRow[] = [];
  const invalidRows: Array<{
    rowIndex: number;
    errors: Array<{ field: string; reason: string; value?: any }>;
    rawData: Record<string, any>;
  }> = [];

  for (let i = 0; i < excelRows.length; i++) {
    const excelRow = excelRows[i];
    const { row, validation } = parseStandardRow(excelRow, mappedColumns);

    if (validation.valid && row) {
      validRows.push(row);
    } else {
      invalidRows.push({
        rowIndex: i + 2, // +2 porque Excel empieza en 1 y row 1 es header
        errors: validation.errors,
        rawData: excelRow
      });
    }
  }

  return { validRows, invalidRows };
}
