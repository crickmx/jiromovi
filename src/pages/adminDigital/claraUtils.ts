export interface ClaraTransaction {
  id: number;
  date: string;
  original_vendor: string;
  normalized_vendor: string;
  amount_mxn: number;
  cost_center: string;
  simple_concept: string;
  description: string;
  match_type: string;
  card_alias: string;
  auth_code: string;
}

export interface VendorMapping {
  normalized_vendor: string;
  cost_center: string;
  simple_concept: string;
  description: string;
  usage_count: number;
}

export function normalizeHeader(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

export function cleanVendorName(name: string): string {
  if (!name || typeof name !== 'string') return 'PROVEEDOR DESCONOCIDO';
  let clean = name.trim().toUpperCase();
  const prefixes = [
    /^PAYPAL\s*\*\s*/i,
    /^DLO\s*\*\s*/i,
    /^STRIPE\s*\*\s*/i,
    /^IZI\s*\*\s*/i,
    /^MP\s*\*\s*/i,
    /^MERCADOPAGO\s*\*\s*/i,
    /^SQ\s*\*\s*/i,
    /^STR\s*\*\s*/i,
    /^OPENPAY\s*\*\s*/i,
  ];
  for (const pattern of prefixes) {
    clean = clean.replace(pattern, '');
  }
  const suffixes = [
    /\s+(CDMX|CIUDAD DE ME|CIUDAD DE MEX|SAN FRANC|SAN FRANCISCO|MEXICO|MEX|USA|US|CA|COM|INC|LTD|LLC)$/i,
    /\s+S\.?A\.?\s+DE\s+C\.?V\.?$/i,
    /\s+S\.?A\.?S\.?$/i,
    /\s+S\.?R\.?L\.?$/i,
  ];
  for (const pattern of suffixes) {
    clean = clean.replace(pattern, '');
  }
  return clean.replace(/\s+/g, ' ').trim();
}

function editDistance(s1: string, s2: string): number {
  const a = s1.toLowerCase();
  const b = s2.toLowerCase();
  const costs: number[] = [];
  for (let i = 0; i <= a.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= b.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (a.charAt(i - 1) !== b.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[b.length] = lastValue;
  }
  return costs[b.length];
}

function getSimilarity(s1: string, s2: string): number {
  const longer = s1.length < s2.length ? s2 : s1;
  const shorter = s1.length < s2.length ? s1 : s2;
  if (longer.length === 0) return 1.0;
  return (longer.length - editDistance(longer, shorter)) / longer.length;
}

export function findBestMappingMatch(
  normalizedName: string,
  mappings: VendorMapping[],
  threshold = 0.65
): { match: VendorMapping | null; type: string } {
  if (!normalizedName) return { match: null, type: 'Requiere Asignacion' };
  const exact = mappings.find(
    (m) => m.normalized_vendor.toUpperCase() === normalizedName.toUpperCase()
  );
  if (exact) return { match: exact, type: 'Coincidencia Exacta' };
  let bestRatio = 0;
  let bestMatch: VendorMapping | null = null;
  for (const m of mappings) {
    const ratio = getSimilarity(normalizedName.toUpperCase(), m.normalized_vendor.toUpperCase());
    if (ratio > bestRatio) {
      bestRatio = ratio;
      bestMatch = m;
    }
  }
  if (bestRatio >= threshold && bestMatch) {
    return {
      match: bestMatch,
      type: `Coincidencia Aproximada (${Math.round(bestRatio * 100)}%)`,
    };
  }
  return { match: null, type: 'Requiere Asignacion' };
}

export function parseCSVAmount(raw: string | number): number {
  const str = String(raw ?? '0');
  return parseFloat(str.replace(/[^0-9.-]+/g, '')) || 0;
}

export function formatMXN(value: number): string {
  return value.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
