import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Upload, AlertCircle, CheckCircle, FileSpreadsheet, Link as LinkIcon, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { PageHeader } from '@/components/ui/page-header';
import { LoadingState } from '@/components/ui/loading-state';
import { Button } from '@/components/ui/button';

type UploadMode = 'excel' | 'sheets';

export default function ProduccionCargar() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<UploadMode>('sheets');
  const [file, setFile] = useState<File | null>(null);
  const [sheetUrl, setSheetUrl] = useState('https://docs.google.com/spreadsheets/d/1FladEQiSlbwHQoBKGtPMq5WI-MSXYPm2HcfUZsEadbk/edit?usp=sharing');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [config, setConfig] = useState<any>(null);

  const isAdmin = usuario?.rol === 'Administrador';

  useEffect(() => {
    if (isAdmin) {
      loadConfig();
    }
  }, [isAdmin]);

  const loadConfig = async () => {
    try {
      const { data } = await supabase
        .from('production_config')
        .select('*')
        .maybeSingle();

      if (data) {
        setConfig(data);
        if (data.google_sheet_url) {
          setSheetUrl(data.google_sheet_url);
        }
      }
    } catch (err) {
      console.error('Error loading config:', err);
    }
  };

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
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center p-6">
        <div className="bg-white dark:bg-neutral-800/50 rounded-3xl shadow-soft border border-neutral-200/60 dark:border-white/8 p-12 text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">Acceso Denegado</h2>
          <p className="text-neutral-600 dark:text-white/60 mb-6">
            Solo los administradores pueden cargar archivos de producción.
          </p>
          <Button onClick={() => navigate('/produccion/total')} size="lg">
            Ver Producción
          </Button>
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

  const handleSyncGoogleSheets = async () => {
    if (!sheetUrl || !usuario) return;

    console.log('[ProduccionCargar] Starting Google Sheets sync. URL:', sheetUrl);

    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(
        `${supabaseUrl}/functions/v1/sync-google-sheets`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sheetUrl: sheetUrl.trim(),
            userId: usuario.id
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Error al sincronizar Google Sheets');
      }

      console.log('[ProduccionCargar] Sync successful!');
      setSuccess(true);
      setStats(data);
      await loadConfig();

    } catch (err: any) {
      console.error('[ProduccionCargar] Error syncing Google Sheets:', err);
      setError(err.message || 'Error al sincronizar Google Sheets');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 px-4 sm:px-0">
      <PageHeader
        title="Cargar Producción"
        description="Sincroniza desde Google Sheets o sube un archivo Excel"
        icon={FileSpreadsheet}
      />

      <div className="bg-white dark:bg-neutral-800/50 rounded-xl border border-neutral-200/60 dark:border-white/8 p-4 sm:p-6">

        <div className="flex gap-2 mb-4 sm:mb-6 bg-neutral-100 dark:bg-white/10 p-1 rounded-xl">
          <button
            onClick={() => setMode('sheets')}
            className={`flex-1 flex items-center justify-center gap-1 sm:gap-2 py-2 sm:py-3 px-2 sm:px-4 rounded-lg font-semibold transition-all text-sm sm:text-base ${
              mode === 'sheets'
                ? 'bg-white dark:bg-neutral-800 text-accent shadow-sm'
                : 'text-neutral-600 dark:text-white/60 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <LinkIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>Google Sheets</span>
          </button>
          <button
            onClick={() => setMode('excel')}
            className={`flex-1 flex items-center justify-center gap-1 sm:gap-2 py-2 sm:py-3 px-2 sm:px-4 rounded-lg font-semibold transition-all text-sm sm:text-base ${
              mode === 'excel'
                ? 'bg-white dark:bg-neutral-800 text-accent shadow-sm'
                : 'text-neutral-600 dark:text-white/60 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <Upload className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden sm:inline">Archivo Excel</span>
            <span className="sm:hidden">Excel</span>
          </button>
        </div>

        <div className="space-y-3 mb-4 sm:mb-6">
          <div className="bg-primary-50 border border-primary-200 rounded-lg sm:rounded-xl p-3 sm:p-4">
            <div className="flex items-start gap-2 sm:gap-3">
              <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-accent mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-primary-900 mb-1 text-sm sm:text-base">
                  Sincronización Incremental
                </h3>
                <p className="text-xs sm:text-sm text-primary-800">
                  El sistema detecta automáticamente registros duplicados y solo agrega información nueva.
                  Los datos existentes se mantienen intactos y no se eliminan.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-primary-50 border border-primary-200 rounded-lg sm:rounded-xl p-3 sm:p-4">
            <div className="flex items-start gap-2 sm:gap-3">
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-accent mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-primary-900 mb-1 text-sm sm:text-base">
                  Límites del sistema
                </h3>
                <ul className="text-xs sm:text-sm text-primary-800 space-y-1">
                  <li>• Tamaño máximo de archivo Excel: 1000 MB</li>
                  <li>• Sin límite de registros para Google Sheets</li>
                  <li>• El procesamiento de grandes volúmenes puede tomar varios minutos</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

{mode === 'sheets' ? (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-2xl p-6">
              <div className="flex items-center space-x-3 mb-4">
                <LinkIcon className="w-8 h-8 text-green-600" />
                <div>
                  <h3 className="text-lg font-bold text-green-900">
                    Sincronizar desde Google Sheets
                  </h3>
                  <p className="text-sm text-green-700">
                    Configura el enlace de tu hoja de cálculo de Google
                  </p>
                </div>
              </div>

              {config?.last_sync_at && (
                <div className="bg-white/70 dark:bg-white/5 rounded-lg p-3 mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-neutral-600 dark:text-white/60">Última sincronización:</span>
                    <span className="font-semibold text-neutral-900 dark:text-white">
                      {new Date(config.last_sync_at).toLocaleString('es-MX', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <label className="block">
                  <span className="text-sm font-semibold text-neutral-700 dark:text-white/70 mb-2 block">
                    URL de Google Sheets
                  </span>
                  <input
                    type="text"
                    value={sheetUrl}
                    onChange={(e) => setSheetUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    className="w-full px-4 py-3 text-sm bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                  />
                </label>

                <div className="bg-primary-50 border border-primary-200 rounded-lg p-3">
                  <p className="text-sm text-primary-800">
                    <strong>Importante:</strong> Asegúrate de que el Google Sheet esté compartido como "Cualquier persona con el enlace puede ver"
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="border-2 border-dashed border-neutral-300 dark:border-white/15 rounded-2xl p-8 text-center hover:border-accent transition-colors">
            <Upload className="w-16 h-16 text-neutral-400 dark:text-white/40 mx-auto mb-4" />

            <label
              htmlFor="file-upload"
              className="inline-flex items-center space-x-2 bg-accent text-white px-6 py-3 rounded-xl hover:bg-accent-hover transition-colors font-semibold cursor-pointer"
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
              <div className="mt-4 p-4 bg-primary-50 border border-primary-200 rounded-xl">
                <p className="text-sm font-medium text-primary-900">
                  Archivo seleccionado: {file.name}
                </p>
                <p className="text-xs text-primary-700 mt-1">
                  Tamaño: {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            )}

            <p className="text-sm text-neutral-500 dark:text-white/50 mt-4">
              Formatos aceptados: .xlsx, .xls
            </p>
          </div>
        )}

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
                {mode === 'sheets' ? 'Sincronización completada' : 'Archivo procesado exitosamente'}
              </h3>
            </div>

            {stats.duplicateCount > 0 && (
              <div className="bg-primary-50 border border-primary-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-primary-800">
                  <strong>Sincronización incremental:</strong> Se encontraron {stats.duplicateCount} registros que ya existían en la base de datos (no se duplicaron).
                </p>
              </div>
            )}

            {stats.skippedCount > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-yellow-800">
                  <strong>Nota:</strong> Se omitieron {stats.skippedCount} registros por datos inválidos o incompletos.
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-white dark:bg-white/5 rounded-lg p-4">
                <p className="text-sm text-neutral-600 dark:text-white/60 mb-1">Nuevos Registros</p>
                <p className="text-2xl font-bold text-green-600">
                  {stats.recordsImported?.toLocaleString() || 0}
                </p>
              </div>

              <div className="bg-white dark:bg-white/5 rounded-lg p-4">
                <p className="text-sm text-neutral-600 dark:text-white/60 mb-1">Importe Total</p>
                <p className="text-2xl font-bold text-green-600">
                  ${(stats.stats?.totalImporte || 0).toLocaleString()}
                </p>
              </div>

              <div className="bg-white dark:bg-white/5 rounded-lg p-4">
                <p className="text-sm text-neutral-600 dark:text-white/60 mb-1">Prima Convenio</p>
                <p className="text-2xl font-bold text-accent">
                  ${(stats.stats?.totalConvenio || 0).toLocaleString()}
                </p>
              </div>

              <div className="bg-white dark:bg-white/5 rounded-lg p-4">
                <p className="text-sm text-neutral-600 dark:text-white/60 mb-1">Prima Ponderada</p>
                <p className="text-2xl font-bold text-orange-600">
                  ${(stats.stats?.totalPonderada || 0).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-center space-x-2 text-sm text-green-700 bg-white dark:bg-white/5 rounded-lg p-3">
              <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></div>
              <span>Redirigiendo a Producción Total en 3 segundos...</span>
            </div>
          </div>
        )}

{mode === 'sheets' && sheetUrl && !loading && !success && (
          <div className="mt-4 sm:mt-6 flex justify-center px-4">
            <Button
              onClick={handleSyncGoogleSheets}
              size="lg"
              className="gap-2 w-full sm:w-auto"
            >
              <RefreshCw className="w-5 h-5" />
              <span className="hidden sm:inline">Sincronizar Google Sheets</span>
              <span className="sm:hidden">Sincronizar</span>
            </Button>
          </div>
        )}

        {mode === 'excel' && file && !loading && !success && (
          <div className="mt-4 sm:mt-6 flex justify-center px-4">
            <Button
              onClick={handleUpload}
              size="lg"
              className="gap-2 w-full sm:w-auto"
            >
              <Upload className="w-5 h-5" />
              <span>Procesar Archivo</span>
            </Button>
          </div>
        )}

        {loading && (
          <LoadingState
            text={mode === 'sheets' ? 'Sincronizando desde Google Sheets... Esto puede tomar varios minutos.' : 'Procesando archivo... Esto puede tomar varios minutos.'}
          />
        )}
      </div>

{mode === 'sheets' && (
        <div className="bg-white dark:bg-neutral-800/50 rounded-xl border border-neutral-200/60 dark:border-white/8 p-4 sm:p-6 mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-xl font-bold text-neutral-900 dark:text-white mb-3 sm:mb-4">
            Cómo configurar tu Google Sheet
          </h2>

          <div className="space-y-3 sm:space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg sm:rounded-xl p-3 sm:p-4">
              <h3 className="font-semibold text-green-900 mb-2 text-sm sm:text-base">Paso 1: Compartir el documento</h3>
              <ol className="text-xs sm:text-sm text-green-800 space-y-1 list-decimal list-inside">
                <li>Abre tu Google Sheet</li>
                <li>Haz clic en "Compartir" en la esquina superior derecha</li>
                <li>En "Acceso general", selecciona "Cualquier persona con el enlace"</li>
                <li>Asegúrate de que el rol sea "Lector"</li>
                <li>Copia el enlace y pégalo arriba</li>
              </ol>
            </div>

            <div className="bg-primary-50 border border-primary-200 rounded-lg sm:rounded-xl p-3 sm:p-4">
              <h3 className="font-semibold text-primary-900 mb-2 text-sm sm:text-base">Paso 2: Estructura de datos</h3>
              <p className="text-xs sm:text-sm text-primary-800 mb-2">
                Tu Google Sheet debe tener las mismas columnas que se requieren para un archivo Excel (ver abajo).
              </p>
              <p className="text-xs sm:text-sm text-primary-800">
                La primera fila debe contener los encabezados de las columnas y los datos deben empezar en la segunda fila.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-neutral-800/50 rounded-xl border border-neutral-200/60 dark:border-white/8 p-4 sm:p-6">
        <h2 className="text-lg sm:text-xl font-bold text-neutral-900 dark:text-white mb-3 sm:mb-4">
          Estructura de Datos Requerida
        </h2>

        <div className="bg-primary-50 border border-primary-200 rounded-lg sm:rounded-xl p-3 sm:p-4 mb-3 sm:mb-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-accent mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-semibold text-primary-900 mb-1">
                Nombres de columnas exactos
              </p>
              <p className="text-[10px] sm:text-xs text-primary-800">
                El sistema busca las columnas sin importar mayúsculas/minúsculas, pero los nombres deben coincidir exactamente.
                Aplica tanto para Excel como para Google Sheets.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-neutral-50 dark:bg-white/5 rounded-lg sm:rounded-xl p-3 sm:p-4">
          <p className="text-xs sm:text-sm font-semibold text-neutral-700 dark:text-white/70 mb-2 sm:mb-3">
            Columnas requeridas (obligatorias):
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm mb-3 sm:mb-4">
            <div className="flex items-center space-x-2 bg-white dark:bg-white/5 p-2 rounded-lg border border-neutral-200 dark:border-white/10">
              <div className="w-2 h-2 bg-accent rounded-full flex-shrink-0"></div>
              <code className="text-xs font-mono text-neutral-800">FechaSimp</code>
            </div>
            <div className="flex items-center space-x-2 bg-white dark:bg-white/5 p-2 rounded-lg border border-neutral-200 dark:border-white/10">
              <div className="w-2 h-2 bg-accent rounded-full flex-shrink-0"></div>
              <code className="text-xs font-mono text-neutral-800">DespNombre</code>
            </div>
            <div className="flex items-center space-x-2 bg-white dark:bg-white/5 p-2 rounded-lg border border-neutral-200 dark:border-white/10">
              <div className="w-2 h-2 bg-accent rounded-full flex-shrink-0"></div>
              <code className="text-xs font-mono text-neutral-800">GerenciaNombre</code>
            </div>
            <div className="flex items-center space-x-2 bg-white dark:bg-white/5 p-2 rounded-lg border border-neutral-200 dark:border-white/10">
              <div className="w-2 h-2 bg-accent rounded-full flex-shrink-0"></div>
              <code className="text-xs font-mono text-neutral-800">VendNombre</code>
            </div>
            <div className="flex items-center space-x-2 bg-white dark:bg-white/5 p-2 rounded-lg border border-neutral-200 dark:border-white/10">
              <div className="w-2 h-2 bg-accent rounded-full flex-shrink-0"></div>
              <code className="text-xs font-mono text-neutral-800">Nombre Compañía</code>
            </div>
            <div className="flex items-center space-x-2 bg-white dark:bg-white/5 p-2 rounded-lg border border-neutral-200 dark:border-white/10">
              <div className="w-2 h-2 bg-accent rounded-full flex-shrink-0"></div>
              <code className="text-xs font-mono text-neutral-800">Sub Ramo</code>
            </div>
            <div className="flex items-center space-x-2 bg-white dark:bg-white/5 p-2 rounded-lg border border-neutral-200 dark:border-white/10">
              <div className="w-2 h-2 bg-accent rounded-full flex-shrink-0"></div>
              <code className="text-xs font-mono text-neutral-800">IMPORTE PESOS</code>
            </div>
            <div className="flex items-center space-x-2 bg-white dark:bg-white/5 p-2 rounded-lg border border-neutral-200 dark:border-white/10">
              <div className="w-2 h-2 bg-accent rounded-full flex-shrink-0"></div>
              <code className="text-xs font-mono text-neutral-800">Prima de convenio</code>
            </div>
            <div className="flex items-center space-x-2 bg-white dark:bg-white/5 p-2 rounded-lg border border-neutral-200 dark:border-white/10">
              <div className="w-2 h-2 bg-accent rounded-full flex-shrink-0"></div>
              <code className="text-xs font-mono text-neutral-800">Prima Ponderada</code>
            </div>
            <div className="flex items-center space-x-2 bg-white dark:bg-white/5 p-2 rounded-lg border border-neutral-200 dark:border-white/10">
              <div className="w-2 h-2 bg-accent rounded-full flex-shrink-0"></div>
              <code className="text-xs font-mono text-neutral-800">Bono</code>
            </div>
          </div>

          <p className="text-sm font-semibold text-neutral-700 dark:text-white/70 mb-2 mt-4">
            Columnas opcionales:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
            <div className="flex items-center space-x-2 bg-white dark:bg-white/5 p-2 rounded-lg border border-neutral-200 dark:border-white/10">
              <div className="w-2 h-2 bg-neutral-400 rounded-full flex-shrink-0"></div>
              <code className="text-xs font-mono text-neutral-600">Dirección Regional</code>
            </div>
            <div className="flex items-center space-x-2 bg-white dark:bg-white/5 p-2 rounded-lg border border-neutral-200 dark:border-white/10">
              <div className="w-2 h-2 bg-neutral-400 rounded-full flex-shrink-0"></div>
              <code className="text-xs font-mono text-neutral-600">RamosNombre</code>
            </div>
            <div className="flex items-center space-x-2 bg-white dark:bg-white/5 p-2 rounded-lg border border-neutral-200 dark:border-white/10">
              <div className="w-2 h-2 bg-neutral-400 rounded-full flex-shrink-0"></div>
              <code className="text-xs font-mono text-neutral-600">CONVENIO</code>
            </div>
            <div className="flex items-center space-x-2 bg-white dark:bg-white/5 p-2 rounded-lg border border-neutral-200 dark:border-white/10">
              <div className="w-2 h-2 bg-neutral-400 rounded-full flex-shrink-0"></div>
              <code className="text-xs font-mono text-neutral-600">% BONO</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
