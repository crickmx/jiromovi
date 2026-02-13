import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, RefreshCw, CheckCircle, XCircle, Building, Users, Trash2, Link as LinkIcon, FlaskConical, Stethoscope } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Container } from '../components/ui/container';
import { PageHeader } from '../components/ui/page-header';
import { Section } from '../components/ui/section';
import { supabase } from '../lib/supabase';
import {
  getSicasConfig,
  testSicasConnection,
  syncSicasCatalog,
  getAllSicasDespachos,
  getSicasVendedores,
  mapDespacho,
  unmapDespacho,
  mapVendedor,
  unmapVendedor,
} from '../lib/sicasUtils';
import type { SicasConfig, SicasDespachoWithMapping, SicasVendedorWithMapping } from '../lib/sicasTypes';

export default function SicasAdmin() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('conexion');
  const [config, setConfig] = useState<SicasConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [testingConnection, setTestingConnection] = useState(false);
  const [syncingDespachos, setSyncingDespachos] = useState(false);
  const [syncingVendedores, setSyncingVendedores] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [despachos, setDespachos] = useState<SicasDespachoWithMapping[]>([]);
  const [vendedores, setVendedores] = useState<SicasVendedorWithMapping[]>([]);
  const [oficinas, setOficinas] = useState<{ id: string; nombre: string }[]>([]);
  const [usuarios, setUsuarios] = useState<{ id: string; nombre: string; apellidos: string; email_personal: string }[]>([]);

  const [filterUnmappedDespachos, setFilterUnmappedDespachos] = useState(false);
  const [filterUnmappedVendedores, setFilterUnmappedVendedores] = useState(false);
  const [searchDespacho, setSearchDespacho] = useState('');
  const [searchVendedor, setSearchVendedor] = useState('');

  const [diagnosticCatalogId, setDiagnosticCatalogId] = useState('12');
  const [diagnosticTypeReturn, setDiagnosticTypeReturn] = useState('1');
  const [diagnosticDryRun, setDiagnosticDryRun] = useState(true);
  const [diagnosticRunning, setDiagnosticRunning] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<any>(null);

  const [syncingProduccion, setSyncingProduccion] = useState(false);
  const [produccionResult, setProduccionResult] = useState<any>(null);
  const [totalPolizas, setTotalPolizas] = useState(0);

  const [syncingComisionesPendientes, setSyncingComisionesPendientes] = useState(false);
  const [comisionesPendientesResult, setComisionesPendientesResult] = useState<any>(null);
  const [totalComisionesPendientes, setTotalComisionesPendientes] = useState(0);

  const [syncingComisionesPagadas, setSyncingComisionesPagadas] = useState(false);
  const [comisionesPagadasResult, setComisionesPagadasResult] = useState<any>(null);
  const [totalComisionesPagadas, setTotalComisionesPagadas] = useState(0);

  useEffect(() => {
    loadData();
    loadTotalPolizas();
    loadTotalComisiones();
  }, []);

  useEffect(() => {
    // Recargar cuando cambian los filtros
    loadDespachos();
  }, [filterUnmappedDespachos]);

  useEffect(() => {
    // Recargar cuando cambian los filtros
    loadVendedores();
  }, [filterUnmappedVendedores]);

  async function loadData() {
    setLoading(true);
    try {
      const configData = await getSicasConfig();
      setConfig(configData);

      const { data: oficinasData } = await supabase
        .from('oficinas')
        .select('id, nombre')
        .order('nombre');
      setOficinas(oficinasData || []);

      const { data: usuariosData } = await supabase
        .from('usuarios')
        .select('id, nombre, apellidos, email_personal')
        .eq('estado', 'activo')
        .order('nombre');
      setUsuarios(usuariosData || []);

      // Cargar todos los datos de SICAS al inicio
      await loadDespachos();
      await loadVendedores();
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadDespachos() {
    try {
      console.log('Loading despachos...');
      const data = await getAllSicasDespachos();
      console.log('Despachos loaded:', data.length, 'items');
      setDespachos(data);
    } catch (error) {
      console.error('Error loading despachos:', error);
      setMessage({ type: 'error', text: `Error cargando despachos: ${error}` });
    }
  }

  async function loadVendedores() {
    try {
      console.log('Loading vendedores...');
      const data = await getSicasVendedores();
      console.log('Vendedores loaded:', data.length, 'items');
      setVendedores(data);
    } catch (error) {
      console.error('Error loading vendedores:', error);
      setMessage({ type: 'error', text: `Error cargando vendedores: ${error}` });
    }
  }

  async function handleTestConnection() {
    setTestingConnection(true);
    setMessage(null);

    try {
      const result = await testSicasConnection();
      if (result.success && result.connectionSuccess) {
        setMessage({
          type: 'success',
          text: result.message || 'Conexión y autenticación exitosas con SICAS'
        });
      } else {
        setMessage({ type: 'error', text: `Error: ${result.message || result.error}` });
      }
      await loadData();
    } catch (error: any) {
      setMessage({ type: 'error', text: `Error: ${error.message}` });
    } finally {
      setTestingConnection(false);
    }
  }

  async function handleSync(catalogType: 'despachos' | 'vendedores') {
    if (catalogType === 'despachos') {
      setSyncingDespachos(true);
    } else {
      setSyncingVendedores(true);
    }
    setMessage(null);

    try {
      const result = await syncSicasCatalog(catalogType);

      if (result.success) {
        if (result.warning) {
          setMessage({
            type: 'error',
            text: `⚠️ Catálogo no disponible en SICAS\n\nMensaje del WebService:\n${result.warning}\n\nEsto significa que el catálogo está restringido, en mantenimiento, o requiere configuración adicional en SICAS. Contacta a soporte de SICAS para más información.`
          });
        } else {
          setMessage({
            type: 'success',
            text: `${catalogType} sincronizados: ${result.itemsProcessed} registros`
          });
        }
        await loadData();
        if (catalogType === 'despachos') {
          await loadDespachos();
        } else {
          await loadVendedores();
        }
      } else {
        setMessage({ type: 'error', text: `Error de sincronización:\n\n${result.error}` });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: `Error: ${error.message}` });
    } finally {
      if (catalogType === 'despachos') {
        setSyncingDespachos(false);
      } else {
        setSyncingVendedores(false);
      }
    }
  }

  async function handleMapDespacho(id_sicas: string, oficina_id: string) {
    // Validación previa
    if (despachos.length === 0) {
      setMessage({
        type: 'error',
        text: '⚠️ NO HAY DESPACHOS SINCRONIZADOS\n\nNo se puede realizar el mapeo porque no hay despachos de SICAS en la base de datos local.\n\nPor favor:\n1. Ve a la pestaña "Conexión"\n2. Haz clic en "Sincronizar Despachos"\n3. Espera a que se complete la sincronización\n4. Regresa a esta pestaña para hacer el mapeo'
      });
      setActiveTab('conexion');
      return;
    }

    try {
      const result = await mapDespacho(id_sicas, oficina_id);
      if (result.success) {
        setMessage({ type: 'success', text: 'Mapeo guardado exitosamente' });
        await loadDespachos();
      } else {
        // Mostrar error detallado
        const errorMsg = result.error || 'Error desconocido';
        if (errorMsg.includes('sincroniza')) {
          setMessage({
            type: 'error',
            text: `⚠️ ERROR DE SINCRONIZACIÓN\n\n${errorMsg}\n\nEsto generalmente significa que:\n- No has sincronizado los despachos desde SICAS\n- La sincronización falló o se interrumpió\n- Los datos se limpiaron después de la sincronización\n\nSolución: Ve a la pestaña "Conexión" y sincroniza los despachos nuevamente.`
          });
          setActiveTab('conexion');
        } else {
          setMessage({ type: 'error', text: `Error: ${errorMsg}` });
        }
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: `Error inesperado: ${error.message}` });
    }
  }

  async function handleUnmapDespacho(id_sicas: string) {
    try {
      const result = await unmapDespacho(id_sicas);
      if (result.success) {
        setMessage({ type: 'success', text: 'Mapeo eliminado exitosamente' });
        await loadDespachos();
      } else {
        setMessage({ type: 'error', text: `Error: ${result.error}` });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: `Error: ${error.message}` });
    }
  }

  async function handleMapVendedor(id_sicas: string, user_id: string) {
    // Validación previa
    if (vendedores.length === 0) {
      setMessage({
        type: 'error',
        text: '⚠️ NO HAY VENDEDORES SINCRONIZADOS\n\nNo se puede realizar el mapeo porque no hay vendedores de SICAS en la base de datos local.\n\nPor favor:\n1. Ve a la pestaña "Conexión"\n2. Haz clic en "Sincronizar Vendedores"\n3. Espera a que se complete la sincronización\n4. Regresa a esta pestaña para hacer el mapeo'
      });
      setActiveTab('conexion');
      return;
    }

    try {
      const result = await mapVendedor(id_sicas, user_id);
      if (result.success) {
        setMessage({ type: 'success', text: 'Mapeo guardado exitosamente' });
        await loadVendedores();
      } else {
        // Mostrar error detallado
        const errorMsg = result.error || 'Error desconocido';
        if (errorMsg.includes('sincroniza')) {
          setMessage({
            type: 'error',
            text: `⚠️ ERROR DE SINCRONIZACIÓN\n\n${errorMsg}\n\nEsto generalmente significa que:\n- No has sincronizado los vendedores desde SICAS\n- La sincronización falló o se interrumpió\n- Los datos se limpiaron después de la sincronización\n\nSolución: Ve a la pestaña "Conexión" y sincroniza los vendedores nuevamente.`
          });
          setActiveTab('conexion');
        } else {
          setMessage({ type: 'error', text: `Error: ${errorMsg}` });
        }
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: `Error inesperado: ${error.message}` });
    }
  }

  async function handleUnmapVendedor(id_sicas: string) {
    try {
      const result = await unmapVendedor(id_sicas);
      if (result.success) {
        setMessage({ type: 'success', text: 'Mapeo eliminado exitosamente' });
        await loadVendedores();
      } else {
        setMessage({ type: 'error', text: `Error: ${result.error}` });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: `Error: ${error.message}` });
    }
  }

  async function handleDiagnosticTest() {
    setDiagnosticRunning(true);
    setDiagnosticResult(null);
    setMessage(null);

    try {
      const { data, error } = await supabase.functions.invoke('sicas-sync', {
        body: {
          catalog_type_id: Number(diagnosticCatalogId),
          typeReturn: Number(diagnosticTypeReturn),
          dryRun: diagnosticDryRun,
          debug: true,
        },
      });

      if (error) throw error;

      setDiagnosticResult(data);

      if (data.success) {
        setMessage({
          type: 'success',
          text: `Prueba completada: ${data.catalog_status} - ${data.stats?.totalRows || 0} registros`
        });
      } else {
        setMessage({ type: 'error', text: `Error: ${data.error}` });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: `Error: ${error.message}` });
      setDiagnosticResult({ success: false, error: error.message });
    } finally {
      setDiagnosticRunning(false);
    }
  }

  async function handleSyncProduccion() {
    setSyncingProduccion(true);
    setProduccionResult(null);
    setMessage(null);

    try {
      const { data, error } = await supabase.functions.invoke('sync-sicas-polizas-vigentes', {
        body: { maxPages: 10, itemsPerPage: 200 },
      });

      if (error) throw error;

      setProduccionResult(data);
      await loadTotalPolizas();

      if (data.success) {
        setMessage({
          type: 'success',
          text: `Sincronización completada: ${data.stats?.records_fetched || 0} pólizas obtenidas, ${data.stats?.records_inserted || 0} guardadas`
        });
      } else {
        setMessage({ type: 'error', text: `Error: ${data.error}` });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: `Error: ${error.message}` });
      setProduccionResult({ success: false, error: error.message });
    } finally {
      setSyncingProduccion(false);
    }
  }

  async function loadTotalPolizas() {
    const { count, error } = await supabase
      .from('sicas_polizas_vigentes')
      .select('*', { count: 'exact', head: true });

    if (!error) {
      setTotalPolizas(count || 0);
    }
  }

  async function loadTotalComisiones() {
    const { count: pendientesCount } = await supabase
      .from('sicas_comisiones_pendientes')
      .select('*', { count: 'exact', head: true });

    const { count: pagadasCount } = await supabase
      .from('sicas_comisiones_pagadas')
      .select('*', { count: 'exact', head: true });

    setTotalComisionesPendientes(pendientesCount || 0);
    setTotalComisionesPagadas(pagadasCount || 0);
  }

  async function handleSyncComisionesPendientes() {
    setSyncingComisionesPendientes(true);
    setComisionesPendientesResult(null);
    setMessage(null);

    try {
      const today = new Date();
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const dateFrom = firstDayOfMonth.toISOString().split('T')[0];
      const dateTo = today.toISOString().split('T')[0];

      const { data, error } = await supabase.functions.invoke('sicas-sync-comisiones-pendientes', {
        body: { maxPages: 10, itemsPerPage: 100, dateFrom, dateTo },
      });

      if (error) throw error;

      setComisionesPendientesResult(data);
      await loadTotalComisiones();

      if (data.success) {
        setMessage({
          type: 'success',
          text: `Comisiones pendientes sincronizadas: ${data.stats?.records_fetched || 0} registros obtenidos, ${data.stats?.records_inserted || 0} guardados`
        });
      } else {
        setMessage({ type: 'error', text: `Error: ${data.error}` });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: `Error: ${error.message}` });
      setComisionesPendientesResult({ success: false, error: error.message });
    } finally {
      setSyncingComisionesPendientes(false);
    }
  }

  async function handleSyncComisionesPagadas() {
    setSyncingComisionesPagadas(true);
    setComisionesPagadasResult(null);
    setMessage(null);

    try {
      const today = new Date();
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const dateFrom = firstDayOfMonth.toISOString().split('T')[0];
      const dateTo = today.toISOString().split('T')[0];

      const { data, error } = await supabase.functions.invoke('sicas-sync-comisiones-pagadas', {
        body: { maxPages: 10, itemsPerPage: 100, dateFrom, dateTo },
      });

      if (error) throw error;

      setComisionesPagadasResult(data);
      await loadTotalComisiones();

      if (data.success) {
        setMessage({
          type: 'success',
          text: `Comisiones pagadas sincronizadas: ${data.stats?.records_fetched || 0} registros obtenidos, ${data.stats?.records_inserted || 0} guardados`
        });
      } else {
        setMessage({ type: 'error', text: `Error: ${data.error}` });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: `Error: ${error.message}` });
      setComisionesPagadasResult({ success: false, error: error.message });
    } finally {
      setSyncingComisionesPagadas(false);
    }
  }

  const filteredDespachos = despachos
    .filter(d => !filterUnmappedDespachos || !d.is_mapped)
    .filter(d => d.nombre.toLowerCase().includes(searchDespacho.toLowerCase()) || d.id_sicas.includes(searchDespacho));

  const filteredVendedores = vendedores
    .filter(v => !filterUnmappedVendedores || !v.is_mapped)
    .filter(v => v.nombre.toLowerCase().includes(searchVendedor.toLowerCase()) || v.id_sicas.includes(searchVendedor));

  if (loading) {
    return (
      <Container>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      </Container>
    );
  }

  return (
    <Container>
      <PageHeader
        title="Integración SICAS"
        description="Administra la conexión con SICAS Online y sincroniza catálogos"
        icon={LinkIcon}
        action={{
          label: "Herramienta de Diagnóstico",
          icon: Stethoscope,
          onClick: () => navigate('/sicas/diagnostico')
        }}
      />

      {message && (
        <div
          className={`mb-6 p-4 rounded-xl ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-start gap-3">
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            )}
            <p className="text-sm font-medium whitespace-pre-wrap break-words">{message.text}</p>
          </div>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5 mb-6">
          <TabsTrigger value="conexion">Conexión</TabsTrigger>
          <TabsTrigger value="despachos" className="relative">
            Mapeo Despachos
            {despachos.length > 0 && (
              <Badge className="ml-2 bg-green-500 text-white text-xs px-1.5 py-0">
                {despachos.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="vendedores" className="relative">
            Mapeo Vendedores
            {vendedores.length > 0 && (
              <Badge className="ml-2 bg-green-500 text-white text-xs px-1.5 py-0">
                {vendedores.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="produccion" className="relative">
            Producción
            {totalPolizas > 0 && (
              <Badge className="ml-2 bg-blue-500 text-white text-xs px-1.5 py-0">
                {totalPolizas}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="diagnostico">Diagnóstico</TabsTrigger>
        </TabsList>

        <TabsContent value="conexion">
          <Section>
            {message && message.type === 'error' && message.text.includes('Error en Ejecución') && (
              <Card className="mb-6 border-amber-200 bg-amber-50">
                <CardHeader>
                  <CardTitle className="text-amber-900 flex items-center gap-2">
                    <XCircle className="w-5 h-5" />
                    Catálogo No Disponible
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div>
                    <p className="text-amber-800 font-medium mb-2">
                      El catálogo que intentas sincronizar no está disponible en SICAS en este momento.
                    </p>
                    <p className="text-amber-700 mb-3">
                      Esto puede deberse a:
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-amber-700 ml-2">
                      <li>El catálogo está en mantenimiento</li>
                      <li>Restricciones temporales del webservice</li>
                      <li>El tipo de catálogo requiere permisos especiales</li>
                      <li>Sobrecarga en los servidores de SICAS</li>
                    </ul>
                  </div>

                  <div className="pt-3 border-t border-amber-200">
                    <p className="font-medium text-amber-900 mb-2">Recomendaciones:</p>
                    <ol className="list-decimal list-inside space-y-1 text-amber-700 ml-2">
                      <li>Usa el "Modo Diagnóstico" para probar catálogos individuales</li>
                      <li>Intenta con catálogos esenciales primero: 12 (Aseguradoras), 9 (Ramos)</li>
                      <li>Si persiste, intenta en otro horario</li>
                      <li>Verifica que tus credenciales tengan acceso a este catálogo</li>
                    </ol>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Configuración de Conexión</CardTitle>
                <CardDescription>Prueba y sincroniza la conexión con SICAS Online</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Endpoint SOAP</Label>
                  <Input
                    value={config?.endpoint || ''}
                    disabled
                    className="bg-neutral-50"
                  />
                  <p className="text-xs text-neutral-500">Configurado automáticamente desde variables de entorno</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sicas-usuario">Usuario SICAS *</Label>
                    <Input
                      id="sicas-usuario"
                      value={config?.sicas_usuario || ''}
                      onChange={(e) => setConfig(config ? { ...config, sicas_usuario: e.target.value } : null)}
                      placeholder="j1r0%25$"
                      className="font-mono"
                    />
                    <p className="text-xs text-neutral-500">Usuario para autenticación SOAP</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sicas-password">Contraseña SICAS *</Label>
                    <Input
                      id="sicas-password"
                      type="password"
                      value={config?.sicas_password || ''}
                      onChange={(e) => setConfig(config ? { ...config, sicas_password: e.target.value } : null)}
                      placeholder="••••••••"
                      className="font-mono"
                    />
                    <p className="text-xs text-neutral-500">Contraseña para autenticación SOAP</p>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="sicas-namespace">Namespace SOAP</Label>
                    <Input
                      id="sicas-namespace"
                      value={config?.sicas_namespace || 'http://www.sicasonline.com.mx/'}
                      onChange={(e) => setConfig(config ? { ...config, sicas_namespace: e.target.value } : null)}
                      placeholder="http://www.sicasonline.com.mx/"
                      className="font-mono"
                    />
                    <p className="text-xs text-neutral-500">Namespace del servicio SOAP de SICAS</p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={async () => {
                      if (!config?.sicas_usuario || !config?.sicas_password) {
                        setMessage({ type: 'error', text: 'Usuario y contraseña son requeridos' });
                        return;
                      }
                      try {
                        const { error } = await supabase
                          .from('sicas_config')
                          .update({
                            sicas_usuario: config.sicas_usuario,
                            sicas_password: config.sicas_password,
                            sicas_namespace: config.sicas_namespace || 'http://www.sicasonline.com.mx/',
                          })
                          .eq('id', config.id);

                        if (error) throw error;
                        setMessage({ type: 'success', text: 'Credenciales guardadas exitosamente' });
                      } catch (error: any) {
                        setMessage({ type: 'error', text: `Error al guardar: ${error.message}` });
                      }
                    }}
                    variant="outline"
                  >
                    Guardar Credenciales
                  </Button>
                </div>

                <div className="space-y-4">
                  <div className="flex gap-4">
                    <Button
                      onClick={handleTestConnection}
                      disabled={testingConnection}
                      variant="outline"
                    >
                      {testingConnection ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Probando...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Probar Conexión
                        </>
                      )}
                    </Button>

                    <Button
                      onClick={() => handleSync('despachos')}
                      disabled={syncingDespachos}
                    >
                      {syncingDespachos ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Sincronizando...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Sincronizar Despachos
                        </>
                      )}
                    </Button>

                    <Button
                      onClick={() => handleSync('vendedores')}
                      disabled={syncingVendedores}
                    >
                      {syncingVendedores ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Sincronizando...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Sincronizar Vendedores
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs text-blue-800">
                      <strong>Nota:</strong> Si un catálogo no está disponible, usa el "Modo Diagnóstico"
                      para probar catálogos alternativos como Aseguradoras (12) o Ramos (9).
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6 pt-6 border-t">
                  <div>
                    <h3 className="font-semibold mb-2">Última Prueba</h3>
                    {config?.last_test_at ? (
                      <div className="space-y-1 text-sm">
                        <p className="text-neutral-600">
                          {new Date(config.last_test_at).toLocaleString('es-MX')}
                        </p>
                        <div className="flex items-center gap-2">
                          {config.last_test_success ? (
                            <Badge variant="default" className="bg-green-500">Exitoso</Badge>
                          ) : (
                            <Badge variant="destructive">Fallido</Badge>
                          )}
                          <span className="text-neutral-600">{config.last_test_message}</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-neutral-500">No se ha probado aún</p>
                    )}
                  </div>

                  <div>
                    <h3 className="font-semibold mb-2">Última Sincronización</h3>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="font-medium">Despachos:</span>{' '}
                        {config?.last_sync_despachos_at ? (
                          <span className="text-neutral-600">
                            {new Date(config.last_sync_despachos_at).toLocaleString('es-MX')}
                          </span>
                        ) : (
                          <span className="text-neutral-500">Nunca</span>
                        )}
                      </div>
                      <div>
                        <span className="font-medium">Vendedores:</span>{' '}
                        {config?.last_sync_vendedores_at ? (
                          <span className="text-neutral-600">
                            {new Date(config.last_sync_vendedores_at).toLocaleString('es-MX')}
                          </span>
                        ) : (
                          <span className="text-neutral-500">Nunca</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6 pt-6 border-t">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <Building className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                    <div className="text-2xl font-bold text-blue-900">{despachos.length}</div>
                    <div className="text-sm text-blue-700">Despachos en catálogo</div>
                    <div className="text-xs text-blue-600 mt-1">
                      {despachos.filter(d => d.is_mapped).length} mapeados
                    </div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <Users className="w-8 h-8 mx-auto mb-2 text-green-600" />
                    <div className="text-2xl font-bold text-green-900">{vendedores.length}</div>
                    <div className="text-sm text-green-700">Vendedores en catálogo</div>
                    <div className="text-xs text-green-600 mt-1">
                      {vendedores.filter(v => v.is_mapped).length} mapeados
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Section>
        </TabsContent>

        <TabsContent value="despachos">
          <Section>
            {despachos.length === 0 && (
              <div className="mb-6 p-6 bg-amber-50 border-2 border-amber-300 rounded-xl">
                <div className="flex items-start gap-3">
                  <Building className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-amber-900 mb-1">No hay despachos sincronizados</h3>
                    <p className="text-sm text-amber-800 mb-3">
                      Para poder mapear despachos SICAS con oficinas MOVI, primero debes sincronizar los datos desde SICAS.
                    </p>
                    <Button
                      onClick={() => setActiveTab('conexion')}
                      size="sm"
                      className="bg-amber-600 hover:bg-amber-700"
                    >
                      Ir a Sincronizar
                    </Button>
                  </div>
                </div>
              </div>
            )}
            <Card>
              <CardHeader>
                <CardTitle>Mapeo de Despachos</CardTitle>
                <CardDescription>Asocia los Despachos de SICAS con las Oficinas de MOVI</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 mb-6">
                  <div className="flex-1">
                    <Input
                      placeholder="Buscar despacho..."
                      value={searchDespacho}
                      onChange={(e) => setSearchDespacho(e.target.value)}
                    />
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setFilterUnmappedDespachos(!filterUnmappedDespachos)}
                  >
                    {filterUnmappedDespachos ? 'Mostrar Todos' : 'Solo Sin Mapear'}
                  </Button>
                </div>

                <div className="space-y-3">
                  {despachos.length === 0 ? (
                    <div className="text-center py-12">
                      <Building className="w-12 h-12 mx-auto mb-3 text-neutral-300" />
                      <p className="text-neutral-600 font-medium mb-2">No hay despachos sincronizados</p>
                      <p className="text-sm text-neutral-500 mb-4">
                        Haz clic en "Sincronizar Despachos" en la pestaña de Conexión
                      </p>
                      <Button
                        onClick={() => setActiveTab('conexion')}
                        variant="outline"
                        size="sm"
                      >
                        Ir a Conexión
                      </Button>
                    </div>
                  ) : filteredDespachos.length === 0 ? (
                    <div className="text-center py-12 text-neutral-500">
                      <Building className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      <p>No se encontraron despachos con ese criterio</p>
                      <Button
                        onClick={() => {
                          setSearchDespacho('');
                          setFilterUnmappedDespachos(false);
                        }}
                        variant="ghost"
                        size="sm"
                        className="mt-3"
                      >
                        Limpiar filtros
                      </Button>
                    </div>
                  ) : (
                    filteredDespachos.map((despacho) => (
                      <div
                        key={despacho.id}
                        className="flex items-center gap-4 p-4 border rounded-xl hover:bg-neutral-50 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="font-medium">{despacho.nombre}</div>
                          <div className="text-sm text-neutral-500">ID SICAS: {despacho.id_sicas}</div>
                        </div>

                        <div className="flex-1">
                          <Select
                            value={despacho.mapping?.movi_oficina_id || ''}
                            onValueChange={(value) => handleMapDespacho(despacho.id_sicas, value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar oficina..." />
                            </SelectTrigger>
                            <SelectContent>
                              {oficinas.map((oficina) => (
                                <SelectItem key={oficina.id} value={oficina.id}>
                                  {oficina.nombre}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex items-center gap-2">
                          {despacho.is_mapped ? (
                            <>
                              <Badge variant="default" className="bg-green-500">Mapeado</Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleUnmapDespacho(despacho.id_sicas)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </>
                          ) : (
                            <Badge variant="secondary">Sin mapear</Badge>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </Section>
        </TabsContent>

        <TabsContent value="vendedores">
          <Section>
            {vendedores.length === 0 && (
              <div className="mb-6 p-6 bg-amber-50 border-2 border-amber-300 rounded-xl">
                <div className="flex items-start gap-3">
                  <Users className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-amber-900 mb-1">No hay vendedores sincronizados</h3>
                    <p className="text-sm text-amber-800 mb-3">
                      Para poder mapear vendedores SICAS con usuarios MOVI, primero debes sincronizar los datos desde SICAS.
                    </p>
                    <Button
                      onClick={() => setActiveTab('conexion')}
                      size="sm"
                      className="bg-amber-600 hover:bg-amber-700"
                    >
                      Ir a Sincronizar
                    </Button>
                  </div>
                </div>
              </div>
            )}
            <Card>
              <CardHeader>
                <CardTitle>Mapeo de Vendedores</CardTitle>
                <CardDescription>Asocia los Vendedores de SICAS con los Usuarios de MOVI</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 mb-6">
                  <div className="flex-1">
                    <Input
                      placeholder="Buscar vendedor..."
                      value={searchVendedor}
                      onChange={(e) => setSearchVendedor(e.target.value)}
                    />
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setFilterUnmappedVendedores(!filterUnmappedVendedores)}
                  >
                    {filterUnmappedVendedores ? 'Mostrar Todos' : 'Solo Sin Mapear'}
                  </Button>
                </div>

                <div className="space-y-3">
                  {vendedores.length === 0 ? (
                    <div className="text-center py-12">
                      <Users className="w-12 h-12 mx-auto mb-3 text-neutral-300" />
                      <p className="text-neutral-600 font-medium mb-2">No hay vendedores sincronizados</p>
                      <p className="text-sm text-neutral-500 mb-4">
                        Haz clic en "Sincronizar Vendedores" en la pestaña de Conexión
                      </p>
                      <Button
                        onClick={() => setActiveTab('conexion')}
                        variant="outline"
                        size="sm"
                      >
                        Ir a Conexión
                      </Button>
                    </div>
                  ) : filteredVendedores.length === 0 ? (
                    <div className="text-center py-12 text-neutral-500">
                      <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      <p>No se encontraron vendedores con ese criterio</p>
                      <Button
                        onClick={() => {
                          setSearchVendedor('');
                          setFilterUnmappedVendedores(false);
                        }}
                        variant="ghost"
                        size="sm"
                        className="mt-3"
                      >
                        Limpiar filtros
                      </Button>
                    </div>
                  ) : (
                    filteredVendedores.map((vendedor) => (
                      <div
                        key={vendedor.id}
                        className="flex items-center gap-4 p-4 border rounded-xl hover:bg-neutral-50 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="font-medium">{vendedor.nombre}</div>
                          <div className="text-sm text-neutral-500">ID SICAS: {vendedor.id_sicas}</div>
                        </div>

                        <div className="flex-1">
                          <Select
                            value={vendedor.mapping?.movi_user_id || ''}
                            onValueChange={(value) => handleMapVendedor(vendedor.id_sicas, value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar usuario..." />
                            </SelectTrigger>
                            <SelectContent>
                              {usuarios.map((usuario) => (
                                <SelectItem key={usuario.id} value={usuario.id}>
                                  {usuario.nombre} {usuario.apellidos}
                                  {usuario.email_personal && ` (${usuario.email_personal})`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex items-center gap-2">
                          {vendedor.is_mapped ? (
                            <>
                              <Badge variant="default" className="bg-green-500">Mapeado</Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleUnmapVendedor(vendedor.id_sicas)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </>
                          ) : (
                            <Badge variant="secondary">Sin mapear</Badge>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </Section>
        </TabsContent>

        <TabsContent value="produccion">
          <Section>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="w-5 h-5" />
                  Sincronización de Producción
                </CardTitle>
                <CardDescription>
                  Sincroniza pólizas vigentes y datos de producción desde SICAS
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-900 mb-2">Estado Actual</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-blue-700">Total de Pólizas en BD:</p>
                      <p className="text-2xl font-bold text-blue-900">{totalPolizas}</p>
                    </div>
                    {produccionResult && (
                      <div>
                        <p className="text-blue-700">Última Sincronización:</p>
                        <p className="font-medium text-blue-900">
                          {produccionResult.stats?.records_fetched || 0} pólizas obtenidas
                        </p>
                        <p className="text-xs text-blue-600 mt-1">
                          {produccionResult.metadata?.synced_at ?
                            new Date(produccionResult.metadata.synced_at).toLocaleString('es-MX')
                            : 'N/A'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <Button
                    onClick={handleSyncProduccion}
                    disabled={syncingProduccion}
                    className="w-full"
                  >
                    {syncingProduccion ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Sincronizando...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Sincronizar Pólizas Vigentes
                      </>
                    )}
                  </Button>

                  <Button
                    onClick={loadTotalPolizas}
                    variant="outline"
                    className="w-full"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Actualizar Contador
                  </Button>
                </div>

                {produccionResult && (
                  <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4">
                    <h4 className="font-semibold mb-3">Resultado de la Sincronización</h4>
                    <pre className="text-xs bg-white p-3 rounded border overflow-auto max-h-96">
                      {JSON.stringify(produccionResult, null, 2)}
                    </pre>
                  </div>
                )}

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <h4 className="font-semibold text-amber-900 mb-2">Diagnóstico del Problema</h4>
                  <div className="text-sm text-amber-800 space-y-2">
                    <p>
                      Si la sincronización completa exitosamente pero no muestra pólizas (0 registros),
                      el problema puede ser:
                    </p>
                    <ul className="list-disc list-inside ml-2 space-y-1">
                      <li>El reporte H03117 no está disponible para tu usuario en SICAS</li>
                      <li>Tu usuario no tiene permisos para ver pólizas vigentes</li>
                      <li>No hay pólizas vigentes en el sistema SICAS</li>
                      <li>Se necesita usar un código de reporte diferente</li>
                    </ul>
                    <p className="mt-3 font-medium">
                      Solución: Contacta al proveedor de SICAS para confirmar:
                    </p>
                    <ul className="list-disc list-inside ml-2">
                      <li>Qué código de reporte usar para obtener pólizas vigentes</li>
                      <li>Si tu usuario tiene permisos para acceder a reportes de producción</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="w-5 h-5" />
                  Comisiones Pendientes (H03492_ALL)
                </CardTitle>
                <CardDescription>
                  Sincroniza comisiones pendientes de pago del mes actual
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <h4 className="font-semibold text-orange-900 mb-2">Estado Actual</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-orange-700">Total en BD:</p>
                      <p className="text-2xl font-bold text-orange-900">{totalComisionesPendientes}</p>
                    </div>
                    {comisionesPendientesResult && (
                      <div>
                        <p className="text-orange-700">Última Sincronización:</p>
                        <p className="font-medium text-orange-900">
                          {comisionesPendientesResult.stats?.records_fetched || 0} comisiones obtenidas
                        </p>
                        <p className="text-xs text-orange-600 mt-1">
                          {comisionesPendientesResult.metadata?.synced_at ?
                            new Date(comisionesPendientesResult.metadata.synced_at).toLocaleString('es-MX')
                            : 'N/A'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <Button
                    onClick={handleSyncComisionesPendientes}
                    disabled={syncingComisionesPendientes}
                    className="w-full bg-orange-600 hover:bg-orange-700"
                  >
                    {syncingComisionesPendientes ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Sincronizando...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Sincronizar Comisiones Pendientes
                      </>
                    )}
                  </Button>

                  <Button
                    onClick={loadTotalComisiones}
                    variant="outline"
                    className="w-full"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Actualizar Contador
                  </Button>
                </div>

                {comisionesPendientesResult && (
                  <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4">
                    <h4 className="font-semibold mb-3">Resultado de la Sincronización</h4>
                    <pre className="text-xs bg-white p-3 rounded border overflow-auto max-h-96">
                      {JSON.stringify(comisionesPendientesResult, null, 2)}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="w-5 h-5" />
                  Comisiones Pagadas (H03797)
                </CardTitle>
                <CardDescription>
                  Sincroniza comisiones pagadas del mes actual
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-semibold text-green-900 mb-2">Estado Actual</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-green-700">Total en BD:</p>
                      <p className="text-2xl font-bold text-green-900">{totalComisionesPagadas}</p>
                    </div>
                    {comisionesPagadasResult && (
                      <div>
                        <p className="text-green-700">Última Sincronización:</p>
                        <p className="font-medium text-green-900">
                          {comisionesPagadasResult.stats?.records_fetched || 0} comisiones obtenidas
                        </p>
                        <p className="text-xs text-green-600 mt-1">
                          {comisionesPagadasResult.metadata?.synced_at ?
                            new Date(comisionesPagadasResult.metadata.synced_at).toLocaleString('es-MX')
                            : 'N/A'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <Button
                    onClick={handleSyncComisionesPagadas}
                    disabled={syncingComisionesPagadas}
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    {syncingComisionesPagadas ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Sincronizando...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Sincronizar Comisiones Pagadas
                      </>
                    )}
                  </Button>

                  <Button
                    onClick={loadTotalComisiones}
                    variant="outline"
                    className="w-full"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Actualizar Contador
                  </Button>
                </div>

                {comisionesPagadasResult && (
                  <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4">
                    <h4 className="font-semibold mb-3">Resultado de la Sincronización</h4>
                    <pre className="text-xs bg-white p-3 rounded border overflow-auto max-h-96">
                      {JSON.stringify(comisionesPagadasResult, null, 2)}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>
          </Section>
        </TabsContent>

        <TabsContent value="diagnostico">
          <Section>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FlaskConical className="w-5 h-5" />
                  Modo Diagnóstico
                </CardTitle>
                <CardDescription>
                  Prueba diferentes catálogos y modos de retorno (TypeDataReturn) para diagnosticar problemas de SICAS
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="catalogId">ID Catálogo</Label>
                    <Input
                      id="catalogId"
                      type="number"
                      min="1"
                      max="61"
                      value={diagnosticCatalogId}
                      onChange={(e) => setDiagnosticCatalogId(e.target.value)}
                      placeholder="12"
                    />
                    <div className="text-xs text-neutral-600 space-y-1">
                      <p className="font-medium">Catálogos disponibles para probar:</p>
                      <ul className="list-disc list-inside ml-2 space-y-0.5">
                        <li><strong>9:</strong> Ramos (tipos de seguro)</li>
                        <li><strong>10:</strong> Oficinas</li>
                        <li><strong>11:</strong> Despachos</li>
                        <li><strong>12:</strong> Aseguradoras/Compañías</li>
                        <li><strong>13:</strong> Agentes individuales</li>
                        <li><strong>15:</strong> Agentes (alternativo)</li>
                        <li><strong>32:</strong> Vendedores</li>
                        <li><strong>34:</strong> Oficinas (alternativo)</li>
                      </ul>
                      <p className="text-amber-600 font-medium mt-2">
                        ⚠️ No todos los catálogos están disponibles. Algunos requieren permisos especiales.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="typeReturn">TypeDataReturn</Label>
                    <Select value={diagnosticTypeReturn} onValueChange={setDiagnosticTypeReturn}>
                      <SelectTrigger id="typeReturn">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">0 - DataSet</SelectItem>
                        <SelectItem value="1">1 - XML (recomendado)</SelectItem>
                        <SelectItem value="2">2 - JSON</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-neutral-500">
                      Modo de retorno del WS. Default productivo: XML (1)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dryRun">Modo</Label>
                    <Select
                      value={diagnosticDryRun ? 'dry' : 'save'}
                      onValueChange={(v) => setDiagnosticDryRun(v === 'dry')}
                    >
                      <SelectTrigger id="dryRun">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dry">Dry Run (no guardar)</SelectItem>
                        <SelectItem value="save">Guardar en BD</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-neutral-500">
                      Dry run solo prueba sin modificar la base de datos
                    </p>
                  </div>
                </div>

                <div>
                  <Button
                    onClick={handleDiagnosticTest}
                    disabled={diagnosticRunning || !diagnosticCatalogId}
                    className="w-full"
                  >
                    {diagnosticRunning ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Probando catálogo...
                      </>
                    ) : (
                      <>
                        <FlaskConical className="w-4 h-4 mr-2" />
                        Probar Catálogo {diagnosticCatalogId}
                      </>
                    )}
                  </Button>
                </div>

                {diagnosticResult && (
                  <div className="space-y-4 pt-6 border-t">
                    <h3 className="font-semibold">Resultado de la Prueba</h3>

                    <div className="grid grid-cols-4 gap-4">
                      <div className="p-3 bg-neutral-50 rounded-lg">
                        <div className="text-xs text-neutral-500 mb-1">Estado</div>
                        <Badge
                          variant={
                            diagnosticResult.catalog_status === 'available' ? 'default' :
                            diagnosticResult.catalog_status === 'not_available' ? 'secondary' :
                            'destructive'
                          }
                          className={
                            diagnosticResult.catalog_status === 'available' ? 'bg-green-500' : ''
                          }
                        >
                          {diagnosticResult.catalog_status || 'error'}
                        </Badge>
                      </div>

                      <div className="p-3 bg-neutral-50 rounded-lg">
                        <div className="text-xs text-neutral-500 mb-1">TypeDataReturn</div>
                        <div className="font-mono font-semibold">
                          {diagnosticResult.typeReturn} (
                          {diagnosticResult.typeReturn === 0 ? 'DataSet' :
                           diagnosticResult.typeReturn === 1 ? 'XML' : 'JSON'})
                        </div>
                      </div>

                      <div className="p-3 bg-neutral-50 rounded-lg">
                        <div className="text-xs text-neutral-500 mb-1">Registros</div>
                        <div className="text-lg font-bold text-blue-600">
                          {diagnosticResult.stats?.totalRows || 0}
                        </div>
                      </div>

                      <div className="p-3 bg-neutral-50 rounded-lg">
                        <div className="text-xs text-neutral-500 mb-1">Modo</div>
                        <div className="font-semibold">
                          {diagnosticResult.dryRun ? 'Dry Run' : 'Guardado'}
                        </div>
                      </div>
                    </div>

                    {diagnosticResult.warning && (
                      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg space-y-3">
                        <div>
                          <div className="font-medium text-yellow-900 mb-1">Advertencia / Mensaje de SICAS</div>
                          <div className="text-sm text-yellow-800 font-mono whitespace-pre-wrap break-words">
                            {diagnosticResult.warning}
                          </div>
                        </div>
                        {diagnosticResult.warning.length > 100 && (
                          <div className="text-xs text-yellow-700 pt-2 border-t border-yellow-200">
                            Mensaje completo ({diagnosticResult.warning.length} caracteres)
                          </div>
                        )}
                      </div>
                    )}

                    {diagnosticResult.debug && (
                      <div className="space-y-3">
                        <h4 className="font-medium text-sm">Debug Info</h4>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-3 bg-neutral-50 rounded-lg">
                            <div className="text-xs text-neutral-500 mb-1">HTTP Status</div>
                            <div className="font-mono">{diagnosticResult.debug.soapHttpStatus}</div>
                          </div>
                          <div className="p-3 bg-neutral-50 rounded-lg">
                            <div className="text-xs text-neutral-500 mb-1">Response Length</div>
                            <div className="font-mono">{diagnosticResult.debug.responseBodyLength?.toLocaleString()} bytes</div>
                          </div>
                        </div>

                        {diagnosticResult.debug.preview && (
                          <div>
                            <div className="text-xs text-neutral-500 mb-2">Response Preview (primeros 500 chars)</div>
                            <pre className="p-3 bg-neutral-900 text-neutral-100 rounded-lg text-xs overflow-x-auto">
                              {diagnosticResult.debug.preview}
                            </pre>
                          </div>
                        )}

                        {diagnosticResult.debug.parsedRecordsPreview && diagnosticResult.debug.parsedRecordsPreview.length > 0 && (
                          <div>
                            <div className="text-xs text-neutral-500 mb-2">Registros Parseados (primeros 3)</div>
                            <pre className="p-3 bg-neutral-900 text-neutral-100 rounded-lg text-xs overflow-x-auto">
                              {JSON.stringify(diagnosticResult.debug.parsedRecordsPreview, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}

                    {!diagnosticResult.success && diagnosticResult.error && (
                      <div className="p-4 bg-red-50 border border-red-200 rounded-lg space-y-3">
                        <div>
                          <div className="font-medium text-red-900 mb-1">Error Completo</div>
                          <div className="text-sm text-red-800 font-mono whitespace-pre-wrap break-words">
                            {diagnosticResult.error}
                          </div>
                        </div>
                        {diagnosticResult.error.length > 100 && (
                          <div className="text-xs text-red-700 pt-2 border-t border-red-200">
                            Mensaje completo ({diagnosticResult.error.length} caracteres)
                          </div>
                        )}
                        {diagnosticResult.stack && (
                          <details className="pt-2">
                            <summary className="text-xs text-red-700 cursor-pointer hover:text-red-900">
                              Ver Stack Trace
                            </summary>
                            <pre className="mt-2 p-2 bg-red-100 rounded text-xs overflow-x-auto">
                              {diagnosticResult.stack}
                            </pre>
                          </details>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </Section>
        </TabsContent>
      </Tabs>
    </Container>
  );
}
