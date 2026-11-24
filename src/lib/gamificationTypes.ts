/**
 * Tipos para el Sistema de Gamificación de Agentes
 */

export type TipoEventoGamificacion =
  | 'poliza_emitida'
  | 'prospecto'
  | 'curso_completado'
  | 'certificacion'
  | 'resena'
  | 'renovacion'
  | 'bono_antiguedad'
  | 'mision_completada'
  | 'ajuste_manual'
  | 'cancelacion'
  | 'compra_tienda'
  | 'expiracion_jc';

export type TipoPeriodoMision = 'semanal' | 'mensual' | 'unica' | 'permanente';

export interface AgentLevel {
  nivel: number;
  xp_min: number;
  xp_max: number | null;
  rango: string;
  descripcion?: string;
  icono?: string;
  color?: string;
}

export interface AgentGamificationProfile {
  user_id: string;
  xp_total: number;
  jiro_coins_balance: number;
  nivel_actual: number;
  rango_actual: string;
  anios_antiguedad: number;
  multiplicador_veterano: number;
  fecha_ingreso_empresa: string;
  ultima_actualizacion_antiguedad?: string;
  total_polizas_emitidas: number;
  total_prospectos: number;
  total_cursos_completados: number;
  total_certificaciones: number;
  total_renovaciones: number;
  created_at: string;
  updated_at: string;
}

export interface AgentGamificationEvent {
  id: string;
  user_id: string;
  tipo_evento: TipoEventoGamificacion;
  referencia_tipo?: string;
  referencia_id?: string;
  xp_delta: number;
  jc_delta: number;
  xp_antes: number;
  xp_despues: number;
  jc_antes: number;
  jc_despues: number;
  fecha_evento: string;
  fecha_expiracion_jc?: string;
  reversible: boolean;
  reversed_by_event_id?: string;
  is_reversal: boolean;
  metadata?: Record<string, any>;
  created_by?: string;
  created_at: string;
}

export interface AgentMission {
  id: string;
  nombre: string;
  descripcion?: string;
  tipo_periodo: TipoPeriodoMision;
  regla_json: {
    tipo: string;
    cantidad?: number;
    minimo?: number;
    periodo_dias?: number;
  };
  xp_reward: number;
  jc_reward: number;
  icono?: string;
  color?: string;
  orden: number;
  activa: boolean;
  fecha_inicio?: string;
  fecha_fin?: string;
  created_at: string;
  updated_at: string;
}

export interface AgentMissionProgress {
  id: string;
  user_id: string;
  mission_id: string;
  periodo: string;
  progreso_actual: number;
  meta_requerida: number;
  completada: boolean;
  fecha_completada?: string;
  recompensa_reclamada: boolean;
  created_at: string;
  updated_at: string;
}

export interface AgentXPMultiplier {
  id: string;
  tipo: 'ramo' | 'evento' | 'aseguradora' | 'global';
  referencia?: string;
  factor: number;
  descripcion?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface RankingEntry {
  posicion: number;
  user_id: string;
  nombre_completo: string;
  avatar_url?: string;
  oficina_nombre?: string;
  xp_total: number;
  nivel_actual: number;
  rango_actual: string;
  jiro_coins_balance: number;
  total_polizas_emitidas: number;
  anios_antiguedad?: number;
}

export interface MisionAgente extends AgentMission {
  progreso_actual: number;
  meta_requerida: number;
  completada: boolean;
  porcentaje_completado: number;
}

export interface EstadisticasGamificacion {
  total_agentes: number;
  total_xp_otorgado: number;
  total_jc_circulacion: number;
  promedio_xp_agente: number;
  promedio_jc_agente: number;
  agentes_por_rango: Record<string, number>;
  eventos_ultimos_30_dias: number;
  misiones_completadas_mes: number;
}

export interface PosicionAgente {
  posicion_global: number;
  posicion_oficina: number;
  total_agentes: number;
  total_agentes_oficina: number;
}

export interface ProgresoNivel {
  xp_actual: number;
  xp_siguiente_nivel: number;
  xp_necesario: number;
  porcentaje: number;
}

export const EVENTOS_CONFIG: Record<TipoEventoGamificacion, {
  label: string;
  icon: string;
  color: string;
  descripcion: string;
}> = {
  poliza_emitida: {
    label: 'Póliza Emitida',
    icon: 'FileText',
    color: '#10b981',
    descripcion: 'Emisión de póliza',
  },
  prospecto: {
    label: 'Prospecto Registrado',
    icon: 'UserPlus',
    color: '#3b82f6',
    descripcion: 'Nuevo prospecto',
  },
  curso_completado: {
    label: 'Curso Completado',
    icon: 'GraduationCap',
    color: '#8b5cf6',
    descripcion: 'Curso finalizado',
  },
  certificacion: {
    label: 'Certificación',
    icon: 'Award',
    color: '#f59e0b',
    descripcion: 'Certificación obtenida',
  },
  resena: {
    label: 'Reseña 5 Estrellas',
    icon: 'Star',
    color: '#eab308',
    descripcion: 'Reseña positiva',
  },
  renovacion: {
    label: 'Renovación',
    icon: 'RefreshCw',
    color: '#06b6d4',
    descripcion: 'Póliza renovada',
  },
  bono_antiguedad: {
    label: 'Bono Antigüedad',
    icon: 'Calendar',
    color: '#6366f1',
    descripcion: 'Bono por años de servicio',
  },
  mision_completada: {
    label: 'Misión Completada',
    icon: 'Target',
    color: '#ec4899',
    descripcion: 'Misión cumplida',
  },
  ajuste_manual: {
    label: 'Ajuste Manual',
    icon: 'Settings',
    color: '#64748b',
    descripcion: 'Ajuste administrativo',
  },
  cancelacion: {
    label: 'Cancelación',
    icon: 'XCircle',
    color: '#ef4444',
    descripcion: 'Evento revertido',
  },
  compra_tienda: {
    label: 'Compra en Tienda',
    icon: 'ShoppingCart',
    color: '#f97316',
    descripcion: 'Compra realizada',
  },
  expiracion_jc: {
    label: 'Expiración JC',
    icon: 'Clock',
    color: '#94a3b8',
    descripcion: 'Jiro Coins expirados',
  },
};

export const RANGOS_CONFIG: Record<string, {
  color: string;
  gradiente: string;
  descripcion: string;
}> = {
  'Agente Base': {
    color: '#94a3b8',
    gradiente: 'from-slate-400 to-slate-500',
    descripcion: 'Iniciando tu camino',
  },
  'Agente Élite': {
    color: '#3b82f6',
    gradiente: 'from-blue-400 to-blue-600',
    descripcion: 'Destacando en el equipo',
  },
  'Maestro Élite': {
    color: '#8b5cf6',
    gradiente: 'from-purple-400 to-purple-600',
    descripcion: 'Líder en excelencia',
  },
  'Leyenda Jiro': {
    color: '#eab308',
    gradiente: 'from-yellow-400 to-yellow-600',
    descripcion: 'Leyenda del negocio',
  },
};
