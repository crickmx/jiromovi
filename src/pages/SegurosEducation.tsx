import { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Video, Calendar, Clock, Play, Award, TrendingUp, GraduationCap, BarChart3 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { obtenerSesiones } from '../lib/aulaVirtualUtils';
import { PageHeader } from '@/components/ui/page-header';
import { LoadingState } from '@/components/ui/loading-state';
import { Button } from '@/components/ui/button';
import { SegurosEducationLayout } from '../components/segurosEducation/SegurosEducationLayout';

interface Lesson {
  id: string;
  titulo: string;
  descripcion: string;
  miniatura_url: string | null;
  duracion: number;
  categoria: { nombre: string } | null;
  progreso?: number;
}

interface Session {
  id: string;
  titulo: string;
  descripcion: string | null;
  fecha_inicio: string;
  duracion_minutos: number;
  instructor?: { id: string; nombre_completo: string } | null;
  esta_activa: boolean;
  estado: 'programada' | 'en_vivo' | 'finalizada' | 'cancelada';
  tipo: 'sesion' | 'evento';
}

interface Stats {
  completados: number;
  en_proceso: number;
  ultima_leccion: string | null;
  tiempo_total: number;
}

export function SegurosEducation() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [proxSessions, setProxSessions] = useState<Session[]>([]);
  const [recentLessons, setRecentLessons] = useState<Lesson[]>([]);
  const [stats, setStats] = useState<Stats>({
    completados: 0,
    en_proceso: 0,
    ultima_leccion: null,
    tiempo_total: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [usuario]);

  const fetchData = async () => {
    if (!usuario) return;

    try {
      setLoading(true);

      const sessionsData = await obtenerSesiones();
      const now = new Date();

      // Filtrar sesiones futuras
      const upcomingSessions = sessionsData
        .filter(s => {
          const sessionDate = new Date(s.fecha_inicio);
          return sessionDate > now && s.estado === 'programada' && !s.esta_activa;
        })
        .map(s => ({ ...s, tipo: 'sesion' as const }));

      // Obtener eventos del aula digital (RLS filtra por permisos automáticamente)
      const { data: eventosData } = await supabase
        .from('aula_eventos')
        .select(`
          id,
          titulo,
          descripcion,
          fecha,
          hora,
          ponente
        `)
        .gte('fecha', new Date().toISOString().split('T')[0])
        .order('fecha', { ascending: true })
        .order('hora', { ascending: true });

      // Transformar eventos al formato de sesiones
      const upcomingEvents = (eventosData || []).map(e => {
        const fechaInicio = `${e.fecha}T${e.hora}`;
        return {
          id: e.id,
          titulo: e.titulo,
          descripcion: e.descripcion,
          fecha_inicio: fechaInicio,
          duracion_minutos: 60,
          instructor: { id: '', nombre_completo: e.ponente },
          esta_activa: false,
          estado: 'programada' as const,
          tipo: 'evento' as const
        };
      });

      // Combinar sesiones y eventos, ordenar y limitar a 5
      const upcoming = [...upcomingSessions, ...upcomingEvents]
        .sort((a, b) => new Date(a.fecha_inicio).getTime() - new Date(b.fecha_inicio).getTime())
        .slice(0, 5);

      setProxSessions(upcoming);

      // Fetch recent lessons with progress
      const { data: lessons } = await supabase
        .from('seguros_lessons')
        .select('*')
        .order('fecha_creacion', { ascending: false })
        .limit(5);

      if (lessons) {
        // Get progress and categories for each lesson
        const lessonsWithProgress = await Promise.all(
          lessons.map(async (lesson) => {
            const { data: progress } = await supabase
              .from('seguros_progress')
              .select('progreso')
              .eq('lesson_id', lesson.id)
              .eq('user_id', usuario.id)
              .maybeSingle();

            // Get first category for the lesson
            const { data: categoryData } = await supabase
              .from('seguros_lesson_categories')
              .select(`
                category_id,
                seguros_categories(nombre)
              `)
              .eq('lesson_id', lesson.id)
              .limit(1)
              .maybeSingle();

            return {
              ...lesson,
              progreso: progress?.progreso || 0,
              categoria: categoryData?.seguros_categories || null,
            };
          })
        );

        setRecentLessons(lessonsWithProgress);
      }

      // Fetch user stats
      const { data: progressData } = await supabase
        .from('seguros_progress')
        .select('*, lesson:seguros_lessons(titulo, duracion)')
        .eq('user_id', usuario.id);

      if (progressData) {
        const completados = progressData.filter((p) => p.completado).length;
        const en_proceso = progressData.filter((p) => !p.completado && p.progreso > 0).length;
        const ultima = progressData.sort((a, b) =>
          new Date(b.ultima_vista).getTime() - new Date(a.ultima_vista).getTime()
        )[0];
        const tiempo_total = progressData.reduce((sum, p) => {
          return sum + (p.completado ? (p.lesson?.duracion || 0) : (p.tiempo_reproduccion || 0));
        }, 0);

        setStats({
          completados,
          en_proceso,
          ultima_leccion: ultima?.lesson?.titulo || null,
          tiempo_total: Math.floor(tiempo_total / 60),
        });
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <Layout>
        <SegurosEducationLayout>
          <LoadingState text="Cargando capacitacion..." />
        </SegurosEducationLayout>
      </Layout>
    );
  }

  return (
    <Layout>
      <SegurosEducationLayout>
      <div className="space-y-6">
        <PageHeader
          title="Seguros Education"
          description="Sistema de capacitacion y formacion continua"
          icon={GraduationCap}
        />

        {/* Quick Access Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={() => navigate('/seguros-education/cedula-a')}
            className="bg-amber-500 dark:bg-amber-600 rounded-xl p-6 hover:bg-amber-600 dark:hover:bg-amber-700 transition-all group relative overflow-hidden text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-white mb-0.5">Curso Cedula A</h3>
                <p className="text-amber-100 text-xs">Preparacion completa CNSF</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigate('/seguros-education/on-demand')}
            className="bg-white dark:bg-neutral-800/50 rounded-xl p-6 border border-neutral-200/60 dark:border-white/8 hover:border-accent dark:hover:border-accent/50 hover:shadow-sm transition-all group text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0 group-hover:bg-accent/15 transition-colors">
                <Video className="w-6 h-6 text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-neutral-800 dark:text-white mb-0.5">On Demand</h3>
                <p className="text-neutral-500 dark:text-white/40 text-xs">Accede a lecciones grabadas</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigate('/seguros-education/aula-virtual')}
            className="bg-white dark:bg-neutral-800/50 rounded-xl p-6 border border-neutral-200/60 dark:border-white/8 hover:border-emerald-400 dark:hover:border-emerald-500/50 hover:shadow-sm transition-all group text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-200 dark:group-hover:bg-emerald-500/20 transition-colors">
                <Calendar className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-neutral-800 dark:text-white mb-0.5">Aula Digital</h3>
                <p className="text-neutral-500 dark:text-white/40 text-xs">Capacitaciones y eventos en vivo</p>
              </div>
            </div>
          </button>

          {(usuario?.rol?.toLowerCase() === 'admin' || usuario?.rol?.toLowerCase() === 'administrador') && (
            <button
              onClick={() => navigate('/seguros-education/analytics')}
              className="bg-white dark:bg-neutral-800/50 rounded-xl p-6 border border-neutral-200/60 dark:border-white/8 hover:border-accent dark:hover:border-accent/50 hover:shadow-sm transition-all group text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0 group-hover:bg-accent/15 transition-colors">
                  <BarChart3 className="w-6 h-6 text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-neutral-800 dark:text-white mb-0.5">Analytics</h3>
                  <p className="text-neutral-500 dark:text-white/40 text-xs">Metricas y reportes</p>
                </div>
              </div>
            </button>
          )}
        </div>

        {/* Proximas Capacitaciones */}
        <div className="bg-white dark:bg-neutral-800/50 rounded-xl border border-neutral-200/60 dark:border-white/8">
          <div className="p-5 border-b border-neutral-200 dark:border-white/8">
            <h2 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-accent" />
              Proximas Capacitaciones
            </h2>
            <p className="text-xs text-neutral-500 dark:text-white/40 mt-0.5">Sesiones y eventos programados</p>
          </div>
          <div className="p-5">
            {proxSessions.length === 0 ? (
              <p className="text-neutral-500 dark:text-white/40 text-sm text-center py-8">No hay capacitaciones programadas</p>
            ) : (
              <div className="space-y-4">
                {proxSessions.map((session) => {
                  const sessionDate = new Date(session.fecha_inicio);
                  const dateStr = format(sessionDate, 'dd MMMM yyyy', { locale: es });
                  const timeStr = format(sessionDate, 'HH:mm', { locale: es });

                  return (
                    <div
                      key={session.id}
                      className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-white/3 rounded-lg hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-1">
                          <h3 className="font-semibold text-neutral-800 dark:text-white text-sm flex-1">{session.titulo}</h3>
                          <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${
                            session.tipo === 'evento'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-primary-100 text-primary-700'
                          }`}>
                            {session.tipo === 'evento' ? 'Evento' : 'Sesión'}
                          </span>
                        </div>
                        {session.descripcion && (
                          <p className="text-sm text-neutral-600 mb-2">{session.descripcion}</p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-neutral-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {dateStr}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {timeStr}
                          </span>
                          <span className="text-neutral-400">
                            {session.duracion_minutos} min
                          </span>
                        </div>
                        {session.instructor && (
                          <p className="text-xs text-neutral-500 mt-1">
                            {session.tipo === 'evento' ? 'Ponente' : 'Instructor'}: {session.instructor.nombre_completo}
                          </p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        onClick={() => navigate('/seguros-education/aula-virtual')}
                      >
                        Ver Detalles
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Ultimos Cursos */}
        <div className="bg-white dark:bg-neutral-800/50 rounded-xl border border-neutral-200/60 dark:border-white/8">
          <div className="p-5 border-b border-neutral-200 dark:border-white/8">
            <h2 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2">
              <Video className="w-4 h-4 text-accent" />
              Ultimos Cursos
            </h2>
          </div>
          <div className="p-5">
            {recentLessons.length === 0 ? (
              <p className="text-neutral-500 dark:text-white/40 text-sm text-center py-8">No hay lecciones disponibles</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {recentLessons.map((lesson) => (
                  <div
                    key={lesson.id}
                    onClick={() => navigate(`/seguros-education/on-demand`)}
                    className="bg-white rounded-lg border border-neutral-200 overflow-hidden hover:shadow-md transition-all cursor-pointer group"
                  >
                    <div className="aspect-video bg-neutral-200 relative overflow-hidden">
                      {lesson.miniatura_url ? (
                        <img
                          src={lesson.miniatura_url}
                          alt={lesson.titulo}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Video className="w-12 h-12 text-neutral-400" />
                        </div>
                      )}
                      {lesson.progreso > 0 && (
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-neutral-300">
                          <div
                            className="h-full bg-accent"
                            style={{ width: `${lesson.progreso}%` }}
                          />
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <div className="flex items-center gap-2 text-xs text-neutral-500 mb-2">
                        <span className="px-2 py-1 bg-primary-100 text-primary-700 rounded">
                          {lesson.categoria?.nombre || 'Sin categoría'}
                        </span>
                        <span>{formatDuration(lesson.duracion)}</span>
                      </div>
                      <h3 className="font-semibold text-neutral-800 mb-2 line-clamp-2 group-hover:text-accent transition-colors">
                        {lesson.titulo}
                      </h3>
                      {lesson.progreso > 0 && (
                        <div className="text-xs text-neutral-600">
                          {lesson.progreso === 100 ? (
                            <span className="text-emerald-600 font-medium">✓ Completado</span>
                          ) : (
                            <span>{Math.floor(lesson.progreso)}% visto</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white dark:bg-neutral-800/50 rounded-xl p-4 border border-neutral-200/60 dark:border-white/8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-neutral-500 dark:text-white/40 text-xs font-medium">Completados</span>
              <Award className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-2xl font-bold text-neutral-900 dark:text-white">{stats.completados}</p>
          </div>

          <div className="bg-white dark:bg-neutral-800/50 rounded-xl p-4 border border-neutral-200/60 dark:border-white/8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-neutral-500 dark:text-white/40 text-xs font-medium">En Proceso</span>
              <TrendingUp className="w-4 h-4 text-accent" />
            </div>
            <p className="text-2xl font-bold text-neutral-900 dark:text-white">{stats.en_proceso}</p>
          </div>

          <div className="bg-white dark:bg-neutral-800/50 rounded-xl p-4 border border-neutral-200/60 dark:border-white/8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-neutral-500 dark:text-white/40 text-xs font-medium">Tiempo Total</span>
              <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <p className="text-2xl font-bold text-neutral-900 dark:text-white">
              {stats.tiempo_total}
              <span className="text-sm text-neutral-400 dark:text-white/30 ml-1">min</span>
            </p>
          </div>

          <div className="bg-white dark:bg-neutral-800/50 rounded-xl p-4 border border-neutral-200/60 dark:border-white/8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-neutral-500 dark:text-white/40 text-xs font-medium">Ultima Leccion</span>
              <Play className="w-4 h-4 text-accent" />
            </div>
            <p className="text-xs font-medium text-neutral-800 dark:text-white/80 line-clamp-2">
              {stats.ultima_leccion || 'Ninguna'}
            </p>
          </div>
        </div>
      </div>
      </SegurosEducationLayout>
    </Layout>
  );
}
