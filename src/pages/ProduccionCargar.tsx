import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Upload, AlertCircle, CheckCircle, FileSpreadsheet, ArrowLeft } from 'lucide-react';

export default function ProduccionCargar() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [stats, setStats] = useState<any>(null);

  const isAdmin = usuario?.rol === 'Administrador';

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        navigate('/produccion/total');
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [success, navigate]);

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-soft p-12 text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-neutral-900 mb-2">Acceso Denegado</h2>
          <p className="text-neutral-600 mb-6">
            Solo los administradores pueden cargar archivos de producción.
          </p>
          <button
            onClick={() => navigate('/produccion/total')}
            className="px-6 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors font-semibold"
          >
            Ver Producción
          </button>
        </div>
      </div>
    );
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.xlsx') && !selectedFile.name.endsWith('.xls')) {
        setError('Solo se permiten archivos Excel (.xlsx, .xls)');
        setFile(null);
        return;
      }
      setFile(selectedFile);
      setError('');
      setSuccess(false);
    }
  };

  const handleUpload = async () => {
    if (!file || !usuario) return;

    console.log('[ProduccionCargar] Starting upload. File:', file.name, 'User:', usuario.id);

    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', usuario.id);

      console.log('[ProduccionCargar] FormData prepared');

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      console.log('[ProduccionCargar] Sending request to edge function...');

      const response = await fetch(
        `${supabaseUrl}/functions/v1/process-production-excel`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
          body: formData,
        }
      );

      console.log('[ProduccionCargar] Response status:', response.status);

      let data;
      try {
        data = await response.json();
        console.log('[ProduccionCargar] Response data:', data);
      } catch (parseError) {
        console.error('[ProduccionCargar] Error parsing response:', parseError);
        throw new Error('Error al procesar la respuesta del servidor');
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Error al procesar el archivo');
      }

      console.log('[ProduccionCargar] Upload successful!');
      setSuccess(true);
      setStats(data);
      setFile(null);

      const fileInput = document.getElementById('file-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

    } catch (err: any) {
      console.error('[ProduccionCargar] Error uploading file:', err);
      setError(err.message || 'Error al cargar el archivo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl shadow-soft border border-neutral-200 p-6">
        <div className="mb-6">
          <button
            onClick={() => navigate('/produccion/total')}
            className="flex items-center space-x-2 text-neutral-600 hover:text-primary-600 transition-colors mb-4 font-medium"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Regresar</span>
          </button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-display font-bold text-neutral-900 mb-2">
                Cargar Producción
              </h1>
              <p className="text-neutral-600">
                Sube un archivo Excel con los datos de producción
              </p>
            </div>
            <FileSpreadsheet className="w-12 h-12 text-primary-600" />
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-yellow-900 mb-1">
                Importante
              </h3>
              <p className="text-sm text-yellow-800">
                Al cargar un nuevo archivo se eliminarán todos los datos de producción anteriores
                y se reemplazarán por los nuevos. Esta acción no se puede deshacer.
              </p>
            </div>
          </div>
        </div>

        <div className="border-2 border-dashed border-neutral-300 rounded-2xl p-8 text-center hover:border-primary-500 transition-colors">
          <Upload className="w-16 h-16 text-neutral-400 mx-auto mb-4" />

          <label
            htmlFor="file-upload"
            className="inline-flex items-center space-x-2 bg-primary-600 text-white px-6 py-3 rounded-xl hover:bg-primary-700 transition-colors font-semibold cursor-pointer"
          >
            <Upload className="w-5 h-5" />
            <span>Seleccionar archivo Excel</span>
          </label>

          <input
            id="file-upload"
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            className="hidden"
          />

          {file && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <p className="text-sm font-medium text-blue-900">
                Archivo seleccionado: {file.name}
              </p>
              <p className="text-xs text-blue-700 mt-1">
                Tamaño: {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          )}

          <p className="text-sm text-neutral-500 mt-4">
            Formatos aceptados: .xlsx, .xls
          </p>
        </div>

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-900 mb-1">Error al procesar el archivo</p>
                <p className="text-sm text-red-800 whitespace-pre-wrap">{error}</p>
              </div>
            </div>
          </div>
        )}

        {success && stats && (
          <div className="mt-4 p-6 bg-green-50 border border-green-200 rounded-xl">
            <div className="flex items-center space-x-2 mb-4">
              <CheckCircle className="w-6 h-6 text-green-600" />
              <h3 className="text-lg font-bold text-green-900">
                Archivo procesado exitosamente
              </h3>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-white rounded-lg p-4">
                <p className="text-sm text-neutral-600 mb-1">Registros</p>
                <p className="text-2xl font-bold text-neutral-900">
                  {stats.recordsImported?.toLocaleString() || 0}
                </p>
              </div>

              <div className="bg-white rounded-lg p-4">
                <p className="text-sm text-neutral-600 mb-1">Importe Total</p>
                <p className="text-2xl font-bold text-green-600">
                  ${(stats.stats?.totalImporte || 0).toLocaleString()}
                </p>
              </div>

              <div className="bg-white rounded-lg p-4">
                <p className="text-sm text-neutral-600 mb-1">Prima Convenio</p>
                <p className="text-2xl font-bold text-blue-600">
                  ${(stats.stats?.totalConvenio || 0).toLocaleString()}
                </p>
              </div>

              <div className="bg-white rounded-lg p-4">
                <p className="text-sm text-neutral-600 mb-1">Prima Ponderada</p>
                <p className="text-2xl font-bold text-orange-600">
                  ${(stats.stats?.totalPonderada || 0).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-center space-x-2 text-sm text-green-700 bg-white rounded-lg p-3">
              <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></div>
              <span>Redirigiendo a Producción Total en 3 segundos...</span>
            </div>
          </div>
        )}

        {file && !loading && !success && (
          <div className="mt-6 flex justify-center">
            <button
              onClick={handleUpload}
              className="flex items-center space-x-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white px-8 py-4 rounded-xl hover:shadow-lg transition-all duration-200 hover:scale-105 font-semibold text-lg"
            >
              <Upload className="w-6 h-6" />
              <span>Procesar Archivo</span>
            </button>
          </div>
        )}

        {loading && (
          <div className="mt-6 text-center">
            <div className="inline-block w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-neutral-600 font-medium">
              Procesando archivo... Esto puede tomar varios minutos.
            </p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-3xl shadow-soft border border-neutral-200 p-6">
        <h2 className="text-xl font-bold text-neutral-900 mb-4">
          Estructura del Archivo Excel
        </h2>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
          <div className="flex items-start space-x-2">
            <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-blue-900 mb-1">
                Nombres de columnas exactos
              </p>
              <p className="text-xs text-blue-800">
                El sistema busca las columnas sin importar mayúsculas/minúsculas, pero los nombres deben coincidir exactamente.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-neutral-50 rounded-xl p-4">
          <p className="text-sm font-semibold text-neutral-700 mb-3">
            Columnas requeridas (obligatorias):
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-sm mb-4">
            <div className="flex items-center space-x-2 bg-white p-2 rounded-lg border border-neutral-200">
              <div className="w-2 h-2 bg-primary-600 rounded-full flex-shrink-0"></div>
              <code className="text-xs font-mono text-neutral-800">FechaSimp</code>
            </div>
            <div className="flex items-center space-x-2 bg-white p-2 rounded-lg border border-neutral-200">
              <div className="w-2 h-2 bg-primary-600 rounded-full flex-shrink-0"></div>
              <code className="text-xs font-mono text-neutral-800">DespNombre</code>
            </div>
            <div className="flex items-center space-x-2 bg-white p-2 rounded-lg border border-neutral-200">
              <div className="w-2 h-2 bg-primary-600 rounded-full flex-shrink-0"></div>
              <code className="text-xs font-mono text-neutral-800">GerenciaNombre</code>
            </div>
            <div className="flex items-center space-x-2 bg-white p-2 rounded-lg border border-neutral-200">
              <div className="w-2 h-2 bg-primary-600 rounded-full flex-shrink-0"></div>
              <code className="text-xs font-mono text-neutral-800">VendNombre</code>
            </div>
            <div className="flex items-center space-x-2 bg-white p-2 rounded-lg border border-neutral-200">
              <div className="w-2 h-2 bg-primary-600 rounded-full flex-shrink-0"></div>
              <code className="text-xs font-mono text-neutral-800">Nombre Compañía</code>
            </div>
            <div className="flex items-center space-x-2 bg-white p-2 rounded-lg border border-neutral-200">
              <div className="w-2 h-2 bg-primary-600 rounded-full flex-shrink-0"></div>
              <code className="text-xs font-mono text-neutral-800">Sub Ramo</code>
            </div>
            <div className="flex items-center space-x-2 bg-white p-2 rounded-lg border border-neutral-200">
              <div className="w-2 h-2 bg-primary-600 rounded-full flex-shrink-0"></div>
              <code className="text-xs font-mono text-neutral-800">IMPORTE PESOS</code>
            </div>
            <div className="flex items-center space-x-2 bg-white p-2 rounded-lg border border-neutral-200">
              <div className="w-2 h-2 bg-primary-600 rounded-full flex-shrink-0"></div>
              <code className="text-xs font-mono text-neutral-800">Prima de convenio</code>
            </div>
            <div className="flex items-center space-x-2 bg-white p-2 rounded-lg border border-neutral-200">
              <div className="w-2 h-2 bg-primary-600 rounded-full flex-shrink-0"></div>
              <code className="text-xs font-mono text-neutral-800">Prima Ponderada</code>
            </div>
            <div className="flex items-center space-x-2 bg-white p-2 rounded-lg border border-neutral-200">
              <div className="w-2 h-2 bg-primary-600 rounded-full flex-shrink-0"></div>
              <code className="text-xs font-mono text-neutral-800">Bono</code>
            </div>
          </div>

          <p className="text-sm font-semibold text-neutral-700 mb-2 mt-4">
            Columnas opcionales:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
            <div className="flex items-center space-x-2 bg-white p-2 rounded-lg border border-neutral-200">
              <div className="w-2 h-2 bg-neutral-400 rounded-full flex-shrink-0"></div>
              <code className="text-xs font-mono text-neutral-600">Dirección Regional</code>
            </div>
            <div className="flex items-center space-x-2 bg-white p-2 rounded-lg border border-neutral-200">
              <div className="w-2 h-2 bg-neutral-400 rounded-full flex-shrink-0"></div>
              <code className="text-xs font-mono text-neutral-600">RamosNombre</code>
            </div>
            <div className="flex items-center space-x-2 bg-white p-2 rounded-lg border border-neutral-200">
              <div className="w-2 h-2 bg-neutral-400 rounded-full flex-shrink-0"></div>
              <code className="text-xs font-mono text-neutral-600">CONVENIO</code>
            </div>
            <div className="flex items-center space-x-2 bg-white p-2 rounded-lg border border-neutral-200">
              <div className="w-2 h-2 bg-neutral-400 rounded-full flex-shrink-0"></div>
              <code className="text-xs font-mono text-neutral-600">% BONO</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
