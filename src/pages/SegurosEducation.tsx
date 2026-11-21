import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Video, Calendar, Clock, Play, GraduationCap, ChartBar as BarChart3, BookOpen, ArrowRight, CircleCheck as CheckCircle2, ChevronRight } from 'lucide-react';
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
  completado?: boolean;
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
  portada_url?: string | null;
}



function formatDuration(segundos: number) {
  const total = Math.round(segundos || 0);
  if (total <= 0) return '';
  const h = Math.floor(total / 3600);
  const m = Math.round((total % 3600) / 60);
  if (h > 0) return m ? `${h} h ${m} min` : `${h} h`;
  return `${m} min`;
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-neutral-200/70 dark:bg-white/[0.06]', className)} />;
}

export function SegurosEducation() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [proxSessions, setProxSessions] = useState<Session[]>([]);
  const [recentLessons, setRecentLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const isAdmin = ['admin', 'administrador'].includes(usuario?.rol?.toLowerCase() || '');

  const fetchData = async () => {
    if (!usuario) return;
    try {
      setLoading(true);

      // Todo en paralelo y acotado a lo que se muestra (4 próximas, 4 recientes).
      const [sessionsData, eventosRes, lessonsRes, progressRes] = await Promise.all([
        obtenerSesiones(4),
        // Clases del Aula Virtual con fecha real (fecha_inicio), no el `fecha`
        // legado del calendario, que venía vacío o con la fecha de alta.
        supabase
          .from('aula_eventos')
          .select('id, titulo, descripcion, fecha_inicio, fecha_fin, fecha, hora, ponente, estado, portada_url')
          .in('estado', ['programado', 'en_vivo'])
          .gte('fecha_inicio', new Date(Date.now() - 30 * 60_000).toISOString())
          .order('fecha_inicio', { ascending: true })
          .limit(4),
        supabase
          .from('seguros_lessons')
          .select('id, titulo, descripcion, miniatura_url, video_url, duracion, fecha_creacion, seguros_lesson_categories(seguros_categories(nombre))')
          .order('fecha_creacion', { ascending: false })
          .limit(4),
        supabase
          .from('seguros_progress')
          .select('lesson_id, progreso, completado, tiempo_reproduccion, ultima_vista, lesson:seguros_lessons(titulo, duracion)')
          .eq('user_id', usuario.id),
      ]);

      const now = new Date();
      const upcomingSessions = sessionsData
        .filter(s => new Date(s.fecha_inicio) > now && s.estado === 'programada' && !s.esta_activa)
        .map(s => ({ ...s, tipo: 'sesion' as const }));

      const upcomingEvents = (eventosRes.data || [])
        .filter(e => !!e.fecha_inicio)
        .map(e => {
          const inicio = new Date(e.fecha_inicio as string);
          const fin = e.fecha_fin ? new Date(e.fecha_fin as string) : null;
          const minutos = fin && fin > inicio ? Math.round((fin.getTime() - inicio.getTime()) / 60_000) : 60;
          return {
            id: e.id,
            titulo: e.titulo,
            descripcion: e.descripcion,
            fecha_inicio: e.fecha_inicio as string,
            duracion_minutos: minutos,
            instructor: { id: '', nombre_completo: e.ponente ?? '' },
            esta_activa: e.estado === 'en_vivo',
            portada_url: (e.portada_url as string | null) ?? null,
            estado: 'programada' as const,
            tipo: 'evento' as const,
          };
        });

      setProxSessions([...upcomingSessions, ...upcomingEvents]
        .sort((a, b) => new Date(a.fecha_inicio).getTime() - new Date(b.fecha_inicio).getTime())
        .slice(0, 4));

      type ProgressRow = {
        lesson_id: string; progreso: number | null; completado: boolean | null;
        tiempo_reproduccion: number | null; ultima_vista: string | null;
        lesson: { titulo: string; duracion: number | null } | null;
      };
      const progressData = (progressRes.data || []) as unknown as ProgressRow[];
      const progressByLesson = new Map(progressData.map(p => [p.lesson_id, p]));

      type LessonRow = Record<string, unknown> & {
        id: string;
        seguros_lesson_categories: { seguros_categories: { nombre: string } | null }[] | null;
      };
      setRecentLessons(((lessonsRes.data || []) as unknown as LessonRow[]).map(({ seguros_lesson_categories, ...lesson }) => ({
        ...lesson,
        progreso: progressByLesson.get(lesson.id)?.progreso || 0,
        completado: progressByLesson.get(lesson.id)?.completado || false,
        categoria: seguros_lesson_categories?.[0]?.seguros_categories ?? null,
      })) as unknown as Lesson[]);

    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Primer carga y cada cambio de usuario.
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { fetchData(); }, [usuario?.id]);

  const proxima = proxSessions[0] ?? null;
  const proximaFecha = proxima ? new Date(proxima.fecha_inicio) : null;

  return (
    <>
      <SegurosEducationLayout>
        <div className="space-y-5">

          {/* ── 1. Aula Virtual + últimas de On Demand (misma altura) ── */}
          <div className="grid gap-4 lg:grid-cols-2">

            {/* Izquierda: próxima capacitación con miniatura */}
            {loading ? (
              <Skeleton className="h-80 w-full rounded-2xl" />
            ) : proxima && proximaFecha ? (
              <button
                onClick={() => navigate('/seguros-education/aula-virtual')}
                className="group flex h-full flex-col overflow-hidden rounded-2xl border border-soft bg-surface-card text-left shadow-card transition hover:shadow-xl dark:border-white/[0.06] dark:bg-white/[0.03]"
              >
                <div className="relative aspect-video w-full shrink-0 overflow-hidden bg-gradient-to-br from-[#141d4b] via-[#1a2a72] to-[#1C37E0]">
                  {proxima.portada_url ? (
                    <img
                      src={proxima.portada_url}
                      alt={proxima.titulo}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Calendar className="h-10 w-10 text-white/40" />
                    </div>
                  )}

                  <div className="absolute left-3 top-3 flex min-w-[46px] flex-col items-center rounded-xl bg-black/65 px-2.5 py-1.5 text-white backdrop-blur-sm">
                    <span className="text-[10px] font-bold uppercase leading-none opacity-90">
                      {format(proximaFecha, 'MMM', { locale: es })}
                    </span>
                    <span className="mt-0.5 text-lg font-bold leading-none">{format(proximaFecha, 'd')}</span>
                  </div>

                  <span
                    className={cn(
                      'absolute right-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide',
                      proxima.esta_activa ? 'bg-red-500 text-white' : 'bg-white/90 text-[#1C37E0]',
                    )}
                  >
                    {proxima.esta_activa ? 'En vivo' : 'Aula Virtual'}
                  </span>
                </div>

                <div className="flex flex-1 flex-col p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-accent-ink">
                    Próxima capacitación
                  </p>
                  <h2 className="mt-1 line-clamp-2 text-title-sm font-bold leading-snug text-neutral-900 dark:text-white">
                    {proxima.titulo}
                  </h2>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-neutral-500 dark:text-white/55">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {format(proximaFecha, 'HH:mm')} · {proxima.duracion_minutos} min
                    </span>
                    {proxima.instructor?.nombre_completo && (
                      <span className="truncate">{proxima.instructor.nombre_completo}</span>
                    )}
                  </div>

                  <span className="mt-auto flex items-center gap-1.5 pt-3 text-caption font-bold text-accent-ink">
                    {proxima.esta_activa ? 'Entrar ahora' : 'Ir al Aula Virtual'}
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                  </span>
                </div>
              </button>
            ) : (
              <div className="flex h-full flex-col items-start justify-center gap-3 rounded-2xl border border-dashed border-neutral-300 bg-surface-card p-6 dark:border-white/15 dark:bg-white/[0.03]">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-500/10">
                  <Calendar className="h-6 w-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-body font-bold text-neutral-900 dark:text-white">
                    No hay capacitaciones programadas
                  </p>
                  <p className="text-caption text-neutral-500 dark:text-white/55">
                    Cuando se agende una aparecerá aquí, con su fecha y su hora.
                  </p>
                </div>
                <button
                  onClick={() => navigate('/seguros-education/aula-virtual')}
                  className="rounded-xl bg-accent px-4 py-2 text-caption font-semibold text-white transition hover:bg-accent-hover"
                >
                  Programar una capacitación
                </button>
              </div>
            )}

            {/* Derecha: últimas de On Demand, dos columnas */}
            <section className="flex flex-col rounded-2xl border border-soft bg-surface-card p-4 dark:border-white/[0.06] dark:bg-white/[0.03]">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-500/10">
                    <Video className="h-4 w-4 text-[#1C37E0]" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-neutral-900 dark:text-white">Últimas grabadas</h2>
                    <p className="text-[11px] text-neutral-500">On Demand</p>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/seguros-education/on-demand')}
                  className="flex shrink-0 items-center gap-0.5 text-[11px] font-semibold text-[#1C37E0] hover:underline"
                >
                  Ver todas <ChevronRight className="h-3 w-3" />
                </button>
              </div>

              {loading ? (
                <div className="grid flex-1 grid-cols-2 gap-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-full min-h-[120px] w-full" />
                  ))}
                </div>
              ) : recentLessons.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
                  <Video className="mb-2 h-6 w-6 text-neutral-300" />
                  <p className="text-caption text-neutral-500">Aún no hay grabaciones publicadas.</p>
                </div>
              ) : (
                <div className="grid flex-1 grid-cols-2 gap-3">
                  {recentLessons.slice(0, 4).map(lesson => (
                    <button
                      key={lesson.id}
                      onClick={() => navigate('/seguros-education/on-demand')}
                      className="group flex min-h-0 flex-col overflow-hidden rounded-xl border border-soft bg-surface-card text-left transition hover:border-[#1C37E0]/30 hover:shadow-card dark:border-white/[0.05] dark:bg-white/[0.02]"
                    >
                      <div className="relative aspect-[16/10] w-full overflow-hidden bg-neutral-100 dark:bg-white/5 lg:aspect-auto lg:min-h-0 lg:flex-1">
                        {lesson.miniatura_url ? (
                          <img
                            src={lesson.miniatura_url}
                            alt={lesson.titulo}
                            loading="lazy"
                            decoding="async"
                            className="absolute inset-0 h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-105"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Video className="h-7 w-7 text-neutral-300" />
                          </div>
                        )}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20">
                          <div className="flex h-8 w-8 scale-90 items-center justify-center rounded-full bg-white opacity-0 shadow transition group-hover:scale-100 group-hover:opacity-100">
                            <Play className="ml-0.5 h-3.5 w-3.5 text-neutral-900" />
                          </div>
                        </div>
                        {(lesson.progreso || 0) > 0 && (
                          <div className="absolute inset-x-0 bottom-0 h-1 bg-black/20">
                            <div className="h-full bg-[#1C37E0]" style={{ width: `${lesson.progreso}%` }} />
                          </div>
                        )}
                        {lesson.completado && (
                          <span className="absolute right-1.5 top-1.5 flex items-center gap-1 rounded bg-emerald-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                            <CheckCircle2 className="h-2.5 w-2.5" /> Visto
                          </span>
                        )}
                      </div>
                      <div className="shrink-0 p-2">
                        <p className="line-clamp-2 text-[11.5px] font-semibold leading-snug text-neutral-800 transition-colors group-hover:text-[#1C37E0] dark:text-white">
                          {lesson.titulo}
                        </p>
                        <p className="mt-0.5 text-[10px] text-neutral-500">{formatDuration(lesson.duracion)}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* ── 3. Entradas principales ─────────────────────────── */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              onClick={() => navigate('/seguros-education/aula-virtual')}
              className="group flex items-center gap-3 rounded-2xl border border-soft bg-surface-card p-4 text-left transition-all hover:border-emerald-300 hover:shadow-card dark:border-white/[0.06] dark:bg-white/[0.03]"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500">
                <Calendar className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-neutral-900 dark:text-white">Aula Virtual</p>
                <p className="text-[11px] text-neutral-500 dark:text-white/55">Capacitaciones en vivo, invitados y grabaciones</p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-neutral-300 transition group-hover:translate-x-0.5 group-hover:text-emerald-600" />
            </button>

            <button
              onClick={() => navigate('/seguros-education/on-demand')}
              className="group flex items-center gap-3 rounded-2xl border border-soft bg-surface-card p-4 text-left transition-all hover:border-blue-300 hover:shadow-card dark:border-white/[0.06] dark:bg-white/[0.03]"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#1C37E0] to-blue-500">
                <Video className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-neutral-900 dark:text-white">On Demand</p>
                <p className="text-[11px] text-neutral-500 dark:text-white/55">Biblioteca de capacitaciones grabadas</p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-neutral-300 transition group-hover:translate-x-0.5 group-hover:text-[#1C37E0]" />
            </button>
          </div>

          {/* ── 4. Resto del módulo ─────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-neutral-400 dark:text-white/40">
              Más
            </span>
            {[
              { label: 'Cédula A', path: '/seguros-education/cedula-a', icon: GraduationCap },
              ...(isAdmin ? [{ label: 'Analytics', path: '/seguros-education/analytics', icon: BarChart3 }] : []),
              { label: 'Manuales', path: '/manuales', icon: BookOpen },
            ].map(item => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className="flex items-center gap-1.5 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-[11px] font-semibold text-neutral-600 transition hover:border-accent hover:text-accent-ink dark:border-white/10 dark:text-white/60"
              >
                <item.icon className="h-3.5 w-3.5" /> {item.label}
              </button>
            ))}
          </div>

        </div>
      </SegurosEducationLayout>
    </>
  );
}

export default SegurosEducation;
