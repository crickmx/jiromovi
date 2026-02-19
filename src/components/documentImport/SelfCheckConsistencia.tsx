import { useState } from 'react';
import { AlertTriangle, CheckCircle, FileSearch, Loader } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface SelfCheckResult {
  passed: boolean;
  import_stats: {
    total_rows: number;
    matched: number;
    unmatched: number;
    method_counts: Record<string, number>;
    sheet_used: string;
  };
  errors: string[];
  warnings: string[];
  debug_info: {
    sheet_names: string[];
    headers_detected: string[];
    vendor_column: string;
    email_column: string;
    empty_vendor_count: number;
  };
}

interface SelfCheckProps {
  batchId: string;
  batchName: string;
}

export default function SelfCheckConsistencia({ batchId, batchName }: SelfCheckProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SelfCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runSelfCheck() {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const { data: batch } = await supabase
        .from('document_import_batches')
        .select('*')
        .eq('id', batchId)
        .single();

      if (!batch) {
        throw new Error('Batch no encontrado');
      }

      const { data: docs } = await supabase
        .from('imported_documents')
        .select('*')
        .eq('batch_id', batchId);

      if (!docs || docs.length === 0) {
        throw new Error('No se encontraron documentos en este batch');
      }

      const matchedCount = docs.filter(d => d.movi_user_id !== null).length;
      const unmatchedCount = docs.filter(d => d.movi_user_id === null).length;
      const emptyVendorCount = docs.filter(d => !d.vendor_name_raw).length;

      const methodCounts: Record<string, number> = {};
      docs.forEach(doc => {
        const method = doc.match_method || 'none';
        methodCounts[method] = (methodCounts[method] || 0) + 1;
      });

      const metadata = batch.metadata as any || {};
      const sheetUsed = metadata.sheet_used || 'N/A';
      const headersDetected = metadata.headers_detected || [];

      const errors: string[] = [];
      const warnings: string[] = [];

      if (docs.length !== batch.records_total) {
        errors.push(
          `Discrepancia en total de registros: Batch reporta ${batch.records_total}, pero hay ${docs.length} documentos guardados`
        );
      }

      if (matchedCount !== batch.records_matched) {
        warnings.push(
          `Discrepancia en reconocidos: Batch reporta ${batch.records_matched}, pero hay ${matchedCount} reconocidos`
        );
      }

      if (unmatchedCount !== batch.records_unmatched) {
        warnings.push(
          `Discrepancia en no reconocidos: Batch reporta ${batch.records_unmatched}, pero hay ${unmatchedCount} no reconocidos`
        );
      }

      if (emptyVendorCount > docs.length * 0.5) {
        warnings.push(
          `Más del 50% de registros (${emptyVendorCount}) no tienen VendNombre. Verifica que la columna se detectó correctamente.`
        );
      }

      const vendorColumn = metadata.vendor_column_detected || headersDetected.find((h: string) =>
        h.toLowerCase().includes('vend') || h.toLowerCase().includes('nombre')
      ) || 'NO DETECTADA';

      const emailColumn = metadata.email_column_detected || headersDetected.find((h: string) =>
        h.toLowerCase().includes('email') || h.toLowerCase().includes('correo')
      ) || 'NO DETECTADA';

      if (vendorColumn === 'NO DETECTADA') {
        errors.push('No se detectó la columna de vendedor (VendNombre)');
      }

      const passed = errors.length === 0;

      setResult({
        passed,
        import_stats: {
          total_rows: docs.length,
          matched: matchedCount,
          unmatched: unmatchedCount,
          method_counts: methodCounts,
          sheet_used: sheetUsed,
        },
        errors,
        warnings,
        debug_info: {
          sheet_names: metadata.all_sheets || [sheetUsed],
          headers_detected: headersDetected,
          vendor_column: vendorColumn,
          email_column: emailColumn,
          empty_vendor_count: emptyVendorCount,
        },
      });
    } catch (err: any) {
      setError(err.message || 'Error al ejecutar self-check');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 mb-4 sm:mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-100 rounded-lg">
            <FileSearch className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Verificación de Consistencia</h3>
            <p className="text-sm text-gray-600">Self-check del proceso de importación</p>
          </div>
        </div>
        <button
          onClick={runSelfCheck}
          disabled={loading}
          className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition disabled:opacity-50 flex items-center gap-2 min-h-[44px]"
        >
          {loading ? (
            <>
              <Loader className="h-4 w-4 animate-spin" />
              <span>Verificando...</span>
            </>
          ) : (
            <>
              <FileSearch className="h-4 w-4" />
              <span>Verificar Consistencia</span>
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-red-900">Error</p>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className={`rounded-lg p-4 ${result.passed ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <div className="flex items-start gap-3">
              {result.passed ? (
                <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0" />
              ) : (
                <AlertTriangle className="h-6 w-6 text-red-600 flex-shrink-0" />
              )}
              <div className="flex-1">
                <p className={`font-bold text-lg ${result.passed ? 'text-green-900' : 'text-red-900'}`}>
                  {result.passed ? 'PASS ✓' : 'FAIL ✗'}
                </p>
                <p className={`text-sm mt-1 ${result.passed ? 'text-green-800' : 'text-red-800'}`}>
                  {result.passed
                    ? 'La importación procesó los datos correctamente.'
                    : 'Se encontraron inconsistencias en la importación.'}
                </p>
              </div>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="font-semibold text-red-900 mb-2">Errores Detectados:</p>
              <ul className="space-y-1">
                {result.errors.map((err, idx) => (
                  <li key={idx} className="text-sm text-red-800 flex items-start gap-2">
                    <span className="font-bold">•</span>
                    <span>{err}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.warnings.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="font-semibold text-yellow-900 mb-2">Advertencias:</p>
              <ul className="space-y-1">
                {result.warnings.map((warn, idx) => (
                  <li key={idx} className="text-sm text-yellow-800 flex items-start gap-2">
                    <span className="font-bold">•</span>
                    <span>{warn}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="font-semibold text-gray-900 mb-3">Resumen de Importación:</p>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Total filas:</span>
                <span className="ml-2 font-semibold text-gray-900">{result.import_stats.total_rows}</span>
              </div>
              <div>
                <span className="text-gray-600">Hoja usada:</span>
                <span className="ml-2 font-semibold text-gray-900">{result.import_stats.sheet_used}</span>
              </div>
              <div>
                <span className="text-gray-600">Reconocidos:</span>
                <span className="ml-2 font-semibold text-green-700">{result.import_stats.matched}</span>
              </div>
              <div>
                <span className="text-gray-600">No reconocidos:</span>
                <span className="ml-2 font-semibold text-orange-700">{result.import_stats.unmatched}</span>
              </div>
            </div>

            <div className="mt-4">
              <p className="text-sm text-gray-600 font-medium mb-2">Métodos de matching:</p>
              <div className="space-y-1">
                {Object.entries(result.import_stats.method_counts).map(([method, count]) => (
                  <div key={method} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700 capitalize">{method.replace('_', ' ')}</span>
                    <span className="font-semibold text-gray-900">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
            <p className="font-semibold text-primary-900 mb-3">Debug Info:</p>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-primary-700 font-medium">Hojas detectadas:</span>
                <p className="text-primary-800 mt-1">{result.debug_info.sheet_names.join(', ')}</p>
              </div>
              <div>
                <span className="text-primary-700 font-medium">Columna VendNombre:</span>
                <p className="text-primary-800 mt-1">{result.debug_info.vendor_column}</p>
              </div>
              <div>
                <span className="text-primary-700 font-medium">Columna EmailAgente:</span>
                <p className="text-primary-800 mt-1">{result.debug_info.email_column}</p>
              </div>
              <div>
                <span className="text-primary-700 font-medium">Filas sin vendedor:</span>
                <p className="text-primary-800 mt-1">
                  {result.debug_info.empty_vendor_count} ({((result.debug_info.empty_vendor_count / result.import_stats.total_rows) * 100).toFixed(1)}%)
                </p>
              </div>
              <div>
                <span className="text-primary-700 font-medium">Headers detectados:</span>
                <p className="text-primary-800 mt-1 text-xs">
                  {result.debug_info.headers_detected.slice(0, 10).join(', ')}
                  {result.debug_info.headers_detected.length > 10 && '...'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
