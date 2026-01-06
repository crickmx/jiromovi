export interface CedulaAModulo {
  id: string;
  titulo: string;
  descripcion: string;
  orden: number;
  icono: string;
  contenido_intro: string | null;
  duracion_estimada_minutos: number;
  created_at: string;
  updated_at: string;
}

export interface CedulaALeccion {
  id: string;
  modulo_id: string;
  titulo: string;
  contenido: LeccionContenido;
  orden: number;
  duracion_estimada_minutos: number;
  created_at: string;
  updated_at: string;
}

export interface LeccionContenido {
  sections: LeccionSeccion[];
}

export interface LeccionSeccion {
  type: 'titulo' | 'parrafo' | 'definicion' | 'ejemplo' | 'alerta' | 'lista' | 'caso_practico';
  content: string;
  items?: string[];
  style?: string;
}

export interface CedulaAExamen {
  id: string;
  titulo: string;
  descripcion: string;
  tipo: 'practica' | 'modulo' | 'final';
  modulo_id: string | null;
  duracion_referencia_minutos: number;
  puntaje_minimo_aprobacion: number;
  orden: number;
  instrucciones: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface CedulaAPregunta {
  id: string;
  examen_id: string;
  pregunta: string;
  opciones: OpcionRespuesta[];
  respuesta_correcta: string;
  explicacion: string;
  modulo_referencia_id: string | null;
  dificultad: 'basica' | 'intermedia' | 'avanzada' | 'trampa';
  orden: number;
  created_at: string;
  updated_at: string;
}

export interface OpcionRespuesta {
  letra: string;
  texto: string;
}

export interface CedulaAMapaMental {
  id: string;
  titulo: string;
  modulo_id: string | null;
  contenido_estructura: MapaMentalNodo;
  imagen_url: string | null;
  orden: number;
  descripcion: string | null;
  created_at: string;
  updated_at: string;
}

export interface MapaMentalNodo {
  id: string;
  texto: string;
  nivel: number;
  hijos?: MapaMentalNodo[];
  color?: string;
}

export interface CedulaAGlosario {
  id: string;
  termino: string;
  definicion: string;
  ejemplo: string | null;
  modulo_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CedulaAProgresoModulo {
  id: string;
  user_id: string;
  modulo_id: string;
  lecciones_completadas: number;
  porcentaje_completado: number;
  fecha_inicio: string;
  fecha_completado: string | null;
  created_at: string;
  updated_at: string;
}

export interface CedulaAProgresoLeccion {
  id: string;
  user_id: string;
  leccion_id: string;
  completado: boolean;
  tiempo_estudio_segundos: number;
  ultima_visita: string;
  notas_usuario: string | null;
  marcadores: string[];
  created_at: string;
  updated_at: string;
}

export interface CedulaAIntentoExamen {
  id: string;
  user_id: string;
  examen_id: string;
  respuestas: Record<string, string>;
  puntaje: number;
  total_preguntas: number;
  aprobado: boolean;
  tiempo_empleado_minutos: number;
  fecha_intento: string;
  created_at: string;
}

export interface CedulaACertificado {
  id: string;
  user_id: string;
  examen_final_id: string;
  intento_id: string;
  puntaje_final: number;
  fecha_emision: string;
  codigo_verificacion: string;
  pdf_url: string | null;
  created_at: string;
}

export interface ResultadoEvaluacion {
  intento_id: string;
  puntaje: number;
  total_preguntas: number;
  respuestas_correctas: number;
  aprobado: boolean;
  puntaje_minimo: number;
  retroalimentacion: RetroalimentacionPregunta[];
}

export interface RetroalimentacionPregunta {
  pregunta_id: string;
  pregunta: string;
  opciones: OpcionRespuesta[];
  respuesta_usuario: string;
  respuesta_correcta: string;
  es_correcta: boolean;
  explicacion: string;
}

export interface EstadisticasCurso {
  total_lecciones: number;
  lecciones_completadas: number;
  total_modulos: number;
  modulos_completados: number;
  tiempo_total_segundos: number;
  intentos_examenes: number;
  mejor_puntaje: number;
  certificados: number;
  porcentaje_global: number;
}

export interface ModuloConProgreso extends CedulaAModulo {
  progreso?: CedulaAProgresoModulo;
  total_lecciones?: number;
  estado: 'disponible' | 'en_progreso' | 'completado';
}
