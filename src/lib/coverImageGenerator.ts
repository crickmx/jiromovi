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
  lineHeight: number,
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

export async function generateCoverImage(options: CoverImageOptions): Promise<Blob> {
  const { backgroundUrl, titulo, aseguradoraNombre, aseguradoraLogoUrl } = options;

  const WIDTH = 1200;
  const HEIGHT = 675;

  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d')!;

  // Draw background image
  try {
    const bgImg = await loadImage(backgroundUrl);
    const scale = Math.max(WIDTH / bgImg.width, HEIGHT / bgImg.height);
    const drawW = bgImg.width * scale;
    const drawH = bgImg.height * scale;
    const offsetX = (WIDTH - drawW) / 2;
    const offsetY = (HEIGHT - drawH) / 2;
    ctx.drawImage(bgImg, offsetX, offsetY, drawW, drawH);
  } catch {
    // Fallback gradient if image fails
    const grad = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
    grad.addColorStop(0, '#1e3a5f');
    grad.addColorStop(1, '#0f2027');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  // Dark overlay gradient from bottom
  const overlay = ctx.createLinearGradient(0, HEIGHT * 0.25, 0, HEIGHT);
  overlay.addColorStop(0, 'rgba(0, 0, 0, 0)');
  overlay.addColorStop(0.4, 'rgba(0, 0, 0, 0.4)');
  overlay.addColorStop(1, 'rgba(0, 0, 0, 0.85)');
  ctx.fillStyle = overlay;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Top overlay for logo area
  const topOverlay = ctx.createLinearGradient(0, 0, 0, HEIGHT * 0.25);
  topOverlay.addColorStop(0, 'rgba(0, 0, 0, 0.6)');
  topOverlay.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = topOverlay;
  ctx.fillRect(0, 0, WIDTH, HEIGHT * 0.25);

  const padding = 48;

  // Draw insurer logo (top-left)
  if (aseguradoraLogoUrl) {
    try {
      const logoImg = await loadImage(aseguradoraLogoUrl);
      const maxLogoH = 56;
      const maxLogoW = 180;
      const logoScale = Math.min(maxLogoW / logoImg.width, maxLogoH / logoImg.height);
      const logoW = logoImg.width * logoScale;
      const logoH = logoImg.height * logoScale;

      // White background pill behind logo
      const pillPadX = 12;
      const pillPadY = 8;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.beginPath();
      const pillX = padding - pillPadX;
      const pillY = padding - pillPadY;
      const pillW = logoW + pillPadX * 2;
      const pillH = logoH + pillPadY * 2;
      const pillR = 8;
      ctx.moveTo(pillX + pillR, pillY);
      ctx.lineTo(pillX + pillW - pillR, pillY);
      ctx.quadraticCurveTo(pillX + pillW, pillY, pillX + pillW, pillY + pillR);
      ctx.lineTo(pillX + pillW, pillY + pillH - pillR);
      ctx.quadraticCurveTo(pillX + pillW, pillY + pillH, pillX + pillW - pillR, pillY + pillH);
      ctx.lineTo(pillX + pillR, pillY + pillH);
      ctx.quadraticCurveTo(pillX, pillY + pillH, pillX, pillY + pillH - pillR);
      ctx.lineTo(pillX, pillY + pillR);
      ctx.quadraticCurveTo(pillX, pillY, pillX + pillR, pillY);
      ctx.closePath();
      ctx.fill();

      ctx.drawImage(logoImg, padding, padding, logoW, logoH);
    } catch {
      // Skip logo if it fails to load
    }
  }

  // Draw aseguradora name (top-right)
  if (aseguradoraNombre) {
    ctx.font = '600 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(aseguradoraNombre, WIDTH - padding, padding + 4);
    ctx.textAlign = 'left';
  }

  // Draw title (bottom area)
  const titleMaxWidth = WIDTH - padding * 2;
  const titleFontSize = titulo.length > 80 ? 36 : titulo.length > 50 ? 42 : 48;
  const titleLineHeight = titleFontSize * 1.2;

  ctx.font = `700 ${titleFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.fillStyle = '#FFFFFF';
  ctx.textBaseline = 'top';

  const lines = wrapText(ctx, titulo, titleMaxWidth, titleLineHeight);
  const maxLines = 4;
  const displayLines = lines.slice(0, maxLines);
  if (lines.length > maxLines) {
    displayLines[maxLines - 1] = displayLines[maxLines - 1].replace(/\s*\S*$/, '...');
  }

  const totalTextHeight = displayLines.length * titleLineHeight;
  const titleStartY = HEIGHT - padding - totalTextHeight;

  // Accent bar before title
  ctx.fillStyle = '#0ea5e9';
  ctx.fillRect(padding, titleStartY - 16, 60, 4);

  ctx.fillStyle = '#FFFFFF';
  for (let i = 0; i < displayLines.length; i++) {
    ctx.fillText(displayLines[i], padding, titleStartY + i * titleLineHeight);
  }

  // "MOVI Digital" watermark bottom-right
  ctx.font = '500 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText('MOVI Digital', WIDTH - padding, HEIGHT - padding + 8);

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
