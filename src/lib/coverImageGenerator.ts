interface CoverImageOptions {
  backgroundUrl: string;
  titulo: string;
  aseguradoraNombre?: string;
  aseguradoraLogoUrl?: string;
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
  const resp = await fetch(url);
  if (!resp.ok) throw new Error('Failed to fetch image');
  const blob = await resp.blob();
  return URL.createObjectURL(blob);
}

export async function generateCoverImage(options: CoverImageOptions): Promise<Blob> {
  const { backgroundUrl, titulo, aseguradoraNombre, aseguradoraLogoUrl } = options;

  const WIDTH = 1200;
  const HEIGHT = 675;

  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d')!;

  // Draw background image - try fetching as blob first to avoid CORS
  let bgLoaded = false;
  try {
    // Try loading via object URL (avoids tainted canvas from cross-origin)
    const objectUrl = await fetchImageAsObjectUrl(backgroundUrl);
    try {
      const bgImg = await loadImage(objectUrl);
      const scale = Math.max(WIDTH / bgImg.width, HEIGHT / bgImg.height);
      const drawW = bgImg.width * scale;
      const drawH = bgImg.height * scale;
      const offsetX = (WIDTH - drawW) / 2;
      const offsetY = (HEIGHT - drawH) / 2;
      ctx.drawImage(bgImg, offsetX, offsetY, drawW, drawH);
      bgLoaded = true;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    // Try direct load as fallback
    try {
      const bgImg = await loadImage(backgroundUrl);
      const scale = Math.max(WIDTH / bgImg.width, HEIGHT / bgImg.height);
      const drawW = bgImg.width * scale;
      const drawH = bgImg.height * scale;
      const offsetX = (WIDTH - drawW) / 2;
      const offsetY = (HEIGHT - drawH) / 2;
      ctx.drawImage(bgImg, offsetX, offsetY, drawW, drawH);
      bgLoaded = true;
    } catch {
      bgLoaded = false;
    }
  }

  if (!bgLoaded) {
    // Fallback gradient
    const grad = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
    grad.addColorStop(0, '#1e3a5f');
    grad.addColorStop(0.5, '#0d2847');
    grad.addColorStop(1, '#0f2027');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  // Slight darkening over entire image
  ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const padding = 48;

  // --- SOLID BOTTOM BAND for title (always readable) ---
  const bandHeight = 200;
  const bandY = HEIGHT - bandHeight;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
  ctx.fillRect(0, bandY, WIDTH, bandHeight);

  // Blend gradient above band
  const blendGrad = ctx.createLinearGradient(0, bandY - 40, 0, bandY);
  blendGrad.addColorStop(0, 'rgba(15, 23, 42, 0)');
  blendGrad.addColorStop(1, 'rgba(15, 23, 42, 0.92)');
  ctx.fillStyle = blendGrad;
  ctx.fillRect(0, bandY - 40, WIDTH, 40);

  // --- TOP BAR for logo/branding (solid) ---
  const topBarHeight = 72;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.fillRect(0, 0, WIDTH, topBarHeight);

  const topBlend = ctx.createLinearGradient(0, topBarHeight, 0, topBarHeight + 20);
  topBlend.addColorStop(0, 'rgba(15, 23, 42, 0.85)');
  topBlend.addColorStop(1, 'rgba(15, 23, 42, 0)');
  ctx.fillStyle = topBlend;
  ctx.fillRect(0, topBarHeight, WIDTH, 20);

  // --- Draw insurer logo (top-left) ---
  let logoRightEdge = padding;
  if (aseguradoraLogoUrl) {
    try {
      let logoSrc = aseguradoraLogoUrl;
      try {
        const logoObjectUrl = await fetchImageAsObjectUrl(aseguradoraLogoUrl);
        logoSrc = logoObjectUrl;
      } catch { /* use direct URL */ }

      const logoImg = await loadImage(logoSrc);
      const maxLogoH = 40;
      const maxLogoW = 160;
      const logoScale = Math.min(maxLogoW / logoImg.width, maxLogoH / logoImg.height);
      const logoW = logoImg.width * logoScale;
      const logoH = logoImg.height * logoScale;
      const logoY = (topBarHeight - logoH) / 2;

      // White pill background
      const pillPadX = 10;
      const pillPadY = 6;
      const pillR = 6;
      const pillX = padding - pillPadX;
      const pillYPos = logoY - pillPadY;
      const pillW = logoW + pillPadX * 2;
      const pillH = logoH + pillPadY * 2;

      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.beginPath();
      ctx.moveTo(pillX + pillR, pillYPos);
      ctx.lineTo(pillX + pillW - pillR, pillYPos);
      ctx.quadraticCurveTo(pillX + pillW, pillYPos, pillX + pillW, pillYPos + pillR);
      ctx.lineTo(pillX + pillW, pillYPos + pillH - pillR);
      ctx.quadraticCurveTo(pillX + pillW, pillYPos + pillH, pillX + pillW - pillR, pillYPos + pillH);
      ctx.lineTo(pillX + pillR, pillYPos + pillH);
      ctx.quadraticCurveTo(pillX, pillYPos + pillH, pillX, pillYPos + pillH - pillR);
      ctx.lineTo(pillX, pillYPos + pillR);
      ctx.quadraticCurveTo(pillX, pillYPos, pillX + pillR, pillYPos);
      ctx.closePath();
      ctx.fill();

      ctx.drawImage(logoImg, padding, logoY, logoW, logoH);
      logoRightEdge = padding + logoW + pillPadX + 16;

      if (logoSrc !== aseguradoraLogoUrl) URL.revokeObjectURL(logoSrc);
    } catch {
      // Skip logo
    }
  }

  // --- Aseguradora name (top bar) ---
  if (aseguradoraNombre) {
    ctx.font = '600 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(aseguradoraNombre, aseguradoraLogoUrl ? logoRightEdge : padding, topBarHeight / 2);
  }

  // "MOVI Digital" (top-right)
  ctx.font = '500 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText('MOVI Digital', WIDTH - padding, topBarHeight / 2);
  ctx.textAlign = 'left';

  // --- Draw title (bottom band) ---
  const titleMaxWidth = WIDTH - padding * 2;
  const titleFontSize = titulo.length > 100 ? 34 : titulo.length > 70 ? 38 : titulo.length > 45 ? 44 : 50;
  const titleLineHeight = titleFontSize * 1.25;

  ctx.font = `700 ${titleFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.fillStyle = '#FFFFFF';
  ctx.textBaseline = 'top';

  const lines = wrapText(ctx, titulo, titleMaxWidth);
  const maxLines = 3;
  const displayLines = lines.slice(0, maxLines);
  if (lines.length > maxLines) {
    const lastLine = displayLines[maxLines - 1];
    displayLines[maxLines - 1] = lastLine.length > 3 ? lastLine.slice(0, -3) + '...' : lastLine + '...';
  }

  const totalTextHeight = displayLines.length * titleLineHeight;
  const titleStartY = bandY + (bandHeight - totalTextHeight) / 2;

  // Accent bar
  ctx.fillStyle = '#0ea5e9';
  ctx.fillRect(padding, titleStartY - 12, 50, 4);

  // Title with shadow
  ctx.fillStyle = '#FFFFFF';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;

  for (let i = 0; i < displayLines.length; i++) {
    ctx.fillText(displayLines[i], padding, titleStartY + i * titleLineHeight);
  }

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

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
