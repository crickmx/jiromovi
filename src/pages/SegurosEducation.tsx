import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Video, Calendar, Clock, Play, Award, TrendingUp, GraduationCap, ChartBar as BarChart3, BookOpen, ArrowRight, CircleCheck as CheckCircle2, ChevronRight, Zap } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { obtenerSesiones } from '../lib/aulaVirtualUtils';
import { SegurosEducationLayout } from '../components/segurosEducation/SegurosEducationLayout';
import { cn } from '@/lib/utils';

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

const QUICK_ACCESS = [
  {
    label: 'Cédula A',
    desc: 'Preparación CNSF completa',
    path: '/seguros-education/cedula-a',
    icon: GraduationCap,
    color: 'from-amber-500 to-orange-500',
    badge: 'Certificación',
    badgeColor: 'bg-amber-100 text-amber-700',
  },
  {
    label: 'On Demand',
    desc: 'Lecciones grabadas',
    path: '/seguros-education/on-demand',
    icon: Video,
    color: 'from-[#1C37E0] to-blue-500',
    badge: 'Biblioteca',
    badgeColor: 'bg-blue-100 text-blue-700',
  },
  {
    label: 'Aula Virtual',
    desc: 'Capacitaciones en vivo',
    path: '/seguros-education/aula-virtual',
    icon: Calendar,
    color: 'from-emerald-500 to-teal-500',
    badge: 'En vivo',
    badgeColor: 'bg-emerald-100 text-emerald-700',
  },
  {
    label: 'Manuales',
    desc: 'Guías y documentación',
    path: '/seguros-education/manuales',
    icon: BookOpen,
    color: 'from-violet-500 to-purple-500',
    badge: 'Referencia',
    badgeColor: 'bg-violet-100 text-violet-700',
  },
];

function formatDuration(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-neutral-200/70 dark:bg-white/[0.06]', className)} />;
}

