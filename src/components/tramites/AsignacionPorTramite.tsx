import { useCallback, useEffect, useState } from 'react';
import { Plus, X, Loader2, AlertTriangle, ArrowRight, Route } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface AgentUser { id: string; nombre_completo: string; rol: string; oficina_id: string | null }
interface TipoTramite { id: string; value: string; label: string; area: string }
interface Equipo { id: string; nombre: string; color: string; area_categoria: string | null }
interface Ejecutivo { id: string; nombre_completo: string }
interface Override {
  id: string;
  usuario_id: string; usuario_nombre: string;
  tipo_id: string; tipo_label: string;
  grupo_id: string; grupo_nombre: string; grupo_color: string;
  ejecutivo_id: string | null; ejecutivo_nombre: string | null;
}

export function AsignacionPorTramite() {
  const { usuario } = useAuth();
  const [loading, setLoading] = useState(true);
  const [agentes, setAgentes] = useState<AgentUser[]>([]);
  const [tipos, setTipos] = useState<TipoTramite[]>([]);
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [ejecutivosPorGrupo, setEjecutivosPorGrupo] = useState<Record<string, Ejecutivo[]>>({});

  const [formAgenteId, setFormAgenteId] = useState('');
  const [formTipoId, setFormTipoId] = useState('');
  const [formGrupoId, setFormGrupoId] = useState('');
  const [formEjecutivoId, setFormEjecutivoId] = useState('');
  const [ejecutivosForm, setEjecutivosForm] = useState<Ejecutivo[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savingEjecutivoId, setSavingEjecutivoId] = useState<string | null>(null);

  const loadOverrides = useCallback(async () => {
    const { data } = await supabase
      .from('tramites_reglas_por_tipo')
      .select(`
        id, usuario_id, tipo_id, grupo_id, ejecutivo_id,
        agente:usuarios!usuario_id(nombre_completo),
        tipo:ticket_tipos!tipo_id(label),
        grupo:tramites_grupos_visualizacion!grupo_id(nombre, color),
        ejecutivo:usuarios!ejecutivo_id(nombre_completo)
      `)
      .eq('activo', true)
      .order('created_at', { ascending: false });

    if (!data) return;
    const mapped = data.map((r: any) => ({
      id: r.id as string,
      usuario_id: r.usuario_id as string,
      usuario_nombre: r.agente?.nombre_completo || (r.usuario_id as string),
      tipo_id: r.tipo_id as string,
      tipo_label: r.tipo?.label || (r.tipo_id as string),
      grupo_id: r.grupo_id as string,
      grupo_nombre: r.grupo?.nombre || '—',
      grupo_color: r.grupo?.color || '#94a3b8',
      ejecutivo_id: r.ejecutivo_id as string | null,
      ejecutivo_nombre: r.ejecutivo?.nombre_completo || null,
    }));
    setOverrides(mapped);

    const grupoIds = [...new Set(mapped.map(m => m.grupo_id))];
    const results = await Promise.all(
      grupoIds.map(id => supabase.rpc('get_grupo_miembros_ejecutivos', { p_grupo_id: id }))
    );
    const porGrupo: Record<string, Ejecutivo[]> = {};
    grupoIds.forEach((id, i) => { porGrupo[id] = (results[i].data || []) as Ejecutivo[]; });
    setEjecutivosPorGrupo(porGrupo);
  }, []);

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      const [agentesRes, tiposRes, equiposRes] = await Promise.all([
        supabase.from('usuarios').select('id, nombre_completo, rol, oficina_id').order('nombre_completo'),
        supabase.from('ticket_tipos').select('id, value, label, area').eq('activo', true).order('label'),
        supabase.from('tramites_grupos_visualizacion').select('id, nombre, color, area_categoria').eq('activo', true).order('nombre'),
      ]);
      setAgentes((agentesRes.data || []) as AgentUser[]);
      setTipos((tiposRes.data || []) as TipoTramite[]);
      setEquipos((equiposRes.data || []) as Equipo[]);
      await loadOverrides();
      setLoading(false);
    };
    loadAll();
  }, [loadOverrides]);

  const tipoSeleccionado = tipos.find(t => t.id === formTipoId);
  const equiposDelArea = tipoSeleccionado
    ? equipos.filter(e => (e.area_categoria || '').toLowerCase() === tipoSeleccionado.area.toLowerCase())
    : [];

  useEffect(() => {
    if (!formGrupoId) { setEjecutivosForm([]); return; }
    supabase.rpc('get_grupo_miembros_ejecutivos', { p_grupo_id: formGrupoId }).then(({ data }) => {
      setEjecutivosForm((data || []) as Ejecutivo[]);
    });
  }, [formGrupoId]);

  const handleAgregar = async () => {
    if (!formAgenteId || !formTipoId || !formGrupoId || !usuario) return;
    setSaving(true);
    setError('');
    try {
      const { data: existing, error: qErr } = await supabase
        .from('tramites_reglas_por_tipo')
        .select('id')
        .eq('usuario_id', formAgenteId)
        .eq('tipo_id', formTipoId)
        .maybeSingle();
      if (qErr) throw new Error(qErr.message);

      const payload = {
        grupo_id: formGrupoId,
        ejecutivo_id: formEjecutivoId || null,
        activo: true,
        created_by: usuario.id,
      };

      if (existing) {
        const { error: updErr } = await supabase.from('tramites_reglas_por_tipo').update(payload).eq('id', existing.id);
        if (updErr) throw updErr;
      } else {
        const { error: insErr } = await supabase
          .from('tramites_reglas_por_tipo')
          .insert({ usuario_id: formAgenteId, tipo_id: formTipoId, ...payload });
        if (insErr) throw insErr;
      }

      setFormAgenteId('');
      setFormTipoId('');
      setFormGrupoId('');
      setFormEjecutivoId('');
      await loadOverrides();
    } catch (err: any) {
      setError(err.message || 'Error al guardar la regla');
    } finally {
      setSaving(false);
    }
  };

  const handleQuitar = async (id: string) => {
    await supabase.from('tramites_reglas_por_tipo').update({ activo: false }).eq('id', id);
    await loadOverrides();
  };

  const handleCambiarEjecutivo = async (override: Override, ejecutivoId: string) => {
    setSavingEjecutivoId(override.id);
    await supabase.from('tramites_reglas_por_tipo').update({ ejecutivo_id: ejecutivoId || null }).eq('id', override.id);
    setOverrides(prev => prev.map(o => o.id === override.id ? { ...o, ejecutivo_id: ejecutivoId || null } : o));
    setSavingEjecutivoId(null);
  };

  if (loading) {
    return <div className="h-40 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-neutral-400" /></div>;
  }

  const byGrupo = overrides.reduce<Record<string, Override[]>>((acc, o) => {
    (acc[o.grupo_id] = acc[o.grupo_id] || []).push(o);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-800">
        Override manual: si un agente específico pide un tipo de trámite específico, se asigna siempre al equipo (y ejecutivo, opcional) que elijas aquí — tiene prioridad sobre la auto-asignación por oficina y sobre las reglas de la pestaña "Reglas".
      </div>

      {/* Agregar override */}
      <div className="border border-neutral-200 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 bg-neutral-50 border-b border-neutral-100 flex items-center justify-between">
          <h4 className="font-bold text-sm text-neutral-700 flex items-center gap-2"><Plus className="w-4 h-4" /> Nuevo override</h4>
          <button
            onClick={handleAgregar}
            disabled={saving || !formAgenteId || !formTipoId || !formGrupoId}
            className="px-3 py-1 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Agregar'}
          </button>
        </div>
        {error && (
          <div className="px-4 py-2 bg-red-50 border-b border-red-100 text-xs text-red-700 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />{error}
          </div>
        )}
        <div className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">Agente</label>
            <select
              value={formAgenteId}
              onChange={e => setFormAgenteId(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm focus:ring-2 focus:ring-neutral-900 outline-none"
            >
              <option value="">Seleccionar…</option>
              {agentes.map(a => <option key={a.id} value={a.id}>{a.nombre_completo}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">Tipo de trámite</label>
            <select
              value={formTipoId}
              onChange={e => { setFormTipoId(e.target.value); setFormGrupoId(''); setFormEjecutivoId(''); }}
              className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm focus:ring-2 focus:ring-neutral-900 outline-none"
            >
              <option value="">Seleccionar…</option>
              {tipos.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">Equipo</label>
            <select
              value={formGrupoId}
              onChange={e => { setFormGrupoId(e.target.value); setFormEjecutivoId(''); }}
              disabled={!formTipoId}
              className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm focus:ring-2 focus:ring-neutral-900 outline-none disabled:bg-neutral-50 disabled:text-neutral-400"
            >
              <option value="">{formTipoId ? 'Seleccionar…' : 'Elige un tipo primero'}</option>
              {equiposDelArea.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">Ejecutivo (opcional)</label>
            <select
              value={formEjecutivoId}
              onChange={e => setFormEjecutivoId(e.target.value)}
              disabled={!formGrupoId}
              className="w-full px-3 py-2 border border-neutral-200 rounded-xl text-sm focus:ring-2 focus:ring-neutral-900 outline-none disabled:bg-neutral-50 disabled:text-neutral-400"
            >
              <option value="">Pool del equipo</option>
              {ejecutivosForm.map(e => <option key={e.id} value={e.id}>{e.nombre_completo}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Listado */}
      {Object.keys(byGrupo).length === 0 ? (
        <div className="text-center py-16 bg-neutral-50 rounded-2xl border-2 border-dashed border-neutral-200">
          <Route className="w-10 h-10 mx-auto text-neutral-300 mb-2" />
          <p className="text-sm text-neutral-500">No hay overrides configurados todavía.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(byGrupo).map(([grupoId, overridesGrupo]) => {
            const first = overridesGrupo[0];
            const ejecutivosDisponibles = ejecutivosPorGrupo[grupoId] || [];
            return (
              <div key={grupoId} className="border border-neutral-200 rounded-2xl overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-3 bg-neutral-50 border-b border-neutral-100">
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: first.grupo_color }} />
                  <span className="text-sm font-bold text-neutral-800">{first.grupo_nombre}</span>
                  <span className="ml-auto text-xs text-neutral-400">{overridesGrupo.length} override{overridesGrupo.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="divide-y divide-neutral-100">
                  {overridesGrupo.map(o => (
                    <div key={o.id} className="group flex items-center gap-3 px-5 py-3">
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-neutral-800">{o.usuario_nombre}</span>
                        <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">{o.tipo_label}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <ArrowRight className="w-3.5 h-3.5 text-neutral-400" />
                        <select
                          value={o.ejecutivo_id ?? ''}
                          disabled={savingEjecutivoId === o.id}
                          onChange={e => handleCambiarEjecutivo(o, e.target.value)}
                          className="text-[11px] text-neutral-500 bg-transparent border-none outline-none cursor-pointer hover:text-neutral-800 py-0 pr-4"
                        >
                          <option value="">Pool del equipo</option>
                          {ejecutivosDisponibles.map(m => (
                            <option key={m.id} value={m.id}>{m.nombre_completo}</option>
                          ))}
                        </select>
                        {savingEjecutivoId === o.id && <Loader2 className="w-3 h-3 animate-spin text-neutral-400" />}
                      </div>
                      <button onClick={() => handleQuitar(o.id)} className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-100 transition-all flex-shrink-0">
                        <X className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
