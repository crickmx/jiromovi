import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Crown, Zap, Eye, Users, Shuffle, X, Plus, Trash2, ChevronDown,
  Check, Loader2, AlertTriangle, CheckCircle2, Search, ArrowRight,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LiderEquipo {
  id: string; nombre: string; color: string;
  area_categoria: string | null; member_count: number;
}

interface Miembro {
  usuario_id: string; nombre_completo: string;
  rol_en_equipo: 'lider' | 'supervisor' | 'director' | 'ejecutivo' | 'miembro';
  oficina_nombre: string | null; rol: string;
}

interface Regla {
  id: string; usuario_id: string; usuario_nombre: string;
  ejecutivo_id: string | null; ejecutivo_nombre: string | null;
  area: string | null;
}

interface UsuarioOpc {
  id: string; nombre_completo: string; rol: string; oficina_id: string | null;
}

interface Props { onClose: () => void }

// ─── Constants ────────────────────────────────────────────────────────────────

const ROL_CONFIG = {
  lider:     { label: 'Líder',     bg: 'bg-amber-100',   text: 'text-amber-800',   icon: Crown },
  ejecutivo: { label: 'Ejecutivo', bg: 'bg-blue-100',    text: 'text-blue-700',    icon: Zap   },
  miembro:   { label: 'Miembro',   bg: 'bg-neutral-100', text: 'text-neutral-600', icon: Eye   },
} as const;

function showToast(msg: string, type: 'ok' | 'err' = 'ok') {
  const el = document.createElement('div');
  el.className = [
    'fixed bottom-6 right-6 z-[9999] flex items-center gap-2.5 px-4 py-3',
    'rounded-xl shadow-xl text-sm font-medium text-white',
    type === 'ok' ? 'bg-neutral-900' : 'bg-red-600',
  ].join(' ');
  el.innerHTML = type === 'ok'
    ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>${msg}`
    : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>${msg}`;
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 350); }, 3500);
}

// ─── PanelLider ───────────────────────────────────────────────────────────────