export function SegurosEducation() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [proxSessions, setProxSessions] = useState<Session[]>([]);
  const [recentLessons, setRecentLessons] = useState<Lesson[]>([]);
  const [stats, setStats] = useState<Stats>({ completados: 0, en_proceso: 0, ultima_leccion: null, tiempo_total: 0 });
  const [loading, setLoading] = useState(true);
  const isAdmin = ['admin', 'administrador'].includes(usuario?.rol?.toLowerCase() || '');

  useEffect(() => { fetchData(); }, [usuario]);

  const fetchData = async () => {
    if (!usuario) return;
    try {
      setLoading(true);

      const sessionsData = await obtenerSesiones();
      const now = new Date();
      const upcomingSessions = sessionsData
        .filter(s => new Date(s.fecha_inicio) > now && s.estado === 'programada' && !s.esta_activa)
        .map(s => ({ ...s, tipo: 'sesion' as const }));

      const { data: eventosData } = await supabase
        .from('aula_eventos')
        .select('id, titulo, descripcion, fecha, hora, ponente')
        .gte('fecha', new Date().toISOString().split('T')[0])
        .order('fecha', { ascending: true })
        .order('hora', { ascending: true });

      const upcomingEvents = (eventosData || []).map(e => ({
        id: e.id,
        titulo: e.titulo,
        descripcion: e.descripcion,
        fecha_inicio: `${e.fecha}T${e.hora}`,
        duracion_minutos: 60,
        instructor: { id: '', nombre_completo: e.ponente },
        esta_activa: false,
        estado: 'programada' as const,
        tipo: 'evento' as const,
      }));

      const upcoming = [...upcomingSessions, ...upcomingEvents]
        .sort((a, b) => new Date(a.fecha_inicio).getTime() - new Date(b.fecha_inicio).getTime())
        .slice(0, 4);

      setProxSessions(upcoming);

      const { data: lessons } = await supabase
        .from('seguros_lessons')
        .select('*')
        .order('fecha_creacion', { ascending: false })
        .limit(6);

      if (lessons) {
        const lessonsWithProgress = await Promise.all(
          lessons.map(async (lesson) => {
            const [progressRes, categoryRes] = await Promise.all([
              supabase.from('seguros_progress').select('progreso').eq('lesson_id', lesson.id).eq('user_id', usuario.id).maybeSingle(),
              supabase.from('seguros_lesson_categories').select('category_id, seguros_categories(nombre)').eq('lesson_id', lesson.id).limit(1).maybeSingle(),
            ]);
            return { ...lesson, progreso: progressRes.data?.progreso || 0, categoria: categoryRes.data?.seguros_categories || null };
          })
        );
        setRecentLessons(lessonsWithProgress);
      }

      const { data: progressData } = await supabase
        .from('seguros_progress')
        .select('*, lesson:seguros_lessons(titulo, duracion)')
        .eq('user_id', usuario.id);

      if (progressData) {
        const completados = progressData.filter(p => p.completado).length;
        const en_proceso = progressData.filter(p => !p.completado && p.progreso > 0).length;
        const ultima = progressData.sort((a, b) => new Date(b.ultima_vista).getTime() - new Date(a.ultima_vista).getTime())[0];
        const tiempo_total = progressData.reduce((sum, p) => sum + (p.completado ? (p.lesson?.duracion || 0) : (p.tiempo_reproduccion || 0)), 0);
        setStats({ completados, en_proceso, ultima_leccion: ultima?.lesson?.titulo || null, tiempo_total: Math.floor(tiempo_total / 60) });
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <SegurosEducationLayout>
        <div className="space-y-6">

          {/* ── Stats strip ─────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { icon: CheckCircle2, label: 'Completados', value: loading ? null : stats.completados, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
              { icon: TrendingUp, label: 'En Proceso', value: loading ? null : stats.en_proceso, color: 'text-[#1C37E0]', bg: 'bg-blue-50 dark:bg-blue-500/10' },
              { icon: Clock, label: 'Minutos totales', value: loading ? null : stats.tiempo_total, suffix: 'min', color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-500/10' },
              { icon: Play, label: 'Última lección', value: null, text: loading ? null : (stats.ultima_leccion || 'Ninguna'), color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-500/10' },
            ].map(stat => (
              <div key={stat.label} className="bg-white dark:bg-white/[0.03] rounded-2xl border border-neutral-200/50 dark:border-white/[0.06] p-4 flex items-center gap-3">
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', stat.bg)}>
                  <stat.icon className={cn('w-4.5 h-4.5', stat.color)} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-neutral-500 dark:text-white/40 font-medium uppercase tracking-wide">{stat.label}</p>
                  {loading ? (
                    <Skeleton className="h-5 w-12 mt-1" />
                  ) : stat.text !== undefined ? (
                    <p className="text-xs font-semibold text-neutral-800 dark:text-white mt-0.5 truncate">{stat.text}</p>
                  ) : (
                    <p className="text-xl font-bold text-neutral-900 dark:text-white leading-none mt-0.5">
                      {stat.value}<span className="text-xs text-neutral-400 dark:text-white/30 ml-0.5 font-medium">{stat.suffix}</span>
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* ── Quick access ────────────────────────────────────── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-3.5 h-3.5 text-neutral-400" />
              <h2 className="text-xs font-bold text-neutral-500 dark:text-white/40 uppercase tracking-wider">Acceso Rápido</h2>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {QUICK_ACCESS.map(item => (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className="group relative overflow-hidden bg-white dark:bg-white/[0.03] rounded-2xl border border-neutral-200/50 dark:border-white/[0.06] p-4 text-left hover:border-transparent hover:shadow-lg hover:shadow-neutral-200/50 dark:hover:shadow-none transition-all duration-200 focus:outline-none"
                >
                  {/* Gradient accent on hover */}
                  <div className={cn('absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-2xl', item.color)} style={{ opacity: 0 }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
                  />
                  <div className="relative">
                    <div className={cn('w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center mb-3 shadow-sm', item.color)}>
                      <item.icon className="w-5 h-5 text-white" />
                    </div>
                    <p className="font-bold text-sm text-neutral-900 dark:text-white group-hover:text-neutral-900">{item.label}</p>
                    <p className="text-[11px] text-neutral-500 dark:text-white/40 mt-0.5 group-hover:text-neutral-600">{item.desc}</p>
                    <div className="flex items-center justify-between mt-3">
                      <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', item.badgeColor)}>{item.badge}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-neutral-300 group-hover:text-neutral-500 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>
                </button>
              ))}
              {isAdmin && (
                <button
                  onClick={() => navigate('/seguros-education/analytics')}
                  className="group relative overflow-hidden bg-white dark:bg-white/[0.03] rounded-2xl border border-neutral-200/50 dark:border-white/[0.06] p-4 text-left hover:border-transparent hover:shadow-lg hover:shadow-neutral-200/50 transition-all duration-200 focus:outline-none"
                >
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-pink-500 flex items-center justify-center mb-3 shadow-sm">
                    <BarChart3 className="w-5 h-5 text-white" />
                  </div>
                  <p className="font-bold text-sm text-neutral-900 dark:text-white">Analytics</p>
                  <p className="text-[11px] text-neutral-500 dark:text-white/40 mt-0.5">Métricas y reportes</p>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">Admin</span>
                    <ArrowRight className="w-3.5 h-3.5 text-neutral-300 group-hover:text-neutral-500 transition-colors" />
                  </div>
                </button>
              )}
            </div>
          </div>

          {/* ── Main content grid ────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

            {/* Proximas Capacitaciones — 2/5 */}
            <div className="lg:col-span-2 bg-white dark:bg-white/[0.03] rounded-2xl border border-neutral-200/50 dark:border-white/[0.06] overflow-hidden flex flex-col">
              <div className="px-5 py-4 border-b border-neutral-100 dark:border-white/[0.05] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
                    <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-neutral-900 dark:text-white">Próximas sesiones</h2>
                    <p className="text-[10px] text-neutral-400">Capacitaciones programadas</p>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/seguros-education/aula-virtual')}
                  className="text-[11px] text-[#1C37E0] font-semibold hover:underline flex items-center gap-0.5"
                >
                  Ver todas <ChevronRight className="w-3 h-3" />
                </button>
              </div>
              <div className="flex-1 p-4 space-y-2.5">
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="p-3 rounded-xl bg-neutral-50 dark:bg-white/[0.02] space-y-2">
                      <Skeleton className="h-3.5 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  ))
                ) : proxSessions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-neutral-100 dark:bg-white/5 flex items-center justify-center mb-3">
                      <Calendar className="w-5 h-5 text-neutral-300" />
                    </div>
                    <p className="text-sm font-semibold text-neutral-500 dark:text-white/40">Sin sesiones próximas</p>
                    <p className="text-xs text-neutral-400 mt-0.5">Revisa el aula virtual para más detalles</p>
                  </div>
                ) : (
                  proxSessions.map(session => {
                    const sessionDate = new Date(session.fecha_inicio);
                    const day = format(sessionDate, 'd', { locale: es });
                    const month = format(sessionDate, 'MMM', { locale: es });
                    const time = format(sessionDate, 'HH:mm');
                    const isEvento = session.tipo === 'evento';
                    return (
                      <button
                        key={session.id}
                        onClick={() => navigate('/seguros-education/aula-virtual')}
                        className="w-full flex items-start gap-3 p-3 rounded-xl hover:bg-neutral-50 dark:hover:bg-white/[0.03] transition-colors text-left group"
                      >
                        {/* Date bubble */}
                        <div className={cn('flex flex-col items-center justify-center w-10 h-12 rounded-xl flex-shrink-0 text-white font-bold leading-none', isEvento ? 'bg-emerald-500' : 'bg-[#1C37E0]')}>
                          <span className="text-lg leading-none">{day}</span>
                          <span className="text-[9px] uppercase opacity-80 mt-0.5">{month}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-neutral-900 dark:text-white line-clamp-1 group-hover:text-[#1C37E0] transition-colors">{session.titulo}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-neutral-400 flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />{time}</span>
                            <span className="text-[10px] text-neutral-400">{session.duracion_minutos} min</span>
                          </div>
                          {session.instructor?.nombre_completo && (
                            <p className="text-[10px] text-neutral-400 mt-0.5 truncate">{session.instructor.nombre_completo}</p>
                          )}
                        </div>
                        <span className={cn('flex-shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold', isEvento ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700')}>
                          {isEvento ? 'Evento' : 'Sesión'}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Ultimos Cursos — 3/5 */}
            <div className="lg:col-span-3 bg-white dark:bg-white/[0.03] rounded-2xl border border-neutral-200/50 dark:border-white/[0.06] overflow-hidden flex flex-col">
              <div className="px-5 py-4 border-b border-neutral-100 dark:border-white/[0.05] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
                    <Video className="w-3.5 h-3.5 text-[#1C37E0]" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-neutral-900 dark:text-white">Últimos cursos</h2>
                    <p className="text-[10px] text-neutral-400">Contenido reciente disponible</p>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/seguros-education/on-demand')}
                  className="text-[11px] text-[#1C37E0] font-semibold hover:underline flex items-center gap-0.5"
                >
                  Ver todos <ChevronRight className="w-3 h-3" />
                </button>
              </div>
              <div className="flex-1 p-4">
                {loading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="rounded-xl overflow-hidden border border-neutral-100 dark:border-white/[0.04]">
                        <Skeleton className="aspect-video w-full rounded-none" />
                        <div className="p-3 space-y-2">
                          <Skeleton className="h-3 w-1/3" />
                          <Skeleton className="h-3.5 w-2/3" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : recentLessons.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-neutral-100 dark:bg-white/5 flex items-center justify-center mb-3">
                      <Video className="w-5 h-5 text-neutral-300" />
                    </div>
                    <p className="text-sm font-semibold text-neutral-500 dark:text-white/40">Sin lecciones disponibles</p>
                    <p className="text-xs text-neutral-400 mt-0.5">Los cursos aparecerán aquí cuando estén publicados</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {recentLessons.slice(0, 4).map(lesson => (
                      <button
                        key={lesson.id}
                        onClick={() => navigate('/seguros-education/on-demand')}
                        className="group rounded-xl overflow-hidden border border-neutral-100 dark:border-white/[0.05] bg-white dark:bg-white/[0.02] hover:border-[#1C37E0]/30 hover:shadow-md hover:shadow-neutral-200/40 transition-all text-left focus:outline-none"
                      >
                        {/* Thumbnail */}
                        <div className="aspect-video bg-neutral-100 dark:bg-white/5 relative overflow-hidden">
                          {lesson.miniatura_url ? (
                            <img src={lesson.miniatura_url} alt={lesson.titulo} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Video className="w-8 h-8 text-neutral-300" />
                            </div>
                          )}
                          {/* Play overlay */}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                            <div className="w-9 h-9 rounded-full bg-white shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all scale-90 group-hover:scale-100">
                              <Play className="w-4 h-4 text-neutral-900 ml-0.5" />
                            </div>
                          </div>
                          {/* Progress bar */}
                          {(lesson.progreso || 0) > 0 && (
                            <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20">
                              <div className="h-full bg-[#1C37E0]" style={{ width: `${lesson.progreso}%` }} />
                            </div>
                          )}
                          {(lesson.progreso || 0) === 100 && (
                            <div className="absolute top-2 right-2">
                              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500 text-white text-[9px] font-bold">
                                <CheckCircle2 className="w-2.5 h-2.5" /> Visto
                              </span>
                            </div>
                          )}
                        </div>
                        {/* Info */}
                        <div className="p-3">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            {lesson.categoria && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                {lesson.categoria.nombre}
                              </span>
                            )}
                            <span className="text-[10px] text-neutral-400 ml-auto flex-shrink-0">{formatDuration(lesson.duracion)}</span>
                          </div>
                          <p className="text-xs font-semibold text-neutral-800 dark:text-white line-clamp-2 group-hover:text-[#1C37E0] transition-colors leading-snug">
                            {lesson.titulo}
                          </p>
                          {(lesson.progreso || 0) > 0 && (lesson.progreso || 0) < 100 && (
                            <p className="text-[10px] text-neutral-400 mt-1">{Math.floor(lesson.progreso || 0)}% visto</p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </SegurosEducationLayout>
    </>
  );
}
export default SegurosEducation;
