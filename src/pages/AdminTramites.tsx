import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Settings2, MapPin, Users, Eye, Shuffle, Plus, Pencil, Trash2,
  Check, X, Loader2, AlertTriangle, RefreshCw, ArrowRight,
  ToggleLeft, ToggleRight, ChevronDown, FileText,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { GestionGruposVisualizacion } from '../components/tramites/GestionGruposVisualizacion';

// ─── Types ────────────────────────────────────────────────────────────────────

type TabId = 'areas' | 'equipos' | 'visibilidad' | 'reglas';

interface Area {
  id: string; nombre: string; slug: string; color_hex: string; activa: boolean;
  equipo_count: number; tipo_count: number;
}

interface TipoTramite {
  id: string; value: string; label: string;
  area_id: string | null; color: string; activo: boolean;
}

interface Equipo {
  id: string; nombre: string; color: string; area_categoria: string | null; activo: boolean;
}

interface TipoConfig {
  team_id: string; tipo_id: string; habilitado: boolean;
}

interface TipoPermiso {
  id: string; equipo_id: string; tramite_tipo_id: string;
  puede_ver: boolean | null; puede_crear: boolean | null; puede_editar: boolean | null;
}

interface Regla {
  id: string; grupo_id: string; grupo_nombre: string; grupo_color: string;
  usuario_id: string; usuario_nombre: string;
  ejecutivo_id: string | null; ejecutivo_nombre: string | null;
  area: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toast(msg: string, type: 'ok' | 'err' = 'ok') {
  const el = document.createElement('div');
  el.className = [
    'fixed bottom-6 right-6 z-[9999] flex items-center gap-2.5 px-4 py-3',
    'rounded-xl shadow-xl text-sm font-medium text-white transition-opacity',
    type === 'ok' ? 'bg-neutral-900' : 'bg-red-600',
  ].join(' ');
  el.innerHTML = type === 'ok'
    ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>${msg}`
    : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>${msg}`;
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 3500);
}

const toSlug = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '_');

const COLOR_PALETTE = [
  '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899',
  '#ef4444', '#f97316', '#f59e0b', '#22c55e',
  '#14b8a6', '#0ea5e9', '#64748b', '#a855f7',
];

const TABS: { id: TabId; label: string; icon: React.ElementType; desc: string }[] = [
  { id: 'areas',       label: 'Áreas',       icon: MapPin,    desc: 'Categorías de trámites' },
  { id: 'equipos',     label: 'Equipos',     icon: Users,     desc: 'Grupos de trabajo' },
  { id: 'visibilidad', label: 'Visibilidad', icon: Eye,       desc: 'Permisos por equipo' },
  { id: 'reglas',      label: 'Reglas',      icon: Shuffle,   desc: 'Asignación automática' },
];

// ─── TriToggle ────────────────────────────────────────────────────────────────

function TriToggle({
  value, onChange, disabled,
}: { value: boolean | null; onChange: (v: boolean | null) => void; disabled?: boolean }) {
  const cycle = () => {
    if (disabled) return;
    if (value === null) onChange(true);
    else if (value === true) onChange(false);
    else onChange(null);
  };
  return (
    <button
      onClick={cycle}
      disabled={disabled}
      title={value === null ? 'Hereda del rol' : value ? 'Permitido (override)' : 'Denegado (override)'}
      className={[
        'w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold border transition-colors',
        value === null  ? 'bg-neutral-50 border-neutral-200 text-neutral-400 hover:bg-neutral-100' : '',
        value === true  ? 'bg-green-50 border-green-200 text-green-600 hover:bg-green-100' : '',
        value === false ? 'bg-red-50 border-red-200 text-red-500 hover:bg-red-100' : '',
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
      ].join(' ')}
    >
      {value === null ? '—' : value ? '✓' : '✗'}
    </button>
  );
}

// ─── AreasTab ─────────────────────────────────────────────────────────────────

