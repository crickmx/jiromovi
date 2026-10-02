import { useState, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { PageHeader } from '@/components/ui/page-header';
import {
  LayoutDashboard,
  GripVertical,
  Loader as Loader2,
  Trash2,
  Plus,
  Eye,
  EyeOff,
  ArrowLeftRight,
  Sparkles,
  Layers,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  MoveRight,
  MoveLeft,
  LayoutGrid,
} from 'lucide-react';
import {
  useDashboardConfig,
  invalidateDashboardConfigCache,
  type DashboardVcard,
  type DashboardWidget,
} from '../lib/useDashboardConfig';
import { resolveDashboardIcon, DASHBOARD_ICON_OPTIONS } from '../lib/dashboardIcons';

const WIDGET_LABELS: Record<string, { label: string; desc: string }> = {
  favoritos: { label: 'Mis Favoritos', desc: 'Atajos y accesos rápidos' },
  beta: { label: 'Únete a la Beta', desc: 'Tarjeta de invitación al programa Beta' },
  produccion_bonos: { label: 'Mi Producción', desc: 'Resumen anual vs metas' },
  campanias: { label: 'Campañas Activas', desc: 'Ranking y participantes' },
  convencion: { label: 'Convención', desc: 'Progreso y destinos de convención' },
  avisos: { label: 'Avisos', desc: 'Panel de comunicados y noticias' },
};

function showToast(
  setToast: (t: { message: string; type: 'success' | 'error' } | null) => void,
  message: string,
  type: 'success' | 'error' = 'success'
) {
  setToast({ message, type });
  setTimeout(() => setToast(null), 3500);
}

// Input de texto con estado local + debounce
function DebouncedInput({
  value,
  onSave,
  placeholder,
  className,
  maxLength,
}: {
  value: string;
  onSave: (v: string) => void;
  placeholder?: string;
  className?: string;
  maxLength?: number;
}) {
  const [local, setLocal] = useState(value);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sincronizar si cambia el prop value externamente
  useEffectState: {
    if (value !== local && timeoutRef.current === null) {
      setLocal(value);
    }
  }

  const handleChange = (v: string) => {
    setLocal(v);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      onSave(v);
      timeoutRef.current = null;
    }, 500);
  };

  return (
    <input
      type="text"
      value={local}
      onChange={e => handleChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      className={
        className ??
        'w-full px-3 py-1.5 text-xs sm:text-sm bg-surface-card dark:bg-neutral-900 border border-soft dark:border-white/15 dark:text-white rounded-lg focus:ring-2 focus:ring-accent focus:outline-none transition-shadow'
      }
    />
  );
}

function SavingSlot({ saving }: { saving: boolean }) {
  return (
    <div className="w-4 h-4 shrink-0 flex items-center justify-center">
      {saving && <Loader2 className="w-3.5 h-3.5 animate-spin text-accent-ink" />}
    </div>
  );
}

