import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { invalidateModuleVisibilityCache } from '../../lib/useModuleVisibility';
import { invalidateRolesCache, type Rol, type RolBase } from '../../hooks/useRoles';
import {
  Plus, Pencil, Trash2, GitMerge, Loader as Loader2, X, Users, ShieldAlert, AlertTriangle,
} from 'lucide-react';
import RolModal from './RolModal';

const BASE_HINT: Record<RolBase, string> = {
  Administrador: 'Acceso total',
  Gerente: 'Admin de oficina/equipos',
  Empleado: 'Interno operativo',
  Agente: 'Cliente externo',
};

export default function RolesTab() {
  const [roles, setRoles] = useState<Rol[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const [editing, setEditing] = useState<Rol | null | 'nuevo'>(null);
  const [removing, setRemoving] = useState<{ rol: Rol; mode: 'eliminar' | 'fusionar' } | null>(null);

  const showToast = useCallback((text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 4500);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const [rolesRes, usuariosRes] = await Promise.all([
      supabase.from('roles').select('id, nombre, descripcion, color, rol_base, es_sistema, activo, orden').order('orden').order('nombre'),
      supabase.from('usuarios').select('rol_id'),
    ]);
    setRoles((rolesRes.data ?? []) as Rol[]);
    const c: Record<string, number> = {};
    for (const u of (usuariosRes.data ?? []) as { rol_id: string | null }[]) {
      if (u.rol_id) c[u.rol_id] = (c[u.rol_id] ?? 0) + 1;
    }
    setCounts(c);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const onSaved = useCallback(() => {
    setEditing(null);
    invalidateRolesCache();
    invalidateModuleVisibilityCache();
    showToast('Rol guardado');
    load();
  }, [load, showToast]);

  if (loading) {
    return <div className="flex items-center justify-center py-16 text-neutral-500 dark:text-white/50"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Cargando roles...</div>;
  }

  return (
    <>
      <div className="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <p className="text-sm text-neutral-600 dark:text-white/50">
          Crea, edita, elimina o fusiona roles. Cada rol hereda el comportamiento de una base y se asigna a los usuarios.
        </p>
        <button
          onClick={() => setEditing('nuevo')}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:opacity-90 transition-opacity self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" /> Nuevo rol
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {roles.map((r) => {
          const n = counts[r.id] ?? 0;
          return (
            <div key={r.id} className="border border-neutral-200 dark:border-white/10 rounded-xl p-4 bg-white dark:bg-neutral-800/30" style={{ borderTopColor: r.color ?? undefined, borderTopWidth: 3 }}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="w-2.5 h-2.5 rounded-full flex-none" style={{ backgroundColor: r.color ?? '#6b7a90' }} />
                    <h3 className="text-sm font-semibold text-neutral-900 dark:text-white truncate">{r.nombre}</h3>
                    {r.es_sistema && (
                      <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-neutral-100 dark:bg-white/10 text-neutral-500 dark:text-white/50">base</span>
                    )}
                  </div>
                  {r.descripcion && <p className="text-xs text-neutral-500 dark:text-white/40 mt-1 line-clamp-2">{r.descripcion}</p>}
                  <div className="flex items-center gap-3 mt-2 text-[11px] text-neutral-500 dark:text-white/45">
                    <span title="Comportamiento base" className="inline-flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> {r.rol_base} · {BASE_HINT[r.rol_base]}</span>
                    <span className="inline-flex items-center gap-1"><Users className="w-3 h-3" /> {n}</span>
                  </div>
                </div>
                <div className="flex-none flex items-center gap-1">
                  <button onClick={() => setEditing(r)} title="Editar" className="p-1.5 rounded-md text-neutral-400 hover:text-accent hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => setRemoving({ rol: r, mode: 'fusionar' })} title="Fusionar en otro rol" className="p-1.5 rounded-md text-neutral-400 hover:text-blue-500 hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors">
                    <GitMerge className="w-4 h-4" />
                  </button>
                  <button onClick={() => setRemoving({ rol: r, mode: 'eliminar' })} title="Eliminar" className="p-1.5 rounded-md text-neutral-400 hover:text-red-500 hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {editing && (
        <RolModal
          rol={editing === 'nuevo' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={onSaved}
        />
      )}

      {removing && (
        <EliminarFusionarRolModal
          rol={removing.rol}
          mode={removing.mode}
          usuariosCount={counts[removing.rol.id] ?? 0}
          roles={roles}
          onClose={() => setRemoving(null)}
          onDone={(msg) => { setRemoving(null); invalidateRolesCache(); invalidateModuleVisibilityCache(); showToast(msg); load(); }}
          onError={(msg) => showToast(msg, 'error')}
        />
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-[60] px-4 py-3 rounded-lg text-sm text-white shadow-lg ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
          {toast.text}
        </div>
      )}
    </>
  );
}

// ── Modal eliminar / fusionar ────────────────────────────────────────────────

function EliminarFusionarRolModal({
  rol, mode, usuariosCount, roles, onClose, onDone, onError,
}: {
  rol: Rol;
  mode: 'eliminar' | 'fusionar';
  usuariosCount: number;
  roles: Rol[];
  onClose: () => void;
  onDone: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const destinos = useMemo(() => roles.filter((r) => r.id !== rol.id), [roles, rol.id]);
  // Fusionar siempre exige destino; eliminar solo si el rol tiene usuarios.
  const destinoRequerido = mode === 'fusionar' || usuariosCount > 0;
  const [destino, setDestino] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    if (destinoRequerido && !destino) { onError('Elige a qué rol reasignar los usuarios.'); return; }
    setSaving(true);
    const { error } = await supabase.rpc('reasignar_y_eliminar_rol', {
      p_origen: rol.id,
      p_destino: destinoRequerido ? destino : null,
    });
    setSaving(false);
    if (error) { onError(error.message ?? 'No se pudo completar la operación.'); return; }
    const destName = destinos.find((d) => d.id === destino)?.nombre;
    onDone(mode === 'fusionar' ? `«${rol.nombre}» fusionado en «${destName}»` : `Rol «${rol.nombre}» eliminado`);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 dark:border-white/10">
          <h2 className="text-base font-bold text-neutral-900 dark:text-white">
            {mode === 'fusionar' ? 'Fusionar rol' : 'Eliminar rol'}
          </h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-white/70"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-start gap-3 text-sm text-neutral-700 dark:text-white/70">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-none mt-0.5" />
            <p>
              {mode === 'fusionar'
                ? <>Vas a fusionar <b>«{rol.nombre}»</b> en otro rol. Sus <b>{usuariosCount}</b> usuario(s) pasarán al rol destino y <b>«{rol.nombre}» se eliminará</b>.</>
                : usuariosCount > 0
                  ? <>El rol <b>«{rol.nombre}»</b> tiene <b>{usuariosCount}</b> usuario(s). Elige a qué rol reasignarlos; luego se eliminará.</>
                  : <>Vas a eliminar el rol <b>«{rol.nombre}»</b>. No tiene usuarios asignados.</>}
            </p>
          </div>

          {destinoRequerido && (
            <div>
              <label className="block text-[11px] font-medium text-neutral-500 dark:text-white/40 uppercase tracking-wider mb-1.5">
                {mode === 'fusionar' ? 'Fusionar en' : 'Reasignar usuarios a'}
              </label>
              <select
                value={destino}
                onChange={(e) => setDestino(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent text-neutral-700 dark:text-white/80"
              >
                <option value="">Selecciona un rol...</option>
                {destinos.map((d) => (
                  <option key={d.id} value={d.id}>{d.nombre} ({d.rol_base})</option>
                ))}
              </select>
            </div>
          )}

          <p className="text-xs text-neutral-400 dark:text-white/30">
            Nota: la plataforma no puede quedarse sin administradores activos.
          </p>
        </div>

        <div className="px-5 py-4 bg-neutral-50 dark:bg-white/3 rounded-b-xl border-t border-neutral-200 dark:border-white/10 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-neutral-600 dark:text-white/60 hover:text-neutral-800 dark:hover:text-white/80">Cancelar</button>
          <button
            onClick={handleConfirm}
            disabled={saving}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 inline-flex items-center gap-2 ${mode === 'fusionar' ? 'bg-blue-600' : 'bg-red-600'}`}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : mode === 'fusionar' ? <GitMerge className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
            {saving ? 'Procesando...' : mode === 'fusionar' ? 'Fusionar' : 'Eliminar'}
          </button>
        </div>
      </div>
    </div>
  );
}
