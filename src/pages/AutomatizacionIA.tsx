import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { PageHeader } from '@/components/ui/page-header';
import { Section } from '@/components/ui/section';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Bot, Mail, Activity, ScrollText, Plus, Play, Pause, Trash2,
  CircleCheck as CheckCircle, Circle as XCircle, Clock, TriangleAlert as AlertTriangle,
  Settings, Eye, Copy, Pencil, ToggleLeft, ToggleRight, TestTube, Send,
  Loader as Loader2, RefreshCw, Zap, Shield, FileText, MessageSquare,
  Bell, X, ChevronDown, ChevronRight, Server, Key, Tag, FlaskConical,
} from 'lucide-react';

type Tab = 'dashboard' | 'robots' | 'bandeja' | 'bitacora' | 'cuentas';

interface CuentaCorreo {
  id: string;
  nombre: string;
  email: string;
  estado: string;
  imap_host: string | null;
  imap_port: number | null;
  smtp_host: string | null;
  smtp_port: number | null;
  ultima_sincronizacion: string | null;
  ultimo_error: string | null;
  carpetas_incluidas: string[];
  carpetas_excluidas: string[];
  created_at: string;
}

interface Robot {
  id: string;
  nombre: string;
  descripcion: string;
  prompt_sistema: string;
  prioridad: number;
  estado: string;
  modo: string;
  canal_correo: boolean;
  canal_whatsapp: boolean;
  canal_notificacion: boolean;
  es_predefinido: boolean;
  codigo: string | null;
  palabras_clave: string[] | null;
  created_at: string;
}

interface RobotPlantilla {
  id: string;
  robot_id: string;
  nombre: string;
  tipo: string;
  canal: string;
  asunto: string | null;
  cuerpo: string;
  activo: boolean;
  created_at: string;
}

interface BandejaItem {
  id: string;
  asunto: string;
  remitente: string;
  destinatario: string | null;
  cuerpo_texto: string | null;
  fecha_correo: string;
  estado_procesamiento: string;
  coincidencia_pct: number;
  razon_clasificacion: string | null;
  robot_id: string | null;
  cuenta_correo_id: string | null;
  carpeta_destino: string | null;
  created_at: string;
  ia_robots?: { nombre: string } | null;
  cuentaEmail?: string | null;
}

interface BitacoraItem {
  id: string;
  accion: string;
  estado: string;
  error_mensaje: string | null;
  correos_enviados: number;
  whatsapps_enviados: number;
  tareas_creadas: number;
  comunicados_creados: number;
  sicas_consultado: boolean;
  sicas_estado: string | null;
  detalle: Record<string, unknown> | null;
  created_at: string;
  robot_id: string | null;
  ia_robots?: { nombre: string } | null;
}

