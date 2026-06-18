import { useState } from 'react';
import { ExternalLink, AlertCircle, Calculator } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';

export default function MulticotizadorDigital() {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  const handleIframeError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  const openInNewTab = () => {
    window.open('https://www.multicotizador.digital/', '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-neutral-900">
      {/* Page Header */}
      <div className="px-4 pt-4 pb-2">
        <PageHeader
          title="Multicotizador Digital"
          description="Herramienta de cotización integrada"
          icon={Calculator}
          actions={
            <button
              onClick={openInNewTab}
              className="inline-flex items-center px-4 py-2 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors text-sm font-medium"
              title="Abrir en nueva pestaña"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Abrir en Nueva Pestaña
            </button>
          }
        />
      </div>

      {/* Loading Indicator */}
      {isLoading && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-neutral-900 z-10">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-neutral-600 dark:text-neutral-400">Cargando Multicotizador Digital...</p>
          </div>
        </div>
      )}

      {/* Error Fallback */}
      {hasError && (
        <div className="flex-1 flex items-center justify-center bg-neutral-50 dark:bg-neutral-900 p-6">
          <div className="max-w-md w-full bg-white dark:bg-neutral-800 rounded-lg shadow-lg p-8 text-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white mb-2">
              No se pudo cargar el Multicotizador Digital
            </h2>
            <p className="text-neutral-600 dark:text-neutral-400 mb-6">
              El contenido no está disponible en este momento. Por favor, abre el Multicotizador en una nueva pestaña.
            </p>
            <button
              onClick={openInNewTab}
              className="inline-flex items-center px-6 py-3 bg-accent text-white font-medium rounded-lg hover:bg-accent-hover transition-colors"
            >
              <ExternalLink className="w-5 h-5 mr-2" />
              Abrir en Nueva Pestaña
            </button>
          </div>
        </div>
      )}

      {/* Iframe Container */}
      <div className="flex-1 relative">
        <iframe
          src="https://www.multicotizador.digital/"
          title="Multicotizador Digital"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
          allow="camera; microphone; clipboard-read; clipboard-write; geolocation"
          onLoad={handleIframeLoad}
          onError={handleIframeError}
          className={`w-full h-full border-0 ${isLoading || hasError ? 'hidden' : 'block'}`}
          style={{
            minHeight: '100vh',
          }}
        />
      </div>
    </div>
  );
}
