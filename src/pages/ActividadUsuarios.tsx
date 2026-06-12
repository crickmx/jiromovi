import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Activity, Users, LogIn, GraduationCap, ClipboardList, Search, ListFilter as Filter, Download, ChevronLeft, ChevronRight, UserCheck, UserX, TrendingUp, Megaphone, BookOpen, ChartBar as BarChart3, Eye, X, Shield, Monitor } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { cn } from '@/lib/utils';

interface ActivityLog {
  id: string;
  user_id: string;
  user_name_snapshot: string;
  email_snapshot: string;
  office_id: string;
  office_name_snapshot: string;
  role_snapshot: string;
  module: string;
  event_type: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  summary: string;
  details: Record<string, unknown>;
  metadata: Record<string, string>;
  status: string;
  created_at: string;
}

interface KPIs {
  active_today: number;
  active_this_week: number;
  active_this_month: number;
  total_logins_today: number;
  total_logins_week: number;
  inactive_users: number;
  profile_changes_month: number;
  publicity_created_month: number;
  courses_started_month: number;
  courses_completed_month: number;
  tramites_responded_month: number;
  crm_actions_month: number;
  total_events_today: number;
  total_events_month: number;
}

interface TopUser {
  user_id: string;
  nombre: string;
  rol: string;
  oficina: string;
  total_actions: number;
  last_activity: string;
}

interface TopModule {
  module: string;
  total_events: number;
  unique_users: number;
}

interface Oficina {
  id: string;
  nombre: string;
}

const MODULE_LABELS: Record<string, string> = {
  auth: 'Autenticacion',
  profile: 'Perfil',
  production: 'Produccion',
  publicidad: 'Publicidad',
  education: 'Capacitacion',
  crm: 'CRM',
  tramites: 'Tramites',
  system: 'Sistema',
  documents: 'Documentos',
  store: 'Tienda',
  comunicados: 'Comunicados',
  dashboard: 'Dashboard',
  assistant: 'Asistente',
  centro_digital: 'Centro Digital',
  comisiones: 'Comisiones',
  configuracion: 'Configuracion',
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  auth: 'Autenticacion',
  profile: 'Perfil',
  production: 'Produccion',
  publicity: 'Publicidad',
  education: 'Capacitacion',
  crm: 'CRM',
  tramites: 'Tramites',
  system: 'Sistema',
  navigation: 'Navegacion',
  store: 'Tienda',
  comunicados: 'Comunicados',
  assistant: 'Asistente',
  digital: 'Centro Digital',
  comisiones: 'Comisiones',
  configuracion: 'Configuracion',
};

