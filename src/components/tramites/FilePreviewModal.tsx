import { useState, useEffect } from 'react';
import { X, Download, ZoomIn, ZoomOut, RotateCw, FileText, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface FilePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileName: string;
  fileUrl: string;
  fileType: string | null;
  fileSize: number | null;
}

// Detect mime type from file extension when the stored type is missing
function inferTypeFromName(nombre: string, url: string): string | null {
  const ext = (nombre.split('.').pop() || url.split('?')[0].split('.').pop() || '').toLowerCase();
  const map: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
    webp: 'image/webp', svg: 'image/svg+xml',
    pdf: 'application/pdf',
    mp4: 'video/mp4', mov: 'video/quicktime', avi: 'video/x-msvideo', webm: 'video/webm',
    mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav', m4a: 'audio/mp4',
    txt: 'text/plain', csv: 'text/csv', json: 'application/json', xml: 'application/xml',
  };
  return map[ext] || null;
}

// True if the URL belongs to Supabase Storage (can generate signed URLs)
function isSupabaseStorageUrl(url: string): boolean {
  return url.includes('/storage/v1/object/public/ticket-archivos/');
}

// Friendly display name — strip WhatsApp placeholder brackets
function displayName(nombre: string): string {
  const trimmed = nombre.trim();
  if (/^\[.+\]$/.test(trimmed)) return 'Archivo de WhatsApp';
  return trimmed;
}

