import { useState, useEffect, useCallback } from 'react';
import {
  Globe, Plus, Trash2, RefreshCw, CheckCircle, AlertTriangle,
  XCircle, Clock, Shield, Loader2, Search, ArrowUpDown, ExternalLink
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

type SortKey = 'url' | 'last_status' | 'last_response_time' | 'last_check';

export function WebMonitorTab() {
  const [sites, setSites] = useState<MonitoredSite[]>([]);
  const [changes, setChanges] = useState<StatusChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [newUrls, setNewUrls] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey>('last_status');
  const [sortAsc, setSortAsc] = useState(true);
  const [activeView, setActiveView] = useState<'sites' | 'changes'>('sites');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [sitesRes, changesRes] = await Promise.all([
        supabase.from('monitored_sites').select('*').order('url'),
        supabase.from('status_changes').select('*').order('detected_at', { ascending: false }).limit(50),
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
        setChanges((prev) => [payload.new as StatusChange, ...prev].slice(0, 50));
        loadData();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadData]);

  const handleAddSites = async () => {
    const urls = newUrls
      .split('\n')
      .map((u) => u.trim())
      .filter(Boolean)
      .map((u) => (u.startsWith('http') ? u : `https://${u}`));
    if (urls.length === 0) return;

    const rows = urls.map((url) => ({ url }));
    await supabase.from('monitored_sites').upsert(rows, { onConflict: 'url', ignoreDuplicates: true });
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
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error('Error en scan');
      await loadData();
    } finally {
      setScanning(false);
    }
  };

  const statusIcon = (status: string | null) => {
    switch (status) {
      case 'OK': return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'ADVERTENCIA': return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'CRITICO': return <XCircle className="w-4 h-4 text-red-500" />;
      default: return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const statusBadge = (status: string | null) => {
    const classes: Record<string, string> = {
      OK: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      ADVERTENCIA: 'bg-amber-100 text-amber-800 border-amber-200',
      CRITICO: 'bg-red-100 text-red-800 border-red-200',
    };
    return classes[status ?? ''] || 'bg-gray-100 text-gray-600 border-gray-200';
  };

  const filteredSites = sites
    .filter((s) => {
      if (filterStatus !== 'all' && s.last_status !== filterStatus) return false;
      if (searchTerm && !s.url.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      const mul = sortAsc ? 1 : -1;
      const aVal = a[sortKey] ?? '';
      const bVal = b[sortKey] ?? '';
      if (typeof aVal === 'number' && typeof bVal === 'number') return (aVal - bVal) * mul;
      return String(aVal).localeCompare(String(bVal)) * mul;
    });

  const summary = {
    total: sites.length,
    ok: sites.filter((s) => s.last_status === 'OK').length,
    warning: sites.filter((s) => s.last_status === 'ADVERTENCIA').length,
    critical: sites.filter((s) => s.last_status === 'CRITICO').length,
    pending: sites.filter((s) => !s.last_status || s.last_status === 'PENDIENTE').length,
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const timeAgo = (date: string | null) => {
    if (!date) return 'Nunca';
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Ahora';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  };

  return (
    <div className="space-y-5">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
          <Globe className="w-5 h-5 mx-auto text-gray-500 mb-1" />
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{summary.total}</p>
          <p className="text-[10px] text-gray-500 uppercase tracking-wide">Total</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-emerald-200 dark:border-emerald-800 p-4 text-center">
          <CheckCircle className="w-5 h-5 mx-auto text-emerald-500 mb-1" />
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{summary.ok}</p>
          <p className="text-[10px] text-emerald-600 uppercase tracking-wide">OK</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-amber-200 dark:border-amber-800 p-4 text-center">
          <AlertTriangle className="w-5 h-5 mx-auto text-amber-500 mb-1" />
          <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{summary.warning}</p>
          <p className="text-[10px] text-amber-600 uppercase tracking-wide">Advertencia</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-red-200 dark:border-red-800 p-4 text-center">
          <XCircle className="w-5 h-5 mx-auto text-red-500 mb-1" />
          <p className="text-2xl font-bold text-red-700 dark:text-red-400">{summary.critical}</p>
          <p className="text-[10px] text-red-600 uppercase tracking-wide">Critico</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
          <Clock className="w-5 h-5 mx-auto text-gray-400 mb-1" />
          <p className="text-2xl font-bold text-gray-600 dark:text-gray-300">{summary.pending}</p>
          <p className="text-[10px] text-gray-500 uppercase tracking-wide">Pendiente</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveView('sites')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              activeView === 'sites' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
            }`}
          >
            <Globe className="w-3.5 h-3.5 inline mr-1" />
            Sitios ({sites.length})
          </button>
          <button
            onClick={() => setActiveView('changes')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              activeView === 'changes' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5 inline mr-1" />
            Cambios ({changes.length})
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Agregar
          </button>
          <button
            onClick={handleScan}
            disabled={scanning || sites.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {scanning ? 'Escaneando...' : 'Escanear Ahora'}
          </button>
        </div>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Agregar URLs</h4>
          <p className="text-xs text-gray-500 mb-3">Una URL por linea. Se agrega https:// automaticamente si no se incluye.</p>
          <textarea
            value={newUrls}
            onChange={(e) => setNewUrls(e.target.value)}
            placeholder="ejemplo.com&#10;https://otrodominio.mx&#10;tienda.ejemplo.com"
            rows={4}
            className="w-full text-xs border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 dark:text-white font-mono"
          />
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleAddSites}
              disabled={!newUrls.trim()}
              className="px-4 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              Guardar
            </button>
            <button
              onClick={() => { setShowAddForm(false); setNewUrls(''); }}
              className="px-4 py-1.5 text-xs font-medium rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {activeView === 'sites' ? (
        <>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por URL..."
                className="w-full pl-8 pr-3 py-2 text-xs border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 dark:text-white"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="text-xs border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">Todos los estados</option>
              <option value="OK">OK</option>
              <option value="ADVERTENCIA">Advertencia</option>
              <option value="CRITICO">Critico</option>
              <option value="PENDIENTE">Pendiente</option>
            </select>
          </div>

          {/* Sites Table */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : filteredSites.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
              <Globe className="w-10 h-10 mx-auto text-gray-300 mb-3" />
              <p className="text-sm text-gray-500">No hay sitios registrados</p>
              <p className="text-xs text-gray-400 mt-1">Agrega URLs para comenzar a monitorear</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-700/50">
                      <th className="px-3 py-2.5 text-left font-semibold text-gray-600 dark:text-gray-300 cursor-pointer" onClick={() => handleSort('last_status')}>
                        <span className="flex items-center gap-1">Estado <ArrowUpDown className="w-3 h-3" /></span>
                      </th>
                      <th className="px-3 py-2.5 text-left font-semibold text-gray-600 dark:text-gray-300 cursor-pointer" onClick={() => handleSort('url')}>
                        <span className="flex items-center gap-1">URL <ArrowUpDown className="w-3 h-3" /></span>
                      </th>
                      <th className="px-3 py-2.5 text-center font-semibold text-gray-600 dark:text-gray-300">HTTP</th>
                      <th className="px-3 py-2.5 text-center font-semibold text-gray-600 dark:text-gray-300 cursor-pointer" onClick={() => handleSort('last_response_time')}>
                        <span className="flex items-center justify-center gap-1">Tiempo <ArrowUpDown className="w-3 h-3" /></span>
                      </th>
                      <th className="px-3 py-2.5 text-center font-semibold text-gray-600 dark:text-gray-300">SSL</th>
                      <th className="px-3 py-2.5 text-left font-semibold text-gray-600 dark:text-gray-300">Diagnostico</th>
                      <th className="px-3 py-2.5 text-center font-semibold text-gray-600 dark:text-gray-300 cursor-pointer" onClick={() => handleSort('last_check')}>
                        <span className="flex items-center justify-center gap-1">Check <ArrowUpDown className="w-3 h-3" /></span>
                      </th>
                      <th className="px-3 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {filteredSites.map((site) => (
                      <tr key={site.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full border ${statusBadge(site.last_status)}`}>
                            {statusIcon(site.last_status)}
                            {site.last_status || 'PENDIENTE'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <a href={site.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-medium">
                            {site.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                            <ExternalLink className="w-3 h-3 flex-shrink-0" />
                          </a>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={`font-mono font-medium ${
                            site.last_http_code && site.last_http_code < 300 ? 'text-emerald-600' :
                            site.last_http_code && site.last_http_code < 400 ? 'text-amber-600' : 'text-red-600'
                          }`}>
                            {site.last_http_code ?? '-'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {site.last_response_time != null ? (
                            <span className={`font-mono ${
                              site.last_response_time < 1000 ? 'text-emerald-600' :
                              site.last_response_time < 3000 ? 'text-amber-600' : 'text-red-600'
                            }`}>
                              {site.last_response_time}ms
                            </span>
                          ) : '-'}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {site.last_ssl_status === 'VALIDO' ? (
                            <Shield className="w-4 h-4 text-emerald-500 mx-auto" />
                          ) : site.last_ssl_status === 'NO_HTTPS' ? (
                            <Shield className="w-4 h-4 text-amber-500 mx-auto" />
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300 max-w-[200px] truncate">
                          {site.last_diagnosis || '-'}
                        </td>
                        <td className="px-3 py-2.5 text-center text-gray-500">
                          {timeAgo(site.last_check)}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <button
                            onClick={() => handleDeleteSite(site.id)}
                            className="text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        /* Changes View */
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Historial de Cambios de Estado</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Cambios recientes detectados en los sitios monitoreados</p>
          </div>
          {changes.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              Sin cambios de estado registrados
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {changes.map((change) => (
                <div key={change.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="flex-shrink-0">
                    {change.new_value === 'CRITICO' ? (
                      <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                        <XCircle className="w-4 h-4 text-red-600" />
                      </div>
                    ) : change.new_value === 'ADVERTENCIA' ? (
                      <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                        <CheckCircle className="w-4 h-4 text-emerald-600" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{change.url}</p>
                    <p className="text-[10px] text-gray-500">
                      {change.change_type === 'ssl' ? 'SSL' : 'Estado'}: <span className="text-red-500">{change.old_value || 'N/A'}</span> → <span className="text-emerald-600">{change.new_value}</span>
                    </p>
                  </div>
                  <div className="text-[10px] text-gray-400 flex-shrink-0">
                    {new Date(change.detected_at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
