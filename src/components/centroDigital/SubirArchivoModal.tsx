import { useState } from 'react';
import { X, Upload, File, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { subirArchivo } from '../../lib/centroDigitalUtils';

interface SubirArchivoModalProps {
  carpetaId: string;
  carpetaNombre: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function SubirArchivoModal({
  carpetaId,
  carpetaNombre,
  onClose,
  onSuccess
}: SubirArchivoModalProps) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [nombre, setNombre] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [progreso, setProgreso] = useState(0);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setArchivo(file);
      setNombre(file.name.replace(/\.[^/.]+$/, ''));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!archivo || !nombre.trim()) {
      setError('Selecciona un archivo y proporciona un nombre');
      return;
    }

    setLoading(true);
    setError('');
    setProgreso(0);

    try {
      const progressInterval = setInterval(() => {
        setProgreso((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      await subirArchivo({
        file: archivo,
        nombre: nombre.trim(),
        carpeta_id: carpetaId
      });

      clearInterval(progressInterval);
      setProgreso(100);

      setTimeout(() => {
        onSuccess();
      }, 500);
    } catch (err: any) {
      setError(err.message);
      setProgreso(0);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        <div className="border-b px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Upload className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Subir archivo</h2>
              <p className="text-sm text-gray-500">A: {carpetaNombre}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={loading}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-900">Error</p>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="archivo">Seleccionar archivo *</Label>
            <div className="mt-2">
              <label className="block">
                <input
                  type="file"
                  id="archivo"
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={loading}
                />
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors">
                  {archivo ? (
                    <div className="flex items-center justify-center gap-3">
                      <File className="w-8 h-8 text-accent" />
                      <div className="text-left">
                        <p className="font-medium text-gray-900">{archivo.name}</p>
                        <p className="text-sm text-gray-500">
                          {(archivo.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-sm font-medium text-gray-700">
                        Haz clic para seleccionar un archivo
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Máximo 100 MB
                      </p>
                    </>
                  )}
                </div>
              </label>
            </div>
          </div>

          {archivo && (
            <div>
              <Label htmlFor="nombre">Nombre del archivo *</Label>
              <Input
                id="nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Nombre descriptivo"
                required
                disabled={loading}
              />
              <p className="text-xs text-gray-500 mt-1">
                Este nombre aparecerá en el Centro Digital
              </p>
            </div>
          )}

          {loading && progreso > 0 && (
            <div>
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>Subiendo archivo...</span>
                <span>{progreso}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-accent h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progreso}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-6 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading || !archivo || !nombre.trim()}
              className="flex-1"
            >
              {loading ? 'Subiendo...' : 'Subir archivo'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
