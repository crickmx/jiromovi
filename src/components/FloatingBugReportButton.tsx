import { useEffect, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { ReportarBugModal } from './ReportarBugModal';

const STORAGE_KEY = 'movi_bug_report_button_pos';
const MARGIN = 24; // igual al bottom-6/right-6 (1.5rem) que usaba antes
const HIT_SIZE = 48; // área de acción (clic/drag) — se mantiene grande
const VISUAL_SIZE = 38; // círculo visible, ~20% más chico que el área de acción
const DRAG_THRESHOLD = 4;
const MAGNET_RADIUS = 90; // px desde el centro donde empieza a "sentir" el cursor
const MAGNET_PULL = 14; // px máximo que se desplaza hacia el cursor

interface Pos { top: number; left: number }

function posPorDefecto(): Pos {
  return {
    top: window.innerHeight - HIT_SIZE - MARGIN,
    left: window.innerWidth - HIT_SIZE - MARGIN,
  };
}

function clamp(pos: Pos): Pos {
  return {
    top: Math.min(Math.max(pos.top, MARGIN), window.innerHeight - HIT_SIZE - MARGIN),
    left: Math.min(Math.max(pos.left, MARGIN), window.innerWidth - HIT_SIZE - MARGIN),
  };
}

function cargarPosGuardada(): Pos | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? clamp(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function FloatingBugReportButton() {
  const [capturing, setCapturing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [pos, setPos] = useState<Pos>(() => cargarPosGuardada() ?? posPorDefecto());
  const [isNear, setIsNear] = useState(false);

  const posRef = useRef(pos);
  posRef.current = pos;
  const btnRef = useRef<HTMLButtonElement>(null);
  const draggingRef = useRef(false);
  const movedRef = useRef(false);
  const wasNearRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, top: 0, left: 0 });

  useEffect(() => {
    const handleResize = () => setPos(prev => clamp(prev));
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Efecto "magnético": desplaza visualmente el botón hacia el cursor cuando se acerca.
  // Se mueve el transform directo por ref (no por estado) para no re-renderizar en cada mousemove.
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (draggingRef.current || !btnRef.current) return;
      const centerX = posRef.current.left + HIT_SIZE / 2;
      const centerY = posRef.current.top + HIT_SIZE / 2;
      const dx = e.clientX - centerX;
      const dy = e.clientY - centerY;
      const dist = Math.hypot(dx, dy);

      if (dist < MAGNET_RADIUS) {
        const strength = 1 - dist / MAGNET_RADIUS;
        const offsetX = dist === 0 ? 0 : (dx / dist) * MAGNET_PULL * strength;
        const offsetY = dist === 0 ? 0 : (dy / dist) * MAGNET_PULL * strength;
        btnRef.current.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
        if (!wasNearRef.current) { wasNearRef.current = true; setIsNear(true); }
      } else {
        btnRef.current.style.transform = 'translate(0px, 0px)';
        if (wasNearRef.current) { wasNearRef.current = false; setIsNear(false); }
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const handleReportar = async () => {
    setCapturing(true);
    try {
      const canvas = await html2canvas(document.body, { useCORS: true, allowTaint: true, logging: false });
      setScreenshot(canvas.toDataURL('image/png'));
    } catch {
      setScreenshot(null);
    } finally {
      setCapturing(false);
      setShowModal(true);
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    draggingRef.current = true;
    movedRef.current = false;
    dragStartRef.current = { x: e.clientX, y: e.clientY, top: pos.top, left: pos.left };
    if (btnRef.current) btnRef.current.style.transform = 'translate(0px, 0px)';
    wasNearRef.current = false;
    setIsNear(false);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!draggingRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) movedRef.current = true;
    if (movedRef.current) {
      setPos(clamp({ top: dragStartRef.current.top + dy, left: dragStartRef.current.left + dx }));
    }
  };

  const handlePointerUp = () => {
    if (draggingRef.current && movedRef.current) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(posRef.current));
    } else if (draggingRef.current) {
      handleReportar();
    }
    draggingRef.current = false;
  };

  // Hacia qué lado hay espacio para que el globo de texto crezca sin salirse de pantalla.
  const expandRight = pos.left + HIT_SIZE + 200 < window.innerWidth;

  return (
    <>
      <div className="fixed z-[9999]" style={{ top: pos.top, left: pos.left, width: HIT_SIZE, height: HIT_SIZE }}>
        <button
          ref={btnRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          disabled={capturing}
          style={{ touchAction: 'none' }}
          className="relative w-full h-full rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing select-none transition-transform duration-150 ease-out disabled:opacity-70"
          aria-label="Reportar un problema o error — arrastra para moverlo"
        >
          {/* Placeholder: aquí va una imagen/gif cuando esté listo, en vez del "!" */}
          <span
            style={{ width: VISUAL_SIZE, height: VISUAL_SIZE }}
            className={`
              rounded-full flex items-center justify-center text-white
              transition-all duration-300
              ${isNear
                ? 'bg-red-600 shadow-2xl scale-110 -translate-y-0.5 animate-alerta-pulso'
                : `shadow-lg bg-gradient-to-r from-orange-500 via-amber-400 to-yellow-500 bg-[length:200%_200%] ${capturing ? '' : 'animate-bug-btn-idle'}`}
            `}
          >
            {capturing ? (
              <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            ) : (
              <span className="font-black text-lg leading-none">!</span>
            )}
          </span>

          {/* Globo de texto: elemento propio que crece hacia el lado con espacio, sin cambiar
              el tamaño del área de clic/arrastre (esa era la causa del parpadeo anterior). */}
          <span
            className={`
              absolute top-1/2 -translate-y-1/2 h-8 rounded-full bg-neutral-900 text-white shadow-lg
              flex items-center overflow-hidden whitespace-nowrap pointer-events-none
              transition-all duration-300 ease-out
              ${isNear ? 'max-w-[180px] px-3 opacity-100' : 'max-w-0 px-0 opacity-0'}
            `}
            style={expandRight ? { left: '100%', marginLeft: 10 } : { right: '100%', marginRight: 10 }}
          >
            <span className="text-xs font-semibold">Reportar un problema</span>
          </span>
        </button>
      </div>

      {showModal && <ReportarBugModal screenshot={screenshot} onClose={() => setShowModal(false)} />}
    </>
  );
}
