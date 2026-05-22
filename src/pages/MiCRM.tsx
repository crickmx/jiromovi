import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Users,
  FileText,
  CheckCircle,
  DollarSign,
  Clock,
  Settings,
  AlertTriangle,
  UserPlus,
  PhoneCall,
  CalendarCheck,
  Kanban,
  BarChart3,
  RefreshCw,
  ChevronRight,
  Calendar,
  Phone,
  Mail,
  CheckCircle2,
  CalendarClock,
  UserX,
  Zap,
  LayoutGrid,
} from 'lucide-react';
import {
  obtenerKPIsDashboard,
  obtenerTareasVencidas,
  obtenerTareasHoy,
  obtenerLeadsNuevos,
  obtenerLeadsSinSeguimiento,
  completarTareaRapido,
  reprogramarTarea,
  obtenerEstadisticasDashboard,
  obtenerDatosFunnel,
} from '../lib/crmUtils';
import type { DashboardStats, FunnelData, CRMContacto } from '../lib/crmTypes';
import TablerosSeccion from '../components/crm/TablerosSeccion';
import { useAuth } from '../contexts/AuthContext';
import { PageHeader } from '@/components/ui/page-header';

interface CRMDashboardKPIs {
  leadsNuevos: number;
  leadsContactados: number;
  tareasVencidas: number;
  tareasHoy: number;
  sinSeguimiento: number;
}

