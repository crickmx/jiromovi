import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Circle,
  Clock,
  Menu,
  X,
  Award,
  FileText
} from 'lucide-react';
import {
  obtenerModuloConProgreso,
  obtenerLeccionesModulo,
  obtenerProgresoLeccion,
  obtenerLeccion,
  actualizarProgresoLeccion,
  marcarLeccionCompletada,
  obtenerModulosConProgreso
} from '../lib/cedulaAUtils';
import type { ModuloConProgreso, CedulaALeccion, CedulaAProgresoLeccion } from '../lib/cedulaATypes';
import LeccionContent from '../components/cedulaA/LeccionContent';

export default function ModuloViewer() {
  const { moduloId } = useParams<{ moduloId: string }>();
  const { usuario } = useAuth();
  const navigate = useNavigate();

  const [modulo, setModulo] = useState<ModuloConProgreso | null>(null);
  const [lecciones, setLecciones] = useState<CedulaALeccion[]>([]);
  const [leccionActual, setLeccionActual] = useState<CedulaALeccion | null>(null);
  const [progresoLeccion, setProgresoLeccion] = useState<CedulaAProgresoLeccion | null>(null);
  const [sidebarAbierto, setSidebarAbierto] = useState(true);
  const [tiempoEstudio, setTiempoEstudio] = useState(0);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [guardadoReciente, setGuardadoReciente] = useState(false);
  const [todosModulos, setTodosModulos] = useState<ModuloConProgreso[]>([]);
  const [modalExamenListo, setModalExamenListo] = useState(false);
  const [examenModuloId, setExamenModuloId] = useState<string | null>(null);

  useEffect(() => {
    if (usuario && moduloId) {
      cargarModulo();
    }
  }, [usuario, moduloId]);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setTiempoEstudio(prev => prev + 1);
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (tiempoEstudio > 0 && tiempoEstudio % 30 === 0) {
      guardarProgreso();
    }
  }, [tiempoEstudio]);

  const cargarModulo = async () => {
    if (!usuario || !moduloId) return;

    try {
      setLoading(true);
      const [moduloData, leccionesData, modulosData] = await Promise.all([
        obtenerModuloConProgreso(usuario.id, moduloId),
        obtenerLeccionesModulo(moduloId),
        obtenerModulosConProgreso(usuario.id)
      ]);

      setModulo(moduloData);
      setLecciones(leccionesData);
      setTodosModulos(modulosData);

      if (leccionesData.length > 0) {
        const leccionPendiente = leccionesData.find(async (l) => {
          const progreso = await obtenerProgresoLeccion(usuario.id, l.id);
          return !progreso?.completado;
        });

        const primeraLeccion = leccionPendiente || leccionesData[0];
        await cargarLeccion(primeraLeccion.id);
      }
    } catch (error) {
      console.error('Error cargando módulo:', error);
    } finally {
      setLoading(false);
    }
  };

  const cargarLeccion = async (leccionId: string) => {
    if (!usuario) return;

    try {
      const [leccion, progreso] = await Promise.all([
        obtenerLeccion(leccionId),
        obtenerProgresoLeccion(usuario.id, leccionId)
      ]);

      setLeccionActual(leccion);
      setProgresoLeccion(progreso);
      setTiempoEstudio(progreso?.tiempo_estudio_segundos || 0);

      if (window.innerWidth < 1024) {
        setSidebarAbierto(false);
      }
    } catch (error) {
      console.error('Error cargando lección:', error);
    }
  };

  const guardarProgreso = async () => {
    if (!usuario || !leccionActual) return;

    try {
      await actualizarProgresoLeccion(usuario.id, leccionActual.id, {
        tiempo_estudio_segundos: tiempoEstudio
      });

      setGuardadoReciente(true);
      setTimeout(() => setGuardadoReciente(false), 2000);
    } catch (error) {
      console.error('Error guardando progreso:', error);
    }
  };

  const marcarCompletada = async () => {
    if (!usuario || !leccionActual) return;

    try {
      await marcarLeccionCompletada(usuario.id, leccionActual.id);
      setProgresoLeccion(prev => prev ? { ...prev, completado: true } : null);

      if (modulo) {
        const moduloActualizado = await obtenerModuloConProgreso(usuario.id, modulo.id);
        setModulo(moduloActualizado);
      }

      siguienteLeccion();
    } catch (error) {
      console.error('Error marcando lección como completada:', error);
    }
  };

  const siguienteLeccion = async () => {
    if (!leccionActual) return;

    const indiceActual = lecciones.findIndex(l => l.id === leccionActual.id);
    if (indiceActual < lecciones.length - 1) {
      cargarLeccion(lecciones[indiceActual + 1].id);
    } else {
      // Última lección del módulo
      if (modulo) {
        const moduloActualizado = await obtenerModuloConProgreso(usuario!.id, modulo.id);
        if (moduloActualizado?.progreso?.porcentaje_completado === 100) {
          // Módulo completado, verificar si hay examen
          verificarExamenModulo();
        } else {
          avanzarSiguienteModulo();
        }
      }
    }
  };

  const verificarExamenModulo = async () => {
    if (!modulo) return;

    try {
      // Buscar examen del módulo
      const { data: examen } = await supabase
        .from('cedula_a_examenes')
        .select('id')
        .eq('modulo_id', modulo.id)
        .eq('tipo', 'modulo')
        .maybeSingle();

      if (examen) {
        setExamenModuloId(examen.id);
        setModalExamenListo(true);
      } else {
        avanzarSiguienteModulo();
      }
    } catch (error) {
      console.error('Error verificando examen:', error);
      avanzarSiguienteModulo();
    }
  };

  const irAlExamen = () => {
    if (examenModuloId) {
      navigate(`/seguros-education/cedula-a/examen/${examenModuloId}`);
    }
  };

  const avanzarSiguienteModulo = () => {
    if (!modulo || !usuario) return;

    const indiceModuloActual = todosModulos.findIndex(m => m.id === modulo.id);
    if (indiceModuloActual < todosModulos.length - 1) {
      const siguienteModulo = todosModulos[indiceModuloActual + 1];
      navigate(`/seguros-education/cedula-a/modulo/${siguienteModulo.id}`);
    } else {
      navigate('/seguros-education/cedula-a');
    }
  };

  const leccionAnterior = () => {
    if (!leccionActual) return;

    const indiceActual = lecciones.findIndex(l => l.id === leccionActual.id);
    if (indiceActual > 0) {
      cargarLeccion(lecciones[indiceActual - 1].id);
    }
  };

  const obtenerEstadoLeccion = (leccionId: string): 'completado' | 'actual' | 'pendiente' => {
    if (leccionActual?.id === leccionId) return 'actual';
    return 'pendiente';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-neutral-600">Cargando módulo...</p>
        </div>
      </div>
    );
  }

  if (!modulo || !leccionActual) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-neutral-600">No se encontró el módulo</p>
          <button
            onClick={() => navigate('/seguros-education/cedula-a')}
            className="mt-4 text-primary-600 hover:text-primary-700"
          >
            Volver al curso
          </button>
        </div>
      </div>
    );
  }

  const indiceActual = lecciones.findIndex(l => l.id === leccionActual.id);
  const esUltimaLeccion = indiceActual === lecciones.length - 1;
  const esPrimeraLeccion = indiceActual === 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-neutral-50 flex">
      {sidebarAbierto && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarAbierto(false)}
        />
      )}

      <div
        className={`fixed lg:static inset-y-0 left-0 w-80 max-w-[85vw] bg-white/95 backdrop-blur-sm border-r border-neutral-200/50 transition-transform duration-280 z-30 shadow-xl lg:shadow-none ${
          sidebarAbierto ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="h-full flex flex-col">
          <div className="p-6 border-b border-neutral-200">
            <button
              onClick={() => navigate('/seguros-education/cedula-a')}
              className="flex items-center gap-2 text-sm text-neutral-600 hover:text-neutral-900 mb-4"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Volver al curso</span>
            </button>
            <h2 className="text-lg font-bold text-neutral-900">{modulo.titulo}</h2>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-600">Progreso</span>
                <span className="font-semibold text-neutral-900">
                  {modulo.progreso?.porcentaje_completado || 0}%
                </span>
              </div>
              <div className="w-full bg-neutral-200 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-primary-500 transition-all duration-500"
                  style={{ width: `${modulo.progreso?.porcentaje_completado || 0}%` }}
                />
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-1">
            {lecciones.map((leccion, index) => {
              const estado = obtenerEstadoLeccion(leccion.id);
              const esActual = leccion.id === leccionActual.id;

              return (
                <button
                  key={leccion.id}
                  onClick={() => cargarLeccion(leccion.id)}
                  className={`w-full flex items-start gap-3 p-3 rounded-ios-lg text-left transition-all ${
                    esActual
                      ? 'bg-primary-50 border border-primary-200'
                      : 'hover:bg-neutral-50 border border-transparent'
                  }`}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {estado === 'completado' ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs font-medium ${
                        esActual
                          ? 'border-primary-600 text-primary-600'
                          : 'border-neutral-300 text-neutral-400'
                      }`}>
                        {index + 1}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className={`text-sm font-medium ${
                      esActual ? 'text-primary-900' : 'text-neutral-700'
                    }`}>
                      {leccion.titulo}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-1 text-xs text-neutral-500">
                      <Clock className="w-3 h-3" />
                      <span>{leccion.duracion_estimada_minutos} min</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="bg-white/80 backdrop-blur-sm border-b border-neutral-200/50 px-4 sm:px-6 py-4 sticky top-0 z-10">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <button
                onClick={() => setSidebarAbierto(!sidebarAbierto)}
                className="lg:hidden p-2 hover:bg-neutral-100 rounded-ios transition-colors flex-shrink-0"
              >
                {sidebarAbierto ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
              <div className="min-w-0">
                <h1 className="text-base sm:text-xl font-bold text-neutral-900 truncate">{leccionActual.titulo}</h1>
                <p className="text-xs sm:text-sm text-neutral-600">
                  Lección {indiceActual + 1} de {lecciones.length}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              {guardadoReciente && (
                <span className="text-xs sm:text-sm text-emerald-600 animate-fade-in hidden sm:inline">
                  Guardado
                </span>
              )}
              <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-neutral-600">
                <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>{Math.floor(tiempoEstudio / 60)} min</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
            <LeccionContent contenido={leccionActual.contenido} />
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-sm border-t border-neutral-200/50 px-4 sm:px-6 py-4 sticky bottom-0">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
            <button
              onClick={leccionAnterior}
              disabled={esPrimeraLeccion}
              className="p-2 sm:p-3 rounded-ios-lg text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
              title="Lección anterior"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              {!progresoLeccion?.completado && (
                <button
                  onClick={marcarCompletada}
                  className="px-4 sm:px-6 py-2.5 sm:py-3 bg-emerald-600 text-white rounded-ios-lg hover:bg-emerald-700 active:scale-[0.98] transition-all font-medium text-sm sm:text-base shadow-lg shadow-emerald-600/25"
                >
                  <span className="hidden sm:inline">Marcar como completada</span>
                  <span className="sm:hidden">Completar</span>
                </button>
              )}

              {progresoLeccion?.completado && (
                <div className="flex items-center gap-2 text-emerald-600 font-medium text-sm">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="hidden sm:inline">Completada</span>
                </div>
              )}
            </div>

            <button
              onClick={siguienteLeccion}
              disabled={esUltimaLeccion}
              className="p-2 sm:p-3 rounded-ios-lg text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
              title={esUltimaLeccion ? "Última lección del módulo" : "Siguiente lección"}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {modalExamenListo && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-ios-xl w-full max-w-lg p-6 sm:p-8 shadow-ios-xl animate-scale-in">
            <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-amber-600 rounded-ios-xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Award className="w-8 h-8 text-white" />
            </div>

            <h2 className="text-2xl font-bold text-neutral-900 text-center mb-2">
              ¡Módulo Completado!
            </h2>

            <p className="text-neutral-600 text-center mb-6">
              Has terminado todas las lecciones de <strong>{modulo?.titulo}</strong>.
              ¿Te gustaría realizar el examen de este módulo para evaluar tus conocimientos?
            </p>

            <div className="bg-primary-50 rounded-ios-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <FileText className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-semibold text-primary-900 mb-1">Examen del Módulo</h4>
                  <p className="text-sm text-primary-700">
                    Evalúa tu comprensión de los temas vistos en este módulo.
                    Puedes realizarlo ahora o más tarde desde la sección de exámenes.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => {
                  setModalExamenListo(false);
                  avanzarSiguienteModulo();
                }}
                className="flex-1 px-6 py-3 bg-neutral-100 text-neutral-700 rounded-ios-lg hover:bg-neutral-200 active:scale-[0.98] transition-all font-medium"
              >
                Más tarde
              </button>
              <button
                onClick={irAlExamen}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-ios-lg hover:from-primary-700 hover:to-primary-800 active:scale-[0.98] transition-all font-medium shadow-lg shadow-primary-600/25"
              >
                Realizar Examen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
