import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Flag,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Send,
  Award
} from 'lucide-react';
import {
  obtenerExamen,
  obtenerPreguntasExamen,
  evaluarExamen
} from '../lib/cedulaAUtils';
import type { CedulaAExamen, CedulaAPregunta, ResultadoEvaluacion } from '../lib/cedulaATypes';

export default function ExamenInterface() {
  const { examenId } = useParams<{ examenId: string }>();
  const { usuario } = useAuth();
  const navigate = useNavigate();

  const [examen, setExamen] = useState<CedulaAExamen | null>(null);
  const [preguntas, setPreguntas] = useState<CedulaAPregunta[]>([]);
  const [respuestas, setRespuestas] = useState<Record<string, string>>({});
  const [preguntaActual, setPreguntaActual] = useState(0);
  const [marcadas, setMarcadas] = useState<Set<number>>(new Set());
  const [tiempoTranscurrido, setTiempoTranscurrido] = useState(0);
  const [modalConfirmacion, setModalConfirmacion] = useState(false);
  const [resultado, setResultado] = useState<ResultadoEvaluacion | null>(null);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (usuario && examenId) {
      cargarExamen();
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [usuario, examenId]);

  useEffect(() => {
    if (examen && !resultado) {
      intervalRef.current = setInterval(() => {
        setTiempoTranscurrido(prev => prev + 1);
      }, 1000);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [examen, resultado]);

  const cargarExamen = async () => {
    if (!examenId) return;

    try {
      setLoading(true);
      const [examenData, preguntasData] = await Promise.all([
        obtenerExamen(examenId),
        obtenerPreguntasExamen(examenId)
      ]);

      setExamen(examenData);
      setPreguntas(preguntasData);
    } catch (error) {
      console.error('Error cargando examen:', error);
    } finally {
      setLoading(false);
    }
  };

  const seleccionarRespuesta = (preguntaId: string, letra: string) => {
    setRespuestas(prev => ({
      ...prev,
      [preguntaId]: letra
    }));
  };

  const marcarParaRevisar = () => {
    setMarcadas(prev => {
      const newSet = new Set(prev);
      if (newSet.has(preguntaActual)) {
        newSet.delete(preguntaActual);
      } else {
        newSet.add(preguntaActual);
      }
      return newSet;
    });
  };

  const navegarPregunta = (indice: number) => {
    if (indice >= 0 && indice < preguntas.length) {
      setPreguntaActual(indice);
    }
  };

  const enviarExamen = async () => {
    if (!usuario || !examenId) return;

    try {
      const tiempoMinutos = Math.ceil(tiempoTranscurrido / 60);
      const resultado = await evaluarExamen(usuario.id, examenId, respuestas, tiempoMinutos);
      setResultado(resultado);
      setModalConfirmacion(false);

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    } catch (error) {
      console.error('Error enviando examen:', error);
    }
  };

  const obtenerColorBotonPregunta = (indice: number): string => {
    if (resultado) {
      const pregunta = preguntas[indice];
      const retro = resultado.retroalimentacion.find(r => r.pregunta_id === pregunta.id);
      if (retro?.es_correcta) {
        return 'bg-emerald-500 text-white';
      } else {
        return 'bg-red-500 text-white';
      }
    }

    const pregunta = preguntas[indice];
    const respondida = respuestas[pregunta.id];

    if (preguntaActual === indice) {
      return 'bg-primary-600 text-white ring-2 ring-primary-300';
    } else if (marcadas.has(indice)) {
      return 'bg-amber-500 text-white';
    } else if (respondida) {
      return 'bg-emerald-500 text-white';
    } else {
      return 'bg-neutral-200 text-neutral-600';
    }
  };

  const formatearTiempo = (segundos: number): string => {
    const horas = Math.floor(segundos / 3600);
    const minutos = Math.floor((segundos % 3600) / 60);
    const segs = segundos % 60;

    if (horas > 0) {
      return `${horas}:${minutos.toString().padStart(2, '0')}:${segs.toString().padStart(2, '0')}`;
    }
    return `${minutos}:${segs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-neutral-600">Cargando examen...</p>
        </div>
      </div>
    );
  }

  if (!examen || preguntas.length === 0) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-neutral-600 mb-4">No se encontró el examen</p>
          <button
            onClick={() => navigate('/seguros-education/cedula-a')}
            className="text-primary-600 hover:text-primary-700"
          >
            Volver al curso
          </button>
        </div>
      </div>
    );
  }

  if (resultado) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="bg-white rounded-ios-xl shadow-ios-lg p-8 mb-6">
            <div className="text-center mb-8">
              <div className={`w-24 h-24 rounded-full mx-auto mb-4 flex items-center justify-center ${
                resultado.aprobado ? 'bg-emerald-100' : 'bg-red-100'
              }`}>
                {resultado.aprobado ? (
                  <Award className="w-12 h-12 text-emerald-600" />
                ) : (
                  <XCircle className="w-12 h-12 text-red-600" />
                )}
              </div>
              <h1 className="text-3xl font-bold text-neutral-900 mb-2">
                {resultado.aprobado ? '¡Felicidades!' : 'Sigue Practicando'}
              </h1>
              <p className="text-lg text-neutral-600 mb-6">
                {resultado.aprobado
                  ? 'Has aprobado el examen exitosamente'
                  : 'No alcanzaste el puntaje mínimo requerido'}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-neutral-50 rounded-ios-lg p-4">
                  <div className="text-3xl font-bold text-primary-600 mb-1">
                    {resultado.puntaje}%
                  </div>
                  <div className="text-sm text-neutral-600">Calificación</div>
                </div>
                <div className="bg-neutral-50 rounded-ios-lg p-4">
                  <div className="text-3xl font-bold text-neutral-900 mb-1">
                    {resultado.respuestas_correctas}/{resultado.total_preguntas}
                  </div>
                  <div className="text-sm text-neutral-600">Correctas</div>
                </div>
                <div className="bg-neutral-50 rounded-ios-lg p-4">
                  <div className="text-3xl font-bold text-neutral-900 mb-1">
                    {formatearTiempo(tiempoTranscurrido)}
                  </div>
                  <div className="text-sm text-neutral-600">Tiempo</div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 justify-center">
              {resultado.aprobado && examen.tipo === 'final' && (
                <button
                  onClick={() => navigate('/seguros-education/cedula-a/certificados')}
                  className="px-6 py-3 bg-amber-600 text-white rounded-ios-lg hover:bg-amber-700 active:scale-[0.98] transition-all font-medium"
                >
                  Ver Certificado
                </button>
              )}
              <button
                onClick={() => navigate('/seguros-education/cedula-a')}
                className="px-6 py-3 bg-primary-600 text-white rounded-ios-lg hover:bg-primary-700 active:scale-[0.98] transition-all font-medium"
              >
                Volver al Curso
              </button>
              {examen.tipo === 'practica' && (
                <button
                  onClick={() => window.location.reload()}
                  className="px-6 py-3 bg-neutral-600 text-white rounded-ios-lg hover:bg-neutral-700 active:scale-[0.98] transition-all font-medium"
                >
                  Reintentar
                </button>
              )}
            </div>
          </div>

          <div className="bg-white rounded-ios-xl shadow-ios p-6">
            <h2 className="text-xl font-bold text-neutral-900 mb-4">Retroalimentación Detallada</h2>
            <div className="space-y-6">
              {resultado.retroalimentacion.map((retro, index) => (
                <div key={index} className={`border-l-4 rounded-ios-lg p-4 ${
                  retro.es_correcta ? 'border-emerald-500 bg-emerald-50' : 'border-red-500 bg-red-50'
                }`}>
                  <div className="flex items-start gap-3 mb-3">
                    {retro.es_correcta ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <h3 className="font-semibold text-neutral-900 mb-2">
                        Pregunta {index + 1}
                      </h3>
                      <p className="text-neutral-700">{retro.pregunta}</p>
                    </div>
                  </div>

                  <div className="space-y-2 mb-3">
                    {retro.opciones.map((opcion) => {
                      const esRespuestaUsuario = opcion.letra === retro.respuesta_usuario;
                      const esRespuestaCorrecta = opcion.letra === retro.respuesta_correcta;

                      return (
                        <div
                          key={opcion.letra}
                          className={`p-3 rounded-ios ${
                            esRespuestaCorrecta
                              ? 'bg-emerald-100 border-2 border-emerald-500'
                              : esRespuestaUsuario && !retro.es_correcta
                              ? 'bg-red-100 border-2 border-red-500'
                              : 'bg-white border border-neutral-200'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{opcion.letra}.</span>
                            <span>{opcion.texto}</span>
                            {esRespuestaCorrecta && (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 ml-auto" />
                            )}
                            {esRespuestaUsuario && !retro.es_correcta && (
                              <XCircle className="w-4 h-4 text-red-600 ml-auto" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="bg-white rounded-ios p-3">
                    <h4 className="font-semibold text-neutral-900 mb-1">Explicación:</h4>
                    <p className="text-neutral-700">{retro.explicacion}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const pregunta = preguntas[preguntaActual];
  const respondidas = Object.keys(respuestas).length;
  const progresoRespuestas = Math.round((respondidas / preguntas.length) * 100);

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      <div className="bg-white border-b border-neutral-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-neutral-900">{examen.titulo}</h1>
            <p className="text-sm text-neutral-600">
              Pregunta {preguntaActual + 1} de {preguntas.length}
            </p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="flex items-center gap-2 text-lg font-semibold text-neutral-900">
                <Clock className="w-5 h-5 text-primary-600" />
                <span>{formatearTiempo(tiempoTranscurrido)}</span>
              </div>
              <p className="text-xs text-neutral-500">Tiempo de referencia: {examen.duracion_referencia_minutos} min</p>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-neutral-900">
                {respondidas}/{preguntas.length}
              </div>
              <p className="text-xs text-neutral-500">Respondidas</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-3">
              <div className="bg-white rounded-ios-xl shadow-ios p-8 mb-6">
                <h2 className="text-xl font-semibold text-neutral-900 mb-6">
                  {pregunta.pregunta}
                </h2>

                <div className="space-y-3">
                  {pregunta.opciones.map((opcion) => {
                    const seleccionada = respuestas[pregunta.id] === opcion.letra;

                    return (
                      <button
                        key={opcion.letra}
                        onClick={() => seleccionarRespuesta(pregunta.id, opcion.letra)}
                        className={`w-full text-left p-4 rounded-ios-lg border-2 transition-all ${
                          seleccionada
                            ? 'border-primary-600 bg-primary-50'
                            : 'border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                            seleccionada
                              ? 'border-primary-600 bg-primary-600'
                              : 'border-neutral-300'
                          }`}>
                            {seleccionada && (
                              <div className="w-3 h-3 rounded-full bg-white"></div>
                            )}
                          </div>
                          <div className="flex-1">
                            <span className="font-semibold text-neutral-900">{opcion.letra}.</span>
                            <span className="ml-2 text-neutral-700">{opcion.texto}</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <button
                  onClick={() => navegarPregunta(preguntaActual - 1)}
                  disabled={preguntaActual === 0}
                  className="flex items-center gap-2 px-6 py-3 text-neutral-700 hover:text-neutral-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                  <span>Anterior</span>
                </button>

                <button
                  onClick={marcarParaRevisar}
                  className={`flex items-center gap-2 px-6 py-3 rounded-ios-lg transition-all ${
                    marcadas.has(preguntaActual)
                      ? 'bg-amber-500 text-white'
                      : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                  }`}
                >
                  <Flag className="w-5 h-5" />
                  <span>Marcar para revisión</span>
                </button>

                <button
                  onClick={() => navegarPregunta(preguntaActual + 1)}
                  disabled={preguntaActual === preguntas.length - 1}
                  className="flex items-center gap-2 px-6 py-3 text-neutral-700 hover:text-neutral-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <span>Siguiente</span>
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="lg:col-span-1">
              <div className="bg-white rounded-ios-xl shadow-ios p-6 sticky top-6">
                <h3 className="font-semibold text-neutral-900 mb-4">Navegación de Preguntas</h3>
                <div className="grid grid-cols-5 gap-2 mb-6">
                  {preguntas.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => navegarPregunta(index)}
                      className={`aspect-square rounded-ios text-sm font-semibold transition-all hover:scale-105 ${
                        obtenerColorBotonPregunta(index)
                      }`}
                    >
                      {index + 1}
                    </button>
                  ))}
                </div>

                <div className="space-y-2 mb-6 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-primary-600 rounded"></div>
                    <span className="text-neutral-600">Actual</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-emerald-500 rounded"></div>
                    <span className="text-neutral-600">Respondida</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-amber-500 rounded"></div>
                    <span className="text-neutral-600">Para revisión</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-neutral-200 rounded"></div>
                    <span className="text-neutral-600">Pendiente</span>
                  </div>
                </div>

                <div className="space-y-2 mb-6">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-neutral-600">Progreso</span>
                    <span className="font-semibold text-neutral-900">{progresoRespuestas}%</span>
                  </div>
                  <div className="w-full bg-neutral-200 rounded-full h-2">
                    <div
                      className="h-full bg-primary-500 rounded-full transition-all duration-500"
                      style={{ width: `${progresoRespuestas}%` }}
                    />
                  </div>
                </div>

                <button
                  onClick={() => setModalConfirmacion(true)}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-ios-lg hover:bg-primary-700 active:scale-[0.98] transition-all font-medium"
                >
                  <Send className="w-5 h-5" />
                  <span>Enviar Examen</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {modalConfirmacion && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-ios-xl w-full max-w-md p-6 shadow-ios-xl animate-scale-in">
            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-6 h-6 text-amber-600" />
            </div>
            <h2 className="text-xl font-bold text-neutral-900 text-center mb-2">
              ¿Enviar Examen?
            </h2>
            <p className="text-neutral-600 text-center mb-6">
              Has respondido {respondidas} de {preguntas.length} preguntas.
              {respondidas < preguntas.length && ' Las preguntas sin responder se contarán como incorrectas.'}
              {marcadas.size > 0 && ` Tienes ${marcadas.size} pregunta(s) marcada(s) para revisión.`}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setModalConfirmacion(false)}
                className="flex-1 px-6 py-3 bg-neutral-100 text-neutral-700 rounded-ios-lg hover:bg-neutral-200 transition-colors font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={enviarExamen}
                className="flex-1 px-6 py-3 bg-primary-600 text-white rounded-ios-lg hover:bg-primary-700 transition-colors font-medium"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