export default function MiCRM() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const [kpis, setKpis] = useState<CRMDashboardKPIs | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [funnel, setFunnel] = useState<FunnelData | null>(null);
  const [tareasVencidas, setTareasVencidas] = useState<any[]>([]);
  const [tareasHoy, setTareasHoy] = useState<any[]>([]);
  const [leadsNuevos, setLeadsNuevos] = useState<CRMContacto[]>([]);
  const [leadsSinSeguimiento, setLeadsSinSeguimiento] = useState<CRMContacto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const rolPermitido = usuario?.rol && ['Empleado', 'Gerente', 'Administrador'].includes(usuario.rol);

  const cargarDatos = useCallback(async (silencioso = false) => {
    try {
      if (!silencioso) setLoading(true);
      else setRefreshing(true);

      const [kpisData, statsData, funnelData, vencidasData, hoyData, nuevosData, sinSegData] =
        await Promise.all([
          obtenerKPIsDashboard(),
          obtenerEstadisticasDashboard(),
          obtenerDatosFunnel(),
          obtenerTareasVencidas(5),
          obtenerTareasHoy(5),
          obtenerLeadsNuevos(5),
          obtenerLeadsSinSeguimiento(5),
        ]);

      setKpis(kpisData);
      setStats(statsData);
      setFunnel(funnelData);
      setTareasVencidas(vencidasData);
      setTareasHoy(hoyData);
      setLeadsNuevos(nuevosData);
      setLeadsSinSeguimiento(sinSegData);
    } catch (error) {
      console.error('Error al cargar dashboard CRM:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const handleCompletarTarea = async (tareaId: string) => {
    try {
      await completarTareaRapido(tareaId);
      cargarDatos(true);
    } catch (error) {
      console.error('Error al completar tarea:', error);
    }
  };

  const handleReprogramarTarea = async (tareaId: string) => {
    const manana = new Date();
    manana.setDate(manana.getDate() + 1);
    manana.setHours(9, 0, 0, 0);
    try {
      await reprogramarTarea(tareaId, manana.toISOString());
      cargarDatos(true);
    } catch (error) {
      console.error('Error al reprogramar tarea:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-accent border-t-transparent mx-auto mb-3"></div>
          <p className="text-sm text-neutral-500 dark:text-white/50">Cargando tu CRM...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <PageHeader
        title="Mi CRM"
        description={new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
        icon={LayoutGrid}
        actions={
          <button
            onClick={() => cargarDatos(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-neutral-600 dark:text-white/60 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700 transition disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Actualizar</span>
          </button>
        }
      />

      {/* Navigation Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6 mt-6">
        <Link
          to="/mi-crm/contactos"
          className="group flex flex-col items-center p-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl hover:border-blue-300 hover:shadow-md transition-all"
        >
          <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-blue-50 text-blue-600 group-hover:bg-blue-100 transition mb-2">
            <Users className="h-5 w-5" />
          </div>
          <span className="text-xs font-medium text-neutral-700 dark:text-white/70 text-center">Contactos</span>
        </Link>

        <Link
          to="/mi-crm/tareas"
          className="group flex flex-col items-center p-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl hover:border-orange-300 hover:shadow-md transition-all"
        >
          <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-orange-50 text-orange-600 group-hover:bg-orange-100 transition mb-2">
            <CheckCircle className="h-5 w-5" />
          </div>
          <span className="text-xs font-medium text-neutral-700 dark:text-white/70 text-center">Tareas</span>
        </Link>

        <Link
          to="/mi-crm/contactos?view=kanban"
          className="group flex flex-col items-center p-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl hover:border-teal-300 hover:shadow-md transition-all"
        >
          <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-teal-50 text-teal-600 group-hover:bg-teal-100 transition mb-2">
            <Kanban className="h-5 w-5" />
          </div>
          <span className="text-xs font-medium text-neutral-700 dark:text-white/70 text-center">Embudo</span>
        </Link>

        <Link
          to="/mi-crm/reportes"
          className="group flex flex-col items-center p-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl hover:border-emerald-300 hover:shadow-md transition-all"
        >
          <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100 transition mb-2">
            <BarChart3 className="h-5 w-5" />
          </div>
          <span className="text-xs font-medium text-neutral-700 dark:text-white/70 text-center">Reportes</span>
        </Link>

        <Link
          to="/mi-crm/configuracion"
          className="group flex flex-col items-center p-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl hover:border-neutral-400 hover:shadow-md transition-all"
        >
          <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-white/60 group-hover:bg-neutral-200 dark:group-hover:bg-neutral-700 transition mb-2">
            <Settings className="h-5 w-5" />
          </div>
          <span className="text-xs font-medium text-neutral-700 dark:text-white/70 text-center">Config</span>
        </Link>

        <Link
          to="/mi-crm/contactos"
          state={{ openNew: true }}
          className="group flex flex-col items-center p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/30 rounded-xl hover:border-blue-400 hover:shadow-md transition-all"
        >
          <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-blue-100 text-blue-700 group-hover:bg-blue-200 transition mb-2">
            <UserPlus className="h-5 w-5" />
          </div>
          <span className="text-xs font-medium text-blue-700 dark:text-blue-400 text-center">Nuevo Lead</span>
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        <KPICard
          label="Leads Nuevos"
          value={kpis?.leadsNuevos || 0}
          icon={<UserPlus className="h-5 w-5" />}
          color="blue"
          onClick={() => navigate('/mi-crm/contactos?filter=nuevos')}
          subtitle="ultimas 24h"
        />
        <KPICard
          label="Contactados"
          value={kpis?.leadsContactados || 0}
          icon={<PhoneCall className="h-5 w-5" />}
          color="green"
          onClick={() => navigate('/mi-crm/contactos?filter=contactados')}
          subtitle="en proceso"
        />
        <KPICard
          label="Tareas Vencidas"
          value={kpis?.tareasVencidas || 0}
          icon={<AlertTriangle className="h-5 w-5" />}
          color="red"
          onClick={() => navigate('/mi-crm/tareas?filter=vencidas')}
          urgent={kpis?.tareasVencidas ? kpis.tareasVencidas > 0 : false}
        />
        <KPICard
          label="Tareas Hoy"
          value={kpis?.tareasHoy || 0}
          icon={<CalendarCheck className="h-5 w-5" />}
          color="orange"
          onClick={() => navigate('/mi-crm/tareas?filter=hoy')}
          subtitle="pendientes"
        />
        <KPICard
          label="Sin Seguimiento"
          value={kpis?.sinSeguimiento || 0}
          icon={<UserX className="h-5 w-5" />}
          color="amber"
          onClick={() => navigate('/mi-crm/contactos?filter=sin_seguimiento')}
          subtitle="+24h sin contacto"
        />
      </div>

      {/* Que hacer hoy + Embudo */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Que hacer hoy - 2/3 */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
            <div className="px-5 py-4 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-orange-500" />
                <h2 className="font-semibold text-neutral-900 dark:text-white">Que hacer hoy</h2>
              </div>
              <Link to="/mi-crm/tareas" className="text-xs text-accent hover:text-accent/80 font-medium">
                Ver todas
              </Link>
            </div>

            <div className="divide-y divide-neutral-50 dark:divide-neutral-800">
              {/* Tareas Vencidas */}
              {tareasVencidas.length > 0 && (
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Vencidas
                    </span>
                    <span className="text-xs text-neutral-400 dark:text-white/40">{tareasVencidas.length} pendientes</span>
                  </div>
                  <div className="space-y-2">
                    {tareasVencidas.map((tarea) => (
                      <TaskRow
                        key={tarea.id}
                        tarea={tarea}
                        variant="overdue"
                        onComplete={handleCompletarTarea}
                        onReschedule={handleReprogramarTarea}
                        onNavigate={() => navigate(`/mi-crm/contactos/${tarea.contacto_id}`)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Tareas de Hoy */}
              {tareasHoy.length > 0 && (
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700">
                      <Clock className="h-3 w-3 mr-1" />
                      Hoy
                    </span>
                    <span className="text-xs text-neutral-400 dark:text-white/40">{tareasHoy.length} programadas</span>
                  </div>
                  <div className="space-y-2">
                    {tareasHoy.map((tarea) => (
                      <TaskRow
                        key={tarea.id}
                        tarea={tarea}
                        variant="today"
                        onComplete={handleCompletarTarea}
                        onReschedule={handleReprogramarTarea}
                        onNavigate={() => navigate(`/mi-crm/contactos/${tarea.contacto_id}`)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Leads sin seguimiento */}
              {leadsSinSeguimiento.length > 0 && (
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
                      <UserX className="h-3 w-3 mr-1" />
                      Sin seguimiento
                    </span>
                    <span className="text-xs text-neutral-400 dark:text-white/40">{leadsSinSeguimiento.length} leads</span>
                  </div>
                  <div className="space-y-2">
                    {leadsSinSeguimiento.map((lead) => (
                      <LeadRow
                        key={lead.id}
                        lead={lead}
                        onNavigate={() => navigate(`/mi-crm/contactos/${lead.id}`)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Leads nuevos */}
              {leadsNuevos.length > 0 && (
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                      <UserPlus className="h-3 w-3 mr-1" />
                      Nuevos
                    </span>
                    <span className="text-xs text-neutral-400 dark:text-white/40">{leadsNuevos.length} leads recientes</span>
                  </div>
                  <div className="space-y-2">
                    {leadsNuevos.map((lead) => (
                      <LeadRow
                        key={lead.id}
                        lead={lead}
                        isNew
                        onNavigate={() => navigate(`/mi-crm/contactos/${lead.id}`)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {tareasVencidas.length === 0 &&
                tareasHoy.length === 0 &&
                leadsSinSeguimiento.length === 0 &&
                leadsNuevos.length === 0 && (
                <div className="py-12 text-center">
                  <CheckCircle2 className="h-10 w-10 text-green-400 mx-auto mb-3" />
                  <p className="text-sm font-medium text-neutral-700 dark:text-white/70">Todo al dia</p>
                  <p className="text-xs text-neutral-400 dark:text-white/40 mt-1">No tienes pendientes urgentes</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Embudo de Ventas - 1/3 */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-neutral-900 dark:text-white text-sm">Embudo de Ventas</h2>
              <Link to="/mi-crm/contactos?view=kanban" className="text-xs text-accent hover:text-accent/80 font-medium">
                Ver kanban
              </Link>
            </div>
            <div className="space-y-3">
              <FunnelStage
                label="Prospectos"
                count={funnel?.prospectos || 0}
                total={stats?.totalContactos || 1}
                color="bg-blue-500"
              />
              <FunnelStage
                label="Cotizacion"
                count={funnel?.cotizacionPresentada || 0}
                total={stats?.totalContactos || 1}
                color="bg-amber-500"
              />
              <FunnelStage
                label="Negociacion"
                count={funnel?.negociacion || 0}
                total={stats?.totalContactos || 1}
                color="bg-orange-500"
              />
              <FunnelStage
                label="Clientes"
                count={funnel?.clientes || 0}
                total={stats?.totalContactos || 1}
                color="bg-green-500"
              />
            </div>

            <div className="mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-800 grid grid-cols-2 gap-3">
              <div className="text-center">
                <p className="text-lg font-bold text-neutral-900 dark:text-white">{stats?.tasaConversion.toFixed(0)}%</p>
                <p className="text-xs text-neutral-500 dark:text-white/50">Conversion</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-neutral-900 dark:text-white">
                  ${((stats?.primaTotal || 0) / 1000).toFixed(0)}k
                </p>
                <p className="text-xs text-neutral-500 dark:text-white/50">Prima Total</p>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-5">
            <h2 className="font-semibold text-neutral-900 dark:text-white text-sm mb-3">Resumen</h2>
            <div className="space-y-2.5">
              <StatRow icon={<Users className="h-4 w-4 text-blue-500" />} label="Total Contactos" value={stats?.totalContactos || 0} />
              <StatRow icon={<FileText className="h-4 w-4 text-orange-500" />} label="Cotizaciones" value={stats?.totalCotizaciones || 0} />
              <StatRow icon={<DollarSign className="h-4 w-4 text-green-500" />} label="Polizas Activas" value={stats?.totalPolizas || 0} />
            </div>
          </div>
        </div>
      </div>

      {/* Tableros Compartidos */}
      {rolPermitido && (
        <div className="mb-6">
          <TablerosSeccion />
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────────

function KPICard({
  label, value, icon, color, onClick, subtitle, urgent,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'red' | 'orange' | 'amber';
  onClick: () => void;
  subtitle?: string;
  urgent?: boolean;
}) {
  const colors = {
    blue: { bg: 'bg-blue-50', text: 'text-blue-700', icon: 'bg-blue-100 text-blue-600', border: 'border-blue-100' },
    green: { bg: 'bg-green-50', text: 'text-green-700', icon: 'bg-green-100 text-green-600', border: 'border-green-100' },
    red: { bg: 'bg-red-50', text: 'text-red-700', icon: 'bg-red-100 text-red-600', border: 'border-red-100' },
    orange: { bg: 'bg-orange-50', text: 'text-orange-700', icon: 'bg-orange-100 text-orange-600', border: 'border-orange-100' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-700', icon: 'bg-amber-100 text-amber-600', border: 'border-amber-100' },
  };

  const c = colors[color];

  return (
    <button
      onClick={onClick}
      className={`relative p-4 rounded-xl border ${c.border} ${c.bg} hover:shadow-md transition-all text-left group w-full ${urgent ? 'ring-2 ring-red-300 animate-pulse' : ''}`}
    >
      {urgent && value > 0 && (
        <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
          {value > 9 ? '9+' : value}
        </span>
      )}
      <div className={`w-8 h-8 rounded-lg ${c.icon} flex items-center justify-center mb-2`}>
        {icon}
      </div>
      <p className={`text-2xl font-bold ${c.text}`}>{value}</p>
      <p className="text-xs font-medium text-neutral-600 dark:text-white/60 mt-0.5">{label}</p>
      {subtitle && <p className="text-[10px] text-neutral-400 dark:text-white/40 mt-0.5">{subtitle}</p>}
      <ChevronRight className="absolute top-3 right-3 h-3.5 w-3.5 text-neutral-300 dark:text-white/20 group-hover:text-neutral-500 dark:group-hover:text-white/50 transition" />
    </button>
  );
}

function TaskRow({
  tarea, variant, onComplete, onReschedule, onNavigate,
}: {
  tarea: any;
  variant: 'overdue' | 'today';
  onComplete: (id: string) => void;
  onReschedule: (id: string) => void;
  onNavigate: () => void;
}) {
  const getActivityIcon = (tipo: string) => {
    switch (tipo) {
      case 'Llamada': return <Phone className="h-3.5 w-3.5" />;
      case 'Email': return <Mail className="h-3.5 w-3.5" />;
      case 'Reunión': return <Calendar className="h-3.5 w-3.5" />;
      default: return <FileText className="h-3.5 w-3.5" />;
    }
  };

  return (
    <div className={`flex items-center gap-3 p-2.5 rounded-lg border ${variant === 'overdue' ? 'border-red-100 bg-red-50/50' : 'border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/50'} group`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${variant === 'overdue' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>
        {getActivityIcon(tarea.tipo_actividad)}
      </div>
      <div className="flex-1 min-w-0 cursor-pointer" onClick={onNavigate}>
        <p className="text-sm font-medium text-neutral-800 dark:text-white/80 truncate">
          {tarea.descripcion || tarea.tipo_actividad}
        </p>
        <p className="text-xs text-neutral-500 dark:text-white/50 truncate">
          {tarea.crm_contactos?.nombre_completo || 'Sin contacto'}
          {tarea.fecha_vencimiento && (
            <span className={`ml-2 ${variant === 'overdue' ? 'text-red-500' : 'text-neutral-400 dark:text-white/40'}`}>
              {new Date(tarea.fecha_vencimiento).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
            </span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); onComplete(tarea.id); }}
          className="p-1.5 rounded-md hover:bg-green-100 text-green-600 transition"
          title="Completar"
        >
          <CheckCircle2 className="h-4 w-4" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onReschedule(tarea.id); }}
          className="p-1.5 rounded-md hover:bg-blue-100 text-blue-600 transition"
          title="Reprogramar a manana"
        >
          <CalendarClock className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function LeadRow({
  lead, isNew, onNavigate,
}: {
  lead: CRMContacto;
  isNew?: boolean;
  onNavigate: () => void;
}) {
  const timeSince = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'hace unos minutos';
    if (hours < 24) return `hace ${hours}h`;
    return `hace ${Math.floor(hours / 24)}d`;
  };

  return (
    <div
      onClick={onNavigate}
      className="flex items-center gap-3 p-2.5 rounded-lg border border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/50 hover:bg-white dark:hover:bg-neutral-800 hover:border-accent/30 cursor-pointer transition group"
    >
      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${isNew ? 'bg-blue-100 text-blue-600' : 'bg-amber-100 text-amber-600'}`}>
        <Users className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-neutral-800 dark:text-white/80 truncate">{lead.nombre_completo}</p>
        <p className="text-xs text-neutral-500 dark:text-white/50">
          {lead.celular || lead.email || 'Sin contacto'}
          <span className="ml-2 text-neutral-400 dark:text-white/40">{timeSince(lead.fecha_creacion)}</span>
        </p>
      </div>
      <ChevronRight className="h-4 w-4 text-neutral-300 dark:text-white/20 group-hover:text-accent transition" />
    </div>
  );
}

function FunnelStage({
  label, count, total, color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-neutral-600 dark:text-white/60">{label}</span>
        <span className="text-xs font-bold text-neutral-800 dark:text-white/80">{count}</span>
      </div>
      <div className="w-full bg-neutral-100 dark:bg-neutral-800 rounded-full h-2">
        <div
          className={`${color} h-2 rounded-full transition-all duration-500`}
          style={{ width: `${Math.max(pct, 2)}%` }}
        ></div>
      </div>
    </div>
  );
}

function StatRow({
  icon, label, value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-xs text-neutral-600 dark:text-white/60">{label}</span>
      </div>
      <span className="text-sm font-bold text-neutral-800 dark:text-white/80">{value}</span>
    </div>
  );
}
