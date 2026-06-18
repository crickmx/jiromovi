import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Stethoscope, Play, AlertCircle, CheckCircle, XCircle, Loader2, Copy, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';

interface DiagnosticStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'success' | 'error';
  message?: string;
  details?: any;
  timestamp?: string;
}

export default function SicasDiagnostico() {
  const navigate = useNavigate();
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<DiagnosticStep[]>([
    { id: 'config', name: '1. Verificar Configuración', status: 'pending' },
    { id: 'connection', name: '2. Probar Conexión HTTP', status: 'pending' },
    { id: 'auth', name: '3. Autenticar en SICAS', status: 'pending' },
    { id: 'catalogs', name: '4. Consultar Catálogos', status: 'pending' },
    { id: 'report', name: '5. Ejecutar Reporte H03117', status: 'pending' },
  ]);
  const [lastError, setLastError] = useState<any>(null);

  const updateStep = (id: string, updates: Partial<DiagnosticStep>) => {
    setSteps(prev => prev.map(step =>
      step.id === id ? { ...step, ...updates, timestamp: new Date().toISOString() } : step
    ));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const runDiagnostic = async () => {
    setRunning(true);
    setLastError(null);

    // Reset steps
    setSteps(prev => prev.map(step => ({ ...step, status: 'pending', message: undefined, details: undefined })));

    try {
      // STEP 1: Verificar configuración
      updateStep('config', { status: 'running', message: 'Consultando configuración...' });

      const { data: config, error: configError } = await supabase
        .from('sicas_config')
        .select('*')
        .single();

      if (configError) {
        updateStep('config', {
          status: 'error',
          message: 'No se pudo obtener la configuración',
          details: configError
        });
        setLastError({ stage: 'CONFIG', error: configError });
        return;
      }

      if (!config) {
        updateStep('config', {
          status: 'error',
          message: 'Configuración SICAS no encontrada. Configure las credenciales en Admin > SICAS.'
        });
        setLastError({ stage: 'CONFIG', error: 'No config found' });
        return;
      }

      if (!config.sicas_usuario || !config.sicas_password) {
        updateStep('config', {
          status: 'error',
          message: 'Usuario o password no configurados',
          details: {
            has_usuario: !!config.sicas_usuario,
            has_password: !!config.sicas_password
          }
        });
        setLastError({ stage: 'CONFIG', error: 'Incomplete credentials' });
        return;
      }

      updateStep('config', {
        status: 'success',
        message: 'Configuración válida',
        details: {
          endpoint: config.endpoint,
          usuario: config.sicas_usuario?.substring(0, 3) + '***',
          activa: config.activa
        }
      });

      // STEP 2: Probar conexión (test-connection)
      updateStep('connection', { status: 'running', message: 'Probando conexión al servidor SICAS...' });

      const { data: connData, error: connError } = await supabase.functions.invoke(
        'sicas-test-connection',
        { body: {} }
      );

      if (connError) {
        updateStep('connection', {
          status: 'error',
          message: 'Error al probar conexión',
          details: connError
        });
        setLastError({ stage: 'CONNECTION', error: connError });
        return;
      }

      if (!connData?.success) {
        updateStep('connection', {
          status: 'error',
          message: connData?.error || 'Conexión fallida',
          details: connData
        });
        setLastError({ stage: 'CONNECTION', error: connData });
        return;
      }

      updateStep('connection', {
        status: 'success',
        message: 'Conexión exitosa',
        details: connData
      });

      // STEP 3: Autenticar
      updateStep('auth', { status: 'running', message: 'Autenticando usuario en SICAS...' });

      // La autenticación se valida en el mismo test de conexión
      if (connData.sicas_response?.responsetxt === 'DENIED') {
        updateStep('auth', {
          status: 'error',
          message: 'Autenticación denegada - Credenciales incorrectas',
          details: connData.sicas_response
        });
        setLastError({ stage: 'AUTH', error: 'DENIED' });
        return;
      }

      updateStep('auth', {
        status: 'success',
        message: 'Autenticación exitosa',
        details: connData.sicas_response
      });

      // STEP 4: Consultar catálogos
      updateStep('catalogs', { status: 'running', message: 'Consultando catálogos disponibles...' });

      const { data: catalogData, error: catalogError } = await supabase.functions.invoke(
        'sicas-test-catalog',
        { body: { catalog_code: 'A014' } } // Vendedores
      );

      if (catalogError) {
        updateStep('catalogs', {
          status: 'error',
          message: 'Error al consultar catálogos',
          details: catalogError
        });
        // No bloqueante - continuamos
      } else if (!catalogData?.success) {
        updateStep('catalogs', {
          status: 'error',
          message: catalogData?.error || 'Error en catálogo',
          details: catalogData
        });
        // No bloqueante
      } else {
        updateStep('catalogs', {
          status: 'success',
          message: `Catálogo A014: ${catalogData.records_count} vendedores encontrados`,
          details: catalogData
        });
      }

      // STEP 5: Ejecutar reporte H03117
      updateStep('report', { status: 'running', message: 'Ejecutando reporte de pólizas vigentes (H03117)...' });

      const { data: reportData, error: reportError } = await supabase.functions.invoke(
        'sync-sicas-polizas-vigentes',
        { body: { maxPages: 1, itemsPerPage: 10 } } // Solo 1 página de prueba
      );

      if (reportError) {
        updateStep('report', {
          status: 'error',
          message: 'Error al ejecutar reporte',
          details: reportError
        });
        setLastError({ stage: 'REPORT', error: reportError });
        return;
      }

      if (!reportData?.success) {
        // Este es el error crítico
        const errorDetails = {
          stage: reportData?.stage || 'UNKNOWN',
          error: reportData?.error || 'Error desconocido',
          http_status: reportData?.http_status,
          http_body: reportData?.http_body,
          details: reportData?.details,
          metadata: reportData?.metadata
        };

        updateStep('report', {
          status: 'error',
          message: reportData?.error || 'Error en reporte',
          details: errorDetails
        });
        setLastError(errorDetails);
        return;
      }

      updateStep('report', {
        status: 'success',
        message: `Reporte ejecutado: ${reportData.stats?.records_fetched || 0} pólizas obtenidas`,
        details: reportData
      });

    } catch (error: any) {
      console.error('Error en diagnóstico:', error);
      setLastError({ stage: 'UNKNOWN', error: error.message });
    } finally {
      setRunning(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'running':
        return <Loader2 className="w-5 h-5 text-accent animate-spin" />;
      default:
        return <div className="w-5 h-5 rounded-full border-2 border-neutral-300" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      success: 'bg-green-100 text-green-800 border-green-300',
      error: 'bg-red-100 text-red-800 border-red-300',
      running: 'bg-blue-100 text-blue-800 border-blue-300',
      pending: 'bg-neutral-100 text-neutral-600 border-neutral-300'
    };
    return variants[status as keyof typeof variants] || variants.pending;
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <PageHeader
          title="Diagnóstico SICAS"
          description="Herramienta de diagnóstico paso a paso para identificar problemas de conexión"
          icon={Stethoscope}
          backTo="/admin/sicas"
          backLabel="Volver"
          actions={
            <Button
              onClick={runDiagnostic}
              disabled={running}
              className="gap-2"
            >
              {running ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Ejecutando...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Iniciar Diagnóstico
                </>
              )}
            </Button>
          }
        />

        {/* Info Banner */}
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-4">
            <div className="flex gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-green-900 mb-1">
                  SOAP es el protocolo oficial de SICAS
                </h3>
                <p className="text-sm text-green-800 mb-2">
                  Esta herramienta usa el protocolo SOAP que es el único soportado por SICAS. El servidor REST API (<code className="bg-green-100 px-1 rounded">security-services.sicasonline.info</code>) no está disponible.
                </p>
                <p className="text-xs text-green-700">
                  <strong>Endpoint funcional:</strong> <code className="bg-green-100 px-1 rounded">https://www.sicasonline.com.mx/SICASOnline/WS_SICASOnline.asmx</code>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Steps */}
        <Card>
          <CardHeader>
            <CardTitle>Pasos de Diagnóstico</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {steps.map((step, index) => (
              <div key={step.id} className="space-y-2">
                <div className="flex items-start gap-4">
                  <div className="mt-1">{getStatusIcon(step.status)}</div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-neutral-900">{step.name}</h3>
                      <Badge variant="outline" className={getStatusBadge(step.status)}>
                        {step.status}
                      </Badge>
                    </div>
                    {step.message && (
                      <p className="text-sm text-neutral-700">{step.message}</p>
                    )}
                    {step.details && (
                      <details className="text-sm">
                        <summary className="cursor-pointer text-accent hover:text-blue-700">
                          Ver detalles
                        </summary>
                        <pre className="mt-2 p-3 bg-neutral-100 rounded-lg overflow-x-auto text-xs">
                          {JSON.stringify(step.details, null, 2)}
                        </pre>
                      </details>
                    )}
                    {step.timestamp && (
                      <p className="text-xs text-neutral-500">
                        {new Date(step.timestamp).toLocaleString('es-MX')}
                      </p>
                    )}
                  </div>
                </div>
                {index < steps.length - 1 && (
                  <div className="ml-2.5 h-6 w-px bg-neutral-200" />
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Error Details */}
        {lastError && (
          <Card className="border-red-300 bg-red-50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <CardTitle className="text-red-900">Error Detectado</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-red-900">Stage:</h4>
                  <Badge className="bg-red-200 text-red-900">{lastError.stage}</Badge>
                </div>
                <div>
                  <h4 className="font-semibold text-red-900 mb-1">Mensaje:</h4>
                  <p className="text-sm text-red-800">{lastError.error}</p>
                </div>
                {lastError.http_status && (
                  <div>
                    <h4 className="font-semibold text-red-900 mb-1">HTTP Status:</h4>
                    <p className="text-sm text-red-800">{lastError.http_status}</p>
                  </div>
                )}
                {lastError.http_body && (
                  <div>
                    <h4 className="font-semibold text-red-900 mb-1">HTTP Body:</h4>
                    <p className="text-sm text-red-800 font-mono">{lastError.http_body}</p>
                  </div>
                )}
              </div>

              <div className="relative">
                <h4 className="font-semibold text-red-900 mb-2">Detalles Completos:</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(JSON.stringify(lastError, null, 2))}
                  className="absolute top-0 right-0 gap-2"
                >
                  <Copy className="w-4 h-4" />
                  Copiar
                </Button>
                <pre className="p-4 bg-white border border-red-300 rounded-lg overflow-x-auto text-xs">
                  {JSON.stringify(lastError, null, 2)}
                </pre>
              </div>

              {/* Recommendations */}
              <div className="p-4 bg-white border border-red-300 rounded-lg">
                <h4 className="font-semibold text-red-900 mb-2">Posibles Soluciones:</h4>
                <ul className="space-y-2 text-sm text-red-800">
                  {lastError.stage === 'CONFIG' && (
                    <>
                      <li>• Verifique que las credenciales estén configuradas en Admin &gt; SICAS</li>
                      <li>• Asegúrese de que el usuario y password sean correctos</li>
                    </>
                  )}
                  {lastError.stage === 'AUTH' && (
                    <>
                      <li>• Las credenciales son incorrectas o han expirado</li>
                      <li>• Contacte al administrador de SICAS para validar el acceso</li>
                    </>
                  )}
                  {lastError.stage === 'FETCH_SICAS' && lastError.error?.includes('Variable de objeto') && (
                    <>
                      <li>• Este usuario NO tiene permisos para el reporte H03117</li>
                      <li>• El usuario necesita permisos de "Consulta de Producción" en SICAS</li>
                      <li>• Contacte al administrador de SICAS para habilitar el acceso al reporte</li>
                      <li>• Verifique que el usuario tenga asignados despachos/vendedores</li>
                    </>
                  )}
                  {lastError.stage === 'PARSE_XML' && (
                    <>
                      <li>• Error al procesar la respuesta de SICAS</li>
                      <li>• El formato de respuesta puede haber cambiado</li>
                      <li>• Contacte a soporte técnico</li>
                    </>
                  )}
                  {lastError.stage === 'DB_SAVE' && (
                    <>
                      <li>• Error al guardar los datos en la base de datos</li>
                      <li>• Verifique los permisos de la tabla sicas_polizas_vigentes</li>
                    </>
                  )}
                </ul>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Acciones Rápidas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="outline"
              onClick={() => navigate('/admin/sicas')}
              className="w-full gap-2 justify-start"
            >
              <RefreshCw className="w-4 h-4" />
              Ir a Configuración SICAS
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/admin/sicas/catalogs')}
              className="w-full gap-2 justify-start"
            >
              <RefreshCw className="w-4 h-4" />
              Ver Catálogos SICAS
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
