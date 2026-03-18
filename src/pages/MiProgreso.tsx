import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  Trophy, Award, Shield, Crown, TrendingUp, Coins,
  Target, Clock, Calendar, Zap, Star, ChevronRight,
  Loader2, Gift
} from 'lucide-react';
import { getDashboardStats, formatXP, formatJC, getMissionPeriodLabel } from '../lib/gamificationUtils';
import { EVENT_TYPE_CONFIGS } from '../lib/gamificationTypes';
import type { DashboardStats } from '../lib/gamificationTypes';

export default function MiProgreso() {
  const { usuario } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (usuario?.id) {
      loadStats();
    }
  }, [usuario]);

  const loadStats = async () => {
    if (!usuario?.id) return;

    setLoading(true);
    const data = await getDashboardStats(usuario.id);
    setStats(data);
    setLoading(false);
  };

  const getRankIcon = (rango: string) => {
    if (rango.includes('Leyenda')) return Trophy;
    if (rango.includes('Maestro')) return Crown;
    if (rango.includes('Élite')) return Award;
    return Shield;
  };

  const getRankColor = (rango: string) => {
    if (rango.includes('Leyenda')) return 'from-yellow-400 to-yellow-600';
    if (rango.includes('Maestro')) return 'from-purple-400 to-purple-600';
    if (rango.includes('Élite')) return 'from-blue-400 to-blue-600';
    return 'from-gray-400 to-gray-600';
  };

  const getEventIcon = (tipoEvento: string) => {
    const config = EVENT_TYPE_CONFIGS[tipoEvento as keyof typeof EVENT_TYPE_CONFIGS];
    if (!config) return Star;

    const iconMap: Record<string, any> = {
      FileText: Star,
      UserPlus: Star,
      GraduationCap: Award,
      Award: Award,
      Star: Star,
      RefreshCw: Star,
      Clock: Clock,
      Target: Target,
      Edit: Star,
      XCircle: Star,
      ShoppingCart: Star,
      AlertTriangle: Star,
    };

    return iconMap[config.icon] || Star;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12">
        <Shield className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-neutral-700 mb-2">
          Perfil de gamificación no disponible
        </h3>
        <p className="text-neutral-500">
          Contacta al administrador para activar tu perfil
        </p>
      </div>
    );
  }

  const { profile, levelProgress, activeMissions, recentEvents, rankings } = stats;
  const RankIcon = getRankIcon(profile.rango_actual);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl shadow-soft border border-neutral-200 p-6">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex-1">
            <h1 className="text-3xl font-display font-bold text-accent mb-2">
              Mi Progreso
            </h1>
            <p className="text-neutral-600">
              Sigue tu evolución como agente MOVI
            </p>
          </div>
          <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${getRankColor(profile.rango_actual)} flex items-center justify-center shadow-lg`}>
            <RankIcon className="w-10 h-10 text-white" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <TrendingUp className="w-8 h-8 opacity-80" />
            <span className="text-2xl font-bold">{formatXP(profile.xp_total)}</span>
          </div>
          <h3 className="text-lg font-semibold mb-1">Experiencia Total</h3>
          <p className="text-blue-100 text-sm">
            Ranking #{rankings.xp_rank} de {rankings.xp_total_agents}
          </p>
        </div>

        <div className="bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <Coins className="w-8 h-8 opacity-80" />
            <span className="text-2xl font-bold">{formatJC(profile.jiro_coins_balance)}</span>
          </div>
          <h3 className="text-lg font-semibold mb-1">Jiro Coins</h3>
          <p className="text-yellow-100 text-sm">
            Ranking #{rankings.jc_rank}
          </p>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <Star className="w-8 h-8 opacity-80" />
            <span className="text-2xl font-bold">Nivel {profile.nivel_actual}</span>
          </div>
          <h3 className="text-lg font-semibold mb-1">{profile.rango_actual}</h3>
          <p className="text-green-100 text-sm">
            {profile.anios_antiguedad.toFixed(1)} años de antigüedad
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-soft border border-neutral-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-neutral-900">Progreso al Siguiente Nivel</h2>
          {levelProgress.nextLevel && (
            <span className="text-sm text-neutral-600">
              {formatXP(levelProgress.xpToNextLevel)} XP restantes
            </span>
          )}
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="font-semibold text-neutral-700">
              Nivel {profile.nivel_actual}
            </span>
            {levelProgress.nextLevel ? (
              <span className="font-semibold text-neutral-700">
                Nivel {levelProgress.nextLevel.nivel}
              </span>
            ) : (
              <span className="font-semibold text-yellow-600">¡Máximo Nivel!</span>
            )}
          </div>
          <div className="relative w-full h-8 bg-neutral-100 rounded-full overflow-hidden">
            <div
              className={`absolute inset-y-0 left-0 bg-gradient-to-r ${getRankColor(profile.rango_actual)} transition-all duration-500 flex items-center justify-end pr-3`}
              style={{ width: `${levelProgress.progressPercentage}%` }}
            >
              {levelProgress.progressPercentage > 15 && (
                <span className="text-xs font-bold text-white">
                  {levelProgress.progressPercentage.toFixed(0)}%
                </span>
              )}
            </div>
          </div>
        </div>

        {levelProgress.nextLevel && (
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4 border border-blue-200">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${getRankColor(levelProgress.nextLevel.rango)} flex items-center justify-center`}>
                {levelProgress.nextLevel.rango.includes('Leyenda') ? (
                  <Trophy className="w-6 h-6 text-white" />
                ) : levelProgress.nextLevel.rango.includes('Maestro') ? (
                  <Crown className="w-6 h-6 text-white" />
                ) : levelProgress.nextLevel.rango.includes('Élite') ? (
                  <Award className="w-6 h-6 text-white" />
                ) : (
                  <Shield className="w-6 h-6 text-white" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-neutral-900">Próximo: {levelProgress.nextLevel.rango}</h3>
                <p className="text-sm text-neutral-600">{levelProgress.nextLevel.descripcion}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-soft border border-neutral-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-6 h-6 text-accent" />
            <h2 className="text-xl font-bold text-neutral-900">Misiones Activas</h2>
          </div>

          {activeMissions.length === 0 ? (
            <div className="text-center py-8">
              <Target className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
              <p className="text-neutral-500">No hay misiones activas</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeMissions.map((mission) => {
                const progress = Math.min(100, (mission.progreso_actual / mission.meta_requerida) * 100);

                return (
                  <div key={mission.id} className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="font-bold text-neutral-900 mb-1">
                          {mission.mission?.nombre || 'Misión'}
                        </h3>
                        <p className="text-xs text-neutral-600 mb-2">
                          {mission.mission?.descripcion}
                        </p>
                      </div>
                      {mission.mission?.icono && (
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-accent to-primary-600 flex items-center justify-center flex-shrink-0 ml-2">
                          <Zap className="w-5 h-5 text-white" />
                        </div>
                      )}
                    </div>

                    <div className="mb-3">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-neutral-600">
                          {mission.progreso_actual} / {mission.meta_requerida}
                        </span>
                        <span className="font-semibold text-neutral-700">
                          {progress.toFixed(0)}%
                        </span>
                      </div>
                      <div className="w-full h-2 bg-neutral-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-accent to-primary-600 transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-neutral-500">
                        {getMissionPeriodLabel(mission.periodo)}
                      </span>
                      <div className="flex items-center gap-3">
                        {mission.mission && mission.mission.xp_reward > 0 && (
                          <span className="text-blue-600 font-semibold">
                            +{mission.mission.xp_reward} XP
                          </span>
                        )}
                        {mission.mission && mission.mission.jc_reward > 0 && (
                          <span className="text-yellow-600 font-semibold">
                            +{mission.mission.jc_reward} JC
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-soft border border-neutral-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-6 h-6 text-accent" />
            <h2 className="text-xl font-bold text-neutral-900">Actividad Reciente</h2>
          </div>

          {recentEvents.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
              <p className="text-neutral-500">No hay actividad reciente</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {recentEvents.map((event) => {
                const config = EVENT_TYPE_CONFIGS[event.tipo_evento];
                const EventIcon = getEventIcon(event.tipo_evento);
                const isPositive = event.xp_delta > 0 || event.jc_delta > 0;

                return (
                  <div
                    key={event.id}
                    className="flex items-start gap-3 p-3 bg-neutral-50 rounded-lg hover:bg-neutral-100 transition-colors"
                  >
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: config?.color + '20' }}
                    >
                      <EventIcon
                        className="w-5 h-5"
                        style={{ color: config?.color || '#64748b' }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-neutral-900">
                        {config?.label || event.tipo_evento}
                      </h4>
                      <p className="text-xs text-neutral-600 mb-1">
                        {config?.description || ''}
                      </p>
                      <div className="flex items-center gap-3 text-xs">
                        {event.xp_delta !== 0 && (
                          <span className={event.xp_delta > 0 ? 'text-blue-600 font-semibold' : 'text-red-600 font-semibold'}>
                            {event.xp_delta > 0 ? '+' : ''}{event.xp_delta} XP
                          </span>
                        )}
                        {event.jc_delta !== 0 && (
                          <span className={event.jc_delta > 0 ? 'text-yellow-600 font-semibold' : 'text-red-600 font-semibold'}>
                            {event.jc_delta > 0 ? '+' : ''}{event.jc_delta} JC
                          </span>
                        )}
                        <span className="text-neutral-400">
                          {new Date(event.fecha_evento).toLocaleDateString('es-MX', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>
                    {isPositive && (
                      <ChevronRight className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-soft border border-neutral-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Gift className="w-6 h-6 text-accent" />
          <h2 className="text-xl font-bold text-neutral-900">Estadísticas</h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center p-4 bg-neutral-50 rounded-xl">
            <div className="text-2xl font-bold text-blue-600 mb-1">
              {profile.total_polizas_emitidas}
            </div>
            <div className="text-xs text-neutral-600">Pólizas Emitidas</div>
          </div>
          <div className="text-center p-4 bg-neutral-50 rounded-xl">
            <div className="text-2xl font-bold text-green-600 mb-1">
              {profile.total_prospectos}
            </div>
            <div className="text-xs text-neutral-600">Prospectos</div>
          </div>
          <div className="text-center p-4 bg-neutral-50 rounded-xl">
            <div className="text-2xl font-bold text-purple-600 mb-1">
              {profile.total_cursos_completados}
            </div>
            <div className="text-xs text-neutral-600">Cursos</div>
          </div>
          <div className="text-center p-4 bg-neutral-50 rounded-xl">
            <div className="text-2xl font-bold text-yellow-600 mb-1">
              {profile.total_certificaciones}
            </div>
            <div className="text-xs text-neutral-600">Certificaciones</div>
          </div>
          <div className="text-center p-4 bg-neutral-50 rounded-xl">
            <div className="text-2xl font-bold text-cyan-600 mb-1">
              {profile.total_renovaciones}
            </div>
            <div className="text-xs text-neutral-600">Renovaciones</div>
          </div>
        </div>

        <div className="mt-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-200">
          <div className="flex items-center gap-3">
            <Clock className="w-10 h-10 text-purple-600" />
            <div className="flex-1">
              <h3 className="font-bold text-neutral-900 mb-1">Multiplicador Veterano</h3>
              <p className="text-sm text-neutral-600">
                Obtienes <span className="font-bold text-purple-600">{((profile.multiplicador_veterano - 1) * 100).toFixed(0)}% más XP</span> por tu antigüedad
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
