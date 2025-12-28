import { useState, useRef, useEffect } from 'react';
import { Upload, X, AlertCircle, Image as ImageIcon } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { uploadUserLogo, deleteUserLogo, getEffectiveUserLogo } from '../lib/logoUtils';

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
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Mi Logotipo</h3>

      <div className="space-y-4">
        <div className="flex items-start gap-4">
          {/* Vista previa del logotipo efectivo */}
          <div className="flex-shrink-0">
            <div className="w-32 h-32 border-2 border-gray-200 rounded-lg overflow-hidden bg-white flex items-center justify-center">
              {effectiveLogoUrl ? (
                <img
                  src={effectiveLogoUrl}
                  alt="Logotipo"
                  className="w-full h-full object-contain"
                />
              ) : (
                <ImageIcon className="w-12 h-12 text-gray-400" />
              )}
            </div>
            <p className="text-xs text-gray-500 mt-2 text-center">
              {logoUrl ? 'Tu logo' : 'Logo efectivo'}
            </p>
          </div>

          {/* Controles */}
          <div className="flex-1 space-y-3">
            <div>
              <p className="text-sm text-gray-600 mb-2">
                Sube tu logotipo personal. Se usará en PDFs y materiales de marketing.
              </p>
              <p className="text-xs text-gray-500">
                <strong>Jerarquía:</strong> Mi Logotipo → Logo de Oficina → Logo JIRO
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-600 text-sm">
                <AlertCircle className="w-4 h-4" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                variant="outline"
              >
                <Upload className="w-4 h-4 mr-2" />
                {logoUrl ? 'Cambiar logotipo' : 'Subir logotipo'}
              </Button>

              {logoUrl && (
                <Button
                  type="button"
                  onClick={handleDelete}
                  disabled={uploading}
                  variant="outline"
                >
                  <X className="w-4 h-4 mr-2" />
                  Eliminar
                </Button>
              )}
            </div>

            <p className="text-xs text-gray-500">
              Formatos: PNG, JPG, JPEG | Tamaño máx: 5MB | Se redimensionará a 1500x1500px
            </p>
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg"
        onChange={handleFileSelect}
        className="hidden"
      />
    </Card>
  );
}
