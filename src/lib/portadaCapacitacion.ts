import { supabase } from './supabase';

/**
 * Portada generada por el sistema para las capacitaciones del Aula Virtual.
 *
 * Cuando quien crea el evento no sube imagen, se dibuja una portada 16:9 con
 * la identidad de Seguros Education: el degradado navy→azul de la marca, el
 * logo oficial, el título de la ponencia y —si se eligió aseguradora— su
 * logotipo real (desde `aseguradoras.logo_url`) o, en su defecto, su nombre.
 */

export interface DatosPortada {
  titulo: string;
  /** Nombre de quien imparte. Si no hay, no se pinta la línea. */
  ponente?: string | null;
  /** Nombre de la aseguradora (etiqueta elegida en el formulario). */
  aseguradora?: string | null;
  /** URL del logotipo oficial; si falta o falla, se escribe el nombre. */
  logoAseguradora?: string | null;
}

const ANCHO = 1200;
const ALTO = 675;

/** Mismo activo que usa la cabecera del módulo. */
const LOGO_SEGUROS_EDUCATION = '/movirecurso_11.png';

/** Colores del degradado de marca (los mismos del layout de Seguros Education). */
const NAVY = '#101a3a';
const INDIGO = '#242553';
const AZUL = '#1C37E0';

function cargarImagen(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolver) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolver(img);
    img.onerror = () => resolver(null);
    img.src = src;
  });
}

/** Corta el texto en líneas que quepan en `ancho`, sin partir palabras. */
function partirTexto(ctx: CanvasRenderingContext2D, texto: string, ancho: number, maxLineas: number): string[] {
  const palabras = texto.split(/\s+/).filter(Boolean);
  const lineas: string[] = [];
  let actual = '';

  for (const palabra of palabras) {
    const prueba = actual ? `${actual} ${palabra}` : palabra;
    if (ctx.measureText(prueba).width <= ancho || !actual) {
      actual = prueba;
      continue;
    }
    lineas.push(actual);
    actual = palabra;
    if (lineas.length === maxLineas) break;
  }
  if (actual && lineas.length < maxLineas) lineas.push(actual);

  // Si sobró texto, la última línea se corta con puntos suspensivos.
  const consumido = lineas.join(' ').split(/\s+/).length;
  if (consumido < palabras.length && lineas.length > 0) {
    let ultima = lineas[lineas.length - 1];
    while (ultima.length > 4 && ctx.measureText(`${ultima}…`).width > ancho) {
      ultima = ultima.slice(0, -1).trimEnd();
    }
    lineas[lineas.length - 1] = `${ultima}…`;
  }
  return lineas;
}

/**
 * Dibuja la portada y devuelve un `File` listo para subir al bucket
 * `aula-portadas` (el mismo que usa la portada manual).
 */