export function FilePreviewModal({
  isOpen,
  onClose,
  fileName,
  fileUrl,
  fileType,
  fileSize
}: FilePreviewModalProps) {
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string>('');

  // Resolve effective file type: use stored type, fallback to extension inference
  const effectiveType = fileType || inferTypeFromName(fileName, fileUrl);
  const friendlyName = displayName(fileName);

  useEffect(() => {
    if (isOpen) {
      setZoom(100);
      setRotation(0);
      setLoading(true);
      setError(false);
      resolveUrl();
    }
  }, [isOpen, fileUrl]);

  const resolveUrl = async () => {
    // Non-Supabase URLs (e.g. Wazzup CDN): use directly, no signed URL needed
    if (!isSupabaseStorageUrl(fileUrl)) {
      setSignedUrl(fileUrl);
      return;
    }

    try {
      const urlObj = new URL(fileUrl);
      const pathParts = urlObj.pathname.split('/storage/v1/object/public/ticket-archivos/');

      if (pathParts.length > 1) {
        const filePath = decodeURIComponent(pathParts[1]);
        const { data, error: signError } = await supabase.storage
          .from('ticket-archivos')
          .createSignedUrl(filePath, 3600);

        if (!signError && data) {
          setSignedUrl(data.signedUrl);
          return;
        }
      }
      setSignedUrl(fileUrl); // fallback to public URL
    } catch {
      setSignedUrl(fileUrl);
    }
  };

  if (!isOpen) return null;

  const handleDownload = async () => {
    try {
      let downloadUrl = signedUrl || fileUrl;

      // Si no hay URL firmada aún, generarla
      if (!signedUrl) {
        const urlObj = new URL(fileUrl);
        const pathParts = urlObj.pathname.split('/storage/v1/object/public/ticket-archivos/');

        if (pathParts.length > 1) {
          const filePath = pathParts[1];
          const { data } = await supabase.storage
            .from('ticket-archivos')
            .createSignedUrl(filePath, 3600);

          if (data) {
            downloadUrl = data.signedUrl;
          }
        }
      }

      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = fileName;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error downloading file:', err);
      // Fallback: abrir en nueva pestaña
      window.open(fileUrl, '_blank');
    }
  };

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 25, 300));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 25, 50));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Desconocido';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  };

  const renderContent = () => {
    if (!signedUrl) {
      return (
        <div className="flex-1 flex items-center justify-center bg-neutral-50 rounded-xl">
          <div className="text-center space-y-4">
            <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-sm text-neutral-600">Preparando vista previa...</p>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex-1 flex items-center justify-center bg-neutral-50 rounded-xl">
          <div className="text-center space-y-4">
            <AlertCircle className="w-16 h-16 text-neutral-400 mx-auto" />
            <div>
              <p className="text-lg font-semibold text-neutral-900">No se pudo cargar el archivo</p>
              <p className="text-sm text-neutral-500 mt-1">La URL puede haber expirado o el archivo no está disponible</p>
            </div>
            <button
              onClick={handleDownload}
              className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg transition-all font-semibold inline-flex items-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>Intentar descargar</span>
            </button>
          </div>
        </div>
      );
    }

    // Imágenes
    if (effectiveType?.startsWith('image/')) {
      return (
        <div className="flex-1 flex items-center justify-center bg-neutral-50 rounded-xl overflow-hidden p-4">
          <div style={{ transform: `scale(${zoom / 100}) rotate(${rotation}deg)`, transition: 'transform 0.2s ease-in-out' }}>
            <img
              src={signedUrl}
              alt={friendlyName}
              className="max-w-full max-h-[70vh] object-contain"
              onLoad={() => setLoading(false)}
              onError={() => { setLoading(false); setError(true); }}
            />
          </div>
        </div>
      );
    }

    // PDFs
    if (effectiveType?.includes('pdf')) {
      return (
        <div className="flex-1 bg-neutral-50 rounded-xl overflow-hidden">
          <iframe
            src={`${signedUrl}#view=FitH`}
            className="w-full h-full min-h-[70vh]"
            title={friendlyName}
            onLoad={() => setLoading(false)}
            onError={() => { setLoading(false); setError(true); }}
          />
        </div>
      );
    }

    // Texto / JSON / XML
    if (effectiveType?.includes('text/') || effectiveType?.includes('json') || effectiveType?.includes('xml')) {
      return (
        <div className="flex-1 bg-neutral-50 rounded-xl overflow-hidden">
          <iframe
            src={signedUrl}
            className="w-full h-full min-h-[70vh]"
            title={friendlyName}
            onLoad={() => setLoading(false)}
            onError={() => { setLoading(false); setError(true); }}
          />
        </div>
      );
    }

    // Videos
    if (effectiveType?.startsWith('video/')) {
      return (
        <div className="flex-1 flex items-center justify-center bg-neutral-50 rounded-xl p-4">
          <video
            src={signedUrl}
            controls
            className="max-w-full max-h-[70vh]"
            onLoadedData={() => setLoading(false)}
            onError={() => { setLoading(false); setError(true); }}
          >
            Tu navegador no soporta el elemento de video.
          </video>
        </div>
      );
    }

    // Audio
    if (effectiveType?.startsWith('audio/')) {
      return (
        <div className="flex-1 flex items-center justify-center bg-neutral-50 rounded-xl">
          <div className="text-center space-y-6">
            <FileText className="w-16 h-16 text-neutral-400 mx-auto" />
            <div>
              <p className="text-lg font-semibold text-neutral-900">{friendlyName}</p>
              <p className="text-sm text-neutral-500 mt-1">{formatFileSize(fileSize)}</p>
            </div>
            <audio
              src={signedUrl}
              controls
              className="w-full max-w-md"
              onLoadedData={() => setLoading(false)}
              onError={() => { setLoading(false); setError(true); }}
            >
              Tu navegador no soporta el elemento de audio.
            </audio>
          </div>
        </div>
      );
    }

    // Tipo no previewable — mostrar info y botón de descarga (sin spinner)
    // Note: setLoading(false) called via useEffect below for this case
    return (
      <div className="flex-1 flex items-center justify-center bg-neutral-50 rounded-xl">
        <div className="text-center space-y-4">
          <FileText className="w-16 h-16 text-neutral-400 mx-auto" />
          <div>
            <p className="text-lg font-semibold text-neutral-900">{friendlyName}</p>
            {fileSize && <p className="text-sm text-neutral-500 mt-1">{formatFileSize(fileSize)}</p>}
            {effectiveType && <p className="text-xs text-neutral-400 mt-1 font-mono">{effectiveType}</p>}
          </div>
          <p className="text-sm text-neutral-600">Vista previa no disponible para este tipo de archivo</p>
          <button
            onClick={handleDownload}
            className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg transition-all font-semibold inline-flex items-center space-x-2"
          >
            <Download className="w-4 h-4" />
            <span>Descargar archivo</span>
          </button>
        </div>
      </div>
    );
  };

  // For non-previewable types, dismiss the loading spinner as soon as we have a URL
  useEffect(() => {
    if (!signedUrl) return;
    const previewable = effectiveType?.startsWith('image/') || effectiveType?.includes('pdf') ||
      effectiveType?.startsWith('video/') || effectiveType?.startsWith('audio/') ||
      effectiveType?.includes('text/') || effectiveType?.includes('json') || effectiveType?.includes('xml');
    if (!previewable) setLoading(false);
  }, [signedUrl, effectiveType]);

  const showControls = effectiveType?.startsWith('image/') && !error;

  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
          <div className="flex-1 min-w-0 mr-4">
            <h2 className="text-lg font-bold text-neutral-900 truncate" title={friendlyName}>
              {friendlyName}
            </h2>
            <p className="text-sm text-neutral-500">
              {formatFileSize(fileSize)}
              {effectiveType && <span className="ml-2 text-neutral-400 text-xs font-mono">{effectiveType}</span>}
            </p>
          </div>

          <div className="flex items-center space-x-2">
            {showControls && (
              <>
                <button
                  onClick={handleZoomOut}
                  className="p-2 hover:bg-neutral-100 rounded-lg transition-all"
                  title="Reducir zoom"
                >
                  <ZoomOut className="w-5 h-5 text-neutral-600" />
                </button>
                <span className="text-sm text-neutral-600 font-semibold min-w-[4rem] text-center">
                  {zoom}%
                </span>
                <button
                  onClick={handleZoomIn}
                  className="p-2 hover:bg-neutral-100 rounded-lg transition-all"
                  title="Aumentar zoom"
                >
                  <ZoomIn className="w-5 h-5 text-neutral-600" />
                </button>
                <button
                  onClick={handleRotate}
                  className="p-2 hover:bg-neutral-100 rounded-lg transition-all"
                  title="Rotar"
                >
                  <RotateCw className="w-5 h-5 text-neutral-600" />
                </button>
                <div className="w-px h-6 bg-neutral-300 mx-2" />
              </>
            )}
            <button
              onClick={handleDownload}
              className="p-2 hover:bg-neutral-100 rounded-lg transition-all"
              title="Descargar"
            >
              <Download className="w-5 h-5 text-neutral-600" />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-neutral-100 rounded-lg transition-all"
              title="Cerrar"
            >
              <X className="w-5 h-5 text-neutral-600" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-auto relative">
          {loading && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-neutral-50 rounded-xl">
              <div className="text-center space-y-4">
                <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-sm text-neutral-600">Cargando vista previa...</p>
              </div>
            </div>
          )}
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
