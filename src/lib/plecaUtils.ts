// Genera la pleca de contacto (#AsesorJIRO) de cada agente a partir de la
// plantilla de marca fija en /pleca/pleca-template.png, insertando su nombre,
// telefono y correo en las zonas exactas donde el diseno original las trae.
// Coordenadas medidas sobre la plantilla original (4414x1230px).

export const PLECA_WIDTH = 4414;
export const PLECA_HEIGHT = 1230;
export const PLECA_TEMPLATE_URL = '/pleca/pleca-template.png';

interface ZonaTexto {
  x: number;
  xMax: number;
  yCenter: number;
  maxFontSize: number;
  minFontSize: number;
}

const ZONA_NOMBRE: ZonaTexto = { x: 2250, xMax: 4300, yCenter: 467, maxFontSize: 110, minFontSize: 48 };
const ZONA_TELEFONO: ZonaTexto = { x: 2395, xMax: 4300, yCenter: 624, maxFontSize: 100, minFontSize: 44 };
const ZONA_EMAIL: ZonaTexto = { x: 2399, xMax: 4300, yCenter: 800, maxFontSize: 90, minFontSize: 36 };

function ajustarFuenteYDibujar(ctx: CanvasRenderingContext2D, texto: string, zona: ZonaTexto) {
  const maxWidth = zona.xMax - zona.x;
  let fontSize = zona.maxFontSize;
  let display = texto;

  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';

  while (fontSize > zona.minFontSize) {
    ctx.font = `900 ${fontSize}px Gotham, sans-serif`;
    if (ctx.measureText(display).width <= maxWidth) break;
    fontSize -= 2;
  }

  ctx.font = `900 ${fontSize}px Gotham, sans-serif`;
  while (ctx.measureText(display).width > maxWidth && display.length > 1) {
    display = display.slice(0, -1);
  }
  if (display !== texto) display = display.replace(/.{3}$/, '...');

  ctx.fillText(display, zona.x, zona.yCenter);
}

async function cargarFuenteGotham() {
  try {
    await document.fonts.load('900 100px Gotham');
  } catch {
    // si falla la carga, el canvas cae a sans-serif
  }
}

export async function generarPlecaBlob(datos: {
  nombre: string;
  telefono: string;
  email: string;
}): Promise<Blob> {
  await cargarFuenteGotham();

  const img = new Image();
  img.crossOrigin = 'anonymous';
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('No se pudo cargar la plantilla de la pleca'));
    img.src = PLECA_TEMPLATE_URL;
  });

  const canvas = document.createElement('canvas');
  canvas.width = PLECA_WIDTH;
  canvas.height = PLECA_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo crear el canvas');

  ctx.drawImage(img, 0, 0, PLECA_WIDTH, PLECA_HEIGHT);

  if (datos.nombre) ajustarFuenteYDibujar(ctx, datos.nombre, ZONA_NOMBRE);
  if (datos.telefono) ajustarFuenteYDibujar(ctx, datos.telefono, ZONA_TELEFONO);
  if (datos.email) ajustarFuenteYDibujar(ctx, datos.email, ZONA_EMAIL);

  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('No se pudo generar la imagen de la pleca'));
    }, 'image/png');
  });
}

export function descargarBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