export async function generarPortadaCapacitacion(datos: DatosPortada): Promise<File> {
  if (typeof document !== 'undefined' && document.fonts) {
    try {
      await document.fonts.load('700 68px Sora');
      await document.fonts.load('600 34px Manrope');
    } catch {
      /* si la fuente no está disponible, canvas cae a la del sistema */
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = ANCHO;
  canvas.height = ALTO;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('El navegador no permite generar la portada');

  // Fondo: degradado de marca en diagonal.
  const fondo = ctx.createLinearGradient(0, 0, ANCHO, ALTO);
  fondo.addColorStop(0, NAVY);
  fondo.addColorStop(0.55, INDIGO);
  fondo.addColorStop(1, AZUL);
  ctx.fillStyle = fondo;
  ctx.fillRect(0, 0, ANCHO, ALTO);

  // Halo suave arriba a la derecha, para que el fondo no quede plano.
  const halo = ctx.createRadialGradient(ANCHO * 0.82, ALTO * 0.12, 0, ANCHO * 0.82, ALTO * 0.12, 620);
  halo.addColorStop(0, 'rgba(255,255,255,0.16)');
  halo.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, ANCHO, ALTO);

  // Trama de puntos muy tenue (textura, sin ruido visual).
  ctx.fillStyle = 'rgba(255,255,255,0.055)';
  for (let x = 40; x < ANCHO; x += 44) {
    for (let y = 40; y < ALTO; y += 44) {
      ctx.beginPath();
      ctx.arc(x, y, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Cabecera: logo de Seguros Education a la izquierda, sello del módulo a la derecha.
  const logo = await cargarImagen(LOGO_SEGUROS_EDUCATION);
  if (logo) {
    const altura = 46;
    const ancho = (logo.width / logo.height) * altura;
    ctx.drawImage(logo, 72, 58, ancho, altura);
  } else {
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 30px Sora, Manrope, system-ui, sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText('SEGUROS EDUCATION', 72, 64);
  }

  ctx.font = '600 18px Manrope, system-ui, sans-serif';
  const sello = 'AULA VIRTUAL';
  ctx.textBaseline = 'middle';
  const anchoSello = ctx.measureText(sello).width + 44;
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.beginPath();
  ctx.roundRect(ANCHO - 72 - anchoSello, 60, anchoSello, 44, 22);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fillText(sello, ANCHO - 72 - anchoSello + 22, 83);

  // Título: baja el tamaño hasta que quepa en tres líneas.
  const anchoTexto = ANCHO - 144;
  const titulo = datos.titulo.trim() || 'Capacitación Seguros Education';
  let tamano = 68;
  let lineas: string[] = [];
  for (; tamano >= 34; tamano -= 3) {
    ctx.font = `700 ${tamano}px Sora, Manrope, system-ui, sans-serif`;
    lineas = partirTexto(ctx, titulo, anchoTexto, 3);
    if (lineas.length <= 3 && lineas.every((l) => ctx.measureText(l).width <= anchoTexto)) break;
  }

  const altoLinea = tamano * 1.18;
  const altoTitulo = lineas.length * altoLinea;
  const yTitulo = Math.round(ALTO * 0.455 - altoTitulo / 2);

  // Barra de acento sobre el título.
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.roundRect(72, yTitulo - 44, 64, 6, 3);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'top';
  ctx.font = `700 ${tamano}px Sora, Manrope, system-ui, sans-serif`;
  lineas.forEach((linea, i) => {
    ctx.fillText(linea, 72, yTitulo + i * altoLinea);
  });

  // Pie: quién imparte (si lo hay) a la izquierda, aseguradora a la derecha.
  const yPie = ALTO - 96;
  const ponente = datos.ponente?.trim();
  if (ponente) {
    ctx.fillStyle = 'rgba(255,255,255,0.62)';
    ctx.font = '600 16px Manrope, system-ui, sans-serif';
    ctx.fillText('IMPARTE', 72, yPie);
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 32px Manrope, system-ui, sans-serif';
    const nombre = partirTexto(ctx, ponente, 560, 1)[0] ?? ponente;
    ctx.fillText(nombre, 72, yPie + 26);
  }

  const aseguradora = datos.aseguradora?.trim();
  if (aseguradora) {
    const logoAseg = datos.logoAseguradora ? await cargarImagen(datos.logoAseguradora) : null;
    if (logoAseg) {
      // Tarjeta blanca: los logotipos traen fondo propio y así se leen siempre.
      const maxAncho = 240;
      const maxAlto = 86;
      const escala = Math.min(maxAncho / logoAseg.width, maxAlto / logoAseg.height);
      const anchoLogo = logoAseg.width * escala;
      const altoLogo = logoAseg.height * escala;
      const padX = 26;
      const padY = 20;
      const anchoTarjeta = anchoLogo + padX * 2;
      const altoTarjeta = altoLogo + padY * 2;
      const xTarjeta = ANCHO - 72 - anchoTarjeta;
      const yTarjeta = ALTO - 72 - altoTarjeta;

      ctx.fillStyle = 'rgba(255,255,255,0.96)';
      ctx.beginPath();
      ctx.roundRect(xTarjeta, yTarjeta, anchoTarjeta, altoTarjeta, 18);
      ctx.fill();
      ctx.drawImage(logoAseg, xTarjeta + padX, yTarjeta + padY, anchoLogo, altoLogo);
    } else {
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(255,255,255,0.62)';
      ctx.font = '600 16px Manrope, system-ui, sans-serif';
      ctx.fillText('ASEGURADORA', ANCHO - 72, yPie);
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 30px Sora, Manrope, system-ui, sans-serif';
      const nombreAseg = partirTexto(ctx, aseguradora.toUpperCase(), 520, 1)[0] ?? aseguradora;
      ctx.fillText(nombreAseg, ANCHO - 72, yPie + 28);
      ctx.textAlign = 'left';
    }
  }

  const blob = await new Promise<Blob | null>((resolver) => canvas.toBlob(resolver, 'image/png'));
  if (!blob) throw new Error('No se pudo generar la imagen de portada');

  const base = titulo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'capacitacion';

  return new File([blob], `portada-${base}.png`, { type: 'image/png' });
}

/**
 * Busca el logotipo oficial de una aseguradora en la base.
 * Devuelve null cuando no hay (entonces la portada escribe solo el nombre).
 */
export async function logoDeAseguradora(nombre: string): Promise<string | null> {
  const limpio = nombre.trim();
  if (!limpio) return null;

  const { data, error } = await supabase
    .from('aseguradoras')
    .select('nombre, nombre_corto, logo_url')
    .or(`nombre.ilike.%${limpio}%,nombre_corto.ilike.%${limpio}%`)
    .limit(1);

  if (error || !data?.length) return null;
  const logo = (data[0] as { logo_url: string | null }).logo_url;
  return logo?.trim() || null;
}