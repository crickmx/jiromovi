import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Upload, AlertCircle, CheckCircle, FileSpreadsheet, TrendingUp } from 'lucide-react';

export default function ProduccionCargar() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [stats, setStats] = useState<any>(null);

  const isAdmin = usuario?.rol === 'Administrador';

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

    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', usuario.id);

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

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

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Error al procesar el archivo');
      }

      setSuccess(true);
      setStats(data);
      setFile(null);

      const fileInput = document.getElementById('file-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

    } catch (err: any) {
      console.error('Error uploading file:', err);
      setError(err.message || 'Error al cargar el archivo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl shadow-soft border border-neutral-200 p-6">
        <div className="flex items-center justify-between mb-6">
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
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <p className="text-sm font-medium text-red-900">{error}</p>
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

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                <p className="text-2xl font-bold text-purple-600">
                  ${(stats.stats?.totalPonderada || 0).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="mt-4 flex space-x-3">
              <button
                onClick={() => navigate('/produccion/total')}
                className="flex-1 flex items-center justify-center space-x-2 bg-primary-600 text-white px-6 py-3 rounded-xl hover:bg-primary-700 transition-colors font-semibold"
              >
                <TrendingUp className="w-5 h-5" />
                <span>Ver Producción Total</span>
              </button>

              <button
                onClick={() => navigate('/produccion/convenio')}
                className="flex-1 flex items-center justify-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition-colors font-semibold"
              >
                <TrendingUp className="w-5 h-5" />
                <span>Ver Producción Convenio</span>
              </button>
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

        <div className="bg-neutral-50 rounded-xl p-4">
          <p className="text-sm font-semibold text-neutral-700 mb-3">
            El archivo debe contener las siguientes columnas:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-primary-600 rounded-full"></div>
              <span className="text-neutral-700">Fecha</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-primary-600 rounded-full"></div>
              <span className="text-neutral-700">DespNombre</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-primary-600 rounded-full"></div>
              <span className="text-neutral-700">GerenciaNombre</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-neutral-400 rounded-full"></div>
              <span className="text-neutral-600">Dirección Regional</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-primary-600 rounded-full"></div>
              <span className="text-neutral-700">VendNombre</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-primary-600 rounded-full"></div>
              <span className="text-neutral-700">Nombre Compañía</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-primary-600 rounded-full"></div>
              <span className="text-neutral-700">RamosNombre</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-neutral-400 rounded-full"></div>
              <span className="text-neutral-600">Sub Ramo</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-primary-600 rounded-full"></div>
              <span className="text-neutral-700">IMPORTE PESOS</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-primary-600 rounded-full"></div>
              <span className="text-neutral-700">Prima de convenio</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-primary-600 rounded-full"></div>
              <span className="text-neutral-700">Prima Ponderada</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-primary-600 rounded-full"></div>
              <span className="text-neutral-700">Bono</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-neutral-400 rounded-full"></div>
              <span className="text-neutral-600">CONVENIO</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-neutral-400 rounded-full"></div>
              <span className="text-neutral-600">% BONO</span>
            </div>
          </div>

          <p className="text-xs text-neutral-500 mt-3">
            <span className="text-primary-600">●</span> Obligatorio
            <span className="ml-4 text-neutral-400">●</span> Opcional
          </p>
        </div>
      </div>
    </div>
  );
}
