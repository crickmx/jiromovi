import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  GraduationCap,
  BookOpen,
  Award,
  Clock,
  CheckCircle2,
  Play,
  FileText,
  TrendingUp,
  Lock,
  ArrowLeft
} from 'lucide-react';
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
    } else {
      const primerModulo = modulos[0];
      if (primerModulo) {
        navigate(`/seguros-education/cedula-a/modulo/${primerModulo.id}`);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-neutral-600">Cargando curso...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-neutral-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="mb-6 sm:mb-8">
          <button
            onClick={() => navigate('/seguros-education')}
            className="flex items-center gap-2 text-neutral-600 hover:text-neutral-900 mb-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm sm:text-base">Volver a Seguros Education</span>
          </button>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-primary-600 rounded-ios-xl flex items-center justify-center flex-shrink-0">
              <GraduationCap className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900">Curso de Cédula A</h1>
              <p className="text-sm sm:text-base text-neutral-600">Preparación completa para examen CNSF</p>
            </div>
          </div>
        </div>

        {estadisticas && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
            <div className="bg-white rounded-ios-xl p-4 sm:p-6 shadow-ios">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-2">
                <div className="w-10 h-10 bg-primary-100 rounded-ios flex items-center justify-center mb-2 sm:mb-0">
                  <TrendingUp className="w-5 h-5 text-primary-600" />
                </div>
                <span className="text-xl sm:text-2xl font-bold text-primary-600">{estadisticas.porcentaje_global}%</span>
              </div>
              <p className="text-xs sm:text-sm text-neutral-600">Progreso Global</p>
            </div>

            <div className="bg-white rounded-ios-xl p-4 sm:p-6 shadow-ios">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-2">
                <div className="w-10 h-10 bg-emerald-100 rounded-ios flex items-center justify-center mb-2 sm:mb-0">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                </div>
                <span className="text-xl sm:text-2xl font-bold text-neutral-900">
                  {estadisticas.lecciones_completadas}/{estadisticas.total_lecciones}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-neutral-600">Lecciones Completadas</p>
            </div>

            <div className="bg-white rounded-ios-xl p-4 sm:p-6 shadow-ios">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-2">
                <div className="w-10 h-10 bg-blue-100 rounded-ios flex items-center justify-center mb-2 sm:mb-0">
                  <Clock className="w-5 h-5 text-blue-600" />
                </div>
                <span className="text-xl sm:text-2xl font-bold text-neutral-900">
                  {formatearTiempoEstudio(estadisticas.tiempo_total_segundos)}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-neutral-600">Tiempo de Estudio</p>
            </div>

            <div className="bg-white rounded-ios-xl p-4 sm:p-6 shadow-ios">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-2">
                <div className="w-10 h-10 bg-amber-100 rounded-ios flex items-center justify-center mb-2 sm:mb-0">
                  <Award className="w-5 h-5 text-amber-600" />
                </div>
                <span className="text-xl sm:text-2xl font-bold text-neutral-900">{estadisticas.mejor_puntaje}%</span>
              </div>
              <p className="text-xs sm:text-sm text-neutral-600">Mejor Puntaje</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <button
            onClick={continuarEstudiando}
            disabled={modulos.length === 0}
            className="bg-primary-600 text-white rounded-ios-xl p-5 sm:p-6 shadow-ios-lg hover:bg-primary-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed text-left"
          >
            <Play className="w-7 h-7 sm:w-8 sm:h-8 mb-3" />
            <h3 className="text-base sm:text-lg font-semibold mb-1">Continuar Estudiando</h3>
            <p className="text-xs sm:text-sm text-primary-100">
              {modulos.find(m => m.estado === 'en_progreso') ? 'Retoma donde lo dejaste' : 'Comienza el curso'}
            </p>
          </button>

          <button
            onClick={() => navigate('/seguros-education/cedula-a/examenes')}
            className="bg-white text-neutral-900 rounded-ios-xl p-5 sm:p-6 shadow-ios hover:shadow-ios-md active:scale-[0.98] transition-all text-left"
          >
            <FileText className="w-7 h-7 sm:w-8 sm:h-8 mb-3 text-primary-600" />
            <h3 className="text-base sm:text-lg font-semibold mb-1">Realizar Examen</h3>
            <p className="text-xs sm:text-sm text-neutral-600">Practica o toma el examen final</p>
          </button>
        </div>

        <div>
          <h2 className="text-2xl font-bold text-neutral-900 mb-4">Módulos del Curso</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {modulos.map((modulo) => {
              const Icono = obtenerIconoModulo(modulo.icono);
              const progreso = modulo.progreso?.porcentaje_completado || 0;

              return (
                <div
                  key={modulo.id}
                  onClick={() => navigate(`/seguros-education/cedula-a/modulo/${modulo.id}`)}
                  className="bg-white rounded-ios-xl p-6 shadow-ios hover:shadow-ios-lg active:scale-[0.98] transition-all cursor-pointer group"
                >
                  <div className="flex items-start gap-4 mb-4">
                    <div className={`w-12 h-12 rounded-ios-lg flex items-center justify-center flex-shrink-0 ${
                      modulo.estado === 'completado'
                        ? 'bg-emerald-100'
                        : modulo.estado === 'en_progreso'
                        ? 'bg-primary-100'
                        : 'bg-neutral-100'
                    }`}>
                      {modulo.estado === 'completado' ? (
                        <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                      ) : (
                        <Icono className={`w-6 h-6 ${
                          modulo.estado === 'en_progreso' ? 'text-primary-600' : 'text-neutral-600'
                        }`} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-neutral-900 mb-1 group-hover:text-primary-600 transition-colors">
                        {modulo.titulo}
                      </h3>
                      <p className="text-sm text-neutral-600 line-clamp-2">{modulo.descripcion}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mb-3">
                    <div className="flex items-center gap-1.5 text-sm text-neutral-600">
                      <BookOpen className="w-4 h-4" />
                      <span>{modulo.total_lecciones} lecciones</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-neutral-600">
                      <Clock className="w-4 h-4" />
                      <span>{modulo.duracion_estimada_minutos} min</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-neutral-600">Progreso</span>
                      <span className="font-semibold text-neutral-900">{progreso}%</span>
                    </div>
                    <div className="w-full bg-neutral-200 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          modulo.estado === 'completado'
                            ? 'bg-emerald-500'
                            : modulo.estado === 'en_progreso'
                            ? 'bg-primary-500'
                            : 'bg-neutral-300'
                        }`}
                        style={{ width: `${progreso}%` }}
                      />
                    </div>
                  </div>

                  {modulo.estado === 'completado' && (
                    <div className="mt-3 flex items-center gap-2 text-sm text-emerald-600 font-medium">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Módulo completado</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
