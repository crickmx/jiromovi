import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  FileText, DollarSign, Calendar, AlertCircle, Download,
  RefreshCw, Filter, ChevronDown, ChevronUp,
  TrendingUp, Clock, CheckCircle, Loader2, Database,
  Users, Link2, Link2Off, Shield, MapPin, Activity,
  Search, X, AlertTriangle, BarChart2, Eye
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Container } from '../components/ui/container';
import { PageHeader } from '../components/ui/page-header';
import { supabase } from '../lib/supabase';
import { tienePermisoAdminEnModulo, MODULOS } from '../lib/permisosUtils';
import {
  getMyDocuments, getDocumentsPendingRenewal, getLastSyncRun,
  formatCurrency, formatDate, getDaysUntilRenewal,
  type SicasDocument,
} from '../lib/sicasMirrorUtils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CoverageStats {
  total_docs: number;
  docs_with_user: number;
  docs_without_user: number;
  coverage_pct: number;
  total_vigentes: number;
  vigentes_with_user: number;
  vigentes_without_user: number;
  prima_total: number;
  prima_asignada: number;
  prima_sin_asignar: number;
  prima_coverage_pct: number;
  unique_vendors: number;
  last_sync: string | null;
  total_vendor_mappings: number;
  active_vendor_mappings: number;
  pending_vendor_mappings: number;
}

interface GlobalSummary {
  total_docs: number;
  total_vigentes: number;
  total_canceladas: number;
  total_vencidas: number;
  prima_total: number;
  prima_vigente: number;
  renovaciones_60d: number;
  renovaciones_30d: number;
  unique_vendors: number;
  unique_aseguradoras: number;
  unique_ramos: number;
  unique_clientes: number;
  docs_with_user: number;
  docs_without_user: number;
}

interface UnmappedVendor {
  vend_id: string;
  vend_nombre: string;
  desp_nombre: string | null;
  total_docs: number;
  vigentes: number;
  prima_neta: number;
  prima_vigente: number;
  ultimo_documento: string | null;
  suggested_user_id: string | null;
  suggested_user_name: string | null;
  mapping_status: string;
}

interface SyncJob {
  id: string;
  mode: string;
  sync_type: string | null;
  status: string;
  keycode: string | null;
  total_in_sicas: number | null;
  total_pages: number | null;
  current_page: number | null;
  total_synced: number | null;
  total_errors: number | null;
  percent: number | null;
  started_at: string;
  finished_at: string | null;
  updated_at: string;
  post_sync_done: boolean | null;
  docs_mapped_in_post_sync: number | null;
}

interface UserOption { id: string; nombre: string; apellidos: string; email_laboral: string; }

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtNum(n: number | null | undefined): string {
  return (n ?? 0).toLocaleString('es-MX');
}

function fmtPct(n: number | null | undefined): string {
  return `${(n ?? 0).toFixed(1)}%`;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed: 'bg-green-100 text-green-700 border-green-200',
    running: 'bg-blue-100 text-blue-700 border-blue-200',
    failed: 'bg-red-100 text-red-700 border-red-200',
    queued: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    partial_response: 'bg-orange-100 text-orange-700 border-orange-200',
    empty: 'bg-gray-100 text-gray-600 border-gray-200',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border font-medium ${map[status] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
      {status}
    </span>
  );
}

