import { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Video, Calendar, Clock, Play, Award, TrendingUp, GraduationCap } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { obtenerSesiones } from '../lib/aulaVirtualUtils';

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
        .select(`
          *,
          categoria:seguros_categories(nombre)
        `)
        .order('fecha_creacion', { ascending: false })
        .limit(5);

      if (lessons) {
        // Get progress for each lesson
        const lessonsWithProgress = await Promise.all(
          lessons.map(async (lesson) => {
            const { data: progress } = await supabase
              .from('seguros_progress')
              .select('progreso')
              .eq('lesson_id', lesson.id)
              .eq('user_id', usuario.id)
              .maybeSingle();

            return {
              ...lesson,
              progreso: progress?.progreso || 0,
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
        <div className="flex items-center justify-center h-64">
          <div className="text-neutral-600">Cargando...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-2xl p-8 text-white">
          <h1 className="text-3xl font-bold mb-2">Seguros Education</h1>
          <p className="text-primary-100">Sistema de capacitación y formación continua</p>
        </div>

        {/* Quick Access Buttons - TOP PRIORITY */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <button
            onClick={() => navigate('/seguros-education/on-demand')}
            className="bg-white rounded-xl p-8 border-2 border-neutral-200 hover:border-primary-500 shadow-sm hover:shadow-md transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl bg-primary-100 flex items-center justify-center group-hover:bg-primary-200 transition-colors">
                <GraduationCap className="w-8 h-8 text-primary-600" />
              </div>
              <div className="text-left flex-1">
                <h3 className="text-xl font-bold text-neutral-800 mb-1">On Demand</h3>
                <p className="text-neutral-600 text-sm">Accede a lecciones grabadas</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigate('/seguros-education/aula-virtual')}
            className="bg-white rounded-xl p-8 border-2 border-neutral-200 hover:border-emerald-500 shadow-sm hover:shadow-md transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl bg-emerald-100 flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
                <Calendar className="w-8 h-8 text-emerald-600" />
              </div>
              <div className="text-left flex-1">
                <h3 className="text-xl font-bold text-neutral-800 mb-1">Aula Digital</h3>
                <p className="text-neutral-600 text-sm">Capacitaciones programadas y eventos en vivo</p>
              </div>
            </div>
          </button>
        </div>

        {/* Próximas Capacitaciones */}
        <div className="bg-white rounded-xl shadow-sm border border-neutral-200">
          <div className="p-6 border-b border-neutral-200">
            <h2 className="text-xl font-bold text-neutral-800 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary-600" />
              Próximas Capacitaciones
            </h2>
            <p className="text-sm text-neutral-600 mt-1">Sesiones y eventos programados</p>
          </div>
          <div className="p-6">
            {proxSessions.length === 0 ? (
              <p className="text-neutral-500 text-center py-8">No hay capacitaciones programadas</p>
            ) : (
              <div className="space-y-4">
                {proxSessions.map((session) => {
                  const sessionDate = new Date(session.fecha_inicio);
                  const dateStr = format(sessionDate, 'dd MMMM yyyy', { locale: es });
                  const timeStr = format(sessionDate, 'HH:mm', { locale: es });

                  return (
                    <div
                      key={session.id}
                      className="flex items-center justify-between p-4 bg-neutral-50 rounded-lg hover:bg-neutral-100 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-1">
                          <h3 className="font-semibold text-neutral-800 flex-1">{session.titulo}</h3>
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
                      <button
                        onClick={() => navigate(
                          session.tipo === 'evento'
                            ? '/seguros-education/aula-digital'
                            : '/seguros-education/aula-virtual'
                        )}
                        className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
                      >
                        Ver Detalles
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Últimos Cursos */}
        <div className="bg-white rounded-xl shadow-sm border border-neutral-200">
          <div className="p-6 border-b border-neutral-200">
            <h2 className="text-xl font-bold text-neutral-800 flex items-center gap-2">
              <Video className="w-5 h-5 text-primary-600" />
              Últimos Cursos
            </h2>
          </div>
          <div className="p-6">
            {recentLessons.length === 0 ? (
              <p className="text-neutral-500 text-center py-8">No hay lecciones disponibles</p>
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
                            className="h-full bg-primary-600"
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
                      <h3 className="font-semibold text-neutral-800 mb-2 line-clamp-2 group-hover:text-primary-600 transition-colors">
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

        {/* Stats Cards - AT THE BOTTOM */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl p-6 border border-neutral-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-neutral-600 text-sm font-medium">Cursos Completados</span>
              <Award className="w-5 h-5 text-emerald-600" />
            </div>
            <p className="text-3xl font-bold text-neutral-800">{stats.completados}</p>
          </div>

          <div className="bg-white rounded-xl p-6 border border-neutral-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-neutral-600 text-sm font-medium">En Proceso</span>
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-3xl font-bold text-neutral-800">{stats.en_proceso}</p>
          </div>

          <div className="bg-white rounded-xl p-6 border border-neutral-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-neutral-600 text-sm font-medium">Tiempo Total</span>
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <p className="text-3xl font-bold text-neutral-800">
              {stats.tiempo_total}
              <span className="text-lg text-neutral-500 ml-1">min</span>
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 border border-neutral-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-neutral-600 text-sm font-medium">Última Lección</span>
              <Play className="w-5 h-5 text-primary-600" />
            </div>
            <p className="text-sm font-medium text-neutral-800 line-clamp-2">
              {stats.ultima_leccion || 'Ninguna'}
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