function AreasTab() {
  const { usuario } = useAuth();
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [editing, setEditing] = useState<Area | null>(null);
  const [fNombre, setFNombre] = useState('');
  const [fColor, setFColor] = useState('#3b82f6');
  const [fActiva, setFActiva] = useState(true);
  const [saving, setSaving] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);
  const colorRef = useRef<HTMLDivElement>(null);
  const [confirmDel, setConfirmDel] = useState<Area | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (colorRef.current && !colorRef.current.contains(e.target as Node)) setColorOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: areasData } = await supabase
      .from('tramites_areas')
      .select('id, nombre, slug, color_hex, activa')
      .order('nombre');

    if (!areasData) { setLoading(false); return; }

    const [equiposRes, tiposRes] = await Promise.all([
      supabase.from('tramites_grupos_visualizacion').select('area_id').not('area_id', 'is', null),
      supabase.from('ticket_tipos').select('area_id').not('area_id', 'is', null),
    ]);

    const equipoCount: Record<string, number> = {};
    (equiposRes.data || []).forEach((r: { area_id: string }) => {
      equipoCount[r.area_id] = (equipoCount[r.area_id] || 0) + 1;
    });

    const tipoCount: Record<string, number> = {};
    (tiposRes.data || []).forEach((r: { area_id: string }) => {
      tipoCount[r.area_id] = (tipoCount[r.area_id] || 0) + 1;
    });

    setAreas(areasData.map(a => ({
      ...a,
      equipo_count: equipoCount[a.id] || 0,
      tipo_count: tipoCount[a.id] || 0,
    })));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setFNombre('');
    setFColor('#3b82f6');
    setFActiva(true);
    setModal('create');
  };

  const openEdit = (a: Area) => {
    setEditing(a);
    setFNombre(a.nombre);
    setFColor(a.color_hex);
    setFActiva(a.activa);
    setModal('edit');
  };

  const handleSave = async () => {
    if (!fNombre.trim()) return;
    setSaving(true);
    const payload = { nombre: fNombre.trim(), slug: toSlug(fNombre.trim()), color_hex: fColor, activa: fActiva };
    if (modal === 'edit' && editing) {
      const { error } = await supabase.from('tramites_areas').update(payload).eq('id', editing.id);
      if (error) { toast('Error al guardar: ' + error.message, 'err'); setSaving(false); return; }
      toast('Área actualizada');
    } else {
      const { error } = await supabase.from('tramites_areas').insert({ ...payload, updated_by: usuario?.id });
      if (error) { toast('Error al crear: ' + error.message, 'err'); setSaving(false); return; }
      toast('Área creada');
    }
    setSaving(false);
    setModal(null);
    load();
  };

  const handleToggleActiva = async (a: Area) => {
    await supabase.from('tramites_areas').update({ activa: !a.activa }).eq('id', a.id);
    setAreas(prev => prev.map(x => x.id === a.id ? { ...x, activa: !a.activa } : x));
  };

  const handleDelete = async () => {
    if (!confirmDel) return;
    setDeleting(true);
    const { error } = await supabase.from('tramites_areas').delete().eq('id', confirmDel.id);
    if (error) { toast('No se puede eliminar: ' + error.message, 'err'); }
    else { toast('Área eliminada'); }
    setConfirmDel(null);
    setDeleting(false);
    load();
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 rounded-2xl bg-neutral-100 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-neutral-500">
            Las áreas agrupan los tipos de trámite y equipos en categorías de trabajo.
          </p>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-neutral-900 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-neutral-700 transition-colors flex-shrink-0"
          >
            <Plus className="w-4 h-4" /> Nueva área
          </button>
        </div>

        {areas.length === 0 ? (
          <div className="text-center py-16 bg-neutral-50 rounded-2xl border-2 border-dashed border-neutral-200">
            <MapPin className="w-10 h-10 mx-auto text-neutral-300 mb-2" />
            <p className="text-sm text-neutral-500">No hay áreas creadas. Crea la primera.</p>
          </div>
        ) : (
          <div className="border border-neutral-200 rounded-2xl overflow-hidden divide-y divide-neutral-100">
            {areas.map(a => (
              <div key={a.id} className={`flex items-center gap-4 px-5 py-4 bg-white hover:bg-neutral-50 transition-colors ${!a.activa ? 'opacity-60' : ''}`}>
                <div
                  className="w-4 h-10 rounded-full flex-shrink-0"
                  style={{ backgroundColor: a.color_hex }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-neutral-900 text-sm">{a.nombre}</span>
                    {!a.activa && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-500 font-medium">Inactiva</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-neutral-400 font-mono">{a.slug}</span>
                    <span className="text-xs text-neutral-400">{a.equipo_count} equipo{a.equipo_count !== 1 ? 's' : ''}</span>
                    <span className="text-xs text-neutral-400">{a.tipo_count} tipo{a.tipo_count !== 1 ? 's' : ''}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleToggleActiva(a)}
                    className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700 transition-colors"
                    title={a.activa ? 'Desactivar' : 'Activar'}
                  >
                    {a.activa ? <ToggleRight className="w-4 h-4 text-green-600" /> : <ToggleLeft className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => openEdit(a)}
                    className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700 transition-colors"
                    title="Editar"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setConfirmDel(a)}
                    disabled={a.equipo_count > 0 || a.tipo_count > 0}
                    className="p-2 rounded-lg hover:bg-red-50 text-neutral-400 hover:text-red-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title={a.equipo_count > 0 || a.tipo_count > 0 ? 'No se puede eliminar: tiene equipos o tipos asignados' : 'Eliminar'}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Form modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-neutral-900">{modal === 'edit' ? 'Editar área' : 'Nueva área'}</h3>
              <button onClick={() => setModal(null)} className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-500"><X className="w-4 h-4" /></button>
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-1.5">Nombre *</label>
              <div className="flex gap-2">
                {/* Color picker */}
                <div className="relative flex-shrink-0" ref={colorRef}>
                  <button
                    type="button"
                    onClick={() => setColorOpen(v => !v)}
                    className="w-10 h-10 rounded-xl border-2 border-neutral-200 hover:border-neutral-400 transition-colors"
                    style={{ backgroundColor: fColor }}
                  />
                  {colorOpen && (
                    <div className="absolute top-full left-0 mt-2 z-30 bg-white border border-neutral-200 rounded-xl shadow-xl p-3 w-48">
                      <p className="text-[10px] text-neutral-400 uppercase tracking-wider mb-2">Color</p>
                      <div className="grid grid-cols-6 gap-1.5 mb-3">
                        {COLOR_PALETTE.map(c => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => { setFColor(c); setColorOpen(false); }}
                            className="w-6 h-6 rounded-lg hover:scale-110 transition-transform"
                            style={{ backgroundColor: c, outline: fColor === c ? `2px solid ${c}` : 'none', outlineOffset: '2px' }}
                          />
                        ))}
                      </div>
                      <input type="color" value={fColor} onChange={e => setFColor(e.target.value)}
                        className="w-full h-7 rounded cursor-pointer border-0 p-0 bg-transparent" />
                    </div>
                  )}
                </div>
                <input
                  autoFocus
                  type="text"
                  value={fNombre}
                  onChange={e => setFNombre(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSave()}
                  placeholder="Ej. Comercial, Operaciones..."
                  className="flex-1 px-3 py-2.5 border border-neutral-300 rounded-xl text-sm focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900 outline-none"
                />
              </div>
              {fNombre && (
                <p className="text-xs text-neutral-400 mt-1 font-mono">slug: {toSlug(fNombre)}</p>
              )}
            </div>

            <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl">
              <div>
                <p className="text-sm font-semibold text-neutral-700">Activa</p>
                <p className="text-xs text-neutral-500">Solo las áreas activas aparecen en filtros</p>
              </div>
              <button
                type="button"
                onClick={() => setFActiva(v => !v)}
                className={`relative w-11 h-6 rounded-full transition-colors ${fActiva ? 'bg-green-500' : 'bg-neutral-300'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${fActiva ? 'translate-x-5' : ''}`} />
              </button>
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <button onClick={() => setModal(null)} className="px-4 py-2 text-sm rounded-xl border border-neutral-200 hover:bg-neutral-50">Cancelar</button>
              <button
                onClick={handleSave}
                disabled={saving || !fNombre.trim()}
                className="px-4 py-2 text-sm rounded-xl bg-neutral-900 text-white hover:bg-neutral-700 disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {modal === 'edit' ? 'Guardar cambios' : 'Crear área'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {confirmDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-red-50 rounded-xl"><Trash2 className="w-5 h-5 text-red-600" /></div>
              <div>
                <h3 className="font-bold text-neutral-900">Eliminar área</h3>
                <p className="text-sm text-neutral-500">"{confirmDel.nombre}"</p>
              </div>
            </div>
            <p className="text-sm text-neutral-600 mb-4">¿Seguro? Esta acción no se puede deshacer.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmDel(null)} className="px-4 py-2 text-sm rounded-xl border border-neutral-200 hover:bg-neutral-50">Cancelar</button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm rounded-xl bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
              >
                {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── VisibilidadTab ───────────────────────────────────────────────────────────

function VisibilidadTab() {
  const { usuario } = useAuth();
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [tipos, setTipos] = useState<TipoTramite[]>([]);
  const [selectedEquipoId, setSelectedEquipoId] = useState<string | null>(null);
  const [configs, setConfigs] = useState<Record<string, TipoConfig>>({});
  const [permisos, setPermisos] = useState<Record<string, TipoPermiso>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [equipoDropOpen, setEquipoDropOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setEquipoDropOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  useEffect(() => {
    const loadBase = async () => {
      const [eq, ti] = await Promise.all([
        supabase.from('tramites_grupos_visualizacion').select('id, nombre, color, area_categoria, activo').eq('activo', true).order('nombre'),
        supabase.from('ticket_tipos').select('id, value, label, area_id, color, activo').eq('activo', true).order('label'),
      ]);
      setEquipos((eq.data || []) as Equipo[]);
      setTipos((ti.data || []) as TipoTramite[]);
      setLoading(false);
    };
    loadBase();
  }, []);

  useEffect(() => {
    if (!selectedEquipoId) return;
    const loadPermisos = async () => {
      const [cfgRes, permRes] = await Promise.all([
        supabase.from('tramite_team_tipo_config').select('team_id, tipo_id, habilitado').eq('team_id', selectedEquipoId),
        supabase.from('tramite_equipo_tipo_permisos').select('*').eq('equipo_id', selectedEquipoId),
      ]);
      const cfgMap: Record<string, TipoConfig> = {};
      (cfgRes.data || []).forEach((c: TipoConfig) => { cfgMap[c.tipo_id] = c; });
      const permMap: Record<string, TipoPermiso> = {};
      (permRes.data || []).forEach((p: TipoPermiso) => { permMap[p.tramite_tipo_id] = p; });
      setConfigs(cfgMap);
      setPermisos(permMap);
    };
    loadPermisos();
  }, [selectedEquipoId]);

  const handleToggleConfig = async (tipoId: string, habilitado: boolean) => {
    if (!selectedEquipoId) return;
    setSaving(`cfg_${tipoId}`);
    await supabase.from('tramite_team_tipo_config')
      .upsert({ team_id: selectedEquipoId, tipo_id: tipoId, habilitado, updated_by: usuario?.id }, { onConflict: 'team_id,tipo_id' });
    setConfigs(prev => ({ ...prev, [tipoId]: { team_id: selectedEquipoId, tipo_id: tipoId, habilitado } }));
    setSaving(null);
  };

  const handlePermiso = async (tipoId: string, campo: 'puede_ver' | 'puede_crear' | 'puede_editar', valor: boolean | null) => {
    if (!selectedEquipoId) return;
    setSaving(`${campo}_${tipoId}`);
    const existing = permisos[tipoId];
    const patch = { equipo_id: selectedEquipoId, tramite_tipo_id: tipoId, [campo]: valor, updated_by: usuario?.id };
    if (existing) {
      await supabase.from('tramite_equipo_tipo_permisos').update({ [campo]: valor, updated_by: usuario?.id }).eq('id', existing.id);
      setPermisos(prev => ({ ...prev, [tipoId]: { ...prev[tipoId], [campo]: valor } }));
    } else {
      const { data } = await supabase.from('tramite_equipo_tipo_permisos').insert(patch).select('*').single();
      if (data) setPermisos(prev => ({ ...prev, [tipoId]: data as TipoPermiso }));
    }
    setSaving(null);
  };

  const selectedEquipo = equipos.find(e => e.id === selectedEquipoId);

  if (loading) {
    return <div className="h-40 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-neutral-400" /></div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-neutral-500 max-w-xl">
          Configura qué tipos de trámite puede <strong>ver, crear y editar</strong> cada equipo.
          Los valores <span className="font-mono text-xs bg-neutral-100 px-1 rounded">—</span> heredan del rol del usuario.
        </p>
        {/* Equipo selector */}
        <div className="relative flex-shrink-0" ref={dropRef}>
          <button
            onClick={() => setEquipoDropOpen(v => !v)}
            className="flex items-center gap-2 px-4 py-2.5 border border-neutral-200 rounded-xl text-sm hover:border-neutral-400 transition-colors bg-white min-w-[200px] justify-between"
          >
            {selectedEquipo ? (
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: selectedEquipo.color }} />
                <span className="font-medium text-neutral-900 truncate max-w-[150px]">{selectedEquipo.nombre}</span>
              </span>
            ) : (
              <span className="text-neutral-400">Selecciona un equipo…</span>
            )}
            <ChevronDown className="w-4 h-4 text-neutral-400 flex-shrink-0" />
          </button>
          {equipoDropOpen && (
            <div className="absolute top-full right-0 mt-1.5 z-30 bg-white border border-neutral-200 rounded-xl shadow-xl w-64 py-1 max-h-64 overflow-y-auto">
              {equipos.map(e => (
                <button
                  key={e.id}
                  onClick={() => { setSelectedEquipoId(e.id); setEquipoDropOpen(false); }}
                  className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-neutral-50 transition-colors text-left ${selectedEquipoId === e.id ? 'bg-neutral-50' : ''}`}
                >
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: e.color }} />
                  <span className="flex-1 truncate font-medium text-neutral-800">{e.nombre}</span>
                  {e.area_categoria && <span className="text-[11px] text-neutral-400 flex-shrink-0">{e.area_categoria}</span>}
                  {selectedEquipoId === e.id && <Check className="w-3.5 h-3.5 text-neutral-600 flex-shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {!selectedEquipoId ? (
        <div className="text-center py-16 bg-neutral-50 rounded-2xl border-2 border-dashed border-neutral-200">
          <Eye className="w-10 h-10 mx-auto text-neutral-300 mb-2" />
          <p className="text-sm text-neutral-500">Selecciona un equipo para configurar sus permisos.</p>
        </div>
      ) : (
        <div className="border border-neutral-200 rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[1fr_80px_88px_88px_88px] gap-0 bg-neutral-50 border-b border-neutral-200 px-5 py-3">
            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wide">Tipo de trámite</span>
            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wide text-center">Habilitado</span>
            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wide text-center">Ver</span>
            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wide text-center">Crear</span>
            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wide text-center">Editar</span>
          </div>

          {tipos.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-neutral-400">No hay tipos de trámite activos.</div>
          ) : (
            <div className="divide-y divide-neutral-100">
              {tipos.map(t => {
                const cfg = configs[t.id];
                const perm = permisos[t.id];
                const habilitado = cfg ? cfg.habilitado : true;
                const savingKey = (campo: string) => saving === `${campo}_${t.id}`;
                return (
                  <div key={t.id} className={`grid grid-cols-[1fr_80px_88px_88px_88px] gap-0 px-5 py-3 items-center hover:bg-neutral-50 transition-colors ${!habilitado ? 'opacity-50' : ''}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: t.color || '#94a3b8' }} />
                      <span className="text-sm font-medium text-neutral-800 truncate">{t.label}</span>
                    </div>
                    {/* Habilitado toggle */}
                    <div className="flex justify-center">
                      <button
                        onClick={() => handleToggleConfig(t.id, !habilitado)}
                        disabled={saving === `cfg_${t.id}`}
                        className="p-1.5 rounded-lg transition-colors"
                        title={habilitado ? 'Deshabilitar para este equipo' : 'Habilitar para este equipo'}
                      >
                        {saving === `cfg_${t.id}`
                          ? <Loader2 className="w-4 h-4 animate-spin text-neutral-400" />
                          : habilitado
                            ? <ToggleRight className="w-5 h-5 text-green-500" />
                            : <ToggleLeft className="w-5 h-5 text-neutral-400" />
                        }
                      </button>
                    </div>
                    {/* Permission tri-toggles */}
                    {(['puede_ver', 'puede_crear', 'puede_editar'] as const).map(campo => (
                      <div key={campo} className="flex justify-center">
                        {savingKey(campo)
                          ? <div className="w-8 h-8 flex items-center justify-center"><Loader2 className="w-3.5 h-3.5 animate-spin text-neutral-400" /></div>
                          : <TriToggle
                              value={perm?.[campo] ?? null}
                              onChange={v => handlePermiso(t.id, campo, v)}
                              disabled={!habilitado}
                            />
                        }
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}

          <div className="px-5 py-3 bg-neutral-50 border-t border-neutral-100 flex items-center gap-4 text-xs text-neutral-400">
            <span><strong className="text-neutral-600">Habilitado</strong>: el equipo puede acceder a este tipo</span>
            <span><span className="font-mono bg-neutral-200 px-1 rounded text-neutral-500">—</span> Hereda del rol</span>
            <span><span className="font-mono bg-green-50 text-green-600 px-1 rounded border border-green-200">✓</span> Override: permitido</span>
            <span><span className="font-mono bg-red-50 text-red-500 px-1 rounded border border-red-200">✗</span> Override: denegado</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ReglasTab ────────────────────────────────────────────────────────────────

function ReglasTab({ onGoToEquipos }: { onGoToEquipos: () => void }) {
  const [reglas, setReglas] = useState<Regla[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('tramites_grupos_reglas')
        .select(`
          id, usuario_id, ejecutivo_id, area, activo,
          grupo:tramites_grupos_visualizacion!grupo_id(id, nombre, color),
          agente:usuarios!usuario_id(id, nombre_completo),
          ejecutivo:usuarios!ejecutivo_id(id, nombre_completo)
        `)
        .eq('activo', true)
        .order('area');

      if (data) {
        setReglas(data.map((r: Record<string, unknown>) => {
          const grupo = r.grupo as { id: string; nombre: string; color: string } | null;
          const agente = r.agente as { nombre_completo: string } | null;
          const ejecutivo = r.ejecutivo as { id: string; nombre_completo: string } | null;
          return {
            id: r.id as string,
            grupo_id: grupo?.id || '',
            grupo_nombre: grupo?.nombre || '—',
            grupo_color: grupo?.color || '#94a3b8',
            usuario_id: r.usuario_id as string,
            usuario_nombre: agente?.nombre_completo || r.usuario_id as string,
            ejecutivo_id: r.ejecutivo_id as string | null,
            ejecutivo_nombre: ejecutivo?.nombre_completo || null,
            area: r.area as string | null,
          };
        }));
      }
      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return <div className="h-40 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-neutral-400" /></div>;
  }

  // Group by equipo
  const byEquipo = reglas.reduce<Record<string, Regla[]>>((acc, r) => {
    (acc[r.grupo_id] = acc[r.grupo_id] || []).push(r);
    return acc;
  }, {});

  if (Object.keys(byEquipo).length === 0) {
    return (
      <div className="text-center py-16 bg-neutral-50 rounded-2xl border-2 border-dashed border-neutral-200">
        <Shuffle className="w-10 h-10 mx-auto text-neutral-300 mb-2" />
        <p className="text-sm text-neutral-500 mb-3">No hay reglas de asignación configuradas.</p>
        <button
          onClick={onGoToEquipos}
          className="inline-flex items-center gap-2 text-sm font-medium text-neutral-700 hover:text-neutral-900 border border-neutral-200 rounded-xl px-4 py-2 hover:bg-neutral-50 transition-colors"
        >
          <Users className="w-4 h-4" /> Ir a Equipos para configurarlas
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-neutral-500">
          Vista global de todas las reglas de auto-asignación. Para editar, abre el equipo desde la pestaña Equipos.
        </p>
        <button
          onClick={onGoToEquipos}
          className="flex items-center gap-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 border border-neutral-200 rounded-xl px-3 py-2 hover:bg-neutral-50 transition-colors flex-shrink-0"
        >
          <Users className="w-4 h-4" /> Ir a Equipos
        </button>
      </div>

      <div className="space-y-4">
        {Object.entries(byEquipo).map(([grupoId, reglasGrupo]) => {
          const first = reglasGrupo[0];
          return (
            <div key={grupoId} className="border border-neutral-200 rounded-2xl overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-3 bg-neutral-50 border-b border-neutral-100">
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: first.grupo_color }} />
                <span className="text-sm font-bold text-neutral-800">{first.grupo_nombre}</span>
                <span className="ml-auto text-xs text-neutral-400">{reglasGrupo.length} regla{reglasGrupo.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="divide-y divide-neutral-100">
                {reglasGrupo.map(r => (
                  <div key={r.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-neutral-800">{r.usuario_nombre}</span>
                      {r.area && (
                        <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">{r.area}</span>
                      )}
                    </div>
                    {r.ejecutivo_nombre ? (
                      <div className="flex items-center gap-2 text-sm text-neutral-500 flex-shrink-0">
                        <ArrowRight className="w-3.5 h-3.5" />
                        <span className="font-medium text-neutral-700">{r.ejecutivo_nombre}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-neutral-400 italic flex-shrink-0">Pool del equipo</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── AdminTramites (main) ─────────────────────────────────────────────────────

export default function AdminTramites() {
  const { usuario } = useAuth();
  const [tab, setTab] = useState<TabId>('areas');

  if (usuario && !['Administrador', 'Gerente'].includes(usuario.rol)) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="text-center">
          <Settings2 className="w-12 h-12 mx-auto text-neutral-300 mb-3" />
          <p className="text-neutral-500 font-medium">Solo administradores pueden acceder a esta sección.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8 max-w-6xl mx-auto space-y-6">
      <PageHeader
        icon={Settings2}
        title="Admin › Trámites"
        description="Configura las áreas, equipos, permisos de visibilidad y reglas de asignación automática."
        backTo="/configuracion/hub"
        backLabel="Configuración"
      />

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-neutral-200">
        {TABS.map(({ id, label, icon: Icon, desc }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={[
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px',
              tab === id
                ? 'text-neutral-900 border-neutral-900'
                : 'text-neutral-500 border-transparent hover:text-neutral-700 hover:border-neutral-300',
            ].join(' ')}
          >
            <Icon className="w-4 h-4" />
            {label}
            <span className="hidden sm:inline text-xs text-neutral-400 font-normal">— {desc}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {tab === 'areas'       && <AreasTab />}
        {tab === 'equipos'     && <GestionGruposVisualizacion />}
        {tab === 'visibilidad' && <VisibilidadTab />}
        {tab === 'reglas'      && <ReglasTab onGoToEquipos={() => setTab('equipos')} />}
      </div>
    </div>
  );
}
