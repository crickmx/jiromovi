import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  ClipboardList,
  CheckCircle2,
  AlertTriangle,
  Timer,
  TrendingUp,
  FileText,
  BarChart3,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Calendar,
  X
} from 'lucide-react';

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

interface PriorityCount {
  Alta: number;
  Media: number;
  Baja: number;
}

interface DashboardData {
  totalActivos: number;
  totalCerrados: number;
  totalTramites: number;
  estatusGroups: EstatusGroup[];
  cerradosGroup: EstatusGroup | null;
  prioridades: PriorityCount;
  avgDaysToClose: number | null;
  tramitesEsteMes: number;
  cerradosEsteMes: number;
}

const TIPO_LABELS: Record<string, string> = {
  cotizacion_emision: 'Cotizacion / Emision',
  correccion_poliza_registrada: 'Correccion de poliza',
  correccion_comisiones: 'Correccion de comisiones',
  registro_poliza: 'Registro de poliza',
  solicitud_comisiones_pendientes: 'Solicitud de comisiones',
  lead_registro_movi: 'Lead / Registro Movi',
  registro_actividad: 'Registro de actividad',
};

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

    const prioridades: PriorityCount = { Alta: 0, Media: 0, Baja: 0 };
    for (const t of activos) {
      if (t.prioridad === 'Alta' || t.prioridad === 'Media' || t.prioridad === 'Baja') {
        prioridades[t.prioridad]++;
      }
    }

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

    let avgDaysToClose: number | null = null;
    if (cerrados.length > 0) {
      const totalDays = cerrados.reduce((sum, t) => {
        const created = new Date(t.fecha_creacion).getTime();
        const closed = new Date(t.cerrado_en!).getTime();
        return sum + (closed - created) / 86400000;
      }, 0);
      avgDaysToClose = Math.round((totalDays / cerrados.length) * 10) / 10;
    }

    setData({
      totalActivos: activos.length,
      totalCerrados: cerrados.length,
      totalTramites: tickets.length,
      estatusGroups,
      cerradosGroup,
      prioridades,
      avgDaysToClose,
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
      <div className="bg-white rounded-2xl shadow-soft border border-neutral-200 p-8">
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
          subtitle={data.prioridades.Alta > 0 ? `${data.prioridades.Alta} prioridad alta` : undefined}
          subtitleColor={data.prioridades.Alta > 0 ? 'text-red-600' : undefined}
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
          label="Tiempo promedio"
          value={data.avgDaysToClose !== null ? `${data.avgDaysToClose}d` : '--'}
          icon={Timer}
          color="amber"
          subtitle="para cerrar"
        />
      </div>

      {/* Interactive status groups */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">
          <div className="bg-white rounded-2xl shadow-soft border border-neutral-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-neutral-700 uppercase tracking-wide flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-neutral-400" />
                Mis tramites por estatus
              </h3>
              <span className="text-xs text-neutral-500">
                Haz clic para ver detalles
              </span>
            </div>

            {data.estatusGroups.length === 0 && !data.cerradosGroup ? (
              <p className="text-sm text-neutral-500 py-4 text-center">Sin tramites</p>
            ) : (
              <div className="space-y-2">
                {allGroups.map(group => {
                  const isExpanded = expandedStatus === group.id;
                  const pct = data.totalTramites > 0 ? (group.count / data.totalTramites) * 100 : 0;

                  return (
                    <div key={group.id} className="rounded-xl border border-neutral-200 overflow-hidden transition-all duration-200">
                      {/* Status header - clickable */}
                      <button
                        onClick={() => toggleStatus(group.id)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-neutral-50 transition-colors text-left group"
                      >
                        <span className="text-neutral-400 transition-transform duration-200" style={{ transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}>
                          <ChevronDown className="w-4 h-4" />
                        </span>
                        <span
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: group.color }}
                        />
                        <span className="text-sm font-semibold text-neutral-800 flex-1">{group.nombre}</span>
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
                        <div className="w-24 h-1.5 bg-neutral-100 rounded-full overflow-hidden hidden sm:block">
                          <div
                            className="h-full rounded-full transition-all duration-500 ease-out"
                            style={{ width: `${pct}%`, backgroundColor: group.color }}
                          />
                        </div>
                      </button>

                      {/* Expanded ticket list */}
                      {isExpanded && (
                        <div className="border-t border-neutral-100 bg-neutral-50/50">
                          <div className="divide-y divide-neutral-100">
                            {group.tickets.slice(0, 20).map(ticket => (
                              <TicketRow key={ticket.id} ticket={ticket} onNavigate={() => navigate(`/tramites/${ticket.id}`)} />
                            ))}
                          </div>
                          {group.tickets.length > 20 && (
                            <div className="px-4 py-2 text-center">
                              <span className="text-xs text-neutral-500">
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
          <div className="bg-white rounded-2xl shadow-soft border border-neutral-200 p-5">
            <h3 className="text-sm font-semibold text-neutral-700 uppercase tracking-wide mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-neutral-400" />
              Prioridad (Activos)
            </h3>
            <div className="space-y-2.5">
              <PriorityRow label="Alta" count={data.prioridades.Alta} dotColor="bg-red-500" textColor="text-red-700" />
              <PriorityRow label="Media" count={data.prioridades.Media} dotColor="bg-amber-400" textColor="text-amber-700" />
              <PriorityRow label="Baja" count={data.prioridades.Baja} dotColor="bg-green-500" textColor="text-green-700" />
            </div>
          </div>

          {/* Summary grid */}
          <div className="bg-white rounded-2xl shadow-soft border border-neutral-200 p-5">
            <h3 className="text-sm font-semibold text-neutral-700 uppercase tracking-wide mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-neutral-400" />
              Resumen
            </h3>
            <div className="space-y-3">
              {data.estatusGroups.map(g => (
                <div key={g.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: g.color }} />
                    <span className="text-sm text-neutral-700">{g.nombre}</span>
                  </div>
                  <span className="text-sm font-bold text-neutral-900">{g.count}</span>
                </div>
              ))}
              {data.cerradosGroup && (
                <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full flex-shrink-0 bg-green-500" />
                    <span className="text-sm text-neutral-700">Concluidos</span>
                  </div>
                  <span className="text-sm font-bold text-neutral-900">{data.cerradosGroup.count}</span>
                </div>
              )}
              <div className="flex items-center justify-between pt-2 border-t border-neutral-200">
                <span className="text-sm font-semibold text-neutral-800">Total</span>
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
      case 'Alta': return 'bg-red-100 text-red-700';
      case 'Media': return 'bg-amber-100 text-amber-700';
      case 'Baja': return 'bg-green-100 text-green-700';
      default: return 'bg-neutral-100 text-neutral-600';
    }
  };

  return (
    <div
      onClick={onNavigate}
      className="flex items-center gap-3 px-4 py-3 hover:bg-white cursor-pointer transition-colors group"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-bold text-accent">{ticket.folio}</span>
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${getPrioridadStyle(ticket.prioridad)}`}>
            {ticket.prioridad}
          </span>
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600">
            {TIPO_LABELS[ticket.tipo_tramite] || ticket.tipo_tramite}
          </span>
        </div>
        <p className="text-sm text-neutral-700 truncate">{ticket.instrucciones}</p>
        <div className="flex items-center gap-3 mt-1 text-xs text-neutral-500">
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
      <ExternalLink className="w-4 h-4 text-neutral-300 group-hover:text-accent transition-colors flex-shrink-0" />
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
    blue: { bg: 'from-blue-50 to-blue-100/50', icon: 'text-blue-600 bg-blue-100', border: 'border-blue-200/60' },
    green: { bg: 'from-green-50 to-green-100/50', icon: 'text-green-600 bg-green-100', border: 'border-green-200/60' },
    teal: { bg: 'from-teal-50 to-teal-100/50', icon: 'text-teal-600 bg-teal-100', border: 'border-teal-200/60' },
    amber: { bg: 'from-amber-50 to-amber-100/50', icon: 'text-amber-600 bg-amber-100', border: 'border-amber-200/60' },
  };

  const c = styles[color];

  return (
    <div className={`bg-gradient-to-br ${c.bg} rounded-2xl border ${c.border} p-4 sm:p-5`}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs sm:text-sm font-semibold text-neutral-600 uppercase tracking-wide">{label}</p>
        <div className={`p-2 rounded-xl ${c.icon}`}>
          <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
      </div>
      <p className="text-2xl sm:text-3xl font-bold text-neutral-900 tracking-tight">{value}</p>
      {subtitle && (
        <p className={`text-xs sm:text-sm mt-1 font-medium ${subtitleColor || 'text-neutral-500'}`}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

function PriorityRow({ label, count, dotColor, textColor }: {
  label: string;
  count: number;
  dotColor: string;
  textColor: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${dotColor}`} />
        <span className={`text-sm font-medium ${textColor}`}>{label}</span>
      </div>
      <span className="text-sm font-bold text-neutral-900">{count}</span>
    </div>
  );
}
