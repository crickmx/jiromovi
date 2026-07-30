import { useEffect, useMemo, useState } from 'react';
import { X, Save, Loader as Loader2, ChevronDown, ShieldCheck, Info } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { invalidateModuleVisibilityCache } from '../../lib/useModuleVisibility';
import { invalidateRolesCache, ROLES_BASE, ROL_BASE_LABEL, type Rol, type RolBase } from '../../hooks/useRoles';
import { TOP_LEVEL_ITEMS, WORKSPACES } from '../../lib/workspaceConfig';

interface ModuleRow { key: string; label: string; workspace: string; }

// Lista plana de módulos del sidebar (mismo origen que ModulosAdmin).
function buildModuleList(): ModuleRow[] {
  const rows: ModuleRow[] = [];
  for (const item of TOP_LEVEL_ITEMS) rows.push({ key: item.path, label: item.label, workspace: 'Principal' });
  for (const ws of WORKSPACES) for (const item of ws.items) rows.push({ key: item.path, label: item.label, workspace: ws.label });
  const seen = new Set<string>();
  return rows.filter((r) => { if (seen.has(r.key)) return false; seen.add(r.key); return true; });
}
const ALL_MODULES = buildModuleList();
const WORKSPACE_ORDER = ['Principal', ...WORKSPACES.map((w) => w.label)];

type PermState = 'hereda' | 'visible' | 'oculto';

const PRESET_COLORS = ['#d63f45', '#c9820a', '#0d7a84', '#2f6ff0', '#8250e6', '#d64f77', '#109aa6', '#6b7a90', '#1f9d57'];

interface Props {
  rol: Rol | null;            // null = crear
  onClose: () => void;
  onSaved: () => void;
}

