import { useState, useRef, useEffect } from 'react';
import { Upload, X, CircleAlert as AlertCircle, Image as ImageIcon } from 'lucide-react';
import { uploadUserLogo, deleteUserLogo, getEffectiveUserLogo } from '../lib/logoUtils';
import { trackLogoUpdated } from '../lib/activityLogger';

interface MiLogotipoEditorProps {
  userId: string;
  currentLogoUrl?: string | null;
  onLogoChange?: (newUrl: string | null) => void;
}

export function MiLogotipoEditor({ userId, currentLogoUrl, onLogoChange }: MiLogotipoEditorProps) {
  const [logoUrl, setLogoUrl] = useState<string | null>(currentLogoUrl || null);
  const [effectiveLogoUrl, setEffectiveLogoUrl] = useState<string>('/logojiro.png');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLogoUrl(currentLogoUrl || null);
  }, [currentLogoUrl]);

  useEffect(() => {
    loadEffectiveLogo();
  }, [userId, logoUrl]);

  const loadEffectiveLogo = async () => {
    const url = await getEffectiveUserLogo(userId);
    setEffectiveLogoUrl(url);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploading(true);

    const result = await uploadUserLogo(userId, file);

    if (result.success && result.url) {
      setLogoUrl(result.url);
      onLogoChange?.(result.url);
      trackLogoUpdated();
    } else {
      setError(result.error || 'Error al subir el logotipo');
    }

    setUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDelete = async () => {
    if (!confirm('¿Estás seguro de eliminar tu logotipo personal?')) return;

    setError(null);
    setUploading(true);

    const result = await deleteUserLogo(userId);

    if (result.success) {
      setLogoUrl(null);
      onLogoChange?.(null);
    } else {
      setError(result.error || 'Error al eliminar el logotipo');
    }

    setUploading(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-16 h-16 rounded-xl border border-neutral-200 dark:border-white/10 overflow-hidden bg-white dark:bg-white/5 flex items-center justify-center flex-shrink-0">
          {effectiveLogoUrl ? (
            <img
              src={effectiveLogoUrl}
              alt="Logotipo"
              className="w-full h-full object-contain p-1"
            />
          ) : (
            <ImageIcon className="w-7 h-7 text-neutral-300 dark:text-white/20" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-neutral-500 dark:text-white/50 leading-relaxed">
            Se usa en PDFs y materiales de marketing.
          </p>
          <p className="text-[10px] text-neutral-400 dark:text-white/30 mt-0.5">
            Mi Logo &rarr; Oficina &rarr; JIRO
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-xs bg-red-50 dark:bg-red-500/10 rounded-lg px-3 py-2">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-neutral-200 dark:border-white/10 text-neutral-700 dark:text-white/70 hover:bg-neutral-50 dark:hover:bg-white/5 transition disabled:opacity-50"
        >
          <Upload className="w-3.5 h-3.5" />
          {uploading ? 'Subiendo...' : logoUrl ? 'Cambiar' : 'Subir logo'}
        </button>

        {logoUrl && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={uploading}
            className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition disabled:opacity-50"
          >
            <X className="w-3.5 h-3.5" />
            Eliminar
          </button>
        )}
      </div>

      <p className="text-[10px] text-neutral-400 dark:text-white/30">
        PNG, JPG | Max 5MB | 1500x1500px
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}
