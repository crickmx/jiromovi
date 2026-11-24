// Avisos de seguridad al leer un correo y bloqueo de imágenes externas.

const DOMINIOS_CONOCIDOS = [
  'movi.digital', 'jiro.mx', 'jiro.com.mx', 'jiroseguros.com.mx', 'jiro-operacion.mx', 'seguwallet.mx',
  'gnp.com.mx', 'qualitas.com.mx', 'axa.com.mx', 'mapfre.com.mx', 'chubb.com', 'hdi.com.mx', 'segurosatlas.com.mx',
  'bbva.mx', 'banorte.com', 'santander.com.mx', 'banamex.com', 'sat.gob.mx',
  'google.com', 'gmail.com', 'microsoft.com', 'outlook.com', 'hotmail.com', 'apple.com', 'icloud.com', 'paypal.com', 'ionos.mx',
];
const MARCAS_PROPIAS = ['movi', 'jiro'];
const DOMINIOS_PROPIOS = ['movi.digital', 'jiro.mx', 'jiro.com.mx', 'jiroseguros.com.mx', 'jiro-operacion.mx'];

function distancia(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 9;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

const dominio = (email: string) => (email.split('@')[1] || '').toLowerCase().replace(/>$/, '').trim();
const parecidoA = (dom: string, conocido: string) => dom === conocido || dom.endsWith(`.${conocido}`);

/** Motivos por los que un remitente parece sospechoso. Vacío = sin aviso. */
export function motivosSospecha(nombre: string, email: string): string[] {
  const motivos: string[] = [];
  const dom = dominio(email);
  if (!dom) return motivos;
  const nom = (nombre || '').toLowerCase();

  if (dom.startsWith('xn--') || dom.includes('.xn--')) {
    motivos.push('El dominio usa caracteres especiales que pueden imitar a otro.');
  }

  if (!DOMINIOS_CONOCIDOS.some(k => parecidoA(dom, k))) {
    const imitado = DOMINIOS_CONOCIDOS.find(k => {
      const d = distancia(dom, k);
      return d > 0 && d <= 2 && k.length >= 6;
    });
    if (imitado) motivos.push(`El dominio «${dom}» se parece a «${imitado}», pero no es el mismo.`);
  }

  const correoEnNombre = nom.match(/[^\s<>"']+@[^\s<>"']+/);
  if (correoEnNombre && dominio(correoEnNombre[0]) && dominio(correoEnNombre[0]) !== dom) {
    motivos.push(`El nombre muestra «${correoEnNombre[0]}», pero el correo real es de «${dom}».`);
  }

  if (MARCAS_PROPIAS.some(m => new RegExp(`\\b${m}\\b`, 'i').test(nom)) && !DOMINIOS_PROPIOS.some(k => parecidoA(dom, k))) {
    motivos.push(`El nombre dice ser de MOVI o JIRO, pero el correo viene de «${dom}».`);
  }
  return motivos;
}

/** ¿El HTML trae imágenes o fondos remotos que se cargarían al abrirlo? */
export function tieneImagenesExternas(html: string | null | undefined): boolean {
  if (!html) return false;
  return /<img\b[^>]*\bsrc\s*=\s*["']?\s*(https?:)?\/\//i.test(html)
    || /url\(\s*["']?\s*(https?:)?\/\//i.test(html)
    || /\bbackground\s*=\s*["']?\s*(https?:)?\/\//i.test(html);
}

/**
 * Política de contenido para el iframe del correo. Con imágenes bloqueadas,
 * solo se permiten las incrustadas (data:/cid:); la política la aplica el
 * navegador, así que cubre también los fondos por CSS.
 */
export function cspCorreo(permitirImagenes: boolean): string {
  const img = permitirImagenes ? "img-src * data: blob: cid:" : "img-src data: blob: cid:";
  return `default-src 'none'; ${img}; style-src 'unsafe-inline' *; font-src * data:; media-src 'none'; upgrade-insecure-requests`;
}
