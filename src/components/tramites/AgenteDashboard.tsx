import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  ClipboardList,
  CheckCircle2,
  TrendingUp,
  FileText,
  BarChart3,
  ChevronDown,
  ExternalLink,
  Calendar
} from 'lucide-react';
import {
  getTipoTramiteLabel as centralGetLabel,
  getTipoTramiteArea,
  AREA_CONFIG,
} from '../../lib/registroActividadesTypes';

interface TicketRecord {
  id: string;
  folio: string;
  tipo_tramite: string;
  prioridad: 'Alta' | 'Media' | 'Baja';
  poliza: string | null;
  instrucciones: string;
  fecha_creacion: string;
  cerrado_en: string | null;
  estatus_id: string;
  estatus: { id: string; nombre: string; color: string } | null;
  responsable: { nombre_completo: string } | null;
}

interface EstatusGroup {
  id: string;
  nombre: string;
  color: string;
  count: number;
  tickets: TicketRecord[];
}

interface DashboardData {
  totalActivos: number;
  totalCerrados: number;
  totalTramites: number;
  estatusGroups: EstatusGroup[];
  cerradosGroup: EstatusGroup | null;
  tramitesEsteMes: number;
  cerradosEsteMes: number;
}

const TIPO_LABELS = (tipo: string) => centralGetLabel(tipo);

