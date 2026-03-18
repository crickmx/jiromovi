import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Trophy, Users, TrendingUp, Target, Plus, CreditCard as Edit2, Trash2, Loader2, Award, Crown, Shield, Star, Save, X } from 'lucide-react';
import { getLeaderboard, formatXP, formatJC } from '../lib/gamificationUtils';
import type { AgentGamificationProfile, AgentMission, AgentXPMultiplier } from '../lib/gamificationTypes';

export default function GamificacionAdmin() {
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'missions' | 'multipliers'>('leaderboard');
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [missions, setMissions] = useState<AgentMission[]>([]);
  const [multipliers, setMultipliers] = useState<AgentXPMultiplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMissionModal, setShowMissionModal] = useState(false);
  const [showMultiplierModal, setShowMultiplierModal] = useState(false);
  const [editingMission, setEditingMission] = useState<AgentMission | null>(null);
  const [editingMultiplier, setEditingMultiplier] = useState<AgentXPMultiplier | null>(null);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);

    if (activeTab === 'leaderboard') {
      const data = await getLeaderboard('xp_total', 50);
      setLeaderboard(data);
    } else if (activeTab === 'missions') {
      const { data } = await supabase
        .from('agent_missions')
        .select('*')
        .order('orden');
      setMissions(data || []);
    } else if (activeTab === 'multipliers') {
      const { data } = await supabase
        .from('agent_xp_multipliers')
        .select('*')
        .order('created_at', { ascending: false });
      setMultipliers(data || []);
    }

    setLoading(false);
  };

  const handleDeleteMission = async (id: string) => {
    if (!confirm('¿Eliminar esta misión?')) return;

    const { error } = await supabase
      .from('agent_missions')
      .delete()
      .eq('id', id);

    if (!error) {
      loadData();
    }
  };

  const handleDeleteMultiplier = async (id: string) => {
    if (!confirm('¿Eliminar este multiplicador?')) return;

    const { error } = await supabase
      .from('agent_xp_multipliers')
      .delete()
      .eq('id', id);

    if (!error) {
      loadData();
    }
  };

  const getRankIcon = (rango: string) => {
    if (rango.includes('Leyenda')) return Trophy;
    if (rango.includes('Maestro')) return Crown;
    if (rango.includes('Élite')) return Award;
    return Shield;
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl shadow-soft border border-neutral-200 p-6">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex-1">
            <h1 className="text-3xl font-display font-bold text-accent mb-2">
              Gamificación
            </h1>
            <p className="text-neutral-600">
              Gestión del sistema de gamificación para agentes
            </p>
          </div>
          <Trophy className="w-12 h-12 text-accent" />
        </div>

        <div className="flex gap-2 border-b border-neutral-200">
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`px-4 py-2 font-semibold transition-colors ${
              activeTab === 'leaderboard'
                ? 'text-accent border-b-2 border-accent'
                : 'text-neutral-500 hover:text-neutral-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4" />
              <span>Ranking</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('missions')}
            className={`px-4 py-2 font-semibold transition-colors ${
              activeTab === 'missions'
                ? 'text-accent border-b-2 border-accent'
                : 'text-neutral-500 hover:text-neutral-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4" />
              <span>Misiones</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('multipliers')}
            className={`px-4 py-2 font-semibold transition-colors ${
              activeTab === 'multipliers'
                ? 'text-accent border-b-2 border-accent'
                : 'text-neutral-500 hover:text-neutral-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              <span>Multiplicadores</span>
            </div>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
        </div>
      ) : (
        <>
          {activeTab === 'leaderboard' && (
            <div className="bg-white rounded-2xl shadow-soft border border-neutral-200 p-6">
              <h2 className="text-xl font-bold text-neutral-900 mb-4">
                Top Agentes por XP
              </h2>

              <div className="space-y-2">
                {leaderboard.map((agent: any, index) => {
                  const RankIcon = getRankIcon(agent.rango_actual);
                  const isTop3 = index < 3;

                  return (
                    <div
                      key={agent.user_id}
                      className={`flex items-center gap-4 p-4 rounded-xl transition-all ${
                        isTop3
                          ? 'bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-300'
                          : 'bg-neutral-50 hover:bg-neutral-100'
                      }`}
                    >
                      <div className="flex-shrink-0 w-12 text-center">
                        {isTop3 ? (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center mx-auto">
                            <span className="text-white font-bold text-lg">
                              {index + 1}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xl font-bold text-neutral-400">
                            {index + 1}
                          </span>
                        )}
                      </div>

                      <div className="flex-shrink-0">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent to-primary-600 flex items-center justify-center">
                          <RankIcon className="w-6 h-6 text-white" />
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-neutral-900 truncate">
                          {agent.usuario?.nombre_completo || 'Agente'}
                        </h3>
                        <div className="flex items-center gap-3 text-sm text-neutral-600">
                          <span className="truncate">
                            {agent.usuario?.oficina?.nombre || 'Sin oficina'}
                          </span>
                          <span className="text-neutral-400">•</span>
                          <span className="font-semibold text-purple-600">
                            {agent.rango_actual}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-6 flex-shrink-0">
                        <div className="text-right">
                          <div className="text-sm text-neutral-600">XP</div>
                          <div className="text-lg font-bold text-blue-600">
                            {formatXP(agent.xp_total)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-neutral-600">JC</div>
                          <div className="text-lg font-bold text-yellow-600">
                            {formatJC(agent.jiro_coins_balance)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-neutral-600">Nivel</div>
                          <div className="text-lg font-bold text-green-600">
                            {agent.nivel_actual}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'missions' && (
            <div className="bg-white rounded-2xl shadow-soft border border-neutral-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-neutral-900">
                  Misiones Configuradas
                </h2>
                <button
                  onClick={() => {
                    setEditingMission(null);
                    setShowMissionModal(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nueva Misión</span>
                </button>
              </div>

              <div className="space-y-3">
                {missions.map((mission) => (
                  <div
                    key={mission.id}
                    className="flex items-start gap-4 p-4 bg-neutral-50 rounded-xl border border-neutral-200"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-bold text-neutral-900">
                          {mission.nombre}
                        </h3>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            mission.activa
                              ? 'bg-green-100 text-green-700'
                              : 'bg-neutral-200 text-neutral-600'
                          }`}
                        >
                          {mission.activa ? 'Activa' : 'Inactiva'}
                        </span>
                        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                          {mission.tipo_periodo}
                        </span>
                      </div>
                      <p className="text-sm text-neutral-600 mb-3">
                        {mission.descripcion}
                      </p>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-blue-600 font-semibold">
                          +{mission.xp_reward} XP
                        </span>
                        <span className="text-yellow-600 font-semibold">
                          +{mission.jc_reward} JC
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingMission(mission);
                          setShowMissionModal(true);
                        }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteMission(mission.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'multipliers' && (
            <div className="bg-white rounded-2xl shadow-soft border border-neutral-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-neutral-900">
                  Multiplicadores de XP
                </h2>
                <button
                  onClick={() => {
                    setEditingMultiplier(null);
                    setShowMultiplierModal(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nuevo Multiplicador</span>
                </button>
              </div>

              <div className="space-y-3">
                {multipliers.map((multiplier) => (
                  <div
                    key={multiplier.id}
                    className="flex items-start gap-4 p-4 bg-neutral-50 rounded-xl border border-neutral-200"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-bold text-neutral-900">
                          {multiplier.tipo.toUpperCase()}: {multiplier.referencia || 'Global'}
                        </h3>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            multiplier.activo
                              ? 'bg-green-100 text-green-700'
                              : 'bg-neutral-200 text-neutral-600'
                          }`}
                        >
                          {multiplier.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>
                      <p className="text-sm text-neutral-600 mb-2">
                        {multiplier.descripcion}
                      </p>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-purple-600 font-semibold">
                          Factor: {multiplier.factor}x
                        </span>
                        {multiplier.fecha_inicio && (
                          <span className="text-neutral-600">
                            Desde: {new Date(multiplier.fecha_inicio).toLocaleDateString()}
                          </span>
                        )}
                        {multiplier.fecha_fin && (
                          <span className="text-neutral-600">
                            Hasta: {new Date(multiplier.fecha_fin).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingMultiplier(multiplier);
                          setShowMultiplierModal(true);
                        }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteMultiplier(multiplier.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
