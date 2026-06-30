interface CoverImageOptions {
  backgroundUrl: string;
  titulo: string;
  aseguradoraNombre?: string;
  aseguradoraLogoUrl?: string;
  brandColor?: string;
  categoria?: string;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

async function fetchImageAsObjectUrl(url: string): Promise<string> {
  const resp = await fetch(url, { mode: 'cors' });
  if (!resp.ok) throw new Error('Failed to fetch image');
  const blob = await resp.blob();
  return URL.createObjectURL(blob);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : { r: 14, g: 99, b: 215 };
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export async function generateCoverImage(options: CoverImageOptions): Promise<Blob> {
  const {
    backgroundUrl,
    titulo,
    aseguradoraNombre,
    aseguradoraLogoUrl,
    brandColor = '#0e63d7',
    categoria,
  } = options;

  const WIDTH = 1200;
  const HEIGHT = 675;
  const cx = WIDTH / 2;

  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d')!;

  // ── Background ──────────────────────────────────────────────────────────────
  let bgLoaded = false;
  try {
    const objectUrl = await fetchImageAsObjectUrl(backgroundUrl);
    try {
      const bgImg = await loadImage(objectUrl);
      const scale = Math.max(WIDTH / bgImg.width, HEIGHT / bgImg.height);
      const drawW = bgImg.width * scale;
      const drawH = bgImg.height * scale;
      ctx.drawImage(bgImg, (WIDTH - drawW) / 2, (HEIGHT - drawH) / 2, drawW, drawH);
      bgLoaded = true;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    try {
      const bgImg = await loadImage(backgroundUrl);
      const scale = Math.max(WIDTH / bgImg.width, HEIGHT / bgImg.height);
      const drawW = bgImg.width * scale;
      const drawH = bgImg.height * scale;
      ctx.drawImage(bgImg, (WIDTH - drawW) / 2, (HEIGHT - drawH) / 2, drawW, drawH);
      bgLoaded = true;
    } catch {
      bgLoaded = false;
    }
  }

  if (!bgLoaded) {
    const grad = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
    grad.addColorStop(0, '#1e3a5f');
    grad.addColorStop(1, '#0f2027');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  // ── Bottom gradient overlay (heavy at bottom for text legibility) ────────────
  const bottomGrad = ctx.createLinearGradient(0, HEIGHT * 0.35, 0, HEIGHT);
  bottomGrad.addColorStop(0, 'rgba(0,0,0,0)');
  bottomGrad.addColorStop(0.5, 'rgba(0,0,0,0.45)');
  bottomGrad.addColorStop(1, 'rgba(0,0,0,0.88)');
  ctx.fillStyle = bottomGrad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const { r, g, b } = hexToRgb(brandColor);

  // ── Top accent bar ───────────────────────────────────────────────────────────
  ctx.fillStyle = brandColor;
  ctx.fillRect(0, 0, WIDTH, 5);

  // ── Top-left: insurer logo ───────────────────────────────────────────────────
  const topPad = 22;
  const logoAreaH = 64;

  if (aseguradoraLogoUrl) {
    try {
      let logoSrc = aseguradoraLogoUrl;
      try {
        logoSrc = await fetchImageAsObjectUrl(aseguradoraLogoUrl);
      } catch { /* use direct */ }

      const logoImg = await loadImage(logoSrc);
      const maxH = 44;
      const maxW = 200;
      const scale = Math.min(maxW / logoImg.width, maxH / logoImg.height);
      const logoW = logoImg.width * scale;
      const logoH = logoImg.height * scale;
      const logoX = 50;
      const logoY = topPad + (logoAreaH - logoH) / 2;

      // White pill behind logo
      const pX = 8, pY = 6;
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      drawRoundedRect(ctx, logoX - pX, logoY - pY, logoW + pX * 2, logoH + pY * 2, 8);
      ctx.fill();
      ctx.drawImage(logoImg, logoX, logoY, logoW, logoH);

      if (logoSrc !== aseguradoraLogoUrl) URL.revokeObjectURL(logoSrc);
    } catch { /* skip */ }
  } else if (aseguradoraNombre) {
    // Fallback: name badge
    ctx.font = 'bold 16px Arial, Helvetica, sans-serif';
    const textW = ctx.measureText(aseguradoraNombre).width;
    const badgeW = textW + 28;
    const badgeH = 36;
    const badgeX = 50;
    const badgeY = topPad + (logoAreaH - badgeH) / 2;

    ctx.fillStyle = brandColor;
    drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 18);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(aseguradoraNombre, badgeX + badgeW / 2, badgeY + badgeH / 2);
  }

  // ── Top-right: "MOVI Digital" label ─────────────────────────────────────────
  ctx.font = '500 14px Arial, Helvetica, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText('MOVI Digital', WIDTH - 50, topPad + logoAreaH / 2);

  // ── Calculate title layout ───────────────────────────────────────────────────
  const titleFontSize = titulo.length > 100 ? 34 : titulo.length > 70 ? 38 : titulo.length > 45 ? 44 : 50;
  const lineHeight = Math.round(titleFontSize * 1.25);
  const titleMaxWidth = WIDTH - 120;

  ctx.font = `bold ${titleFontSize}px Arial, Helvetica, sans-serif`;
  const rawLines = wrapText(ctx, titulo, titleMaxWidth);
  const maxLines = 3;
  const displayLines = rawLines.slice(0, maxLines);
  if (rawLines.length > maxLines) {
    const last = displayLines[maxLines - 1];
    displayLines[maxLines - 1] = last.length > 4 ? last.slice(0, -4) + '...' : last + '...';
  }

  const titleBlockH = displayLines.length * lineHeight;

  // Reserve bottom area: category badge (38) + gap (12) + title + date (28) + padding (32)
  const hasCategory = !!(categoria && categoria.trim());
  const categoryBadgeH = hasCategory ? 38 : 0;
  const categoryGap = hasCategory ? 14 : 0;
  const dateH = 24;
  const bottomPad = 40;

  const totalContentH = categoryBadgeH + categoryGap + titleBlockH + dateH + 16;
  const contentStartY = HEIGHT - bottomPad - totalContentH;

  // ── Category badge (centered) ────────────────────────────────────────────────
  if (hasCategory) {
    const catText = categoria!.toUpperCase();
    ctx.font = 'bold 13px Arial, Helvetica, sans-serif';
    const catW = ctx.measureText(catText).width + 36;
    const catH = categoryBadgeH;
    const catX = cx - catW / 2;
    const catY = contentStartY;

    ctx.fillStyle = `rgba(${r},${g},${b},0.92)`;
    drawRoundedRect(ctx, catX, catY, catW, catH, catH / 2);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(catText, cx, catY + catH / 2);
  }

  // ── Title (centered) ─────────────────────────────────────────────────────────
  const titleStartY = contentStartY + categoryBadgeH + categoryGap;

  ctx.font = `bold ${titleFontSize}px Arial, Helvetica, sans-serif`;
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.shadowColor = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 2;

  for (let i = 0; i < displayLines.length; i++) {
    ctx.fillText(displayLines[i], cx, titleStartY + i * lineHeight);
  }

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  // ── Date line (centered) ─────────────────────────────────────────────────────
  const dateY = titleStartY + titleBlockH + 16;
  const dateStr = new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
  ctx.font = '400 14px Arial, Helvetica, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(dateStr, cx, dateY);

  // ── Bottom accent line (centered) ────────────────────────────────────────────
  ctx.fillStyle = `rgba(${r},${g},${b},0.8)`;
  ctx.fillRect(cx - 40, HEIGHT - 10, 80, 4);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to generate cover image blob'));
      },
      'image/jpeg',
      0.92,
    );
  });
}
