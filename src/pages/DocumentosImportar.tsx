import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Clock,
  Users,
  FileText,
  Trash2,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  getAllBatches,
  getUnmatchedVendorGroups,
  getBatchById,
  deleteBatch,
  getBatchStatusLabel,
} from '../lib/documentImportUtils';
import type { DocumentImportBatch } from '../lib/documentImportTypes';
import VendedoresNoReconocidosTable from '../components/documentImport/VendedoresNoReconocidosTable';
import ConvertirLoteModal from '../components/documentImport/ConvertirLoteModal';

export default function DocumentosImportar() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [batches, setBatches] = useState<DocumentImportBatch[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingBatches, setLoadingBatches] = useState(true);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [selectedBatch, setSelectedBatch] = useState<DocumentImportBatch | null>(null);
  const [unmatchedGroups, setUnmatchedGroups] = useState<any[]>([]);
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [conversionResult, setConversionResult] = useState<any>(null);

  useEffect(() => {
    if (usuario?.rol !== 'Administrador') {
      navigate('/');
      return;
    }
    loadBatches();
  }, [usuario, navigate]);

  const loadBatches = async () => {
    setLoadingBatches(true);
    try {
      const data = await getAllBatches();
      setBatches(data);
    } catch (error) {
      console.error('Error al cargar lotes:', error);
    } finally {
      setLoadingBatches(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (
        file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.type === 'application/vnd.ms-excel'
      ) {
        setSelectedFile(file);
      } else {
        alert('Por favor selecciona un archivo Excel (.xlsx o .xls)');
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setLoading(true);
    setUploadProgress('Subiendo archivo...');

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('No hay sesión activa');
      }

      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('columnMapping', JSON.stringify({}));

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-document-import`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al procesar el archivo');
      }

      const result = await response.json();

      if (result.success) {
        setUploadProgress('');
        setSelectedFile(null);
        await loadBatches();

        if (result.diagnostics) {
          setDiagnostics(result.diagnostics);
        }

        const batchData = await getBatchById(result.batch.id);
        if (batchData) {
          setSelectedBatch(batchData);
          if (batchData.records_unmatched > 0) {
            const groups = await getUnmatchedVendorGroups(batchData.id);
            setUnmatchedGroups(groups);
          }
        }
      }
    } catch (error: any) {
      console.error('Error al importar:', error);
      alert(error.message || 'Error al procesar el archivo');
      setUploadProgress('');
    } finally {
      setLoading(false);
    }
  };

  const handleViewBatch = async (batch: DocumentImportBatch) => {
    setSelectedBatch(batch);
    if (batch.records_unmatched > 0) {
      const groups = await getUnmatchedVendorGroups(batch.id);
      setUnmatchedGroups(groups);
    } else {
      setUnmatchedGroups([]);
    }
  };

  const handleRefreshBatch = async () => {
    if (!selectedBatch) return;

    const batchData = await getBatchById(selectedBatch.id);
    if (batchData) {
      setSelectedBatch(batchData);
      if (batchData.records_unmatched > 0) {
        const groups = await getUnmatchedVendorGroups(batchData.id);
        setUnmatchedGroups(groups);
      } else {
        setUnmatchedGroups([]);
      }

      await loadBatches();
    }
  };

  const handleDeleteBatch = async (batch: DocumentImportBatch) => {
    const confirmed = window.confirm(
      `¿Estás seguro de que deseas eliminar este lote?\n\n` +
      `Archivo: ${batch.file_name}\n` +
      `Total de documentos: ${batch.records_total}\n\n` +
      `Esta acción no se puede deshacer.`
    );

    if (!confirmed) return;

    try {
      const result = await deleteBatch(batch.id);

      alert(
        `Lote eliminado exitosamente.\n\n` +
        `Documentos eliminados: ${result.documents_deleted}`
      );

      await loadBatches();
    } catch (error: any) {
      console.error('Error al eliminar batch:', error);
      alert(error.message || 'Error al eliminar el lote. Por favor intenta de nuevo.');
    }
  };

  const handleConversionSuccess = async (result: any) => {
    setConversionResult(result);
    setShowConvertModal(false);
    await loadBatches();
    await handleRefreshBatch();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
            <CheckCircle2 className="h-3 w-3" />
            Completado
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
            <Clock className="h-3 w-3" />
            Procesando
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-100 text-red-800 text-xs font-medium rounded-full">
            <AlertCircle className="h-3 w-3" />
            Fallido
          </span>
        );
      case 'partial':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-orange-100 text-orange-800 text-xs font-medium rounded-full">
            <AlertCircle className="h-3 w-3" />
            Parcial
          </span>
        );
      default:
        return null;
    }
  };

  if (selectedBatch) {
    return (
      <div className="p-4 md:p-6 lg:p-8">
        <button
          onClick={() => setSelectedBatch(null)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="font-medium">Volver a la lista</span>
        </button>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Detalle del lote</h2>
              <p className="text-gray-600 mt-1">{selectedBatch.file_name}</p>
            </div>
            {getStatusBadge(selectedBatch.status)}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-gray-600" />
                <div>
                  <p className="text-sm text-gray-600">Total</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {selectedBatch.records_total}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-sm text-green-700">Reconocidos</p>
                  <p className="text-2xl font-bold text-green-900">
                    {selectedBatch.records_matched}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-8 w-8 text-orange-600" />
                <div>
                  <p className="text-sm text-orange-700">Sin reconocer</p>
                  <p className="text-2xl font-bold text-orange-900">
                    {selectedBatch.records_unmatched}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 text-sm text-gray-600">
            <p>
              Importado el{' '}
              {new Date(selectedBatch.imported_at).toLocaleString('es-MX', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </p>
          </div>
        </div>

        {diagnostics && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-4">Diagnóstico de importación</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-sm font-medium text-blue-900 mb-2">Columnas detectadas:</p>
                <div className="space-y-1">
                  <p className="text-sm text-blue-800">
                    <span className="font-medium">Vendedor:</span>{' '}
                    {diagnostics.vendor_column_detected ? (
                      <span className="text-green-700 font-semibold">{diagnostics.vendor_column_detected}</span>
                    ) : (
                      <span className="text-red-700 font-semibold">No detectada</span>
                    )}
                  </p>
                  <p className="text-sm text-blue-800">
                    <span className="font-medium">Email:</span>{' '}
                    {diagnostics.email_column_detected ? (
                      <span className="text-green-700 font-semibold">{diagnostics.email_column_detected}</span>
                    ) : (
                      <span className="text-orange-700 font-semibold">No detectada (opcional)</span>
                    )}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-blue-900 mb-2">Calidad de datos:</p>
                <div className="space-y-1">
                  <p className="text-sm text-blue-800">
                    <span className="font-medium">Registros sin vendedor:</span>{' '}
                    {diagnostics.empty_vendor_count > 0 ? (
                      <span className={diagnostics.empty_vendor_count > selectedBatch.records_total * 0.5 ? 'text-red-700 font-semibold' : 'text-orange-700'}>
                        {diagnostics.empty_vendor_count}
                      </span>
                    ) : (
                      <span className="text-green-700">0</span>
                    )}
                  </p>
                  {diagnostics.empty_vendor_count > selectedBatch.records_total * 0.5 && (
                    <p className="text-xs text-red-700 font-medium">
                      Alerta: Más del 50% de registros sin vendedor
                    </p>
                  )}
                </div>
              </div>
            </div>

            {diagnostics.sample_vendor_names && diagnostics.sample_vendor_names.length > 0 && (
              <div className="mb-3">
                <p className="text-sm font-medium text-blue-900 mb-2">
                  Muestra de vendedores detectados (top 5):
                </p>
                <div className="flex flex-wrap gap-2">
                  {diagnostics.sample_vendor_names.map((name: string, idx: number) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-white border border-blue-300 rounded-lg text-sm text-blue-900"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {diagnostics.sample_emails && diagnostics.sample_emails.length > 0 && (
              <div>
                <p className="text-sm font-medium text-blue-900 mb-2">
                  Muestra de emails detectados (top 5):
                </p>
                <div className="flex flex-wrap gap-2">
                  {diagnostics.sample_emails.map((email: string, idx: number) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-white border border-blue-300 rounded-lg text-sm text-blue-900"
                    >
                      {email}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {conversionResult && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-green-900 mb-2">
                  Conversión completada
                </h3>
                <p className="text-sm text-green-800 mb-4">{conversionResult.message}</p>

                <div className="bg-white border border-green-200 rounded-lg overflow-hidden">
                  <table className="min-w-full">
                    <thead className="bg-green-100">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-green-900 uppercase">
                          Semana
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-green-900 uppercase">
                          Periodo
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-green-900 uppercase">
                          Documentos
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-green-900 uppercase">
                          Acción
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-green-100">
                      {conversionResult.batches.map((batch: any) => (
                        <tr key={batch.id}>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            Semana {batch.week_number}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {new Date(batch.period_start).toLocaleDateString('es-MX')} -{' '}
                            {new Date(batch.period_end).toLocaleDateString('es-MX')}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {batch.document_count}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => navigate(`/comisiones-lote?batch=${batch.id}`)}
                              className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                            >
                              Abrir lote
                              <ArrowRight className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {!conversionResult && (
          <>
            {selectedBatch.status === 'needs_mapping' && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-yellow-900">Pendiente de asignación</p>
                    <p className="text-sm text-yellow-700 mt-1">
                      Debes asignar todos los vendedores antes de poder convertir a lotes de comisiones.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {selectedBatch.status === 'ready_to_convert' && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-semibold text-green-900">Listo para convertir</p>
                      <p className="text-sm text-green-700 mt-1">
                        Todos los documentos tienen usuarios asignados. Puedes convertir este lote en lotes de comisiones por semana.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowConvertModal(true)}
                    className="ml-4 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2 whitespace-nowrap"
                  >
                    <ArrowRight className="h-5 w-5" />
                    Convertir a Lotes
                  </button>
                </div>
              </div>
            )}

            {selectedBatch.status === 'converted' && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-purple-900">Lote convertido</p>
                    <p className="text-sm text-purple-700 mt-1">
                      Este lote ya fue convertido a lotes de comisiones el{' '}
                      {selectedBatch.converted_at &&
                        new Date(selectedBatch.converted_at).toLocaleString('es-MX')}
                    </p>
                    {selectedBatch.conversion_summary?.total_batches_created && (
                      <p className="text-sm text-purple-700 mt-1">
                        Se crearon {selectedBatch.conversion_summary.total_batches_created} lotes de comisiones.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {selectedBatch.records_unmatched > 0 && !conversionResult && (
          <VendedoresNoReconocidosTable
            groups={unmatchedGroups}
            batchId={selectedBatch.id}
            onRefresh={handleRefreshBatch}
          />
        )}

        {showConvertModal && selectedBatch && (
          <ConvertirLoteModal
            batchId={selectedBatch.id}
            batchName={selectedBatch.file_name}
            onClose={() => setShowConvertModal(false)}
            onSuccess={handleConversionSuccess}
          />
        )}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <button
        onClick={() => navigate('/comisiones')}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition"
      >
        <ArrowLeft className="h-5 w-5" />
        <span className="font-medium">Volver a Comisiones</span>
      </button>

      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
          Importar documentos desde Excel
        </h1>
        <p className="text-gray-600 mt-1">
          Sube un archivo Excel para procesar documentos y asignar vendedores automáticamente
        </p>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Upload className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Cargar archivo</h3>
            <p className="text-sm text-gray-600">Selecciona un archivo Excel (.xlsx o .xls)</p>
          </div>
        </div>

        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8">
          <div className="text-center">
            <FileSpreadsheet className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <label className="cursor-pointer">
              <span className="text-blue-600 hover:text-blue-700 font-medium">
                Selecciona un archivo
              </span>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
                disabled={loading}
              />
            </label>
            <p className="text-sm text-gray-500 mt-2">o arrastra y suelta aquí</p>
          </div>

          {selectedFile && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="h-8 w-8 text-blue-600" />
                  <div>
                    <p className="font-medium text-gray-900">{selectedFile.name}</p>
                    <p className="text-sm text-gray-600">
                      {(selectedFile.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleUpload}
                  disabled={loading}
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      {uploadProgress}
                    </>
                  ) : (
                    <>
                      <Upload className="h-5 w-5" />
                      Procesar archivo
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Clock className="h-6 w-6 text-gray-600" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Historial de importaciones</h3>
              <p className="text-sm text-gray-600">Lotes procesados recientemente</p>
            </div>
          </div>
        </div>

        {loadingBatches ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : batches.length === 0 ? (
          <div className="text-center py-12">
            <FileSpreadsheet className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg mb-2">No hay importaciones</p>
            <p className="text-gray-400 text-sm">Sube tu primer archivo Excel para comenzar</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Archivo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Total
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Reconocidos
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Pendientes
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Fecha
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {batches.map((batch) => (
                  <tr key={batch.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="h-5 w-5 text-green-600" />
                        <span className="text-sm font-medium text-gray-900">
                          {batch.file_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(batch.status)}</td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-semibold text-gray-900">
                        {batch.records_total}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-semibold text-green-600">
                        {batch.records_matched}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {batch.records_unmatched > 0 ? (
                        <span className="text-sm font-semibold text-orange-600">
                          {batch.records_unmatched}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">0</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600">
                        {new Date(batch.imported_at).toLocaleDateString('es-MX', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleViewBatch(batch)}
                          className="text-sm font-medium text-blue-600 hover:text-blue-700 transition"
                        >
                          Ver detalle
                        </button>
                        <button
                          onClick={() => handleDeleteBatch(batch)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Eliminar lote"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
