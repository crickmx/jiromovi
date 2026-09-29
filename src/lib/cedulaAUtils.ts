import { supabase } from './supabase';
import type {
  CedulaAModulo,
  CedulaALeccion,
  CedulaAExamen,
  CedulaAPregunta,
  CedulaAMapaMental,
  CedulaAGlosario,
  CedulaAProgresoLeccion,
  CedulaAIntentoExamen,
  CedulaACertificado,
  ResultadoEvaluacion,
  EstadisticasCurso,
  ModuloConProgreso
} from './cedulaATypes';

export async function obtenerModulos(): Promise<CedulaAModulo[]> {
  const { data, error } = await supabase
    .from('cedula_a_modulos')
    .select('*')
    .order('orden', { ascending: true });

  if (error) throw error;
  return data || [];
}

function estadoModulo(porcentaje?: number): 'disponible' | 'en_progreso' | 'completado' {
  if (porcentaje === 100) return 'completado';
  if ((porcentaje ?? 0) > 0) return 'en_progreso';
  return 'disponible';
}

/** Módulos con progreso del usuario: 2 consultas en paralelo (antes 1 + 2 por módulo). */
async function cargarModulosConProgreso(userId: string, moduloId?: string): Promise<ModuloConProgreso[]> {
  let modulosQuery = supabase
    .from('cedula_a_modulos')
    .select('*, lecciones:cedula_a_lecciones(count)')
    .order('orden', { ascending: true });
  let progresoQuery = supabase
    .from('cedula_a_progreso_modulos')
    .select('*')
    .eq('user_id', userId);
  if (moduloId) {
    modulosQuery = modulosQuery.eq('id', moduloId);
    progresoQuery = progresoQuery.eq('modulo_id', moduloId);
  }

  const [modulosRes, progresoRes] = await Promise.all([modulosQuery, progresoQuery]);
  if (modulosRes.error) throw modulosRes.error;

  const progresoPorModulo = new Map((progresoRes.data || []).map((p) => [p.modulo_id, p]));
  return (modulosRes.data || []).map(({ lecciones, ...modulo }) => {
    const progreso = progresoPorModulo.get(modulo.id);
    return {
      ...modulo,
      progreso: progreso || undefined,
      total_lecciones: (lecciones as { count: number }[] | null)?.[0]?.count ?? 0,
      estado: estadoModulo(progreso?.porcentaje_completado),
    } as ModuloConProgreso;
  });
}

export async function obtenerModuloConProgreso(userId: string, moduloId: string): Promise<ModuloConProgreso | null> {
  const [modulo] = await cargarModulosConProgreso(userId, moduloId);
  return modulo ?? null;
}

export async function obtenerModulosConProgreso(userId: string): Promise<ModuloConProgreso[]> {
  return cargarModulosConProgreso(userId);
}

