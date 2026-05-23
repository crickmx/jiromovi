import { useState, useEffect, useCallback } from 'react';
import {
  Globe, Plus, Trash2, RefreshCw, CheckCircle, AlertTriangle,
  XCircle, Clock, Loader2, Search, ExternalLink, ArrowUp, ArrowDown,
  TrendingDown, TrendingUp, AlertOctagon
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface MonitoredSite {
  id: string;
  url: string;
  created_at: string;
  last_check: string | null;
  last_status: string | null;
  last_http_code: number | null;
  last_response_time: number | null;
  last_ssl_status: string | null;
  last_diagnosis: string | null;
  previous_status: string | null;
  status_changed_at: string | null;
}

interface StatusChange {
  id: string;
  url: string;
  change_type: string;
  old_value: string | null;
  new_value: string | null;
  detected_at: string;
}

type SortKey = 'status' | 'speed' | 'ssl' | 'check' | 'url';
type ViewTab = 'sites' | 'changes';
type TimeFilter = '24h' | '7d' | '30d' | 'all';
type ChangeTypeFilter = 'all' | 'status' | 'ssl' | 'http';

function getFavicon(url: string) {
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  } catch {
    return null;
  }
}

function timeAgo(date: string | null) {
  if (!date) return 'Nunca';
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Ahora';
  if (mins < 60) return `Hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `Hace ${days}d`;
}

function getDomain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function WebMonitorTab() {
  const [sites, setSites] = useState<MonitoredSite[]>([]);
  const [changes, setChanges] = useState<StatusChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [newUrls, setNewUrls] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey>('status');
  const [sortAsc, setSortAsc] = useState(true);
  const [activeView, setActiveView] = useState<ViewTab>('sites');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('7d');
  const [changeTypeFilter, setChangeTypeFilter] = useState<ChangeTypeFilter>('all');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [sitesRes, changesRes] = await Promise.all([
        supabase.from('monitored_sites').select('*').order('url'),
        supabase.from('status_changes').select('*').order('detected_at', { ascending: false }).limit(100),
      ]);
      setSites(sitesRes.data ?? []);
      setChanges(changesRes.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const channel = supabase
      .channel('status_changes_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'status_changes' }, (payload) => {
        setChanges((prev) => [payload.new as StatusChange, ...prev].slice(0, 100));
        loadData();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadData]);

  const handleAddSites = async () => {
    const urls = newUrls.split('\n').map((u) => u.trim()).filter(Boolean)
      .map((u) => (u.startsWith('http') ? u : `https://${u}`));
    if (urls.length === 0) return;
    await supabase.from('monitored_sites').upsert(urls.map((url) => ({ url })), { onConflict: 'url', ignoreDuplicates: true });
    setNewUrls('');
    setShowAddForm(false);
    await loadData();
  };

  const handleDeleteSite = async (id: string) => {
    await supabase.from('monitored_sites').delete().eq('id', id);
    setSites((prev) => prev.filter((s) => s.id !== id));
  };

  const handleScan = async () => {
    setScanning(true);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/monitor-sites`;
      await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      await loadData();
    } finally {
      setScanning(false);
    }
  };

  const statusOrder = (s: string | null) => {
    if (s === 'CRITICO') return 0;
    if (s === 'ADVERTENCIA') return 1;
    if (s === 'OK') return 2;
    return 3;
  };

  const filteredSites = sites
    .filter((s) => {
      if (filterStatus !== 'all' && s.last_status !== filterStatus) return false;
      if (searchTerm && !s.url.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      const mul = sortAsc ? 1 : -1;
      switch (sortKey) {
        case 'status': return (statusOrder(a.last_status) - statusOrder(b.last_status)) * mul;
        case 'speed': return ((a.last_response_time ?? 99999) - (b.last_response_time ?? 99999)) * mul;
        case 'ssl': return String(a.last_ssl_status ?? '').localeCompare(String(b.last_ssl_status ?? '')) * mul;
        case 'check': return (new Date(a.last_check ?? 0).getTime() - new Date(b.last_check ?? 0).getTime()) * mul;
        case 'url': return getDomain(a.url).localeCompare(getDomain(b.url)) * mul;
        default: return 0;
      }
    });

  const filteredChanges = changes.filter((c) => {
    if (changeTypeFilter !== 'all' && c.change_type !== changeTypeFilter) return false;
    if (timeFilter !== 'all') {
      const cutoff = Date.now() - (timeFilter === '24h' ? 86400000 : timeFilter === '7d' ? 604800000 : 2592000000);
      if (new Date(c.detected_at).getTime() < cutoff) return false;
    }
    return true;
  });

  const summary = {
    total: sites.length,
    ok: sites.filter((s) => s.last_status === 'OK').length,
    warning: sites.filter((s) => s.last_status === 'ADVERTENCIA').length,
    critical: sites.filter((s) => s.last_status === 'CRITICO').length,
    pending: sites.filter((s) => !s.last_status || s.last_status === 'PENDIENTE').length,
  };

  const degradations = filteredChanges.filter((c) => c.change_type === 'status' && (c.new_value === 'CRITICO' || c.new_value === 'ADVERTENCIA')).length;
  const recoveries = filteredChanges.filter((c) => c.change_type === 'status' && c.new_value === 'OK').length;

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const SortButton = ({ label, sortKeyVal }: { label: string; sortKeyVal: SortKey }) => (
    <button
      onClick={() => toggleSort(sortKeyVal)}
      className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${
        sortKey === sortKeyVal
          ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'
          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
      }`}
    >
      {label}
      {sortKey === sortKeyVal && (sortAsc ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
    </button>
  );

  const statusCardBorder = (status: string | null) => {
    if (status === 'CRITICO') return 'border-l-4 border-l-red-500';
    if (status === 'ADVERTENCIA') return 'border-l-4 border-l-amber-400';
    if (status === 'OK') return 'border-l-4 border-l-emerald-500';
    return 'border-l-4 border-l-gray-300';
  };

  return (
    <div className="space-y-5">
      {/* View Tabs + Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full p-1 shadow-sm">
          <button
            onClick={() => setActiveView('sites')}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-full transition-all ${
              activeView === 'sites' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            Sitios <span className="ml-1 bg-white/20 px-1.5 py-0.5 rounded-full text-[10px]">{summary.total}</span>
          </button>
          <button
            onClick={() => setActiveView('changes')}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-full transition-all ${
              activeView === 'changes' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <TrendingDown className="w-3.5 h-3.5" />
            Ultimos Cambios
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            Agregar
          </button>
          <button
            onClick={handleScan}
            disabled={scanning || sites.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-sm"
          >
            {scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {scanning ? 'Escaneando...' : 'Escanear'}
          </button>
        </div>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Agregar URLs</h4>
          <p className="text-xs text-gray-500 mb-3">Una URL por linea. Se agrega https:// automaticamente si no se incluye.</p>
          <textarea
            value={newUrls}
            onChange={(e) => setNewUrls(e.target.value)}
            placeholder={"ejemplo.com\nhttps://otrodominio.mx\ntienda.ejemplo.com"}
            rows={4}
            className="w-full text-xs border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 dark:text-white font-mono"
          />
          <div className="flex gap-2 mt-3">
            <button onClick={handleAddSites} disabled={!newUrls.trim()} className="px-4 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">Guardar</button>
            <button onClick={() => { setShowAddForm(false); setNewUrls(''); }} className="px-4 py-1.5 text-xs font-medium rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">Cancelar</button>
          </div>
        </div>
      )}

      {activeView === 'sites' ? (
        <>
          {/* Search + Sort Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar dominio..."
                className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-800 dark:text-white shadow-sm"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm"
            >
              <option value="all">Todos</option>
              <option value="OK">OK</option>
              <option value="ADVERTENCIA">Advertencia</option>
              <option value="CRITICO">Critico</option>
            </select>
          </div>

          {/* Sort Options */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500 font-medium">Ordenar:</span>
            <SortButton label="Estado" sortKeyVal="status" />
            <SortButton label="Velocidad" sortKeyVal="speed" />
            <SortButton label="SSL" sortKeyVal="ssl" />
            <SortButton label="Revision" sortKeyVal="check" />
            <SortButton label="URL" sortKeyVal="url" />
            <span className="ml-auto text-xs text-gray-400">{filteredSites.length} de {sites.length} sitios</span>
          </div>

          {/* Summary KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-emerald-200 dark:border-emerald-800/50 p-4 flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-emerald-500" />
              <div>
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{summary.ok}</p>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-500 font-medium">Operativos</p>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-amber-200 dark:border-amber-800/50 p-4 flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-500" />
              <div>
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{summary.warning}</p>
                <p className="text-[10px] text-amber-600 dark:text-amber-500 font-medium">Advertencias</p>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-red-200 dark:border-red-800/50 p-4 flex items-center gap-3">
              <XCircle className="w-6 h-6 text-red-500" />
              <div>
                <p className="text-2xl font-bold text-red-700 dark:text-red-400">{summary.critical}</p>
                <p className="text-[10px] text-red-600 dark:text-red-500 font-medium">Criticos</p>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-3">
              <Clock className="w-6 h-6 text-gray-400" />
              <div>
                <p className="text-2xl font-bold text-gray-600 dark:text-gray-300">{summary.pending}</p>
                <p className="text-[10px] text-gray-500 font-medium">Sin revisar</p>
              </div>
            </div>
          </div>

          {/* Sites Grid */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : filteredSites.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-16 text-center">
              <Globe className="w-12 h-12 mx-auto text-gray-200 dark:text-gray-700 mb-4" />
              <p className="text-sm text-gray-500 font-medium">No hay sitios que mostrar</p>
              <p className="text-xs text-gray-400 mt-1">Agrega URLs o ajusta los filtros</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredSites.map((site) => (
                <div key={site.id} className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm hover:shadow-md transition-shadow ${statusCardBorder(site.last_status)}`}>
                  <div className="flex items-start gap-3">
                    <img
                      src={getFavicon(site.url) || ''}
                      alt=""
                      className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex-shrink-0 mt-0.5"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                          {getDomain(site.url)}
                        </h4>
                        <button onClick={() => handleDeleteSite(site.id)} className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <a href={site.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-gray-400 hover:text-blue-500 flex items-center gap-0.5 mt-0.5">
                        {getDomain(site.url)} <ExternalLink className="w-2.5 h-2.5" />
                      </a>

                      <div className="flex items-center gap-2 mt-2.5">
                        <StatusBadge status={site.last_status} />
                        {site.last_http_code && (
                          <span className="text-[10px] text-gray-500 font-mono">{site.last_http_code}</span>
                        )}
                        {site.last_response_time != null && (
                          <span className={`text-[10px] font-mono ${
                            site.last_response_time < 1000 ? 'text-emerald-600' : site.last_response_time < 3000 ? 'text-amber-600' : 'text-red-600'
                          }`}>{site.last_response_time}ms</span>
                        )}
                      </div>

                      {site.last_diagnosis && (
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg px-2.5 py-1.5 line-clamp-2">
                          {site.last_diagnosis}
                        </p>
                      )}

                      <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100 dark:border-gray-700">
                        <span className="text-[10px] text-gray-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {timeAgo(site.last_check)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        /* Changes View */
        <>
          <div className="space-y-4">
            {/* Changes Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800/50 p-4 flex items-center gap-3">
                <TrendingDown className="w-6 h-6 text-red-500" />
                <div>
                  <p className="text-2xl font-bold text-red-700 dark:text-red-400">{degradations}</p>
                  <p className="text-[10px] text-red-600 font-medium">Degradaciones</p>
                </div>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800/50 p-4 flex items-center gap-3">
                <TrendingUp className="w-6 h-6 text-emerald-500" />
                <div>
                  <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{recoveries}</p>
                  <p className="text-[10px] text-emerald-600 font-medium">Recuperaciones</p>
                </div>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800/50 p-4 flex items-center gap-3">
                <AlertOctagon className="w-6 h-6 text-amber-500" />
                <div>
                  <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{summary.critical}</p>
                  <p className="text-[10px] text-amber-600 font-medium">Con estado critico</p>
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              {(['24h', '7d', '30d', 'all'] as TimeFilter[]).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeFilter(tf)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${
                    timeFilter === tf
                      ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                  }`}
                >
                  {tf === '24h' ? 'Ultimas 24h' : tf === '7d' ? 'Ultimos 7 dias' : tf === '30d' ? 'Ultimos 30 dias' : 'Todo'}
                </button>
              ))}
              <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1" />
              {(['all', 'status', 'ssl', 'http'] as ChangeTypeFilter[]).map((ct) => (
                <button
                  key={ct}
                  onClick={() => setChangeTypeFilter(ct)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${
                    changeTypeFilter === ct
                      ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                  }`}
                >
                  {ct === 'all' ? 'Todos' : ct === 'status' ? 'Estado' : ct === 'ssl' ? 'SSL' : 'HTTP'}
                </button>
              ))}
              <span className="ml-auto text-xs text-gray-400">{filteredChanges.length} cambios</span>
            </div>

            {/* Changes List */}
            {filteredChanges.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
                <p className="text-sm text-gray-400">Sin cambios de estado en este periodo</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredChanges.map((change) => {
                  const isDegradation = change.new_value === 'CRITICO' || (change.new_value === 'ADVERTENCIA' && change.old_value === 'OK');
                  const borderColor = isDegradation ? 'border-l-4 border-l-red-500' : 'border-l-4 border-l-emerald-500';
                  return (
                    <div key={change.id} className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center gap-3 shadow-sm ${borderColor}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isDegradation ? 'bg-red-100 dark:bg-red-900/30' : 'bg-emerald-100 dark:bg-emerald-900/30'}`}>
                        {isDegradation ? <TrendingDown className="w-4 h-4 text-red-600" /> : <TrendingUp className="w-4 h-4 text-emerald-600" />}
                      </div>
                      <div className="flex-1 min-w-0 flex items-center gap-3">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${isDegradation ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {change.change_type === 'ssl' ? 'SSL' : 'Estado'}
                        </span>
                        <img src={getFavicon(`https://${getDomain(change.url)}`) || ''} alt="" className="w-5 h-5 rounded" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{getDomain(change.url)}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <StatusBadge status={change.old_value} size="sm" />
                        <span className="text-gray-300">→</span>
                        <StatusBadge status={change.new_value} size="sm" />
                      </div>
                      <span className="text-[10px] text-gray-400 flex-shrink-0 w-16 text-right">{timeAgo(change.detected_at)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function StatusBadge({ status, size = 'md' }: { status: string | null; size?: 'sm' | 'md' }) {
  const base = size === 'sm' ? 'text-[9px] px-1.5 py-0.5' : 'text-[10px] px-2 py-0.5';
  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5';
  switch (status) {
    case 'OK': return <span className={`inline-flex items-center gap-1 font-semibold rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 ${base}`}><CheckCircle className={iconSize} /> OK</span>;
    case 'ADVERTENCIA': return <span className={`inline-flex items-center gap-1 font-semibold rounded-full border border-amber-200 bg-amber-50 text-amber-700 ${base}`}><AlertTriangle className={iconSize} /> ADVERTENCIA</span>;
    case 'CRITICO': return <span className={`inline-flex items-center gap-1 font-semibold rounded-full border border-red-200 bg-red-50 text-red-700 ${base}`}><XCircle className={iconSize} /> CRITICO</span>;
    default: return <span className={`inline-flex items-center gap-1 font-semibold rounded-full border border-gray-200 bg-gray-50 text-gray-500 ${base}`}><Clock className={iconSize} /> PENDIENTE</span>;
  }
}
