import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  FileText, DollarSign, Calendar, AlertCircle, Download,
  RefreshCw, Filter, FolderOpen, ChevronDown, ChevronUp,
  TrendingUp, Clock, CheckCircle, Loader2, Database
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Container } from '../components/ui/container';
import { PageHeader } from '../components/ui/page-header';
import {
  getMyDocuments,
  getMyCommissions,
  getMyReceivables,
  getDocumentsPendingRenewal,
  getDigitalFiles,
  syncDocuments,
  syncCommissions,
  syncReceivables,
  getLastSyncRun,
  formatCurrency,
  formatDate,
  getDaysUntilRenewal,
  type SicasDocument,
  type SicasCommission,
  type SicasReceivable,
  type SicasDigitalFile,
} from '../lib/sicasMirrorUtils';
import { tienePermisoAdminEnModulo, MODULOS } from '../lib/permisosUtils';
import { supabase } from '../lib/supabase';

export default function MiProduccionSICASMirror() {
  const { usuario } = useAuth();

  // Verificar si el usuario tiene permisos de admin en SICAS
  const puedeAdministrarSicas = usuario ? tienePermisoAdminEnModulo(usuario, MODULOS.SICAS) : false;
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState('polizas');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [documents, setDocuments] = useState<SicasDocument[]>([]);
  const [commissionsPendientes, setCommissionsPendientes] = useState<SicasCommission[]>([]);
  const [commissionsPagadas, setCommissionsPagadas] = useState<SicasCommission[]>([]);
  const [receivables, setReceivables] = useState<SicasReceivable[]>([]);
  const [renewals, setRenewals] = useState<SicasDocument[]>([]);

  const [expandedDocument, setExpandedDocument] = useState<string | null>(null);
  const [digitalFiles, setDigitalFiles] = useState<Record<string, SicasDigitalFile[]>>({});
  const [loadingFiles, setLoadingFiles] = useState<Record<string, boolean>>({});

  const [lastSync, setLastSync] = useState<string | null>(null);

  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    searchText: '',
    compania: '',
    ramo: '',
    diasRenovacion: 30,
  });

  useEffect(() => {
    if (usuario) {
      loadAllData();
    }
  }, [usuario]);

  async function loadAllData() {
    if (!usuario) {
      console.log('[MiProduccionSICASMirror] Usuario no disponible, esperando...');
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      console.log('[MiProduccionSICASMirror] Cargando datos...');

      const [docs, comPend, comPag, recv, renew, lastRun] = await Promise.all([
        getMyDocuments().catch(err => { console.error('Error docs:', err); return []; }),
        getMyCommissions('pendiente').catch(err => { console.error('Error com pend:', err); return []; }),
        getMyCommissions('pagada').catch(err => { console.error('Error com pag:', err); return []; }),
        getMyReceivables().catch(err => { console.error('Error recv:', err); return []; }),
        getDocumentsPendingRenewal(filters.diasRenovacion).catch(err => { console.error('Error renew:', err); return []; }),
        getLastSyncRun('documents').catch(err => { console.error('Error last run:', err); return null; }),
      ]);

      setDocuments(docs);
      setCommissionsPendientes(comPend);
      setCommissionsPagadas(comPag);
      setReceivables(recv);
      setRenewals(renew);

      if (lastRun) {
        setLastSync(lastRun.finished_at || lastRun.started_at);
      }

      console.log('[MiProduccionSICASMirror] Datos cargados:', {
        docs: docs.length,
        comPend: comPend.length,
        comPag: comPag.length,
        recv: recv.length,
        renew: renew.length,
      });
    } catch (error) {
      console.error('[MiProduccionSICASMirror] Error loading data:', error);
      setMessage({ type: 'error', text: `Error cargando datos: ${error}` });
    } finally {
      setLoading(false);
    }
  }

  async function handleManualSync() {
    setSyncing(true);
    setMessage(null);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const token = (await supabase.auth.getSession()).data.session?.access_token;

      // Usar consulta SQL directa (método más compatible)
      const response = await fetch(`${supabaseUrl}/functions/v1/sicas-sync-basic`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (result.success && result.stats) {
        const method = result.stats.method ? ` (${result.stats.method})` : '';
        setMessage({
          type: 'success',
          text: `Sincronización exitosa: ${result.stats.records_inserted || 0} pólizas actualizadas${method}`,
        });
        await loadAllData();
      } else {
        setMessage({
          type: 'error',
          text: `Error en sincronización: ${result.error || 'Sin datos disponibles'}`
        });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: `Error: ${error.message}` });
    } finally {
      setSyncing(false);
    }
  }

  async function handleLoadDigitalFiles(idDocto: string) {
    if (digitalFiles[idDocto]) {
      setExpandedDocument(expandedDocument === idDocto ? null : idDocto);
      return;
    }

    setLoadingFiles({ ...loadingFiles, [idDocto]: true });

    try {
      const result = await getDigitalFiles(idDocto);
      if (result.success) {
        setDigitalFiles({ ...digitalFiles, [idDocto]: result.files });
        setExpandedDocument(idDocto);
      } else {
        setMessage({ type: 'error', text: `Error cargando archivos: ${result.error}` });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: `Error: ${error.message}` });
    } finally {
      setLoadingFiles({ ...loadingFiles, [idDocto]: false });
    }
  }

  const filteredDocuments = documents.filter(doc => {
    if (filters.searchText) {
      const search = filters.searchText.toLowerCase();
      if (
        !doc.poliza?.toLowerCase().includes(search) &&
        !doc.cliente?.toLowerCase().includes(search) &&
        !doc.id_docto?.toLowerCase().includes(search)
      ) {
        return false;
      }
    }
    if (filters.compania && doc.compania !== filters.compania) return false;
    if (filters.ramo && doc.ramo !== filters.ramo) return false;
    return true;
  });

  const filteredRenewals = renewals.filter(doc => {
    const days = getDaysUntilRenewal(doc.vigencia_hasta);
    return days !== null && days <= filters.diasRenovacion;
  });

  const totalPrimaNeta = filteredDocuments.reduce((sum, doc) => sum + (doc.prima_neta || 0), 0);
  const totalCobranzaPendiente = receivables.reduce((sum, r) => sum + (r.importe_pendiente || 0), 0);
  const totalComisionesPendientes = commissionsPendientes.reduce((sum, c) => sum + (c.neto_pagar || 0), 0);

  if (loading) {
    return (
      <Container>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Container>
    );
  }

  return (
    <Container>
      <PageHeader
        title="Mi Producción SICAS"
        description="Consulta tu producción, comisiones y cobranza desde la base de datos espejo"
        actions={
          <div className="flex gap-2">
            <Button onClick={() => setShowFilters(!showFilters)} variant="outline">
              <Filter className="w-4 h-4 mr-2" />
              Filtros
            </Button>
            <Button onClick={() => loadAllData()} disabled={syncing} variant="outline">
              {syncing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Recargar Datos
            </Button>
            {puedeAdministrarSicas && (
              <Button onClick={() => handleManualSync()} disabled={syncing}>
                {syncing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Database className="w-4 h-4 mr-2" />
                )}
                Sincronizar desde SICAS
              </Button>
            )}
          </div>
        }
      />

      <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-2">
          <Database className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-blue-900 font-medium">
              Base de datos espejo SICAS
            </p>
            <p className="text-xs text-blue-700 mt-1">
              {documents.length === 0 ? (
                <span className="font-medium">
                  No hay pólizas sincronizadas. Use el botón "Sincronizar desde SICAS" para obtener datos.
                </span>
              ) : (
                <>
                  Mostrando {documents.length} pólizas vigentes.
                  {lastSync && ` Última sincronización: ${formatDate(lastSync)}`}
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      {message && (
        <div className={`p-4 mb-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          {message.text}
        </div>
      )}

      {showFilters && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Input
                placeholder="Buscar por póliza, cliente o ID"
                value={filters.searchText}
                onChange={(e) => setFilters({ ...filters, searchText: e.target.value })}
              />
              <Input
                placeholder="Compañía"
                value={filters.compania}
                onChange={(e) => setFilters({ ...filters, compania: e.target.value })}
              />
              <Input
                placeholder="Ramo"
                value={filters.ramo}
                onChange={(e) => setFilters({ ...filters, ramo: e.target.value })}
              />
              <Input
                type="number"
                placeholder="Días para renovación"
                value={filters.diasRenovacion}
                onChange={(e) => setFilters({ ...filters, diasRenovacion: parseInt(e.target.value) || 30 })}
              />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Pólizas Vigentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredDocuments.length}</div>
            <div className="text-sm text-gray-600">Prima Total: {formatCurrency(totalPrimaNeta)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Renovaciones Próximas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredRenewals.length}</div>
            <div className="text-sm text-gray-600">Próximos {filters.diasRenovacion} días</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Cobranza Pendiente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{receivables.length}</div>
            <div className="text-sm text-gray-600">{formatCurrency(totalCobranzaPendiente)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Comisiones Pendientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{commissionsPendientes.length}</div>
            <div className="text-sm text-gray-600">{formatCurrency(totalComisionesPendientes)}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="polizas">
            <FileText className="w-4 h-4 mr-2" />
            Pólizas Vigentes
          </TabsTrigger>
          <TabsTrigger value="renovaciones">
            <Calendar className="w-4 h-4 mr-2" />
            Renovaciones
          </TabsTrigger>
          <TabsTrigger value="cobranza">
            <DollarSign className="w-4 h-4 mr-2" />
            Cobranza
          </TabsTrigger>
          <TabsTrigger value="comisiones">
            <TrendingUp className="w-4 h-4 mr-2" />
            Comisiones
          </TabsTrigger>
        </TabsList>

        <TabsContent value="polizas">
          <Card>
            <CardHeader>
              <CardTitle>Pólizas Vigentes ({filteredDocuments.length})</CardTitle>
              <CardDescription>Documentos sincronizados desde SICAS</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredDocuments.map((doc) => (
                  <div key={doc.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="font-semibold">{doc.poliza || doc.id_docto}</div>
                        <div className="text-sm text-gray-600">
                          {doc.cliente} | {doc.compania}
                        </div>
                        <div className="text-sm text-gray-500 mt-1">
                          Ramo: {doc.ramo} | Vigencia: {formatDate(doc.vigencia_desde)} - {formatDate(doc.vigencia_hasta)}
                        </div>
                        <div className="text-sm font-semibold mt-1">
                          Prima: {formatCurrency(doc.prima_neta)}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleLoadDigitalFiles(doc.id_docto)}
                        disabled={loadingFiles[doc.id_docto]}
                      >
                        {loadingFiles[doc.id_docto] ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : expandedDocument === doc.id_docto ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <>
                            <FolderOpen className="w-4 h-4 mr-2" />
                            Centro Digital
                          </>
                        )}
                      </Button>
                    </div>

                    {expandedDocument === doc.id_docto && digitalFiles[doc.id_docto] && (
                      <div className="mt-4 pt-4 border-t">
                        <div className="text-sm font-semibold mb-2">Archivos en Centro Digital:</div>
                        {digitalFiles[doc.id_docto].length === 0 ? (
                          <div className="text-sm text-gray-500">No hay archivos disponibles</div>
                        ) : (
                          <div className="space-y-2">
                            {digitalFiles[doc.id_docto].map((file, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-sm">
                                <FileText className="w-4 h-4" />
                                <span>{file.FileName}{file.FileExtension}</span>
                                {file.DocumentDate && (
                                  <span className="text-gray-500">({formatDate(file.DocumentDate)})</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="renovaciones">
          <Card>
            <CardHeader>
              <CardTitle>Renovaciones Próximas ({filteredRenewals.length})</CardTitle>
              <CardDescription>Pólizas que vencen en los próximos {filters.diasRenovacion} días</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredRenewals.map((doc) => {
                  const days = getDaysUntilRenewal(doc.vigencia_hasta);
                  return (
                    <div key={doc.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="font-semibold">{doc.poliza || doc.id_docto}</div>
                          <div className="text-sm text-gray-600">
                            {doc.cliente} | {doc.compania}
                          </div>
                          <div className="text-sm text-gray-500 mt-1">
                            Vence: {formatDate(doc.vigencia_hasta)}
                          </div>
                        </div>
                        <Badge variant={days && days <= 7 ? 'destructive' : days && days <= 15 ? 'default' : 'secondary'}>
                          {days} días
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cobranza">
          <Card>
            <CardHeader>
              <CardTitle>Cobranza Pendiente ({receivables.length})</CardTitle>
              <CardDescription>Total: {formatCurrency(totalCobranzaPendiente)}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {receivables.map((r) => (
                  <div key={r.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="font-semibold">{r.poliza || r.id_docto}</div>
                        <div className="text-sm text-gray-600">{r.cliente}</div>
                        <div className="text-sm text-gray-500 mt-1">
                          Límite: {formatDate(r.fecha_limite)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{formatCurrency(r.importe_pendiente)}</div>
                        {r.dias_vencido && r.dias_vencido > 0 && (
                          <Badge variant="destructive">{r.dias_vencido} días vencido</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comisiones">
          <Tabs defaultValue="pendientes">
            <TabsList>
              <TabsTrigger value="pendientes">Pendientes ({commissionsPendientes.length})</TabsTrigger>
              <TabsTrigger value="pagadas">Pagadas ({commissionsPagadas.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="pendientes">
              <Card>
                <CardHeader>
                  <CardTitle>Comisiones Pendientes</CardTitle>
                  <CardDescription>Total: {formatCurrency(totalComisionesPendientes)}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {commissionsPendientes.map((c) => (
                      <div key={c.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="font-semibold">{c.documento_poliza}</div>
                            <div className="text-sm text-gray-600">
                              Periodo: {c.period_key}
                            </div>
                            <div className="text-sm text-gray-500 mt-1">
                              Base: {formatCurrency(c.base_comision)} | Comisión: {formatCurrency(c.comision)}
                            </div>
                            <div className="text-sm text-gray-500">
                              ISR: {formatCurrency(c.isr)} | IVA: {formatCurrency(c.iva)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-green-600">
                              {formatCurrency(c.neto_pagar)}
                            </div>
                            <div className="text-xs text-gray-500">Neto a pagar</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="pagadas">
              <Card>
                <CardHeader>
                  <CardTitle>Comisiones Pagadas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {commissionsPagadas.map((c) => (
                      <div key={c.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="font-semibold">{c.documento_poliza}</div>
                            <div className="text-sm text-gray-600">
                              Periodo: {c.period_key}
                            </div>
                            <div className="text-sm text-gray-500 mt-1">
                              Pagado: {formatDate(c.fecha_pago)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold">{formatCurrency(c.neto_pagar)}</div>
                            <Badge variant="secondary">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Pagado
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
    </Container>
  );
}
