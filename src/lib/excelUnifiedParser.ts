import * as XLSX from 'xlsx';

export interface ParsedExcel {
  sheetNameUsed: string;
  headersOriginal: string[];
  headersNormalizedMap: Record<string, string>;
  rows: Record<string, any>[];
  totalRowsRead: number;
  debugInfo: {
    allSheetNames: string[];
    rowCountPerSheet: Record<string, number>;
    detectedColumns: {
      emailAgente?: string;
      vendNombre?: string;
    };
  };
}

export function normalizeHeader(header: string): string {
  if (!header) return '';

  let normalized = header.toString().trim().toLowerCase();

  normalized = normalized
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  normalized = normalized
    .replace(/[\s\-_.]/g, '');

  return normalized;
}

export function parseExcelUnified(fileBuffer: ArrayBuffer): ParsedExcel {
  const workbook = XLSX.read(fileBuffer, { type: 'array' });

  const sheetNames = workbook.SheetNames;
  if (sheetNames.length === 0) {
    throw new Error('El archivo Excel no contiene hojas');
  }

  let bestSheet: { name: string; rowCount: number } | null = null;
  const rowCountPerSheet: Record<string, number> = {};

  for (const sheetName of sheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false });
    const rowCount = jsonData.length;
    rowCountPerSheet[sheetName] = rowCount;

    if (!bestSheet || rowCount > bestSheet.rowCount) {
      bestSheet = { name: sheetName, rowCount };
    }
  }

  if (!bestSheet) {
    throw new Error('No se pudo determinar la hoja con más datos');
  }

  const sheet = workbook.Sheets[bestSheet.name];

  const jsonData = XLSX.utils.sheet_to_json(sheet, {
    defval: null,
    raw: false,
    blankrows: true
  });

  if (jsonData.length === 0) {
    throw new Error(`La hoja "${bestSheet.name}" no contiene datos`);
  }

  const firstRow = jsonData[0] as Record<string, any>;
  const headersOriginal = Object.keys(firstRow);

  const headersNormalizedMap: Record<string, string> = {};
  for (const header of headersOriginal) {
    const normalized = normalizeHeader(header);
    if (normalized) {
      headersNormalizedMap[normalized] = header;
    }
  }

  const detectedColumns: { emailAgente?: string; vendNombre?: string } = {};

  if (headersNormalizedMap['emailagente']) {
    detectedColumns.emailAgente = headersNormalizedMap['emailagente'];
  }

  if (headersNormalizedMap['vendnombre']) {
    detectedColumns.vendNombre = headersNormalizedMap['vendnombre'];
  }

  const rows = jsonData.map(row => {
    const normalizedRow: Record<string, any> = {};
    for (const [key, value] of Object.entries(row as Record<string, any>)) {
      normalizedRow[key] = value;
    }
    return normalizedRow;
  });

  return {
    sheetNameUsed: bestSheet.name,
    headersOriginal,
    headersNormalizedMap,
    rows,
    totalRowsRead: rows.length,
    debugInfo: {
      allSheetNames: sheetNames,
      rowCountPerSheet,
      detectedColumns,
    },
  };
}

export function extractVendorInfo(row: Record<string, any>, parsedExcel: ParsedExcel): {
  vendorEmailRaw: string;
  vendorNameRaw: string;
} {
  const EMAIL_COL = parsedExcel.headersNormalizedMap['emailagente'];
  const NAME_COL = parsedExcel.headersNormalizedMap['vendnombre'];

  const vendorEmailRaw = EMAIL_COL ? (row[EMAIL_COL]?.toString() || '').trim() : '';
  const vendorNameRaw = NAME_COL ? (row[NAME_COL]?.toString() || '').trim() : '';

  return {
    vendorEmailRaw,
    vendorNameRaw,
  };
}

export function debugParseResults(parsed: ParsedExcel): string {
  const lines: string[] = [];

  lines.push('=== EXCEL PARSE DEBUG ===');
  lines.push(`Archivo tiene ${parsed.debugInfo.allSheetNames.length} hoja(s): ${parsed.debugInfo.allSheetNames.join(', ')}`);
  lines.push(`Hoja seleccionada: "${parsed.sheetNameUsed}"`);
  lines.push(`Total filas leídas: ${parsed.totalRowsRead}`);
  lines.push('');
  lines.push('Filas por hoja:');
  for (const [sheetName, count] of Object.entries(parsed.debugInfo.rowCountPerSheet)) {
    lines.push(`  - ${sheetName}: ${count} filas`);
  }
  lines.push('');
  lines.push(`Headers originales (${parsed.headersOriginal.length}): ${parsed.headersOriginal.slice(0, 10).join(', ')}${parsed.headersOriginal.length > 10 ? '...' : ''}`);
  lines.push('');
  lines.push('Columnas clave detectadas:');
  lines.push(`  - EmailAgente: ${parsed.debugInfo.detectedColumns.emailAgente || 'NO ENCONTRADA'}`);
  lines.push(`  - VendNombre: ${parsed.debugInfo.detectedColumns.vendNombre || 'NO ENCONTRADA'}`);
  lines.push('');

  const emptyVendorCount = parsed.rows.filter(row => {
    const vendor = extractVendorInfo(row, parsed);
    return !vendor.vendorNameRaw && !vendor.vendorEmailRaw;
  }).length;

  const emptyNameCount = parsed.rows.filter(row => {
    const vendor = extractVendorInfo(row, parsed);
    return !vendor.vendorNameRaw;
  }).length;

  lines.push(`Filas con VendNombre vacío: ${emptyNameCount} (${((emptyNameCount / parsed.totalRowsRead) * 100).toFixed(1)}%)`);
  lines.push(`Filas sin vendor (ni email ni nombre): ${emptyVendorCount}`);

  return lines.join('\n');
}