export default function RolModal({ rol, onClose, onSaved }: Props) {
  const esEdicion = !!rol;
  const [nombre, setNombre] = useState(rol?.nombre ?? '');
  const [descripcion, setDescripcion] = useState(rol?.descripcion ?? '');
  const [color, setColor] = useState(rol?.color ?? '#6b7a90');
  const [rolBase, setRolBase] = useState<RolBase>(rol?.rol_base ?? 'Empleado');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Permisos de módulos por rol (target_type = 'rol_id')
  const [perms, setPerms] = useState<Record<string, PermState>>({});
  const [permsBaseline, setPermsBaseline] = useState<Record<string, { id: string; visible: boolean }>>({});
  const [permsExpanded, setPermsExpanded] = useState(false);
  const [expandedWs, setExpandedWs] = useState<Set<string>>(new Set());

  const baseEsAdmin = rolBase === 'Administrador';

  useEffect(() => {
    if (!rol) return;
    (async () => {
      const { data } = await supabase
        .from('module_visibility')
        .select('id, module_key, visible')
        .eq('target_type', 'rol_id')
        .eq('target_value', rol.id);
      const p: Record<string, PermState> = {};
      const base: Record<string, { id: string; visible: boolean }> = {};
      for (const r of data ?? []) {
        p[r.module_key] = r.visible ? 'visible' : 'oculto';
        base[r.module_key] = { id: r.id, visible: r.visible };
      }
      setPerms(p);
      setPermsBaseline(base);
    })();
  }, [rol]);

  const modulesByWs = useMemo(() => {
    const m = new Map<string, ModuleRow[]>();
    for (const mod of ALL_MODULES) {
      if (!m.has(mod.workspace)) m.set(mod.workspace, []);
      m.get(mod.workspace)!.push(mod);
    }
    return m;
  }, []);

  const setPerm = (key: string, state: PermState) => setPerms((prev) => ({ ...prev, [key]: state }));

  const handleSave = async () => {
    if (!nombre.trim()) { setError('El nombre del rol es obligatorio.'); return; }
    setSaving(true);
    setError(null);
    try {
      let rolId = rol?.id;

      if (esEdicion) {
        const { error: e } = await supabase
          .from('roles')
          .update({ nombre: nombre.trim(), descripcion: descripcion.trim() || null, color, rol_base: rolBase })
          .eq('id', rol!.id);
        if (e) throw e;
      } else {
        const { data, error: e } = await supabase
          .from('roles')
          .insert({ nombre: nombre.trim(), descripcion: descripcion.trim() || null, color, rol_base: rolBase, es_sistema: false })
          .select('id')
          .single();
        if (e) throw e;
        rolId = data!.id;
      }

      // Aplicar permisos de módulos (solo si la base no es Administrador — ese siempre ve todo)
      if (rolId && !baseEsAdmin) {
        for (const mod of ALL_MODULES) {
          const state = perms[mod.key] ?? 'hereda';
          const existing = permsBaseline[mod.key];
          if (state === 'hereda') {
            if (existing) await supabase.from('module_visibility').delete().eq('id', existing.id);
          } else {
            const visible = state === 'visible';
            if (existing) {
              if (existing.visible !== visible) await supabase.from('module_visibility').update({ visible }).eq('id', existing.id);
            } else {
              await supabase.from('module_visibility').insert({ module_key: mod.key, target_type: 'rol_id', target_value: rolId, visible });
            }
          }
        }
      }

      invalidateRolesCache();
      invalidateModuleVisibilityCache();
      onSaved();
    } catch (e: any) {
      setError(e?.message?.includes('duplicate') || e?.code === '23505'
        ? 'Ya existe un rol con ese nombre.'
        : (e?.message ?? 'Error al guardar el rol.'));
    } finally {
      setSaving(false);
    }
  };

  const toggleWs = (ws: string) => setExpandedWs((prev) => {
    const n = new Set(prev);
    n.has(ws) ? n.delete(ws) : n.add(ws);
    return n;
  });

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 dark:border-white/10">
          <h2 className="text-base font-bold text-neutral-900 dark:text-white">
            {esEdicion ? 'Editar rol' : 'Nuevo rol'}
          </h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-white/70 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {error && (
            <div className="px-4 py-3 rounded-lg text-sm bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/20">
              {error}
            </div>
          )}

          <div>
            <label className="block text-[11px] font-medium text-neutral-500 dark:text-white/40 uppercase tracking-wider mb-1.5">Nombre del rol</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Coordinador de Mesa"
              className="w-full px-3 py-2 text-sm bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all text-neutral-700 dark:text-white/80"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-neutral-500 dark:text-white/40 uppercase tracking-wider mb-1.5">Descripción</label>
            <input
              type="text"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Para qué sirve este rol"
              className="w-full px-3 py-2 text-sm bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all text-neutral-700 dark:text-white/80"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-neutral-500 dark:text-white/40 uppercase tracking-wider mb-1.5">Color</label>
            <div className="flex items-center gap-2 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full border-2 transition-transform ${color === c ? 'border-neutral-900 dark:border-white scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                  aria-label={`Color ${c}`}
                />
              ))}
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-7 h-7 rounded cursor-pointer bg-transparent border border-neutral-200 dark:border-white/10" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-neutral-500 dark:text-white/40 uppercase tracking-wider mb-1.5">
              Comportamiento base (hereda permisos de)
            </label>
            <select
              value={rolBase}
              onChange={(e) => setRolBase(e.target.value as RolBase)}
              className="w-full px-3 py-2 text-sm bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all text-neutral-700 dark:text-white/80"
            >
              {ROLES_BASE.map((b) => (
                <option key={b} value={b}>{ROL_BASE_LABEL[b]}</option>
              ))}
            </select>
            <p className="text-xs text-neutral-500 dark:text-white/40 mt-1.5 flex gap-1.5">
              <Info className="w-3.5 h-3.5 flex-none mt-0.5" />
              El rol se comporta como esta base en toda la plataforma. Afínalo abajo con los permisos de módulos.
            </p>
          </div>

          {/* Permisos de módulos inline */}
          <div className="border border-neutral-200 dark:border-white/10 rounded-lg">
            <button
              type="button"
              onClick={() => setPermsExpanded((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-neutral-800 dark:text-white/80"
            >
              <span className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-accent" /> Permisos de módulos</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${permsExpanded ? 'rotate-180' : ''}`} />
            </button>

            {permsExpanded && (
              <div className="px-4 pb-4 border-t border-neutral-200 dark:border-white/10 pt-3">
                {baseEsAdmin ? (
                  <p className="text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg px-3 py-2.5">
                    Un rol con base <b>Administrador</b> siempre ve todos los módulos (para no bloquearte de la administración). Si quieres un rol de admin recortado, usa la base <b>Gerente</b>.
                  </p>
                ) : (
                  <>
                    <p className="text-xs text-neutral-500 dark:text-white/40 mb-3">
                      Por defecto cada módulo <b>hereda</b> de la base. Cámbialo solo donde quieras forzar mostrar u ocultar para este rol.
                    </p>
                    <div className="space-y-2">
                      {WORKSPACE_ORDER.filter((ws) => modulesByWs.has(ws)).map((ws) => (
                        <div key={ws} className="border border-neutral-200 dark:border-white/10 rounded-lg overflow-hidden">
                          <button type="button" onClick={() => toggleWs(ws)} className="w-full flex items-center justify-between px-3 py-2 bg-neutral-50 dark:bg-white/5 text-xs font-semibold text-neutral-700 dark:text-white/70">
                            <span>{ws}</span>
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expandedWs.has(ws) ? 'rotate-180' : ''}`} />
                          </button>
                          {expandedWs.has(ws) && (
                            <div className="divide-y divide-neutral-100 dark:divide-white/5">
                              {modulesByWs.get(ws)!.map((mod) => {
                                const state = perms[mod.key] ?? 'hereda';
                                return (
                                  <div key={mod.key} className="flex items-center justify-between gap-3 px-3 py-2">
                                    <span className="text-sm text-neutral-700 dark:text-white/70 truncate">{mod.label}</span>
                                    <div className="flex-none inline-flex rounded-md overflow-hidden border border-neutral-200 dark:border-white/10 text-[11px] font-medium">
                                      {(['hereda', 'visible', 'oculto'] as PermState[]).map((s) => (
                                        <button
                                          key={s}
                                          type="button"
                                          onClick={() => setPerm(mod.key, s)}
                                          className={`px-2.5 py-1 transition-colors ${
                                            state === s
                                              ? s === 'visible' ? 'bg-emerald-500 text-white'
                                                : s === 'oculto' ? 'bg-red-500 text-white'
                                                : 'bg-neutral-400 dark:bg-white/20 text-white'
                                              : 'bg-white dark:bg-transparent text-neutral-500 dark:text-white/50 hover:bg-neutral-100 dark:hover:bg-white/10'
                                          }`}
                                        >
                                          {s === 'hereda' ? 'Hereda' : s === 'visible' ? 'Ve' : 'Oculto'}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="px-5 py-4 bg-neutral-50 dark:bg-white/3 rounded-b-xl border-t border-neutral-200 dark:border-white/10 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-neutral-600 dark:text-white/60 hover:text-neutral-800 dark:hover:text-white/80 transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 inline-flex items-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Guardando...' : esEdicion ? 'Guardar cambios' : 'Crear rol'}
          </button>
        </div>
      </div>
    </div>
  );
}
