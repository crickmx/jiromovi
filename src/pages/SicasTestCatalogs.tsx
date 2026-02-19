import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, XCircle, AlertTriangle, Play } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface TestResult {
  catalog_id: number;
  catalog_name: string;
  status: 'pending' | 'testing' | 'available' | 'not_available' | 'error';
  available?: boolean;
  records?: number;
  error?: string;
  duration?: number;
}

const PRIORITY_CATALOGS = [
  { id: 1, name: 'Estados', priority: 'high' },
  { id: 2, name: 'Municipios', priority: 'high' },
  { id: 7, name: 'Bancos', priority: 'high' },
  { id: 8, name: 'Formas de Pago', priority: 'high' },
  { id: 9, name: 'Ramos', priority: 'high' },
  { id: 10, name: 'SubRamos', priority: 'medium' },
  { id: 11, name: 'Despachos', priority: 'high' },
  { id: 12, name: 'Aseguradoras', priority: 'high' },
  { id: 15, name: 'Agentes', priority: 'high' },
  { id: 32, name: 'Vendedores', priority: 'high' },
  { id: 34, name: 'Oficinas', priority: 'high' },
];

export default function SicasTestCatalogs() {
  const [results, setResults] = useState<TestResult[]>(
    PRIORITY_CATALOGS.map(cat => ({
      catalog_id: cat.id,
      catalog_name: cat.name,
      status: 'pending',
    }))
  );
  const [testing, setTesting] = useState(false);

  const testCatalog = async (catalogId: number, catalogName: string) => {
    const startTime = Date.now();

    setResults(prev =>
      prev.map(r =>
        r.catalog_id === catalogId ? { ...r, status: 'testing' as const } : r
      )
    );

    try {
      const { data, error } = await supabase.functions.invoke('sicas-test-catalog', {
        body: { catalog_id: catalogId },
      });

      const duration = Date.now() - startTime;

      if (error) throw error;

      if (data.available) {
        setResults(prev =>
          prev.map(r =>
            r.catalog_id === catalogId
              ? {
                  ...r,
                  status: 'available',
                  available: true,
                  records: data.stats?.records || 0,
                  duration,
                }
              : r
          )
        );
      } else {
        setResults(prev =>
          prev.map(r =>
            r.catalog_id === catalogId
              ? {
                  ...r,
                  status: 'not_available',
                  available: false,
                  error: data.warning || data.error,
                  duration,
                }
              : r
          )
        );
      }
    } catch (err: any) {
      const duration = Date.now() - startTime;
      setResults(prev =>
        prev.map(r =>
          r.catalog_id === catalogId
            ? {
                ...r,
                status: 'error',
                available: false,
                error: err.message,
                duration,
              }
            : r
        )
      );
    }
  };

  const testAllCatalogs = async () => {
    setTesting(true);

    for (const catalog of PRIORITY_CATALOGS) {
      await testCatalog(catalog.id, catalog.name);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    setTesting(false);
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'testing':
        return <Loader2 className="h-5 w-5 animate-spin text-accent" />;
      case 'available':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'not_available':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <div className="h-5 w-5 rounded-full border-2 border-gray-300" />;
    }
  };

  const getStatusBadge = (status: TestResult['status']) => {
    switch (status) {
      case 'testing':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700">Probando...</Badge>;
      case 'available':
        return <Badge variant="outline" className="bg-green-50 text-green-700">Disponible</Badge>;
      case 'not_available':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700">No Disponible</Badge>;
      case 'error':
        return <Badge variant="outline" className="bg-red-50 text-red-700">Error</Badge>;
      default:
        return <Badge variant="outline">Pendiente</Badge>;
    }
  };

  const availableCount = results.filter(r => r.status === 'available').length;
  const notAvailableCount = results.filter(r => r.status === 'not_available').length;
  const errorCount = results.filter(r => r.status === 'error').length;
  const totalTested = availableCount + notAvailableCount + errorCount;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            SICAS - Prueba de Catálogos
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Prueba de disponibilidad de catálogos prioritarios
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Probados</div>
            <div className="text-2xl font-bold">{totalTested} / {PRIORITY_CATALOGS.length}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-green-600 dark:text-green-400 mb-1">Disponibles</div>
            <div className="text-2xl font-bold text-green-600">{availableCount}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-yellow-600 dark:text-yellow-400 mb-1">No Disponibles</div>
            <div className="text-2xl font-bold text-yellow-600">{notAvailableCount}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-red-600 dark:text-red-400 mb-1">Errores</div>
            <div className="text-2xl font-bold text-red-600">{errorCount}</div>
          </Card>
        </div>

        <Card className="p-6 mb-6">
          <Button
            onClick={testAllCatalogs}
            disabled={testing}
            className="w-full"
            size="lg"
          >
            {testing ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Probando catálogos...
              </>
            ) : (
              <>
                <Play className="h-5 w-5 mr-2" />
                Probar Todos los Catálogos
              </>
            )}
          </Button>
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Resultados</h2>
          <div className="space-y-3">
            {results.map(result => (
              <div
                key={result.catalog_id}
                className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg"
              >
                <div className="flex items-center gap-4 flex-1">
                  {getStatusIcon(result.status)}
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 dark:text-white">
                      {result.catalog_id}. {result.catalog_name}
                    </div>
                    {result.error && (
                      <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {result.error}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {result.records !== undefined && result.records > 0 && (
                    <Badge variant="outline" className="bg-blue-50 text-blue-700">
                      {result.records} registros
                    </Badge>
                  )}
                  {result.duration !== undefined && (
                    <span className="text-sm text-gray-500">
                      {(result.duration / 1000).toFixed(2)}s
                    </span>
                  )}
                  {getStatusBadge(result.status)}
                  {result.status === 'pending' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => testCatalog(result.catalog_id, result.catalog_name)}
                      disabled={testing}
                    >
                      Probar
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6 mt-6">
          <h3 className="font-semibold mb-3">Notas:</h3>
          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
            <li>• Los catálogos marcados como "No Disponibles" requieren permisos especiales en SICAS</li>
            <li>• Algunos catálogos solo están disponibles para despachos específicos</li>
            <li>• La conexión a SICAS está funcionando correctamente</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
