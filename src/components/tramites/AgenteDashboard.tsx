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
  BarChart3
} from 'lucide-react';

interface EstatusCount {
  id: string;
  nombre: string;
  color: string;
  count: number;
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
  estatusCounts: EstatusCount[];
  prioridades: PriorityCount;
  avgDaysToClose: number | null;
  tramitesEsteMes: number;
  cerradosEsteMes: number;
  ultimoTramite: { folio: string; id: string; fecha: string; estatus: string; color: string } | null;
}

export function AgenteDashboard() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (usuario) loadDashboard();
  }, [usuario]);

  const loadDashboard = async () => {
    if (!usuario) return;

    const [ticketsRes, estatusRes] = await Promise.all([
      supabase
        .from('tickets')
        .select('id, folio, fecha_creacion, cerrado_en, prioridad, estatus_id, estatus:estatus_id(id, nombre, color)')
        .eq('agente_id', usuario.id),
      supabase
        .from('ticket_estatus')
        .select('id, nombre, color')
        .eq('activo', true)
        .order('orden')
    ]);

    const tickets = ticketsRes.data || [];
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

    const countMap = new Map<string, number>();
    for (const t of activos) {
      countMap.set(t.estatus_id, (countMap.get(t.estatus_id) || 0) + 1);
    }

    const estatusCounts: EstatusCount[] = allEstatus
      .map(e => ({ id: e.id, nombre: e.nombre, color: e.color, count: countMap.get(e.id) || 0 }))
      .filter(e => e.count > 0);

    let avgDaysToClose: number | null = null;
    if (cerrados.length > 0) {
      const totalDays = cerrados.reduce((sum, t) => {
        const created = new Date(t.fecha_creacion).getTime();
        const closed = new Date(t.cerrado_en!).getTime();
        return sum + (closed - created) / 86400000;
      }, 0);
      avgDaysToClose = Math.round((totalDays / cerrados.length) * 10) / 10;
    }

    const sorted = [...tickets].sort((a, b) =>
      new Date(b.fecha_creacion).getTime() - new Date(a.fecha_creacion).getTime()
    );
    const last = sorted[0];
    const ultimoTramite = last
      ? {
          id: last.id,
          folio: last.folio,
          fecha: last.fecha_creacion,
          estatus: (last.estatus as any)?.nombre || 'Sin estatus',
          color: (last.estatus as any)?.color || '#6b7280'
        }
      : null;

    setData({
      totalActivos: activos.length,
      totalCerrados: cerrados.length,
      totalTramites: tickets.length,
      estatusCounts,
      prioridades,
      avgDaysToClose,
      tramitesEsteMes,
      cerradosEsteMes,
      ultimoTramite
    });
    setLoading(false);
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

      {/* Status breakdown + Priority & recent */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Status breakdown */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-soft border border-neutral-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-neutral-700 uppercase tracking-wide flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-neutral-400" />
              Desglose por estatus
            </h3>
            <span className="text-xs text-neutral-500">{data.totalActivos} activos</span>
          </div>

          {data.estatusCounts.length === 0 ? (
            <p className="text-sm text-neutral-500 py-4 text-center">Sin tramites activos</p>
          ) : (
            <div className="space-y-3">
              {data.estatusCounts.map(es => {
                const pct = data.totalActivos > 0 ? (es.count / data.totalActivos) * 100 : 0;
                return (
                  <div key={es.id}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: es.color }}
                        />
                        <span className="text-sm font-medium text-neutral-800">{es.nombre}</span>
                      </div>
                      <span className="text-sm font-bold text-neutral-900">{es.count}</span>
                    </div>
                    <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${pct}%`, backgroundColor: es.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Priority & last ticket */}
        <div className="bg-white rounded-2xl shadow-soft border border-neutral-200 p-5 space-y-5">
          <div>
            <h3 className="text-sm font-semibold text-neutral-700 uppercase tracking-wide mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-neutral-400" />
              Prioridad
            </h3>
            <div className="space-y-2.5">
              <PriorityRow label="Alta" count={data.prioridades.Alta} dotColor="bg-red-500" textColor="text-red-700" />
              <PriorityRow label="Media" count={data.prioridades.Media} dotColor="bg-amber-400" textColor="text-amber-700" />
              <PriorityRow label="Baja" count={data.prioridades.Baja} dotColor="bg-green-500" textColor="text-green-700" />
            </div>
          </div>

          {data.ultimoTramite && (
            <div className="pt-4 border-t border-neutral-100">
              <h3 className="text-sm font-semibold text-neutral-700 uppercase tracking-wide mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4 text-neutral-400" />
                Ultimo tramite
              </h3>
              <div
                onClick={() => navigate(`/tramites/${data.ultimoTramite!.id}`)}
                className="p-3 rounded-xl bg-neutral-50 border border-neutral-200 hover:bg-neutral-100 cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-accent">{data.ultimoTramite.folio}</span>
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full border"
                    style={{
                      backgroundColor: data.ultimoTramite.color + '20',
                      color: data.ultimoTramite.color,
                      borderColor: data.ultimoTramite.color
                    }}
                  >
                    {data.ultimoTramite.estatus}
                  </span>
                </div>
                <p className="text-xs text-neutral-500 mt-1">
                  {new Date(data.ultimoTramite.fecha).toLocaleDateString('es-MX', {
                    day: 'numeric', month: 'short', year: 'numeric'
                  })}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
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
