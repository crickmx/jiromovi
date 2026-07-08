import { useState } from 'react';
import html2canvas from 'html2canvas';
import { ReportarBugModal } from './ReportarBugModal';

export function FloatingBugReportButton() {
  const [isHovered, setIsHovered] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [screenshot, setScreenshot] = useState<string | null>(null);

  const handleClick = async () => {
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

  return (
    <>
      <div className="fixed bottom-6 left-6 z-40">
        <button
          onClick={handleClick}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          disabled={capturing}
          className={`
            relative h-12 rounded-full text-white shadow-lg
            bg-gradient-to-r from-orange-500 via-amber-400 to-yellow-500
            bg-[length:200%_200%] animate-gradient-shift
            transition-all duration-300 ease-in-out
            flex items-center gap-2 group disabled:opacity-70
            ${isHovered ? 'px-5 w-auto' : 'w-12 px-0 justify-center'}
          `}
          aria-label="Reportar un problema o error"
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
