import { useState, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { PageHeader } from '@/components/ui/page-header';
import {
  LayoutDashboard, GripVertical, Loader as Loader2, Trash2, Plus, Eye, EyeOff,
  ArrowLeftRight,
} from 'lucide-react';
import {
  useDashboardConfig, invalidateDashboardConfigCache,
  type DashboardVcard, type DashboardWidget,
} from '../lib/useDashboardConfig';

const WIDGET_LABELS: Record<string, string> = {
  favoritos: 'Mis Favoritos',
  beta: 'Únete a la Beta',
  produccion_bonos: 'Mi Producción',
  campanias: 'Campañas Activas',
  convencion: 'Convención',
  avisos: 'Avisos',
};

function showToast(setToast: (t: { message: string; type: 'success' | 'error' } | null) => void, message: string, type: 'success' | 'error' = 'success') {
  setToast({ message, type });
  setTimeout(() => setToast(null), 3500);
}

// Input de texto con estado local + debounce, para que escribir rápido no
// dispare un guardado por cada tecla (mismo patrón que BadgeTextInput en
// SidebarEditorAdmin.tsx).
function DebouncedInput({ value, onSave, placeholder, className, maxLength }: {
  value: string; onSave: (v: string) => void; placeholder?: string; className?: string; maxLength?: number;
}) {
  const [local, setLocal] = useState(value);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = (v: string) => {
    setLocal(v);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => onSave(v), 600);
  };

  return (
    <input
      type="text"
      value={local}
      onChange={(e) => handleChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      className={className ?? 'px-2.5 py-1.5 text-sm border border-surface-200 dark:border-white/15 dark:bg-transparent dark:text-white rounded-lg focus:ring-2 focus:ring-accent focus:outline-none'}
    />
  );
}

function SavingSlot({ saving }: { saving: boolean }) {
  return (
    <div className="w-4 h-4 shrink-0 flex items-center justify-center">
      {saving && <Loader2 className="w-4 h-4 animate-spin text-surface-400" />}
    </div>
  );
}

export default function DashboardEditorAdmin() {
  const { usuario } = useAuth();
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const notify = (m: string, t: 'success' | 'error' = 'success') => showToast(setToast, m, t);

  return (
    <div className="flex flex-col gap-6 pb-10">
      <PageHeader
        title="Editor de Dashboard"
        description="Reordena y edita las tarjetas del Dashboard. La visibilidad por rol/oficina/usuario se controla desde Control de Módulos."
        icon={LayoutDashboard}
      />

      <VcardsEditor usuarioId={usuario?.id} onToast={notify} />
      <WidgetsEditor usuarioId={usuario?.id} onToast={notify} />

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl text-sm font-medium text-white shadow-lg ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}

// ── Sección 1: Vcards del grid principal ─────────────────────────────────────

function VcardsEditor({ usuarioId, onToast }: { usuarioId?: string; onToast: (m: string, t?: 'success' | 'error') => void }) {
  const { vcards, loading, reload } = useDashboardConfig();
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const dragIdx = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const patch = useCallback(async (card: DashboardVcard, changes: Partial<DashboardVcard>) => {
    setSavingKey(card.card_key);
    const { error } = await supabase
      .from('dashboard_vcards')
      .update({ ...changes, updated_by: usuarioId, updated_at: new Date().toISOString() })
      .eq('id', card.id);
    if (error) { onToast('Error al guardar: ' + error.message, 'error'); setSavingKey(null); return; }
    invalidateDashboardConfigCache();
    await reload();
    setSavingKey(null);
  }, [usuarioId, reload, onToast]);

  const handleDrop = async (dropIdx: number) => {
    setDragOverIdx(null);
    const fromIdx = dragIdx.current;
    dragIdx.current = null;
    if (fromIdx === null || fromIdx === dropIdx) return;
    const reordered = [...vcards];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(dropIdx, 0, moved);
    setSavingKey(moved.card_key);
    const rows = reordered.map((c, i) => ({ id: c.id, card_key: c.card_key, orden: i }));
    const { error } = await supabase.from('dashboard_vcards').upsert(rows, { onConflict: 'id' });
    if (error) { onToast('Error al reordenar: ' + error.message, 'error'); setSavingKey(null); return; }
    invalidateDashboardConfigCache();
    await reload();
    onToast('Orden guardado');
    setSavingKey(null);
  };

  const handleDelete = async (card: DashboardVcard) => {
    if (!confirm(`¿Eliminar la tarjeta "${card.label}"? Esta acción no se puede deshacer.`)) return;
    setSavingKey(card.card_key);
    const { error } = await supabase.from('dashboard_vcards').delete().eq('id', card.id);
    if (error) { onToast('Error al eliminar: ' + error.message, 'error'); setSavingKey(null); return; }
    invalidateDashboardConfigCache();
    await reload();
    onToast('Tarjeta eliminada');
    setSavingKey(null);
  };

  const handleCreate = async () => {
    const nextOrden = vcards.length > 0 ? Math.max(...vcards.map(v => v.orden)) + 1 : 1;
    const card_key = `nueva_${Date.now()}`;
    const { error } = await supabase.from('dashboard_vcards').insert({
      card_key,
      label: 'Nueva tarjeta',
      descripcion: '',
      route: '/',
      emoji: '📦',
      gradient_from: '#164281',
      gradient_to: '#082e6d',
      orden: nextOrden,
      updated_by: usuarioId,
    });
    if (error) { onToast('Error al crear: ' + error.message, 'error'); return; }
    invalidateDashboardConfigCache();
    await reload();
    onToast('Tarjeta creada — edítala abajo');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-surface-400" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2 px-1">
        <h2 className="text-sm font-semibold text-surface-700 dark:text-white/80">Tarjetas del grid (columna izquierda)</h2>
        <button
          onClick={handleCreate}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-accent text-white hover:bg-accent/90 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Nueva tarjeta
        </button>
      </div>
      <div className="rounded-2xl border border-surface-200 dark:border-white/10 divide-y divide-surface-100 dark:divide-white/5 bg-white dark:bg-white/3">
        {vcards.map((card, idx) => {
          const isSaving = savingKey === card.card_key;
          const isDragOver = dragOverIdx === idx;
          return (
            <div
              key={card.id}
              draggable
              onDragStart={() => { dragIdx.current = idx; }}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverIdx(idx); }}
              onDragLeave={() => setDragOverIdx(prev => (prev === idx ? null : prev))}
              onDrop={(e) => { e.preventDefault(); handleDrop(idx); }}
              className={`flex flex-wrap items-center gap-2.5 px-4 py-3 transition-colors ${isDragOver ? 'bg-accent/10 dark:bg-accent/20' : ''}`}
            >
              <div className="cursor-grab text-surface-300 hover:text-surface-500 shrink-0">
                <GripVertical className="w-4 h-4" />
              </div>

              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-sm"
                style={{ background: `linear-gradient(145deg, ${card.gradient_from}, ${card.gradient_to})` }}
              >
                {card.emoji}
              </div>

              <DebouncedInput
                value={card.label}
                onSave={(v) => patch(card, { label: v })}
                placeholder="Título"
                className="w-36 px-2.5 py-1.5 text-sm font-medium border border-surface-200 dark:border-white/15 dark:bg-transparent dark:text-white rounded-lg focus:ring-2 focus:ring-accent focus:outline-none"
              />
              <DebouncedInput
                value={card.descripcion}
                onSave={(v) => patch(card, { descripcion: v })}
                placeholder="Descripción"
                className="w-44 px-2.5 py-1.5 text-xs border border-surface-200 dark:border-white/15 dark:bg-transparent dark:text-white rounded-lg focus:ring-2 focus:ring-accent focus:outline-none"
              />
              <DebouncedInput
                value={card.route}
                onSave={(v) => patch(card, { route: v })}
                placeholder="/ruta"
                className="w-32 px-2.5 py-1.5 text-xs font-mono border border-surface-200 dark:border-white/15 dark:bg-transparent dark:text-white rounded-lg focus:ring-2 focus:ring-accent focus:outline-none"
              />
              <DebouncedInput
                value={card.emoji}
                onSave={(v) => patch(card, { emoji: v })}
                placeholder="🙂"
                maxLength={4}
                className="w-12 px-2 py-1.5 text-sm text-center border border-surface-200 dark:border-white/15 dark:bg-transparent dark:text-white rounded-lg focus:ring-2 focus:ring-accent focus:outline-none"
              />

              <div className="flex items-center gap-1">
                <input
                  type="color"
                  value={card.gradient_from}
                  onChange={(e) => patch(card, { gradient_from: e.target.value })}
                  title="Color inicial del degradado"
                  className="w-7 h-7 rounded cursor-pointer border border-surface-200 dark:border-white/15"
                />
                <input
                  type="color"
                  value={card.gradient_to}
                  onChange={(e) => patch(card, { gradient_to: e.target.value })}
                  title="Color final del degradado"
                  className="w-7 h-7 rounded cursor-pointer border border-surface-200 dark:border-white/15"
                />
              </div>

              <div className="flex items-center gap-1.5 ml-auto shrink-0">
                <SavingSlot saving={isSaving} />
                <button
                  onClick={() => patch(card, { activa: !card.activa })}
                  disabled={isSaving}
                  title={card.activa ? 'Ocultar tarjeta' : 'Mostrar tarjeta'}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    card.activa
                      ? 'bg-accent/10 dark:bg-accent/20 border-accent/30 dark:border-accent/40 text-accent-foreground dark:text-accent-foreground'
                      : 'bg-surface-100 dark:bg-white/[0.06] border-surface-200 dark:border-white/10 text-surface-500 dark:text-surface-400'
                  }`}
                >
                  {card.activa ? <><Eye className="w-3 h-3" /> Activa</> : <><EyeOff className="w-3 h-3" /> Inactiva</>}
                </button>
                <button
                  onClick={() => handleDelete(card)}
                  disabled={isSaving}
                  title="Eliminar tarjeta"
                  className="p-1.5 rounded-lg text-surface-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
        {vcards.length === 0 && (
          <p className="px-4 py-8 text-sm text-center text-surface-400">Sin tarjetas — crea la primera arriba.</p>
        )}
      </div>
    </div>
  );
}

// ── Sección 2: widgets fijos (Favoritos, Beta, Mi Producción, Avisos) ────────

function WidgetsEditor({ usuarioId, onToast }: { usuarioId?: string; onToast: (m: string, t?: 'success' | 'error') => void }) {
  const { widgets, loading, reload } = useDashboardConfig();
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const dragKey = useRef<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  const wide = widgets.filter(w => w.full_width).sort((a, b) => a.orden - b.orden);
  const narrow = widgets.filter(w => !w.full_width).sort((a, b) => a.orden - b.orden);

  const toggleActiva = async (w: DashboardWidget) => {
    setSavingKey(w.widget_key);
    const { error } = await supabase
      .from('dashboard_widgets')
      .update({ activa: !w.activa, updated_by: usuarioId, updated_at: new Date().toISOString() })
      .eq('id', w.id);
    if (error) { onToast('Error al guardar: ' + error.message, 'error'); setSavingKey(null); return; }
    invalidateDashboardConfigCache();
    await reload();
    setSavingKey(null);
  };

  const moveToZone = async (w: DashboardWidget) => {
    const targetZone = w.full_width ? narrow : wide;
    const nextOrden = targetZone.length > 0 ? Math.max(...targetZone.map(x => x.orden)) + 1 : 1;
    setSavingKey(w.widget_key);
    const { error } = await supabase
      .from('dashboard_widgets')
      .update({ full_width: !w.full_width, orden: nextOrden, updated_by: usuarioId, updated_at: new Date().toISOString() })
      .eq('id', w.id);
    if (error) { onToast('Error al mover: ' + error.message, 'error'); setSavingKey(null); return; }
    invalidateDashboardConfigCache();
    await reload();
    onToast('Widget movido');
    setSavingKey(null);
  };

  const handleDrop = async (zone: DashboardWidget[], dropKey: string) => {
    const fromKey = dragKey.current;
    dragKey.current = null;
    setDragOverKey(null);
    if (!fromKey || fromKey === dropKey) return;
    const fromIdx = zone.findIndex(w => w.widget_key === fromKey);
    const dropIdx = zone.findIndex(w => w.widget_key === dropKey);
    if (fromIdx === -1 || dropIdx === -1) return;
    const reordered = [...zone];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(dropIdx, 0, moved);
    setSavingKey(moved.widget_key);
    const rows = reordered.map((w, i) => ({ id: w.id, widget_key: w.widget_key, orden: i }));
    const { error } = await supabase.from('dashboard_widgets').upsert(rows, { onConflict: 'id' });
    if (error) { onToast('Error al reordenar: ' + error.message, 'error'); setSavingKey(null); return; }
    invalidateDashboardConfigCache();
    await reload();
    onToast('Orden guardado');
    setSavingKey(null);
  };

  const renderZone = (zone: DashboardWidget[], emptyLabel: string) => (
    <div className="rounded-2xl border border-surface-200 dark:border-white/10 divide-y divide-surface-100 dark:divide-white/5 bg-white dark:bg-white/3">
      {zone.map(w => {
        const isSaving = savingKey === w.widget_key;
        const isDragOver = dragOverKey === w.widget_key;
        return (
          <div
            key={w.widget_key}
            draggable
            onDragStart={() => { dragKey.current = w.widget_key; }}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverKey(w.widget_key); }}
            onDragLeave={() => setDragOverKey(prev => (prev === w.widget_key ? null : prev))}
            onDrop={(e) => { e.preventDefault(); handleDrop(zone, w.widget_key); }}
            className={`flex items-center gap-3 px-4 py-3 transition-colors ${isDragOver ? 'bg-blue-50 dark:bg-blue-500/10' : ''}`}
          >
            <div className="cursor-grab text-surface-300 hover:text-surface-500 shrink-0">
              <GripVertical className="w-4 h-4" />
            </div>
            <p className="text-sm font-medium text-surface—800 dark:text-white flex-1 min-w-0 truncate">
              {WIDGET_LABELS[w.widget_key] ?? w.widget_key}
            </p>
            <SavingSlot saving={isSaving} />
            <button
              onClick={() => moveToZone(w)}
              disabled={isSaving}
              title={w.full_width ? 'Mover a la columna derecha' : 'Mover a ancho completo (izquierda)'}
              className="p-1.5 rounded-lg text-surface-400 hover:text-surface-700 dark:hover:text-white hover:bg-surface-100 dark:hover:bg-white/8 transition-colors"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => toggleActiva(w)}
              disabled={isSaving}
              title={w.activa ? 'Ocultar widget' : 'Mostrar widget'}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                w.activa
                  ? 'bg-accent/10 dark:bg-accent/20 border-accent/30 dark:border-accent/40 text-accent-foreground dark:text-accent-foreground'
                  : 'bg-surface-100 dark:bg-white/[0.06] border-surface-200 dark:border-white/10 text-surface-500 dark:text-surface-400'
              }`}
            >
              {w.activa ? <><Eye className="w-3 h-3" /> Activo</> : <><EyeOff className="w-3 h-3" /> Inactivo</>}
            </button>
          </div>
        );
      })}
      {zone.length === 0 && (
        <p className="px-4 py-6 text-sm text-center text-surface-400">{emptyLabel}</p>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-surface-400" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div>
        <h2 className="text-sm font-semibold text-surface-700 dark:text-white/80 mb-2 px-1">Ancho completo (bajo el grid, izquierda)</h2>
        {renderZone(wide, 'Ningún widget aquí — usa la flecha para mover uno.')}
      </div>
      <div>
        <h2 className="text-sm font-semibold text-surface-700 dark:text-white/80 mb-2 px-1">Columna derecha (angosta)</h2>
        {renderZone(narrow, 'Ningún widget aquí — usa la flecha para mover uno.')}
      </div>
    </div>
  );
}
