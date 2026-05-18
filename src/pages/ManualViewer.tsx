import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Maximize2, Minimize2, Download, Loader2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface Manual {
  id: string;
  title: string;
  slug: string;
  description: string;
  category: string;
  html_path: string | null;
  pdf_path: string | null;
}

export default function ManualViewer() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [manual, setManual] = useState<Manual | null>(null);
  const [loading, setLoading] = useState(true);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (slug) fetchManual();
  }, [slug]);

  async function fetchManual() {
    setLoading(true);
    const { data, error } = await supabase
      .from('manuals')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'active')
      .maybeSingle();

    if (!error && data) {
      setManual(data);
    }
    setLoading(false);
  }

  async function handleDownloadPdf() {
    if (!iframeRef.current?.contentDocument?.body || !manual) return;

    setGeneratingPdf(true);
    try {
      const iframeDoc = iframeRef.current.contentDocument;
      const body = iframeDoc.body;

      const originalOverflow = body.style.overflow;
      const originalHeight = body.style.height;
      const originalWidth = body.style.width;
      body.style.overflow = 'visible';
      body.style.height = 'auto';
      body.style.width = '900px';

      const canvas = await html2canvas(body, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        windowWidth: 900,
        scrollY: 0,
        scrollX: 0,
      });

      body.style.overflow = originalOverflow;
      body.style.height = originalHeight;
      body.style.width = originalWidth;

      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      const pdf = new jsPDF('p', 'mm', 'a4');
      let heightLeft = imgHeight;
      let position = 0;

      const imgData = canvas.toDataURL('image/jpeg', 0.92);

      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position -= pageHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const filename = `${manual.slug || 'manual'}.pdf`;
      pdf.save(filename);
    } catch (err) {
      console.error('Error generating PDF:', err);
      // Fallback: use browser print
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.print();
      }
    } finally {
      setGeneratingPdf(false);
    }
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement && containerRef.current) {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else if (document.fullscreenElement) {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-900">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-accent mx-auto mb-3" />
          <p className="text-sm text-neutral-500 dark:text-white/50">Cargando manual...</p>
        </div>
      </div>
    );
  }

  if (!manual) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-900">
        <div className="text-center max-w-sm">
          <h2 className="text-lg font-semibold text-neutral-800 dark:text-white mb-2">Manual no encontrado</h2>
          <p className="text-sm text-neutral-500 dark:text-white/50 mb-4">
            El manual que buscas no existe o no esta disponible.
          </p>
          <button
            onClick={() => navigate('/manuales')}
            className="px-4 py-2 bg-accent text-accent-foreground rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Volver a Manuales
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex flex-col h-screen bg-neutral-50 dark:bg-neutral-900">
      {/* Toolbar */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 bg-white dark:bg-neutral-800 border-b border-neutral-200 dark:border-white/10 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/manuales')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-neutral-600 dark:text-white/70 hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Volver</span>
          </button>
          <div className="hidden sm:block h-5 w-px bg-neutral-200 dark:bg-white/10" />
          <div className="hidden sm:block">
            <h1 className="text-sm font-semibold text-neutral-800 dark:text-white truncate max-w-[300px]">
              {manual.title}
            </h1>
            <p className="text-[11px] text-neutral-400 dark:text-white/40">{manual.category}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleDownloadPdf}
            disabled={generatingPdf || !iframeLoaded}
            title="Descargar PDF"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-neutral-600 dark:text-white/70 hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {generatingPdf ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="hidden sm:inline">Generando...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Descargar PDF</span>
              </>
            )}
          </button>
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
            className="p-2 rounded-lg text-neutral-500 dark:text-white/60 hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Generating PDF overlay */}
      {generatingPdf && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-800 rounded-2xl p-6 shadow-xl text-center">
            <Loader2 className="w-8 h-8 animate-spin text-accent mx-auto mb-3" />
            <p className="text-sm font-medium text-neutral-700 dark:text-white">Generando PDF...</p>
            <p className="text-xs text-neutral-400 dark:text-white/40 mt-1">Esto puede tomar unos segundos</p>
          </div>
        </div>
      )}

      {/* Iframe viewer */}
      <div className="flex-1 relative">
        {!iframeLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-neutral-50 dark:bg-neutral-900 z-10">
            <div className="text-center">
              <Loader2 className="w-6 h-6 animate-spin text-accent mx-auto mb-2" />
              <p className="text-xs text-neutral-400">Cargando contenido...</p>
            </div>
          </div>
        )}
        {manual.html_path && (
          <iframe
            ref={iframeRef}
            src={manual.html_path}
            title={manual.title}
            className="w-full h-full border-0"
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
            onLoad={() => setIframeLoaded(true)}
          />
        )}
      </div>
    </div>
  );
}