/** Índice de lecciones del módulo (sin `contenido`, que se carga solo para la lección abierta). */
export async function obtenerLeccionesModulo(moduloId: string): Promise<Omit<CedulaALeccion, 'contenido'>[]> {
  const { data, error } = await supabase
    .from('cedula_a_lecciones')
    .select('id, modulo_id, titulo, orden, duracion_estimada_minutos, created_at, updated_at')
    .eq('modulo_id', moduloId)
    .order('orden', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function obtenerLeccion(leccionId: string): Promise<CedulaALeccion | null> {
  const { data, error } = await supabase
    .from('cedula_a_lecciones')
    .select('*')
    .eq('id', leccionId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/** IDs de lecciones completadas por el usuario dentro de un conjunto (1 consulta). */
export async function obtenerLeccionesCompletadas(userId: string, leccionIds: string[]): Promise<Set<string>> {
  if (leccionIds.length === 0) return new Set();
  const { data, error } = await supabase
    .from('cedula_a_progreso_lecciones')
    .select('leccion_id')
    .eq('user_id', userId)
    .eq('completado', true)
    .in('leccion_id', leccionIds);
  if (error) throw error;
  return new Set((data || []).map((p) => p.leccion_id));
}

export async function obtenerProgresoLeccion(userId: string, leccionId: string): Promise<CedulaAProgresoLeccion | null> {
  const { data, error } = await supabase
    .from('cedula_a_progreso_lecciones')
    .select('*')
    .eq('user_id', userId)
    .eq('leccion_id', leccionId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function actualizarProgresoLeccion(
  userId: string,
  leccionId: string,
  updates: Partial<CedulaAProgresoLeccion>
): Promise<void> {
  const { error } = await supabase
    .from('cedula_a_progreso_lecciones')
    .upsert({
      user_id: userId,
      leccion_id: leccionId,
      ...updates,
      ultima_visita: new Date().toISOString()
    }, {
      onConflict: 'user_id,leccion_id'
    });

  if (error) throw error;
}

export async function marcarLeccionCompletada(userId: string, leccionId: string): Promise<void> {
  await actualizarProgresoLeccion(userId, leccionId, { completado: true });

  const { data: leccion } = await supabase
    .from('cedula_a_lecciones')
    .select('modulo_id')
    .eq('id', leccionId)
    .single();

  if (leccion) {
    await calcularProgresoModulo(userId, leccion.modulo_id);
  }
}

export async function calcularProgresoModulo(userId: string, moduloId: string): Promise<number> {
  const { data, error } = await supabase.rpc('fn_calcular_progreso_modulo', {
    p_user_id: userId,
    p_modulo_id: moduloId
  });

  if (error) throw error;
  return data || 0;
}

export async function obtenerExamenes(tipo?: 'practica' | 'modulo' | 'final'): Promise<CedulaAExamen[]> {
  let query = supabase
    .from('cedula_a_examenes')
    .select('*')
    .eq('activo', true)
    .order('orden', { ascending: true });

  if (tipo) {
    query = query.eq('tipo', tipo);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

export async function obtenerExamen(examenId: string): Promise<CedulaAExamen | null> {
  const { data, error } = await supabase
    .from('cedula_a_examenes')
    .select('*')
    .eq('id', examenId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function obtenerPreguntasExamen(examenId: string): Promise<CedulaAPregunta[]> {
  const { data, error } = await supabase
    .from('cedula_a_preguntas')
    // respuesta_correcta y explicacion no son legibles desde el cliente; llegan en la evaluación.
    .select('id, examen_id, pregunta, opciones, modulo_referencia_id, dificultad, orden')
    .eq('examen_id', examenId)
    .order('orden', { ascending: true });

  if (error) throw error;

  // Transformar opciones de array simple a array de objetos con letra y texto
  const preguntasTransformadas = (data || []).map(pregunta => ({
    ...pregunta,
    opciones: Array.isArray(pregunta.opciones)
      ? pregunta.opciones.map((texto: string, index: number) => ({
          letra: String.fromCharCode(65 + index), // A, B, C, D
          texto
        }))
      : pregunta.opciones
  }));

  return preguntasTransformadas;
}

export async function evaluarExamen(
  userId: string,
  examenId: string,
  respuestas: Record<string, string>,
  tiempoMinutos: number
): Promise<ResultadoEvaluacion> {
  const { data, error } = await supabase.rpc('fn_evaluar_examen', {
    p_user_id: userId,
    p_examen_id: examenId,
    p_respuestas: respuestas,
    p_tiempo_minutos: tiempoMinutos
  });

  if (error) throw error;
  return data as ResultadoEvaluacion;
}

export async function obtenerIntentosExamen(userId: string, examenId?: string): Promise<CedulaAIntentoExamen[]> {
  let query = supabase
    .from('cedula_a_intentos_examen')
    .select('*')
    .eq('user_id', userId)
    .order('fecha_intento', { ascending: false });

  if (examenId) {
    query = query.eq('examen_id', examenId);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

export async function obtenerCertificados(userId: string): Promise<CedulaACertificado[]> {
  const { data, error } = await supabase
    .from('cedula_a_certificados')
    .select('*')
    .eq('user_id', userId)
    .order('fecha_emision', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function obtenerCertificado(certificadoId: string): Promise<CedulaACertificado | null> {
  const { data, error } = await supabase
    .from('cedula_a_certificados')
    .select('*')
    .eq('id', certificadoId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function obtenerCertificadoPorCodigo(codigo: string): Promise<CedulaACertificado | null> {
  const { data, error } = await supabase
    .from('cedula_a_certificados')
    .select('*')
    .eq('codigo_verificacion', codigo)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function obtenerEstadisticasCurso(userId: string): Promise<EstadisticasCurso> {
  const { data, error } = await supabase.rpc('fn_obtener_estadisticas_curso', {
    p_user_id: userId
  });

  if (error) throw error;
  return data as EstadisticasCurso;
}

export async function obtenerGlosario(moduloId?: string): Promise<CedulaAGlosario[]> {
  let query = supabase
    .from('cedula_a_glosario')
    .select('*')
    .order('termino', { ascending: true });

  if (moduloId) {
    query = query.eq('modulo_id', moduloId);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

export async function buscarTerminoGlosario(termino: string): Promise<CedulaAGlosario[]> {
  const { data, error } = await supabase
    .from('cedula_a_glosario')
    .select('*')
    .ilike('termino', `%${termino}%`)
    .order('termino', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function obtenerMapasMentales(moduloId?: string): Promise<CedulaAMapaMental[]> {
  let query = supabase
    .from('cedula_a_mapas_mentales')
    .select('*')
    .order('orden', { ascending: true });

  if (moduloId) {
    query = query.eq('modulo_id', moduloId);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

export function formatearTiempoEstudio(segundos: number): string {
  const horas = Math.floor(segundos / 3600);
  const minutos = Math.floor((segundos % 3600) / 60);

  if (horas > 0) {
    return `${horas}h ${minutos}m`;
  }
  return `${minutos}m`;
}

export function calcularTiempoRestante(segundosTranscurridos: number, duracionEstimadaMinutos: number): string {
  const segundosEstimados = duracionEstimadaMinutos * 60;
  const segundosRestantes = Math.max(0, segundosEstimados - segundosTranscurridos);
  return formatearTiempoEstudio(segundosRestantes);
}

export function obtenerColorPuntaje(puntaje: number): string {
  if (puntaje >= 90) return 'text-emerald-600';
  if (puntaje >= 80) return 'text-green-600';
  if (puntaje >= 70) return 'text-yellow-600';
  return 'text-red-600';
}

export function obtenerColorProgreso(porcentaje: number): string {
  if (porcentaje === 100) return 'bg-emerald-500';
  if (porcentaje >= 50) return 'bg-primary-500';
  if (porcentaje > 0) return 'bg-yellow-500';
  return 'bg-neutral-300';
}
