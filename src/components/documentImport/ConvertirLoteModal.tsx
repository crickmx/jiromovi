import { useState, useEffect } from 'react';
import {
  X,
  AlertTriangle,
  CheckCircle,
  Calendar,
  Users,
  FileText,
  ChevronDown,
  ChevronUp,
  Download,
  Info,
} from 'lucide-react';
import {
  validateBatchForConversionDetailed,
  convertBatchToCommissions,
  formatWeekPeriod,
  type DetailedBatchConversionValidation,
  type ConversionResult,
  type ValidationError,
} from '../../lib/documentImportUtils';

interface ConvertirLoteModalProps {
  batchId: string;
  batchName: string;
  onClose: () => void;
  onSuccess: (result: ConversionResult) => void;
}

export default function ConvertirLoteModal({
  batchId,
  batchName,
  onClose,
  onSuccess,
}: ConvertirLoteModalProps) {
  const [validation, setValidation] = useState<DetailedBatchConversionValidation | null>(null);
  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedErrors, setExpandedErrors] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadValidation();
  }, [batchId]);

  async function loadValidation() {
    try {
      setLoading(true);
      setError(null);
      const data = await validateBatchForConversionDetailed(batchId);
      setValidation(data);
    } catch (err: any) {
      setError(err.message || 'Error al validar el batch');
    } finally {
      setLoading(false);
    }
  }

  async function handleConvert() {
    if (!validation?.canConvert) return;

    try {
      setConverting(true);
      setError(null);
      const result = await convertBatchToCommissions(batchId);
      onSuccess(result);
    } catch (err: any) {
      setError(err.message || 'Error al convertir el batch');
    } finally {
      setConverting(false);
    }
  }

  function toggleErrorExpand(index: number) {
    const newExpanded = new Set(expandedErrors);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedErrors(newExpanded);
  }

  function downloadErrorsCSV(validationError: ValidationError) {
    if (!validationError.examples || validationError.examples.length === 0) return;

    const headers = ['Fila', 'Póliza', 'Vendedor', 'Email', 'ID Documento'];
    const rows = validationError.examples.map((ex) => [
      ex.row_index,
      ex.poliza || '',
      ex.vendor_name || '',
      ex.vendor_email || '',
      ex.document_id || '',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `errores_${validationError.code}_${batchName}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const blockingErrors = validation?.errors.filter((e) => e.severity === 'blocking') || [];
  const warnings = validation?.errors.filter((e) => e.severity === 'warning') || [];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900">
            Convertir a Lotes de Comisiones
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition p-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-4 sm:p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-red-900">Error</p>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              </div>
            </div>
          ) : validation && !validation.canConvert ? (
            <>
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-red-900">No se puede convertir el batch</p>
                    <p className="text-sm text-red-700 mt-1">
                      Hay {validation.blockingErrorsCount} error(es) bloqueante(s). Corrige los problemas
                      antes de continuar.
                    </p>
                  </div>
                </div>
              </div>

              {blockingErrors.length > 0 && (
                <div className="space-y-3 mb-6">
                  <h3 className="font-semibold text-gray-900">Errores bloqueantes</h3>
                  {blockingErrors.map((err, idx) => (
                    <div key={idx} className="border border-red-300 rounded-lg overflow-hidden">
                      <div
                        className="bg-red-50 p-4 cursor-pointer hover:bg-red-100 transition"
                        onClick={() => toggleErrorExpand(idx)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="px-2 py-0.5 bg-red-200 text-red-900 text-xs font-semibold rounded">
                                {err.code}
                              </span>
                              <span className="text-red-900 font-medium text-sm">{err.count} filas afectadas</span>
                            </div>
                            <p className="text-sm text-red-800">{err.message}</p>
                          </div>
                          {expandedErrors.has(idx) ? (
                            <ChevronUp className="h-5 w-5 text-red-600 flex-shrink-0" />
                          ) : (
                            <ChevronDown className="h-5 w-5 text-red-600 flex-shrink-0" />
                          )}
                        </div>
                      </div>

                      {expandedErrors.has(idx) && err.examples && err.examples.length > 0 && (
                        <div className="border-t border-red-300">
                          <div className="p-4 bg-white">
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-sm font-medium text-gray-700">
                                Ejemplos (primeros {err.examples.length})
                              </span>
                              <button
                                onClick={() => downloadErrorsCSV(err)}
                                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition"
                              >
                                <Download className="h-4 w-4" />
                                Descargar CSV
                              </button>
                            </div>
                            <div className="overflow-x-auto">
                              <table className="min-w-full text-sm">
                                <thead className="bg-gray-50">
                                  <tr>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Fila</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Póliza</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Vendedor</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Email</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                  {err.examples.slice(0, 10).map((ex, exIdx) => (
                                    <tr key={exIdx}>
                                      <td className="px-3 py-2 text-gray-900">{ex.row_index}</td>
                                      <td className="px-3 py-2 text-gray-600">{ex.poliza || '-'}</td>
                                      <td className="px-3 py-2 text-gray-600">{ex.vendor_name || '-'}</td>
                                      <td className="px-3 py-2 text-gray-600">{ex.vendor_email || '-'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={onClose}
                  className="w-full sm:w-auto px-4 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition font-semibold min-h-[44px]"
                >
                  Cerrar
                </button>
              </div>
            </>
          ) : validation ? (
            <>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-green-900">Listo para convertir</p>
                    <p className="text-sm text-green-700 mt-1">
                      Este archivo está listo para convertirse en lotes de comisiones por semana.
                    </p>
                  </div>
                </div>
              </div>

              {warnings.length > 0 && (
                <div className="space-y-3 mb-6">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Info className="h-5 w-5 text-blue-600" />
                    Advertencias ({warnings.length})
                  </h3>
                  {warnings.map((warn, idx) => (
                    <div key={idx + blockingErrors.length} className="border border-blue-300 rounded-lg overflow-hidden">
                      <div
                        className="bg-blue-50 p-4 cursor-pointer hover:bg-blue-100 transition"
                        onClick={() => toggleErrorExpand(idx + blockingErrors.length)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="px-2 py-0.5 bg-blue-200 text-blue-900 text-xs font-semibold rounded">
                                {warn.code}
                              </span>
                              <span className="text-blue-900 font-medium text-sm">{warn.count} filas</span>
                            </div>
                            <p className="text-sm text-blue-800">{warn.message}</p>
                          </div>
                          {expandedErrors.has(idx + blockingErrors.length) ? (
                            <ChevronUp className="h-5 w-5 text-blue-600 flex-shrink-0" />
                          ) : (
                            <ChevronDown className="h-5 w-5 text-blue-600 flex-shrink-0" />
                          )}
                        </div>
                      </div>

                      {expandedErrors.has(idx + blockingErrors.length) && warn.examples && warn.examples.length > 0 && (
                        <div className="border-t border-blue-300">
                          <div className="p-4 bg-white">
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-sm font-medium text-gray-700">
                                Ejemplos (primeros {Math.min(warn.examples.length, 10)})
                              </span>
                              <button
                                onClick={() => downloadErrorsCSV(warn)}
                                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition"
                              >
                                <Download className="h-4 w-4" />
                                Descargar CSV
                              </button>
                            </div>
                            <div className="overflow-x-auto">
                              <table className="min-w-full text-sm">
                                <thead className="bg-gray-50">
                                  <tr>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Fila</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Póliza</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Vendedor</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Email</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                  {warn.examples.slice(0, 10).map((ex, exIdx) => (
                                    <tr key={exIdx}>
                                      <td className="px-3 py-2 text-gray-900">{ex.row_index}</td>
                                      <td className="px-3 py-2 text-gray-600">{ex.poliza || '-'}</td>
                                      <td className="px-3 py-2 text-gray-600">{ex.vendor_name || '-'}</td>
                                      <td className="px-3 py-2 text-gray-600">{ex.vendor_email || '-'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="mb-6">
                <h3 className="font-semibold text-gray-900 mb-3">Resumen</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-gray-600 mb-2">
                      <FileText className="h-4 w-4 flex-shrink-0" />
                      <span className="text-xs sm:text-sm">Total documentos</span>
                    </div>
                    <p className="text-xl sm:text-2xl font-bold text-gray-900">
                      {validation.summary.total_documents}
                    </p>
                    <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                      <p className="text-green-600 font-medium">
                        {validation.summary.matched_documents} asignados
                      </p>
                      {validation.summary.unmatched_documents > 0 && (
                        <p className="text-orange-600 font-medium">
                          {validation.summary.unmatched_documents} pendientes
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-gray-600 mb-2">
                      <Users className="h-4 w-4 flex-shrink-0" />
                      <span className="text-xs sm:text-sm">Agentes</span>
                    </div>
                    <p className="text-xl sm:text-2xl font-bold text-gray-900">
                      {validation.summary.total_agents}
                    </p>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-gray-600 mb-2">
                      <Calendar className="h-4 w-4 flex-shrink-0" />
                      <span className="text-xs sm:text-sm">Lotes a crear</span>
                    </div>
                    <p className="text-xl sm:text-2xl font-bold text-gray-900">
                      {validation.summary.weeks.length +
                        (validation.summary.has_no_date_documents ? 1 : 0)}
                    </p>
                    {validation.summary.has_no_date_documents && (
                      <p className="text-xs text-orange-600 font-medium mt-1">
                        + 1 lote "Sin fecha"
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {validation.summary.weeks.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-semibold text-gray-900 mb-3">Lotes que se crearán</h3>
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              Semana
                            </th>
                            <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              Periodo
                            </th>
                            <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              Docs
                            </th>
                            <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">
                              Agentes
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {validation.summary.weeks.map((week, idx) => (
                            <tr key={idx}>
                              <td className="px-3 sm:px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                                Semana {week.week_number}
                              </td>
                              <td className="px-3 sm:px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                                {formatWeekPeriod(week.week_start, week.week_end)}
                              </td>
                              <td className="px-3 sm:px-4 py-3 text-sm text-gray-600">{week.document_count}</td>
                              <td className="px-3 sm:px-4 py-3 text-sm text-gray-600 hidden sm:table-cell">
                                {week.agent_count}
                              </td>
                            </tr>
                          ))}
                          {validation.summary.has_no_date_documents && (
                            <tr className="bg-orange-50">
                              <td className="px-3 sm:px-4 py-3 text-sm font-medium text-orange-900 whitespace-nowrap">
                                Sin fecha
                              </td>
                              <td className="px-3 sm:px-4 py-3 text-sm text-orange-700">Pendiente de revisión</td>
                              <td className="px-3 sm:px-4 py-3 text-sm text-orange-700">
                                {validation.summary.missing_dates}
                              </td>
                              <td className="px-3 sm:px-4 py-3 text-sm text-orange-700 hidden sm:table-cell">-</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 text-sm text-yellow-800">
                    <p className="font-semibold mb-1">Importante</p>
                    <p>
                      Esta acción creará lotes de comisiones por semana y no se puede deshacer.
                      {validation.summary.unmatched_documents > 0 ? (
                        <> Los documentos sin asignar estarán disponibles en el lote para asignarles usuarios antes de cerrarlo.</>
                      ) : (
                        <> Los lotes creados seguirán el flujo normal de comisiones.</>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-3">
                <button
                  onClick={onClose}
                  disabled={converting}
                  className="w-full sm:w-auto px-4 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition disabled:opacity-50 font-semibold min-h-[44px]"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConvert}
                  disabled={converting}
                  className="w-full sm:w-auto px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition disabled:opacity-50 flex items-center justify-center gap-2 font-semibold min-h-[44px]"
                >
                  {converting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Convirtiendo...</span>
                    </>
                  ) : (
                    <span>Convertir a Lotes</span>
                  )}
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
