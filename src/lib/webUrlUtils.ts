/**
 * Utilidades para generar URLs públicas del agente
 * Basadas únicamente en el slug del usuario
 */

export const WEB_DOMAIN = 'agentedeseguros.website';
export const MULTICOTIZADOR_BASE = 'https://www.multicotizador.digital/cotiza';

/**
 * Genera la URL de "Mi Página Web" visible para el usuario
 * @param slug - Slug único del usuario
 * @returns URL sin https (ej: agentedeseguros.website/juanperez)
 */
export function getMiPaginaWeb(slug: string | null | undefined): string {
  if (!slug) return '';
  return `${WEB_DOMAIN}/${slug}`;
}

/**
 * Genera la URL completa de "Mi Página Web" con protocolo
 * @param slug - Slug único del usuario
 * @returns URL completa (ej: https://agentedeseguros.website/juanperez)
 */
export function getMiPaginaWebFull(slug: string | null | undefined): string {
  if (!slug) return '';
  return `https://${WEB_DOMAIN}/${slug}`;
}

/**
 * Genera la URL del multicotizador (uso interno)
 * @param slug - Slug único del usuario
 * @returns URL del multicotizador (ej: https://www.multicotizador.digital/cotiza/-juanperez-)
 */
export function getMulticotizadorUrl(slug: string | null | undefined): string {
  if (!slug) return '';
  return `${MULTICOTIZADOR_BASE}/-${slug}-`;
}

/**
 * Valida que un slug sea válido para generar URLs
 * @param slug - Slug a validar
 * @returns true si el slug es válido
 */
export function isValidSlug(slug: string | null | undefined): boolean {
  if (!slug) return false;

  // Solo letras minúsculas, números y guiones
  const slugRegex = /^[a-z0-9-]+$/;

  // Validaciones
  return (
    slugRegex.test(slug) &&
    slug.length >= 3 &&
    slug.length <= 50 &&
    !slug.startsWith('-') &&
    !slug.endsWith('-') &&
    !slug.includes('--')
  );
}

/**
 * Obtiene el teléfono formateado para WhatsApp
 * @param phone - Teléfono del usuario
 * @returns Número formateado (ej: 5215512345678)
 */
export function getWhatsAppNumber(phone: string | null | undefined): string {
  if (!phone) return '';

  // Remover espacios, guiones y paréntesis
  let cleaned = phone.replace(/[\s\-()]/g, '');

  // Si no empieza con 52, agregarlo (código de México)
  if (!cleaned.startsWith('52')) {
    cleaned = '52' + cleaned;
  }

  return cleaned;
}

/**
 * Genera link de WhatsApp con mensaje predefinido
 * @param phone - Teléfono del usuario
 * @param message - Mensaje opcional predefinido
 * @returns URL de WhatsApp
 */
export function getWhatsAppLink(
  phone: string | null | undefined,
  message?: string
): string {
  const number = getWhatsAppNumber(phone);
  if (!number) return '';

  const baseUrl = `https://wa.me/${number}`;
  if (message) {
    return `${baseUrl}?text=${encodeURIComponent(message)}`;
  }

  return baseUrl;
}
