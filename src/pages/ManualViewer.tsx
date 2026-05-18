import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Maximize2, Minimize2, Download, Loader2, ZoomIn, ZoomOut, BookOpen, List, X, ChevronRight } from 'lucide-react';
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
  total_pages: number;
}

interface Chapter {
  id: string;
  title: string;
  page_number: number;
  sort_order: number;
  anchor: string | null;
  parent_id: string | null;
}

export default function ManualViewer() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [manual, setManual] = useState<Manual | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfProgress, setPdfProgress] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeChapter, setActiveChapter] = useState<string | null>(null);
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
      fetchChapters(data.id);
    } else {
      setLoading(false);
    }
  }

  async function fetchChapters(manualId: string) {
    const { data } = await supabase
      .from('manual_chapters')
      .select('*')
      .eq('manual_id', manualId)
      .order('sort_order', { ascending: true });

    if (data) {
      setChapters(data);
      if (data.length > 0) setActiveChapter(data[0].id);
    }
    setLoading(false);
  }

  function handleChapterClick(chapter: Chapter) {
    setActiveChapter(chapter.id);
    // Try to scroll within iframe if anchor is set
    if (chapter.anchor && iframeRef.current?.contentDocument) {
      const el = iframeRef.current.contentDocument.querySelector(`#${chapter.anchor}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
    // On mobile, close sidebar after selection
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  }

  const handleZoomIn = useCallback(() => {
    setZoom(prev => Math.min(prev + 15, 200));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(prev => Math.max(prev - 15, 50));
  }, []);

  const handleZoomReset = useCallback(() => {
    setZoom(100);
  }, []);

  useEffect(() => {
    if (iframeRef.current && iframeLoaded) {
      const iframeDoc = iframeRef.current.contentDocument;
      if (iframeDoc?.body) {
        iframeDoc.body.style.transform = `scale(${zoom / 100})`;
        iframeDoc.body.style.transformOrigin = 'top center';
        iframeDoc.body.style.width = `${10000 / zoom}%`;
      }
    }
  }, [zoom, iframeLoaded]);

  async function handleDownloadPdf() {
    if (!iframeRef.current?.contentDocument?.body || !manual) return;

    setGeneratingPdf(true);
    setPdfProgress(0);

    try {
      const iframeDoc = iframeRef.current.contentDocument;
      const body = iframeDoc.body;

      const originalStyles = {
        overflow: body.style.overflow,
        height: body.style.height,
        width: body.style.width,
        transform: body.style.transform,
        transformOrigin: body.style.transformOrigin,
      };

      body.style.overflow = 'visible';
      body.style.height = 'auto';
      body.style.width = '794px';
      body.style.transform = 'none';
      body.style.transformOrigin = 'top left';

      await new Promise(r => setTimeout(r, 400));

      const totalHeight = body.scrollHeight;
      const captureWidth = 794;
      const pageHeightPx = 1123;
      const totalPages = Math.ceil(totalHeight / pageHeightPx);

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = 210;

      for (let page = 0; page < totalPages; page++) {
        setPdfProgress(Math.round(((page + 1) / totalPages) * 100));

        const canvas = await html2canvas(body, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          logging: false,
          width: captureWidth,
          height: Math.min(pageHeightPx, totalHeight - page * pageHeightPx),
          windowWidth: captureWidth,
          x: 0,
          y: page * pageHeightPx,
          scrollX: 0,
          scrollY: 0,
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.92);
        const imgHeight = (canvas.height * pdfWidth) / canvas.width;

        if (page > 0) pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, imgHeight);
      }

      Object.assign(body.style, originalStyles);

      pdf.save(`${manual.slug || 'manual'}.pdf`);
    } catch (err) {
      console.error('Error generating PDF:', err);
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.print();
      }
    } finally {
      setGeneratingPdf(false);
      setPdfProgress(0);
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

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === '=' || e.key === '+') { e.preventDefault(); handleZoomIn(); }
        if (e.key === '-') { e.preventDefault(); handleZoomOut(); }
        if (e.key === '0') { e.preventDefault(); handleZoomReset(); }
      }
      if (e.key === 'Escape' && isFullscreen) {
        document.exitFullscreen();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleZoomIn, handleZoomOut, handleZoomReset, isFullscreen]);

  // Desktop sidebar auto-open if chapters exist
  useEffect(() => {
    if (chapters.length > 0 && window.innerWidth >= 1024) {
      setSidebarOpen(true);
    }
  }, [chapters]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-900">
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mx-auto">
            <BookOpen className="w-7 h-7 text-blue-600 dark:text-blue-400 animate-pulse" />
          </div>
          <p className="text-sm text-neutral-500 dark:text-white/50">Cargando manual...</p>
        </div>
      </div>
    );
  }

  if (!manual) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-50 dark:bg-neutral-900 px-4">
        <div className="text-center max-w-sm space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center mx-auto">
            <BookOpen className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-lg font-semibold text-neutral-800 dark:text-white">Manual no encontrado</h2>
          <p className="text-sm text-neutral-500 dark:text-white/50">
            El manual que buscas no existe o no esta disponible.
          </p>
          <button
            onClick={() => navigate('/manuales')}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent text-accent-foreground rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver a Manuales
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex flex-col h-screen bg-neutral-100 dark:bg-neutral-900">
      {/* Top toolbar */}
      <header className="flex-shrink-0 bg-white dark:bg-neutral-800 border-b border-neutral-200 dark:border-white/10 shadow-sm z-30">
        <div className="flex items-center justify-between h-12 sm:h-14 px-3 sm:px-4">
          {/* Left: Back + Sidebar toggle + Title */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 flex-1">
            <button
              onClick={() => navigate('/manuales')}
              className="flex-shrink-0 flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg text-sm text-neutral-600 dark:text-white/70 hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors"
              title="Volver al catalogo"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline text-xs font-medium">Manuales</span>
            </button>

            {chapters.length > 0 && (
              <>
                <div className="h-5 w-px bg-neutral-200 dark:bg-white/10 flex-shrink-0" />
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className={`flex-shrink-0 p-2 rounded-lg transition-colors ${
                    sidebarOpen
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                      : 'text-neutral-500 dark:text-white/60 hover:bg-neutral-100 dark:hover:bg-white/10'
                  }`}
                  title={sidebarOpen ? 'Ocultar indice' : 'Mostrar indice'}
                >
                  <List className="w-4 h-4" />
                </button>
              </>
            )}

            <div className="min-w-0 hidden md:block">
              <h1 className="text-sm font-semibold text-neutral-800 dark:text-white truncate">
                {manual.title}
              </h1>
            </div>
          </div>

          {/* Center: Zoom (desktop) */}
          <div className="hidden lg:flex items-center gap-1 bg-neutral-100 dark:bg-white/5 rounded-lg p-0.5">
            <button
              onClick={handleZoomOut}
              disabled={zoom <= 50}
              className="p-1.5 rounded-md text-neutral-500 dark:text-white/60 hover:bg-white dark:hover:bg-white/10 transition-colors disabled:opacity-30"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleZoomReset}
              className="px-2 py-1 rounded-md text-xs font-medium text-neutral-600 dark:text-white/60 hover:bg-white dark:hover:bg-white/10 transition-colors min-w-[40px] text-center"
            >
              {zoom}%
            </button>
            <button
              onClick={handleZoomIn}
              disabled={zoom >= 200}
              className="p-1.5 rounded-md text-neutral-500 dark:text-white/60 hover:bg-white dark:hover:bg-white/10 transition-colors disabled:opacity-30"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
            {/* Mobile zoom */}
            <div className="flex lg:hidden items-center gap-0.5">
              <button onClick={handleZoomOut} disabled={zoom <= 50} className="p-1.5 rounded-lg text-neutral-500 dark:text-white/60 hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors disabled:opacity-30">
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-[10px] font-medium text-neutral-400 min-w-[28px] text-center">{zoom}%</span>
              <button onClick={handleZoomIn} disabled={zoom >= 200} className="p-1.5 rounded-lg text-neutral-500 dark:text-white/60 hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors disabled:opacity-30">
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>

            <div className="h-5 w-px bg-neutral-200 dark:bg-white/10 mx-0.5" />

            <button
              onClick={handleDownloadPdf}
              disabled={generatingPdf || !iframeLoaded}
              title="Descargar como PDF"
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
            >
              {generatingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span className="hidden sm:inline text-xs">{generatingPdf ? 'Generando...' : 'PDF'}</span>
            </button>

            <button
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Salir (Esc)' : 'Pantalla completa'}
              className="p-2 rounded-lg text-neutral-500 dark:text-white/60 hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main content with sidebar */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Sidebar - Table of Contents */}
        {chapters.length > 0 && (
          <>
            {/* Mobile overlay */}
            {sidebarOpen && (
              <div
                className="lg:hidden fixed inset-0 bg-black/30 z-30"
                onClick={() => setSidebarOpen(false)}
              />
            )}

            {/* Sidebar panel */}
            <aside
              className={`
                ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:-translate-x-full'}
                fixed lg:relative z-40 lg:z-auto
                w-72 sm:w-80 lg:w-72 xl:w-80
                h-full
                bg-white dark:bg-neutral-800
                border-r border-neutral-200 dark:border-white/10
                shadow-xl lg:shadow-none
                transition-transform duration-300 ease-out
                flex flex-col
              `}
            >
              {/* Sidebar header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100 dark:border-white/5">
                <div className="min-w-0">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-white/40 truncate">
                    {manual.title}
                  </h2>
                  {manual.total_pages > 0 && (
                    <p className="text-[11px] text-neutral-400 dark:text-white/30 mt-0.5">
                      {manual.total_pages} paginas
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="lg:hidden p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Chapter list */}
              <nav className="flex-1 overflow-y-auto py-2 px-2">
                <ul className="space-y-0.5">
                  {chapters.map((chapter, index) => {
                    const isActive = activeChapter === chapter.id;
                    return (
                      <li key={chapter.id}>
                        <button
                          onClick={() => handleChapterClick(chapter)}
                          className={`
                            w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200
                            ${isActive
                              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 shadow-sm'
                              : 'text-neutral-600 dark:text-white/60 hover:bg-neutral-50 dark:hover:bg-white/5 hover:text-neutral-900 dark:hover:text-white'
                            }
                          `}
                        >
                          {/* Page number indicator */}
                          <span className={`
                            flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold
                            ${isActive
                              ? 'bg-blue-100 dark:bg-blue-800/40 text-blue-600 dark:text-blue-300'
                              : 'bg-neutral-100 dark:bg-white/5 text-neutral-400 dark:text-white/30'
                            }
                          `}>
                            {String(index + 1).padStart(2, '0')}
                          </span>

                          {/* Title */}
                          <span className={`text-[13px] leading-tight flex-1 ${isActive ? 'font-semibold' : 'font-medium'}`}>
                            {chapter.title}
                          </span>

                          {/* Active indicator */}
                          {isActive && (
                            <ChevronRight className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </nav>

              {/* Sidebar footer */}
              <div className="flex-shrink-0 px-4 py-3 border-t border-neutral-100 dark:border-white/5">
                <button
                  onClick={handleDownloadPdf}
                  disabled={generatingPdf || !iframeLoaded}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-neutral-100 dark:bg-white/5 hover:bg-neutral-200 dark:hover:bg-white/10 rounded-xl text-sm font-medium text-neutral-700 dark:text-white/70 transition-colors disabled:opacity-40"
                >
                  <Download className="w-4 h-4" />
                  Descargar PDF
                </button>
              </div>
            </aside>
          </>
        )}

        {/* PDF Generation overlay */}
        {generatingPdf && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white dark:bg-neutral-800 rounded-2xl p-6 shadow-2xl text-center max-w-xs mx-4 w-full">
              <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mx-auto mb-4">
                <Download className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <p className="text-sm font-semibold text-neutral-800 dark:text-white mb-1">Generando PDF</p>
              <p className="text-xs text-neutral-400 dark:text-white/40 mb-4">Capturando paginas del manual...</p>
              <div className="w-full h-2 bg-neutral-100 dark:bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${pdfProgress}%` }}
                />
              </div>
              <p className="text-[11px] text-neutral-400 dark:text-white/30 mt-2">{pdfProgress}% completado</p>
            </div>
          </div>
        )}

        {/* Iframe viewer area */}
        <div className="flex-1 relative overflow-hidden">
          {!iframeLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-neutral-100 dark:bg-neutral-900 z-10">
              <div className="text-center space-y-3">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600 dark:text-blue-400 mx-auto" />
                <p className="text-xs text-neutral-400 dark:text-white/40">Cargando contenido del manual...</p>
              </div>
            </div>
          )}
          {manual.html_path && (
            <iframe
              ref={iframeRef}
              src={manual.html_path}
              title={manual.title}
              className="w-full h-full border-0 bg-white"
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
              onLoad={() => setIframeLoaded(true)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
