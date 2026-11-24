/**
 * Utilidades para el Sistema de Gamificación
 */

import { supabase } from './supabase';
import type {
  AgentGamificationProfile,
  AgentGamificationEvent,
  AgentMission,
  RankingEntry,
  MisionAgente,
  EstadisticasGamificacion,
  PosicionAgente,
  ProgresoNivel,
  TipoEventoGamificacion,
  AgentLevel,
} from './gamificationTypes';

/**
 * Obtener perfil de gamificación del usuario
 */
export async function obtenerPerfilGamificacion(
  userId: string
): Promise<AgentGamificationProfile | null> {
  const { data, error } = await supabase
    .from('agent_gamification_profile')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error obteniendo perfil de gamificación:', error);
    return null;
  }

  return data;
}

/**
 * Registrar evento de gamificación
 */
export async function registrarEventoGamificacion(params: {
  userId: string;
  tipoEvento: TipoEventoGamificacion;
  xpDelta?: number;
  jcDelta?: number;
  referenciaTipo?: string;
  referenciaId?: string;
  reversible?: boolean;
  expiracionDias?: number;
  metadata?: Record<string, any>;
}): Promise<string | null> {
  const { data, error } = await supabase.rpc('fn_registrar_evento_gamificacion', {
    p_user_id: params.userId,
    p_tipo_evento: params.tipoEvento,
    p_xp_delta: params.xpDelta || 0,
    p_jc_delta: params.jcDelta || 0,
    p_referencia_tipo: params.referenciaTipo,
    p_referencia_id: params.referenciaId,
    p_reversible: params.reversible ?? true,
    p_expiracion_dias: params.expiracionDias ?? 180,
    p_metadata: params.metadata || {},
  });

  if (error) {
    console.error('Error registrando evento:', error);
    return null;
  }

  return data;
}

/**
 * Revertir evento (cancelación)
 */
export async function revertirEvento(
  eventId: string,
  motivo: string = 'Cancelación'
): Promise<boolean> {
  const { error } = await supabase.rpc('fn_revertir_evento_gamificacion', {
    p_event_id: eventId,
    p_motivo: motivo,
  });

  if (error) {
    console.error('Error revirtiendo evento:', error);
    return false;
  }

  return true;
}

/**
 * Obtener historial de eventos
 */
