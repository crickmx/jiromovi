import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ChartBar as BarChart3, TrendingUp, Users, Clock, Award, Download, Calendar, ListFilter as Filter, Search, Eye, Play, CircleCheck as CheckCircle } from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { SegurosEducationLayout } from '../components/segurosEducation/SegurosEducationLayout';

interface LeccionStats {
  lesson_id: string;
  titulo: string;
  categoria_nombre: string;
  reproducciones: number;
  usuarios_unicos: number;
  completadas: number;
  completion_rate_percent: number;
  tiempo_promedio_segundos: number;
  tiempo_total_segundos: number;
  ultima_visualizacion: string;
  top_oficinas: Array<{ oficina_nombre: string; count: number }>;
}

interface UsuarioStats {
  user_id: string;
  nombre_completo: string;
  email_laboral: string;
  oficina_nombre: string;
  rol: string;
  lecciones_vistas: number;
  lecciones_completadas: number;
  clases_abiertas: number;
  tiempo_total_minutos: number;
  ultimo_acceso: string;
  dias_activos: number;
}

interface ClaseStats {
  class_id: string;
  titulo: string;
  fecha_inicio: string;
  instructor_nombre: string;
  aperturas: number;
  clicks_entrar: number;
  joins_exitosos: number;
  vistas_grabacion: number;
  usuarios_unicos: number;
  top_oficinas: Array<{ oficina_nombre: string; count: number }>;
}

interface EventoDetalle {
  event_type: string;
  created_at: string;
  user_id: string;
  nombre_completo: string;
  oficina_nombre: string;
  rol: string;
  progress_seconds: number;
  progress_percent: number;
}

type TabView = 'dashboard' | 'lecciones' | 'usuarios' | 'clases' | 'eventos';
type DateRange = '7d' | '30d' | '90d' | 'custom';

