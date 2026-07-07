import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { PageHeader } from '@/components/ui/page-header';
import { PanelLeft, ChevronUp, ChevronDown, Loader as Loader2, Minus } from 'lucide-react';
import { useSidebarConfig } from '../hooks/useSidebarConfig';
import { getEntryKey, type NavEntry, type ResolvedNavEntry } from '../lib/workspaceConfig';

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

export default function SidebarEditorAdmin() {
  const { usuario } = useAuth();
  const { resolved, loading, reload } = useSidebarConfig();
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const persist = async (row: ResolvedNavEntry, patch: Partial<{ orden: number; separador_antes: boolean; badge_texto: string | null; badge_color: string }>) => {
    const entryKey = getEntryKey(row.entry);
    setSavingKey(entryKey);
    const { error } = await supabase.from('sidebar_config').upsert({
      entry_key: entryKey,
      orden: patch.orden ?? row.orden,
      separador_antes: patch.separador_antes ?? row.separadorAntes,
      badge_texto: 'badge_texto' in patch ? patch.badge_texto : (row.badge?.texto ?? null),
      badge_color: patch.badge_color ?? (row.badge?.color ?? 'amber'),
      updated_by: usuario?.id,
    }, { onConflict: 'entry_key' });
    if (!error) await reload();
    setSavingKey(null);
  };

  const move = async (idx: number, direccion: 'arriba' | 'abajo') => {
    const otroIdx = direccion === 'arriba' ? idx - 1 : idx + 1;
    if (otroIdx < 0 || otroIdx >= resolved.length) return;
    const a = resolved[idx];
    const b = resolved[otroIdx];
    setSavingKey(getEntryKey(a.entry));
    await Promise.all([
      persist(a, { orden: b.orden }),
      persist(b, { orden: a.orden }),
    ]);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-7 h-7 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-10">
      <PageHeader
        title="Editor de Sidebar"
        description="Reordena los íconos de la barra lateral, agrega separadores visuales entre grupos, y ponles un badge (ej. BETA, NUEVO). Aplica igual para todos los usuarios."
        icon={PanelLeft}
      />

      <div className="rounded-2xl border border-neutral-200 dark:border-white/10 divide-y divide-neutral-100 dark:divide-white/5 bg-white dark:bg-white/3">
        {resolved.map((row, idx) => {
          const Icon = entryIcon(row.entry);
          const entryKey = getEntryKey(row.entry);
          const isSaving = savingKey === entryKey;

          return (
            <div key={entryKey}>
              {row.separadorAntes && (
                <div className="px-4 pt-3">
                  <div className="border-t-2 border-dashed border-neutral-300 dark:border-white/20" />
                </div>
              )}
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="flex flex-col shrink-0">
                  <button
                    onClick={() => move(idx, 'arriba')}
                    disabled={idx === 0 || isSaving}
                    className="p-0.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-white disabled:opacity-25 disabled:cursor-not-allowed"
                    title="Subir"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => move(idx, 'abajo')}
                    disabled={idx === resolved.length - 1 || isSaving}
                    className="p-0.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-white disabled:opacity-25 disabled:cursor-not-allowed"
                    title="Bajar"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
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

                <input
                  type="text"
                  value={row.badge?.texto ?? ''}
                  onChange={(e) => persist(row, { badge_texto: e.target.value.trim() || null })}
                  placeholder="Sin badge"
                  maxLength={10}
                  className="shrink-0 w-28 px-2.5 py-1.5 text-xs border border-neutral-200 dark:border-white/15 dark:bg-transparent dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />

                <div className="shrink-0 flex items-center gap-1">
                  {BADGE_COLOR_OPTIONS.map(c => (
                    <button
                      key={c.key}
                      onClick={() => persist(row, { badge_color: c.key })}
                      disabled={isSaving}
                      title={c.label}
                      className={`w-5 h-5 rounded-full ${c.cls} transition-transform hover:scale-110 ${
                        (row.badge?.color ?? 'amber') === c.key ? 'ring-2 ring-offset-2 ring-neutral-900 dark:ring-offset-neutral-900 dark:ring-white' : ''
                      }`}
                    />
                  ))}
                </div>

                {isSaving && <Loader2 className="w-4 h-4 animate-spin text-neutral-400 shrink-0" />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