export async function obtenerHistorialEventos(
  userId: string,
  limit: number = 50,
  offset: number = 0
): Promise<AgentGamificationEvent[]> {
  const { data, error } = await supabase.rpc('fn_historial_eventos', {
    p_user_id: userId,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) {
    console.error('Error obteniendo historial:', error);
    return [];
  }

  return data || [];
}

/**
 * Obtener ranking global
 */
export async function obtenerRankingGlobal(
  limit: number = 50,
  offset: number = 0
): Promise<RankingEntry[]> {
  const { data, error } = await supabase.rpc('fn_ranking_global', {
    p_limit: limit,
    p_offset: offset,
  });

  if (error) {
    console.error('Error obteniendo ranking global:', error);
    return [];
  }

  return data || [];
}

/**
 * Obtener ranking por oficina
 */
export async function obtenerRankingOficina(
  oficinaId: string,
  limit: number = 20
): Promise<RankingEntry[]> {
  const { data, error } = await supabase.rpc('fn_ranking_oficina', {
    p_oficina_id: oficinaId,
    p_limit: limit,
  });

  if (error) {
    console.error('Error obteniendo ranking de oficina:', error);
    return [];
  }

  return data || [];
}

/**
 * Obtener ranking por Jiro Coins
 */
export async function obtenerRankingJiroCoins(
  limit: number = 50
): Promise<RankingEntry[]> {
  const { data, error } = await supabase.rpc('fn_ranking_jiro_coins', {
    p_limit: limit,
  });

  if (error) {
    console.error('Error obteniendo ranking de Jiro Coins:', error);
    return [];
  }

  return data || [];
}

/**
 * Obtener misiones del agente
 */
export async function obtenerMisionesAgente(
  userId: string
): Promise<MisionAgente[]> {
  const { data, error } = await supabase.rpc('fn_misiones_agente', {
    p_user_id: userId,
  });

  if (error) {
    console.error('Error obteniendo misiones:', error);
    return [];
  }

  return data || [];
}

/**
 * Obtener posición del agente en rankings
 */
export async function obtenerPosicionAgente(
  userId: string
): Promise<PosicionAgente | null> {
  const { data, error } = await supabase.rpc('fn_obtener_posicion_agente', {
    p_user_id: userId,
  });

  if (error) {
    console.error('Error obteniendo posición:', error);
    return null;
  }

  return data?.[0] || null;
}

/**
 * Obtener estadísticas globales
 */
export async function obtenerEstadisticasGamificacion(): Promise<EstadisticasGamificacion | null> {
  const { data, error } = await supabase.rpc('fn_estadisticas_gamificacion');

  if (error) {
    console.error('Error obteniendo estadísticas:', error);
    return null;
  }

  return data?.[0] || null;
}

/**
 * Obtener todos los niveles
 */
export async function obtenerNiveles(): Promise<AgentLevel[]> {
  const { data, error } = await supabase
    .from('agent_levels')
    .select('*')
    .order('nivel');

  if (error) {
    console.error('Error obteniendo niveles:', error);
    return [];
  }

  return data || [];
}

/**
 * Calcular progreso hacia el siguiente nivel
 */
export function calcularProgresoNivel(
  xpActual: number,
  nivelActual: number,
  niveles: AgentLevel[]
): ProgresoNivel {
  const nivelActualData = niveles.find((n) => n.nivel === nivelActual);
  const siguienteNivel = niveles.find((n) => n.nivel === nivelActual + 1);

  if (!nivelActualData || !siguienteNivel) {
    return {
      xp_actual: xpActual,
      xp_siguiente_nivel: 0,
      xp_necesario: 0,
      porcentaje: 100,
    };
  }

  const xpBase = nivelActualData.xp_min;
  const xpSiguiente = siguienteNivel.xp_min;
  const xpNecesario = xpSiguiente - xpActual;
  const porcentaje = Math.min(
    100,
    ((xpActual - xpBase) / (xpSiguiente - xpBase)) * 100
  );

  return {
    xp_actual: xpActual,
    xp_siguiente_nivel: xpSiguiente,
    xp_necesario: xpNecesario,
    porcentaje: Math.round(porcentaje * 10) / 10,
  };
}

/**
 * Formatear XP con separador de miles
 */
export function formatearXP(xp: number): string {
  return new Intl.NumberFormat('es-MX').format(xp);
}

/**
 * Formatear Jiro Coins
 */
export function formatearJiroCoins(jc: number): string {
  const prefix = jc >= 0 ? '' : '-';
  return `${prefix}${new Intl.NumberFormat('es-MX').format(Math.abs(jc))} JC`;
}

/**
 * Obtener color según delta
 */
export function obtenerColorDelta(delta: number): string {
  if (delta > 0) return 'text-green-600 dark:text-green-400';
  if (delta < 0) return 'text-red-600 dark:text-red-400';
  return 'text-gray-600 dark:text-gray-400';
}

/**
 * Formatear delta con signo
 */
export function formatearDelta(delta: number, tipo: 'xp' | 'jc'): string {
  const sign = delta > 0 ? '+' : '';
  const formatted = new Intl.NumberFormat('es-MX').format(delta);
  return tipo === 'jc' ? `${sign}${formatted} JC` : `${sign}${formatted} XP`;
}

/**
 * Obtener texto de periodo para misión
 */
export function obtenerTextoPeriodo(tipo: string): string {
  switch (tipo) {
    case 'semanal':
      return 'Esta semana';
    case 'mensual':
      return 'Este mes';
    case 'unica':
      return 'Una vez';
    case 'permanente':
      return 'Siempre activa';
    default:
      return tipo;
  }
}

/**
 * Verificar si una misión está cerca de completarse
 */
export function misionCercaDeCompletar(
  progresoActual: number,
  metaRequerida: number
): boolean {
  const porcentaje = (progresoActual / metaRequerida) * 100;
  return porcentaje >= 80 && porcentaje < 100;
}