export default function DashboardEditorAdmin() {
  const { usuario } = useAuth();
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const notify = (m: string, t: 'success' | 'error' = 'success') => showToast(setToast, m, t);

  return (
    <div className="flex flex-col gap-8 pb-16">
      <PageHeader
        title="Editor de Dashboard"
        description="Reordena y configura las tarjetas de acceso y widgets del Dashboard. La visibilidad por rol, oficina y usuario se controla desde Control de Módulos."
        icon={LayoutDashboard}
      />

      <VcardsEditor usuarioId={usuario?.id} onToast={notify} />
      <WidgetsEditor usuarioId={usuario?.id} onToast={notify} />

      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-white shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-200 ${
            toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}

// ── Sección 1: Vcards del grid principal ─────────────────────────────────────

function VcardsEditor({
  usuarioId,
  onToast,
}: {
  usuarioId?: string;
  onToast: (m: string, t?: 'success' | 'error') => void;
}) {
  const { vcards, loading, reload } = useDashboardConfig();
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const dragIdx = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const patch = useCallback(
    async (card: DashboardVcard, changes: Partial<DashboardVcard>) => {
      setSavingKey(card.card_key);
      const { error } = await supabase
        .from('dashboard_vcards')
        .update({ ...changes, updated_by: usuarioId, updated_at: new Date().toISOString() })
        .eq('id', card.id);
      if (error) {
        onToast('Error al guardar: ' + error.message, 'error');
        setSavingKey(null);
        return;
      }
      invalidateDashboardConfigCache();
      await reload();
      setSavingKey(null);
    },
    [usuarioId, reload, onToast]
  );

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
    if (error) {
      onToast('Error al reordenar: ' + error.message, 'error');
      setSavingKey(null);
      return;
    }
    invalidateDashboardConfigCache();
    await reload();
    onToast('Orden guardado correctamente');
    setSavingKey(null);
  };

  const handleDelete = async (card: DashboardVcard) => {
    if (!confirm(`¿Eliminar la tarjeta "${card.label}"? Esta acción no se puede deshacer.`)) return;
    setSavingKey(card.card_key);
    const { error } = await supabase.from('dashboard_vcards').delete().eq('id', card.id);
    if (error) {
      onToast('Error al eliminar: ' + error.message, 'error');
      setSavingKey(null);
      return;
    }
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
      emoji: 'ShoppingBag',
      gradient_from: '#164281',
      gradient_to: '#082e6d',
      orden: nextOrden,
      updated_by: usuarioId,
    });
    if (error) {
      onToast('Error al crear: ' + error.message, 'error');
      return;
    }
    invalidateDashboardConfigCache();
    await reload();
    onToast('Tarjeta creada — edítala en la lista');
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 rounded-2xl border border-soft dark:border-white/10 bg-surface-card dark:bg-white/5">
        <Loader2 className="w-6 h-6 animate-spin text-accent-ink" />
        <p className="text-xs text-neutral-500">Cargando configuración de tarjetas...</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Encabezado de Sección */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
        <div>
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-4 h-4 text-accent-ink" />
            <h2 className="text-sm font-bold text-neutral-800 dark:text-white">
              Tarjetas del Grid Principal
            </h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-white/10 text-neutral-600 dark:text-neutral-300">
              {vcards.length}
            </span>
          </div>
          <p className="text-xs text-neutral-500 dark:text-white/55 mt-0.5">
            Arrastra para reordenar. Haz clic en los campos para editar en tiempo real.
          </p>
        </div>

        <button
          onClick={handleCreate}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-accent text-accent-foreground hover:bg-accent/90 active:scale-[0.98] transition-all shadow-sm cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Nueva tarjeta</span>
        </button>
      </div>

      {/* Contenedor Principal de Tarjetas */}
      <div className="rounded-2xl border border-soft dark:border-white/10 bg-surface-card dark:bg-neutral-900/90 shadow-card overflow-hidden">
        {/* Cabecera de Columnas en Escritorio (lg+) */}
        <div className="hidden lg:grid grid-cols-12 gap-3 px-4 py-2.5 bg-neutral-50 dark:bg-white/5 border-b border-neutral-200 dark:border-white/10 text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-white/50">
          <div className="col-span-3">Identidad & Título</div>
          <div className="col-span-3">Descripción</div>
          <div className="col-span-2">Ruta / Enlace</div>
          <div className="col-span-2">Ícono & Colores</div>
          <div className="col-span-2 text-right">Estado & Acciones</div>
        </div>

        {/* Lista de Filas */}
        <div className="divide-y divide-neutral-100 dark:divide-white/5">
          {vcards.map((card, idx) => {
            const isSaving = savingKey === card.card_key;
            const isDragOver = dragOverIdx === idx;
            const Icon = resolveDashboardIcon(card.icon_key ?? card.emoji);

            return (
              <div
                key={card.id}
                draggable
                onDragStart={() => {
                  dragIdx.current = idx;
                }}
                onDragOver={e => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  setDragOverIdx(idx);
                }}
                onDragLeave={() => setDragOverIdx(prev => (prev === idx ? null : prev))}
                onDrop={e => {
                  e.preventDefault();
                  handleDrop(idx);
                }}
                className={`transition-all duration-150 ${
                  isDragOver
                    ? 'bg-accent/10 dark:bg-accent/20 ring-2 ring-accent ring-inset'
                    : 'hover:bg-neutral-50/70 dark:hover:bg-white/[0.02]'
                }`}
              >
                {/* ── Vista Escritorio (lg+) ── */}
                <div className="hidden lg:grid grid-cols-12 gap-3 items-center px-4 py-3">
                  {/* Identidad */}
                  <div className="col-span-3 flex items-center gap-2.5 min-w-0">
                    <div
                      className="cursor-grab active:cursor-grabbing text-neutral-500 hover:text-neutral-700 dark:hover:text-white shrink-0 p-1"
                      title="Arrastrar para reordenar"
                    >
                      <GripVertical className="w-4 h-4" />
                    </div>

                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm border border-white/20"
                      style={{
                        background: `linear-gradient(145deg, ${card.gradient_from}, ${card.gradient_to})`,
                      }}
                      title={`Ícono: ${card.icon_key ?? card.emoji}`}
                    >
                      <Icon className="w-4 h-4 text-white" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <DebouncedInput
                        value={card.label}
                        onSave={v => patch(card, { label: v })}
                        placeholder="Título de la tarjeta"
                        className="w-full px-2.5 py-1.5 text-xs font-bold text-neutral-900 dark:text-white bg-surface-card dark:bg-neutral-900 border border-soft dark:border-white/15 rounded-lg focus:ring-2 focus:ring-accent focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Descripción */}
                  <div className="col-span-3">
                    <DebouncedInput
                      value={card.descripcion}
                      onSave={v => patch(card, { descripcion: v })}
                      placeholder="Descripción breve..."
                      className="w-full px-2.5 py-1.5 text-xs text-neutral-600 dark:text-neutral-300 bg-surface-card dark:bg-neutral-900 border border-soft dark:border-white/15 rounded-lg focus:ring-2 focus:ring-accent focus:outline-none"
                    />
                  </div>

                  {/* Ruta */}
                  <div className="col-span-2">
                    <DebouncedInput
                      value={card.route}
                      onSave={v => patch(card, { route: v })}
                      placeholder="/ruta"
                      className="w-full px-2.5 py-1.5 text-xs font-mono text-neutral-700 dark:text-neutral-300 bg-surface-card dark:bg-neutral-900 border border-soft dark:border-white/15 rounded-lg focus:ring-2 focus:ring-accent focus:outline-none"
                    />
                  </div>

                  {/* Ícono & Degradado */}
                  <div className="col-span-2 flex items-center gap-1.5">
                    <select
                      value={card.emoji}
                      onChange={e => patch(card, { emoji: e.target.value })}
                      className="w-full px-2 py-1.5 text-xs bg-surface-card dark:bg-neutral-900 border border-soft dark:border-white/15 dark:text-white rounded-lg focus:ring-2 focus:ring-accent focus:outline-none truncate"
                      title="Seleccionar ícono"
                    >
                      {DASHBOARD_ICON_OPTIONS.map(opt => (
                        <option key={opt.key} value={opt.key}>
                          {opt.label}
                        </option>
                      ))}
                    </select>

                    <div className="flex items-center gap-1 shrink-0">
                      <input
                        type="color"
                        value={card.gradient_from}
                        onChange={e => patch(card, { gradient_from: e.target.value })}
                        title="Color inicial del degradado"
                        className="w-6 h-6 rounded cursor-pointer border border-neutral-200 dark:border-white/15 bg-transparent p-0"
                      />
                      <input
                        type="color"
                        value={card.gradient_to}
                        onChange={e => patch(card, { gradient_to: e.target.value })}
                        title="Color final del degradado"
                        className="w-6 h-6 rounded cursor-pointer border border-neutral-200 dark:border-white/15 bg-transparent p-0"
                      />
                    </div>
                  </div>

                  {/* Estado & Acciones */}
                  <div className="col-span-2 flex items-center justify-end gap-1.5">
                    <SavingSlot saving={isSaving} />

                    <button
                      type="button"
                      onClick={() => patch(card, { activa: !card.activa })}
                      disabled={isSaving}
                      title={card.activa ? 'Hacer inactiva' : 'Hacer activa'}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                        card.activa
                          ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'
                          : 'bg-neutral-100 dark:bg-white/5 border-neutral-200 dark:border-white/10 text-neutral-500 dark:text-neutral-400'
                      }`}
                    >
                      {card.activa ? (
                        <>
                          <Eye className="w-3.5 h-3.5" />
                          <span>Activa</span>
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-3.5 h-3.5" />
                          <span>Inactiva</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(card)}
                      disabled={isSaving}
                      title="Eliminar tarjeta"
                      className="p-1.5 rounded-lg text-neutral-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* ── Vista Móvil / Tablet (< lg) ── */}
                <div className="lg:hidden p-4 space-y-3">
                  {/* Fila Superior: Drag, Ícono, Título y Estado */}
                  <div className="flex items-center gap-2.5 justify-between">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="cursor-grab active:cursor-grabbing text-neutral-500 p-1">
                        <GripVertical className="w-4 h-4" />
                      </div>
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm border border-white/20"
                        style={{
                          background: `linear-gradient(145deg, ${card.gradient_from}, ${card.gradient_to})`,
                        }}
                      >
                        <Icon className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <DebouncedInput
                          value={card.label}
                          onSave={v => patch(card, { label: v })}
                          placeholder="Título de la tarjeta"
                          className="w-full px-2.5 py-1 text-xs font-bold text-neutral-900 dark:text-white bg-surface-card dark:bg-neutral-900 border border-soft dark:border-white/15 rounded-lg focus:ring-2 focus:ring-accent focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <SavingSlot saving={isSaving} />
                      <button
                        type="button"
                        onClick={() => patch(card, { activa: !card.activa })}
                        disabled={isSaving}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold border ${
                          card.activa
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400'
                            : 'bg-neutral-100 text-neutral-500 border-neutral-200 dark:bg-white/5'
                        }`}
                      >
                        {card.activa ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        <span>{card.activa ? 'Activa' : 'Inactiva'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Campos de Descripción y Ruta */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-0.5 block">
                        Descripción
                      </label>
                      <DebouncedInput
                        value={card.descripcion}
                        onSave={v => patch(card, { descripcion: v })}
                        placeholder="Descripción de la tarjeta..."
                        className="w-full px-2.5 py-1.5 text-xs bg-surface-card dark:bg-neutral-900 border border-soft dark:border-white/15 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-0.5 block">
                        Ruta / Destino
                      </label>
                      <DebouncedInput
                        value={card.route}
                        onSave={v => patch(card, { route: v })}
                        placeholder="/ruta"
                        className="w-full px-2.5 py-1.5 text-xs font-mono bg-surface-card dark:bg-neutral-900 border border-soft dark:border-white/15 rounded-lg"
                      />
                    </div>
                  </div>

                  {/* Selector de Ícono, Colores y Botón Eliminar */}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-neutral-100 dark:border-white/5">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <select
                        value={card.emoji}
                        onChange={e => patch(card, { emoji: e.target.value })}
                        className="w-full max-w-[160px] px-2 py-1 text-xs bg-surface-card dark:bg-neutral-900 border border-soft dark:border-white/15 rounded-lg"
                      >
                        {DASHBOARD_ICON_OPTIONS.map(opt => (
                          <option key={opt.key} value={opt.key}>
                            {opt.label}
                          </option>
                        ))}
                      </select>

                      <div className="flex items-center gap-1">
                        <input
                          type="color"
                          value={card.gradient_from}
                          onChange={e => patch(card, { gradient_from: e.target.value })}
                          title="Color inicial"
                          className="w-6 h-6 rounded border border-neutral-200"
                        />
                        <input
                          type="color"
                          value={card.gradient_to}
                          onChange={e => patch(card, { gradient_to: e.target.value })}
                          title="Color final"
                          className="w-6 h-6 rounded border border-neutral-200"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDelete(card)}
                      className="p-1.5 text-neutral-500 hover:text-red-600 rounded-lg"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {vcards.length === 0 && (
            <div className="px-4 py-12 text-center">
              <p className="text-sm font-semibold text-neutral-600 dark:text-white/70">
                No hay tarjetas configuradas
              </p>
              <p className="text-xs text-neutral-500 mt-1">
                Crea una nueva tarjeta con el botón superior para comenzar.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sección 2: Widgets fijos (Favoritos, Beta, Mi Producción, Avisos) ────────

function WidgetsEditor({
  usuarioId,
  onToast,
}: {
  usuarioId?: string;
  onToast: (m: string, t?: 'success' | 'error') => void;
}) {
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
    if (error) {
      onToast('Error al guardar: ' + error.message, 'error');
      setSavingKey(null);
      return;
    }
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
      .update({
        full_width: !w.full_width,
        orden: nextOrden,
        updated_by: usuarioId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', w.id);
    if (error) {
      onToast('Error al mover widget: ' + error.message, 'error');
      setSavingKey(null);
      return;
    }
    invalidateDashboardConfigCache();
    await reload();
    onToast(w.full_width ? 'Widget movido a columna lateral' : 'Widget movido a ancho completo');
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
    if (error) {
      onToast('Error al reordenar: ' + error.message, 'error');
      setSavingKey(null);
      return;
    }
    invalidateDashboardConfigCache();
    await reload();
    onToast('Orden guardado correctamente');
    setSavingKey(null);
  };

  const renderZone = (
    zone: DashboardWidget[],
    isWideZone: boolean,
    title: string,
    desc: string,
    emptyLabel: string
  ) => (
    <div className="flex flex-col gap-2">
      <div className="px-1">
        <div className="flex items-center gap-2">
          {isWideZone ? (
            <Layers className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          ) : (
            <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          )}
          <h3 className="text-sm font-bold text-neutral-800 dark:text-white">{title}</h3>
          <span className="text-xs font-semibold px-2 py-0.2 rounded-full bg-neutral-100 dark:bg-white/10 text-neutral-600 dark:text-neutral-300">
            {zone.length}
          </span>
        </div>
        <p className="text-xs text-neutral-500 dark:text-white/55 mt-0.5">{desc}</p>
      </div>

      <div className="rounded-2xl border border-soft dark:border-white/10 divide-y divide-neutral-100 dark:divide-white/5 bg-surface-card dark:bg-neutral-900/90 shadow-card overflow-hidden min-h-[140px]">
        {zone.map(w => {
          const isSaving = savingKey === w.widget_key;
          const isDragOver = dragOverKey === w.widget_key;
          const info = WIDGET_LABELS[w.widget_key] ?? {
            label: w.widget_key,
            desc: 'Widget del sistema',
          };

          return (
            <div
              key={w.widget_key}
              draggable
              onDragStart={() => {
                dragKey.current = w.widget_key;
              }}
              onDragOver={e => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                setDragOverKey(w.widget_key);
              }}
              onDragLeave={() => setDragOverKey(prev => (prev === w.widget_key ? null : prev))}
              onDrop={e => {
                e.preventDefault();
                handleDrop(zone, w.widget_key);
              }}
              className={`flex items-center gap-3 px-4 py-3 transition-all duration-150 ${
                isDragOver
                  ? 'bg-accent/10 dark:bg-accent/20 ring-2 ring-accent ring-inset'
                  : 'hover:bg-neutral-50/70 dark:hover:bg-white/[0.02]'
              }`}
            >
              <div
                className="cursor-grab active:cursor-grabbing text-neutral-500 hover:text-neutral-700 dark:hover:text-white shrink-0 p-1"
                title="Arrastrar para reordenar"
              >
                <GripVertical className="w-4 h-4" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-bold text-neutral-900 dark:text-white truncate">
                  {info.label}
                </p>
                <p className="text-[11px] text-neutral-500 dark:text-white/55 truncate">
                  {info.desc}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <SavingSlot saving={isSaving} />

                <button
                  type="button"
                  onClick={() => moveToZone(w)}
                  disabled={isSaving}
                  title={
                    w.full_width
                      ? 'Mover a Columna Lateral (derecha)'
                      : 'Mover a Ancho Completo (izquierda)'
                  }
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/10 border border-neutral-200 dark:border-white/10 transition-colors cursor-pointer"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">
                    {w.full_width ? 'A Lateral' : 'A Principal'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => toggleActiva(w)}
                  disabled={isSaving}
                  title={w.activa ? 'Ocultar widget' : 'Mostrar widget'}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                    w.activa
                      ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'
                      : 'bg-neutral-100 dark:bg-white/5 border-neutral-200 dark:border-white/10 text-neutral-500 dark:text-neutral-400'
                  }`}
                >
                  {w.activa ? (
                    <>
                      <Eye className="w-3.5 h-3.5" />
                      <span>Activo</span>
                    </>
                  ) : (
                    <>
                      <EyeOff className="w-3.5 h-3.5" />
                      <span>Inactivo</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}

        {zone.length === 0 && (
          <div className="p-8 text-center text-neutral-500 dark:text-white/55">
            <p className="text-xs font-medium">{emptyLabel}</p>
          </div>
        )}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 rounded-2xl border border-soft dark:border-white/10 bg-surface-card dark:bg-white/5">
        <Loader2 className="w-6 h-6 animate-spin text-accent-ink" />
        <p className="text-xs text-neutral-500">Cargando widgets del sistema...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="border-t border-neutral-200 dark:border-white/10 pt-6">
        <h2 className="text-sm font-bold text-neutral-800 dark:text-white px-1">
          Distribución de Widgets del Dashboard
        </h2>
        <p className="text-xs text-neutral-500 dark:text-white/55 px-1 mt-0.5">
          Distribuye y activa los widgets entre la zona principal de contenido o la barra lateral derecha.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {renderZone(
          wide,
          true,
          'Zona Principal (Bajo los módulos)',
          'Widgets de visualización amplia con tablas o métricas detalladas.',
          'Sin widgets en esta columna. Usa el botón "A Principal" para mover uno.'
        )}
        {renderZone(
          narrow,
          false,
          'Columna Lateral (Derecha)',
          'Widgets compactos, avisos, accesos rápidos y estados.',
          'Sin widgets en la columna lateral. Usa el botón "A Lateral" para mover uno.'
        )}
      </div>
    </div>
  );
}