export default function AutomatizacionIA() {
  useEffect(() => { document.title = 'Automatización IA · MOVI Digital'; }, []);
  const { usuario } = useAuth();
  const [tab, setTab] = useState<Tab>('dashboard');

  if (!usuario) return null;

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Automatización IA por E-Mail"
        description="Monitoreo inteligente de correos, clasificación automática y robots especializados"
        icon={Bot}
      />

      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1 overflow-x-auto">
        {[
          { key: 'dashboard' as Tab, label: 'Dashboard', icon: Activity },
          { key: 'robots' as Tab, label: 'Robots', icon: Bot },
          { key: 'bandeja' as Tab, label: 'Bandeja IA', icon: Mail },
          { key: 'bitacora' as Tab, label: 'Bitácora', icon: ScrollText },
          { key: 'cuentas' as Tab, label: 'Cuentas', icon: Settings },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${
              tab === key
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && <DashboardIA />}
      {tab === 'robots' && <RobotsPanel />}
      {tab === 'bandeja' && <BandejaPanel />}
      {tab === 'bitacora' && <BitacoraPanel />}
      {tab === 'cuentas' && <CuentasPanel />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// DASHBOARD IA
// ═══════════════════════════════════════════════════════════════════
function DashboardIA() {
  const [stats, setStats] = useState({
    robotsActivos: 0,
    robotsPausados: 0,
    correosHoy: 0,
    pendientes: 0,
    errores: 0,
    comunicadosGenerados: 0,
    tareasGeneradas: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [recentActivity, setRecentActivity] = useState<BitacoraItem[]>([]);
  const [triggerLoading, setTriggerLoading] = useState<'monitor' | 'classify' | 'dryrun' | null>(null);
  const [triggerResult, setTriggerResult] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => { loadDashboard(); }, []);

  async function loadDashboard() {
    setLoading(true);
    setLoadError(null);
    try {
      const today = new Date().toISOString().slice(0, 10);

      const [robotsRes, bandejaHoyRes, pendientesRes, erroresRes, bitacoraRes] = await Promise.allSettled([
        supabase.from('ia_robots').select('id, estado'),
        supabase.from('ia_bandeja').select('id', { count: 'exact', head: true }).gte('created_at', today),
        supabase.from('ia_bandeja').select('id', { count: 'exact', head: true }).eq('estado_procesamiento', 'pendiente'),
        supabase.from('ia_bandeja').select('id', { count: 'exact', head: true }).eq('estado_procesamiento', 'error'),
        supabase.from('ia_bitacora').select('id, accion, estado, error_mensaje, correos_enviados, whatsapps_enviados, tareas_creadas, comunicados_creados, sicas_consultado, sicas_estado, robot_id, detalle, created_at').order('created_at', { ascending: false }).limit(10),
      ]);

      const robots = robotsRes.status === 'fulfilled' ? (robotsRes.value.data || []) : [];
      const bitacora = bitacoraRes.status === 'fulfilled' ? (bitacoraRes.value.data || []) : [];
      const comunicados = bitacora.reduce((sum: number, b: any) => sum + (b.comunicados_creados || 0), 0);
      const tareas = bitacora.reduce((sum: number, b: any) => sum + (b.tareas_creadas || 0), 0);

      const robotIds = [...new Set(bitacora.map((b: any) => b.robot_id).filter(Boolean))];
      const robotNamesMap: Record<string, string> = {};
      if (robotIds.length > 0) {
        const rRes = await supabase.from('ia_robots').select('id, nombre').in('id', robotIds);
        (rRes.data || []).forEach((r: any) => { robotNamesMap[r.id] = r.nombre; });
      }
      const activity = bitacora.map((b: any) => ({
        ...b,
        ia_robots: b.robot_id ? { nombre: robotNamesMap[b.robot_id] || '' } : null,
      }));

      setStats({
        robotsActivos: robots.filter((r: any) => r.estado === 'activo').length,
        robotsPausados: robots.filter((r: any) => r.estado === 'pausado').length,
        correosHoy: bandejaHoyRes.status === 'fulfilled' ? (bandejaHoyRes.value.count || 0) : 0,
        pendientes: pendientesRes.status === 'fulfilled' ? (pendientesRes.value.count || 0) : 0,
        errores: erroresRes.status === 'fulfilled' ? (erroresRes.value.count || 0) : 0,
        comunicadosGenerados: comunicados,
        tareasGeneradas: tareas,
      });
      setRecentActivity(activity);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  }

  async function triggerEdgeFunction(type: 'monitor' | 'classify' | 'dryrun') {
    setTriggerLoading(type);
    setTriggerResult(null);
    try {
      const fnName = type === 'monitor' ? 'ia-monitor-email' : 'ia-classify-email';
      const body = type === 'dryrun' ? { dry_run: true, limit: 10 } : { limit: type === 'classify' ? 20 : 30 };
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fnName}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify(body),
        }
      );
      const json = await res.json();
      if (type === 'monitor') {
        const msg = json.success
          ? `${json.accounts_checked} cuentas revisadas, ${json.total_new_messages} mensajes nuevos`
          : (json.message || json.error || 'Completado');
        setTriggerResult({ ok: res.ok, msg });
      } else {
        const msg = json.success
          ? `${json.classified} correos ${type === 'dryrun' ? 'analizados (modo prueba)' : 'clasificados'}`
          : (json.message || json.error || 'Completado');
        setTriggerResult({ ok: res.ok, msg });
      }
      if (res.ok) loadDashboard();
    } catch {
      setTriggerResult({ ok: false, msg: 'Error de red al ejecutar la función' });
    } finally {
      setTriggerLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-800 p-6 text-center">
        <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
        <p className="text-sm font-medium text-red-700 dark:text-red-400">Error al cargar el dashboard</p>
        <p className="text-xs text-red-500 mt-1">{loadError}</p>
        <button onClick={loadDashboard} className="mt-3 text-xs text-red-600 underline">Reintentar</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <StatCard icon={Bot} label="Robots activos" value={stats.robotsActivos} color="emerald" />
        <StatCard icon={Pause} label="Pausados" value={stats.robotsPausados} color="amber" />
        <StatCard icon={Mail} label="Correos hoy" value={stats.correosHoy} color="blue" />
        <StatCard icon={Clock} label="Pendientes" value={stats.pendientes} color="orange" />
        <StatCard icon={XCircle} label="Errores" value={stats.errores} color="red" />
        <StatCard icon={FileText} label="Comunicados" value={stats.comunicadosGenerados} color="teal" />
        <StatCard icon={Zap} label="Tareas" value={stats.tareasGeneradas} color="sky" />
      </div>

      {/* Manual Triggers */}
      <Section title="Ejecución manual">
        <div className="space-y-3">
          <p className="text-xs text-slate-500">Ejecuta los procesos de forma manual para sincronización o pruebas.</p>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              className="gap-2"
              disabled={triggerLoading !== null}
              onClick={() => triggerEdgeFunction('monitor')}
            >
              {triggerLoading === 'monitor' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Sincronizar correos
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              disabled={triggerLoading !== null}
              onClick={() => triggerEdgeFunction('classify')}
            >
              {triggerLoading === 'classify' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
              Clasificar pendientes
            </Button>
            <Button
              variant="outline"
              className="gap-2 border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400"
              disabled={triggerLoading !== null}
              onClick={() => triggerEdgeFunction('dryrun')}
            >
              {triggerLoading === 'dryrun' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FlaskConical className="w-4 h-4" />}
              Modo prueba (dry run)
            </Button>
          </div>
          {triggerResult && (
            <div className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${
              triggerResult.ok ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/10 dark:text-emerald-400' : 'bg-red-50 text-red-700 dark:bg-red-900/10 dark:text-red-400'
            }`}>
              {triggerResult.ok ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <XCircle className="w-4 h-4 flex-shrink-0" />}
              {triggerResult.msg}
            </div>
          )}
        </div>
      </Section>

      {/* Recent Activity */}
      <Section title="Actividad reciente">
        {recentActivity.length === 0 ? (
          <p className="text-sm text-slate-500 py-8 text-center">No hay actividad registrada aún.</p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {recentActivity.map(item => (
              <div key={item.id} className="flex items-center gap-3 py-3">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  item.estado === 'exito' ? 'bg-emerald-500' :
                  item.estado === 'error' ? 'bg-red-500' :
                  item.estado === 'simulado' ? 'bg-amber-500' : 'bg-slate-400'
                }`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{item.accion}</p>
                  <p className="text-xs text-slate-500 truncate">
                    {item.ia_robots?.nombre || 'Sin robot'}
                  </p>
                </div>
                <span className="text-xs text-slate-400 whitespace-nowrap">
                  {new Date(item.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  const colorClasses: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
    blue: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
    orange: 'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400',
    red: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',
    teal: 'bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-400',
    sky: 'bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-400',
  };
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${colorClasses[color]}`}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ROBOTS PANEL
// ═══════════════════════════════════════════════════════════════════
function RobotsPanel() {
  const [robots, setRobots] = useState<Robot[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingRobot, setEditingRobot] = useState<Robot | null>(null);
  const [expandedRobot, setExpandedRobot] = useState<string | null>(null);

  useEffect(() => { loadRobots(); }, []);

  async function loadRobots() {
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase.from('ia_robots')
      .select('*')
      .order('prioridad', { ascending: false });
    if (error) {
      console.error('loadRobots error:', error);
      setLoadError(error.message);
    }
    setRobots(data || []);
    setLoading(false);
  }

  async function toggleEstado(robot: Robot) {
    const newEstado = robot.estado === 'activo' ? 'pausado' : 'activo';
    await supabase.from('ia_robots').update({ estado: newEstado }).eq('id', robot.id);
    loadRobots();
  }

  async function deleteRobot(id: string) {
    if (!confirm('Eliminar este robot permanentemente?')) return;
    await supabase.from('ia_robots').delete().eq('id', id);
    loadRobots();
  }

  async function duplicateRobot(robot: Robot) {
    const { id: _id, created_at: _ca, codigo: _co, es_predefinido: _ep, ...rest } = robot;
    await supabase.from('ia_robots').insert({
      ...rest,
      nombre: `${rest.nombre} (copia)`,
      es_predefinido: false,
      codigo: null,
      estado: 'borrador',
    });
    loadRobots();
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  }

  if (loadError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-800 p-6 text-center">
        <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
        <p className="text-sm font-medium text-red-700 dark:text-red-400">Error al cargar robots</p>
        <p className="text-xs text-red-500 mt-1">{loadError}</p>
        <button onClick={loadRobots} className="mt-3 text-xs text-red-600 underline">Reintentar</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{robots.length} robots configurados</p>
        <Button onClick={() => { setEditingRobot(null); setShowForm(true); }} className="gap-2">
          <Plus className="w-4 h-4" /> Nuevo robot
        </Button>
      </div>

      {showForm && (
        <RobotForm
          robot={editingRobot}
          onSave={() => { setShowForm(false); setEditingRobot(null); loadRobots(); }}
          onCancel={() => { setShowForm(false); setEditingRobot(null); }}
        />
      )}

      <div className="grid gap-3">
        {robots.map(robot => (
          <div key={robot.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-semibold text-slate-900 dark:text-white">{robot.nombre}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      robot.estado === 'activo' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                      robot.estado === 'pausado' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                      'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                    }`}>
                      {robot.estado}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      robot.modo === 'produccion' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                      'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                    }`}>
                      {robot.modo}
                    </span>
                    {robot.es_predefinido && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                        predefinido
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500 line-clamp-2">{robot.descripcion}</p>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    {robot.canal_correo && <span className="flex items-center gap-1 text-xs text-slate-400"><Mail className="w-3 h-3" />Email</span>}
                    {robot.canal_whatsapp && <span className="flex items-center gap-1 text-xs text-slate-400"><MessageSquare className="w-3 h-3" />WhatsApp</span>}
                    {robot.canal_notificacion && <span className="flex items-center gap-1 text-xs text-slate-400"><Bell className="w-3 h-3" />Notificación</span>}
                    <span className="text-xs text-slate-400">Prioridad: {robot.prioridad}</span>
                    {robot.palabras_clave && robot.palabras_clave.length > 0 && (
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <Tag className="w-3 h-3" />{robot.palabras_clave.length} palabras clave
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => toggleEstado(robot)}
                    className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500"
                    title={robot.estado === 'activo' ? 'Pausar' : 'Activar'}
                  >
                    {robot.estado === 'activo' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => { setEditingRobot(robot); setShowForm(true); }}
                    className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500"
                    title="Editar"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => duplicateRobot(robot)}
                    className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500"
                    title="Duplicar"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setExpandedRobot(expandedRobot === robot.id ? null : robot.id)}
                    className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500"
                    title="Plantillas"
                  >
                    {expandedRobot === robot.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => deleteRobot(robot.id)}
                    className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
            {expandedRobot === robot.id && (
              <div className="border-t border-slate-100 dark:border-slate-700 px-5 pb-5 pt-4">
                <PlantillasPanel robotId={robot.id} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// PLANTILLAS PANEL (sub-panel in robots)
// ═══════════════════════════════════════════════════════════════════
function PlantillasPanel({ robotId }: { robotId: string }) {
  const [plantillas, setPlantillas] = useState<RobotPlantilla[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPlantilla, setEditingPlantilla] = useState<RobotPlantilla | null>(null);

  useEffect(() => { loadPlantillas(); }, [robotId]);

  async function loadPlantillas() {
    setLoading(true);
    const { data } = await supabase
      .from('ia_robot_plantillas')
      .select('*')
      .eq('robot_id', robotId)
      .order('created_at', { ascending: true });
    setPlantillas(data || []);
    setLoading(false);
  }

  async function deletePlantilla(id: string) {
    if (!confirm('Eliminar esta plantilla?')) return;
    await supabase.from('ia_robot_plantillas').delete().eq('id', id);
    loadPlantillas();
  }

  async function togglePlantilla(p: RobotPlantilla) {
    await supabase.from('ia_robot_plantillas').update({ activo: !p.activo }).eq('id', p.id);
    loadPlantillas();
  }

  const canalLabel: Record<string, string> = {
    correo: 'Correo',
    whatsapp: 'WhatsApp',
    notificacion: 'Notificación',
  };
  const tipoLabel: Record<string, string> = {
    respuesta_automatica: 'Respuesta automática',
    notificacion_interna: 'Notificación interna',
    comunicado: 'Comunicado',
    reenvio: 'Reenvío',
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Plantillas del robot</p>
        <button
          onClick={() => { setEditingPlantilla(null); setShowForm(true); }}
          className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
        >
          <Plus className="w-3.5 h-3.5" /> Nueva plantilla
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-slate-400" /></div>
      ) : plantillas.length === 0 && !showForm ? (
        <p className="text-xs text-slate-400 py-4 text-center">No hay plantillas configuradas para este robot.</p>
      ) : null}

      {showForm && (
        <PlantillaForm
          robotId={robotId}
          plantilla={editingPlantilla}
          onSave={() => { setShowForm(false); setEditingPlantilla(null); loadPlantillas(); }}
          onCancel={() => { setShowForm(false); setEditingPlantilla(null); }}
        />
      )}

      {plantillas.length > 0 && (
        <div className="space-y-2">
          {plantillas.map(p => (
            <div key={p.id} className={`rounded-lg border px-4 py-3 ${p.activo ? 'border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-750' : 'border-slate-100 dark:border-slate-700 opacity-60'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{p.nombre}</p>
                    <span className="px-1.5 py-0.5 rounded text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                      {canalLabel[p.canal] || p.canal}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-xs bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                      {tipoLabel[p.tipo] || p.tipo}
                    </span>
                  </div>
                  {p.asunto && <p className="text-xs text-slate-500 mt-0.5">Asunto: {p.asunto}</p>}
                  <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{p.cuerpo}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => togglePlantilla(p)} className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-400" title={p.activo ? 'Desactivar' : 'Activar'}>
                    {p.activo ? <ToggleRight className="w-4 h-4 text-emerald-500" /> : <ToggleLeft className="w-4 h-4" />}
                  </button>
                  <button onClick={() => { setEditingPlantilla(p); setShowForm(true); }} className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-400" title="Editar">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => deletePlantilla(p.id)} className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400" title="Eliminar">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PlantillaForm({ robotId, plantilla, onSave, onCancel }: {
  robotId: string;
  plantilla: RobotPlantilla | null;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    nombre: plantilla?.nombre || '',
    tipo: plantilla?.tipo || 'respuesta_automatica',
    canal: plantilla?.canal || 'correo',
    asunto: plantilla?.asunto || '',
    cuerpo: plantilla?.cuerpo || '',
    activo: plantilla?.activo ?? true,
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!form.nombre.trim() || !form.cuerpo.trim()) return;
    setSaving(true);
    if (plantilla) {
      await supabase.from('ia_robot_plantillas').update(form).eq('id', plantilla.id);
    } else {
      await supabase.from('ia_robot_plantillas').insert({ ...form, robot_id: robotId });
    }
    setSaving(false);
    onSave();
  }

  return (
    <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10 p-4 space-y-3">
      <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">{plantilla ? 'Editar plantilla' : 'Nueva plantilla'}</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-1">
          <Label className="text-xs">Nombre</Label>
          <Input className="h-8 text-xs" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Nombre de la plantilla" />
        </div>
        <div>
          <Label className="text-xs">Canal</Label>
          <select className="w-full h-8 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-xs" value={form.canal} onChange={e => setForm(f => ({ ...f, canal: e.target.value }))}>
            <option value="correo">Correo</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="notificacion">Notificación interna</option>
          </select>
        </div>
        <div>
          <Label className="text-xs">Tipo</Label>
          <select className="w-full h-8 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-xs" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
            <option value="respuesta_automatica">Respuesta automática</option>
            <option value="notificacion_interna">Notificación interna</option>
            <option value="comunicado">Comunicado</option>
            <option value="reenvio">Reenvío</option>
          </select>
        </div>
      </div>
      {form.canal === 'correo' && (
        <div>
          <Label className="text-xs">Asunto</Label>
          <Input className="h-8 text-xs" value={form.asunto} onChange={e => setForm(f => ({ ...f, asunto: e.target.value }))} placeholder="Asunto del correo" />
        </div>
      )}
      <div>
        <Label className="text-xs">Cuerpo / Mensaje</Label>
        <textarea
          className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-xs min-h-[80px] focus:outline-none focus:ring-1 focus:ring-blue-500"
          value={form.cuerpo}
          onChange={e => setForm(f => ({ ...f, cuerpo: e.target.value }))}
          placeholder="Contenido de la plantilla. Usa {{variable}} para datos dinámicos."
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving || !form.nombre.trim() || !form.cuerpo.trim()}
          className="px-3 py-1.5 rounded-md bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
        >
          {saving && <Loader2 className="w-3 h-3 animate-spin" />}
          {plantilla ? 'Guardar' : 'Crear'}
        </button>
        <button onClick={onCancel} className="px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-xs">
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ROBOT FORM
// ═══════════════════════════════════════════════════════════════════
function RobotForm({ robot, onSave, onCancel }: { robot: Robot | null; onSave: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({
    nombre: robot?.nombre || '',
    descripcion: robot?.descripcion || '',
    prompt_sistema: robot?.prompt_sistema || '',
    prioridad: robot?.prioridad || 50,
    estado: robot?.estado || 'borrador',
    modo: robot?.modo || 'simulacion',
    canal_correo: robot?.canal_correo || false,
    canal_whatsapp: robot?.canal_whatsapp || false,
    canal_notificacion: robot?.canal_notificacion ?? true,
    palabras_clave_str: (robot?.palabras_clave || []).join(', '),
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!form.nombre.trim() || !form.prompt_sistema.trim()) return;
    setSaving(true);
    const palabras_clave = form.palabras_clave_str
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);

    const { palabras_clave_str: _pks, ...rest } = form;
    const payload = { ...rest, palabras_clave };

    if (robot) {
      await supabase.from('ia_robots').update(payload).eq('id', robot.id);
    } else {
      await supabase.from('ia_robots').insert(payload);
    }
    setSaving(false);
    onSave();
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
      <h3 className="font-semibold text-slate-900 dark:text-white">{robot ? 'Editar robot' : 'Nuevo robot'}</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Nombre</Label>
          <Input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Nombre del robot" />
        </div>
        <div>
          <Label>Prioridad (1-100)</Label>
          <Input type="number" min={1} max={100} value={form.prioridad} onChange={e => setForm(f => ({ ...f, prioridad: parseInt(e.target.value) || 50 }))} />
        </div>
      </div>

      <div>
        <Label>Descripción</Label>
        <Input value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} placeholder="Descripción breve" />
      </div>

      <div>
        <Label>Prompt del sistema (instrucciones para la IA)</Label>
        <textarea
          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm min-h-[120px] focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={form.prompt_sistema}
          onChange={e => setForm(f => ({ ...f, prompt_sistema: e.target.value }))}
          placeholder="Instrucciones detalladas para que la IA clasifique correos..."
        />
      </div>

      <div>
        <Label>Palabras clave (separadas por coma)</Label>
        <Input
          value={form.palabras_clave_str}
          onChange={e => setForm(f => ({ ...f, palabras_clave_str: e.target.value }))}
          placeholder="siniestro, reclamación, póliza vencida, renovación..."
        />
        <p className="text-xs text-slate-400 mt-1">Se usan como respaldo cuando la IA no está disponible (clasificación por coincidencia de palabras).</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <Label>Estado</Label>
          <select className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm" value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}>
            <option value="borrador">Borrador</option>
            <option value="activo">Activo</option>
            <option value="pausado">Pausado</option>
          </select>
        </div>
        <div>
          <Label>Modo</Label>
          <select className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm" value={form.modo} onChange={e => setForm(f => ({ ...f, modo: e.target.value }))}>
            <option value="simulacion">Simulación</option>
            <option value="produccion">Producción</option>
          </select>
        </div>
      </div>

      <div>
        <Label>Canales de comunicación</Label>
        <div className="flex flex-wrap gap-4 mt-1">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.canal_correo} onChange={e => setForm(f => ({ ...f, canal_correo: e.target.checked }))} className="rounded" />
            <Mail className="w-4 h-4 text-slate-500" /> Correo
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.canal_whatsapp} onChange={e => setForm(f => ({ ...f, canal_whatsapp: e.target.checked }))} className="rounded" />
            <MessageSquare className="w-4 h-4 text-slate-500" /> WhatsApp
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.canal_notificacion} onChange={e => setForm(f => ({ ...f, canal_notificacion: e.target.checked }))} className="rounded" />
            <Bell className="w-4 h-4 text-slate-500" /> Notificación interna
          </label>
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <Button onClick={handleSave} disabled={saving || !form.nombre.trim() || !form.prompt_sistema.trim()}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {robot ? 'Guardar cambios' : 'Crear robot'}
        </Button>
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// BANDEJA IA PANEL
// ═══════════════════════════════════════════════════════════════════
function BandejaPanel() {
  const [items, setItems] = useState<BandejaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [previewItem, setPreviewItem] = useState<BandejaItem | null>(null);

  useEffect(() => { loadBandeja(); }, [filtroEstado]);

  async function loadBandeja() {
    setLoading(true);
    try {
      let query = supabase.from('ia_bandeja')
        .select('id, asunto, remitente, destinatario, cuerpo_texto, fecha_correo, estado_procesamiento, coincidencia_pct, razon_clasificacion, robot_id, cuenta_correo_id, carpeta_destino, created_at')
        .order('created_at', { ascending: false })
        .limit(50);

      if (filtroEstado) query = query.eq('estado_procesamiento', filtroEstado);

      const { data: bandeja } = await query;
      const rows = bandeja || [];

      // Fetch robot names
      const robotIds = [...new Set(rows.map((r: any) => r.robot_id).filter(Boolean))];
      const robotNamesMap: Record<string, string> = {};
      if (robotIds.length > 0) {
        const rRes = await supabase.from('ia_robots').select('id, nombre').in('id', robotIds as string[]);
        (rRes.data || []).forEach((r: any) => { robotNamesMap[r.id] = r.nombre; });
      }

      // Fetch cuenta emails
      const cuentaIds = [...new Set(rows.map((r: any) => r.cuenta_correo_id).filter(Boolean))];
      const cuentaEmailMap: Record<string, string> = {};
      if (cuentaIds.length > 0) {
        const cRes = await supabase.from('ia_cuentas_correo').select('id, email').in('id', cuentaIds as string[]);
        (cRes.data || []).forEach((c: any) => { cuentaEmailMap[c.id] = c.email; });
      }

      setItems(rows.map((r: any) => ({
        ...r,
        ia_robots: r.robot_id ? { nombre: robotNamesMap[r.robot_id] || '' } : null,
        cuentaEmail: r.cuenta_correo_id ? cuentaEmailMap[r.cuenta_correo_id] || null : null,
      })));
    } catch (err) {
      console.error('loadBandeja error:', err);
    } finally {
      setLoading(false);
    }
  }

  const estadoColors: Record<string, string> = {
    pendiente: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    procesando: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    completado: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    error: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    no_clasificado: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
    simulado: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <select
          className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
          value={filtroEstado}
          onChange={e => setFiltroEstado(e.target.value)}
        >
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendientes</option>
          <option value="procesando">Procesando</option>
          <option value="completado">Completados</option>
          <option value="error">Errores</option>
          <option value="no_clasificado">No clasificados</option>
          <option value="simulado">Simulados</option>
        </select>
        <Button variant="outline" onClick={loadBandeja} className="gap-2">
          <RefreshCw className="w-4 h-4" /> Actualizar
        </Button>
        <span className="text-xs text-slate-400">{items.length} correos</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-16">
          <Mail className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No hay correos en la bandeja IA.</p>
          <p className="text-xs text-slate-400 mt-1">Los correos aparecerán aquí cuando se configure y active el monitoreo.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
          {items.map(item => (
            <div key={item.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm text-slate-900 dark:text-white truncate">{item.asunto || '(Sin asunto)'}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    De: {item.remitente}
                    {item.cuentaEmail && <span className="text-slate-400"> — Cuenta: {item.cuentaEmail}</span>}
                  </p>
                  {item.ia_robots?.nombre && (
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                      Robot: {item.ia_robots.nombre}
                      {item.coincidencia_pct > 0 && ` (${item.coincidencia_pct}% coincidencia)`}
                    </p>
                  )}
                  {item.razon_clasificacion && (
                    <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{item.razon_clasificacion}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${estadoColors[item.estado_procesamiento] || 'bg-slate-100 text-slate-600'}`}>
                    {item.estado_procesamiento}
                  </span>
                  <span className="text-xs text-slate-400">
                    {item.fecha_correo ? new Date(item.fecha_correo).toLocaleDateString('es-MX') : ''}
                  </span>
                  {item.cuerpo_texto && (
                    <button
                      onClick={() => setPreviewItem(item)}
                      className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                    >
                      <Eye className="w-3 h-3" /> Ver
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {previewItem && (
        <EmailPreviewModal item={previewItem} onClose={() => setPreviewItem(null)} />
      )}
    </div>
  );
}

function EmailPreviewModal({ item, onClose }: { item: BandejaItem; onClose: () => void }) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={e => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-start justify-between p-5 border-b border-slate-100 dark:border-slate-700">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-slate-900 dark:text-white truncate">{item.asunto || '(Sin asunto)'}</h3>
            <p className="text-xs text-slate-500 mt-0.5">De: {item.remitente}</p>
            {item.ia_robots?.nombre && (
              <p className="text-xs text-blue-600 dark:text-blue-400">Robot: {item.ia_robots.nombre}</p>
            )}
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 flex-shrink-0 ml-2">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <pre className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">
            {item.cuerpo_texto || '(Sin contenido)'}
          </pre>
        </div>
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Estado: {item.estado_procesamiento}</span>
            {item.carpeta_destino && <span className="text-xs text-slate-400">Carpeta: {item.carpeta_destino}</span>}
          </div>
          <button onClick={onClose} className="text-xs text-slate-500 hover:underline">Cerrar</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// BITACORA PANEL
// ═══════════════════════════════════════════════════════════════════
function BitacoraPanel() {
  const [items, setItems] = useState<BitacoraItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => { loadBitacora(); }, []);

  async function loadBitacora() {
    setLoading(true);
    try {
      const { data: bitacora } = await supabase.from('ia_bitacora')
        .select('id, accion, estado, error_mensaje, correos_enviados, whatsapps_enviados, tareas_creadas, comunicados_creados, sicas_consultado, sicas_estado, robot_id, detalle, created_at')
        .order('created_at', { ascending: false })
        .limit(100);
      const rows = bitacora || [];

      const robotIds = [...new Set(rows.map((r: any) => r.robot_id).filter(Boolean))];
      const robotNamesMap: Record<string, string> = {};
      if (robotIds.length > 0) {
        const rRes = await supabase.from('ia_robots').select('id, nombre').in('id', robotIds as string[]);
        (rRes.data || []).forEach((r: any) => { robotNamesMap[r.id] = r.nombre; });
      }

      setItems(rows.map((r: any) => ({
        ...r,
        ia_robots: r.robot_id ? { nombre: robotNamesMap[r.robot_id] || '' } : null,
      })));
    } catch (err) {
      console.error('loadBitacora error:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{items.length} registros</p>
        <Button variant="outline" onClick={loadBitacora} className="gap-2">
          <RefreshCw className="w-4 h-4" /> Actualizar
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-16">
          <ScrollText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">La bitácora está vacía.</p>
          <p className="text-xs text-slate-400 mt-1">Aquí se registrará cada acción ejecutada por los robots.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
          {items.map(item => (
            <div key={item.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      item.estado === 'exito' ? 'bg-emerald-500' :
                      item.estado === 'error' ? 'bg-red-500' :
                      item.estado === 'simulado' ? 'bg-amber-500' : 'bg-slate-400'
                    }`} />
                    <p className="font-medium text-sm text-slate-900 dark:text-white">{item.accion}</p>
                  </div>
                  {item.ia_robots?.nombre && (
                    <p className="text-xs text-slate-500 mt-0.5">Robot: {item.ia_robots.nombre}</p>
                  )}
                  {item.error_mensaje && (
                    <p className="text-xs text-red-500 mt-0.5">{item.error_mensaje}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    {item.correos_enviados > 0 && <span className="text-xs text-slate-400">Correos: {item.correos_enviados}</span>}
                    {item.whatsapps_enviados > 0 && <span className="text-xs text-slate-400">WA: {item.whatsapps_enviados}</span>}
                    {item.tareas_creadas > 0 && <span className="text-xs text-slate-400">Tareas: {item.tareas_creadas}</span>}
                    {item.comunicados_creados > 0 && <span className="text-xs text-slate-400">Comunicados: {item.comunicados_creados}</span>}
                    {item.sicas_consultado && <span className="text-xs text-slate-400">SICAS: {item.sicas_estado || 'ok'}</span>}
                    {item.detalle && (
                      <button
                        onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                        className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" /> Detalle
                      </button>
                    )}
                  </div>
                  {expandedId === item.id && item.detalle && (
                    <pre className="mt-2 text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 rounded p-2 overflow-x-auto max-h-32 font-mono">
                      {JSON.stringify(item.detalle, null, 2)}
                    </pre>
                  )}
                </div>
                <span className="text-xs text-slate-400 whitespace-nowrap">
                  {new Date(item.created_at).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CUENTAS PANEL
// ═══════════════════════════════════════════════════════════════════
function CuentasPanel() {
  const [cuentas, setCuentas] = useState<CuentaCorreo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCuenta, setEditingCuenta] = useState<CuentaCorreo | null>(null);

  useEffect(() => { loadCuentas(); }, []);

  async function loadCuentas() {
    setLoading(true);
    const { data } = await supabase.from('ia_cuentas_correo')
      .select('*')
      .order('created_at', { ascending: false });
    setCuentas(data || []);
    setLoading(false);
  }

  async function toggleCuenta(cuenta: CuentaCorreo) {
    const newEstado = cuenta.estado === 'activo' ? 'inactivo' : 'activo';
    await supabase.from('ia_cuentas_correo').update({ estado: newEstado }).eq('id', cuenta.id);
    loadCuentas();
  }

  async function deleteCuenta(id: string) {
    if (!confirm('Eliminar esta cuenta y todos sus correos procesados?')) return;
    await supabase.from('ia_cuentas_correo').delete().eq('id', id);
    loadCuentas();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{cuentas.length} cuentas configuradas</p>
        <Button onClick={() => { setEditingCuenta(null); setShowForm(true); }} className="gap-2">
          <Plus className="w-4 h-4" /> Agregar cuenta
        </Button>
      </div>

      {showForm && (
        <CuentaForm
          cuenta={editingCuenta}
          onSave={() => { setShowForm(false); setEditingCuenta(null); loadCuentas(); }}
          onCancel={() => { setShowForm(false); setEditingCuenta(null); }}
        />
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : cuentas.length === 0 ? (
        <div className="text-center py-16">
          <Mail className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No hay cuentas de correo configuradas.</p>
          <p className="text-xs text-slate-400 mt-1">Agrega una cuenta de correo IONOS para comenzar el monitoreo automático.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {cuentas.map(cuenta => (
            <div key={cuenta.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Mail className="w-4 h-4 text-slate-400" />
                    <h3 className="font-semibold text-slate-900 dark:text-white">{cuenta.nombre}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      cuenta.estado === 'activo' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                      cuenta.estado === 'error' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                      'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                    }`}>
                      {cuenta.estado}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 mt-0.5">{cuenta.email}</p>
                  <div className="flex items-center gap-4 mt-1.5 text-xs text-slate-400 flex-wrap">
                    {cuenta.imap_host && (
                      <span className="flex items-center gap-1">
                        <Server className="w-3 h-3" />
                        IMAP: {cuenta.imap_host}:{cuenta.imap_port || 993}
                      </span>
                    )}
                    {cuenta.ultima_sincronizacion && (
                      <span>Última sync: {new Date(cuenta.ultima_sincronizacion).toLocaleString('es-MX')}</span>
                    )}
                    {cuenta.ultimo_error && (
                      <span className="text-red-500 truncate max-w-xs">{cuenta.ultimo_error}</span>
                    )}
                    {(cuenta.carpetas_incluidas || []).length > 0 && (
                      <span>Carpetas: {(cuenta.carpetas_incluidas || []).join(', ')}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => toggleCuenta(cuenta)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500" title={cuenta.estado === 'activo' ? 'Desactivar' : 'Activar'}>
                    {cuenta.estado === 'activo' ? <ToggleRight className="w-5 h-5 text-emerald-500" /> : <ToggleLeft className="w-5 h-5" />}
                  </button>
                  <button onClick={() => { setEditingCuenta(cuenta); setShowForm(true); }} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500" title="Editar">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteCuenta(cuenta.id)} className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500" title="Eliminar">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CUENTA FORM
// ═══════════════════════════════════════════════════════════════════
function CuentaForm({ cuenta, onSave, onCancel }: { cuenta: CuentaCorreo | null; onSave: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({
    nombre: cuenta?.nombre || '',
    email: cuenta?.email || '',
    password: '',
    imap_host: cuenta?.imap_host || 'imap.ionos.mx',
    imap_port: cuenta?.imap_port || 993,
    smtp_host: cuenta?.smtp_host || 'smtp.ionos.mx',
    smtp_port: cuenta?.smtp_port || 587,
    carpetas_incluidas: cuenta?.carpetas_incluidas?.join(', ') || 'INBOX',
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  async function testConnection() {
    if (!form.email || !form.password) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ia-validate-ionos-connection`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            email: form.email,
            password: form.password,
            imap_host: form.imap_host,
            imap_port: form.imap_port,
            cuenta_id: cuenta?.id || undefined,
          }),
        }
      );
      const json = await res.json();
      const msg = json.imap?.message || json.error || (res.ok ? 'Conexión exitosa' : 'Error de conexión');
      setTestResult({ ok: json.success || res.ok, msg });
    } catch {
      setTestResult({ ok: false, msg: 'Error de red al validar la conexión' });
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    if (!form.nombre || !form.email || (!cuenta && !form.password)) return;
    setSaving(true);
    const carpetas = form.carpetas_incluidas.split(',').map(s => s.trim()).filter(Boolean);
    if (cuenta) {
      const updateData: any = {
        nombre: form.nombre,
        email: form.email,
        imap_host: form.imap_host,
        imap_port: form.imap_port,
        smtp_host: form.smtp_host,
        smtp_port: form.smtp_port,
        carpetas_incluidas: carpetas,
      };
      if (form.password) updateData.password_encrypted = form.password;
      await supabase.from('ia_cuentas_correo').update(updateData).eq('id', cuenta.id);
    } else {
      await supabase.from('ia_cuentas_correo').insert({
        nombre: form.nombre,
        email: form.email,
        password_encrypted: form.password,
        imap_host: form.imap_host,
        imap_port: form.imap_port,
        smtp_host: form.smtp_host,
        smtp_port: form.smtp_port,
        carpetas_incluidas: carpetas,
      });
    }
    setSaving(false);
    onSave();
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
      <h3 className="font-semibold text-slate-900 dark:text-white">{cuenta ? 'Editar cuenta' : 'Nueva cuenta de correo'}</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Nombre</Label>
          <Input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Correo principal" />
        </div>
        <div>
          <Label>Correo electrónico</Label>
          <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="correo@dominio.com" />
        </div>
      </div>

      <div>
        <Label>Contraseña {cuenta && <span className="text-xs text-slate-400">(dejar vacío para no cambiar)</span>}</Label>
        <Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Contraseña de acceso" />
      </div>

      <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 space-y-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
          <Server className="w-3.5 h-3.5" /> Configuración del servidor
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label>Servidor IMAP</Label>
            <Input value={form.imap_host} onChange={e => setForm(f => ({ ...f, imap_host: e.target.value }))} placeholder="imap.ionos.mx" />
          </div>
          <div>
            <Label>Puerto IMAP</Label>
            <Input type="number" value={form.imap_port} onChange={e => setForm(f => ({ ...f, imap_port: parseInt(e.target.value) || 993 }))} placeholder="993" />
          </div>
          <div>
            <Label>Servidor SMTP</Label>
            <Input value={form.smtp_host} onChange={e => setForm(f => ({ ...f, smtp_host: e.target.value }))} placeholder="smtp.ionos.mx" />
          </div>
          <div>
            <Label>Puerto SMTP</Label>
            <Input type="number" value={form.smtp_port} onChange={e => setForm(f => ({ ...f, smtp_port: parseInt(e.target.value) || 587 }))} placeholder="587" />
          </div>
        </div>
      </div>

      <div>
        <Label>Carpetas a monitorear (separadas por coma)</Label>
        <Input value={form.carpetas_incluidas} onChange={e => setForm(f => ({ ...f, carpetas_incluidas: e.target.value }))} placeholder="INBOX, Clientes, Aseguradoras" />
      </div>

      {testResult && (
        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${
          testResult.ok ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/10 dark:text-emerald-400' : 'bg-red-50 text-red-700 dark:bg-red-900/10 dark:text-red-400'
        }`}>
          {testResult.ok ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          {testResult.msg}
        </div>
      )}

      <div className="flex gap-2 pt-2 flex-wrap">
        <Button onClick={handleSave} disabled={saving || !form.nombre || !form.email || (!cuenta && !form.password)}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {cuenta ? 'Guardar' : 'Crear cuenta'}
        </Button>
        <Button variant="outline" onClick={testConnection} disabled={testing || !form.email || !form.password}>
          {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <TestTube className="w-4 h-4" />}
          Probar conexión
        </Button>
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
      </div>
    </div>
  );
}
