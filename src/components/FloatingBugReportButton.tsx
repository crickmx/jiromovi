import { useEffect, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { ReportarBugModal } from './ReportarBugModal';

const STORAGE_KEY = 'movi_bug_report_button_pos';
const MARGIN = 24; // igual al bottom-6/right-6 (1.5rem) que usaba antes
const BUTTON_SIZE = 48; // h-12/w-12 colapsado
const DRAG_THRESHOLD = 4;

interface Pos { top: number; left: number }

function posPorDefecto(): Pos {
  return {
    top: window.innerHeight - BUTTON_SIZE - MARGIN,
    left: window.innerWidth - BUTTON_SIZE - MARGIN,
  };
}

function clamp(pos: Pos): Pos {
  return {
    top: Math.min(Math.max(pos.top, MARGIN), window.innerHeight - BUTTON_SIZE - MARGIN),
    left: Math.min(Math.max(pos.left, MARGIN), window.innerWidth - BUTTON_SIZE - MARGIN),
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
  const [isHovered, setIsHovered] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [pos, setPos] = useState<Pos>(() => cargarPosGuardada() ?? posPorDefecto());

  const posRef = useRef(pos);
  posRef.current = pos;
  const draggingRef = useRef(false);
  const movedRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, top: 0, left: 0 });

  useEffect(() => {
    const handleResize = () => setPos(prev => clamp(prev));
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
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

  return (
    <>
      <div className="fixed z-[9999]" style={{ top: pos.top, left: pos.left }}>
        <button
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          disabled={capturing}
          style={{ touchAction: 'none' }}
          className={`
            relative h-12 rounded-full text-white shadow-lg cursor-grab active:cursor-grabbing select-none
            bg-gradient-to-r from-orange-500 via-amber-400 to-yellow-500
            bg-[length:200%_200%] animate-gradient-shift
            transition-[width,padding] duration-300 ease-in-out
            flex items-center gap-2 group disabled:opacity-70
            ${isHovered ? 'px-5 w-auto' : 'w-12 px-0 justify-center'}
          `}
          aria-label="Reportar un problema o error — arrastra para moverlo"
        >
          {/* Placeholder: aquí va una imagen/gif cuando esté listo, en vez del "!" */}
          {capturing ? (
            <span className="flex-shrink-0 h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
          ) : (
            <span className="flex-shrink-0 font-black text-lg leading-none">!</span>
          )}
          <span
            className={`
              font-semibold text-sm whitespace-nowrap overflow-hidden transition-all duration-300
              ${isHovered ? 'max-w-[160px] opacity-100' : 'max-w-0 opacity-0'}
            `}
          >
            Reportar un problema
          </span>
        </button>
      </div>

      {showModal && <ReportarBugModal screenshot={screenshot} onClose={() => setShowModal(false)} />}
    </>
  );
}
