import { useState } from 'react';
import { AlertTriangle, CheckCircle, FileSearch, Loader } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface TestResult {
  passed: boolean;
  totalChecked: number;
  suspiciousCount: number;
  errorCount: number;
  missingBaseCount: number;
  missingRulesCount: number;
  errors: string[];
  warnings: string[];
  suspiciousItems: Array<{
    id: string;
    poliza: string;
    prima_neta: number;
    commission_bruta: number;
    calculation_status: string;
  }>;
}

export default function CommissionBugTest() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runTests() {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      console.log('[CommissionBugTest] Starting tests...');

      const { data: config } = await supabase
        .from('commission_import_config')
        .select('*')
        .eq('active', true)
        .maybeSingle();

      if (!config) {
        throw new Error('No se encontró configuración activa');
      }

      if (config.allow_prima_neta_as_commission_bruta === true) {
        throw new Error(
          'CONFIGURACIÓN PELIGROSA: allow_prima_neta_as_commission_bruta está en true. ' +
          'Esto permite que commission_bruta sea igual a prima_neta, lo cual es probablemente un bug.'
        );
      }

      const { data: details, error: detailsError } = await supabase
        .from('commission_details')
        .select('id, poliza, prima_neta, commission_bruta, calculation_status, calculation_warnings, calculation_method')
        .not('commission_bruta', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1000);

      if (detailsError) {
        throw new Error(`Error al cargar comisiones: ${detailsError.message}`);
      }

      if (!details || details.length === 0) {
        throw new Error('No se encontraron comisiones para verificar');
      }

      console.log(`[CommissionBugTest] Checking ${details.length} commission records...`);

      const errors: string[] = [];
      const warnings: string[] = [];
      const suspiciousItems: any[] = [];

      let suspiciousCount = 0;
      let errorCount = 0;
      let missingBaseCount = 0;
      let missingRulesCount = 0;

      for (const detail of details) {
        if (detail.calculation_status === 'error') {
          errorCount++;

          if (detail.commission_bruta === detail.prima_neta && detail.prima_neta > 0) {
            suspiciousCount++;
            suspiciousItems.push({
              id: detail.id,
              poliza: detail.poliza,
              prima_neta: detail.prima_neta,
              commission_bruta: detail.commission_bruta,
              calculation_status: detail.calculation_status,
            });

            errors.push(
              `Póliza ${detail.poliza}: commission_bruta (${detail.commission_bruta}) === prima_neta (${detail.prima_neta})`
            );
          }
        }

        if (detail.calculation_status === 'missing_base') {
          missingBaseCount++;
          warnings.push(`Póliza ${detail.poliza}: Falta valor de comisión base`);
        }

        if (detail.calculation_status === 'missing_rules') {
          missingRulesCount++;
          warnings.push(`Póliza ${detail.poliza}: Falta regla de negocio`);
        }

        if (detail.commission_bruta === detail.prima_neta &&
            detail.prima_neta > 0 &&
            detail.calculation_status !== 'error') {
          suspiciousCount++;
          suspiciousItems.push({
            id: detail.id,
            poliza: detail.poliza,
            prima_neta: detail.prima_neta,
            commission_bruta: detail.commission_bruta,
            calculation_status: detail.calculation_status,
          });

          warnings.push(
            `Póliza ${detail.poliza}: commission_bruta === prima_neta pero status es "${detail.calculation_status}" (debería ser "error")`
          );
        }

        if (detail.calculation_method === 'unknown') {
          warnings.push(`Póliza ${detail.poliza}: Método de cálculo desconocido`);
        }
      }

      const passed = errors.length === 0;

      setResult({
        passed,
        totalChecked: details.length,
        suspiciousCount,
        errorCount,
        missingBaseCount,
        missingRulesCount,
        errors,
        warnings,
        suspiciousItems: suspiciousItems.slice(0, 10),
      });

      console.log('[CommissionBugTest] Tests complete:', { passed, errors: errors.length, warnings: warnings.length });

    } catch (err: any) {
      console.error('[CommissionBugTest] Error:', err);
      setError(err.message || 'Error al ejecutar tests');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 mb-4 sm:mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <FileSearch className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Test Anti-Regresión: Comisión Base</h3>
            <p className="text-sm text-gray-600">Verifica que commission_bruta no sea igual a prima_neta</p>
          </div>
        </div>
        <button
          onClick={runTests}
          disabled={loading}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50 flex items-center gap-2 min-h-[44px]"
        >
          {loading ? (
            <>
              <Loader className="h-4 w-4 animate-spin" />
              <span>Ejecutando...</span>
            </>
          ) : (
            <>
              <FileSearch className="h-4 w-4" />
              <span>Ejecutar Test</span>
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
                    ? 'No se detectaron bugs de comisión base = prima neta.'
                    : 'Se detectaron registros donde commission_bruta === prima_neta.'}
                </p>
              </div>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="font-semibold text-red-900 mb-2">Errores Críticos:</p>
              <ul className="space-y-1 max-h-60 overflow-y-auto">
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
              <ul className="space-y-1 max-h-60 overflow-y-auto">
                {result.warnings.slice(0, 20).map((warn, idx) => (
                  <li key={idx} className="text-sm text-yellow-800 flex items-start gap-2">
                    <span className="font-bold">•</span>
                    <span>{warn}</span>
                  </li>
                ))}
              </ul>
              {result.warnings.length > 20 && (
                <p className="text-sm text-yellow-700 mt-2">... y {result.warnings.length - 20} advertencias más</p>
              )}
            </div>
          )}

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="font-semibold text-gray-900 mb-3">Estadísticas:</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Total verificados:</span>
                <span className="ml-2 font-semibold text-gray-900">{result.totalChecked}</span>
              </div>
              <div>
                <span className="text-gray-600">Sospechosos:</span>
                <span className="ml-2 font-semibold text-orange-700">{result.suspiciousCount}</span>
              </div>
              <div>
                <span className="text-gray-600">Con error:</span>
                <span className="ml-2 font-semibold text-red-700">{result.errorCount}</span>
              </div>
              <div>
                <span className="text-gray-600">Sin base:</span>
                <span className="ml-2 font-semibold text-yellow-700">{result.missingBaseCount}</span>
              </div>
              <div>
                <span className="text-gray-600">Sin reglas:</span>
                <span className="ml-2 font-semibold text-yellow-700">{result.missingRulesCount}</span>
              </div>
            </div>
          </div>

          {result.suspiciousItems.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <p className="font-semibold text-orange-900 mb-3">Registros Sospechosos (muestra):</p>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-orange-200">
                      <th className="text-left py-2 px-2 text-orange-900">Póliza</th>
                      <th className="text-right py-2 px-2 text-orange-900">Prima Neta</th>
                      <th className="text-right py-2 px-2 text-orange-900">Comisión Bruta</th>
                      <th className="text-left py-2 px-2 text-orange-900">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.suspiciousItems.map((item) => (
                      <tr key={item.id} className="border-b border-orange-100">
                        <td className="py-2 px-2 text-orange-800">{item.poliza}</td>
                        <td className="text-right py-2 px-2 text-orange-800">
                          ${item.prima_neta.toFixed(2)}
                        </td>
                        <td className="text-right py-2 px-2 text-orange-800 font-semibold">
                          ${item.commission_bruta.toFixed(2)}
                        </td>
                        <td className="py-2 px-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            item.calculation_status === 'error' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {item.calculation_status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
            <p className="font-semibold text-primary-900 mb-2">Recomendación:</p>
            <p className="text-sm text-primary-800">
              {result.passed
                ? 'El sistema está funcionando correctamente. No se detectaron bugs de comisión base.'
                : 'Se detectaron problemas. Ejecuta la función de recálculo de lotes para corregir los registros afectados.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
