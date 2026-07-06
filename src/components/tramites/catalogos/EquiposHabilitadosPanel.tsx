import { useEffect, useState } from 'react';
import { CheckSquare, Square, Building2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';

interface Equipo {
  id: string;
  nombre: string;
  color: string;
  all_offices: boolean;
  area_categoria: string | null;
}

interface Props {
  tipoId: string;
  area: string;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export function EquiposHabilitadosPanel({ tipoId, area, showToast }: Props) {
  const { usuario } = useAuth();
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [habilitados, setHabilitados] = useState<Set<string>>(new Set());
  const [oficinasPorEquipo, setOficinasPorEquipo] = useState<Record<string, string[]>>({});
  const [oficinasNombres, setOficinasNombres] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => { loadData(); }, [tipoId, area]);

  const loadData = async () => {
    setLoading(true);
    const { data: equiposData } = await supabase
      .from('tramites_grupos_visualizacion')
      .select('id, nombre, color, all_offices, area_categoria')
      .eq('activo', true)
      .ilike('area_categoria', area)
      .order('nombre');

    const equiposList = (equiposData || []) as Equipo[];
    setEquipos(equiposList);

    if (equiposList.length === 0) {
      setHabilitados(new Set());
      setOficinasPorEquipo({});
      setLoading(false);
      return;
    }

    const equipoIds = equiposList.map(e => e.id);
    const [configRes, oficinasRes, oficinasNombresRes] = await Promise.all([
      supabase.from('tramite_team_tipo_config').select('team_id, habilitado').eq('tipo_id', tipoId).in('team_id', equipoIds),
      supabase.from('tramites_grupos_oficinas').select('grupo_id, oficina_id').in('grupo_id', equipoIds),
      supabase.from('oficinas').select('id, nombre'),
    ]);

    setHabilitados(new Set((configRes.data || []).filter(c => c.habilitado).map(c => c.team_id)));

    const porEquipo: Record<string, string[]> = {};
    for (const row of oficinasRes.data || []) {
      (porEquipo[row.grupo_id] ??= []).push(row.oficina_id);
    }
    setOficinasPorEquipo(porEquipo);
    setOficinasNombres(Object.fromEntries((oficinasNombresRes.data || []).map(o => [o.id, o.nombre])));
    setLoading(false);
  };

  const buscarConflicto = (equipo: Equipo) => {
    const misOficinas = new Set(oficinasPorEquipo[equipo.id] || []);
    return equipos.find(otro => {
      if (otro.id === equipo.id || !habilitados.has(otro.id)) return false;
      if (equipo.all_offices || otro.all_offices) return true;
      return (oficinasPorEquipo[otro.id] || []).some(o => misOficinas.has(o));
    });
  };

  const toggleEquipo = async (equipo: Equipo) => {
    const yaHabilitado = habilitados.has(equipo.id);

    if (!yaHabilitado) {
      const conflicto = buscarConflicto(equipo);
      if (conflicto) {
        const detalle = equipo.all_offices || conflicto.all_offices
          ? 'al menos uno atiende "todas las oficinas"'
          : `ambos atienden ${(oficinasPorEquipo[equipo.id] || []).filter(o => (oficinasPorEquipo[conflicto.id] || []).includes(o)).map(o => oficinasNombres[o] || o).join(', ')}`;
        const ok = confirm(
          `"${conflicto.nombre}" ya está habilitado para este tipo de trámite y comparte oficina con "${equipo.nombre}" (${detalle}). ` +
          `Esto puede hacer ambigua la auto-asignación. ¿Habilitar "${equipo.nombre}" de todos modos?`
        );
        if (!ok) return;
      }
    }

    setSavingId(equipo.id);
    try {
      if (yaHabilitado) {
        const { error } = await supabase.from('tramite_team_tipo_config').delete().eq('team_id', equipo.id).eq('tipo_id', tipoId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('tramite_team_tipo_config').upsert(
          { team_id: equipo.id, tipo_id: tipoId, habilitado: true, updated_by: usuario?.id },
          { onConflict: 'team_id,tipo_id' }
        );
        if (error) throw error;
      }
      await loadData();
      showToast(yaHabilitado ? `${equipo.nombre} deshabilitado para este tipo` : `${equipo.nombre} habilitado para este tipo`);
    } catch (err: any) {
      showToast('Error: ' + err.message, 'error');
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return <div className="p-4 text-sm text-neutral-400">Cargando equipos...</div>;
  }

  return (
    <div className="p-4 overflow-auto space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
        Elige qué equipos pueden <strong>atender</strong> este tipo de trámite (no afecta quién puede crearlo). La auto-asignación resuelve el equipo según la oficina del agente solicitante, cruzada contra las oficinas de cada equipo marcado aquí. Un tipo sin ningún equipo marcado no participa de la asignación automática por oficina.
      </div>

      {equipos.length === 0 ? (
        <p className="text-sm text-neutral-400 italic">No hay equipos activos en el área "{area}".</p>
      ) : (
        <div className="space-y-2">
          {equipos.map(equipo => {
            const checked = habilitados.has(equipo.id);
            const oficinasLabel = equipo.all_offices
              ? 'Todas las oficinas'
              : (oficinasPorEquipo[equipo.id] || []).map(o => oficinasNombres[o] || o).join(', ') || 'Sin oficinas asignadas';
            return (
              <button
                key={equipo.id}
                type="button"
                disabled={savingId === equipo.id}
                onClick={() => toggleEquipo(equipo)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors disabled:opacity-50 ${
                  checked ? 'border-blue-300 bg-blue-50' : 'border-neutral-200 bg-white hover:border-neutral-300'
                }`}
              >
                {checked ? <CheckSquare className="w-4 h-4 text-blue-600 shrink-0" /> : <Square className="w-4 h-4 text-neutral-300 shrink-0" />}
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: equipo.color }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-800">{equipo.nombre}</p>
                  <p className="text-xs text-neutral-400 flex items-center gap-1">
                    <Building2 className="w-3 h-3" />
                    {oficinasLabel}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
