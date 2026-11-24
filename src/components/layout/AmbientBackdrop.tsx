/**
 * Fondo ambiental orgánico del área de contenido.
 * Formas de bajo contraste generadas del acento de la oficina (CSS vars),
 * fijas detrás de todo (z -1), sin animación continua y sin interacción.
 * Requiere que el shell NO pinte fondo propio (el fondo vive en <body>).
 */
export function AmbientBackdrop() {
  return (
    <div className="movi-ambient !fixed !z-[-1]" aria-hidden="true">
      <span className="movi-ambient__blob movi-ambient__blob--a" />
      <span className="movi-ambient__blob movi-ambient__blob--b" />
      <svg className="movi-ambient__wave" viewBox="0 0 1440 220" preserveAspectRatio="none" fill="currentColor">
        <path d="M0 0h1440v118c-142 38-278 58-430 44-176-16-282-86-470-80C364 88 218 150 0 132V0Z" />
        <path opacity=".55" d="M0 0h1440v62c-196 52-356 70-520 50C734 90 610 30 430 36 268 42 140 92 0 84V0Z" />
      </svg>
    </div>
  );
}