export function PanelLider({ onClose }: Props) {
  const { usuario } = useAuth();
  const [loading, setLoading] = useState(true);
  const [equipos, setEquipos] = useState<LiderEquipo[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<'miembros' | 'reglas'>('miembros');

  // Miembros
  const [miembros, setMiembros] = useState<Miembro[]>([]);
  const [loadingMiembros, setLoadingMiembros] = useState(false);
  const [searchAdd, setSearchAdd] = useState('');
  const [allUsuarios, setAllUsuarios] = useState<UsuarioOpc[]>([]);
  const [pendingRol, setPendingRol] = useState<'lider' | 'supervisor' | 'director' | 'ejecutivo' | 'miembro'>('ejecutivo');
  const [addingUser, setAddingUser] = useState<string | null>(null);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [changingRol, setChangingRol] = useState<string | null>(null);
  const [removingUser, setRemovingUser] = useState<string | null>(null);
  const [rolDropOpen, setRolDropOpen] = useState<string | null>(null);
  const rolDropRef = useRef<HTMLDivElement>(null);

  // Reglas
  const [reglas, setReglas] = useState<Regla[]>([]);
  const [loadingReglas, setLoadingReglas] = useState(false);
  const [ejecutivosEquipo, setEjecutivosEquipo] = useState<Miembro[]>([]);
  const [addingReglaUserId, setAddingReglaUserId] = useState('');
  const [addingReglaEjecutivoId, setAddingReglaEjecutivoId] = useState('');
  const [savingRegla, setSavingRegla] = useState(false);
  const [removingRegla, setRemovingRegla] = useState<string | null>(null);
  const [showAddRegla, setShowAddRegla] = useState(false);
  const [searchAgente, setSearchAgente] = useState('');
  const [savingEjecutivo, setSavingEjecutivo] = useState<string | null>(null);

  const selectedEquipo = equipos.find(e => e.id === selectedId) ?? null;

  // ── Close rol dropdown on outside click ──────────────────────────────────────

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (rolDropRef.current && !rolDropRef.current.contains(e.target as Node)) setRolDropOpen(null);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // ── Load leader teams ─────────────────────────────────────────────────────────

  const loadEquipos = useCallback(async () => {
    if (!usuario?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from('tramites_grupos_miembros')
      .select('grupo_id, tramites_grupos_visualizacion!inner(id, nombre, color, area_categoria, activo, member_count:tramites_grupos_miembros(count))')
      .eq('usuario_id', usuario.id)
      .eq('rol_en_equipo', 'lider');

    if (data) {
      type Row = {
        grupo_id: string;
        tramites_grupos_visualizacion: {
          id: string; nombre: string; color: string;
          area_categoria: string | null; activo: boolean;
          member_count: { count: number }[];
        };
      };
      const grupos: LiderEquipo[] = (data as Row[])
        .filter(r => r.tramites_grupos_visualizacion.activo)
        .map(r => ({
          id: r.tramites_grupos_visualizacion.id,
          nombre: r.tramites_grupos_visualizacion.nombre,
          color: r.tramites_grupos_visualizacion.color,
          area_categoria: r.tramites_grupos_visualizacion.area_categoria,
          member_count: r.tramites_grupos_visualizacion.member_count?.[0]?.count ?? 0,
        }));
      setEquipos(grupos);
      if (grupos.length > 0) setSelectedId(grupos[0].id);
    }
    setLoading(false);
  }, [usuario?.id]);

  useEffect(() => { loadEquipos(); }, [loadEquipos]);

  // ── Load all usuarios for member search ───────────────────────────────────────

  useEffect(() => {
    supabase.from('usuarios').select('id, nombre_completo, rol, oficina_id')
      .in('rol', ['Empleado', 'Gerente', 'Administrador'])
      .eq('activo', true)
      .order('nombre_completo')
      .then(({ data }) => { if (data) setAllUsuarios(data as UsuarioOpc[]); });
  }, []);

  // ── Load miembros when team or tab changes ────────────────────────────────────

  const loadMiembros = useCallback(async (grupoId: string) => {
    setLoadingMiembros(true);
    const { data } = await supabase.rpc('get_grupo_miembros', { p_grupo_id: grupoId });
    if (data) {
      setMiembros(data.map((m: Record<string, unknown>) => ({
        ...m, usuario_id: m.id as string,
      })) as Miembro[]);
    }
    setLoadingMiembros(false);
  }, []);

  // ── Load reglas when team or tab changes ──────────────────────────────────────

  const loadReglas = useCallback(async (grupoId: string) => {
    setLoadingReglas(true);
    const { data } = await supabase
      .from('tramites_grupos_reglas')
      .select('id, usuario_id, ejecutivo_id, area')
      .eq('grupo_id', grupoId)
      .eq('activo', true);

    if (data) {
      const userIds = [...new Set([
        ...data.map((r: { usuario_id: string }) => r.usuario_id),
        ...data.filter((r: { ejecutivo_id: string | null }) => r.ejecutivo_id).map((r: { ejecutivo_id: string }) => r.ejecutivo_id),
      ])];
      const { data: usersData } = await supabase
        .from('usuarios').select('id, nombre_completo').in('id', userIds);
      const nameMap = new Map<string, string>();
      (usersData || []).forEach((u: { id: string; nombre_completo: string }) => nameMap.set(u.id, u.nombre_completo));

      setReglas(data.map((r: { id: string; usuario_id: string; ejecutivo_id: string | null; area: string | null }) => ({
        id: r.id,
        usuario_id: r.usuario_id,
        usuario_nombre: nameMap.get(r.usuario_id) || r.usuario_id,
        ejecutivo_id: r.ejecutivo_id,
        ejecutivo_nombre: r.ejecutivo_id ? (nameMap.get(r.ejecutivo_id) || null) : null,
        area: r.area,
      })));
    }
    setLoadingReglas(false);
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    if (tab === 'miembros') loadMiembros(selectedId);
    if (tab === 'reglas') {
      loadReglas(selectedId);
    }
  }, [selectedId, tab, loadMiembros, loadReglas]);

  useEffect(() => {
    setEjecutivosEquipo(miembros.filter(m => m.rol_en_equipo === 'lider' || m.rol_en_equipo === 'ejecutivo'));
  }, [miembros]);

  // ── Member actions ────────────────────────────────────────────────────────────

  const handleAdd = async (userId: string) => {
    if (!selectedId) return;
    setAddingUser(userId);
    const { error } = await supabase.from('tramites_grupos_miembros')
      .insert({ grupo_id: selectedId, usuario_id: userId, rol_en_equipo: pendingRol });
    if (error && error.code !== '23505') { showToast('Error: ' + error.message, 'err'); }
    else { showToast('Miembro agregado'); setSearchAdd(''); setShowAddPanel(false); await loadMiembros(selectedId); }
    setAddingUser(null);
  };

  const handleChangeRol = async (userId: string, nuevoRol: 'lider' | 'ejecutivo' | 'miembro') => {
    if (!selectedId) return;
    setChangingRol(userId);
    await supabase.from('tramites_grupos_miembros')
      .update({ rol_en_equipo: nuevoRol })
      .eq('grupo_id', selectedId).eq('usuario_id', userId);
    setRolDropOpen(null);
    await loadMiembros(selectedId);
    setChangingRol(null);
  };

  const handleRemove = async (userId: string) => {
    if (!selectedId) return;
    setRemovingUser(userId);
    await supabase.from('tramites_grupos_miembros')
      .delete().eq('grupo_id', selectedId).eq('usuario_id', userId);
    showToast('Miembro removido');
    await loadMiembros(selectedId);
    setRemovingUser(null);
  };

  // ── Reglas actions ────────────────────────────────────────────────────────────

  const handleAddRegla = async () => {
    if (!selectedId || !addingReglaUserId) return;
    setSavingRegla(true);
    const grupoArea = selectedEquipo?.area_categoria ?? null;
    let q = supabase.from('tramites_grupos_reglas').select('id').eq('usuario_id', addingReglaUserId);
    if (grupoArea) q = q.eq('area', grupoArea); else q = q.is('area', null);
    const { data: existing } = await q.limit(1).maybeSingle();
    if (existing) {
      await supabase.from('tramites_grupos_reglas')
        .update({ grupo_id: selectedId, activo: true, ejecutivo_id: addingReglaEjecutivoId || null })
        .eq('id', existing.id);
    } else {
      await supabase.from('tramites_grupos_reglas').insert({
        grupo_id: selectedId,
        usuario_id: addingReglaUserId,
        ejecutivo_id: addingReglaEjecutivoId || null,
        area: grupoArea,
        activo: true,
        created_by: usuario?.id,
      });
    }
    showToast('Regla guardada');
    setAddingReglaUserId('');
    setAddingReglaEjecutivoId('');
    setShowAddRegla(false);
    setSearchAgente('');
    await loadReglas(selectedId);
    setSavingRegla(false);
  };

  const handleRemoveRegla = async (reglaId: string) => {
    setRemovingRegla(reglaId);
    await supabase.from('tramites_grupos_reglas').update({ activo: false }).eq('id', reglaId);
    if (selectedId) await loadReglas(selectedId);
    setRemovingRegla(null);
  };

  const handleCambiarEjecutivo = async (reglaId: string, ejecutivoId: string | null) => {
    setSavingEjecutivo(reglaId);
    await supabase.from('tramites_grupos_reglas').update({ ejecutivo_id: ejecutivoId }).eq('id', reglaId);
    setReglas(prev => prev.map(r => r.id === reglaId
      ? { ...r, ejecutivo_id: ejecutivoId, ejecutivo_nombre: miembros.find(m => m.usuario_id === ejecutivoId)?.nombre_completo ?? null }
      : r
    ));
    setSavingEjecutivo(null);
  };

  // ── Derived ───────────────────────────────────────────────────────────────────

  const disponibles = allUsuarios.filter(u =>
    !miembros.some(m => m.usuario_id === u.id) &&
    u.nombre_completo.toLowerCase().includes(searchAdd.toLowerCase())
  );

  const agentesDisponiblesRegla = allUsuarios.filter(u =>
    !reglas.some(r => r.usuario_id === u.id) &&
    u.nombre_completo.toLowerCase().includes(searchAgente.toLowerCase())
  );

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8 overflow-hidden flex flex-col border border-neutral-200/60 max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-50 rounded-xl">
              <Crown className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-900">Mi equipo</h2>
              <p className="text-xs text-neutral-500 mt-0.5">Gestiona los miembros y reglas de tu equipo</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-neutral-100 rounded-lg text-neutral-400 hover:text-neutral-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
            </div>
          ) : equipos.length === 0 ? (
            <div className="text-center py-16">
              <Users className="w-10 h-10 mx-auto text-neutral-300 mb-2" />
              <p className="text-sm text-neutral-500">No tienes equipos asignados como líder.</p>
            </div>
          ) : (
            <>
              {/* Team selector — only when multiple */}
              {equipos.length > 1 && (
                <div className="flex gap-2 flex-wrap">
                  {equipos.map(e => (
                    <button
                      key={e.id}
                      onClick={() => { setSelectedId(e.id); setTab('miembros'); }}
                      className={[
                        'flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all',
                        selectedId === e.id
                          ? 'border-2 text-neutral-900 bg-neutral-50'
                          : 'border-neutral-200 text-neutral-500 hover:border-neutral-300',
                      ].join(' ')}
                      style={selectedId === e.id ? { borderColor: e.color } : {}}
                    >
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: e.color }} />
                      {e.nombre}
                    </button>
                  ))}
                </div>
              )}

              {/* Team info chip */}
              {selectedEquipo && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-neutral-50 border border-neutral-100">
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: selectedEquipo.color }} />
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-sm text-neutral-800">{selectedEquipo.nombre}</span>
                    {selectedEquipo.area_categoria && (
                      <span className="ml-2 text-xs text-neutral-400">{selectedEquipo.area_categoria}</span>
                    )}
                  </div>
                  <span className="text-xs text-neutral-400">{selectedEquipo.member_count} miembro{selectedEquipo.member_count !== 1 ? 's' : ''}</span>
                </div>
              )}

              {/* Sub-tabs */}
              <div className="flex gap-1 border-b border-neutral-200">
                {([
                  { key: 'miembros', label: 'Miembros', icon: Users },
                  { key: 'reglas',   label: 'Reglas de asignación', icon: Shuffle },
                ] as const).map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setTab(key)}
                    className={[
                      'flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px',
                      tab === key
                        ? 'text-neutral-900 border-amber-500'
                        : 'text-neutral-500 border-transparent hover:text-neutral-700',
                    ].join(' ')}
                  >
                    <Icon className="w-3.5 h-3.5" />{label}
                    {key === 'miembros' && miembros.length > 0 && (
                      <span className="text-[11px] bg-neutral-200 text-neutral-600 px-1.5 py-0.5 rounded-full">{miembros.length}</span>
                    )}
                    {key === 'reglas' && reglas.length > 0 && (
                      <span className="text-[11px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">{reglas.length}</span>
                    )}
                  </button>
                ))}
              </div>

              {/* ── MIEMBROS TAB ── */}
              {tab === 'miembros' && (
                <div className="space-y-3">
                  {loadingMiembros ? (
                    <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-neutral-400" /></div>
                  ) : (
                    <>
                      {/* Current members list */}
                      <div className="space-y-1">
                        {miembros.map(m => {
                          const rc = ROL_CONFIG[m.rol_en_equipo];
                          const isSelf = m.usuario_id === usuario?.id;
                          const isChanging = changingRol === m.usuario_id;
                          const isRemoving = removingUser === m.usuario_id;
                          return (
                            <div key={m.usuario_id} className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-neutral-50 border border-transparent hover:border-neutral-100 transition-colors group">
                              <div className="w-8 h-8 rounded-full bg-neutral-200 flex items-center justify-center flex-shrink-0 text-xs font-bold text-neutral-600">
                                {m.nombre_completo.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-neutral-800 truncate">{m.nombre_completo}</span>
                                  {isSelf && <span className="text-[10px] text-neutral-400 font-medium">(tú)</span>}
                                </div>
                                {m.oficina_nombre && <p className="text-xs text-neutral-400 truncate">{m.oficina_nombre}</p>}
                              </div>
                              {/* Rol badge / dropdown */}
                              <div className="relative flex-shrink-0" ref={rolDropOpen === m.usuario_id ? rolDropRef : undefined}>
                                <button
                                  disabled={isSelf && m.rol_en_equipo === 'lider'}
                                  onClick={() => setRolDropOpen(v => v === m.usuario_id ? null : m.usuario_id)}
                                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${rc.bg} ${rc.text} ${!(isSelf && m.rol_en_equipo === 'lider') ? 'hover:opacity-80 cursor-pointer' : 'cursor-default'}`}
                                >
                                  {isChanging ? <Loader2 className="w-3 h-3 animate-spin" /> : <rc.icon className="w-3 h-3" />}
                                  {rc.label}
                                  {!(isSelf && m.rol_en_equipo === 'lider') && <ChevronDown className="w-3 h-3 opacity-60" />}
                                </button>
                                {rolDropOpen === m.usuario_id && (
                                  <div className="absolute right-0 top-full mt-1 z-30 bg-white border border-neutral-200 rounded-xl shadow-lg py-1 min-w-[130px]">
                                    {(Object.keys(ROL_CONFIG) as Array<keyof typeof ROL_CONFIG>).map(r => {
                                      const cfg = ROL_CONFIG[r];
                                      return (
                                        <button
                                          key={r}
                                          onClick={() => handleChangeRol(m.usuario_id, r)}
                                          className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium hover:bg-neutral-50 transition-colors ${m.rol_en_equipo === r ? cfg.text + ' ' + cfg.bg : 'text-neutral-700'}`}
                                        >
                                          <cfg.icon className="w-3.5 h-3.5" />
                                          {cfg.label}
                                          {m.rol_en_equipo === r && <Check className="w-3 h-3 ml-auto" />}
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                              {/* Remove button — hide for self */}
                              {!isSelf && (
                                <button
                                  onClick={() => handleRemove(m.usuario_id)}
                                  disabled={!!isRemoving}
                                  className="p-1.5 rounded-lg text-neutral-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                                  title="Remover del equipo"
                                >
                                  {isRemoving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Add member panel */}
                      {showAddPanel ? (
                        <div className="border border-neutral-200 rounded-xl p-4 space-y-3 bg-neutral-50">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-neutral-700">Agregar miembro</p>
                            <button onClick={() => { setShowAddPanel(false); setSearchAdd(''); }} className="p-1 hover:bg-neutral-200 rounded-lg text-neutral-400 transition-colors">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          {/* Rol selector */}
                          <div className="flex gap-1.5">
                            {(Object.keys(ROL_CONFIG) as Array<keyof typeof ROL_CONFIG>).map(r => {
                              const cfg = ROL_CONFIG[r];
                              return (
                                <button
                                  key={r}
                                  onClick={() => setPendingRol(r)}
                                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${pendingRol === r ? `${cfg.bg} ${cfg.text} border-transparent` : 'bg-white text-neutral-500 border-neutral-200'}`}
                                >
                                  <cfg.icon className="w-3 h-3" />{cfg.label}
                                </button>
                              );
                            })}
                          </div>
                          {/* Search */}
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
                            <input
                              autoFocus
                              type="text"
                              value={searchAdd}
                              onChange={e => setSearchAdd(e.target.value)}
                              placeholder="Buscar usuario..."
                              className="w-full pl-8 pr-3 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900 outline-none bg-white"
                            />
                          </div>
                          {searchAdd && (
                            <div className="border border-neutral-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto bg-white">
                              {disponibles.length === 0 ? (
                                <p className="text-xs text-neutral-400 px-3 py-2">Sin resultados</p>
                              ) : (
                                disponibles.slice(0, 20).map(u => (
                                  <button
                                    key={u.id}
                                    onClick={() => handleAdd(u.id)}
                                    disabled={addingUser === u.id}
                                    className="w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-neutral-50 transition-colors text-left border-b border-neutral-50 last:border-0"
                                  >
                                    {addingUser === u.id
                                      ? <Loader2 className="w-3.5 h-3.5 animate-spin text-neutral-400 flex-shrink-0" />
                                      : <Plus className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
                                    }
                                    <span className="flex-1 truncate font-medium text-neutral-800">{u.nombre_completo}</span>
                                    <span className="text-xs text-neutral-400 flex-shrink-0">{u.rol}</span>
                                  </button>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowAddPanel(true)}
                          className="flex items-center gap-2 w-full px-4 py-2.5 rounded-xl border border-dashed border-neutral-300 text-sm text-neutral-500 hover:border-neutral-400 hover:text-neutral-700 transition-all"
                        >
                          <Plus className="w-4 h-4" /> Agregar miembro
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* ── REGLAS TAB ── */}
              {tab === 'reglas' && (
                <div className="space-y-3">
                  <p className="text-xs text-neutral-400">
                    Define qué ejecutivo recibe cada agente cuando llega un trámite nuevo.
                    Sin regla → el trámite va al pool del equipo.
                  </p>

                  {loadingReglas ? (
                    <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-neutral-400" /></div>
                  ) : (
                    <>
                      {/* Existing rules */}
                      <div className="space-y-1">
                        {reglas.length === 0 && (
                          <div className="text-center py-6 bg-neutral-50 rounded-xl border border-dashed border-neutral-200">
                            <Shuffle className="w-8 h-8 mx-auto text-neutral-300 mb-1.5" />
                            <p className="text-xs text-neutral-400">No hay reglas configuradas. Todos los trámites irán al pool.</p>
                          </div>
                        )}
                        {reglas.map(r => (
                          <div key={r.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-neutral-50 border border-neutral-100 group">
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-medium text-neutral-800">{r.usuario_nombre}</span>
                              {r.area && (
                                <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">{r.area}</span>
                              )}
                            </div>
                            <ArrowRight className="w-3.5 h-3.5 text-neutral-300 flex-shrink-0" />
                            {/* Ejecutivo selector */}
                            <select
                              value={r.ejecutivo_id ?? ''}
                              onChange={e => handleCambiarEjecutivo(r.id, e.target.value || null)}
                              disabled={savingEjecutivo === r.id}
                              className="text-sm border border-neutral-200 rounded-lg px-2 py-1 text-neutral-700 focus:outline-none focus:ring-1 focus:ring-neutral-900 bg-white max-w-[160px] truncate"
                            >
                              <option value="">Pool del equipo</option>
                              {ejecutivosEquipo.map(e => (
                                <option key={e.usuario_id} value={e.usuario_id}>{e.nombre_completo}</option>
                              ))}
                            </select>
                            {savingEjecutivo === r.id && <Loader2 className="w-3.5 h-3.5 animate-spin text-neutral-400 flex-shrink-0" />}
                            <button
                              onClick={() => handleRemoveRegla(r.id)}
                              disabled={removingRegla === r.id}
                              className="p-1.5 rounded-lg text-neutral-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                            >
                              {removingRegla === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* Add rule panel */}
                      {showAddRegla ? (
                        <div className="border border-neutral-200 rounded-xl p-4 space-y-3 bg-neutral-50">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-neutral-700">Nueva regla</p>
                            <button onClick={() => { setShowAddRegla(false); setSearchAgente(''); setAddingReglaUserId(''); setAddingReglaEjecutivoId(''); }} className="p-1 hover:bg-neutral-200 rounded-lg text-neutral-400">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-neutral-600 mb-1">Agente</label>
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
                              <input
                                autoFocus
                                type="text"
                                value={searchAgente}
                                onChange={e => setSearchAgente(e.target.value)}
                                placeholder="Buscar agente..."
                                className="w-full pl-8 pr-3 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-neutral-900 outline-none bg-white"
                              />
                            </div>
                            {searchAgente && (
                              <div className="mt-1 border border-neutral-200 rounded-lg overflow-hidden max-h-36 overflow-y-auto bg-white">
                                {agentesDisponiblesRegla.slice(0, 15).map(u => (
                                  <button
                                    key={u.id}
                                    onClick={() => { setAddingReglaUserId(u.id); setSearchAgente(u.nombre_completo); }}
                                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-neutral-50 text-left transition-colors ${addingReglaUserId === u.id ? 'bg-neutral-50 font-medium' : ''}`}
                                  >
                                    {addingReglaUserId === u.id && <Check className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />}
                                    <span className="truncate">{u.nombre_completo}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-neutral-600 mb-1">Asignar a</label>
                            <select
                              value={addingReglaEjecutivoId}
                              onChange={e => setAddingReglaEjecutivoId(e.target.value)}
                              className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-neutral-900 outline-none bg-white"
                            >
                              <option value="">Pool del equipo</option>
                              {ejecutivosEquipo.map(e => (
                                <option key={e.usuario_id} value={e.usuario_id}>{e.nombre_completo}</option>
                              ))}
                            </select>
                          </div>
                          <button
                            onClick={handleAddRegla}
                            disabled={!addingReglaUserId || savingRegla}
                            className="w-full flex items-center justify-center gap-2 py-2 bg-neutral-900 text-white text-sm font-semibold rounded-xl hover:bg-neutral-700 disabled:opacity-40 transition-colors"
                          >
                            {savingRegla && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            Guardar regla
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowAddRegla(true)}
                          className="flex items-center gap-2 w-full px-4 py-2.5 rounded-xl border border-dashed border-neutral-300 text-sm text-neutral-500 hover:border-neutral-400 hover:text-neutral-700 transition-all"
                        >
                          <Plus className="w-4 h-4" /> Agregar regla
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
