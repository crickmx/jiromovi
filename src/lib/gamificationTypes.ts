export type GamificationEventType =
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

export type MissionPeriodType = 'semanal' | 'mensual' | 'unica' | 'permanente';

export interface AgentLevel {
  nivel: number;
  xp_min: number;
  xp_max: number | null;
  rango: string;
  descripcion: string | null;
  icono: string | null;
  color: string | null;
  created_at: string;
}

export interface AgentGamificationProfile {
  user_id: string;
  xp_total: number;
  jiro_coins_balance: number;
  nivel_actual: number;
  rango_actual: string;
  anios_antiguedad: number;
  multiplicador_veterano: number;
  fecha_ingreso_empresa: string | null;
  ultima_actualizacion_antiguedad: string | null;
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
  tipo_evento: GamificationEventType;
  referencia_tipo: string | null;
  referencia_id: string | null;
  xp_delta: number;
  jc_delta: number;
  xp_antes: number;
  xp_despues: number;
  jc_antes: number;
  jc_despues: number;
  fecha_evento: string;
  fecha_expiracion_jc: string | null;
  reversible: boolean;
  reversed_by_event_id: string | null;
  is_reversal: boolean;
  metadata: Record<string, any>;
  created_by: string | null;
  created_at: string;
}

export interface AgentXPMultiplier {
  id: string;
  tipo: 'ramo' | 'evento' | 'aseguradora' | 'global';
  referencia: string | null;
  factor: number;
  descripcion: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface AgentMission {
  id: string;
  nombre: string;
  descripcion: string | null;
  tipo_periodo: MissionPeriodType;
  regla_json: MissionRule;
  xp_reward: number;
  jc_reward: number;
  icono: string | null;
  color: string | null;
  orden: number;
  activa: boolean;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  created_at: string;
  updated_at: string;
}

export interface MissionRule {
  tipo: string;
  cantidad?: number;
  minimo?: number;
  periodo_dias?: number;
}

export interface AgentMissionProgress {
  id: string;
  user_id: string;
  mission_id: string;
  periodo: string;
  progreso_actual: number;
  meta_requerida: number;
  completada: boolean;
  fecha_completada: string | null;
  recompensa_reclamada: boolean;
  created_at: string;
  updated_at: string;
  mission?: AgentMission;
}

export interface LevelProgress {
  currentLevel: AgentLevel;
  nextLevel: AgentLevel | null;
  progressPercentage: number;
  xpToNextLevel: number;
}

export interface DashboardStats {
  profile: AgentGamificationProfile;
  levelProgress: LevelProgress;
  activeMissions: AgentMissionProgress[];
  recentEvents: AgentGamificationEvent[];
  rankings: {
    xp_rank: number;
    xp_total_agents: number;
    jc_rank: number;
    polizas_rank: number;
  };
}

export interface EventTypeConfig {
  label: string;
  icon: string;
  color: string;
  description: string;
}

export const EVENT_TYPE_CONFIGS: Record<GamificationEventType, EventTypeConfig> = {
  poliza_emitida: {
    label: 'Póliza Emitida',
    icon: 'FileText',
    color: '#10b981',
    description: 'Has emitido una nueva póliza',
  },
  prospecto: {
    label: 'Prospecto Registrado',
    icon: 'UserPlus',
    color: '#3b82f6',
    description: 'Has registrado un nuevo prospecto',
  },
  curso_completado: {
    label: 'Curso Completado',
    icon: 'GraduationCap',
    color: '#8b5cf6',
    description: 'Has completado un curso',
  },
  certificacion: {
    label: 'Certificación Aprobada',
    icon: 'Award',
    color: '#f59e0b',
    description: 'Has obtenido una certificación',
  },
  resena: {
    label: 'Reseña Positiva',
    icon: 'Star',
    color: '#eab308',
    description: 'Has recibido una reseña positiva',
  },
  renovacion: {
    label: 'Renovación',
    icon: 'RefreshCw',
    color: '#06b6d4',
    description: 'Has renovado una póliza',
  },
  bono_antiguedad: {
    label: 'Bono de Antigüedad',
    icon: 'Clock',
    color: '#6366f1',
    description: 'Bono por años de servicio',
  },
  mision_completada: {
    label: 'Misión Completada',
    icon: 'Target',
    color: '#ef4444',
    description: 'Has completado una misión',
  },
  ajuste_manual: {
    label: 'Ajuste Manual',
    icon: 'Edit',
    color: '#64748b',
    description: 'Ajuste realizado por administrador',
  },
  cancelacion: {
    label: 'Cancelación',
    icon: 'XCircle',
    color: '#dc2626',
    description: 'Reversa por cancelación',
  },
  compra_tienda: {
    label: 'Compra en Tienda',
    icon: 'ShoppingCart',
    color: '#ec4899',
    description: 'Has realizado una compra',
  },
  expiracion_jc: {
    label: 'Expiración JC',
    icon: 'AlertTriangle',
    color: '#f97316',
    description: 'Jiro Coins han expirado',
  },
};