export function AgenteDashboard() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedStatus, setExpandedStatus] = useState<string | null>(null);

  useEffect(() => {
    if (usuario) loadDashboard();
  }, [usuario]);

  const loadDashboard = async () => {
    if (!usuario) return;

    const [ticketsRes, estatusRes] = await Promise.all([
      supabase
        .from('tickets')
        .select('id, folio, tipo_tramite, prioridad, poliza, instrucciones, fecha_creacion, cerrado_en, estatus_id, estatus:estatus_id(id, nombre, color), responsable:assigned_to_user_id(nombre_completo)')
        .eq('agente_id', usuario.id)
        .order('fecha_creacion', { ascending: false }),
      supabase
        .from('ticket_estatus')
        .select('id, nombre, color')
        .eq('activo', true)
        .order('orden')
    ]);

    const tickets = (ticketsRes.data || []) as TicketRecord[];
    const allEstatus = estatusRes.data || [];

    const activos = tickets.filter(t => !t.cerrado_en);
    const cerrados = tickets.filter(t => !!t.cerrado_en);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const tramitesEsteMes = tickets.filter(t => t.fecha_creacion >= startOfMonth).length;
    const cerradosEsteMes = cerrados.filter(t => t.cerrado_en! >= startOfMonth).length;

    const ticketsByStatus = new Map<string, TicketRecord[]>();
    for (const t of activos) {
      const list = ticketsByStatus.get(t.estatus_id) || [];
      list.push(t);
      ticketsByStatus.set(t.estatus_id, list);
    }

    const estatusGroups: EstatusGroup[] = allEstatus
      .map(e => ({
        id: e.id,
        nombre: e.nombre,
        color: e.color,
        count: ticketsByStatus.get(e.id)?.length || 0,
        tickets: ticketsByStatus.get(e.id) || []
      }))
      .filter(g => g.count > 0);

    const cerradosGroup: EstatusGroup | null = cerrados.length > 0
      ? { id: '__cerrados__', nombre: 'Concluidos', color: '#16a34a', count: cerrados.length, tickets: cerrados }
      : null;

    setData({
      totalActivos: activos.length,
      totalCerrados: cerrados.length,
      totalTramites: tickets.length,
      estatusGroups,
      cerradosGroup,
      tramitesEsteMes,
      cerradosEsteMes
    });
    setLoading(false);
  };

  const toggleStatus = (statusId: string) => {
    setExpandedStatus(prev => prev === statusId ? null : statusId);
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-neutral-800/50 rounded-2xl shadow-soft border border-neutral-200 dark:border-white/8 p-8">
        <div className="flex justify-center">
          <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!data || data.totalTramites === 0) return null;

  const completionRate = data.totalTramites > 0
    ? Math.round((data.totalCerrados / data.totalTramites) * 100)
    : 0;

  const allGroups = [...data.estatusGroups, ...(data.cerradosGroup ? [data.cerradosGroup] : [])];

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Activos"
          value={data.totalActivos}
          icon={ClipboardList}
          color="blue"
        />
        <KpiCard
          label="Concluidos"
          value={data.totalCerrados}
          icon={CheckCircle2}
          color="green"
          subtitle={`${completionRate}% completados`}
        />
        <KpiCard
          label="Este mes"
          value={data.tramitesEsteMes}
          icon={TrendingUp}
          color="teal"
          subtitle={`${data.cerradosEsteMes} cerrados`}
        />
        <KpiCard
          label="Total"
          value={data.totalTramites}
          icon={FileText}
          color="amber"
          subtitle="historicos"
        />
      </div>

      {/* Interactive status groups */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">
          <div className="bg-white dark:bg-neutral-800/50 rounded-2xl shadow-soft border border-neutral-200 dark:border-white/8 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-neutral-700 dark:text-white/70 uppercase tracking-wide flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-neutral-400 dark:text-white/30" />
                Mis tramites por estatus
              </h3>
              <span className="text-xs text-neutral-500 dark:text-white/40">
                Haz clic para ver detalles
              </span>
            </div>

            {data.estatusGroups.length === 0 && !data.cerradosGroup ? (
              <p className="text-sm text-neutral-500 dark:text-white/40 py-4 text-center">Sin tramites</p>
            ) : (
              <div className="space-y-2">
                {allGroups.map(group => {
                  const isExpanded = expandedStatus === group.id;
                  const pct = data.totalTramites > 0 ? (group.count / data.totalTramites) * 100 : 0;

                  return (
                    <div key={group.id} className="rounded-xl border border-neutral-200 dark:border-white/8 overflow-hidden transition-all duration-200">
                      {/* Status header - clickable */}
                      <button
                        onClick={() => toggleStatus(group.id)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors text-left group"
                      >
                        <span className="text-neutral-400 dark:text-white/30 transition-transform duration-200" style={{ transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}>
                          <ChevronDown className="w-4 h-4" />
                        </span>
                        <span
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: group.color }}
                        />
                        <span className="text-sm font-semibold text-neutral-800 dark:text-white/80 flex-1">{group.nombre}</span>
                        <span
                          className="text-xs font-bold px-2.5 py-1 rounded-full border"
                          style={{
                            backgroundColor: group.color + '15',
                            color: group.color,
                            borderColor: group.color + '40'
                          }}
                        >
                          {group.count}
                        </span>
                        <div className="w-24 h-1.5 bg-neutral-100 dark:bg-white/10 rounded-full overflow-hidden hidden sm:block">
                          <div
                            className="h-full rounded-full transition-all duration-500 ease-out"
                            style={{ width: `${pct}%`, backgroundColor: group.color }}
                          />
                        </div>
                      </button>

                      {/* Expanded ticket list */}
                      {isExpanded && (
                        <div className="border-t border-neutral-100 dark:border-white/5 bg-neutral-50/50 dark:bg-white/[0.03]">
                          <div className="divide-y divide-neutral-100 dark:divide-white/5">
                            {group.tickets.slice(0, 20).map(ticket => (
                              <TicketRow key={ticket.id} ticket={ticket} onNavigate={() => navigate(`/tramites/${ticket.id}`)} />
                            ))}
                          </div>
                          {group.tickets.length > 20 && (
                            <div className="px-4 py-2 text-center">
                              <span className="text-xs text-neutral-500 dark:text-white/40">
                                Mostrando 20 de {group.tickets.length} tramites
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Priority & quick stats */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-neutral-800/50 rounded-2xl shadow-soft border border-neutral-200 dark:border-white/8 p-5">
            <h3 className="text-sm font-semibold text-neutral-700 dark:text-white/70 uppercase tracking-wide mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-neutral-400 dark:text-white/30" />
              Por tipo
            </h3>
            <div className="space-y-3">
              {(() => {
                const activos = data.estatusGroups.flatMap(g => g.tickets);
                const byType: Record<string, number> = {};
                for (const t of activos) {
                  byType[t.tipo_tramite] = (byType[t.tipo_tramite] || 0) + 1;
                }
                const entries = Object.entries(byType).sort((a, b) => b[1] - a[1]);
                return entries.map(([tipo, count]) => {
                  const area = getTipoTramiteArea(tipo);
                  const ac = AREA_CONFIG[area];
                  return (
                    <div key={tipo} className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${ac.bg.replace('bg-', 'bg-')}`} style={{ backgroundColor: ac.color.includes('sky') ? '#0369a1' : '#b45309' }} />
                        <span className="text-sm text-neutral-700 dark:text-white/70 truncate">{TIPO_LABELS(tipo)}</span>
                      </div>
                      <span className="text-sm font-bold text-neutral-900 dark:text-white flex-shrink-0">{count}</span>
                    </div>
                  );
                });
              })()}
              {data.cerradosGroup && (
                <div className="flex items-center justify-between pt-2 border-t border-neutral-100 dark:border-white/5">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full flex-shrink-0 bg-green-500" />
                    <span className="text-sm text-neutral-700 dark:text-white/70">Concluidos</span>
                  </div>
                  <span className="text-sm font-bold text-neutral-900 dark:text-white">{data.cerradosGroup.count}</span>
                </div>
              )}
              <div className="flex items-center justify-between pt-2 border-t border-neutral-200 dark:border-white/8">
                <span className="text-sm font-semibold text-neutral-800 dark:text-white/80">Total</span>
                <span className="text-sm font-bold text-accent">{data.totalTramites}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TicketRow({ ticket, onNavigate }: { ticket: TicketRecord; onNavigate: () => void }) {
  const getPrioridadStyle = (p: string) => {
    switch (p) {
      case 'Alta': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      case 'Media': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
      case 'Baja': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      default: return 'bg-neutral-100 text-neutral-600 dark:bg-white/10 dark:text-white/50';
    }
  };

  return (
    <div
      onClick={onNavigate}
      className="flex items-center gap-3 px-4 py-3 hover:bg-white dark:hover:bg-white/5 cursor-pointer transition-colors group"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-bold text-accent">{ticket.folio}</span>
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${getPrioridadStyle(ticket.prioridad)}`}>
            {ticket.prioridad}
          </span>
          {(() => {
            const area = getTipoTramiteArea(ticket.tipo_tramite);
            const ac = AREA_CONFIG[area];
            return (
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${ac.bg} ${ac.color}`}>
                {TIPO_LABELS(ticket.tipo_tramite)}
              </span>
            );
          })()}
        </div>
        <p className="text-sm text-neutral-700 dark:text-white/70 truncate">{ticket.instrucciones}</p>
        <div className="flex items-center gap-3 mt-1 text-xs text-neutral-500 dark:text-white/40">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {new Date(ticket.fecha_creacion).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
          {ticket.poliza && (
            <span className="flex items-center gap-1">
              <FileText className="w-3 h-3" />
              {ticket.poliza}
            </span>
          )}
          {ticket.responsable?.nombre_completo && (
            <span className="hidden sm:inline">
              Resp: {ticket.responsable.nombre_completo}
            </span>
          )}
        </div>
      </div>
      <ExternalLink className="w-4 h-4 text-neutral-300 dark:text-white/20 group-hover:text-accent transition-colors flex-shrink-0" />
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  color,
  subtitle,
  subtitleColor
}: {
  label: string;
  value: string | number;
  icon: any;
  color: 'blue' | 'green' | 'teal' | 'amber';
  subtitle?: string;
  subtitleColor?: string;
}) {
  const styles = {
    blue: { bg: 'from-blue-50 to-blue-100/50 dark:from-blue-900/20 dark:to-blue-900/10', icon: 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30', border: 'border-blue-200/60 dark:border-blue-800/30' },
    green: { bg: 'from-green-50 to-green-100/50 dark:from-green-900/20 dark:to-green-900/10', icon: 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30', border: 'border-green-200/60 dark:border-green-800/30' },
    teal: { bg: 'from-teal-50 to-teal-100/50 dark:from-teal-900/20 dark:to-teal-900/10', icon: 'text-teal-600 bg-teal-100 dark:text-teal-400 dark:bg-teal-900/30', border: 'border-teal-200/60 dark:border-teal-800/30' },
    amber: { bg: 'from-amber-50 to-amber-100/50 dark:from-amber-900/20 dark:to-amber-900/10', icon: 'text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30', border: 'border-amber-200/60 dark:border-amber-800/30' },
  };

  const c = styles[color];

  return (
    <div className={`bg-gradient-to-br ${c.bg} rounded-2xl border ${c.border} p-4 sm:p-5`}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs sm:text-sm font-semibold text-neutral-600 dark:text-white/60 uppercase tracking-wide">{label}</p>
        <div className={`p-2 rounded-xl ${c.icon}`}>
          <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
      </div>
      <p className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-white tracking-tight">{value}</p>
      {subtitle && (
        <p className={`text-xs sm:text-sm mt-1 font-medium ${subtitleColor || 'text-neutral-500 dark:text-white/40'}`}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

