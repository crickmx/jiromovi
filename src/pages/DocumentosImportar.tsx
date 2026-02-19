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
  getMatchedVendorGroups,
  getBatchById,
  deleteBatch,
  getBatchStatusLabel,
} from '../lib/documentImportUtils';
import type { DocumentImportBatch } from '../lib/documentImportTypes';
import VendedoresNoReconocidosTable from '../components/documentImport/VendedoresNoReconocidosTable';
import VendedoresReconocidosTable from '../components/documentImport/VendedoresReconocidosTable';
import ConvertirLoteModal from '../components/documentImport/ConvertirLoteModal';
import SelfCheckConsistencia from '../components/documentImport/SelfCheckConsistencia';

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
  const [matchedGroups, setMatchedGroups] = useState<any[]>([]);
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [conversionResult, setConversionResult] = useState<any>(null);

  useEffect(() => {
    console.log('[DocumentosImportar] useEffect triggered, usuario:', usuario?.id);

    if (!usuario) {
      console.log('[DocumentosImportar] No usuario, skipping load');
      return;
    }

    console.log('[DocumentosImportar] Loading batches...');
    loadBatches();
  }, [usuario?.id]);

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
    console.log('[DocumentosImportar] File select triggered');
    e.preventDefault();
    e.stopPropagation();

    const file = e.target.files?.[0];
    if (file) {
      console.log('[DocumentosImportar] File selected:', file.name, file.type);
      if (
        file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.type === 'application/vnd.ms-excel' ||
        file.name.endsWith('.xlsx') ||
        file.name.endsWith('.xls')
      ) {
        setSelectedFile(file);
        console.log('[DocumentosImportar] File set successfully');
      } else {
        console.warn('[DocumentosImportar] Invalid file type:', file.type);
        alert('Por favor selecciona un archivo Excel (.xlsx o .xls)');
        e.target.value = '';
      }
    } else {
      console.log('[DocumentosImportar] No file selected');
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
          if (batchData.records_matched > 0) {
            const matched = await getMatchedVendorGroups(batchData.id);
            setMatchedGroups(matched);
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

    // Cargar vendedores no reconocidos
    if (batch.records_unmatched > 0) {
      const groups = await getUnmatchedVendorGroups(batch.id);
      setUnmatchedGroups(groups);
    } else {
      setUnmatchedGroups([]);
    }

    // Cargar vendedores reconocidos
    if (batch.records_matched > 0) {
      const matched = await getMatchedVendorGroups(batch.id);
      setMatchedGroups(matched);
    } else {
      setMatchedGroups([]);
    }

    // Cargar diagnóstico de status
    try {
      const { data, error } = await supabase.rpc('get_import_diagnostic', {
        p_batch_id: batch.id
      });

      if (!error && data) {
        setDiagnostics(data);
      }
    } catch (error) {
      console.error('Error al cargar diagnóstico:', error);
    }
  };

  const handleRefreshBatch = async () => {
    if (!selectedBatch) return;

    const batchData = await getBatchById(selectedBatch.id);
    if (batchData) {
      setSelectedBatch(batchData);

      // Recargar vendedores no reconocidos
      if (batchData.records_unmatched > 0) {
        const groups = await getUnmatchedVendorGroups(batchData.id);
        setUnmatchedGroups(groups);
      } else {
        setUnmatchedGroups([]);
      }

      // Recargar vendedores reconocidos
      if (batchData.records_matched > 0) {
        const matched = await getMatchedVendorGroups(batchData.id);
        setMatchedGroups(matched);
      } else {
        setMatchedGroups([]);
      }

      // Recargar diagnóstico de status
      try {
        const { data, error } = await supabase.rpc('get_import_diagnostic', {
          p_batch_id: batchData.id
        });

        if (!error && data) {
          setDiagnostics(data);
        }
      } catch (error) {
        console.error('Error al cargar diagnóstico:', error);
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
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary-100 text-primary-800 text-xs font-medium rounded-full">
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
      <div className="p-4 sm:p-6 lg:p-8">
        <button
          onClick={() => setSelectedBatch(null)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 sm:mb-6 transition min-h-[44px]"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="font-medium">Volver a la lista</span>
        </button>

        <div className="bg-white rounded-xl sm:rounded-2xl shadow-soft p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-xl sm:text-2xl font-bold text-accent break-words">Detalle del lote</h2>
              <p className="text-sm sm:text-base text-gray-600 mt-1 break-words">{selectedBatch.file_name}</p>
            </div>
            {getStatusBadge(selectedBatch.status)}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
              <div className="flex items-center gap-3">
                <FileText className="h-6 h-6 sm:h-8 sm:w-8 text-gray-600 flex-shrink-0" />
                <div>
                  <p className="text-xs sm:text-sm text-gray-600">Total</p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900">
                    {selectedBatch.records_total}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-green-50 rounded-xl border border-green-200">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-6 h-6 sm:h-8 sm:w-8 text-green-600 flex-shrink-0" />
                <div>
                  <p className="text-xs sm:text-sm text-green-700">Reconocidos</p>
                  <p className="text-xl sm:text-2xl font-bold text-green-900">
                    {selectedBatch.records_matched}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-orange-50 rounded-xl border border-orange-200">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-6 h-6 sm:h-8 sm:w-8 text-orange-600 flex-shrink-0" />
                <div>
                  <p className="text-xs sm:text-sm text-orange-700">Sin reconocer</p>
                  <p className="text-xl sm:text-2xl font-bold text-orange-900">
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

        {diagnostics && diagnostics.counts && (
          <div className="bg-white rounded-xl shadow-soft p-4 sm:p-6 mb-4 sm:mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Estado de validación</h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-center">
                <p className="text-xs text-gray-600 mb-1">Total</p>
                <p className="text-2xl font-bold text-gray-900">{diagnostics.counts.total || 0}</p>
              </div>
              <div className="p-4 bg-green-50 rounded-xl border border-green-200 text-center">
                <p className="text-xs text-green-700 mb-1">Válidas</p>
                <p className="text-2xl font-bold text-green-700">{diagnostics.counts.valid || 0}</p>
              </div>
              <div className="p-4 bg-primary-50 rounded-xl border border-primary-200 text-center">
                <p className="text-xs text-primary-700 mb-1">Advertencias</p>
                <p className="text-2xl font-bold text-primary-700">{diagnostics.counts.warning || 0}</p>
              </div>
              <div className="p-4 bg-red-50 rounded-xl border border-red-200 text-center">
                <p className="text-xs text-red-700 mb-1">Descartadas</p>
                <p className="text-2xl font-bold text-red-700">{diagnostics.counts.discard || 0}</p>
              </div>
            </div>

            {diagnostics.top_discard_reasons && diagnostics.top_discard_reasons.length > 0 && (
              <div className="border-t border-gray-200 pt-4">
                <h4 className="text-base font-semibold text-gray-900 mb-3">Motivos de descarte principales</h4>
                <div className="space-y-2">
                  {diagnostics.top_discard_reasons.map((reason: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100">
                      <span className="text-sm text-red-900 font-medium">{reason.discard_reason}</span>
                      <span className="text-sm font-bold text-red-700">{reason.count} filas</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {diagnostics.sample_discard_rows && diagnostics.sample_discard_rows.length > 0 && (
              <div className="border-t border-gray-200 pt-4 mt-4">
                <h4 className="text-base font-semibold text-gray-900 mb-3">Ejemplos de filas descartadas</h4>
                <div className="space-y-3">
                  {diagnostics.sample_discard_rows.slice(0, 5).map((row: any, idx: number) => (
                    <div key={idx} className="border-l-4 border-red-300 pl-4 py-2 bg-red-50 rounded-r">
                      <p className="text-sm font-bold text-red-900 mb-1">Fila {row.row_index}</p>
                      <p className="text-xs text-red-700 mb-1"><span className="font-semibold">Motivo:</span> {row.discard_reason}</p>
                      {row.agent_name_raw && <p className="text-xs text-gray-700">Vendedor: {row.agent_name_raw}</p>}
                      {row.documento && <p className="text-xs text-gray-700">Documento: {row.documento}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {diagnostics && (
          <div className="bg-primary-50 border border-primary-200 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-primary-900 mb-4">Diagnóstico de importación</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-sm font-medium text-primary-900 mb-2">Columnas detectadas:</p>
                <div className="space-y-1">
                  <p className="text-sm text-primary-800">
                    <span className="font-medium">Vendedor:</span>{' '}
                    {diagnostics.vendor_column_detected ? (
                      <span className="text-green-700 font-semibold">{diagnostics.vendor_column_detected}</span>
                    ) : (
                      <span className="text-red-700 font-semibold">No detectada</span>
                    )}
                  </p>
                  <p className="text-sm text-primary-800">
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
                <p className="text-sm font-medium text-primary-900 mb-2">Calidad de datos:</p>
                <div className="space-y-1">
                  <p className="text-sm text-primary-800">
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
                <p className="text-sm font-medium text-primary-900 mb-2">
                  Muestra de vendedores detectados (top 5):
                </p>
                <div className="flex flex-wrap gap-2">
                  {diagnostics.sample_vendor_names.map((name: string, idx: number) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-white border border-primary-300 rounded-lg text-sm text-primary-900"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {diagnostics.sample_emails && diagnostics.sample_emails.length > 0 && (
              <div>
                <p className="text-sm font-medium text-primary-900 mb-2">
                  Muestra de emails detectados (top 5):
                </p>
                <div className="flex flex-wrap gap-2">
                  {diagnostics.sample_emails.map((email: string, idx: number) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-white border border-primary-300 rounded-lg text-sm text-primary-900"
                    >
                      {email}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {usuario?.rol === 'Administrador' && (
          <SelfCheckConsistencia batchId={selectedBatch.id} batchName={selectedBatch.file_name} />
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
                              onClick={() => navigate(`/comisiones/lote/${batch.id}`)}
                              className="text-sm text-accent hover:text-primary-800 font-medium flex items-center gap-1"
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
            {(selectedBatch.status === 'completed' || selectedBatch.status === 'ready_to_convert') &&
             !selectedBatch.converted_to_commissions && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4 sm:mb-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-green-900">Listo para convertir</p>
                      <p className="text-sm text-green-700 mt-1">
                        {selectedBatch.records_unmatched > 0 ? (
                          <>
                            Hay {selectedBatch.records_unmatched} documentos sin asignación. Podrás asignarlos dentro del lote antes de cerrarlo.
                          </>
                        ) : (
                          <>
                            Todos los documentos tienen usuarios asignados. Puedes convertir este lote en lotes de comisiones por semana.
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowConvertModal(true)}
                    className="w-full sm:w-auto px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition flex items-center justify-center gap-2 whitespace-nowrap min-h-[44px] font-semibold"
                  >
                    <ArrowRight className="h-5 w-5" />
                    Convertir en Lotes (por semana)
                  </button>
                </div>
              </div>
            )}

            {selectedBatch.converted_to_commissions && (
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

        {selectedBatch.records_matched > 0 && !conversionResult && (
          <VendedoresReconocidosTable
            groups={matchedGroups}
            batchId={selectedBatch.id}
            onRefresh={handleRefreshBatch}
          />
        )}

        {selectedBatch.records_matched > 0 && selectedBatch.records_unmatched > 0 && !conversionResult && (
          <div className="my-6"></div>
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
    <div className="p-4 sm:p-6 lg:p-8">
      <button
        onClick={() => navigate('/comisiones')}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 sm:mb-6 transition min-h-[44px]"
      >
        <ArrowLeft className="h-5 w-5" />
        <span className="font-medium">Volver a Comisiones</span>
      </button>

      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-accent">
          Importar documentos desde Excel
        </h1>
        <p className="text-sm sm:text-base text-gray-600 mt-1">
          Sube un archivo Excel para procesar documentos y asignar vendedores automáticamente
        </p>
      </div>

      <div className="bg-white rounded-xl sm:rounded-2xl shadow-soft p-4 sm:p-6 mb-4 sm:mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-primary-100 rounded-lg flex-shrink-0">
            <Upload className="h-5 h-5 sm:h-6 sm:w-6 text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900">Cargar archivo</h3>
            <p className="text-xs sm:text-sm text-gray-600">Selecciona un archivo Excel (.xlsx o .xls)</p>
          </div>
        </div>

        <div
          className="border-2 border-dashed border-gray-300 rounded-xl p-6 sm:p-8"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-center">
            <FileSpreadsheet className="h-10 h-10 sm:h-12 sm:w-12 text-gray-400 mx-auto mb-3 sm:mb-4" />
            <div>
              <label
                htmlFor="file-upload"
                className="cursor-pointer inline-block text-sm sm:text-base text-accent hover:text-primary-700 font-medium"
                onClick={(e) => e.stopPropagation()}
              >
                Selecciona un archivo
              </label>
              <input
                id="file-upload"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                onClick={(e) => e.stopPropagation()}
                className="hidden"
                disabled={loading}
              />
            </div>
            <p className="text-xs sm:text-sm text-gray-500 mt-2">o arrastra y suelta aquí</p>
          </div>

          {selectedFile && (
            <div className="mt-4 p-4 bg-primary-50 border border-primary-200 rounded-xl">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <FileSpreadsheet className="h-6 h-6 sm:h-8 sm:w-8 text-accent flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm sm:text-base font-medium text-gray-900 truncate">{selectedFile.name}</p>
                    <p className="text-xs sm:text-sm text-gray-600">
                      {(selectedFile.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleUpload}
                  disabled={loading}
                  className="w-full sm:w-auto px-6 py-3 bg-accent text-white rounded-xl hover:bg-accent-hover transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-h-[44px] font-semibold"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span className="text-sm sm:text-base">{uploadProgress}</span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-5 w-5" />
                      <span className="text-sm sm:text-base">Procesar archivo</span>
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
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
          </div>
        ) : batches.length === 0 ? (
          <div className="text-center py-12">
            <FileSpreadsheet className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg mb-2">No hay importaciones</p>
            <p className="text-gray-400 text-sm">Sube tu primer archivo Excel para comenzar</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Archivo
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Estado
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">
                    Total
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden md:table-cell">
                    Reconocidos
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden md:table-cell">
                    Pendientes
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">
                    Fecha
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {batches.map((batch) => (
                  <tr key={batch.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 sm:px-6 py-4">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileSpreadsheet className="h-5 w-5 text-green-600 flex-shrink-0" />
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {batch.file_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-4">{getStatusBadge(batch.status)}</td>
                    <td className="px-4 sm:px-6 py-4 hidden sm:table-cell">
                      <span className="text-sm font-semibold text-gray-900">
                        {batch.records_total}
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-4 hidden md:table-cell">
                      <span className="text-sm font-semibold text-green-600">
                        {batch.records_matched}
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-4 hidden md:table-cell">
                      {batch.records_unmatched > 0 ? (
                        <span className="text-sm font-semibold text-orange-600">
                          {batch.records_unmatched}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">0</span>
                      )}
                    </td>
                    <td className="px-4 sm:px-6 py-4 hidden lg:table-cell">
                      <span className="text-sm text-gray-600">
                        {new Date(batch.imported_at).toLocaleDateString('es-MX', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-4">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <button
                          onClick={() => handleViewBatch(batch)}
                          className="text-xs sm:text-sm font-medium text-accent hover:text-primary-700 transition whitespace-nowrap"
                        >
                          Ver
                        </button>
                        <button
                          onClick={() => handleDeleteBatch(batch)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition min-h-[36px] min-w-[36px] flex items-center justify-center"
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
