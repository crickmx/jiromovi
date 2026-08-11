import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Loader2, AlertTriangle, Users } from 'lucide-react';
import {
  groupTramiteTeamsByCategory,
  loadActiveTramiteTeams,
  loadUserTramiteTeamIds,
  type TramiteTeamCategory,
  type TramiteTeamOption,
  validateTramiteTeamSelection,
} from '../../lib/tramiteTeamAssignments';

interface Props {
  userId?: string | null;
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
  onStateChange?: (state: {
    ready: boolean;
    valid: boolean;
    missingCategories: string[];
    categories: TramiteTeamCategory[];
  }) => void;
  disabled?: boolean;
}

function teamLabel(team: TramiteTeamOption) {
  return team.nombre || team.id;
}

export function AgentTramiteTeamsSection({
  userId,
  selectedIds,
  onSelectedIdsChange,
  onStateChange,
  disabled = false,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState<TramiteTeamOption[]>([]);
  const [error, setError] = useState('');
  const hydratedUserRef = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');

    (async () => {
      try {
        const activeTeams = await loadActiveTramiteTeams();
        if (!alive) return;
        setTeams(activeTeams);

        if (userId && hydratedUserRef.current !== userId && selectedIds.length === 0) {
          const existingIds = await loadUserTramiteTeamIds(userId);
          if (!alive) return;
          hydratedUserRef.current = userId;
          onSelectedIdsChange(existingIds);
        } else if (!userId) {
          hydratedUserRef.current = null;
        }
      } catch (err) {
        if (!alive) return;
        const message = err instanceof Error ? err.message : 'Error al cargar equipos de trámite';
        setError(message);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [userId, onSelectedIdsChange]);

  const grouped = useMemo(() => groupTramiteTeamsByCategory(teams), [teams]);
  const selectionState = useMemo(() => validateTramiteTeamSelection(teams, selectedIds), [teams, selectedIds]);

  useEffect(() => {
    onStateChange?.({
      ready: !loading,
      valid: selectionState.valid,
      missingCategories: selectionState.missingCategories,
      categories: selectionState.categories,
    });
  }, [loading, onStateChange, selectionState]);

  const toggleTeam = (teamId: string) => {
    if (disabled) return;
    const next = selectedIds.includes(teamId)
      ? selectedIds.filter((id) => id !== teamId)
      : [...selectedIds, teamId];
    onSelectedIdsChange(next);
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-neutral-200 dark:border-white/10 bg-white/70 dark:bg-white/5 px-4 py-5">
        <div className="flex items-center gap-2 text-sm text-neutral-500 dark:text-white/45">
          <Loader2 className="w-4 h-4 animate-spin" />
          Cargando equipos de trámite...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-sky-200 dark:border-sky-500/20 bg-sky-50/60 dark:bg-sky-500/5 px-4 py-3">
        <div className="flex items-start gap-2">
          <Users className="w-4 h-4 text-sky-600 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-neutral-900 dark:text-white">Asignación de equipos de trámites</p>
            <p className="text-xs text-neutral-600 dark:text-white/60 mt-0.5">
              El agente debe tener al menos un equipo en cada categoría activa. Puedes elegir varios por categoría.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {grouped.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-200 dark:border-white/10 px-4 py-6 text-sm text-neutral-500 dark:text-white/45 text-center">
          No hay equipos de trámite activos para asignar.
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map((category) => {
            const hasSelection = category.teams.some((team) => selectedIds.includes(team.id));
            return (
              <div key={category.key} className="rounded-xl border border-neutral-200 dark:border-white/10 overflow-hidden bg-white dark:bg-white/5">
                <div className="flex items-center justify-between gap-3 px-4 py-3 bg-neutral-50 dark:bg-white/5 border-b border-neutral-200 dark:border-white/10">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-semibold text-neutral-900 dark:text-white">{category.label}</h4>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-neutral-200 dark:bg-white/10 text-neutral-600 dark:text-white/50">
                        {category.teams.length} equipo{category.teams.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-500 dark:text-white/40 mt-1">
                      Selecciona al menos 1 equipo de esta categoría.
                    </p>
                  </div>
                  {hasSelection ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-1 rounded-full">
                      <Check className="w-3 h-3" />
                      Completo
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 px-2.5 py-1 rounded-full">
                      <AlertTriangle className="w-3 h-3" />
                      Faltante
                    </span>
                  )}
                </div>

                <div className="divide-y divide-neutral-100 dark:divide-white/5">
                  {category.teams.map((team) => {
                    const checked = selectedIds.includes(team.id);
                    return (
                      <label
                        key={team.id}
                        className={`flex items-start gap-3 px-4 py-3 transition-colors ${
                          disabled ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer hover:bg-neutral-50 dark:hover:bg-white/5'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleTeam(team.id)}
                          disabled={disabled}
                          className="mt-1 h-4 w-4 rounded border-neutral-300 text-accent focus:ring-accent"
                        />
                        <span
                          className="mt-1 w-2.5 h-2.5 rounded-full flex-none"
                          style={{ backgroundColor: team.color || '#94a3b8' }}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-neutral-900 dark:text-white">{teamLabel(team)}</span>
                          </div>
                          {team.area_categoria && (
                            <p className="text-xs text-neutral-500 dark:text-white/40 mt-0.5">
                              {team.area_categoria}
                            </p>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectionState.missingCategories.length > 0 && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          Faltan categorías por cubrir: {selectionState.missingCategories.join(', ')}.
        </div>
      )}
    </div>
  );
}

export default AgentTramiteTeamsSection;
