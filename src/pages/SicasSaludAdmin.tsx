import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  Activity, AlertTriangle, CheckCircle, XCircle, RefreshCw, Link, Unlink,
  Search, Filter, Users, FileText, TrendingUp, Database, Clock, Shield,
  ChevronDown, ChevronUp, Play, Info, BarChart3, Zap, Building2, Star
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface HealthReport {
  endpoint?: string;
  protocol?: string;
  use_rest?: boolean;
  keycode?: string;
  variant?: string;
  last_test_at?: string;
  last_test_success?: boolean;
  last_test_message?: string;
  last_sync_at?: string;
  total_docs?: number;
  vigentes_docs?: number;
  expired_fixed?: number;
  anomalous_dates?: number;
  vendors_total?: number;
  vendors_mapped?: number;
  vendors_pending?: number;
  mapping_pct?: number;
  docs_with_user?: number;
  docs_with_user_pct?: number;
  catalogs_stale?: number;
  recent_errors?: number;
  recommendations?: string[];
}

interface VendorMapping {
  id: string;
  vend_id: string;
  vend_nombre: string;
  movi_user_id: string | null;
  status: string;
  match_type: string | null;
  confidence_score: number | null;
  total_docs: number;
  prima_neta_total: number;
  usuario?: {
    id: string;
    nombre: string;
    apellidos: string;
    email: string;
    oficina?: { nombre: string };
  } | null;
}

