import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { SegurosEducationLayout } from '../components/segurosEducation/SegurosEducationLayout';
import { GraduationCap, BookOpen, Award, Clock, CircleCheck as CheckCircle2, Play, FileText, TrendingUp } from 'lucide-react';
import {
  obtenerModulosConProgreso,
  obtenerEstadisticasCurso,
  formatearTiempoEstudio
} from '../lib/cedulaAUtils';
import type { ModuloConProgreso, EstadisticasCurso } from '../lib/cedulaATypes';

export default function CursoCedulaA() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [modulos, setModulos] = useState<ModuloConProgreso[]>([]);
  const [estadisticas, setEstadisticas] = useState<EstadisticasCurso | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (usuario) {
      cargarDatos();
    }
  }, [usuario]);

  const cargarDatos = async () => {
    if (!usuario) return;

    try {
      setLoading(true);
      const [modulosData, statsData] = await Promise.all([
        obtenerModulosConProgreso(usuario.id),
        obtenerEstadisticasCurso(usuario.id)
      ]);

      setModulos(modulosData);
      setEstadisticas(statsData);
    } catch (error) {
      console.error('Error cargando datos del curso:', error);
    } finally {
      setLoading(false);
    }
  };

  const obtenerIconoModulo = (icono: string) => {
    switch (icono) {
      case 'BookOpen': return BookOpen;
      case 'GraduationCap': return GraduationCap;
      case 'Award': return Award;
      case 'FileText': return FileText;
      case 'TrendingUp': return TrendingUp;
      default: return BookOpen;
    }
  };

  const continuarEstudiando = () => {
    const moduloEnProgreso = modulos.find(m => m.estado === 'en_progreso');
    if (moduloEnProgreso) {
      navigate(`/seguros-education/cedula-a/modulo/${moduloEnProgreso.id}`);
      return;
    }

    const primerModuloDisponible = modulos.find(m => m.estado === 'disponible');
    if (primerModuloDisponible) {
      navigate(`/seguros-education/cedula-a/modulo/${primerModuloDisponible.id}`);
      return;
    }

    const primerModulo = modulos[0];
    if (primerModulo) {
      navigate(`/seguros-education/cedula-a/modulo/${primerModulo.id}`);
    }
  };

  if (loading) {
    return (
      <>
        <SegurosEducationLayout sectionTitle="Cédula A" sectionDescription="Preparación para examen CNSF">
          <div className="flex justify-center items-center py-16">
            <div className="w-8 h-8 border-[3px] border-[#1C37E0]/20 border-t-[#1C37E0] rounded-full animate-spin" />
          </div>
        </SegurosEducationLayout>
      </>
    );
  }

  return (
    <>
      <SegurosEducationLayout sectionTitle="Cédula A" sectionDescription="Preparación completa para examen CNSF">
      <div className="space-y-6">

        {estadisticas && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { icon: TrendingUp, bg: 'bg-[#1C37E0]/10', color: 'text-[#1C37E0]', value: `${estadisticas.porcentaje_global}%`, label: 'Progreso Global', valueColor: 'text-[#1C37E0]' },
              { icon: CheckCircle2, bg: 'bg-emerald-100 dark:bg-emerald-900/20', color: 'text-emerald-600', value: `${estadisticas.lecciones_completadas}/${estadisticas.total_lecciones}`, label: 'Lecciones', valueColor: 'text-neutral-900 dark:text-white' },
              { icon: Clock, bg: 'bg-blue-100 dark:bg-blue-900/20', color: 'text-blue-600', value: formatearTiempoEstudio(estadisticas.tiempo_total_segundos), label: 'Tiempo Estudio', valueColor: 'text-neutral-900 dark:text-white' },
              { icon: Award, bg: 'bg-amber-100 dark:bg-amber-900/20', color: 'text-amber-600', value: `${estadisticas.mejor_puntaje}%`, label: 'Mejor Puntaje', valueColor: 'text-neutral-900 dark:text-white' },
            ].map(({ icon: Icon, bg, color, value, label, valueColor }) => (
              <div key={label} className="bg-white dark:bg-white/[0.03] border border-neutral-200/80 dark:border-white/[0.07] rounded-2xl p-4">
                <div className={`w-9 h-9 ${bg} rounded-xl flex items-center justify-center mb-3`}>
                  <Icon className={`w-4.5 h-4.5 ${color}`} />
                </div>
                <div className={`text-xl font-bold ${valueColor} mb-0.5`}>{value}</div>
                <div className="text-xs text-neutral-500 dark:text-white/40">{label}</div>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={continuarEstudiando}
            disabled={modulos.length === 0}
            className="bg-[#1C37E0] text-white rounded-2xl p-5 hover:bg-[#1630c8] active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed text-left group"
          >
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Play className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-sm font-bold mb-1 text-white">Continuar Estudiando</h3>
            <p className="text-xs text-white/70">
              {modulos.find(m => m.estado === 'en_progreso') ? 'Retoma donde lo dejaste' : 'Comienza el curso'}
            </p>
          </button>

          <button
            onClick={() => navigate('/seguros-education/cedula-a/examenes')}
            className="bg-white dark:bg-white/[0.03] border border-neutral-200/80 dark:border-white/[0.07] rounded-2xl p-5 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all text-left group"
          >
            <div className="w-10 h-10 bg-[#1C37E0]/10 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <FileText className="w-5 h-5 text-[#1C37E0]" />
            </div>
            <h3 className="text-sm font-bold mb-1 text-neutral-900 dark:text-white">Realizar Examen</h3>
            <p className="text-xs text-neutral-500 dark:text-white/40">Practica o toma el examen final</p>
          </button>
        </div>

        <div>
          <h2 className="text-base font-bold text-neutral-900 dark:text-white mb-4">Módulos del Curso</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {modulos.map((modulo) => {
              const Icono = obtenerIconoModulo(modulo.icono);
              const progreso = modulo.progreso?.porcentaje_completado || 0;

              return (
                <div
                  key={modulo.id}
                  onClick={() => navigate(`/seguros-education/cedula-a/modulo/${modulo.id}`)}
                  className="bg-white dark:bg-white/[0.03] border border-neutral-200/80 dark:border-white/[0.07] rounded-2xl p-5 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer group"
                >
                  <div className="flex items-start gap-4 mb-4">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      modulo.estado === 'completado'
                        ? 'bg-emerald-100 dark:bg-emerald-900/30'
                        : modulo.estado === 'en_progreso'
                        ? 'bg-[#1C37E0]/10'
                        : 'bg-neutral-100 dark:bg-white/5'
                    }`}>
                      {modulo.estado === 'completado' ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      ) : (
                        <Icono className={`w-5 h-5 ${
                          modulo.estado === 'en_progreso' ? 'text-[#1C37E0]' : 'text-neutral-500 dark:text-white/40'
                        }`} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-1 group-hover:text-[#1C37E0] dark:group-hover:text-blue-400 transition-colors">
                        {modulo.titulo}
                      </h3>
                      <p className="text-xs text-neutral-500 dark:text-white/40 line-clamp-2">{modulo.descripcion}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mb-3">
                    <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-white/40">
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>{modulo.total_lecciones} lecciones</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-white/40">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{modulo.duracion_estimada_minutos} min</span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-neutral-500 dark:text-white/40">Progreso</span>
                      <span className="font-semibold text-neutral-700 dark:text-white/70">{progreso}%</span>
                    </div>
                    <div className="w-full bg-neutral-100 dark:bg-white/10 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          modulo.estado === 'completado'
                            ? 'bg-emerald-500'
                            : modulo.estado === 'en_progreso'
                            ? 'bg-[#1C37E0]'
                            : 'bg-neutral-300'
                        }`}
                        style={{ width: `${progreso}%` }}
                      />
                    </div>
                  </div>

                  {modulo.estado === 'completado' && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-emerald-600 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Módulo completado</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      </SegurosEducationLayout>
    </>
  );
}
