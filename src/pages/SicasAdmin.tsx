import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, RefreshCw, CheckCircle, XCircle, Building, Users, Trash2, Link as LinkIcon, FlaskConical, Stethoscope, AlertCircle, Zap, Square, Clock } from 'lucide-react';
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
  testSicasRestConnection,
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
  const [testingRestConnection, setTestingRestConnection] = useState(false);
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
  const [testingProduccion, setTestingProduccion] = useState(false);
  const [testProduccionResult, setTestProduccionResult] = useState<any>(null);
  const [syncingSoapFull, setSyncingSoapFull] = useState(false);
  const [soapFullResult, setSoapFullResult] = useState<any>(null);

  const [syncingComisionesPendientes, setSyncingComisionesPendientes] = useState(false);
  const [comisionesPendientesResult, setComisionesPendientesResult] = useState<any>(null);
  const [totalComisionesPendientes, setTotalComisionesPendientes] = useState(0);

  const [syncingComisionesPagadas, setSyncingComisionesPagadas] = useState(false);
  const [comisionesPagadasResult, setComisionesPagadasResult] = useState<any>(null);
  const [totalComisionesPagadas, setTotalComisionesPagadas] = useState(0);

  const [testingComisiones, setTestingComisiones] = useState(false);
  const [testComisionesResult, setTestComisionesResult] = useState<any>(null);

  const [testingReportCodes, setTestingReportCodes] = useState(false);
  const [reportCodesResult, setReportCodesResult] = useState<any>(null);
  const [testingTimeoutCodes, setTestingTimeoutCodes] = useState(false);
  const [timeoutCodesResult, setTimeoutCodesResult] = useState<any>(null);
  const [testingH03117, setTestingH03117] = useState(false);
  const [h03117Result, setH03117Result] = useState<any>(null);

  // Auto-sync state
  const [autoSyncing, setAutoSyncing] = useState(false);
  const [autoSyncLog, setAutoSyncLog] = useState<{ time: string; text: string }[]>([]);
  const [autoSyncProgress, setAutoSyncProgress] = useState<{
    current: number;
    total: number;
    percent: number;
    batch: number;
    totalBatches: number;
    done: boolean;
    startedAt: number;
  } | null>(null);
  const [autoSyncError, setAutoSyncError] = useState<string | null>(null);
  const [autoSyncComplete, setAutoSyncComplete] = useState<{
    totalSynced: number;
    batches: number;
    durationSeconds: number;
  } | null>(null);
  const shouldStopRef = useRef(false);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const [totalDocuments, setTotalDocuments] = useState(0);

  useEffect(() => {
    loadData();
    loadTotalPolizas();
    loadTotalComisiones();
    loadTotalDocuments();
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

  async function handleTestRestConnection() {
    setTestingRestConnection(true);
    setMessage(null);

    try {
      const result = await testSicasRestConnection();
      if (result.success && result.connectionSuccess) {
        setMessage({
          type: 'success',
          text: `${result.message}\n\nAPI: ${result.apiType}\nEndpoint: ${result.endpoint}`
        });
      } else {
        setMessage({ type: 'error', text: `Error REST: ${result.message || result.error}` });
      }
      await loadData();
    } catch (error: any) {
      setMessage({ type: 'error', text: `Error REST: ${error.message}` });
    } finally {
      setTestingRestConnection(false);
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

  async function handleTestReportCodes() {
    setTestingReportCodes(true);
    setReportCodesResult(null);
    setMessage(null);

    try {
      const { data, error } = await supabase.functions.invoke('sicas-test-available-reports');

      if (error) throw error;

      setReportCodesResult(data);

      if (data.success) {
        const available = data.summary.with_data;
        setMessage({
          type: 'success',
          text: `Encontrados ${available} códigos de reporte con datos disponibles`
        });
      } else {
        setMessage({ type: 'error', text: `Error: ${data.error}` });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: `Error: ${error.message}` });
      setReportCodesResult({ success: false, error: error.message });
    } finally {
      setTestingReportCodes(false);
    }
  }

  async function handleTestTimeoutCodes() {
    setTestingTimeoutCodes(true);
    setTimeoutCodesResult(null);
    setMessage(null);

    try {
      const { data, error } = await supabase.functions.invoke('sicas-test-timeout-codes');

      if (error) throw error;

      setTimeoutCodesResult(data);

      if (data.success) {
        const available = data.summary?.available || 0;
        const withData = data.summary?.withData || 0;
        setMessage({
          type: 'success',
          text: `Prueba secuencial completada. ${available} códigos disponibles, ${withData} con datos.`
        });
      } else {
        setMessage({ type: 'error', text: `Error: ${data.error}` });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: `Error: ${error.message}` });
      setTimeoutCodesResult({ success: false, error: error.message });
    } finally {
      setTestingTimeoutCodes(false);
    }
  }

  async function handleTestH03117() {
    setTestingH03117(true);
    setH03117Result(null);
    setMessage(null);

    try {
      const { data, error } = await supabase.functions.invoke('sicas-test-h03117-diagnostic');

      if (error) throw error;

      setH03117Result(data);

      if (data.success) {
        const successful = data.summary?.successful || 0;
        const total = data.summary?.total_tests || 0;
        setMessage({
          type: successful > 0 ? 'success' : 'error',
          text: `Diagnóstico H03117 completado. ${successful}/${total} pruebas exitosas.`
        });
      } else {
        setMessage({ type: 'error', text: `Error: ${data.error}` });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: `Error: ${error.message}` });
      setH03117Result({ success: false, error: error.message });
    } finally {
      setTestingH03117(false);
    }
  }

  async function handleTestProduccion() {
    setTestingProduccion(true);
    setTestProduccionResult(null);
    setMessage(null);

    try {
      const { data, error } = await supabase.functions.invoke('test-sync-polizas-vigentes');

      if (error) throw error;

      setTestProduccionResult(data);

      if (data.success && data.diagnostico) {
        const { diagnostico } = data;

        if (diagnostico.problema_detectado) {
          setMessage({
            type: 'error',
            text: `${diagnostico.problema_detectado} - ${diagnostico.solucion_sugerida}`
          });
        } else {
          setMessage({
            type: 'success',
            text: `Diagnóstico completado: ${diagnostico.test_sin_filtros.registros} registros sin filtros, ${diagnostico.test_con_filtros.registros} con filtros`
          });
        }
      } else {
        setMessage({ type: 'error', text: `Error: ${data.error}` });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: `Error: ${error.message}` });
      setTestProduccionResult({ success: false, error: error.message });
    } finally {
      setTestingProduccion(false);
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

  async function handleSyncSoapFull(mode: 'full' | 'continue' = 'full') {
    setSyncingSoapFull(true);
    if (mode === 'full') setSoapFullResult(null);
    setMessage(null);

    try {
      const { data, error } = await supabase.functions.invoke('sicas-sync-local-documents', {
        body: { mode },
      });

      if (error) throw error;

      setSoapFullResult(data);
      await loadTotalPolizas();

      if (data.ok) {
        const p = data.progress || {};
        const label = data.isComplete ? 'Sync completo' : `Batch completado (${p.percent || 0}%)`;
        setMessage({
          type: 'success',
          text: `${label}: ${p.batchFetched || 0} obtenidos, ${p.batchUpserted || 0} guardados, paginas ${data.stats?.startPage || 1}-${data.stats?.endPage || 0}/${p.totalPages || '?'} (${Math.round((data.stats?.durationMs || 0) / 1000)}s)`
        });
      } else {
        setMessage({ type: 'error', text: `Error: ${data.error}` });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: `Error: ${error.message}` });
      setSoapFullResult({ ok: false, error: error.message });
    } finally {
      setSyncingSoapFull(false);
    }
  }

  const addLog = useCallback((text: string) => {
    const time = new Date().toLocaleTimeString('es-MX', { hour12: false });
    setAutoSyncLog(prev => [...prev, { time, text }]);
    setTimeout(() => {
      logContainerRef.current?.scrollTo({ top: logContainerRef.current.scrollHeight, behavior: 'smooth' });
    }, 50);
  }, []);

  function formatDuration(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  }

  async function runAutoSync() {
    setAutoSyncing(true);
    setAutoSyncLog([]);
    setAutoSyncError(null);
    setAutoSyncComplete(null);
    shouldStopRef.current = false;

    const startedAt = Date.now();
    let isComplete = false;
    let totalSynced = 0;
    let totalPages = 0;
    let batchNumber = 0;
    let consecutiveErrors = 0;

    addLog('Iniciando sincronizacion automatica...');

    // First batch: mode='full' to reset cursor
    try {
      const { data, error } = await supabase.functions.invoke('sicas-sync-local-documents', {
        body: { mode: 'full' },
      });

      if (error) throw new Error(error.message);
      if (!data?.ok) throw new Error(data?.error || 'Error en primer batch');

      isComplete = data.isComplete;
      totalSynced = data.progress?.accumulatedSynced ?? data.progress?.batchUpserted ?? 0;
      totalPages = data.progress?.totalPages ?? 0;
      batchNumber = 1;
      consecutiveErrors = 0;

      const docsThisBatch = data.progress?.batchUpserted ?? data.progress?.batchFetched ?? 0;
      addLog(`Batch 1: ${docsThisBatch.toLocaleString()} docs descargados | Paginas: ${data.progress?.currentPage ?? 0}/${totalPages}`);

      const estBatches = totalPages > 0 ? Math.ceil(totalPages / 60) : 0;
      setAutoSyncProgress({
        current: totalSynced,
        total: totalPages * 100,
        percent: totalPages > 0 ? Math.round(((data.progress?.currentPage ?? 0) / totalPages) * 100) : 0,
        batch: 1,
        totalBatches: estBatches,
        done: isComplete,
        startedAt,
      });

      await loadTotalDocuments();

    } catch (err: any) {
      setAutoSyncError(`Error en batch 1: ${err.message}`);
      addLog(`ERROR en batch 1: ${err.message}`);
      setAutoSyncing(false);
      return;
    }

    // Continue batches until complete
    while (!isComplete && batchNumber < 100 && !shouldStopRef.current) {
      await new Promise(r => setTimeout(r, 2000));

      if (shouldStopRef.current) {
        addLog('Sincronizacion detenida por el usuario.');
        break;
      }

      try {
        const { data, error } = await supabase.functions.invoke('sicas-sync-local-documents', {
          body: { mode: 'continue' },
        });

        if (error) throw new Error(error.message);
        if (!data?.ok) throw new Error(data?.error || `Error en batch ${batchNumber + 1}`);

        batchNumber++;
        consecutiveErrors = 0;
        isComplete = data.isComplete;
        totalSynced = data.progress?.accumulatedSynced ?? totalSynced;
        totalPages = data.progress?.totalPages ?? totalPages;

        const docsThisBatch = data.progress?.batchUpserted ?? data.progress?.batchFetched ?? 0;
        addLog(`Batch ${batchNumber}: ${docsThisBatch.toLocaleString()} docs | Total: ${totalSynced.toLocaleString()} | Pag ${data.progress?.currentPage ?? '?'}/${totalPages}`);

        const estBatches = totalPages > 0 ? Math.ceil(totalPages / 60) : batchNumber;
        const elapsedSec = Math.round((Date.now() - startedAt) / 1000);
        const currentPage = data.progress?.currentPage ?? 0;
        const pct = totalPages > 0 ? Math.round((currentPage / totalPages) * 100) : 0;

        setAutoSyncProgress({
          current: totalSynced,
          total: totalPages * 100,
          percent: pct,
          batch: batchNumber,
          totalBatches: estBatches,
          done: isComplete,
          startedAt,
        });

        if (batchNumber % 3 === 0) await loadTotalDocuments();

      } catch (err: any) {
        consecutiveErrors++;
        addLog(`Error en batch ${batchNumber + 1}: ${err.message}${consecutiveErrors < 3 ? ' - Reintentando en 5s...' : ''}`);

        if (consecutiveErrors >= 3) {
          setAutoSyncError(`3 errores consecutivos. Ultimo: ${err.message}. Puedes reanudar con "Continuar Sync".`);
          addLog('Detenido tras 3 errores consecutivos.');
          break;
        }

        await new Promise(r => setTimeout(r, 5000));
      }
    }

    await loadTotalDocuments();
    await loadTotalPolizas();
    setAutoSyncing(false);

    if (isComplete) {
      const durationSeconds = Math.round((Date.now() - startedAt) / 1000);
      setAutoSyncComplete({ totalSynced, batches: batchNumber, durationSeconds });
      addLog(`Sincronizacion completa: ${totalSynced.toLocaleString()} documentos en ${batchNumber} batches (${formatDuration(durationSeconds)})`);
      setAutoSyncProgress(prev => prev ? { ...prev, done: true, percent: 100 } : null);
    } else if (shouldStopRef.current) {
      addLog(`Detenido en batch ${batchNumber}. ${totalSynced.toLocaleString()} docs descargados hasta ahora.`);
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

  async function loadTotalDocuments() {
    const { count, error } = await supabase
      .from('sicas_documents')
      .select('*', { count: 'exact', head: true });
    if (!error) setTotalDocuments(count || 0);
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

  async function handleTestComisiones() {
    setTestingComisiones(true);
    setTestComisionesResult(null);
    setMessage(null);

    try {
      const { data, error } = await supabase.functions.invoke('sicas-test-comisiones', {
        body: {},
      });

      if (error) throw error;

      setTestComisionesResult(data);

      if (data.success) {
        setMessage({
          type: 'success',
          text: `Prueba exitosa: ${data.records_found} comisiones encontradas. Revisa el resultado para más detalles.`
        });
      } else {
        setMessage({
          type: 'error',
          text: `Prueba falló: ${data.error || 'Error desconocido'}. Revisa el resultado para diagnóstico.`
        });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: `Error: ${error.message}` });
      setTestComisionesResult({ success: false, error: error.message });
    } finally {
      setTestingComisiones(false);
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
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
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
              <Badge className="ml-2 bg-accent text-white text-xs px-1.5 py-0">
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
                          Probar Conexión SOAP
                        </>
                      )}
                    </Button>

                    <Button
                      onClick={handleTestRestConnection}
                      disabled={testingRestConnection}
                      variant="default"
                    >
                      {testingRestConnection ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Probando...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Probar Conexión REST
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
                    <Building className="w-8 h-8 mx-auto mb-2 text-accent" />
                    <div className="text-2xl font-bold text-blue-900">{despachos.length}</div>
                    <div className="text-sm text-blue-700">Despachos en catálogo</div>
                    <div className="text-xs text-accent mt-1">
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
                        <p className="text-xs text-accent mt-1">
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
                    onClick={handleTestProduccion}
                    disabled={testingProduccion}
                    variant="outline"
                    className="w-full border-blue-300 text-blue-700 hover:bg-blue-50"
                  >
                    {testingProduccion ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Ejecutando Diagnóstico...
                      </>
                    ) : (
                      <>
                        <Stethoscope className="w-4 h-4 mr-2" />
                        Diagnóstico Completo (Recomendado primero)
                      </>
                    )}
                  </Button>

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
                        Sincronizar Polizas Vigentes (SOAP)
                      </>
                    )}
                  </Button>

                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      onClick={() => handleSyncSoapFull('full')}
                      disabled={syncingSoapFull || autoSyncing}
                      className="w-full bg-emerald-600 hover:bg-emerald-700"
                    >
                      {syncingSoapFull ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Sincronizando...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Sync Manual (1 batch)
                        </>
                      )}
                    </Button>

                    <Button
                      onClick={runAutoSync}
                      disabled={syncingSoapFull || autoSyncing}
                      className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-semibold shadow-md"
                    >
                      {autoSyncing ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Ejecutando...
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4 mr-2" />
                          Sincronizacion Automatica
                        </>
                      )}
                    </Button>
                  </div>

                  {soapFullResult?.ok && !soapFullResult.isComplete && !syncingSoapFull && !autoSyncing && (
                    <Button
                      onClick={() => handleSyncSoapFull('continue')}
                      disabled={autoSyncing}
                      className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Continuar Sync (pagina {soapFullResult.nextPage || '?'} de {soapFullResult.progress?.totalPages || '?'})
                    </Button>
                  )}

                  {/* Auto-sync progress panel */}
                  {(autoSyncing || autoSyncProgress || autoSyncComplete) && (
                    <div className="border-2 border-blue-200 rounded-xl overflow-hidden bg-white">
                      {/* Header */}
                      <div className={`px-4 py-3 flex items-center justify-between ${
                        autoSyncComplete ? 'bg-emerald-50 border-b border-emerald-200' :
                        autoSyncError ? 'bg-red-50 border-b border-red-200' :
                        'bg-blue-50 border-b border-blue-200'
                      }`}>
                        <div className="flex items-center gap-2">
                          {autoSyncComplete ? (
                            <CheckCircle className="w-5 h-5 text-emerald-600" />
                          ) : autoSyncError ? (
                            <XCircle className="w-5 h-5 text-red-600" />
                          ) : (
                            <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                          )}
                          <span className={`font-semibold text-sm ${
                            autoSyncComplete ? 'text-emerald-900' :
                            autoSyncError ? 'text-red-900' :
                            'text-blue-900'
                          }`}>
                            {autoSyncComplete ? 'Sincronizacion Completa' :
                             autoSyncError ? 'Sincronizacion Detenida' :
                             'Sincronizacion Automatica en Curso'}
                          </span>
                        </div>
                        {autoSyncing && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => { shouldStopRef.current = true; }}
                            className="border-red-300 text-red-700 hover:bg-red-50 h-7 text-xs"
                          >
                            <Square className="w-3 h-3 mr-1" />
                            Detener
                          </Button>
                        )}
                      </div>

                      {/* Progress bar */}
                      {autoSyncProgress && (
                        <div className="px-4 pt-3 pb-2">
                          <div className="flex justify-between text-xs text-neutral-600 mb-1.5">
                            <span>
                              {autoSyncProgress.current.toLocaleString()} de {autoSyncProgress.total > 0 ? `~${autoSyncProgress.total.toLocaleString()}` : '...'} documentos
                            </span>
                            <span className="font-semibold text-blue-700">{autoSyncProgress.percent}%</span>
                          </div>
                          <div className="w-full bg-neutral-200 rounded-full h-3 overflow-hidden">
                            <div
                              className={`h-3 rounded-full transition-all duration-500 ${
                                autoSyncProgress.done ? 'bg-emerald-500' : 'bg-gradient-to-r from-blue-500 to-cyan-500'
                              }`}
                              style={{ width: `${Math.max(autoSyncProgress.percent, 1)}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-[11px] text-neutral-500 mt-1.5">
                            <span>
                              Batch {autoSyncProgress.batch} de ~{autoSyncProgress.totalBatches}
                            </span>
                            {autoSyncing && autoSyncProgress.batch > 1 && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {(() => {
                                  const elapsed = Math.round((Date.now() - autoSyncProgress.startedAt) / 1000);
                                  const rate = autoSyncProgress.batch > 0 ? elapsed / autoSyncProgress.batch : 0;
                                  const remaining = Math.round(rate * (autoSyncProgress.totalBatches - autoSyncProgress.batch));
                                  return `~${formatDuration(remaining)} restantes`;
                                })()}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Stats row */}
                      {autoSyncProgress && (
                        <div className="px-4 pb-2">
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div className="bg-blue-50 rounded-lg px-2.5 py-1.5 text-center">
                              <div className="text-blue-600 font-medium">Documentos</div>
                              <div className="text-blue-900 font-bold">{totalDocuments.toLocaleString()}</div>
                            </div>
                            <div className="bg-emerald-50 rounded-lg px-2.5 py-1.5 text-center">
                              <div className="text-emerald-600 font-medium">Descargados</div>
                              <div className="text-emerald-900 font-bold">{autoSyncProgress.current.toLocaleString()}</div>
                            </div>
                            <div className="bg-neutral-50 rounded-lg px-2.5 py-1.5 text-center">
                              <div className="text-neutral-600 font-medium">Tiempo</div>
                              <div className="text-neutral-900 font-bold">
                                {formatDuration(Math.round((Date.now() - autoSyncProgress.startedAt) / 1000))}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Error message */}
                      {autoSyncError && (
                        <div className="mx-4 mb-2 p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
                          {autoSyncError}
                        </div>
                      )}

                      {/* Completion summary */}
                      {autoSyncComplete && (
                        <div className="mx-4 mb-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                          <div className="grid grid-cols-3 gap-3 text-center text-sm">
                            <div>
                              <div className="text-emerald-600 text-xs font-medium">Documentos</div>
                              <div className="text-emerald-900 font-bold text-lg">{autoSyncComplete.totalSynced.toLocaleString()}</div>
                            </div>
                            <div>
                              <div className="text-emerald-600 text-xs font-medium">Batches</div>
                              <div className="text-emerald-900 font-bold text-lg">{autoSyncComplete.batches}</div>
                            </div>
                            <div>
                              <div className="text-emerald-600 text-xs font-medium">Duracion</div>
                              <div className="text-emerald-900 font-bold text-lg">{formatDuration(autoSyncComplete.durationSeconds)}</div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Log */}
                      {autoSyncLog.length > 0 && (
                        <div className="px-4 pb-3">
                          <div className="text-xs font-medium text-neutral-500 mb-1.5">Log en tiempo real</div>
                          <div
                            ref={logContainerRef}
                            className="bg-neutral-900 text-neutral-100 rounded-lg p-3 max-h-48 overflow-y-auto font-mono text-[11px] leading-relaxed"
                          >
                            {autoSyncLog.slice(-15).map((entry, i) => (
                              <div key={i} className="flex gap-2">
                                <span className="text-neutral-500 flex-shrink-0">[{entry.time}]</span>
                                <span className={
                                  entry.text.includes('ERROR') || entry.text.includes('Error') ? 'text-red-400' :
                                  entry.text.includes('completa') || entry.text.includes('Completa') ? 'text-emerald-400' :
                                  entry.text.includes('Detenid') ? 'text-amber-400' :
                                  'text-neutral-200'
                                }>
                                  {entry.text}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {soapFullResult && !autoSyncing && !autoSyncProgress && (
                    <div className={`p-3 rounded-lg border text-sm ${soapFullResult.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                      {soapFullResult.ok ? (
                        <div>
                          <p className="font-medium">
                            {soapFullResult.isComplete ? 'Sincronizacion completa' : `Batch completado - ${soapFullResult.progress?.percent || 0}%`}
                          </p>

                          {/* Progress bar */}
                          {soapFullResult.progress && (
                            <div className="mt-2">
                              <div className="flex justify-between text-[11px] mb-1">
                                <span>Pagina {soapFullResult.progress.currentPage} de {soapFullResult.progress.totalPages}</span>
                                <span>{soapFullResult.progress.percent}%</span>
                              </div>
                              <div className="w-full bg-emerald-200 rounded-full h-2.5">
                                <div
                                  className={`h-2.5 rounded-full transition-all duration-300 ${soapFullResult.isComplete ? 'bg-emerald-600' : 'bg-blue-500'}`}
                                  style={{ width: `${soapFullResult.progress.percent || 0}%` }}
                                />
                              </div>
                            </div>
                          )}

                          <p className="text-xs mt-2">
                            {soapFullResult.stats?.recordsFetched || 0} obtenidos en este batch,{' '}
                            {soapFullResult.stats?.documentsUpserted || 0} guardados,{' '}
                            paginas {soapFullResult.stats?.startPage || 1}-{soapFullResult.stats?.endPage || 0}/{soapFullResult.progress?.totalPages || '?'},{' '}
                            {Math.round((soapFullResult.stats?.durationMs || 0) / 1000)}s
                          </p>
                          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                            <div className="bg-white/60 rounded p-1.5">
                              <span className="text-emerald-600 font-medium">Total SICAS:</span> {soapFullResult.progress?.totalInSicas?.toLocaleString() || 0}
                            </div>
                            <div className="bg-white/60 rounded p-1.5">
                              <span className="text-emerald-600 font-medium">Acumulado:</span> {soapFullResult.progress?.accumulatedSynced?.toLocaleString() || 0}
                            </div>
                            <div className="bg-white/60 rounded p-1.5">
                              <span className="text-emerald-600 font-medium">Este batch:</span> {soapFullResult.progress?.batchUpserted || 0}
                            </div>
                            <div className={`rounded p-1.5 ${(soapFullResult.progress?.errors || 0) > 0 ? 'bg-amber-50' : 'bg-white/60'}`}>
                              <span className={`font-medium ${(soapFullResult.progress?.errors || 0) > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>Errores:</span> {soapFullResult.progress?.errors || 0}
                            </div>
                          </div>

                          {!soapFullResult.isComplete && (
                            <p className="mt-2 text-xs text-blue-700 bg-blue-50 rounded p-2">
                              Faltan {(soapFullResult.progress?.totalPages || 0) - (soapFullResult.progress?.currentPage || 0)} paginas por sincronizar.
                              Presiona "Continuar Sync" para descargar el siguiente lote.
                            </p>
                          )}
                        </div>
                      ) : (
                        <p>Error: {soapFullResult.error}</p>
                      )}
                    </div>
                  )}

                  <Button
                    onClick={loadTotalPolizas}
                    variant="outline"
                    className="w-full"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Actualizar Contador
                  </Button>
                </div>

                {testProduccionResult && (
                  <div className="bg-blue-50 border border-blue-300 rounded-lg p-4">
                    <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                      <Stethoscope className="w-5 h-5" />
                      Resultado del Diagnóstico Completo
                    </h4>

                    {testProduccionResult.diagnostico && (
                      <div className="space-y-4">
                        {testProduccionResult.diagnostico.problema_detectado && (
                          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                            <div className="flex items-start gap-2">
                              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                              <div className="flex-1">
                                <p className="font-medium text-red-900 mb-1">Problema Detectado:</p>
                                <p className="text-red-800 mb-3">{testProduccionResult.diagnostico.problema_detectado}</p>
                                <p className="font-medium text-red-900 mb-1">Solución Sugerida:</p>
                                <p className="text-red-800">{testProduccionResult.diagnostico.solucion_sugerida}</p>
                              </div>
                            </div>
                          </div>
                        )}

                        {!testProduccionResult.diagnostico.problema_detectado && (
                          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <div className="flex items-start gap-2">
                              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                              <div>
                                <p className="font-medium text-green-900 mb-1">Todo Funciona Correctamente</p>
                                <p className="text-green-800">{testProduccionResult.diagnostico.solucion_sugerida}</p>
                              </div>
                            </div>
                          </div>
                        )}

                        {testProduccionResult.diagnostico.codigos_probados && (
                          <div className="bg-white border border-neutral-200 rounded-lg p-4">
                            <h5 className="font-semibold text-neutral-900 mb-3">
                              Códigos de Reporte Probados ({testProduccionResult.diagnostico.codigos_probados.length})
                            </h5>
                            <div className="space-y-2 max-h-96 overflow-y-auto">
                              {testProduccionResult.diagnostico.codigos_probados.map((code: any) => (
                                <div
                                  key={code.code}
                                  className={`flex items-center justify-between p-3 rounded-lg ${
                                    code.registros > 0
                                      ? 'bg-green-50 border border-green-200'
                                      : 'bg-neutral-50 border border-neutral-200'
                                  }`}
                                >
                                  <div className="flex items-center gap-3 flex-1 min-w-0">
                                    {code.registros > 0 ? (
                                      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                                    ) : (
                                      <XCircle className="w-5 h-5 text-neutral-400 flex-shrink-0" />
                                    )}
                                    <div className="min-w-0 flex-1">
                                      <p className="font-medium text-neutral-900 truncate">
                                        {code.code} - {code.name}
                                      </p>
                                      <p className="text-xs text-neutral-600 truncate">{code.message}</p>
                                    </div>
                                  </div>
                                  <div className="text-right ml-4 flex-shrink-0">
                                    <p className={`text-lg font-bold ${
                                      code.registros > 0 ? 'text-green-600' : 'text-neutral-400'
                                    }`}>
                                      {code.registros}
                                    </p>
                                    <p className="text-xs text-neutral-500">registros</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {testProduccionResult.diagnostico.codigos_con_datos?.length > 0 && (
                          <div className="bg-green-50 border border-green-300 rounded-lg p-4">
                            <h5 className="font-semibold text-green-900 mb-2 flex items-center gap-2">
                              <CheckCircle className="w-5 h-5" />
                              Mejor Código de Reporte
                            </h5>
                            <p className="text-green-800 mb-2">
                              Se recomienda usar: <span className="font-mono font-bold">{testProduccionResult.diagnostico.mejor_codigo}</span>
                            </p>
                            <div className="text-sm text-green-700">
                              Códigos disponibles con datos:
                              <ul className="list-disc list-inside mt-1 ml-2">
                                {testProduccionResult.diagnostico.codigos_con_datos.map((c: any) => (
                                  <li key={c.code}>
                                    {c.code}: {c.name} ({c.registros} registros)
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        )}

                        {testProduccionResult.resultados?.mejor_resultado && (
                          <details className="mt-4">
                            <summary className="cursor-pointer font-medium text-neutral-700 hover:text-neutral-900">
                              Ver muestra de datos del mejor código
                            </summary>
                            <pre className="text-xs bg-white p-3 rounded border mt-2 overflow-auto max-h-60">
                              {JSON.stringify(testProduccionResult.resultados.mejor_resultado, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    )}
                  </div>
                )}

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
                  <AlertCircle className="w-5 h-5" />
                  Diagnóstico de Comisiones
                </CardTitle>
                <CardDescription>
                  Prueba rápida para verificar conexión y permisos de reportes de comisiones
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-900 mb-2">Antes de sincronizar comisiones</h4>
                  <p className="text-sm text-blue-800">
                    Ejecuta esta prueba primero para verificar que:
                  </p>
                  <ul className="list-disc list-inside text-sm text-blue-800 ml-2 mt-2 space-y-1">
                    <li>Tu usuario tiene permisos para reportes H03492_ALL y H03797</li>
                    <li>La conexión a SICAS funciona correctamente</li>
                    <li>Los datos de comisiones están disponibles</li>
                  </ul>
                </div>

                <Button
                  onClick={handleTestComisiones}
                  disabled={testingComisiones}
                  variant="outline"
                  className="w-full"
                >
                  {testingComisiones ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Probando...
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 mr-2" />
                      Probar Conexión de Comisiones
                    </>
                  )}
                </Button>

                {testComisionesResult && (
                  <div className={`border rounded-lg p-4 ${
                    testComisionesResult.success
                      ? 'bg-green-50 border-green-200'
                      : 'bg-red-50 border-red-200'
                  }`}>
                    <h4 className={`font-semibold mb-3 ${
                      testComisionesResult.success ? 'text-green-900' : 'text-red-900'
                    }`}>
                      Resultado del Diagnóstico
                    </h4>
                    <div className="space-y-2 text-sm mb-3">
                      {testComisionesResult.success ? (
                        <>
                          <p className="text-green-800 font-medium">
                            Conexión exitosa - {testComisionesResult.records_found || 0} comisiones encontradas
                          </p>
                          <p className="text-green-700">
                            El sistema está listo para sincronizar comisiones.
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-red-800 font-medium">
                            Error: {testComisionesResult.error}
                          </p>
                          <p className="text-red-700">
                            Revisa el diagnóstico completo abajo para más detalles.
                          </p>
                        </>
                      )}
                    </div>
                    <pre className="text-xs bg-white p-3 rounded border overflow-auto max-h-96">
                      {JSON.stringify(testComisionesResult, null, 2)}
                    </pre>
                  </div>
                )}
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
                        <div className="text-lg font-bold text-accent">
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

            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Stethoscope className="w-5 h-5" />
                  Diagnóstico de Códigos de Reporte
                </CardTitle>
                <CardDescription>
                  Identifica qué códigos de reporte REST están disponibles en tu instancia de SICAS
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
                    <div className="space-y-2 text-sm text-blue-900">
                      <p className="font-medium">¿Por qué usar esta herramienta?</p>
                      <p>
                        Si ves el error "Código de reporte no encontrado" durante la sincronización,
                        esta herramienta identificará qué códigos están activos en tu SICAS.
                      </p>
                      <p className="text-xs text-blue-700">
                        Esta prueba tardará aproximadamente 15-30 segundos mientras prueba múltiples códigos de reporte.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div className="space-y-2 text-sm text-amber-900">
                      <p className="font-medium">Importante: SOAP vs REST</p>
                      <p>
                        El Manual oficial de SICAS documenta códigos para <strong>WebService SOAP</strong>.
                        Esta aplicación usa <strong>API REST</strong>. Los códigos pueden ser diferentes.
                      </p>
                      <div className="mt-2 pl-4 border-l-2 border-amber-300">
                        <p className="text-xs text-amber-800 mb-1 font-medium">Códigos oficiales SOAP (del manual):</p>
                        <div className="flex flex-wrap gap-1 text-xs font-mono">
                          <span className="bg-amber-100 px-2 py-0.5 rounded">H03117</span>
                          <span className="text-amber-600">Pólizas Vigentes</span>
                          <span className="mx-1">•</span>
                          <span className="bg-amber-100 px-2 py-0.5 rounded">H03492_ALL</span>
                          <span className="text-amber-600">Comisiones Pendientes</span>
                          <span className="mx-1">•</span>
                          <span className="bg-amber-100 px-2 py-0.5 rounded">HAPPDATAL_D004</span>
                          <span className="text-amber-600">Cobranza</span>
                        </div>
                        <p className="text-xs text-amber-700 mt-2">
                          Estos códigos se probarán automáticamente, pero tu instalación REST puede usar códigos diferentes.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Button
                    onClick={handleTestReportCodes}
                    disabled={testingReportCodes || testingTimeoutCodes || testingH03117}
                    className="w-full"
                    variant="outline"
                  >
                    {testingReportCodes ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Probando...
                      </>
                    ) : (
                      <>
                        <Stethoscope className="w-4 h-4 mr-2" />
                        Prueba Rápida (25 códigos)
                      </>
                    )}
                  </Button>

                  <Button
                    onClick={handleTestTimeoutCodes}
                    disabled={testingReportCodes || testingTimeoutCodes || testingH03117}
                    className="w-full"
                    variant="outline"
                  >
                    {testingTimeoutCodes ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Probando lento...
                      </>
                    ) : (
                      <>
                        <FlaskConical className="w-4 h-4 mr-2" />
                        Prueba Secuencial (7 códigos)
                      </>
                    )}
                  </Button>
                </div>

                <Button
                  onClick={handleTestH03117}
                  disabled={testingReportCodes || testingTimeoutCodes || testingH03117}
                  className="w-full"
                  variant="outline"
                >
                  {testingH03117 ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Diagnosticando H03117...
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 mr-2" />
                      Diagnóstico Especial H03117 (6 variantes)
                    </>
                  )}
                </Button>

                <div className="text-sm text-neutral-600 space-y-1">
                  <p><strong>Prueba Rápida:</strong> Prueba 25 códigos en paralelo (60 seg cada uno). Rápido pero algunos pueden dar timeout.</p>
                  <p><strong>Prueba Secuencial:</strong> Prueba 7 códigos uno por uno (90 seg cada uno). Lento pero más preciso para códigos que tardan.</p>
                  <p><strong>Diagnóstico H03117:</strong> Prueba el código H03117 con 6 configuraciones diferentes de parámetros para identificar el problema exacto.</p>
                </div>

                {reportCodesResult && (
                  <div className="space-y-4 pt-6 border-t">
                    <h3 className="font-semibold">Resultados del Diagnóstico</h3>

                    <div className="grid grid-cols-4 gap-4">
                      <div className="p-3 bg-neutral-50 rounded-lg">
                        <div className="text-xs text-neutral-500 mb-1">Probados</div>
                        <div className="text-lg font-bold text-neutral-900">
                          {reportCodesResult.summary?.total_tested || 0}
                        </div>
                      </div>

                      <div className="p-3 bg-green-50 rounded-lg">
                        <div className="text-xs text-neutral-500 mb-1">Disponibles</div>
                        <div className="text-lg font-bold text-green-600">
                          {reportCodesResult.summary?.available || 0}
                        </div>
                      </div>

                      <div className="p-3 bg-blue-50 rounded-lg">
                        <div className="text-xs text-neutral-500 mb-1">Con Datos</div>
                        <div className="text-lg font-bold text-accent">
                          {reportCodesResult.summary?.with_data || 0}
                        </div>
                      </div>

                      <div className="p-3 bg-red-50 rounded-lg">
                        <div className="text-xs text-neutral-500 mb-1">No Encontrados</div>
                        <div className="text-lg font-bold text-red-600">
                          {reportCodesResult.summary?.not_found || 0}
                        </div>
                      </div>
                    </div>

                    {reportCodesResult.recommendations && reportCodesResult.recommendations.length > 0 && (
                      <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-3">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-5 h-5 text-green-600" />
                          <div className="font-medium text-green-900">
                            Códigos Recomendados (con datos)
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {reportCodesResult.recommendations.map((code: string) => (
                            <Badge key={code} className="bg-green-600 text-white font-mono">
                              {code}
                            </Badge>
                          ))}
                        </div>
                        <p className="text-sm text-green-800">
                          Usa estos códigos en la configuración de sincronización de SICAS
                        </p>
                      </div>
                    )}

                    {reportCodesResult.results && (
                      <div>
                        <details className="pt-2">
                          <summary className="text-sm font-medium cursor-pointer hover:text-accent mb-3">
                            Ver Detalle de Todos los Códigos
                          </summary>
                          <div className="space-y-2 mt-3">
                            {reportCodesResult.results.map((result: any) => (
                              <div
                                key={result.keyCode}
                                className={`p-3 rounded-lg border ${
                                  result.status === 'available'
                                    ? 'bg-green-50 border-green-200'
                                    : result.status === 'not_found'
                                    ? 'bg-neutral-50 border-neutral-200'
                                    : 'bg-red-50 border-red-200'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <code className="font-mono font-bold">{result.keyCode}</code>
                                    <Badge
                                      variant={
                                        result.status === 'available' ? 'default' : 'secondary'
                                      }
                                      className={
                                        result.status === 'available'
                                          ? 'bg-green-500'
                                          : result.status === 'not_found'
                                          ? 'bg-neutral-400'
                                          : 'bg-red-500'
                                      }
                                    >
                                      {result.status}
                                    </Badge>
                                    {result.hasData && (
                                      <span className="text-xs text-green-700">
                                        {result.recordCount} registros
                                      </span>
                                    )}
                                  </div>
                                  {result.status === 'available' ? (
                                    <CheckCircle className="w-4 h-4 text-green-600" />
                                  ) : (
                                    <XCircle className="w-4 h-4 text-neutral-400" />
                                  )}
                                </div>
                                {result.error && (
                                  <div className="text-xs text-neutral-600 mt-2 font-mono">
                                    {result.error}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </details>
                      </div>
                    )}

                    {!reportCodesResult.success && reportCodesResult.error && (
                      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                        <div className="font-medium text-red-900 mb-1">Error</div>
                        <div className="text-sm text-red-800 font-mono whitespace-pre-wrap break-words">
                          {reportCodesResult.error}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {timeoutCodesResult && (
                  <div className="space-y-4 pt-6 border-t">
                    <h3 className="font-semibold">Resultados de la Prueba Secuencial</h3>

                    <div className="grid grid-cols-4 gap-4">
                      <div className="p-3 bg-neutral-50 rounded-lg">
                        <div className="text-xs text-neutral-500 mb-1">Probados</div>
                        <div className="text-lg font-bold text-neutral-900">
                          {timeoutCodesResult.summary?.total || 0}
                        </div>
                      </div>

                      <div className="p-3 bg-green-50 rounded-lg">
                        <div className="text-xs text-neutral-500 mb-1">Disponibles</div>
                        <div className="text-lg font-bold text-green-600">
                          {timeoutCodesResult.summary?.available || 0}
                        </div>
                      </div>

                      <div className="p-3 bg-blue-50 rounded-lg">
                        <div className="text-xs text-neutral-500 mb-1">Con Datos</div>
                        <div className="text-lg font-bold text-accent">
                          {timeoutCodesResult.summary?.withData || 0}
                        </div>
                      </div>

                      <div className="p-3 bg-amber-50 rounded-lg">
                        <div className="text-xs text-neutral-500 mb-1">Timeout</div>
                        <div className="text-lg font-bold text-amber-600">
                          {timeoutCodesResult.summary?.timeout || 0}
                        </div>
                      </div>
                    </div>

                    {timeoutCodesResult.successfulCodes && timeoutCodesResult.successfulCodes.length > 0 && (
                      <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-3">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-5 h-5 text-green-600" />
                          <div className="font-medium text-green-900">
                            Códigos Exitosos (con datos)
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {timeoutCodesResult.successfulCodes.map((code: string) => (
                            <Badge key={code} className="bg-green-600 text-white font-mono">
                              {code}
                            </Badge>
                          ))}
                        </div>
                        <p className="text-sm text-green-800">
                          Estos códigos fueron verificados con timeout extendido (90 segundos)
                        </p>
                      </div>
                    )}

                    {timeoutCodesResult.results && (
                      <div>
                        <details className="pt-2">
                          <summary className="text-sm font-medium cursor-pointer hover:text-accent mb-3">
                            Ver Detalle de Todos los Códigos Probados
                          </summary>
                          <div className="space-y-2 mt-3">
                            {timeoutCodesResult.results.map((result: any) => (
                              <div
                                key={result.keyCode}
                                className={`p-3 rounded-lg border ${
                                  result.status === 'available'
                                    ? 'bg-green-50 border-green-200'
                                    : result.status === 'timeout'
                                    ? 'bg-amber-50 border-amber-200'
                                    : 'bg-red-50 border-red-200'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <code className="font-mono font-bold">{result.keyCode}</code>
                                    <Badge
                                      variant="secondary"
                                      className={
                                        result.status === 'available'
                                          ? 'bg-green-500 text-white'
                                          : result.status === 'timeout'
                                          ? 'bg-amber-500 text-white'
                                          : 'bg-red-500 text-white'
                                      }
                                    >
                                      {result.status}
                                    </Badge>
                                    {result.recordCount > 0 && (
                                      <span className="text-xs text-green-700">
                                        {result.recordCount} registros
                                      </span>
                                    )}
                                    {result.elapsedTime && (
                                      <span className="text-xs text-neutral-500">
                                        {(result.elapsedTime / 1000).toFixed(1)}s
                                      </span>
                                    )}
                                  </div>
                                  {result.status === 'available' ? (
                                    <CheckCircle className="w-4 h-4 text-green-600" />
                                  ) : (
                                    <XCircle className="w-4 h-4 text-neutral-400" />
                                  )}
                                </div>
                                {result.message && (
                                  <div className="text-xs text-neutral-600 mt-2">
                                    {result.message}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </details>
                      </div>
                    )}

                    {!timeoutCodesResult.success && timeoutCodesResult.error && (
                      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                        <div className="font-medium text-red-900 mb-1">Error</div>
                        <div className="text-sm text-red-800 font-mono whitespace-pre-wrap break-words">
                          {timeoutCodesResult.error}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {h03117Result && (
                  <div className="space-y-4 pt-6 border-t">
                    <h3 className="font-semibold">Resultados del Diagnóstico H03117</h3>

                    <div className="grid grid-cols-4 gap-4">
                      <div className="p-3 bg-neutral-50 rounded-lg">
                        <div className="text-xs text-neutral-500 mb-1">Pruebas</div>
                        <div className="text-lg font-bold text-neutral-900">
                          {h03117Result.summary?.total_tests || 0}
                        </div>
                      </div>

                      <div className="p-3 bg-green-50 rounded-lg">
                        <div className="text-xs text-neutral-500 mb-1">Exitosas</div>
                        <div className="text-lg font-bold text-green-600">
                          {h03117Result.summary?.successful || 0}
                        </div>
                      </div>

                      <div className="p-3 bg-red-50 rounded-lg">
                        <div className="text-xs text-neutral-500 mb-1">Errores</div>
                        <div className="text-lg font-bold text-red-600">
                          {h03117Result.summary?.errors || 0}
                        </div>
                      </div>

                      <div className="p-3 bg-amber-50 rounded-lg">
                        <div className="text-xs text-neutral-500 mb-1">Excepciones</div>
                        <div className="text-lg font-bold text-amber-600">
                          {h03117Result.summary?.exceptions || 0}
                        </div>
                      </div>
                    </div>

                    {h03117Result.results && (
                      <div className="space-y-3">
                        <h4 className="font-medium text-sm text-neutral-700">Detalle de Pruebas</h4>
                        {h03117Result.results.map((result: any, index: number) => (
                          <div
                            key={index}
                            className={`p-4 rounded-lg border ${
                              result.status === 'success'
                                ? 'bg-green-50 border-green-200'
                                : result.status === 'error'
                                ? 'bg-red-50 border-red-200'
                                : 'bg-amber-50 border-amber-200'
                            }`}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-3">
                                <div className="font-semibold text-neutral-900">{result.test}</div>
                                <Badge
                                  variant="secondary"
                                  className={
                                    result.status === 'success'
                                      ? 'bg-green-500 text-white'
                                      : result.status === 'error'
                                      ? 'bg-red-500 text-white'
                                      : 'bg-amber-500 text-white'
                                  }
                                >
                                  {result.status}
                                </Badge>
                                {result.recordCount > 0 && (
                                  <span className="text-xs text-green-700 font-medium">
                                    {result.recordCount} registros
                                  </span>
                                )}
                              </div>
                              {result.status === 'success' ? (
                                <CheckCircle className="w-5 h-5 text-green-600" />
                              ) : (
                                <XCircle className="w-5 h-5 text-red-600" />
                              )}
                            </div>

                            {result.error && (
                              <div className="mb-2">
                                <div className="text-xs font-medium text-neutral-600 mb-1">Error:</div>
                                <div className="text-sm text-red-800 font-mono bg-red-100 p-2 rounded">
                                  {result.error}
                                </div>
                              </div>
                            )}

                            {result.conditions && (
                              <div className="text-xs text-neutral-600 mt-2">
                                <strong>Condiciones:</strong> {result.conditions}
                              </div>
                            )}

                            {result.fieldsRequested && (
                              <div className="text-xs text-neutral-600 mt-1">
                                <strong>Campos:</strong> {result.fieldsRequested}
                              </div>
                            )}

                            {result.response && (
                              <details className="mt-3">
                                <summary className="text-xs cursor-pointer text-accent hover:text-blue-700">
                                  Ver respuesta completa
                                </summary>
                                <pre className="mt-2 p-3 bg-white rounded text-xs overflow-x-auto max-h-60">
                                  {JSON.stringify(result.response, null, 2)}
                                </pre>
                              </details>
                            )}

                            {result.fullError && (
                              <details className="mt-3">
                                <summary className="text-xs cursor-pointer text-red-600 hover:text-red-700">
                                  Ver error completo
                                </summary>
                                <pre className="mt-2 p-3 bg-red-100 rounded text-xs overflow-x-auto">
                                  {result.fullError}
                                </pre>
                              </details>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {!h03117Result.success && h03117Result.error && (
                      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                        <div className="font-medium text-red-900 mb-1">Error General</div>
                        <div className="text-sm text-red-800 font-mono whitespace-pre-wrap break-words">
                          {h03117Result.error}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FlaskConical className="w-5 h-5" />
                  Probar Código Manual
                </CardTitle>
                <CardDescription>
                  Si conoces un código específico de reporte, pruébalo aquí directamente
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div className="space-y-2 text-sm text-amber-900">
                      <p className="font-medium">Códigos de Reporte</p>
                      <p>
                        Los códigos de reporte son específicos de cada instalación SICAS.
                        Si tienes documentación de tu proveedor SICAS o conoces códigos específicos,
                        ingrésalos aquí para probarlos.
                      </p>
                      <p className="text-xs text-amber-700 font-mono mt-2">
                        Ejemplos: H05106, POL001, PROD2025, etc.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="manual-code">Código de Reporte</Label>
                    <Input
                      id="manual-code"
                      placeholder="Ej: H05106"
                      className="font-mono uppercase"
                      onChange={(e) => {
                        const input = e.target as HTMLInputElement;
                        input.value = input.value.toUpperCase();
                      }}
                    />
                    <p className="text-xs text-neutral-500">
                      Ingresa el código exacto como aparece en la documentación
                    </p>
                  </div>

                  <div className="flex items-end">
                    <Button
                      onClick={async () => {
                        const input = document.getElementById('manual-code') as HTMLInputElement;
                        const code = input?.value?.trim();

                        if (!code) {
                          setMessage({ type: 'error', text: 'Ingresa un código de reporte' });
                          return;
                        }

                        setTestingReportCodes(true);
                        setReportCodesResult(null);
                        setMessage(null);

                        try {
                          const { data, error } = await supabase.functions.invoke('sicas-test-available-reports', {
                            body: { manualCodes: [code] }
                          });

                          if (error) throw error;

                          setReportCodesResult(data);

                          if (data.success && data.summary.available > 0) {
                            setMessage({
                              type: 'success',
                              text: `Código ${code} encontrado y disponible`
                            });
                          } else {
                            setMessage({
                              type: 'error',
                              text: `Código ${code} no encontrado o no disponible en tu instalación SICAS`
                            });
                          }
                        } catch (error: any) {
                          setMessage({ type: 'error', text: `Error: ${error.message}` });
                        } finally {
                          setTestingReportCodes(false);
                        }
                      }}
                      disabled={testingReportCodes}
                      className="w-full"
                    >
                      {testingReportCodes ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Probando...
                        </>
                      ) : (
                        <>
                          <FlaskConical className="w-4 h-4 mr-2" />
                          Probar Código
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Section>
        </TabsContent>
      </Tabs>
    </Container>
  );
}
