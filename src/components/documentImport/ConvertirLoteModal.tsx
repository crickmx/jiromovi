import { useState, useEffect } from 'react';
import { X, AlertTriangle, CheckCircle, Calendar, Users, FileText } from 'lucide-react';
import {
  validateBatchForConversion,
  convertBatchToCommissions,
  formatWeekPeriod,
  type BatchConversionValidation,
  type ConversionResult,
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
  const [validation, setValidation] = useState<BatchConversionValidation | null>(null);
  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadValidation();
  }, [batchId]);

  async function loadValidation() {
    try {
      setLoading(true);
      setError(null);
      const data = await validateBatchForConversion(batchId);
      setValidation(data);
    } catch (err: any) {
      setError(err.message || 'Error al validar el batch');
    } finally {
      setLoading(false);
    }
  }

  async function handleConvert() {
    if (!validation?.can_convert) return;

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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
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
          ) : validation && !validation.can_convert ? (
            <>
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-red-900">
                      No se puede convertir el batch
                    </p>
                    <p className="text-sm text-red-700 mt-1">
                      Corrige los siguientes problemas antes de continuar:
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2 mb-6">
                {validation.errors.map((err, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-sm text-red-700">
                    <span className="font-bold">•</span>
                    <span>{err}</span>
                  </div>
                ))}
              </div>

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
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-blue-900">
                      Listo para convertir
                    </p>
                    <p className="text-sm text-blue-700 mt-1">
                      Este archivo está listo para convertirse en lotes de comisiones por semana.
                    </p>
                  </div>
                </div>
              </div>

              {validation.warnings && validation.warnings.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4 sm:mb-6">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-semibold text-blue-900 mb-2">Información importante</p>
                      <div className="space-y-1">
                        {validation.warnings.map((warning, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-sm text-blue-800">
                            <span className="font-bold">•</span>
                            <span>{warning}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="mb-4 sm:mb-6">
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
                      {validation.summary.assigned_documents !== undefined && (
                        <p className="text-green-600 font-medium">
                          {validation.summary.assigned_documents} asignados
                        </p>
                      )}
                      {validation.summary.unmatched_documents !== undefined &&
                       validation.summary.unmatched_documents > 0 && (
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
                      <span className="text-xs sm:text-sm">Semanas</span>
                    </div>
                    <p className="text-xl sm:text-2xl font-bold text-gray-900">
                      {validation.summary.weeks.length}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mb-4 sm:mb-6">
                <h3 className="font-semibold text-gray-900 mb-3">
                  Lotes que se crearán
                </h3>
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto -mx-4 sm:mx-0">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Semana
                          </th>
                          <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Periodo
                          </th>
                          <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Docs
                          </th>
                          <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
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
                            <td className="px-3 sm:px-4 py-3 text-sm text-gray-600">
                              {week.document_count}
                            </td>
                            <td className="px-3 sm:px-4 py-3 text-sm text-gray-600 hidden sm:table-cell">
                              {week.agent_count}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-4 sm:mb-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 text-sm text-yellow-800">
                    <p className="font-semibold mb-1">Importante</p>
                    <p>
                      Esta acción creará lotes de comisiones por semana y no se puede deshacer.
                      {validation.summary.unmatched_documents && validation.summary.unmatched_documents > 0 ? (
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
                  className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2 font-semibold min-h-[44px]"
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
