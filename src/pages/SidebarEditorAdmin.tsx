import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { PageHeader } from '@/components/ui/page-header';
import { PanelLeft, GripVertical, Loader as Loader2, Minus, Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { useSidebarConfig } from '../hooks/useSidebarConfig';
import { useSidebarItemsConfig } from '../hooks/useSidebarItemsConfig';
import { getEntryKey, WORKSPACES, type NavEntry, type ResolvedNavEntry, type WorkspaceId, type WorkspaceNavItem } from '../lib/workspaceConfig';

const BADGE_COLOR_OPTIONS: { key: string; label: string; cls: string }[] = [
  { key: 'amber', label: 'Ámbar', cls: 'bg-amber-500' },
  { key: 'green', label: 'Verde', cls: 'bg-green-500' },
  { key: 'blue', label: 'Azul', cls: 'bg-blue-500' },
  { key: 'red', label: 'Rojo', cls: 'bg-red-500' },
  { key: 'purple', label: 'Morado', cls: 'bg-purple-500' },
];

function entryLabel(entry: NavEntry): string {
  return entry.type === 'link' ? entry.item.label : entry.workspace.label;
}

function entryIcon(entry: NavEntry) {
  return entry.type === 'link' ? entry.item.icon : entry.workspace.icon;
}

// ── Input de badge sin glitch ────────────────────────────────────────────────
// Estado local propio (no controlado por el prop tras el primer render) para
// que escribir rápido no se pierda ni salte el cursor mientras se guarda.
function BadgeTextInput({ value, onSave, disabled }: { value: string; onSave: (v: string) => void; disabled?: boolean }) {
  const [local, setLocal] = useState(value);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, []);

  const handleChange = (v: string) => {
    setLocal(v);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => onSave(v.trim()), 600);
  };

  return (
    <input
      type="text"
      value={local}
      onChange={(e) => handleChange(e.target.value)}
      placeholder="Sin badge"
      maxLength={10}
      disabled={disabled}
      className="shrink-0 w-28 px-2.5 py-1.5 text-xs border border-neutral-200 dark:border-white/15 dark:bg-transparent dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
    />
  );
}

function ColorDots({ value, onChange, disabled }: { value: string; onChange: (c: string) => void; disabled?: boolean }) {
  return (
    <div className="shrink-0 flex items-center gap-1">
      {BADGE_COLOR_OPTIONS.map(c => (
        <button
          key={c.key}
          onClick={() => onChange(c.key)}
          disabled={disabled}
          title={c.label}
          className={`w-5 h-5 rounded-full ${c.cls} transition-transform hover:scale-110 ${
            value === c.key ? 'ring-2 ring-offset-2 ring-neutral-900 dark:ring-offset-neutral-900 dark:ring-white' : ''
          }`}
        />
      ))}
    </div>
  );
}

// Slot de tamaño fijo para el spinner — así aparecer/desaparecer no mueve nada a su alrededor.
function SavingSlot({ saving }: { saving: boolean }) {
  return (
    <div className="w-4 h-4 shrink-0 flex items-center justify-center">
      {saving && <Loader2 className="w-4 h-4 animate-spin text-neutral-400" />}
    </div>
  );
}

function showToast(setToast: (t: { message: string; type: 'success' | 'error' } | null) => void, message: string, type: 'success' | 'error' = 'success') {
  setToast({ message, type });
  setTimeout(() => setToast(null), 3500);
}

