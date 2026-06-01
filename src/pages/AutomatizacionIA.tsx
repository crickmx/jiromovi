import { useState, useEffect } from 'react';
import { useMoviAuth } from '../contexts/MoviAuthContext';
import { supabase } from '../lib/supabase';
import { PageHeader } from '@/components/ui/page-header';
import { Section } from '@/components/ui/section';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Bot, Mail, Activity, ScrollText, Plus, Play, Pause, Trash2, CircleCheck as CheckCircle, Circle as XCircle, Clock, TriangleAlert as AlertTriangle, Settings, Eye, Copy, Pencil, ToggleLeft, ToggleRight, TestTube, Send, Loader as Loader2, RefreshCw, Search, ListFilter as Filter, ChevronDown, ChevronRight, Zap, Shield, FileText, MessageSquare, Bell } from 'lucide-react';

type Tab = 'dashboard' | 'robots' | 'bandeja' | 'bitacora' | 'cuentas';

interface CuentaCorreo {
  id: string;
  nombre: string;
  email: string;
  estado: string;
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
  created_at: string;
}

interface BandejaItem {
  id: string;
  asunto: string;
  remitente: string;
  fecha_correo: string;
  estado_procesamiento: string;
  coincidencia_pct: number;
  razon_clasificacion: string | null;
  robot_id: string | null;
  carpeta_destino: string | null;
  created_at: string;
  ia_robots?: { nombre: string } | null;
  ia_cuentas_correo?: { email: string } | null;
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
  created_at: string;
  ia_robots?: { nombre: string } | null;
  ia_bandeja?: { asunto: string; remitente: string } | null;
}

