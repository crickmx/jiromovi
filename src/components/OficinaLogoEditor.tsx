import { useState, useRef, useEffect } from 'react';
import { Upload, X, AlertCircle, Image as ImageIcon, Users } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { uploadOfficeLogo, deleteOfficeLogo, countUsersAffectedByOfficeLogo } from '../lib/logoUtils';

interface OficinaLogoEditorProps {
  officeId: string;
  officeName: string;
  currentLogoUrl?: string | null;
  onLogoChange?: (newUrl: string | null) => void;
}

export function OficinaLogoEditor({
  officeId,
  officeName,
  currentLogoUrl,
  onLogoChange
}: OficinaLogoEditorProps) {
  const [logoUrl, setLogoUrl] = useState<string | null>(currentLogoUrl || null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [affectedUsers, setAffectedUsers] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLogoUrl(currentLogoUrl || null);
  }, [currentLogoUrl]);

  useEffect(() => {
    loadAffectedUsersCount();
  }, [officeId]);

  const loadAffectedUsersCount = async () => {
    const count = await countUsersAffectedByOfficeLogo(officeId);
    setAffectedUsers(count);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploading(true);

    const result = await uploadOfficeLogo(officeId, file);

    if (result.success && result.url) {
      setLogoUrl(result.url);
      onLogoChange?.(result.url);
      await loadAffectedUsersCount();
    } else {
      setError(result.error || 'Error al subir el logotipo');
    }

    setUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDelete = async () => {
    const message = affectedUsers > 0
      ? `¿Estás seguro de eliminar el logotipo de ${officeName}? Esto afectará a ${affectedUsers} usuario(s) sin logo personal.`
      : `¿Estás seguro de eliminar el logotipo de ${officeName}?`;

    if (!confirm(message)) return;

    setError(null);
    setUploading(true);

    const result = await deleteOfficeLogo(officeId);

    if (result.success) {
      setLogoUrl(null);
      onLogoChange?.(null);
      await loadAffectedUsersCount();
    } else {
      setError(result.error || 'Error al eliminar el logotipo');
    }

    setUploading(false);
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Logo de Oficina: {officeName}</h3>

      <div className="space-y-4">
        <div className="flex items-start gap-4">
          {/* Vista previa del logotipo */}
          <div className="flex-shrink-0">
            <div className="w-32 h-32 border-2 border-gray-200 rounded-lg overflow-hidden bg-white flex items-center justify-center">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={`Logo de ${officeName}`}
                  className="w-full h-full object-contain"
                />
              ) : (
                <ImageIcon className="w-12 h-12 text-gray-400" />
              )}
            </div>
          </div>

          {/* Controles */}
          <div className="flex-1 space-y-3">
            <div>
              <p className="text-sm text-gray-600 mb-2">
                Logo de oficina para usuarios sin logotipo personal.
              </p>
              {affectedUsers > 0 && (
                <div className="flex items-center gap-2 text-accent text-sm">
                  <Users className="w-4 h-4" />
                  <span>
                    {affectedUsers} usuario{affectedUsers !== 1 ? 's' : ''} usarán este logo
                  </span>
                </div>
              )}
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
