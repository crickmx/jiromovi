/**
 * Utilidades para normalización de nombres y matching de usuarios
 */

export interface NormalizedName {
  name_norm: string;
  name_signature: string;
}

/**
 * Normaliza un nombre de persona para comparación y matching
 */
export function normalizePersonName(name: string): NormalizedName {
  if (!name) {
    return { name_norm: '', name_signature: '' };
  }

  const cleaned = name
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9\s]/g, '')
    .replace(/\s+/g, ' ');

  const words = cleaned.split(' ').filter(w => w.length > 0);
  const signature = words.sort().join(' ');

  return {
    name_norm: cleaned,
    name_signature: signature,
  };
}

/**
 * Construye una clave única para un agente basado en su nombre normalizado
 */
export function buildAgentKey(nameSignature: string): string {
  if (!nameSignature) return '';
  return `name:${nameSignature.toLowerCase()}`;
}

/**
 * Encuentra el mejor match de usuario en la base de datos
 */
export async function findBestUserMatch(
  supabase: any,
  vendorName: string
): Promise<{ userId: string | null; confidence: number; matchMethod: string }> {
  if (!vendorName) {
    return { userId: null, confidence: 0, matchMethod: 'none' };
  }

  const normalized = normalizePersonName(vendorName);
  const words = normalized.name_norm.split(' ').filter(w => w.length > 2);

  if (words.length === 0) {
    return { userId: null, confidence: 0, matchMethod: 'none' };
  }

  const { data: usuarios } = await supabase
    .from('usuarios')
    .select('id, nombre, apellidos')
    .eq('estado', 'activo');

  if (!usuarios || usuarios.length === 0) {
    return { userId: null, confidence: 0, matchMethod: 'none' };
  }

  let bestMatch: { userId: string; confidence: number; matchMethod: string } | null = null;

  for (const usuario of usuarios) {
    const fullName = `${usuario.nombre || ''} ${usuario.apellidos || ''}`.trim();
    const userNormalized = normalizePersonName(fullName);

    if (userNormalized.name_signature === normalized.name_signature) {
      return {
        userId: usuario.id,
        confidence: 100,
        matchMethod: 'exact_signature',
      };
    }

    const userWords = userNormalized.name_norm.split(' ').filter(w => w.length > 2);
    const matchingWords = words.filter(w => userWords.includes(w));
    const confidence = (matchingWords.length / Math.max(words.length, userWords.length)) * 100;

    if (confidence >= 60 && (!bestMatch || confidence > bestMatch.confidence)) {
      bestMatch = {
        userId: usuario.id,
        confidence: Math.round(confidence),
        matchMethod: 'partial_words',
      };
    }
  }

  return bestMatch || { userId: null, confidence: 0, matchMethod: 'none' };
}