function CoverageBar({ pct, color = 'bg-teal-500' }: { pct: number; color?: string }) {
  return (
    <div className="w-full bg-gray-100 rounded-full h-2">
      <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MiProduccionSICASMirror() {
  const { usuario } = useAuth();
  const isAdmin = usuario ? tienePermisoAdminEnModulo(usuario, MODULOS.SICAS) : false;
  const isGerente = usuario?.rol === 'Gerente' || usuario?.rol === 'Administrador';

  const [activeTab, setActiveTab] = useState('produccion');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Mi produccion (agente)
  const [myDocs, setMyDocs] = useState<SicasDocument[]>([]);
  const [myRenewals, setMyRenewals] = useState<SicasDocument[]>([]);
  const [lastSync, setLastSync] = useState<string | null>(null);

  // Admin/global data
  const [coverage, setCoverage] = useState<CoverageStats | null>(null);
  const [globalSummary, setGlobalSummary] = useState<GlobalSummary | null>(null);
  const [unmappedVendors, setUnmappedVendors] = useState<UnmappedVendor[]>([]);
  const [unmappedTotal, setUnmappedTotal] = useState(0);
  const [syncJobs, setSyncJobs] = useState<SyncJob[]>([]);

  // Filters
  const [docSearch, setDocSearch] = useState('');
  const [docRamo, setDocRamo] = useState('');
  const [docCompania, setDocCompania] = useState('');
  const [diasRen, setDiasRen] = useState(60);
  const [vendorSearch, setVendorSearch] = useState('');
  const [vendorPage, setVendorPage] = useState(0);

  // Mapping modal
  const [mappingVendor, setMappingVendor] = useState<UnmappedVendor | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [userOptions, setUserOptions] = useState<UserOption[]>([]);
  const [mappingLoading, setMappingLoading] = useState(false);

  // ── Load data ──────────────────────────────────────────────────────────────

  const loadMyData = useCallback(async () => {
    if (!usuario) return;
    const [docs, renew, lastRun] = await Promise.all([
      getMyDocuments().catch(() => []),
      getDocumentsPendingRenewal(diasRen).catch(() => []),
      getLastSyncRun('documents').catch(() => null),
    ]);
    setMyDocs(docs);
    setMyRenewals(renew);
    if (lastRun) setLastSync(lastRun.finished_at || lastRun.started_at);
  }, [usuario, diasRen]);

  const loadAdminData = useCallback(async () => {
    if (!isGerente) return;

    const [covRes, sumRes, vendRes, jobsRes] = await Promise.all([
      supabase.rpc('get_sicas_coverage_stats'),
      supabase.rpc('get_sicas_global_summary', {}),
      supabase.rpc('get_sicas_vendors_unmapped', { p_limit: 50, p_offset: vendorPage * 50, p_search: vendorSearch || null }),
      supabase.from('sicas_sync_jobs').select('*').order('started_at', { ascending: false }).limit(20),
    ]);

    if (covRes.data) setCoverage(covRes.data as CoverageStats);
    if (sumRes.data) setGlobalSummary(sumRes.data as GlobalSummary);

    if (vendRes.data) {
      setUnmappedVendors(vendRes.data as UnmappedVendor[]);
    }

    // Count unmapped vendors
    const { count } = await supabase.from('sicas_documents')
      .select('vend_id', { count: 'exact', head: true })
      .is('usuario_id', null)
      .not('vend_id', 'is', null);
    setUnmappedTotal(count || 0);

    if (jobsRes.data) setSyncJobs(jobsRes.data as SyncJob[]);
  }, [isGerente, vendorPage, vendorSearch]);

  useEffect(() => {
    if (!usuario) return;
    setLoading(true);
    Promise.all([loadMyData(), loadAdminData()]).finally(() => setLoading(false));
  }, [usuario, loadMyData, loadAdminData]);

  // ── Sync trigger ────────────────────────────────────────────────────────────

  async function handleSync(mode: 'full' | 'incremental' = 'full') {
    setSyncing(true);
    setMsg(null);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sicas-bulk-sync`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', mode }),
      });
      const result = await res.json();
      if (result.ok || result.jobId) {
        setMsg({ type: 'success', text: `Sincronizacion ${mode} iniciada. Job: ${result.jobId || 'en progreso'}` });
        setTimeout(() => loadAdminData(), 3000);
      } else {
        setMsg({ type: 'error', text: result.error || result.message || 'Error al iniciar sincronizacion' });
      }
    } catch (e: any) {
      setMsg({ type: 'error', text: `Error: ${e.message}` });
    } finally {
      setSyncing(false);
    }
  }

  async function handlePostSyncMapping() {
    setSyncing(true);
    setMsg(null);
    try {
      const { data, error } = await supabase.rpc('run_post_sync_mapping', {});
      if (error) throw error;
      const r = data as any;
      setMsg({ type: 'success', text: `Mapeo post-sync: ${r.docs_mapped} documentos asignados, ${r.vendors_updated} vendedores actualizados` });
      await Promise.all([loadMyData(), loadAdminData()]);
    } catch (e: any) {
      setMsg({ type: 'error', text: `Error en mapeo: ${e.message}` });
    } finally {
      setSyncing(false);
    }
  }

  // ── User search for mapping ─────────────────────────────────────────────────

  async function searchUsers(q: string) {
    if (!q.trim()) { setUserOptions([]); return; }
    const { data } = await supabase
      .from('usuarios')
      .select('id, nombre, apellidos, email_laboral')
      .or(`nombre.ilike.%${q}%,apellidos.ilike.%${q}%,email_laboral.ilike.%${q}%`)
      .eq('activo', true)
      .limit(10);
    setUserOptions((data || []) as UserOption[]);
  }

  async function applyMapping(vendor: UnmappedVendor, userId: string) {
    setMappingLoading(true);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sicas-map-vendors`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'manual_link', vend_id: vendor.vend_id, user_id: userId }),
      });
      const result = await res.json();
      if (result.success) {
        setMsg({ type: 'success', text: `Vendedor "${vendor.vend_nombre}" vinculado correctamente` });
        setMappingVendor(null);
        await loadAdminData();
      } else {
        setMsg({ type: 'error', text: result.error || 'Error al vincular' });
      }
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message });
    } finally {
      setMappingLoading(false);
    }
  }

  // ── Filtered docs ───────────────────────────────────────────────────────────

  const filteredDocs = myDocs.filter(d => {
    if (docSearch) {
      const s = docSearch.toLowerCase();
      if (!d.poliza?.toLowerCase().includes(s) && !d.cliente?.toLowerCase().includes(s) && !d.id_docto?.toLowerCase().includes(s)) return false;
    }
    if (docRamo && d.ramo !== docRamo) return false;
    if (docCompania && d.compania !== docCompania) return false;
    return true;
  });

  const filteredRenewals = myRenewals.filter(d => {
    const days = getDaysUntilRenewal(d.vigencia_hasta);
    return days !== null && days <= diasRen;
  });

  const totalPrima = filteredDocs.reduce((s, d) => s + (d.prima_neta || 0), 0);
  const uniqueRamos = [...new Set(myDocs.map(d => d.ramo).filter(Boolean))];
  const uniqueCompanias = [...new Set(myDocs.map(d => d.compania).filter(Boolean))];

  // ─── Render helpers ──────────────────────────────────────────────────────────

  function renderNoMapping() {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mb-4">
          <Link2Off className="w-8 h-8 text-amber-500" />
        </div>
        <h3 className="text-base font-semibold text-gray-800 mb-2">Sin produccion SICAS vinculada</h3>
        <p className="text-sm text-gray-500 max-w-sm">
          No hay produccion SICAS vinculada a tu usuario. Contacta al administrador para mapear tu vendedor SICAS.
        </p>
      </div>
    );
  }

  function renderCoverageAlert() {
    if (!coverage || !isAdmin) return null;
    const pct = coverage.coverage_pct;
    if (pct >= 80) return null;
    return (
      <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-3">
        <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-amber-800">
          Solo el <strong>{fmtPct(pct)}</strong> de documentos tiene usuario asignado.
          Revisa el mapeo de vendedores para habilitar Mi Produccion por agente.
        </p>
        <button onClick={() => setActiveTab('vendedores')} className="ml-auto text-xs text-amber-700 underline whitespace-nowrap">
          Ir al mapeo
        </button>
      </div>
    );
  }

  // ─── Loading state ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Container>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-teal-600 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Cargando datos locales SICAS...</p>
          </div>
        </div>
      </Container>
    );
  }

  // ─── Main render ──────────────────────────────────────────────────────────────

  const tabs = [
    { id: 'produccion', label: 'Mi Produccion', icon: FileText },
    { id: 'renovaciones', label: 'Renovaciones', icon: Calendar, badge: filteredRenewals.length > 0 ? filteredRenewals.length : null },
    ...(isGerente ? [
      { id: 'global', label: 'Produccion Global', icon: BarChart2 },
      { id: 'sin-mapear', label: 'Sin Mapear', icon: AlertCircle, badge: coverage?.docs_without_user ?? null },
      { id: 'vendedores', label: 'Vendedores', icon: Users },
      { id: 'salud', label: 'Salud SICAS', icon: Activity },
    ] : []),
  ];

  return (
    <Container>
      <PageHeader
        title="Mi Produccion SICAS"
        description={lastSync ? `Base local actualizada: ${formatDate(lastSync)}` : 'Produccion desde base de datos local SICAS'}
        actions={
          <div className="flex gap-2 items-center">
            <button
              onClick={() => { setLoading(true); Promise.all([loadMyData(), loadAdminData()]).finally(() => setLoading(false)); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Recargar
            </button>
            {isAdmin && (
              <>
                <button
                  onClick={handlePostSyncMapping}
                  disabled={syncing}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-teal-200 text-teal-700 hover:bg-teal-50 transition-colors disabled:opacity-50"
                >
                  <Link2 className="w-3.5 h-3.5" /> Aplicar Mapeo
                </button>
                <button
                  onClick={() => handleSync('full')}
                  disabled={syncing}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-teal-600 text-white hover:bg-teal-700 transition-colors disabled:opacity-50"
                >
                  {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
                  Sincronizar
                </button>
              </>
            )}
          </div>
        }
      />

      {msg && (
        <div className={`mb-4 p-3 rounded-lg flex items-start gap-2 text-sm ${msg.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {msg.type === 'success' ? <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
          <span className="flex-1">{msg.text}</span>
          <button onClick={() => setMsg(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      {renderCoverageAlert()}

      {/* Tab nav */}
      <div className="flex gap-1 mb-6 border-b border-gray-200 overflow-x-auto">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-teal-600 text-teal-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {(tab as any).badge != null && (tab as any).badge > 0 && (
                <span className="bg-teal-100 text-teal-700 text-xs px-1.5 py-0.5 rounded-full font-semibold">
                  {fmtNum((tab as any).badge)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── TAB: Mi Produccion ─────────────────────────────────────────────── */}
      {activeTab === 'produccion' && (
        <div>
          {myDocs.length === 0 ? (
            renderNoMapping()
          ) : (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {[
                  { label: 'Polizas vigentes', value: fmtNum(filteredDocs.length), sub: `de ${fmtNum(myDocs.length)} totales`, icon: FileText, color: 'text-teal-600' },
                  { label: 'Prima neta', value: formatCurrency(totalPrima), sub: 'polizas filtradas', icon: DollarSign, color: 'text-blue-600' },
                  { label: 'Renovaciones proximas', value: fmtNum(filteredRenewals.length), sub: `proximos ${diasRen} dias`, icon: Calendar, color: 'text-amber-600' },
                  { label: 'Ramos', value: fmtNum(uniqueRamos.length), sub: `${uniqueCompanias.length} aseguradoras`, icon: Shield, color: 'text-gray-600' },
                ].map(k => (
                  <div key={k.label} className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-start justify-between mb-2">
                      <p className="text-xs text-gray-500 font-medium">{k.label}</p>
                      <k.icon className={`w-4 h-4 ${k.color}`} />
                    </div>
                    <p className="text-xl font-bold text-gray-900">{k.value}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{k.sub}</p>
                  </div>
                ))}
              </div>

              {/* Filters */}
              <div className="flex flex-wrap gap-2 mb-4">
                <div className="relative flex-1 min-w-[160px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    value={docSearch} onChange={e => setDocSearch(e.target.value)}
                    placeholder="Buscar poliza, cliente, ID..."
                    className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-teal-400"
                  />
                </div>
                <select value={docRamo} onChange={e => setDocRamo(e.target.value)}
                  className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 outline-none focus:border-teal-400 bg-white">
                  <option value="">Todos los ramos</option>
                  {uniqueRamos.map(r => <option key={r as string} value={r as string}>{r}</option>)}
                </select>
                <select value={docCompania} onChange={e => setDocCompania(e.target.value)}
                  className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 outline-none focus:border-teal-400 bg-white">
                  <option value="">Todas las aseguradoras</option>
                  {uniqueCompanias.map(c => <option key={c as string} value={c as string}>{c}</option>)}
                </select>
                {(docSearch || docRamo || docCompania) && (
                  <button onClick={() => { setDocSearch(''); setDocRamo(''); setDocCompania(''); }}
                    className="flex items-center gap-1 text-xs text-gray-500 px-2 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">
                    <X className="w-3 h-3" /> Limpiar
                  </button>
                )}
              </div>

              {/* Table */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Poliza</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Cliente</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Aseguradora</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Ramo</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Prima Neta</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Vigencia</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredDocs.slice(0, 200).map(doc => (
                        <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs text-gray-700">{doc.poliza || doc.id_docto}</td>
                          <td className="px-4 py-3 text-gray-700 max-w-[180px] truncate">{doc.cliente || '—'}</td>
                          <td className="px-4 py-3 text-gray-600 text-xs">{doc.compania || '—'}</td>
                          <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs">{doc.ramo || '—'}</span></td>
                          <td className="px-4 py-3 text-right font-medium text-gray-800">{formatCurrency(doc.prima_neta || 0)}</td>
                          <td className="px-4 py-3 text-xs text-gray-500">{formatDate(doc.vigencia_hasta)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredDocs.length > 200 && (
                    <p className="text-center text-xs text-gray-400 py-3 border-t border-gray-100">
                      Mostrando 200 de {fmtNum(filteredDocs.length)} registros. Usa los filtros para reducir resultados.
                    </p>
                  )}
                  {filteredDocs.length === 0 && (
                    <div className="text-center py-12 text-gray-400">
                      <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">Sin resultados para los filtros seleccionados</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── TAB: Renovaciones ──────────────────────────────────────────────── */}
      {activeTab === 'renovaciones' && (
        <div>
          <div className="flex items-center gap-4 mb-4">
            <label className="text-sm text-gray-600 flex items-center gap-2">
              Ventana de renovacion:
              <select value={diasRen} onChange={e => setDiasRen(Number(e.target.value))}
                className="text-sm border border-gray-200 rounded-lg px-2 py-1 outline-none focus:border-teal-400 bg-white">
                {[15, 30, 45, 60, 90, 120].map(d => <option key={d} value={d}>{d} dias</option>)}
              </select>
            </label>
            <span className="text-sm text-gray-500">
              {filteredRenewals.length > 0
                ? `${filteredRenewals.length} polizas proximas a vencer`
                : 'Sin renovaciones en este periodo'}
            </span>
          </div>

          {filteredRenewals.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-gray-400">
              <CheckCircle className="w-10 h-10 mb-3 text-green-400" />
              <p className="text-sm font-medium text-gray-600">Sin renovaciones urgentes</p>
              <p className="text-xs text-gray-400 mt-1">No hay polizas que venzan en los proximos {diasRen} dias</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Poliza</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Cliente</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Aseguradora / Ramo</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Prima</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Vence</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Dias restantes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredRenewals.slice(0, 200).map(doc => {
                      const days = getDaysUntilRenewal(doc.vigencia_hasta) ?? 0;
                      const urgency = days <= 15 ? 'text-red-600 bg-red-50' : days <= 30 ? 'text-amber-600 bg-amber-50' : 'text-blue-600 bg-blue-50';
                      return (
                        <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs text-gray-700">{doc.poliza || doc.id_docto}</td>
                          <td className="px-4 py-3 text-gray-700 max-w-[160px] truncate">{doc.cliente || '—'}</td>
                          <td className="px-4 py-3 text-xs text-gray-500">{doc.compania} · {doc.ramo}</td>
                          <td className="px-4 py-3 text-right font-medium text-gray-800">{formatCurrency(doc.prima_neta || 0)}</td>
                          <td className="px-4 py-3 text-xs text-gray-500">{formatDate(doc.vigencia_hasta)}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${urgency}`}>
                              <Clock className="w-3 h-3" /> {days} dias
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Produccion Global (admin/gerente) ──────────────────────────── */}
      {activeTab === 'global' && isGerente && (
        <div>
          {!globalSummary ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-teal-600" /></div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {[
                  { label: 'Total documentos', value: fmtNum(globalSummary.total_docs), icon: Database, color: 'text-gray-600' },
                  { label: 'Polizas vigentes', value: fmtNum(globalSummary.total_vigentes), icon: CheckCircle, color: 'text-teal-600' },
                  { label: 'Prima total', value: formatCurrency(globalSummary.prima_total), icon: DollarSign, color: 'text-blue-600' },
                  { label: 'Prima vigente', value: formatCurrency(globalSummary.prima_vigente), icon: TrendingUp, color: 'text-green-600' },
                  { label: 'Renovaciones 30d', value: fmtNum(globalSummary.renovaciones_30d), icon: Calendar, color: 'text-amber-600' },
                  { label: 'Renovaciones 60d', value: fmtNum(globalSummary.renovaciones_60d), icon: Calendar, color: 'text-orange-600' },
                  { label: 'Vendedores unicos', value: fmtNum(globalSummary.unique_vendors), icon: Users, color: 'text-gray-600' },
                  { label: 'Aseguradoras', value: fmtNum(globalSummary.unique_aseguradoras), icon: Shield, color: 'text-gray-600' },
                ].map(k => (
                  <div key={k.label} className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-start justify-between mb-2">
                      <p className="text-xs text-gray-500 font-medium">{k.label}</p>
                      <k.icon className={`w-4 h-4 ${k.color}`} />
                    </div>
                    <p className="text-xl font-bold text-gray-900">{k.value}</p>
                  </div>
                ))}
              </div>

              {/* Coverage breakdown */}
              {coverage && (
                <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
                  <h3 className="text-sm font-semibold text-gray-800 mb-4">Cobertura de mapeo</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <div className="flex justify-between mb-1.5">
                        <span className="text-xs text-gray-500">Documentos con usuario</span>
                        <span className="text-xs font-semibold text-gray-700">{fmtPct(coverage.coverage_pct)}</span>
                      </div>
                      <CoverageBar pct={coverage.coverage_pct} color="bg-teal-500" />
                      <p className="text-xs text-gray-400 mt-1">{fmtNum(coverage.docs_with_user)} / {fmtNum(coverage.total_docs)}</p>
                    </div>
                    <div>
                      <div className="flex justify-between mb-1.5">
                        <span className="text-xs text-gray-500">Prima neta asignada</span>
                        <span className="text-xs font-semibold text-gray-700">{fmtPct(coverage.prima_coverage_pct)}</span>
                      </div>
                      <CoverageBar pct={coverage.prima_coverage_pct} color="bg-blue-500" />
                      <p className="text-xs text-gray-400 mt-1">{formatCurrency(coverage.prima_asignada)} / {formatCurrency(coverage.prima_total)}</p>
                    </div>
                    <div>
                      <div className="flex justify-between mb-1.5">
                        <span className="text-xs text-gray-500">Vendedores mapeados</span>
                        <span className="text-xs font-semibold text-gray-700">
                          {coverage.total_vendor_mappings > 0
                            ? fmtPct((coverage.active_vendor_mappings / coverage.unique_vendors) * 100)
                            : '0%'}
                        </span>
                      </div>
                      <CoverageBar
                        pct={coverage.total_vendor_mappings > 0 ? (coverage.active_vendor_mappings / coverage.unique_vendors) * 100 : 0}
                        color="bg-amber-500"
                      />
                      <p className="text-xs text-gray-400 mt-1">{fmtNum(coverage.active_vendor_mappings)} activos / {fmtNum(coverage.unique_vendors)} vendedores</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-teal-500" /> Documentos con usuario asignado
                  </h3>
                  <p className="text-2xl font-bold text-gray-900">{fmtNum(globalSummary.docs_with_user)}</p>
                  <p className="text-xs text-gray-400 mt-1">Filtrados en Mi Produccion por agente</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-500" /> Documentos sin usuario asignado
                  </h3>
                  <p className="text-2xl font-bold text-amber-600">{fmtNum(globalSummary.docs_without_user)}</p>
                  <p className="text-xs text-gray-400 mt-1">Requieren mapeo de vendedor para asignar</p>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── TAB: Sin Mapear ───────────────────────────────────────────────── */}
      {activeTab === 'sin-mapear' && isGerente && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-gray-600">
                Documentos con <strong className="text-amber-600">usuario_id = null</strong> en la base local.
                Estos documentos no aparecen en la vista de ningún agente hasta que se mapee su vendedor.
              </p>
            </div>
          </div>

          {/* Quick stats */}
          {coverage && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs text-amber-600 font-medium mb-1">Docs sin usuario</p>
                <p className="text-lg font-bold text-amber-800">{fmtNum(coverage.docs_without_user)}</p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs text-amber-600 font-medium mb-1">Prima sin asignar</p>
                <p className="text-lg font-bold text-amber-800">{formatCurrency(coverage.prima_sin_asignar)}</p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs text-amber-600 font-medium mb-1">Vigentes sin asignar</p>
                <p className="text-lg font-bold text-amber-800">{fmtNum(coverage.vigentes_without_user)}</p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs text-amber-600 font-medium mb-1">Vendedores sin mapear</p>
                <p className="text-lg font-bold text-amber-800">{fmtNum(coverage.pending_vendor_mappings)}</p>
              </div>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm text-blue-800">
            Estos documentos estan guardados localmente y son visibles para admins y gerentes.
            Para habilitar Mi Produccion por agente, vincula cada vendedor a un usuario MOVI en la pestana <strong>Vendedores</strong>.
          </div>

          <p className="text-xs text-gray-400 mb-2">
            Usa la pestana <strong>Vendedores</strong> para mapear vendedores y asignar estos documentos automaticamente.
          </p>
        </div>
      )}

      {/* ── TAB: Vendedores sin mapear ───────────────────────────────────── */}
      {activeTab === 'vendedores' && isGerente && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                value={vendorSearch}
                onChange={e => { setVendorSearch(e.target.value); setVendorPage(0); }}
                placeholder="Buscar vendedor SICAS..."
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-teal-400"
              />
            </div>
            <span className="text-sm text-gray-500 whitespace-nowrap">{fmtNum(unmappedTotal)} vendedores sin mapear</span>
            <button
              onClick={handlePostSyncMapping}
              disabled={syncing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50"
            >
              <Link2 className="w-3.5 h-3.5" /> Auto-mapear
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Vendedor SICAS</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Despacho</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Docs</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Vigentes</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Prima Neta</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Prima Vigente</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Ultimo doc</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Accion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {unmappedVendors.map(v => (
                    <tr key={v.vend_id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800 text-xs">{v.vend_nombre || v.vend_id}</div>
                        <div className="text-xs text-gray-400 font-mono">{v.vend_id}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{v.desp_nombre || '—'}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-gray-700">{fmtNum(v.total_docs)}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-teal-600">{fmtNum(v.vigentes)}</td>
                      <td className="px-4 py-3 text-right text-xs font-medium text-gray-800">{formatCurrency(v.prima_neta)}</td>
                      <td className="px-4 py-3 text-right text-xs text-gray-600">{formatCurrency(v.prima_vigente)}</td>
                      <td className="px-4 py-3 text-xs text-gray-400">{v.ultimo_documento ? formatDate(v.ultimo_documento) : '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => { setMappingVendor(v); setUserSearch(''); setUserOptions([]); }}
                          className="flex items-center gap-1 mx-auto px-2.5 py-1 text-xs rounded-lg bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100 transition-colors"
                        >
                          <Link2 className="w-3 h-3" /> Vincular
                        </button>
                      </td>
                    </tr>
                  ))}
                  {unmappedVendors.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-gray-400">
                        <CheckCircle className="w-8 h-8 mx-auto mb-2 text-teal-400" />
                        <p className="text-sm">Todos los vendedores estan mapeados</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            {unmappedVendors.length === 50 && (
              <div className="flex justify-end gap-2 p-3 border-t border-gray-100">
                <button disabled={vendorPage === 0} onClick={() => setVendorPage(p => p - 1)}
                  className="px-3 py-1 text-xs rounded border border-gray-200 text-gray-600 disabled:opacity-40">
                  <ChevronUp className="w-3 h-3 inline" /> Anterior
                </button>
                <span className="px-3 py-1 text-xs text-gray-500">Pag. {vendorPage + 1}</span>
                <button onClick={() => setVendorPage(p => p + 1)}
                  className="px-3 py-1 text-xs rounded border border-gray-200 text-gray-600">
                  Siguiente <ChevronDown className="w-3 h-3 inline" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: Salud SICAS ─────────────────────────────────────────────── */}
      {activeTab === 'salud' && isGerente && (
        <div>
          <div className="flex items-center gap-3 mb-5">
            <div className="flex gap-2">
              <button onClick={() => handleSync('full')} disabled={syncing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50">
                {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
                Full sync
              </button>
              <button onClick={() => handleSync('incremental')} disabled={syncing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-teal-200 text-teal-700 hover:bg-teal-50 disabled:opacity-50">
                Incremental
              </button>
              <button onClick={handlePostSyncMapping} disabled={syncing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                <Link2 className="w-3.5 h-3.5" /> Post-sync mapeo
              </button>
            </div>
          </div>

          {/* Config info */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4 text-teal-500" /> Configuracion SICAS
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              {[
                { label: 'Endpoint', value: 'sicasonline.com/WS_SICASOnline.asmx' },
                { label: 'Protocolo', value: 'SOAP / ProcesarWS' },
                { label: 'Keycode', value: 'HWS_DOCTOS' },
                { label: 'Modo', value: 'local_first (no tiempo real)' },
              ].map(c => (
                <div key={c.label}>
                  <p className="text-xs text-gray-400 mb-0.5">{c.label}</p>
                  <p className="text-xs font-mono font-medium text-gray-700">{c.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Coverage summary */}
          {coverage && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">Estado actual de la base local</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
                {[
                  { label: 'Total docs', value: fmtNum(coverage.total_docs) },
                  { label: 'Con usuario', value: fmtNum(coverage.docs_with_user), color: 'text-teal-600' },
                  { label: 'Sin usuario', value: fmtNum(coverage.docs_without_user), color: 'text-amber-600' },
                  { label: 'Cobertura docs', value: fmtPct(coverage.coverage_pct) },
                  { label: 'Cobertura prima', value: fmtPct(coverage.prima_coverage_pct) },
                ].map(s => (
                  <div key={s.label} className="bg-gray-50 rounded-lg p-2.5">
                    <p className="text-xs text-gray-400 mb-1">{s.label}</p>
                    <p className={`text-lg font-bold ${s.color || 'text-gray-800'}`}>{s.value}</p>
                  </div>
                ))}
              </div>
              {coverage.last_sync && (
                <p className="text-xs text-gray-400 mt-3 text-right">
                  Ultima sincronizacion: {formatDate(coverage.last_sync)}
                </p>
              )}
            </div>
          )}

          {/* Sync history */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800">Historial de sincronizaciones</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Estado</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Modo</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Keycode</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Docs</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Errores</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Progreso</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Inicio</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Duracion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {syncJobs.map(job => {
                    const dur = job.finished_at && job.started_at
                      ? Math.round((new Date(job.finished_at).getTime() - new Date(job.started_at).getTime()) / 1000)
                      : null;
                    return (
                      <tr key={job.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3"><StatusBadge status={job.status} /></td>
                        <td className="px-4 py-3 text-xs text-gray-600">{job.sync_type || job.mode || 'full'}</td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">{job.keycode || 'HWS_DOCTOS'}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-gray-700">{fmtNum(job.total_synced)}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-red-500">{fmtNum(job.total_errors)}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`text-xs font-semibold ${(job.percent ?? 0) >= 100 ? 'text-teal-600' : 'text-gray-500'}`}>
                            {job.percent ?? 0}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400">{formatDate(job.started_at)}</td>
                        <td className="px-4 py-3 text-xs text-gray-400">
                          {dur != null ? `${dur < 60 ? `${dur}s` : `${Math.round(dur / 60)}m ${dur % 60}s`}` : job.status === 'running' ? '...' : '—'}
                        </td>
                      </tr>
                    );
                  })}
                  {syncJobs.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-gray-400 text-sm">Sin historial de sincronizaciones</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Mapping modal ──────────────────────────────────────────────────── */}
      {mappingVendor && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h3 className="font-semibold text-gray-900">Vincular vendedor SICAS</h3>
                <p className="text-xs text-gray-500 mt-0.5 font-mono">{mappingVendor.vend_id}</p>
              </div>
              <button onClick={() => setMappingVendor(null)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5">
              <div className="bg-gray-50 rounded-lg p-3 mb-4 text-xs text-gray-600 grid grid-cols-2 gap-2">
                <div><span className="text-gray-400">Nombre:</span> {mappingVendor.vend_nombre}</div>
                <div><span className="text-gray-400">Despacho:</span> {mappingVendor.desp_nombre || '—'}</div>
                <div><span className="text-gray-400">Documentos:</span> {fmtNum(mappingVendor.total_docs)}</div>
                <div><span className="text-gray-400">Prima:</span> {formatCurrency(mappingVendor.prima_neta)}</div>
              </div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Buscar usuario MOVI</label>
              <input
                value={userSearch}
                onChange={e => { setUserSearch(e.target.value); searchUsers(e.target.value); }}
                placeholder="Nombre, apellido o email..."
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-teal-400 mb-2"
              />
              {userOptions.length > 0 && (
                <div className="border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100 max-h-48 overflow-y-auto">
                  {userOptions.map(u => (
                    <button
                      key={u.id}
                      onClick={() => applyMapping(mappingVendor, u.id)}
                      disabled={mappingLoading}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-teal-50 transition-colors disabled:opacity-50"
                    >
                      <div className="w-7 h-7 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-semibold text-teal-600">
                          {u.nombre[0]}{u.apellidos?.[0]}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{u.nombre} {u.apellidos}</p>
                        <p className="text-xs text-gray-400">{u.email_laboral}</p>
                      </div>
                      {mappingLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-500 ml-auto" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Container>
  );
}