interface UserSearchResult {
  id: string;
  nombre: string;
  apellidos: string;
  email: string;
  oficina?: { nombre: string };
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function callMapVendors(action: string, params: Record<string, unknown> = {}, method: 'GET' | 'POST' = 'POST') {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || SUPABASE_ANON_KEY;

  if (method === 'GET') {
    const qs = new URLSearchParams({ action, ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
    const res = await fetch(`${SUPABASE_URL}/functions/v1/sicas-map-vendors?${qs}`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Apikey: SUPABASE_ANON_KEY },
    });
    return res.json();
  }

  const res = await fetch(`${SUPABASE_URL}/functions/v1/sicas-map-vendors`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({ action, ...params }),
  });
  return res.json();
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatCurrency(v: number) {
  if (!v) return '$0';
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function formatDate(s?: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
}

function pct(a: number, b: number) {
  if (!b) return 0;
  return Math.round((a / b) * 100);
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    active: { label: 'Activo', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    pending_review: { label: 'Pendiente', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
    inactive: { label: 'Inactivo', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
    manual: { label: 'Manual', cls: 'bg-sky-100 text-sky-700 border-sky-200' },
  };
  const s = map[status] || { label: status, cls: 'bg-slate-100 text-slate-600 border-slate-200' };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${s.cls}`}>{s.label}</span>;
}

function MatchTypeBadge({ type }: { type: string | null }) {
  if (!type) return null;
  const map: Record<string, string> = {
    id_sicas_exact: 'ID exacto',
    nombre_sicas_exact: 'Nombre exacto',
    nombre_normalizado: 'Nombre norm.',
    nombre_invertido: 'Nombre inv.',
    manual: 'Manual',
    no_match: 'Sin match',
  };
  return <span className="text-xs text-slate-500">{map[type] || type}</span>;
}

// ── Tab: Salud del Sistema ─────────────────────────────────────────────────────

function TabSalud() {
  const [report, setReport] = useState<HealthReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningAction, setRunningAction] = useState<string | null>(null);

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      const { data: cfg } = await supabase.from('sicas_config').select('*').maybeSingle();
      const { data: docStats } = await supabase.from('sicas_documents').select('id', { count: 'exact', head: true });
      const { data: vigentes } = await supabase.from('sicas_documents').select('id', { count: 'exact', head: true }).eq('is_vigente', true);
      const { data: withUser } = await supabase.from('sicas_documents').select('id', { count: 'exact', head: true }).not('usuario_id', 'is', null);
      const { data: vendors } = await supabase.from('sicas_vendor_user_mappings').select('status');
      const { data: staleJobs } = await supabase.from('sicas_sync_jobs').select('status, created_at').order('created_at', { ascending: false }).limit(20);
      const { data: quality } = await supabase.from('sicas_data_quality_log').select('issue_type', { count: 'exact', head: true }).eq('issue_type', 'anomalous_dates');

      const totalVendors = vendors?.length || 0;
      const activeVendors = vendors?.filter(v => v.status === 'active').length || 0;
      const totalDocs = (docStats as any)?.count || 0;
      const vigentesDocs = (vigentes as any)?.count || 0;
      const docsWithUser = (withUser as any)?.count || 0;
      const recentErrors = staleJobs?.filter(j => j.status === 'failed').length || 0;

      const recs: string[] = [];
      if (activeVendors / Math.max(totalVendors, 1) < 0.3) recs.push('Más del 70% de vendedores SICAS no están vinculados a usuarios MOVI.');
      if (recentErrors > 3) recs.push('Se detectaron varios jobs de sync fallidos recientemente.');
      if (cfg?.last_test_success === false) recs.push('La última prueba de conexión con SICAS falló.');
      if (docsWithUser / Math.max(totalDocs, 1) < 0.5) recs.push('Menos del 50% de documentos tienen usuario asignado.');

      setReport({
        endpoint: cfg?.endpoint,
        use_rest: cfg?.use_rest,
        last_test_at: cfg?.last_test_at,
        last_test_success: cfg?.last_test_success,
        last_test_message: cfg?.last_test_message,
        total_docs: totalDocs,
        vigentes_docs: vigentesDocs,
        vendors_total: totalVendors,
        vendors_mapped: activeVendors,
        vendors_pending: totalVendors - activeVendors,
        mapping_pct: pct(activeVendors, totalVendors),
        docs_with_user: docsWithUser,
        docs_with_user_pct: pct(docsWithUser, totalDocs),
        recent_errors: recentErrors,
        recommendations: recs,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadReport(); }, [loadReport]);

  const runAction = async (action: string, label: string) => {
    setRunningAction(action);
    try {
      await callMapVendors(action, { apply: true });
      await loadReport();
    } finally {
      setRunningAction(null);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
    </div>
  );

  if (!report) return null;

  const kpis = [
    { label: 'Documentos totales', value: report.total_docs?.toLocaleString('es-MX'), icon: FileText, color: 'text-sky-600', bg: 'bg-sky-50' },
    { label: 'Pólizas vigentes', value: report.vigentes_docs?.toLocaleString('es-MX'), icon: Shield, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Vendedores mapeados', value: `${report.vendors_mapped} / ${report.vendors_total}`, icon: Users, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Docs con usuario', value: `${report.docs_with_user_pct}%`, icon: TrendingUp, color: 'text-violet-600', bg: 'bg-violet-50' },
  ];

  return (
    <div className="space-y-6">
      {/* Connection status */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <Activity className="w-4 h-4 text-sky-500" /> Estado de Conexión
          </h3>
          <button onClick={loadReport} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors">
            <RefreshCw className="w-3.5 h-3.5" /> Actualizar
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-slate-500 mb-1">Protocolo</p>
            <p className="font-medium text-slate-800">{report.use_rest ? 'REST' : 'SOAP/ProcesarWS'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Última prueba</p>
            <p className="font-medium text-slate-800">{formatDate(report.last_test_at)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Resultado</p>
            <div className="flex items-center gap-1.5">
              {report.last_test_success === true
                ? <CheckCircle className="w-4 h-4 text-emerald-500" />
                : report.last_test_success === false
                  ? <XCircle className="w-4 h-4 text-red-500" />
                  : <Clock className="w-4 h-4 text-slate-400" />}
              <span className="text-sm font-medium">
                {report.last_test_success === true ? 'OK' : report.last_test_success === false ? 'Falló' : 'Sin datos'}
              </span>
            </div>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Endpoint</p>
            <p className="text-xs text-slate-600 truncate" title={report.endpoint}>{report.endpoint || '—'}</p>
          </div>
        </div>
        {report.last_test_message && (
          <div className="mt-3 px-3 py-2 bg-slate-50 rounded-lg text-xs text-slate-600 font-mono">{report.last_test_message}</div>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map(k => (
          <div key={k.label} className={`${k.bg} rounded-xl p-4 border border-white`}>
            <div className="flex items-center gap-2 mb-2">
              <k.icon className={`w-4 h-4 ${k.color}`} />
              <p className="text-xs text-slate-600">{k.label}</p>
            </div>
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Mapping progress bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-amber-500" /> Cobertura de Mapeo
        </h3>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-slate-600">Vendedores mapeados</span>
              <span className="font-medium">{report.mapping_pct}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2.5">
              <div className="bg-amber-500 h-2.5 rounded-full transition-all" style={{ width: `${report.mapping_pct}%` }} />
            </div>
            <p className="text-xs text-slate-500 mt-1">{report.vendors_mapped} activos · {report.vendors_pending} pendientes</p>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-slate-600">Documentos con usuario</span>
              <span className="font-medium">{report.docs_with_user_pct}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2.5">
              <div className="bg-sky-500 h-2.5 rounded-full transition-all" style={{ width: `${report.docs_with_user_pct}%` }} />
            </div>
            <p className="text-xs text-slate-500 mt-1">{report.docs_with_user?.toLocaleString('es-MX')} de {report.total_docs?.toLocaleString('es-MX')}</p>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4 text-sky-500" /> Acciones de Mantenimiento
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={() => runAction('fix_expired_vigentes', 'Corregir vigentes')}
            disabled={!!runningAction}
            className="flex items-center gap-2 px-4 py-3 rounded-lg border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 text-sm text-slate-700 hover:text-emerald-700 transition-all disabled:opacity-50"
          >
            {runningAction === 'fix_expired_vigentes' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
            Corregir vigentes expirados
          </button>
          <button
            onClick={() => runAction('build_aseguradoras', 'Reconstruir aseguradoras')}
            disabled={!!runningAction}
            className="flex items-center gap-2 px-4 py-3 rounded-lg border border-slate-200 hover:border-sky-300 hover:bg-sky-50 text-sm text-slate-700 hover:text-sky-700 transition-all disabled:opacity-50"
          >
            {runningAction === 'build_aseguradoras' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Building2 className="w-4 h-4" />}
            Reconstruir aseguradoras
          </button>
          <button
            onClick={() => runAction('sync_mapping_stats', 'Sincronizar estadísticas')}
            disabled={!!runningAction}
            className="flex items-center gap-2 px-4 py-3 rounded-lg border border-slate-200 hover:border-amber-300 hover:bg-amber-50 text-sm text-slate-700 hover:text-amber-700 transition-all disabled:opacity-50"
          >
            {runningAction === 'sync_mapping_stats' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Sincronizar estadísticas
          </button>
        </div>
      </div>

      {/* Recommendations */}
      {report.recommendations && report.recommendations.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <h3 className="font-semibold text-amber-800 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Recomendaciones Automáticas
          </h3>
          <ul className="space-y-2">
            {report.recommendations.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-amber-700">
                <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Tab: Mapeo de Vendedores ──────────────────────────────────────────────────

function TabMapeo() {
  const [mappings, setMappings] = useState<VendorMapping[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [matchFilter, setMatchFilter] = useState('');
  const [search, setSearch] = useState('');
  const [autoMapping, setAutoMapping] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<unknown>(null);
  const [linkingVend, setLinkingVend] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [userResults, setUserResults] = useState<UserSearchResult[]>([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const LIMIT = 50;

  const loadMappings = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: String(LIMIT) };
      if (statusFilter) params.status = statusFilter;
      if (matchFilter) params.match_type = matchFilter;
      if (search) params.search = search;
      const res = await callMapVendors('list_mappings', params, 'GET');
      setMappings(res.data || []);
      setTotal(res.total || 0);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, matchFilter, search]);

  useEffect(() => { loadMappings(); }, [loadMappings]);

  const runAutoMap = async (dryRun: boolean) => {
    setAutoMapping(true);
    try {
      const res = await callMapVendors('auto_map', { dry_run: dryRun });
      if (dryRun) {
        setDryRunResult(res.data);
      } else {
        await loadMappings();
        setDryRunResult(null);
      }
    } finally {
      setAutoMapping(false);
    }
  };

  const handleLink = async (vendId: string, userId: string) => {
    setActionLoading(vendId);
    try {
      await callMapVendors('manual_link', { vend_id: vendId, user_id: userId });
      setLinkingVend(null);
      setUserSearch('');
      setUserResults([]);
      await loadMappings();
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnlink = async (vendId: string) => {
    setActionLoading(vendId);
    try {
      await callMapVendors('manual_unlink', { vend_id: vendId });
      await loadMappings();
    } finally {
      setActionLoading(null);
    }
  };

  const searchUsers = async (q: string) => {
    if (q.length < 2) { setUserResults([]); return; }
    setUserSearchLoading(true);
    try {
      const res = await callMapVendors('search_users', { q }, 'GET');
      setUserResults(res.data || []);
    } finally {
      setUserSearchLoading(false);
    }
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar vendedor o ID..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white"
        >
          <option value="">Todos los estados</option>
          <option value="active">Activos</option>
          <option value="pending_review">Pendientes</option>
          <option value="inactive">Inactivos</option>
        </select>
        <select
          value={matchFilter}
          onChange={e => { setMatchFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white"
        >
          <option value="">Todos los tipos</option>
          <option value="id_sicas_exact">ID exacto</option>
          <option value="nombre_sicas_exact">Nombre exacto</option>
          <option value="nombre_normalizado">Nombre normalizado</option>
          <option value="nombre_invertido">Nombre invertido</option>
          <option value="manual">Manual</option>
          <option value="no_match">Sin match</option>
        </select>
        <div className="flex gap-2 ml-auto">
          <button
            onClick={() => runAutoMap(true)}
            disabled={autoMapping}
            className="flex items-center gap-2 px-4 py-2 border border-sky-300 text-sky-700 rounded-lg text-sm hover:bg-sky-50 transition-colors disabled:opacity-50"
          >
            {autoMapping ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Simular auto-mapeo
          </button>
          <button
            onClick={() => runAutoMap(false)}
            disabled={autoMapping}
            className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg text-sm hover:bg-sky-700 transition-colors disabled:opacity-50"
          >
            {autoMapping ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            Ejecutar auto-mapeo
          </button>
        </div>
      </div>

      {/* Dry run result */}
      {dryRunResult && (
        <div className="bg-sky-50 border border-sky-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="font-medium text-sky-800 flex items-center gap-2">
              <Info className="w-4 h-4" /> Resultado simulado (sin cambios aplicados)
            </p>
            <button onClick={() => setDryRunResult(null)} className="text-sky-500 hover:text-sky-700 text-xs">Cerrar</button>
          </div>
          <pre className="text-xs text-sky-700 overflow-auto max-h-40">{JSON.stringify(dryRunResult, null, 2)}</pre>
          <button
            onClick={() => runAutoMap(false)}
            className="mt-3 flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg text-sm hover:bg-sky-700 transition-colors"
          >
            <Zap className="w-4 h-4" /> Aplicar ahora
          </button>
        </div>
      )}

      {/* Summary chips */}
      <div className="flex gap-3 text-sm text-slate-600">
        <span className="font-medium">{total.toLocaleString('es-MX')} vendedores</span>
        <span>·</span>
        <span>Página {page} de {totalPages || 1}</span>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Vendedor SICAS</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Usuario MOVI</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">Docs</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">Prima neta</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600">Estado</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600">Tipo match</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600">Confianza</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                    Cargando...
                  </td>
                </tr>
              ) : mappings.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">Sin resultados</td>
                </tr>
              ) : mappings.map(m => (
                <>
                  <tr key={m.id} className={`hover:bg-slate-50 transition-colors ${linkingVend === m.vend_id ? 'bg-sky-50' : ''}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{m.vend_nombre}</p>
                      <p className="text-xs text-slate-400">{m.vend_id}</p>
                    </td>
                    <td className="px-4 py-3">
                      {m.usuario ? (
                        <div>
                          <p className="font-medium text-slate-700">{m.usuario.nombre} {m.usuario.apellidos}</p>
                          <p className="text-xs text-slate-400">{m.usuario.email}</p>
                          {m.usuario.oficina && <p className="text-xs text-slate-400">{m.usuario.oficina.nombre}</p>}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs italic">Sin asignar</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-700">{(m.total_docs || 0).toLocaleString('es-MX')}</td>
                    <td className="px-4 py-3 text-right font-medium text-slate-700">{formatCurrency(m.prima_neta_total || 0)}</td>
                    <td className="px-4 py-3 text-center"><StatusBadge status={m.status} /></td>
                    <td className="px-4 py-3 text-center"><MatchTypeBadge type={m.match_type} /></td>
                    <td className="px-4 py-3 text-center">
                      {m.confidence_score != null && m.confidence_score > 0 ? (
                        <span className={`text-xs font-medium ${m.confidence_score >= 90 ? 'text-emerald-600' : m.confidence_score >= 70 ? 'text-amber-600' : 'text-slate-500'}`}>
                          {m.confidence_score}%
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {m.status === 'active' ? (
                          <button
                            onClick={() => handleUnlink(m.vend_id)}
                            disabled={actionLoading === m.vend_id}
                            title="Desvincular"
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                          >
                            {actionLoading === m.vend_id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Unlink className="w-4 h-4" />}
                          </button>
                        ) : null}
                        <button
                          onClick={() => setLinkingVend(linkingVend === m.vend_id ? null : m.vend_id)}
                          title="Vincular manualmente"
                          className="p-1.5 text-sky-500 hover:bg-sky-50 rounded-lg transition-colors"
                        >
                          <Link className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {linkingVend === m.vend_id && (
                    <tr key={`link-${m.id}`} className="bg-sky-50 border-b border-sky-100">
                      <td colSpan={8} className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-sky-700">Vincular a usuario:</span>
                          <div className="relative flex-1 max-w-sm">
                            <input
                              type="text"
                              placeholder="Buscar usuario por nombre o email..."
                              value={userSearch}
                              onChange={e => { setUserSearch(e.target.value); searchUsers(e.target.value); }}
                              className="w-full px-3 py-1.5 border border-sky-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 bg-white"
                            />
                            {userSearchLoading && <RefreshCw className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-sky-400" />}
                            {userResults.length > 0 && (
                              <div className="absolute top-full left-0 right-0 bg-white border border-sky-200 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                                {userResults.map(u => (
                                  <button
                                    key={u.id}
                                    onClick={() => handleLink(m.vend_id, u.id)}
                                    disabled={actionLoading === m.vend_id}
                                    className="w-full text-left px-3 py-2 hover:bg-sky-50 text-sm transition-colors"
                                  >
                                    <span className="font-medium text-slate-700">{u.nombre} {u.apellidos}</span>
                                    <span className="text-slate-400 ml-2">{u.email}</span>
                                    {u.oficina && <span className="text-slate-400 ml-2 text-xs">· {u.oficina.nombre}</span>}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => { setLinkingVend(null); setUserSearch(''); setUserResults([]); }}
                            className="text-sm text-slate-500 hover:text-slate-700"
                          >
                            Cancelar
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm hover:bg-slate-50 disabled:opacity-40 transition-colors"
          >
            Anterior
          </button>
          <span className="text-sm text-slate-600">Página {page} de {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm hover:bg-slate-50 disabled:opacity-40 transition-colors"
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
}

// ── Tab: Calidad de Datos ──────────────────────────────────────────────────────

function TabCalidad() {
  const [stats, setStats] = useState<{
    vigentes: number;
    expired: number;
    anomalous: number;
    missing_prima: number;
    missing_client: number;
    total: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [total, vigentes, anomalous, missingPrima, missingClient] = await Promise.all([
        supabase.from('sicas_documents').select('id', { count: 'exact', head: true }),
        supabase.from('sicas_documents').select('id', { count: 'exact', head: true }).eq('is_vigente', true),
        supabase.from('sicas_data_quality_log').select('id', { count: 'exact', head: true }).eq('issue_type', 'anomalous_dates'),
        supabase.from('sicas_documents').select('id', { count: 'exact', head: true }).is('prima_neta', null),
        supabase.from('sicas_documents').select('id', { count: 'exact', head: true }).is('nombre_cliente', null),
      ]);
      const totalCount = (total as any).count || 0;
      const vigentesCount = (vigentes as any).count || 0;
      setStats({
        total: totalCount,
        vigentes: vigentesCount,
        expired: totalCount - vigentesCount,
        anomalous: (anomalous as any).count || 0,
        missing_prima: (missingPrima as any).count || 0,
        missing_client: (missingClient as any).count || 0,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const fixExpired = async () => {
    setRunning('fix');
    try {
      await callMapVendors('fix_expired_vigentes', { apply: true });
      await load();
    } finally {
      setRunning(null);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
    </div>
  );

  const items = [
    {
      label: 'Pólizas vigentes correctas',
      value: stats?.vigentes,
      total: stats?.total,
      severity: 'ok' as const,
      desc: 'Documentos con is_vigente = true y fecha válida.',
    },
    {
      label: 'Pólizas expiradas (no vigentes)',
      value: stats?.expired,
      total: stats?.total,
      severity: 'info' as const,
      desc: 'Documentos correctamente marcados como expirados.',
    },
    {
      label: 'Fechas anómalas (1901 o 2121)',
      value: stats?.anomalous,
      total: stats?.total,
      severity: stats?.anomalous && stats.anomalous > 0 ? 'warn' as const : 'ok' as const,
      desc: 'Vigencias con años fuera de rango (1901–2100). Registradas pero no corregidas automáticamente.',
      action: stats?.anomalous && stats.anomalous > 0 ? (
        <span className="text-xs text-amber-600">Revisión manual recomendada</span>
      ) : null,
    },
    {
      label: 'Sin prima neta',
      value: stats?.missing_prima,
      total: stats?.total,
      severity: stats?.missing_prima && stats.missing_prima > 10 ? 'warn' as const : 'ok' as const,
      desc: 'Documentos sin valor de prima neta registrado.',
    },
    {
      label: 'Sin nombre de cliente',
      value: stats?.missing_client,
      total: stats?.total,
      severity: stats?.missing_client && stats.missing_client > 10 ? 'warn' as const : 'ok' as const,
      desc: 'Documentos sin nombre de cliente asociado.',
    },
  ];

  const severityClasses = {
    ok: 'border-emerald-200 bg-emerald-50',
    info: 'border-sky-200 bg-sky-50',
    warn: 'border-amber-200 bg-amber-50',
    error: 'border-red-200 bg-red-50',
  };
  const severityIconClasses = {
    ok: 'text-emerald-500',
    info: 'text-sky-500',
    warn: 'text-amber-500',
    error: 'text-red-500',
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Análisis de calidad sobre {stats?.total.toLocaleString('es-MX')} documentos SICAS.</p>
        <button
          onClick={fixExpired}
          disabled={!!running}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 transition-colors disabled:opacity-50"
        >
          {running === 'fix' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
          Corregir vigentes expirados
        </button>
      </div>

      <div className="grid gap-4">
        {items.map(item => (
          <div key={item.label} className={`rounded-xl border p-4 ${severityClasses[item.severity]}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                {item.severity === 'ok'
                  ? <CheckCircle className={`w-5 h-5 flex-shrink-0 ${severityIconClasses[item.severity]}`} />
                  : item.severity === 'warn'
                    ? <AlertTriangle className={`w-5 h-5 flex-shrink-0 ${severityIconClasses[item.severity]}`} />
                    : <Info className={`w-5 h-5 flex-shrink-0 ${severityIconClasses[item.severity]}`} />}
                <div>
                  <p className="font-medium text-slate-800">{item.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xl font-bold text-slate-700">{(item.value || 0).toLocaleString('es-MX')}</p>
                <p className="text-xs text-slate-500">{pct(item.value || 0, item.total || 1)}%</p>
                {item.action && <div className="mt-1">{item.action}</div>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Tab: Catálogos ─────────────────────────────────────────────────────────────

function TabCatalogos() {
  const [catalogs, setCatalogs] = useState<Array<{
    name: string;
    total: number;
    last_sync: string | null;
    source: string;
    stale: boolean;
  }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data: history } = await supabase
          .from('sicas_sync_history')
          .select('catalog_type_id, sync_completed_at, records_found, status')
          .eq('status', 'completed')
          .order('sync_completed_at', { ascending: false });

        const { data: types } = await supabase
          .from('sicas_catalog_types')
          .select('id, name, enum_name')
          .order('id');

        const { data: derived } = await supabase
          .from('sicas_derived_aseguradoras')
          .select('id', { count: 'exact', head: true });

        const latestByCatalog: Record<number, { sync_completed_at: string; records_found: number }> = {};
        for (const h of (history || [])) {
          if (!latestByCatalog[h.catalog_type_id]) {
            latestByCatalog[h.catalog_type_id] = { sync_completed_at: h.sync_completed_at, records_found: h.records_found };
          }
        }

        const now = Date.now();
        const STALE_DAYS = 7;

        const rows = (types || []).map(t => {
          const latest = latestByCatalog[t.id];
          const syncAt = latest?.sync_completed_at || null;
          const stale = !syncAt || (now - new Date(syncAt).getTime()) > STALE_DAYS * 24 * 60 * 60 * 1000;
          return {
            name: t.name,
            total: latest?.records_found || 0,
            last_sync: syncAt,
            source: 'SICAS SOAP',
            stale,
          };
        });

        // Add derived aseguradoras
        rows.unshift({
          name: 'Aseguradoras derivadas',
          total: (derived as any)?.count || 0,
          last_sync: null,
          source: 'Derivado de documentos',
          stale: false,
        });

        setCatalogs(rows);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const staleCount = catalogs.filter(c => c.stale).length;

  return (
    <div className="space-y-5">
      {staleCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <p className="text-sm text-amber-700">{staleCount} catálogos sin sincronizar en los últimos 7 días.</p>
        </div>
      )}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Catálogo</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Fuente</th>
              <th className="text-right px-4 py-3 font-semibold text-slate-600">Registros</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Último sync</th>
              <th className="text-center px-4 py-3 font-semibold text-slate-600">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={5} className="py-12 text-center text-slate-400"><RefreshCw className="w-5 h-5 animate-spin mx-auto" /></td></tr>
            ) : catalogs.map(c => (
              <tr key={c.name} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-2.5 font-medium text-slate-700">{c.name}</td>
                <td className="px-4 py-2.5 text-slate-500 text-xs">{c.source}</td>
                <td className="px-4 py-2.5 text-right text-slate-700">{c.total ? c.total.toLocaleString('es-MX') : '—'}</td>
                <td className="px-4 py-2.5 text-slate-500 text-xs">{formatDate(c.last_sync)}</td>
                <td className="px-4 py-2.5 text-center">
                  {c.stale
                    ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700 border border-amber-200"><AlertTriangle className="w-3 h-3" /> Desactualizado</span>
                    : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-700 border border-emerald-200"><CheckCircle className="w-3 h-3" /> OK</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'salud', label: 'Salud del sistema', icon: Activity },
  { id: 'mapeo', label: 'Mapeo de vendedores', icon: Users },
  { id: 'calidad', label: 'Calidad de datos', icon: Star },
  { id: 'catalogos', label: 'Catálogos', icon: Database },
];

export default function SicasSaludAdmin() {
  const [activeTab, setActiveTab] = useState('salud');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-sky-600 flex items-center justify-center">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">SICAS — Panel de Salud</h1>
            <p className="text-sm text-slate-500">Integración, mapeo de vendedores, calidad de datos y catálogos</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 mb-6 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
              activeTab === t.id
                ? 'border-sky-600 text-sky-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'salud' && <TabSalud />}
      {activeTab === 'mapeo' && <TabMapeo />}
      {activeTab === 'calidad' && <TabCalidad />}
      {activeTab === 'catalogos' && <TabCatalogos />}
    </div>
  );
}