const STATUS_CONFIG: Record<string, { bg: string; text: string }> = {
  success: { bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-400' },
  error: { bg: 'bg-red-50 dark:bg-red-500/10', text: 'text-red-700 dark:text-red-400' },
  warning: { bg: 'bg-amber-50 dark:bg-amber-500/10', text: 'text-amber-700 dark:text-amber-400' },
};

const MODULE_ICONS: Record<string, typeof Activity> = {
  auth: LogIn,
  profile: Users,
  production: BarChart3,
  publicidad: Megaphone,
  education: GraduationCap,
  crm: UserCheck,
  tramites: ClipboardList,
  system: Monitor,
  documents: Eye,
  dashboard: BarChart3,
  assistant: Activity,
  comunicados: Megaphone,
  centro_digital: BookOpen,
};

function formatRelativeTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Ahora';
  if (diffMins < 60) return `Hace ${diffMins}m`;
  if (diffHours < 24) return `Hace ${diffHours}h`;
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return `Hace ${diffDays}d`;
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function ActividadUsuarios() {
  const { usuario } = useAuth();
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [topUsers, setTopUsers] = useState<TopUser[]>([]);
  const [topModules, setTopModules] = useState<TopModule[]>([]);
  const [oficinas, setOficinas] = useState<Oficina[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [page, setPage] = useState(0);
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);
  const [, setSelectedUserId] = useState<string | null>(null);
  const [showUserDetail, setShowUserDetail] = useState(false);
  const [userDetailLogs, setUserDetailLogs] = useState<ActivityLog[]>([]);
  const [loadingUserDetail, setLoadingUserDetail] = useState(false);
  const limit = 30;

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterModule, setFilterModule] = useState('');
  const [filterEventType, setFilterEventType] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterOffice, setFilterOffice] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  const isAdmin = usuario?.rol === 'Administrador';

  useEffect(() => {
    if (!isAdmin) return;
    loadInitialData();
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    setPage(0);
    loadLogs(0);
  }, [filterModule, filterEventType, filterRole, filterOffice, filterDateFrom, filterDateTo, searchQuery]);

  const loadInitialData = async () => {
    setLoading(true);
    await Promise.all([
      loadKPIs(),
      loadLogs(0),
      loadTopUsers(),
      loadTopModules(),
      loadOficinas(),
    ]);
    setLoading(false);
  };

  const loadKPIs = async () => {
    const { data } = await supabase.rpc('get_activity_kpis');
    if (data) setKpis(data);
  };

  const loadLogs = useCallback(async (pageNum: number) => {
    setLoadingLogs(true);
    const params: Record<string, unknown> = {
      p_limit: limit,
      p_offset: pageNum * limit,
    };
    if (filterModule) params.p_module_filter = filterModule;
    if (filterEventType) params.p_event_type_filter = filterEventType;
    if (filterRole) params.p_role_filter = filterRole;
    if (filterOffice) params.p_office_id_filter = filterOffice;
    if (filterDateFrom) params.p_date_from = new Date(filterDateFrom).toISOString();
    if (filterDateTo) params.p_date_to = new Date(filterDateTo + 'T23:59:59').toISOString();
    if (searchQuery.trim()) params.p_search = searchQuery.trim();

    const { data } = await supabase.rpc('get_activity_logs', params);
    if (data) {
      setLogs(data.logs || []);
      setTotalLogs(data.total || 0);
    }
    setLoadingLogs(false);
  }, [filterModule, filterEventType, filterRole, filterOffice, filterDateFrom, filterDateTo, searchQuery]);

  const loadTopUsers = async () => {
    const { data } = await supabase.rpc('get_top_active_users', { p_limit: 8 });
    if (data) setTopUsers(data);
  };

  const loadTopModules = async () => {
    const { data } = await supabase.rpc('get_top_modules');
    if (data) setTopModules(data);
  };

  const loadOficinas = async () => {
    const { data } = await supabase.from('oficinas').select('id, nombre').eq('activa', true).order('nombre');
    if (data) setOficinas(data);
  };

  const loadUserDetail = async (userId: string) => {
    setSelectedUserId(userId);
    setShowUserDetail(true);
    setLoadingUserDetail(true);
    const { data } = await supabase.rpc('get_activity_logs', {
      p_user_id_filter: userId,
      p_limit: 50,
      p_offset: 0,
    });
    if (data) setUserDetailLogs(data.logs || []);
    setLoadingUserDetail(false);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    loadLogs(newPage);
  };

  const exportCSV = () => {
    if (logs.length === 0) return;
    const headers = ['Fecha', 'Usuario', 'Email', 'Rol', 'Oficina', 'Modulo', 'Accion', 'Resumen', 'Estado'];
    const rows = logs.map(l => [
      formatDateTime(l.created_at),
      l.user_name_snapshot,
      l.email_snapshot,
      l.role_snapshot,
      l.office_name_snapshot,
      MODULE_LABELS[l.module] || l.module,
      l.action,
      l.summary,
      l.status,
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `actividad_usuarios_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setFilterModule('');
    setFilterEventType('');
    setFilterRole('');
    setFilterOffice('');
    setFilterDateFrom('');
    setFilterDateTo('');
  };

  const hasActiveFilters = filterModule || filterEventType || filterRole || filterOffice || filterDateFrom || filterDateTo || searchQuery;

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Shield className="w-12 h-12 text-neutral-300 dark:text-white/20 mb-3" />
        <p className="text-neutral-500 dark:text-white/40 text-sm">Acceso restringido a administradores</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-48 bg-neutral-100 dark:bg-white/8 rounded-lg" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-neutral-100 dark:bg-white/8 rounded-2xl" />)}
        </div>
        <div className="h-96 bg-neutral-100 dark:bg-white/8 rounded-2xl" />
      </div>
    );
  }

  const totalPages = Math.ceil(totalLogs / limit);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Actividad de Usuarios"
        description="Auditoria y trazabilidad de acciones"
        icon={Activity}
        actions={
          <button
            onClick={exportCSV}
            disabled={logs.length === 0}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-neutral-100 dark:bg-white/8 hover:bg-neutral-200 dark:hover:bg-white/12 text-sm font-medium text-neutral-700 dark:text-white/70 transition-colors disabled:opacity-40"
          >
            <Download className="w-4 h-4" />
            Exportar
          </button>
        }
      />

      {/* KPIs */}
      {kpis && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          <KPICard icon={UserCheck} label="Activos hoy" value={kpis.active_today} color="emerald" />
          <KPICard icon={Users} label="Semana" value={kpis.active_this_week} color="sky" />
          <KPICard icon={Users} label="Mes" value={kpis.active_this_month} color="sky" />
          <KPICard icon={LogIn} label="Logins hoy" value={kpis.total_logins_today} color="accent" />
          <KPICard icon={UserX} label="Inactivos 30d" value={kpis.inactive_users} color="red" />
          <KPICard icon={GraduationCap} label="Cursos mes" value={kpis.courses_started_month} color="amber" />
          <KPICard icon={Activity} label="Eventos hoy" value={kpis.total_events_today} color="neutral" />
        </div>
      )}

      {/* Top Users & Modules */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Users */}
        <div className="bg-white dark:bg-neutral-800/50 rounded-2xl border border-neutral-200/60 dark:border-white/8 shadow-card p-4">
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            Usuarios mas activos (mes)
          </h3>
          {topUsers.length === 0 ? (
            <p className="text-xs text-neutral-400 dark:text-white/30 text-center py-4">Sin datos aun</p>
          ) : (
            <div className="space-y-1.5">
              {topUsers.map((u, i) => (
                <button
                  key={u.user_id}
                  onClick={() => loadUserDetail(u.user_id)}
                  className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors text-left"
                >
                  <span className="text-xs font-bold text-neutral-400 dark:text-white/30 w-5">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-neutral-900 dark:text-white truncate">{u.nombre}</p>
                    <p className="text-[10px] text-neutral-400 dark:text-white/30">{u.rol} - {u.oficina}</p>
                  </div>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{u.total_actions}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Top Modules */}
        <div className="bg-white dark:bg-neutral-800/50 rounded-2xl border border-neutral-200/60 dark:border-white/8 shadow-card p-4">
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-3 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-sky-500" />
            Modulos mas usados (mes)
          </h3>
          {topModules.length === 0 ? (
            <p className="text-xs text-neutral-400 dark:text-white/30 text-center py-4">Sin datos aun</p>
          ) : (
            <div className="space-y-2">
              {topModules.map((m) => {
                const maxEvents = topModules[0]?.total_events || 1;
                const pct = (m.total_events / maxEvents) * 100;
                return (
                  <div key={m.module} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-neutral-700 dark:text-white/70">
                        {MODULE_LABELS[m.module] || m.module}
                      </span>
                      <span className="text-[10px] text-neutral-400 dark:text-white/30">
                        {m.total_events} eventos / {m.unique_users} usuarios
                      </span>
                    </div>
                    <div className="h-1.5 bg-neutral-100 dark:bg-white/8 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-sky-400 to-sky-500 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-neutral-800/50 rounded-2xl border border-neutral-200/60 dark:border-white/8 shadow-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-neutral-400" />
          <span className="text-sm font-semibold text-neutral-900 dark:text-white">Filtros</span>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="ml-auto text-xs text-accent hover:underline">
              Limpiar filtros
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2">
          <div className="relative col-span-2 sm:col-span-1">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-neutral-400" />
            <input
              type="text"
              placeholder="Buscar..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
          <select value={filterModule} onChange={e => setFilterModule(e.target.value)} className="text-xs rounded-lg border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 px-2.5 py-2 text-neutral-700 dark:text-white/70 focus:outline-none focus:ring-2 focus:ring-accent/30">
            <option value="">Modulo</option>
            {Object.entries(MODULE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={filterEventType} onChange={e => setFilterEventType(e.target.value)} className="text-xs rounded-lg border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 px-2.5 py-2 text-neutral-700 dark:text-white/70 focus:outline-none focus:ring-2 focus:ring-accent/30">
            <option value="">Tipo evento</option>
            {Object.entries(EVENT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={filterRole} onChange={e => setFilterRole(e.target.value)} className="text-xs rounded-lg border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 px-2.5 py-2 text-neutral-700 dark:text-white/70 focus:outline-none focus:ring-2 focus:ring-accent/30">
            <option value="">Rol</option>
            <option value="Administrador">Administrador</option>
            <option value="Gerente">Gerente</option>
            <option value="Empleado">Empleado</option>
            <option value="Agente">Agente</option>
          </select>
          <select value={filterOffice} onChange={e => setFilterOffice(e.target.value)} className="text-xs rounded-lg border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 px-2.5 py-2 text-neutral-700 dark:text-white/70 focus:outline-none focus:ring-2 focus:ring-accent/30">
            <option value="">Oficina</option>
            {oficinas.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
          </select>
          <input
            type="date"
            value={filterDateFrom}
            onChange={e => setFilterDateFrom(e.target.value)}
            className="text-xs rounded-lg border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 px-2.5 py-2 text-neutral-700 dark:text-white/70 focus:outline-none focus:ring-2 focus:ring-accent/30"
            placeholder="Desde"
          />
          <input
            type="date"
            value={filterDateTo}
            onChange={e => setFilterDateTo(e.target.value)}
            className="text-xs rounded-lg border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 px-2.5 py-2 text-neutral-700 dark:text-white/70 focus:outline-none focus:ring-2 focus:ring-accent/30"
            placeholder="Hasta"
          />
        </div>
      </div>

      {/* Activity Table */}
      <div className="bg-white dark:bg-neutral-800/50 rounded-2xl border border-neutral-200/60 dark:border-white/8 shadow-card overflow-hidden">
        <div className="px-4 py-3 border-b border-neutral-100 dark:border-white/8 flex items-center justify-between">
          <span className="text-sm font-semibold text-neutral-900 dark:text-white">
            Registro de actividad
            <span className="ml-2 text-xs font-normal text-neutral-400">({totalLogs.toLocaleString()} eventos)</span>
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(Math.max(0, page - 1))}
              disabled={page === 0}
              className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-white/8 disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-neutral-600 dark:text-white/50" />
            </button>
            <span className="text-xs text-neutral-500 dark:text-white/40">
              {page + 1} / {Math.max(1, totalPages)}
            </span>
            <button
              onClick={() => handlePageChange(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-white/8 disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-neutral-600 dark:text-white/50" />
            </button>
          </div>
        </div>

        {loadingLogs ? (
          <div className="p-8 flex justify-center">
            <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center">
            <Activity className="w-10 h-10 text-neutral-200 dark:text-white/15 mx-auto mb-3" />
            <p className="text-sm text-neutral-400 dark:text-white/30">No hay actividad registrada</p>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="mt-2 text-xs text-accent hover:underline">
                Limpiar filtros
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-neutral-50 dark:bg-white/3 border-b border-neutral-100 dark:border-white/5">
                  <th className="text-left px-4 py-2.5 font-semibold text-neutral-500 dark:text-white/40">Fecha</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-neutral-500 dark:text-white/40">Usuario</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-neutral-500 dark:text-white/40 hidden lg:table-cell">Oficina</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-neutral-500 dark:text-white/40">Modulo</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-neutral-500 dark:text-white/40">Accion</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-neutral-500 dark:text-white/40 hidden md:table-cell">Estado</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-neutral-500 dark:text-white/40 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50 dark:divide-white/3">
                {logs.map((log) => {
                  const ModIcon = MODULE_ICONS[log.module] || Activity;
                  const statusCfg = STATUS_CONFIG[log.status] || STATUS_CONFIG.success;
                  return (
                    <tr key={log.id} className="hover:bg-neutral-50/50 dark:hover:bg-white/3 transition-colors">
                      <td className="px-4 py-2.5">
                        <span className="text-neutral-600 dark:text-white/60 whitespace-nowrap">
                          {formatRelativeTime(log.created_at)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => loadUserDetail(log.user_id)}
                          className="text-left hover:text-accent transition-colors"
                        >
                          <p className="font-medium text-neutral-900 dark:text-white truncate max-w-[140px]">
                            {log.user_name_snapshot}
                          </p>
                          <p className="text-[10px] text-neutral-400 dark:text-white/30">{log.role_snapshot}</p>
                        </button>
                      </td>
                      <td className="px-4 py-2.5 hidden lg:table-cell">
                        <span className="text-neutral-500 dark:text-white/40 truncate max-w-[100px] block">
                          {log.office_name_snapshot || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <ModIcon className="w-3.5 h-3.5 text-neutral-400 dark:text-white/30 flex-shrink-0" />
                          <span className="text-neutral-700 dark:text-white/60">
                            {MODULE_LABELS[log.module] || log.module}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <p className="text-neutral-900 dark:text-white font-medium truncate max-w-[200px]">
                          {log.summary}
                        </p>
                      </td>
                      <td className="px-4 py-2.5 hidden md:table-cell">
                        <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-semibold", statusCfg.bg, statusCfg.text)}>
                          {log.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-white/8 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5 text-neutral-400" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedLog(null)}>
          <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white">Detalle del evento</h3>
              <button onClick={() => setSelectedLog(null)} className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-white/10">
                <X className="w-4 h-4 text-neutral-500" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <DetailRow label="Fecha" value={formatDateTime(selectedLog.created_at)} />
              <DetailRow label="Usuario" value={selectedLog.user_name_snapshot} />
              <DetailRow label="Email" value={selectedLog.email_snapshot} />
              <DetailRow label="Rol" value={selectedLog.role_snapshot} />
              <DetailRow label="Oficina" value={selectedLog.office_name_snapshot || '-'} />
              <DetailRow label="Modulo" value={MODULE_LABELS[selectedLog.module] || selectedLog.module} />
              <DetailRow label="Tipo" value={EVENT_TYPE_LABELS[selectedLog.event_type] || selectedLog.event_type} />
              <DetailRow label="Accion" value={selectedLog.action} />
              <DetailRow label="Resumen" value={selectedLog.summary} />
              <DetailRow label="Estado" value={selectedLog.status} />
              {selectedLog.entity_type && <DetailRow label="Entidad" value={`${selectedLog.entity_type}: ${selectedLog.entity_id}`} />}
              {selectedLog.metadata?.user_agent && (
                <DetailRow label="Navegador" value={selectedLog.metadata.user_agent.substring(0, 80) + '...'} />
              )}
              {Object.keys(selectedLog.details || {}).length > 0 && (
                <div>
                  <span className="text-neutral-500 dark:text-white/40 font-medium">Detalles:</span>
                  <pre className="mt-1 p-2 rounded-lg bg-neutral-50 dark:bg-white/5 text-[10px] overflow-auto max-h-40 text-neutral-600 dark:text-white/50">
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* User Detail Drawer */}
      {showUserDetail && (
        <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/40 backdrop-blur-sm" onClick={() => setShowUserDetail(false)}>
          <div className="bg-white dark:bg-neutral-800 w-full max-w-md overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white dark:bg-neutral-800 border-b border-neutral-100 dark:border-white/8 px-5 py-4 flex items-center justify-between z-10">
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white">Actividad del usuario</h3>
              <button onClick={() => setShowUserDetail(false)} className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-white/10">
                <X className="w-4 h-4 text-neutral-500" />
              </button>
            </div>
            <div className="p-5">
              {loadingUserDetail ? (
                <div className="flex justify-center py-10">
                  <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                </div>
              ) : userDetailLogs.length === 0 ? (
                <p className="text-xs text-neutral-400 dark:text-white/30 text-center py-10">Sin actividad registrada</p>
              ) : (
                <>
                  {/* User info */}
                  <div className="mb-5 p-3 rounded-xl bg-neutral-50 dark:bg-white/5 border border-neutral-100 dark:border-white/8">
                    <p className="text-sm font-semibold text-neutral-900 dark:text-white">{userDetailLogs[0].user_name_snapshot}</p>
                    <p className="text-[11px] text-neutral-500 dark:text-white/40 mt-0.5">{userDetailLogs[0].email_snapshot}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-[10px] px-2 py-0.5 rounded bg-accent/10 text-accent font-medium">{userDetailLogs[0].role_snapshot}</span>
                      <span className="text-[10px] text-neutral-400 dark:text-white/30">{userDetailLogs[0].office_name_snapshot}</span>
                    </div>
                  </div>

                  {/* Timeline */}
                  <div className="space-y-0">
                    {userDetailLogs.map((log, i) => {
                      const ModIcon = MODULE_ICONS[log.module] || Activity;
                      return (
                        <div key={log.id} className="flex gap-3 pb-4">
                          <div className="flex flex-col items-center">
                            <div className="p-1.5 rounded-lg bg-neutral-100 dark:bg-white/8">
                              <ModIcon className="w-3 h-3 text-neutral-500 dark:text-white/40" />
                            </div>
                            {i < userDetailLogs.length - 1 && (
                              <div className="w-px flex-1 bg-neutral-200 dark:bg-white/10 mt-1" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-neutral-900 dark:text-white">{log.summary}</p>
                            <p className="text-[10px] text-neutral-400 dark:text-white/30 mt-0.5">
                              {MODULE_LABELS[log.module] || log.module} - {formatRelativeTime(log.created_at)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KPICard({ icon: Icon, label, value, color }: { icon: typeof Activity; label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    sky: 'bg-sky-50 dark:bg-sky-500/15 text-sky-600 dark:text-sky-400',
    accent: 'bg-accent/8 dark:bg-accent/15 text-accent',
    red: 'bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400',
    amber: 'bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400',
    neutral: 'bg-neutral-100 dark:bg-white/8 text-neutral-600 dark:text-white/50',
  };
  return (
    <div className="bg-white dark:bg-neutral-800/50 rounded-xl border border-neutral-200/60 dark:border-white/8 shadow-card p-3">
      <div className={cn("inline-flex p-1.5 rounded-lg mb-2", colors[color])}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <p className="text-lg font-bold text-neutral-900 dark:text-white">{value}</p>
      <p className="text-[10px] text-neutral-500 dark:text-white/40 font-medium">{label}</p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-neutral-500 dark:text-white/40 font-medium w-20 flex-shrink-0">{label}</span>
      <span className="text-neutral-900 dark:text-white">{value}</span>
    </div>
  );
}
export default ActividadUsuarios;