export default function SidebarEditorAdmin() {
  const { usuario } = useAuth();
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  return (
    <div className="flex flex-col gap-6 pb-10">
      <PageHeader
        title="Editor de Sidebar"
        description="Reordena los íconos de la barra lateral y los menús que se abren al hacer clic. Los cambios se guardan solos y aplican para todos los usuarios."
        icon={PanelLeft}
      />

      <IconosEditor usuarioId={usuario?.id} onToast={(m, t) => showToast(setToast, m, t)} />
      <ItemsEditor usuarioId={usuario?.id} onToast={(m, t) => showToast(setToast, m, t)} />

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl text-sm font-medium text-white shadow-lg ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}

// ── Sección 1: íconos de la barra angosta ────────────────────────────────────

function IconosEditor({ usuarioId, onToast }: { usuarioId?: string; onToast: (m: string, t?: 'success' | 'error') => void }) {
  const { resolved, loading, reload } = useSidebarConfig();
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const dragIdx = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const persist = useCallback(async (row: ResolvedNavEntry, patch: Partial<{ orden: number; separador_antes: boolean; badge_texto: string | null; badge_color: string }>) => {
    const entryKey = getEntryKey(row.entry);
    setSavingKey(entryKey);
    const { error } = await supabase.from('sidebar_config').upsert({
      entry_key: entryKey,
      orden: patch.orden ?? row.orden,
      separador_antes: patch.separador_antes ?? row.separadorAntes,
      badge_texto: 'badge_texto' in patch ? patch.badge_texto : (row.badge?.texto ?? null),
      badge_color: patch.badge_color ?? (row.badge?.color ?? 'amber'),
      updated_by: usuarioId,
    }, { onConflict: 'entry_key' });
    if (error) { onToast('Error al guardar: ' + error.message, 'error'); setSavingKey(null); return; }
    await reload();
    onToast('Cambios guardados');
    setSavingKey(null);
  }, [usuarioId, reload, onToast]);

  const move = async (idx: number, direccion: 'arriba' | 'abajo') => {
    const otroIdx = direccion === 'arriba' ? idx - 1 : idx + 1;
    if (otroIdx < 0 || otroIdx >= resolved.length) return;
    const a = resolved[idx];
    const b = resolved[otroIdx];
    setSavingKey(getEntryKey(a.entry));
    const { error } = await supabase.from('sidebar_config').upsert([
      { entry_key: getEntryKey(a.entry), orden: b.orden, separador_antes: a.separadorAntes, badge_texto: a.badge?.texto ?? null, badge_color: a.badge?.color ?? 'amber', updated_by: usuarioId },
      { entry_key: getEntryKey(b.entry), orden: a.orden, separador_antes: b.separadorAntes, badge_texto: b.badge?.texto ?? null, badge_color: b.badge?.color ?? 'amber', updated_by: usuarioId },
    ], { onConflict: 'entry_key' });
    if (error) { onToast('Error al reordenar: ' + error.message, 'error'); setSavingKey(null); return; }
    await reload();
    onToast('Cambios guardados');
    setSavingKey(null);
  };

  const handleDrop = async (dropIdx: number) => {
    setDragOverIdx(null);
    const fromIdx = dragIdx.current;
    dragIdx.current = null;
    if (fromIdx === null || fromIdx === dropIdx) return;
    const reordered = [...resolved];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(dropIdx, 0, moved);
    setSavingKey(getEntryKey(moved.entry));
    const rows = reordered.map((r, i) => ({
      entry_key: getEntryKey(r.entry),
      orden: i,
      separador_antes: r.separadorAntes,
      badge_texto: r.badge?.texto ?? null,
      badge_color: r.badge?.color ?? 'amber',
      updated_by: usuarioId,
    }));
    const { error } = await supabase.from('sidebar_config').upsert(rows, { onConflict: 'entry_key' });
    if (error) { onToast('Error al reordenar: ' + error.message, 'error'); setSavingKey(null); return; }
    await reload();
    onToast('Cambios guardados');
    setSavingKey(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-sm font-semibold text-neutral-700 dark:text-white/80 mb-2 px-1">Barra de íconos</h2>
      <div className="rounded-2xl border border-neutral-200 dark:border-white/10 divide-y divide-neutral-100 dark:divide-white/5 bg-white dark:bg-white/3">
        {resolved.map((row, idx) => {
          const Icon = entryIcon(row.entry);
          const entryKey = getEntryKey(row.entry);
          const isSaving = savingKey === entryKey;
          const isDragOver = dragOverIdx === idx;

          return (
            <div key={entryKey}>
              {row.separadorAntes && (
                <div className="px-4 pt-3">
                  <div className="border-t-2 border-dashed border-neutral-300 dark:border-white/20" />
                </div>
              )}
              <div
                draggable
                onDragStart={() => { dragIdx.current = idx; }}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverIdx(idx); }}
                onDragLeave={() => setDragOverIdx(prev => (prev === idx ? null : prev))}
                onDrop={(e) => { e.preventDefault(); handleDrop(idx); }}
                className={`flex items-center gap-3 px-4 py-3 transition-colors ${isDragOver ? 'bg-blue-50 dark:bg-blue-500/10' : ''}`}
              >
                <div className="cursor-grab text-neutral-300 hover:text-neutral-500 shrink-0">
                  <GripVertical className="w-4 h-4" />
                </div>

                <div className="w-9 h-9 rounded-xl bg-neutral-100 dark:bg-white/8 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-neutral-500 dark:text-white/70" />
                </div>

                <p className="text-sm font-medium text-neutral-800 dark:text-white flex-1 min-w-0 truncate">
                  {entryLabel(row.entry)}
                </p>

                <button
                  onClick={() => persist(row, { separador_antes: !row.separadorAntes })}
                  disabled={isSaving}
                  className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    row.separadorAntes
                      ? 'bg-neutral-900 text-white border-neutral-900 dark:bg-white dark:text-neutral-900'
                      : 'bg-white text-neutral-500 border-neutral-200 hover:border-neutral-400 dark:bg-transparent dark:border-white/15 dark:text-white/60'
                  }`}
                  title="Agregar/quitar línea separadora antes de este ícono"
                >
                  <Minus className="w-3.5 h-3.5" />
                  Separador
                </button>

                <BadgeTextInput
                  value={row.badge?.texto ?? ''}
                  onSave={(v) => persist(row, { badge_texto: v || null })}
                  disabled={isSaving}
                />
                <ColorDots value={row.badge?.color ?? 'amber'} onChange={(c) => persist(row, { badge_color: c })} disabled={isSaving} />
                <SavingSlot saving={isSaving} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Sección 2: items del panel blanco (por sección) ──────────────────────────

interface FlatItemEntry { kind: 'item'; key: string; item: WorkspaceNavItem; badge: { texto: string; color: string } | null; grupoId: string | null }
interface FlatSeparadorEntry { kind: 'separador'; key: string; id: string; grupoId: string | null }
type FlatEntry = FlatItemEntry | FlatSeparadorEntry;

function ItemsEditor({ usuarioId, onToast }: { usuarioId?: string; onToast: (m: string, t?: 'success' | 'error') => void }) {
  const [selectedWs, setSelectedWs] = useState<WorkspaceId>('administracion');
  const { getResolvedItems, loading, reload } = useSidebarItemsConfig();
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [nuevoGrupoNombre, setNuevoGrupoNombre] = useState('');
  const dragKey = useRef<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  const workspace = WORKSPACES.find(w => w.id === selectedWs)!;
  const grupos = getResolvedItems(workspace);
  // Lista plana en el orden visual actual, para poder reordenar por posición. Los separadores
  // son entradas propias (no atadas a ningún item) para poder colocarlos en cualquier posición.
  const flat: FlatEntry[] = grupos.flatMap(g => g.items.map((entry): FlatEntry =>
    entry.kind === 'item'
      ? { kind: 'item', key: entry.item.path, item: entry.item, badge: entry.badge, grupoId: g.grupo?.id ?? null }
      : { kind: 'separador', key: `sep-${entry.id}`, id: entry.id, grupoId: g.grupo?.id ?? null }
  ));

  const persistItem = async (itemPath: string, patch: Partial<{ orden: number; grupo_id: string | null; badge_texto: string | null; badge_color: string }>) => {
    const current = flat.find((f): f is FlatItemEntry => f.kind === 'item' && f.item.path === itemPath);
    const currentIdx = flat.findIndex(f => f.kind === 'item' && f.item.path === itemPath);
    setSavingKey(itemPath);
    const { error } = await supabase.from('sidebar_item_config').upsert({
      item_path: itemPath,
      orden: patch.orden ?? currentIdx,
      grupo_id: 'grupo_id' in patch ? patch.grupo_id : (current?.grupoId ?? null),
      badge_texto: 'badge_texto' in patch ? patch.badge_texto : (current?.badge?.texto ?? null),
      badge_color: patch.badge_color ?? (current?.badge?.color ?? 'amber'),
      updated_by: usuarioId,
    }, { onConflict: 'item_path' });
    if (error) { onToast('Error al guardar: ' + error.message, 'error'); setSavingKey(null); return; }
    await reload();
    onToast('Cambios guardados');
    setSavingKey(null);
  };

  const guardarOrdenCompleto = async (reordered: FlatEntry[]) => {
    const itemRows = reordered
      .map((f, i) => ({ f, i }))
      .filter((x): x is { f: FlatItemEntry; i: number } => x.f.kind === 'item')
      .map(({ f, i }) => ({
        item_path: f.item.path,
        orden: i,
        grupo_id: f.grupoId,
        badge_texto: f.badge?.texto ?? null,
        badge_color: f.badge?.color ?? 'amber',
        updated_by: usuarioId,
      }));
    const sepRows = reordered
      .map((f, i) => ({ f, i }))
      .filter((x): x is { f: FlatSeparadorEntry; i: number } => x.f.kind === 'separador')
      .map(({ f, i }) => ({ id: f.id, orden: i, grupo_id: f.grupoId, workspace_id: selectedWs }));

    const [itemResult, sepResult] = await Promise.all([
      itemRows.length ? supabase.from('sidebar_item_config').upsert(itemRows, { onConflict: 'item_path' }) : Promise.resolve({ error: null }),
      sepRows.length ? supabase.from('sidebar_separadores').upsert(sepRows, { onConflict: 'id' }) : Promise.resolve({ error: null }),
    ]);
    return itemResult.error || sepResult.error;
  };

  const reorderTo = async (dropIdx: number) => {
    setDragOverKey(null);
    const fromKey = dragKey.current;
    dragKey.current = null;
    if (!fromKey) return;
    const fromIdx = flat.findIndex(f => f.key === fromKey);
    if (fromIdx === -1 || fromIdx === dropIdx) return;
    const reordered = [...flat];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(dropIdx, 0, moved);
    setSavingKey(fromKey);
    const error = await guardarOrdenCompleto(reordered);
    if (error) { onToast('Error al reordenar: ' + error.message, 'error'); setSavingKey(null); return; }
    await reload();
    onToast('Cambios guardados');
    setSavingKey(null);
  };

  const dropOnGrupo = async (grupoId: string | null) => {
    setDragOverKey(null);
    const fromKey = dragKey.current;
    dragKey.current = null;
    if (!fromKey) return;
    const entry = flat.find(f => f.key === fromKey);
    if (!entry) return;
    if (entry.kind === 'item') {
      await persistItem(entry.item.path, { grupo_id: grupoId });
      return;
    }
    setSavingKey(fromKey);
    const { error } = await supabase.from('sidebar_separadores').update({ grupo_id: grupoId }).eq('id', entry.id);
    if (error) { onToast('Error: ' + error.message, 'error'); setSavingKey(null); return; }
    await reload();
    onToast('Cambios guardados');
    setSavingKey(null);
  };

  const crearSeparador = async (grupoId: string | null) => {
    const { error } = await supabase.from('sidebar_separadores').insert({
      workspace_id: selectedWs,
      grupo_id: grupoId,
      orden: flat.length,
    });
    if (error) { onToast('Error al agregar separador: ' + error.message, 'error'); return; }
    await reload();
    onToast('Separador agregado');
  };

  const eliminarSeparador = async (id: string) => {
    const { error } = await supabase.from('sidebar_separadores').delete().eq('id', id);
    if (error) { onToast('Error al eliminar: ' + error.message, 'error'); return; }
    await reload();
    onToast('Separador eliminado');
  };

  const crearGrupo = async () => {
    if (!nuevoGrupoNombre.trim()) return;
    const maxOrden = grupos.filter(g => g.grupo).reduce((m, g) => Math.max(m, g.grupo!.orden), -1);
    const { error } = await supabase.from('sidebar_grupos').insert({
      workspace_id: selectedWs,
      nombre: nuevoGrupoNombre.trim(),
      orden: maxOrden + 1,
    });
    if (error) { onToast('Error al crear el grupo: ' + error.message, 'error'); return; }
    setNuevoGrupoNombre('');
    await reload();
    onToast('Grupo creado');
  };

  const eliminarGrupo = async (grupoId: string, nombre: string) => {
    if (!confirm(`¿Eliminar el grupo "${nombre}"? Sus items quedarán sin grupo (no se ocultan).`)) return;
    const { error } = await supabase.from('sidebar_grupos').delete().eq('id', grupoId);
    if (error) { onToast('Error al eliminar: ' + error.message, 'error'); return; }
    await reload();
    onToast('Grupo eliminado');
  };

  const toggleColapsadoDefault = async (grupoId: string, actual: boolean) => {
    const { error } = await supabase.from('sidebar_grupos').update({ colapsado_default: !actual }).eq('id', grupoId);
    if (error) { onToast('Error: ' + error.message, 'error'); return; }
    await reload();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2 px-1">
        <h2 className="text-sm font-semibold text-neutral-700 dark:text-white/80">Menú de cada sección (panel blanco)</h2>
        <select
          value={selectedWs}
          onChange={(e) => setSelectedWs(e.target.value as WorkspaceId)}
          className="px-2.5 py-1.5 text-sm border border-neutral-200 dark:border-white/15 dark:bg-neutral-900 dark:text-white rounded-lg"
        >
          {WORKSPACES.map(w => <option key={w.id} value={w.id}>{w.label}</option>)}
        </select>
      </div>

      <p className="text-xs text-neutral-400 mb-3 px-1">Arrastra un item o separador para reordenarlo, o suéltalo sobre un grupo para moverlo ahí.</p>

      <div className="rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-white/3 overflow-hidden">
        {grupos.map(({ grupo, items }) => (
          <div key={grupo?.id ?? '_sin_grupo'}>
            {grupo ? (
              <div
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverKey(`g-${grupo.id}`); }}
                onDragLeave={() => setDragOverKey(prev => (prev === `g-${grupo.id}` ? null : prev))}
                onDrop={(e) => { e.preventDefault(); dropOnGrupo(grupo.id); }}
                className={`flex items-center gap-2 px-4 py-2 bg-neutral-50 dark:bg-white/5 border-b border-t border-neutral-100 dark:border-white/5 ${dragOverKey === `g-${grupo.id}` ? 'bg-blue-50 dark:bg-blue-500/10' : ''}`}
              >
                <button
                  onClick={() => toggleColapsadoDefault(grupo.id, grupo.colapsado_default)}
                  className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-white/50"
                  title="Colapsado por default para los usuarios"
                >
                  {grupo.colapsado_default ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  {grupo.nombre}
                </button>
                <span className="text-[10px] text-neutral-400">({items.filter(i => i.kind === 'item').length})</span>
                <button
                  onClick={() => crearSeparador(grupo.id)}
                  className="ml-auto flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-neutral-200 dark:border-white/15 text-neutral-500 dark:text-white/60 hover:border-neutral-400 hover:text-neutral-700 dark:hover:text-white transition-colors"
                  title="Agregar un separador visual en este grupo"
                >
                  <Minus className="w-3.5 h-3.5" />
                  Separador
                </button>
                <button
                  onClick={() => eliminarGrupo(grupo.id, grupo.nombre)}
                  className="p-1.5 text-neutral-300 hover:text-red-500 transition-colors"
                  title="Eliminar grupo"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverKey('g-null'); }}
                onDragLeave={() => setDragOverKey(prev => (prev === 'g-null' ? null : prev))}
                onDrop={(e) => { e.preventDefault(); dropOnGrupo(null); }}
                className={`flex items-center gap-2 px-4 py-1.5 text-[10px] text-neutral-400 ${dragOverKey === 'g-null' ? 'bg-blue-50 dark:bg-blue-500/10' : ''}`}
              >
                <span className="flex-1">Sin grupo — suelta aquí para sacar un item de su grupo</span>
                <button
                  onClick={() => crearSeparador(null)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-neutral-200 dark:border-white/15 text-neutral-500 dark:text-white/60 hover:border-neutral-400 hover:text-neutral-700 dark:hover:text-white transition-colors"
                  title="Agregar un separador visual aquí"
                >
                  <Minus className="w-3.5 h-3.5" />
                  Separador
                </button>
              </div>
            )}

            {items.map((entry) => {
              const key = entry.kind === 'item' ? entry.item.path : `sep-${entry.id}`;
              const flatIdx = flat.findIndex(f => f.key === key);
              const isSaving = savingKey === key;
              const isDragOver = dragOverKey === `i-${key}`;

              if (entry.kind === 'separador') {
                return (
                  <div
                    key={key}
                    draggable
                    onDragStart={() => { dragKey.current = key; }}
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverKey(`i-${key}`); }}
                    onDragLeave={() => setDragOverKey(prev => (prev === `i-${key}` ? null : prev))}
                    onDrop={(e) => { e.preventDefault(); reorderTo(flatIdx); }}
                    className={`flex items-center gap-3 px-4 py-1.5 border-b border-neutral-50 dark:border-white/5 last:border-b-0 transition-colors ${isDragOver ? 'bg-blue-50 dark:bg-blue-500/10' : ''}`}
                  >
                    <div className="cursor-grab text-neutral-300 hover:text-neutral-500 shrink-0">
                      <GripVertical className="w-4 h-4" />
                    </div>
                    <div className="flex-1 border-t-2 border-dashed border-neutral-300 dark:border-white/20" />
                    <span className="text-[10px] text-neutral-400 shrink-0">Separador</span>
                    <button
                      onClick={() => eliminarSeparador(entry.id)}
                      disabled={isSaving}
                      className="p-1 text-neutral-300 hover:text-red-500 transition-colors shrink-0"
                      title="Eliminar separador"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <SavingSlot saving={isSaving} />
                  </div>
                );
              }

              const { item, badge } = entry;
              const Icon = item.icon;
              return (
                <div
                  key={key}
                  draggable
                  onDragStart={() => { dragKey.current = key; }}
                  onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverKey(`i-${key}`); }}
                  onDragLeave={() => setDragOverKey(prev => (prev === `i-${key}` ? null : prev))}
                  onDrop={(e) => { e.preventDefault(); reorderTo(flatIdx); }}
                  className={`flex items-center gap-3 px-4 py-2.5 border-b border-neutral-50 dark:border-white/5 last:border-b-0 transition-colors ${isDragOver ? 'bg-blue-50 dark:bg-blue-500/10' : ''}`}
                >
                  <div className="cursor-grab text-neutral-300 hover:text-neutral-500 shrink-0">
                    <GripVertical className="w-4 h-4" />
                  </div>
                  <Icon className="w-4 h-4 text-neutral-400 shrink-0" />
                  <p className="text-sm text-neutral-700 dark:text-white/80 flex-1 min-w-0 truncate">{item.label}</p>
                  <BadgeTextInput value={badge?.texto ?? ''} onSave={(v) => persistItem(item.path, { badge_texto: v || null })} disabled={isSaving} />
                  <ColorDots value={badge?.color ?? 'amber'} onChange={(c) => persistItem(item.path, { badge_color: c })} disabled={isSaving} />
                  <SavingSlot saving={isSaving} />
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 mt-3">
        <input
          type="text"
          value={nuevoGrupoNombre}
          onChange={(e) => setNuevoGrupoNombre(e.target.value)}
          placeholder="Nombre del grupo nuevo…"
          className="flex-1 px-3 py-2 text-sm border border-neutral-200 dark:border-white/15 dark:bg-transparent dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
        />
        <button
          onClick={crearGrupo}
          disabled={!nuevoGrupoNombre.trim()}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          Nuevo grupo
        </button>
      </div>
    </div>
  );
}