export default function AutomatizacionIA() {
  useEffect(() => { document.title = 'Automatización IA · MOVI Digital'; }, []);
  const { usuario } = useMoviAuth();
  const [tab, setTab] = useState<Tab>('dashboard');

  if (!usuario) return null;

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Automatización IA por E-Mail"
        description="Monitoreo inteligente de correos, clasificación automática y robots especializados"
        icon={<Bot className="w-6 h-6" />}
      />

      {/* Tab Navigation */}
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
  const [recentActivity, setRecentActivity] = useState<BitacoraItem[]>([]);

  useEffect(() => { loadDashboard(); }, []);

  async function loadDashboard() {
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);

    const [robotsRes, bandejaHoyRes, pendientesRes, erroresRes, bitacoraRes] = await Promise.all([
      supabase.from('ia_robots').select('estado'),
      supabase.from('ia_bandeja').select('id', { count: 'exact', head: true })
        .gte('created_at', today),
      supabase.from('ia_bandeja').select('id', { count: 'exact', head: true })
        .eq('estado_procesamiento', 'pendiente'),
      supabase.from('ia_bandeja').select('id', { count: 'exact', head: true })
        .eq('estado_procesamiento', 'error'),
      supabase.from('ia_bitacora').select('*, ia_robots(nombre), ia_bandeja(asunto, remitente)')
        .order('created_at', { ascending: false }).limit(10),
    ]);

    const robots = robotsRes.data || [];
    const comunicados = (bitacoraRes.data || []).reduce((sum: number, b: any) => sum + (b.comunicados_creados || 0), 0);
    const tareas = (bitacoraRes.data || []).reduce((sum: number, b: any) => sum + (b.tareas_creadas || 0), 0);

    setStats({
      robotsActivos: robots.filter(r => r.estado === 'activo').length,
      robotsPausados: robots.filter(r => r.estado === 'pausado').length,
      correosHoy: bandejaHoyRes.count || 0,
      pendientes: pendientesRes.count || 0,
      errores: erroresRes.count || 0,
      comunicadosGenerados: comunicados,
      tareasGeneradas: tareas,
    });
    setRecentActivity(bitacoraRes.data || []);
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
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
                    {item.ia_robots?.nombre || 'Sin robot'} — {item.ia_bandeja?.asunto || ''}
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
  const [showForm, setShowForm] = useState(false);
  const [editingRobot, setEditingRobot] = useState<Robot | null>(null);

  useEffect(() => { loadRobots(); }, []);

  async function loadRobots() {
    setLoading(true);
    const { data } = await supabase.from('ia_robots')
      .select('*')
      .order('prioridad', { ascending: false });
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
    const { id, created_at, codigo, es_predefinido, ...rest } = robot;
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
          <div key={robot.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
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
                <div className="flex items-center gap-3 mt-2">
                  {robot.canal_correo && <span className="flex items-center gap-1 text-xs text-slate-400"><Mail className="w-3 h-3" />Email</span>}
                  {robot.canal_whatsapp && <span className="flex items-center gap-1 text-xs text-slate-400"><MessageSquare className="w-3 h-3" />WhatsApp</span>}
                  {robot.canal_notificacion && <span className="flex items-center gap-1 text-xs text-slate-400"><Bell className="w-3 h-3" />Notificación</span>}
                  <span className="text-xs text-slate-400">Prioridad: {robot.prioridad}</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => toggleEstado(robot)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500" title={robot.estado === 'activo' ? 'Pausar' : 'Activar'}>
                  {robot.estado === 'activo' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
                <button onClick={() => { setEditingRobot(robot); setShowForm(true); }} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500" title="Editar">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => duplicateRobot(robot)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500" title="Duplicar">
                  <Copy className="w-4 h-4" />
                </button>
                <button onClick={() => deleteRobot(robot.id)} className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500" title="Eliminar">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
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
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!form.nombre.trim() || !form.prompt_sistema.trim()) return;
    setSaving(true);
    if (robot) {
      await supabase.from('ia_robots').update(form).eq('id', robot.id);
    } else {
      await supabase.from('ia_robots').insert(form);
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

  useEffect(() => { loadBandeja(); }, [filtroEstado]);

  async function loadBandeja() {
    setLoading(true);
    let query = supabase.from('ia_bandeja')
      .select('*, ia_robots(nombre), ia_cuentas_correo(email)')
      .order('created_at', { ascending: false })
      .limit(50);

    if (filtroEstado) query = query.eq('estado_procesamiento', filtroEstado);

    const { data } = await query;
    setItems(data || []);
    setLoading(false);
  }

  const estadoColors: Record<string, string> = {
    pendiente: 'bg-amber-100 text-amber-700',
    procesando: 'bg-blue-100 text-blue-700',
    completado: 'bg-emerald-100 text-emerald-700',
    error: 'bg-red-100 text-red-700',
    no_clasificado: 'bg-slate-100 text-slate-600',
    simulado: 'bg-orange-100 text-orange-700',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
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
            <div key={item.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm text-slate-900 dark:text-white truncate">{item.asunto || '(Sin asunto)'}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    De: {item.remitente} — {item.ia_cuentas_correo?.email || ''}
                  </p>
                  {item.ia_robots?.nombre && (
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                      Robot: {item.ia_robots.nombre} ({item.coincidencia_pct}% coincidencia)
                    </p>
                  )}
                  {item.razon_clasificacion && (
                    <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{item.razon_clasificacion}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${estadoColors[item.estado_procesamiento] || 'bg-slate-100 text-slate-600'}`}>
                    {item.estado_procesamiento}
                  </span>
                  <span className="text-xs text-slate-400">
                    {item.fecha_correo ? new Date(item.fecha_correo).toLocaleDateString('es-MX') : ''}
                  </span>
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
// BITACORA PANEL
// ═══════════════════════════════════════════════════════════════════
function BitacoraPanel() {
  const [items, setItems] = useState<BitacoraItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadBitacora(); }, []);

  async function loadBitacora() {
    setLoading(true);
    const { data } = await supabase.from('ia_bitacora')
      .select('*, ia_robots(nombre), ia_bandeja(asunto, remitente)')
      .order('created_at', { ascending: false })
      .limit(100);
    setItems(data || []);
    setLoading(false);
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
                    <div className={`w-2 h-2 rounded-full ${
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
                  <div className="flex items-center gap-3 mt-1.5">
                    {item.correos_enviados > 0 && <span className="text-xs text-slate-400">Correos: {item.correos_enviados}</span>}
                    {item.whatsapps_enviados > 0 && <span className="text-xs text-slate-400">WA: {item.whatsapps_enviados}</span>}
                    {item.tareas_creadas > 0 && <span className="text-xs text-slate-400">Tareas: {item.tareas_creadas}</span>}
                    {item.comunicados_creados > 0 && <span className="text-xs text-slate-400">Comunicados: {item.comunicados_creados}</span>}
                    {item.sicas_consultado && <span className="text-xs text-slate-400">SICAS: {item.sicas_estado || 'ok'}</span>}
                  </div>
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
    const newEstado = cuenta.estado === 'activa' ? 'inactiva' : 'activa';
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
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-slate-400" />
                    <h3 className="font-semibold text-slate-900 dark:text-white">{cuenta.nombre}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      cuenta.estado === 'activa' ? 'bg-emerald-100 text-emerald-700' :
                      cuenta.estado === 'error' ? 'bg-red-100 text-red-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {cuenta.estado}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 mt-0.5">{cuenta.email}</p>
                  <div className="flex items-center gap-4 mt-1.5 text-xs text-slate-400">
                    {cuenta.ultima_sincronizacion && (
                      <span>Última sync: {new Date(cuenta.ultima_sincronizacion).toLocaleString('es-MX')}</span>
                    )}
                    {cuenta.ultimo_error && (
                      <span className="text-red-500">{cuenta.ultimo_error}</span>
                    )}
                    <span>Carpetas: {cuenta.carpetas_incluidas.join(', ')}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => toggleCuenta(cuenta)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500">
                    {cuenta.estado === 'activa' ? <ToggleRight className="w-5 h-5 text-emerald-500" /> : <ToggleLeft className="w-5 h-5" />}
                  </button>
                  <button onClick={() => { setEditingCuenta(cuenta); setShowForm(true); }} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteCuenta(cuenta.id)} className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500">
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
            cuenta_id: cuenta?.id || undefined,
          }),
        }
      );
      const json = await res.json();
      const msg = json.imap?.message || json.error || 'Conexión exitosa';
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
      const updateData: any = { nombre: form.nombre, email: form.email, carpetas_incluidas: carpetas };
      if (form.password) updateData.password_encrypted = form.password;
      await supabase.from('ia_cuentas_correo').update(updateData).eq('id', cuenta.id);
    } else {
      await supabase.from('ia_cuentas_correo').insert({
        nombre: form.nombre,
        email: form.email,
        password_encrypted: form.password,
        carpetas_incluidas: carpetas,
      });
    }
    setSaving(false);
    onSave();
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
      <h3 className="font-semibold text-slate-900 dark:text-white">{cuenta ? 'Editar cuenta' : 'Nueva cuenta IONOS'}</h3>

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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Contraseña {cuenta && <span className="text-xs text-slate-400">(dejar vacío para no cambiar)</span>}</Label>
          <Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Contraseña de acceso" />
        </div>
        <div>
          <Label>Carpetas a monitorear (separadas por coma)</Label>
          <Input value={form.carpetas_incluidas} onChange={e => setForm(f => ({ ...f, carpetas_incluidas: e.target.value }))} placeholder="INBOX, Clientes, Aseguradoras" />
        </div>
      </div>

      {testResult && (
        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${
          testResult.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
        }`}>
          {testResult.ok ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          {testResult.msg}
        </div>
      )}

      <div className="flex gap-2 pt-2">
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