export function SegurosEducationAnalytics() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [currentTab, setCurrentTab] = useState<TabView>('dashboard');
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  // Data states
  const [leccionesStats, setLeccionesStats] = useState<LeccionStats[]>([]);
  const [usuariosStats, setUsuariosStats] = useState<UsuarioStats[]>([]);
  const [clasesStats, setClasesStats] = useState<ClaseStats[]>([]);
  const [eventos, setEventos] = useState<EventoDetalle[]>([]);

  // Dashboard summary
  const [totalReproducciones, setTotalReproducciones] = useState(0);
  const [usuariosActivos, setUsuariosActivos] = useState(0);
  const [tiempoTotal, setTiempoTotal] = useState(0);
  const [completionRate, setCompletionRate] = useState(0);

  useEffect(() => {
    checkPermissions();
  }, [usuario]);

  const checkPermissions = async () => {
    if (!usuario) {
      console.log('[Analytics] No usuario found, redirecting to login');
      navigate('/login');
      return;
    }

    // Check if user is admin (case insensitive)
    const isAdmin = usuario.rol?.toLowerCase() === 'admin' || usuario.rol?.toLowerCase() === 'administrador';
    console.log('[Analytics] User role:', usuario.rol, 'isAdmin:', isAdmin);

    if (!isAdmin) {
      console.log('[Analytics] User is not admin, redirecting to seguros-education');
      navigate('/seguros-education');
      return;
    }

    console.log('[Analytics] User is admin, fetching data...');
    fetchData();
  };

  const getDateFilter = () => {
    const end = endOfDay(new Date());
    let start: Date;

    if (dateRange === 'custom' && customStartDate) {
      start = startOfDay(new Date(customStartDate));
    } else {
      const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
      start = startOfDay(subDays(end, days));
    }

    return { start, end };
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      console.log('[Analytics] Starting data fetch...');
      const { start, end } = getDateFilter();
      console.log('[Analytics] Date range:', start.toISOString(), 'to', end.toISOString());

      // Fetch lecciones stats
      console.log('[Analytics] Fetching lecciones stats...');
      const { data: leccionesData, error: leccionesError } = await supabase
        .from('v_analytics_lecciones_stats')
        .select('*')
        .order('reproducciones', { ascending: false });

      if (leccionesError) {
        console.error('[Analytics] Error fetching lecciones:', leccionesError);
      } else {
        console.log('[Analytics] Lecciones data:', leccionesData?.length, 'rows');
      }

      // Fetch usuarios stats
      console.log('[Analytics] Fetching usuarios stats...');
      const { data: usuariosData, error: usuariosError } = await supabase
        .from('v_analytics_usuarios_stats')
        .select('*')
        .gte('ultimo_acceso', start.toISOString())
        .lte('ultimo_acceso', end.toISOString())
        .order('lecciones_vistas', { ascending: false });

      if (usuariosError) {
        console.error('[Analytics] Error fetching usuarios:', usuariosError);
      } else {
        console.log('[Analytics] Usuarios data:', usuariosData?.length, 'rows');
      }

      // Fetch clases stats
      console.log('[Analytics] Fetching clases stats...');
      const { data: clasesData, error: clasesError } = await supabase
        .from('v_analytics_clases_stats')
        .select('*')
        .gte('fecha_inicio', start.toISOString())
        .lte('fecha_inicio', end.toISOString())
        .order('usuarios_unicos', { ascending: false });

      if (clasesError) {
        console.error('[Analytics] Error fetching clases:', clasesError);
      } else {
        console.log('[Analytics] Clases data:', clasesData?.length, 'rows');
      }

      setLeccionesStats(leccionesData || []);
      setUsuariosStats(usuariosData || []);
      setClasesStats(clasesData || []);

      // Calculate dashboard summary
      const totalRepr = (leccionesData || []).reduce((sum, l) => sum + (l.reproducciones || 0), 0);
      const totalUsuarios = (usuariosData || []).length;
      const totalTiempo = (usuariosData || []).reduce((sum, u) => sum + (u.tiempo_total_minutos || 0), 0);
      const avgCompletion = leccionesData && leccionesData.length > 0
        ? leccionesData.reduce((sum, l) => sum + (l.completion_rate_percent || 0), 0) / leccionesData.length
        : 0;

      setTotalReproducciones(totalRepr);
      setUsuariosActivos(totalUsuarios);
      setTiempoTotal(totalTiempo);
      setCompletionRate(avgCompletion);

      console.log('[Analytics] Data fetch complete. Summary:', {
        totalRepr,
        totalUsuarios,
        totalTiempo,
        avgCompletion
      });
    } catch (error) {
      console.error('[Analytics] Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = async (type: 'lecciones' | 'usuarios' | 'clases') => {
    let data: any[] = [];
    let headers: string[] = [];
    let filename = '';

    if (type === 'lecciones') {
      data = leccionesStats;
      headers = ['Título', 'Categoría', 'Reproducciones', 'Usuarios Únicos', 'Completadas', '% Completado', 'Tiempo Promedio (min)'];
      filename = 'analytics_lecciones.csv';
    } else if (type === 'usuarios') {
      data = usuariosStats;
      headers = ['Usuario', 'Email', 'Oficina', 'Rol', 'Lecciones Vistas', 'Completadas', 'Clases Abiertas', 'Tiempo Total (min)', 'Días Activos'];
      filename = 'analytics_usuarios.csv';
    } else if (type === 'clases') {
      data = clasesStats;
      headers = ['Título', 'Fecha', 'Instructor', 'Aperturas', 'Clics Entrar', 'Joins Exitosos', 'Usuarios Únicos'];
      filename = 'analytics_clases.csv';
    }

    const csvContent = [
      headers.join(','),
      ...data.map(item => {
        if (type === 'lecciones') {
          return [
            `"${item.titulo}"`,
            `"${item.categoria_nombre || ''}"`,
            item.reproducciones,
            item.usuarios_unicos,
            item.completadas,
            item.completion_rate_percent?.toFixed(1) || 0,
            Math.round((item.tiempo_promedio_segundos || 0) / 60)
          ].join(',');
        } else if (type === 'usuarios') {
          return [
            `"${item.nombre_completo}"`,
            `"${item.email_laboral}"`,
            `"${item.oficina_nombre || ''}"`,
            `"${item.rol}"`,
            item.lecciones_vistas,
            item.lecciones_completadas,
            item.clases_abiertas,
            item.tiempo_total_minutos?.toFixed(1) || 0,
            item.dias_activos
          ].join(',');
        } else {
          return [
            `"${item.titulo}"`,
            format(new Date(item.fecha_inicio), 'dd/MM/yyyy', { locale: es }),
            `"${item.instructor_nombre || ''}"`,
            item.aperturas,
            item.clicks_entrar,
            item.joins_exitosos,
            item.usuarios_unicos
          ].join(',');
        }
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  };

  const formatSeconds = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hours}h ${remainingMins}m`;
  };

  const filteredLecciones = leccionesStats.filter(l =>
    l.titulo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.categoria_nombre?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredUsuarios = usuariosStats.filter(u =>
    u.nombre_completo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email_laboral?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.oficina_nombre?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredClases = clasesStats.filter(c =>
    c.titulo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.instructor_nombre?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <>
        <SegurosEducationLayout sectionTitle="Analytics" sectionDescription="Métricas de Seguros Education">
          <div className="flex justify-center items-center py-16">
            <div className="w-8 h-8 border-[3px] border-[#1C37E0]/20 border-t-[#1C37E0] rounded-full animate-spin" />
          </div>
        </SegurosEducationLayout>
      </>
    );
  }

  return (
    <>
      <SegurosEducationLayout sectionTitle="Analytics" sectionDescription="Métricas de Seguros Education">
      <div className="space-y-5">
        {/* Section header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-base font-bold text-neutral-900 dark:text-white">Metricas de uso</h2>
            <p className="text-xs text-neutral-500 dark:text-white/40 mt-0.5">Actividad de la plataforma</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-white dark:bg-white/[0.04] border border-neutral-200 dark:border-white/[0.08] rounded-xl px-3 py-2">
              <Calendar className="w-4 h-4 text-neutral-400" />
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as DateRange)}
                className="bg-transparent text-xs font-medium text-neutral-700 dark:text-white focus:outline-none"
              >
                <option value="7d">Últimos 7 días</option>
                <option value="30d">Últimos 30 días</option>
                <option value="90d">Últimos 90 días</option>
                <option value="custom">Personalizado</option>
              </select>
            </div>
            {dateRange === 'custom' && (
              <>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-3 py-2 bg-white dark:bg-white/[0.04] border border-neutral-200 dark:border-white/[0.08] rounded-xl text-xs text-neutral-700 dark:text-white focus:outline-none"
                />
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-3 py-2 bg-white dark:bg-white/[0.04] border border-neutral-200 dark:border-white/[0.08] rounded-xl text-xs text-neutral-700 dark:text-white focus:outline-none"
                />
              </>
            )}
            <button
              onClick={fetchData}
              className="px-4 py-2 rounded-xl bg-[#1C37E0] text-white text-xs font-semibold hover:bg-[#1630C8] transition-all shadow-sm"
            >
              Aplicar
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-neutral-200">
          <div className="flex gap-4">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
              { id: 'lecciones', label: 'Por Lección', icon: Play },
              { id: 'usuarios', label: 'Por Usuario', icon: Users },
              { id: 'clases', label: 'Aula Virtual', icon: Eye }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setCurrentTab(tab.id as TabView)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                  currentTab === tab.id
                    ? 'border-accent text-accent'
                    : 'border-transparent text-neutral-600 hover:text-neutral-900'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dashboard Tab */}
        {currentTab === 'dashboard' && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl shadow-md border border-neutral-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-neutral-600">Reproducciones</p>
                    <p className="text-3xl font-bold text-neutral-800 mt-1">{totalReproducciones}</p>
                  </div>
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <Play className="w-6 h-6 text-accent" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-md border border-neutral-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-neutral-600">Usuarios Activos</p>
                    <p className="text-3xl font-bold text-neutral-800 mt-1">{usuariosActivos}</p>
                  </div>
                  <div className="p-3 bg-green-100 rounded-lg">
                    <Users className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-md border border-neutral-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-neutral-600">Tiempo Total</p>
                    <p className="text-3xl font-bold text-neutral-800 mt-1">{Math.round(tiempoTotal)}m</p>
                  </div>
                  <div className="p-3 bg-orange-100 rounded-lg">
                    <Clock className="w-6 h-6 text-orange-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-md border border-neutral-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-neutral-600">Completion Rate</p>
                    <p className="text-3xl font-bold text-neutral-800 mt-1">{completionRate.toFixed(1)}%</p>
                  </div>
                  <div className="p-3 bg-purple-100 rounded-lg">
                    <Award className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
              </div>
            </div>

            {/* Top 10 Lecciones */}
            <div className="bg-white rounded-xl shadow-md border border-neutral-200 p-6">
              <h3 className="text-lg font-semibold text-neutral-800 mb-4">Top 10 Lecciones Más Reproducidas</h3>
              <div className="space-y-3">
                {leccionesStats.slice(0, 10).map((leccion, index) => (
                  <div key={leccion.lesson_id} className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-neutral-400 w-6">{index + 1}</span>
                      <div>
                        <p className="font-medium text-neutral-800">{leccion.titulo}</p>
                        <p className="text-sm text-neutral-600">{leccion.categoria_nombre}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-neutral-600">{leccion.reproducciones} reproducciones</span>
                      <span className="text-green-600 font-medium">{leccion.completion_rate_percent?.toFixed(0) || 0}% completado</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Lecciones Tab */}
        {currentTab === 'lecciones' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Buscar lecciones..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 w-full border border-neutral-300 rounded-lg"
                />
              </div>
              <button
                onClick={() => exportToCSV('lecciones')}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                Exportar CSV
              </button>
            </div>

            <div className="bg-white rounded-xl shadow-md border border-neutral-200 overflow-hidden">
              <table className="w-full">
                <thead className="bg-neutral-50 border-b border-neutral-200">
                  <tr>
                    <th className="text-left px-6 py-3 text-sm font-semibold text-neutral-700">Lección</th>
                    <th className="text-left px-6 py-3 text-sm font-semibold text-neutral-700">Categoría</th>
                    <th className="text-right px-6 py-3 text-sm font-semibold text-neutral-700">Reproducciones</th>
                    <th className="text-right px-6 py-3 text-sm font-semibold text-neutral-700">Usuarios</th>
                    <th className="text-right px-6 py-3 text-sm font-semibold text-neutral-700">Completadas</th>
                    <th className="text-right px-6 py-3 text-sm font-semibold text-neutral-700">% Completado</th>
                    <th className="text-right px-6 py-3 text-sm font-semibold text-neutral-700">Tiempo Prom.</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLecciones.map(leccion => (
                    <tr key={leccion.lesson_id} className="border-b border-neutral-100 hover:bg-neutral-50">
                      <td className="px-6 py-4 text-sm font-medium text-neutral-800">{leccion.titulo}</td>
                      <td className="px-6 py-4 text-sm text-neutral-600">{leccion.categoria_nombre || '-'}</td>
                      <td className="px-6 py-4 text-sm text-neutral-800 text-right">{leccion.reproducciones}</td>
                      <td className="px-6 py-4 text-sm text-neutral-800 text-right">{leccion.usuarios_unicos}</td>
                      <td className="px-6 py-4 text-sm text-neutral-800 text-right">{leccion.completadas}</td>
                      <td className="px-6 py-4 text-sm font-medium text-right">
                        <span className={leccion.completion_rate_percent >= 70 ? 'text-green-600' : 'text-orange-600'}>
                          {leccion.completion_rate_percent?.toFixed(1) || 0}%
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-800 text-right">
                        {formatSeconds(leccion.tiempo_promedio_segundos || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Usuarios Tab */}
        {currentTab === 'usuarios' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Buscar usuarios..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 w-full border border-neutral-300 rounded-lg"
                />
              </div>
              <button
                onClick={() => exportToCSV('usuarios')}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                Exportar CSV
              </button>
            </div>

            <div className="bg-white rounded-xl shadow-md border border-neutral-200 overflow-hidden">
              <table className="w-full">
                <thead className="bg-neutral-50 border-b border-neutral-200">
                  <tr>
                    <th className="text-left px-6 py-3 text-sm font-semibold text-neutral-700">Usuario</th>
                    <th className="text-left px-6 py-3 text-sm font-semibold text-neutral-700">Oficina</th>
                    <th className="text-left px-6 py-3 text-sm font-semibold text-neutral-700">Rol</th>
                    <th className="text-right px-6 py-3 text-sm font-semibold text-neutral-700">Lecciones Vistas</th>
                    <th className="text-right px-6 py-3 text-sm font-semibold text-neutral-700">Completadas</th>
                    <th className="text-right px-6 py-3 text-sm font-semibold text-neutral-700">Tiempo Total</th>
                    <th className="text-right px-6 py-3 text-sm font-semibold text-neutral-700">Días Activos</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsuarios.map(usuario => (
                    <tr key={usuario.user_id} className="border-b border-neutral-100 hover:bg-neutral-50">
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-medium text-neutral-800">{usuario.nombre_completo}</p>
                          <p className="text-xs text-neutral-500">{usuario.email_laboral}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-600">{usuario.oficina_nombre || '-'}</td>
                      <td className="px-6 py-4 text-sm text-neutral-600">{usuario.rol}</td>
                      <td className="px-6 py-4 text-sm text-neutral-800 text-right">{usuario.lecciones_vistas}</td>
                      <td className="px-6 py-4 text-sm text-neutral-800 text-right">{usuario.lecciones_completadas}</td>
                      <td className="px-6 py-4 text-sm text-neutral-800 text-right">{usuario.tiempo_total_minutos?.toFixed(0) || 0}m</td>
                      <td className="px-6 py-4 text-sm text-neutral-800 text-right">{usuario.dias_activos}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Clases Tab (Aula Virtual) */}
        {currentTab === 'clases' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Buscar clases..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 w-full border border-neutral-300 rounded-lg"
                />
              </div>
              <button
                onClick={() => exportToCSV('clases')}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                Exportar CSV
              </button>
            </div>

            <div className="bg-white rounded-xl shadow-md border border-neutral-200 overflow-hidden">
              <table className="w-full">
                <thead className="bg-neutral-50 border-b border-neutral-200">
                  <tr>
                    <th className="text-left px-6 py-3 text-sm font-semibold text-neutral-700">Clase</th>
                    <th className="text-left px-6 py-3 text-sm font-semibold text-neutral-700">Instructor</th>
                    <th className="text-left px-6 py-3 text-sm font-semibold text-neutral-700">Fecha</th>
                    <th className="text-right px-6 py-3 text-sm font-semibold text-neutral-700">Aperturas</th>
                    <th className="text-right px-6 py-3 text-sm font-semibold text-neutral-700">Clics Entrar</th>
                    <th className="text-right px-6 py-3 text-sm font-semibold text-neutral-700">Joins</th>
                    <th className="text-right px-6 py-3 text-sm font-semibold text-neutral-700">Usuarios</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClases.map(clase => (
                    <tr key={clase.class_id} className="border-b border-neutral-100 hover:bg-neutral-50">
                      <td className="px-6 py-4 text-sm font-medium text-neutral-800">{clase.titulo}</td>
                      <td className="px-6 py-4 text-sm text-neutral-600">{clase.instructor_nombre || '-'}</td>
                      <td className="px-6 py-4 text-sm text-neutral-600">
                        {format(new Date(clase.fecha_inicio), 'dd/MM/yyyy HH:mm', { locale: es })}
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-800 text-right">{clase.aperturas}</td>
                      <td className="px-6 py-4 text-sm text-neutral-800 text-right">{clase.clicks_entrar}</td>
                      <td className="px-6 py-4 text-sm text-neutral-800 text-right">{clase.joins_exitosos}</td>
                      <td className="px-6 py-4 text-sm text-neutral-800 text-right">{clase.usuarios_unicos}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      </SegurosEducationLayout>
    </>
  );
}
export default SegurosEducationAnalytics;
