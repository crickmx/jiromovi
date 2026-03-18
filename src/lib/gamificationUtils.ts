import { supabase } from './supabase';
import type {
  AgentGamificationProfile,
  AgentLevel,
  AgentMissionProgress,
  AgentGamificationEvent,
  LevelProgress,
  DashboardStats,
  GamificationEventType,
} from './gamificationTypes';

export async function getAgentProfile(userId: string): Promise<AgentGamificationProfile | null> {
  const { data, error } = await supabase
    .from('agent_gamification_profile')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching gamification profile:', error);
    return null;
  }

  return data;
}

export async function getAllLevels(): Promise<AgentLevel[]> {
  const { data, error } = await supabase
    .from('agent_levels')
    .select('*')
    .order('nivel');

  if (error) {
    console.error('Error fetching levels:', error);
    return [];
  }

  return data || [];
}

export async function getLevelProgress(
  profile: AgentGamificationProfile,
  levels: AgentLevel[]
): Promise<LevelProgress> {
  const currentLevel = levels.find((l) => l.nivel === profile.nivel_actual);
  const nextLevel = levels.find((l) => l.nivel === profile.nivel_actual + 1);

  if (!currentLevel) {
    return {
      currentLevel: levels[0],
      nextLevel: levels[1] || null,
      progressPercentage: 0,
      xpToNextLevel: 0,
    };
  }

  let progressPercentage = 0;
  let xpToNextLevel = 0;

  if (nextLevel) {
    const xpInCurrentLevel = profile.xp_total - currentLevel.xp_min;
    const xpNeededForNextLevel = nextLevel.xp_min - currentLevel.xp_min;
    progressPercentage = Math.min(100, (xpInCurrentLevel / xpNeededForNextLevel) * 100);
    xpToNextLevel = nextLevel.xp_min - profile.xp_total;
  } else {
    progressPercentage = 100;
    xpToNextLevel = 0;
  }

  return {
    currentLevel,
    nextLevel,
    progressPercentage,
    xpToNextLevel: Math.max(0, xpToNextLevel),
  };
}

export async function getActiveMissions(userId: string): Promise<AgentMissionProgress[]> {
  const { data, error } = await supabase
    .from('agent_mission_progress')
    .select(`
      *,
      mission:mission_id(*)
    `)
    .eq('user_id', userId)
    .eq('completada', false)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching active missions:', error);
    return [];
  }

  return data || [];
}

export async function getRecentEvents(
  userId: string,
  limit: number = 10
): Promise<AgentGamificationEvent[]> {
  const { data, error } = await supabase
    .from('agent_gamification_events')
    .select('*')
    .eq('user_id', userId)
    .order('fecha_evento', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching recent events:', error);
    return [];
  }

  return data || [];
}

export async function getDashboardStats(userId: string): Promise<DashboardStats | null> {
  const profile = await getAgentProfile(userId);
  if (!profile) return null;

  const levels = await getAllLevels();
  const levelProgress = await getLevelProgress(profile, levels);
  const activeMissions = await getActiveMissions(userId);
  const recentEvents = await getRecentEvents(userId, 10);

  const { data: xpRankData } = await supabase.rpc('get_agent_xp_rank', {
    p_user_id: userId,
  });

  const { data: jcRankData } = await supabase.rpc('get_agent_jc_rank', {
    p_user_id: userId,
  });

  const { data: polizasRankData } = await supabase.rpc('get_agent_polizas_rank', {
    p_user_id: userId,
  });

  const rankings = {
    xp_rank: xpRankData?.rank || 0,
    xp_total_agents: xpRankData?.total || 0,
    jc_rank: jcRankData?.rank || 0,
    polizas_rank: polizasRankData?.rank || 0,
  };

  return {
    profile,
    levelProgress,
    activeMissions,
    recentEvents,
    rankings,
  };
}

export async function addGamificationEvent(params: {
  userId: string;
  tipoEvento: GamificationEventType;
  referenciaId?: string;
  referenciaTipo?: string;
  xpDelta?: number;
  jcDelta?: number;
  reversible?: boolean;
  metadata?: Record<string, any>;
}): Promise<string | null> {
  const { data, error } = await supabase.rpc('add_gamification_event', {
    p_user_id: params.userId,
    p_tipo_evento: params.tipoEvento,
    p_referencia_tipo: params.referenciaTipo || null,
    p_referencia_id: params.referenciaId || null,
    p_xp_delta: params.xpDelta || 0,
    p_jc_delta: params.jcDelta || 0,
    p_reversible: params.reversible !== false,
    p_metadata: params.metadata || {},
  });

  if (error) {
    console.error('Error adding gamification event:', error);
    return null;
  }

  return data;
}

export async function reverseGamificationEvent(eventId: string): Promise<boolean> {
  const { error } = await supabase.rpc('reverse_gamification_event', {
    p_event_id: eventId,
  });

  if (error) {
    console.error('Error reversing gamification event:', error);
    return false;
  }

  return true;
}

export async function checkMissionProgress(
  userId: string,
  missionId: string,
  incremento: number = 1
): Promise<boolean> {
  const { data, error } = await supabase.rpc('check_mission_progress', {
    p_user_id: userId,
    p_mission_id: missionId,
    p_incremento: incremento,
  });

  if (error) {
    console.error('Error checking mission progress:', error);
    return false;
  }

  return data || false;
}

export async function updateAgentSeniority(): Promise<void> {
  await supabase.rpc('update_agent_seniority');
}

export async function expireJiroCoins(): Promise<number> {
  const { data, error } = await supabase.rpc('expire_jiro_coins');

  if (error) {
    console.error('Error expiring Jiro Coins:', error);
    return 0;
  }

  return data || 0;
}

export function formatXP(xp: number): string {
  if (xp >= 1000000) {
    return `${(xp / 1000000).toFixed(1)}M`;
  }
  if (xp >= 1000) {
    return `${(xp / 1000).toFixed(1)}K`;
  }
  return xp.toLocaleString();
}

export function formatJC(jc: number): string {
  return jc.toLocaleString();
}

export function getRankColor(rango: string): string {
  if (rango.includes('Leyenda')) return '#eab308';
  if (rango.includes('Maestro')) return '#8b5cf6';
  if (rango.includes('Élite')) return '#3b82f6';
  return '#94a3b8';
}

export function getRankIcon(rango: string): string {
  if (rango.includes('Leyenda')) return 'Trophy';
  if (rango.includes('Maestro')) return 'Crown';
  if (rango.includes('Élite')) return 'Award';
  return 'Shield';
}

export function getMissionPeriodLabel(periodo: string): string {
  if (periodo.match(/^\d{4}-\d{2}$/)) {
    return `Mes ${periodo}`;
  }
  if (periodo.match(/^\d{4}-W\d{2}$/)) {
    return `Semana ${periodo.split('-W')[1]}`;
  }
  if (periodo === 'unica') {
    return 'Única';
  }
  return 'Permanente';
}

export function calculatePrimaNeta(primaNeta: number): number {
  return Math.floor(primaNeta / 1000);
}

export async function getLeaderboard(
  orderBy: 'xp_total' | 'jiro_coins_balance' | 'total_polizas_emitidas' = 'xp_total',
  limit: number = 10
): Promise<AgentGamificationProfile[]> {
  const { data, error } = await supabase
    .from('agent_gamification_profile')
    .select(`
      *,
      usuario:user_id(nombre, apellidos, email_laboral, oficina:oficina_id(nombre))
    `)
    .order(orderBy, { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching leaderboard:', error);
    return [];
  }

  return data || [];
}
