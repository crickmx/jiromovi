import { useState } from 'react';
import { ExternalLink, AlertCircle } from 'lucide-react';

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
    <div className="h-full flex flex-col bg-white">
      {/* Loading Indicator */}
      {isLoading && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-600">Cargando Multicotizador Digital...</p>
          </div>
        </div>
      )}

      {/* Error Fallback */}
      {hasError && (
        <div className="flex-1 flex items-center justify-center bg-slate-50 p-6">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">
              No se pudo cargar el Multicotizador Digital
            </h2>
            <p className="text-slate-600 mb-6">
              El contenido no está disponible en este momento. Por favor, abre el Multicotizador en una nueva pestaña.
            </p>
            <button
              onClick={openInNewTab}
              className="inline-flex items-center px-6 py-3 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors"
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

      {/* Quick Access Button */}
      {!hasError && (
        <div className="absolute bottom-6 right-6 z-20">
          <button
            onClick={openInNewTab}
            className="bg-white text-slate-700 px-4 py-2 rounded-lg shadow-lg border border-slate-200 hover:bg-slate-50 transition-colors flex items-center text-sm font-medium"
            title="Abrir en nueva pestaña"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Abrir en Nueva Pestaña
          </button>
        </div>
      )}
    </div>
  );
}
