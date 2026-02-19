import { useState } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { AlertCircle, CheckCircle2, Loader2, XCircle } from 'lucide-react';

interface VigentesRecord {
  idDocto?: string;
  fecha?: string;
  oficina?: string;
  vendedor?: string;
  aseguradora?: string;
  ramo?: string;
  subramo?: string;
  importe?: string;
  poliza?: string;
  cliente?: string;
  rawRecord?: string;
}

interface VigentesResponse {
  ok: boolean;
  report: string;
  page: number;
  itemsForPage: number;
  records: VigentesRecord[];
  raw?: {
    responseNbr: string;
    responseTxt: string;
    message: string;
  };
  stage?: string;
  message?: string;
  debug?: any;
}

export default function SicasVigentesTest() {
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [itemsForPage, setItemsForPage] = useState(10);
  const [result, setResult] = useState<VigentesResponse | null>(null);

  const runTest = async () => {
    setLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke(
        'sicas-get-vigentes-page',
        {
          body: {
            page,
            itemsForPage,
          },
        }
      );

      if (error) {
        throw error;
      }

      setResult(data);
    } catch (error: any) {
      setResult({
        ok: false,
        report: 'H03117',
        page,
        itemsForPage,
        records: [],
        stage: 'CLIENT_ERROR',
        message: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageHeader
        title="SICAS - Prueba Quirúrgica: Documentos Vigentes"
        description="Prueba controlada: 1 reporte, 1 página, datos mínimos. Objetivo: obtener al menos 1 registro válido."
      />

      <Card className="p-6">
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-blue-400 mt-0.5" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">
                Enfoque Quirúrgico
              </h3>
              <div className="mt-2 text-sm text-blue-700">
                <ul className="list-disc list-inside space-y-1">
                  <li>
                    <strong>1 reporte:</strong> H03117 (Documentos/Pólizas
                    Vigentes)
                  </li>
                  <li>
                    <strong>1 página:</strong> Control total sobre paginación
                  </li>
                  <li>
                    <strong>Lote pequeño:</strong> 1-10 registros para
                    diagnóstico
                  </li>
                  <li>
                    <strong>Sin filtros complejos:</strong> Últimos 365 días por
                    defecto
                  </li>
                  <li>
                    <strong>Éxito = 1 registro válido</strong>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <Label htmlFor="page">Página</Label>
            <Input
              id="page"
              type="number"
              min={1}
              value={page}
              onChange={(e) => setPage(parseInt(e.target.value) || 1)}
            />
          </div>
          <div>
            <Label htmlFor="itemsForPage">Items por Página</Label>
            <Input
              id="itemsForPage"
              type="number"
              min={1}
              max={100}
              value={itemsForPage}
              onChange={(e) => setItemsForPage(parseInt(e.target.value) || 10)}
            />
          </div>
        </div>

        <Button
          onClick={runTest}
          disabled={loading}
          className="w-full bg-accent hover:bg-accent-hover"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Ejecutando prueba quirúrgica...
            </>
          ) : (
            'Ejecutar Prueba'
          )}
        </Button>
      </Card>

      {result && (
        <Card className="p-6">
          <div className="space-y-4">
            {/* Estado general */}
            <div
              className={`border-l-4 p-4 rounded ${
                result.ok
                  ? 'bg-green-50 border-green-500'
                  : 'bg-red-50 border-red-500'
              }`}
            >
              <div className="flex items-start">
                {result.ok ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                )}
                <div className="ml-3 flex-1">
                  <h3
                    className={`font-semibold ${
                      result.ok ? 'text-green-800' : 'text-red-800'
                    }`}
                  >
                    {result.ok
                      ? `✅ Éxito: ${result.records.length} registro(s) obtenido(s)`
                      : `❌ Fallo en stage: ${result.stage}`}
                  </h3>
                  {result.message && (
                    <p
                      className={`text-sm mt-1 ${
                        result.ok ? 'text-green-700' : 'text-red-700'
                      }`}
                    >
                      {result.message}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Metadatos SICAS */}
            {result.raw && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="font-semibold text-gray-800 mb-2">
                  Response SICAS
                </h4>
                <div className="space-y-1 text-sm">
                  <div className="flex">
                    <span className="font-medium text-gray-600 w-32">
                      RESPONSENBR:
                    </span>
                    <span className="text-gray-800">{result.raw.responseNbr}</span>
                  </div>
                  <div className="flex">
                    <span className="font-medium text-gray-600 w-32">
                      RESPONSETXT:
                    </span>
                    <span className="text-gray-800">{result.raw.responseTxt}</span>
                  </div>
                  <div className="flex">
                    <span className="font-medium text-gray-600 w-32">
                      MESSAGE:
                    </span>
                    <span className="text-gray-800">{result.raw.message}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Tabla de registros */}
            {result.records.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-800 mb-3">
                  Registros Obtenidos ({result.records.length})
                </h4>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            ID Docto
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Póliza
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Fecha
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Oficina
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Vendedor
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Aseguradora
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Ramo
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Importe
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {result.records.map((record, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {record.idDocto || '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {record.poliza || '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {record.fecha || '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {record.oficina || '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {record.vendedor || '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {record.aseguradora || '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {record.ramo || '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {record.importe || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Mostrar XML crudo del primer registro para análisis */}
                {result.records[0]?.rawRecord && (
                  <details className="mt-4">
                    <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
                      Ver XML crudo del primer registro
                    </summary>
                    <pre className="mt-2 text-xs bg-gray-50 p-3 rounded border border-gray-200 overflow-auto">
                      {result.records[0].rawRecord}
                    </pre>
                  </details>
                )}
              </div>
            )}

            {/* Debug info */}
            {result.debug && (
              <details>
                <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
                  Ver información de debug
                </summary>
                <pre className="mt-2 text-xs bg-gray-50 p-3 rounded border border-gray-200 overflow-auto">
                  {JSON.stringify(result.debug, null, 2)}
                </pre>
              </details>
            )}
          </div>
        </Card>
      )}

      <Card className="p-4 bg-yellow-50 border-yellow-200">
        <h3 className="font-semibold text-yellow-900 mb-2">
          Regla de Oro de Éxito
        </h3>
        <ul className="text-sm text-yellow-800 space-y-1">
          <li>
            <strong>✅ Éxito real:</strong> Hay tabla Y hay filas (aunque sea 1)
          </li>
          <li>
            <strong>❌ Fallo:</strong> MESSAGE contiene "Error en Ejecución..."
          </li>
          <li>
            <strong>❌ Fallo:</strong> Dataset vacío con pages_processed = 0
          </li>
          <li>
            <strong>❌ Fallo:</strong> No existe tabla de datos (solo
            PROCESSDATA)
          </li>
        </ul>
      </Card>

      <Card className="p-4 bg-blue-50 border-blue-200">
        <h3 className="font-semibold text-blue-900 mb-2">
          Siguiente Paso (cuando salga 1 registro)
        </h3>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>Subir itemsForPage a 50/100</li>
          <li>Iterar páginas hasta que venga vacío</li>
          <li>Guardar en tabla sicas_documents</li>
          <li>Construir "vigentes por vendedor" y "por renovar"</li>
        </ul>
      </Card>
    </div>
  );
}
