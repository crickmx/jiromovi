import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { PageHeader } from '@/components/ui/page-header';
import { LoadingState } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { Eye, Clock, CheckCircle2, XCircle, Search, Shield, Smartphone } from 'lucide-react';
import { formatDistanceToNow, differenceInSeconds, formatDuration } from 'date-fns';
import { es } from 'date-fns/locale';

interface SessionRow {
  id: string;
  admin_user_id: string;
  impersonated_user_id: string | null;
  impersonated_customer_id: string | null;
  platform: 'movi' | 'seguwallet';
  status: 'active' | 'ended';
  reason: string | null;
  started_at: string;
  ended_at: string | null;
  user_agent: string | null;
  admin_user: { nombre_completo: string; email_laboral: string | null } | null;
  impersonated_user: { nombre_completo: string; rol: string } | null;
}

function formatSecondsAsTime(secs: number): string {
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function MascaraAdmin() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPlatform, setFilterPlatform] = useState<'all' | 'movi' | 'seguwallet'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'ended'>('all');

  useEffect(() => { loadSessions(); }, []);

  const loadSessions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('admin_impersonation_sessions')
      .select(`
        *,
        admin_user:usuarios!admin_impersonation_sessions_admin_user_id_fkey(nombre_completo, email_laboral),
        impersonated_user:usuarios!admin_impersonation_sessions_impersonated_user_id_fkey(nombre_completo, rol)
      `)
      .order('started_at', { ascending: false })
      .limit(200);

    if (!error && data) setSessions(data as SessionRow[]);
    setLoading(false);
  };

  const filteredSessions = sessions.filter(s => {
    const term = searchTerm.toLowerCase();
    const matchSearch = !term ||
      s.admin_user?.nombre_completo?.toLowerCase().includes(term) ||
      s.impersonated_user?.nombre_completo?.toLowerCase().includes(term) ||
      s.reason?.toLowerCase().includes(term);
    const matchPlatform = filterPlatform === 'all' || s.platform === filterPlatform;
    const matchStatus = filterStatus === 'all' || s.status === filterStatus;
    return matchSearch && matchPlatform && matchStatus;
  });

  const activeSessions = sessions.filter(s => s.status === 'active');

  return (
    <div className="space-y-5">
      <PageHeader
        title="Mascara de Usuario"
        description="Historial de sesiones de vista admin — solo lectura"
        icon={Eye}
        badge={
          activeSessions.length > 0 ? (
            <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              {activeSessions.length} sesion{activeSessions.length !== 1 ? 'es' : ''} activa{activeSessions.length !== 1 ? 's' : ''}
            </span>
          ) : undefined
        }
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total sesiones', value: sessions.length, icon: Eye, color: 'text-neutral-600 dark:text-white/60' },
          { label: 'Activas ahora', value: activeSessions.length, icon: CheckCircle2, color: activeSessions.length > 0 ? 'text-amber-600' : 'text-neutral-400 dark:text-white/30' },
          { label: 'MOVI Digital', value: sessions.filter(s => s.platform === 'movi').length, icon: Shield, color: 'text-blue-600' },
          { label: 'Seguwallet', value: sessions.filter(s => s.platform === 'seguwallet').length, icon: Smartphone, color: 'text-emerald-600' },
        ].map(stat => (
          <div key={stat.label} className="bg-white dark:bg-neutral-800/50 rounded-xl border border-neutral-200/60 dark:border-white/8 p-4">
            <div className="flex items-center gap-2 mb-1">
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
              <span className="text-xs text-neutral-500 dark:text-white/40 font-medium">{stat.label}</span>
            </div>
            <p className="text-2xl font-bold text-neutral-900 dark:text-white">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-neutral-800/50 rounded-xl border border-neutral-200/60 dark:border-white/8 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 dark:text-white/30" />
            <input
              type="text"
              placeholder="Buscar por admin, usuario mascarado o motivo..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all placeholder:text-neutral-400 dark:placeholder:text-white/30 text-neutral-900 dark:text-white"
            />
          </div>
          <select
            value={filterPlatform}
            onChange={e => setFilterPlatform(e.target.value as typeof filterPlatform)}
            className="px-3 py-2 text-sm bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent text-neutral-700 dark:text-white/80 min-w-[140px]"
          >
            <option value="all">Todas las plataformas</option>
            <option value="movi">MOVI Digital</option>
            <option value="seguwallet">Seguwallet</option>
          </select>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value as typeof filterStatus)}
            className="px-3 py-2 text-sm bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent text-neutral-700 dark:text-white/80 min-w-[120px]"
          >
            <option value="all">Todos los estados</option>
            <option value="active">Activas</option>
            <option value="ended">Terminadas</option>
          </select>
        </div>
      </div>

      {loading ? (
        <LoadingState text="Cargando historial..." />
      ) : filteredSessions.length === 0 ? (
        <EmptyState
          icon={Eye}
          title="Sin sesiones registradas"
          description="Las sesiones de mascara de usuario aparecerán aquí cuando un admin use la función 'Ver como'."
        />
      ) : (
        <div className="bg-white dark:bg-neutral-800/50 rounded-xl border border-neutral-200/60 dark:border-white/8 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-white/8 bg-neutral-50 dark:bg-white/[0.02]">
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-neutral-500 dark:text-white/40">Admin</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-neutral-500 dark:text-white/40">Usuario mascarado</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-neutral-500 dark:text-white/40">Plataforma</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-neutral-500 dark:text-white/40">Estado</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-neutral-500 dark:text-white/40">Inicio</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-neutral-500 dark:text-white/40">Duración</th>
                  <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-neutral-500 dark:text-white/40">Motivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-white/[0.05]">
                {filteredSessions.map(session => {
                  const durationSecs = session.ended_at
                    ? differenceInSeconds(new Date(session.ended_at), new Date(session.started_at))
                    : differenceInSeconds(new Date(), new Date(session.started_at));
                  const isActive = session.status === 'active';

                  return (
                    <tr key={session.id} className={`transition-colors ${isActive ? 'bg-amber-50/50 dark:bg-amber-500/5 hover:bg-amber-50 dark:hover:bg-amber-500/10' : 'hover:bg-neutral-50 dark:hover:bg-white/[0.02]'}`}>
                      <td className="px-4 py-3">
                        <span className="font-medium text-neutral-900 dark:text-white">
                          {session.admin_user?.nombre_completo || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <span className="font-medium text-neutral-900 dark:text-white">
                            {session.impersonated_user?.nombre_completo || (session.impersonated_customer_id ? 'Cliente Seguwallet' : '—')}
                          </span>
                          {session.impersonated_user?.rol && (
                            <span className="ml-1.5 text-[11px] font-medium text-neutral-500 dark:text-white/40 bg-neutral-100 dark:bg-white/8 px-1.5 py-0.5 rounded">
                              {session.impersonated_user.rol}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                          session.platform === 'movi'
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400'
                            : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                        }`}>
                          {session.platform === 'movi' ? <Shield className="w-3 h-3" /> : <Smartphone className="w-3 h-3" />}
                          {session.platform === 'movi' ? 'MOVI' : 'Seguwallet'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            Activa
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-500 dark:bg-white/8 dark:text-white/40">
                            <CheckCircle2 className="w-3 h-3" />
                            Terminada
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-neutral-500 dark:text-white/40 text-xs whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          <span title={new Date(session.started_at).toLocaleString('es-MX')}>
                            {formatDistanceToNow(new Date(session.started_at), { addSuffix: true, locale: es })}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-neutral-600 dark:text-white/60 text-xs font-mono">
                        {isActive ? (
                          <span className="text-amber-600 dark:text-amber-400 font-medium">
                            {formatSecondsAsTime(durationSecs)} (en curso)
                          </span>
                        ) : (
                          formatSecondsAsTime(durationSecs)
                        )}
                      </td>
                      <td className="px-4 py-3 text-neutral-500 dark:text-white/40 text-xs max-w-[200px] truncate">
                        {session.reason || <span className="italic opacity-50">Sin motivo</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-neutral-100 dark:border-white/5">
            <p className="text-xs text-neutral-400 dark:text-white/30">
              {filteredSessions.length} sesion{filteredSessions.length !== 1 ? 'es' : ''} — últimas 200 registros
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default MascaraAdmin;
