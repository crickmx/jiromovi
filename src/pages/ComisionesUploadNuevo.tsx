import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, Upload, AlertCircle, CheckCircle, Loader2, Users, UserX } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface StagingSession {
  id: string;
  file_name: string;
  total_items: number;
  recognized_count: number;
  pending_assignment_count: number;
  status: string;
}

export default function ComisionesUploadNuevo() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [session, setSession] = useState<StagingSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = usuario?.rol === 'Administrador';

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      console.log('[ComisionesUploadNuevo] File selected');
      const selectedFile = e.target.files?.[0];
      if (!selectedFile) return;

      if (!selectedFile.name.endsWith('.xlsx')) {
        setError('Por favor selecciona un archivo Excel (.xlsx)');
        return;
      }

      console.log('[ComisionesUploadNuevo] File validated:', selectedFile.name);
      setFile(selectedFile);
      setError(null);
      setSession(null);
    } catch (error: any) {
      console.error('[ComisionesUploadNuevo] Error selecting file:', error);
      setError('Error al seleccionar archivo: ' + error.message);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    console.log('[ComisionesUploadNuevo] Starting upload...', file.name);
    setUploading(true);
    setError(null);

    try {
      console.log('[ComisionesUploadNuevo] Getting auth session...');
      const { data: { session: authSession }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('[ComisionesUploadNuevo] Session error:', sessionError);
        throw new Error('Error de autenticación: ' + sessionError.message);
      }

      if (!authSession) {
        console.error('[ComisionesUploadNuevo] No auth session');
        throw new Error('No autenticado. Por favor inicia sesión nuevamente.');
      }

      console.log('[ComisionesUploadNuevo] Creating FormData...');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileName', file.name);

      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-excel-staging`;
      console.log('[ComisionesUploadNuevo] Calling edge function:', functionUrl);

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authSession.access_token}`,
        },
        body: formData
      });

      console.log('[ComisionesUploadNuevo] Response status:', response.status);

      if (!response.ok) {
        let errorMessage = 'Error al procesar archivo';
        try {
          const errorData = await response.json();
          console.error('[ComisionesUploadNuevo] Error response:', errorData);
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          const errorText = await response.text();
          console.error('[ComisionesUploadNuevo] Error text:', errorText);
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('[ComisionesUploadNuevo] Result:', result);

      if (!result.success || !result.session) {
        throw new Error('Error al procesar archivo: respuesta inválida');
      }

      console.log('[ComisionesUploadNuevo] Upload successful!');
      setSession(result.session);
    } catch (error: any) {
      console.error('[ComisionesUploadNuevo] Error uploading file:', error);
      setError(error.message || 'Error al procesar archivo');
    } finally {
      setUploading(false);
    }
  };

  const handlePrepararLote = () => {
    if (!session) return;
    navigate(`/comisiones/preparar-lote/${session.id}`);
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-soft p-12 text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-neutral-900 mb-2">
            Acceso Denegado
          </h2>
          <p className="text-neutral-600 mb-6">
            Solo los administradores pueden acceder a esta sección.
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-6 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors font-semibold"
          >
            Volver al Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl shadow-soft border border-neutral-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/comisiones')}
              className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-6 h-6 text-neutral-700" />
            </button>
            <div>
              <h1 className="text-3xl font-display font-bold text-neutral-900 mb-1">
                Cargar Archivo de Comisiones
              </h1>
              <p className="text-neutral-600">
                Sube un archivo Excel para procesarlo e identificar vendedores
              </p>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <h3 className="font-semibold text-blue-900 mb-2">
            Formato del archivo Excel
          </h3>
          <p className="text-sm text-blue-800 mb-2">
            El archivo debe contener las siguientes columnas obligatorias:
          </p>
          <ul className="text-sm text-blue-800 space-y-1 ml-4">
            <li><strong>VendNombre</strong> - Nombre del vendedor (obligatorio)</li>
            <li><strong>FPago</strong> - Fecha de pago</li>
            <li><strong>Poliza</strong> o <strong>Documento</strong> - Número de póliza</li>
            <li><strong>Ramo</strong> - Ramo de seguro</li>
            <li><strong>Aseguradora</strong> - Nombre de la aseguradora</li>
            <li><strong>PrimaNeta</strong> o <strong>Importe</strong> - Monto base</li>
            <li><strong>PorPart</strong> - Porcentaje de comisión</li>
          </ul>
          <p className="text-sm font-semibold text-blue-900 mt-4">
            Nota: Los vendedores se identifican solo por nombre, no por email.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start space-x-3">
            <AlertCircle className="w-6 h-6 text-red-600 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-red-900 mb-1">Error</h4>
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        )}

        {!session ? (
          <div className="space-y-6">
            {!file ? (
              <div className="border-2 border-dashed border-neutral-300 rounded-2xl p-12 text-center hover:border-primary-400 transition-colors">
                <label htmlFor="file-upload" className="cursor-pointer block">
                  <input
                    id="file-upload"
                    type="file"
                    accept=".xlsx"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <Upload className="w-16 h-16 text-neutral-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-neutral-700 mb-2">
                    Haz clic para seleccionar un archivo
                  </h3>
                  <p className="text-neutral-500">
                    o arrastra y suelta aquí un archivo .xlsx
                  </p>
                </label>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start space-x-3">
                  <CheckCircle className="w-6 h-6 text-green-600 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-semibold text-green-900 mb-1">
                      Archivo seleccionado
                    </h4>
                    <p className="text-sm text-green-800">{file.name}</p>
                  </div>
                  <button
                    onClick={() => {
                      setFile(null);
                      setError(null);
                    }}
                    className="text-green-700 hover:text-green-900 font-semibold text-sm"
                  >
                    Cambiar
                  </button>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={handleUpload}
                    disabled={uploading}
                    className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl hover:shadow-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Procesando...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-5 h-5" />
                        <span>Procesar Archivo</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-green-50 border border-green-200 rounded-xl p-6">
              <div className="flex items-start space-x-3">
                <CheckCircle className="w-8 h-8 text-green-600 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-green-900 mb-2">
                    Archivo procesado exitosamente
                  </h3>
                  <p className="text-sm text-green-800 mb-4">
                    {session.file_name}
                  </p>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-white rounded-lg p-4 border border-green-200">
                      <div className="text-3xl font-bold text-green-700 mb-1">
                        {session.total_items}
                      </div>
                      <div className="text-sm text-green-800">
                        Total de documentos
                      </div>
                    </div>

                    <div className="bg-white rounded-lg p-4 border border-green-200">
                      <div className="flex items-center space-x-2 mb-1">
                        <Users className="w-5 h-5 text-blue-600" />
                        <div className="text-3xl font-bold text-blue-700">
                          {session.recognized_count}
                        </div>
                      </div>
                      <div className="text-sm text-blue-800">
                        Vendedores reconocidos
                      </div>
                    </div>

                    <div className="bg-white rounded-lg p-4 border border-orange-200">
                      <div className="flex items-center space-x-2 mb-1">
                        <UserX className="w-5 h-5 text-orange-600" />
                        <div className="text-3xl font-bold text-orange-700">
                          {session.pending_assignment_count}
                        </div>
                      </div>
                      <div className="text-sm text-orange-800">
                        Pendientes de asignar
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {session.pending_assignment_count > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="w-6 h-6 text-orange-600 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-semibold text-orange-900 mb-1">
                      Acción requerida
                    </h4>
                    <p className="text-sm text-orange-800">
                      Hay {session.pending_assignment_count} vendedores que no pudieron ser reconocidos automáticamente.
                      Deberás asignarlos manualmente antes de crear los lotes.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-between items-center pt-4 border-t border-neutral-200">
              <button
                onClick={() => {
                  setFile(null);
                  setSession(null);
                  setError(null);
                }}
                className="text-neutral-600 hover:text-neutral-900 font-semibold"
              >
                Cargar otro archivo
              </button>

              <button
                onClick={handlePrepararLote}
                className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl hover:shadow-medium transition-all duration-200 font-semibold"
              >
                <span>Preparar Lote</span>
                <ArrowLeft className="w-5 h-5 rotate-180" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
