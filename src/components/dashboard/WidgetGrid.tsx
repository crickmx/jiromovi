import { useState, useEffect, useCallback, useRef } from 'react';
import { Settings2, X, Plus, Check, MoveHorizontal as MoreHorizontal, Eye, EyeOff, Maximize2, Minimize2, GripVertical, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import type { Usuario } from '@/contexts/MoviAuthContext';
import {
  WIDGET_REGISTRY,
  getDefaultLayout,
  type WidgetConfig,
  type WidgetDefinition,
} from '@/lib/dashboardWidgets';
import {
  ProduccionPersonalWidget,
  ComisionesPersonalWidget,
  TramitesPendientesWidget,
  ProduccionOficinaWidget,
  AgentesActivosWidget,
  UsuariosActivosWidget,
  TramitesRecientesWidget,
  PolizasPorVencerWidget,
  ComunicadosRecientesWidget,
  ActividadRecienteWidget,
  ProduccionPorAgenteWidget,
  DiagnosticoSistemaWidget,
  GamificacionWidget,
  ProduccionMensualWidget,
  AccesosRapidosWidget,
} from './DashboardWidgets';
import type { UserRole } from '@/lib/workspaceConfig';

// Map widget_id → component
const WIDGET_COMPONENTS: Record<string, React.ComponentType<{ usuario: Usuario; config: WidgetConfig }>> = {
  produccion_personal:   ProduccionPersonalWidget,
  comisiones_personal:   ComisionesPersonalWidget,
  tramites_pendientes:   TramitesPendientesWidget,
  produccion_oficina:    ProduccionOficinaWidget,
  agentes_activos:       AgentesActivosWidget,
  usuarios_activos:      UsuariosActivosWidget,
  tramites_recientes:    TramitesRecientesWidget,
  polizas_por_vencer:    PolizasPorVencerWidget,
  comunicados_recientes: ComunicadosRecientesWidget,
  actividad_reciente:    ActividadRecienteWidget,
  produccion_por_agente: ProduccionPorAgenteWidget,
  diagnostico_sistema:   DiagnosticoSistemaWidget,
  gamificacion:          GamificacionWidget,
  produccion_mensual:    ProduccionMensualWidget,
  accesos_rapidos:       AccesosRapidosWidget,
};

const WIDTH_CLASSES = {
  full:  'col-span-12',
  half:  'col-span-12 md:col-span-6',
  third: 'col-span-12 md:col-span-6 lg:col-span-4',
};

interface Props {
  usuario: Usuario;
}

// ── Context Menu ──────────────────────────────────────────────────────────────

interface ContextMenuState {
  widgetId: string;
  x: number;
  y: number;
}

function ContextMenu({
  state,
  configs,
  onHide,
  onCycleWidth,
  onDuplicate,
  onClose,
  registry,
}: {
  state: ContextMenuState;
  configs: WidgetConfig[];
  onHide: (id: string) => void;
  onCycleWidth: (id: string) => void;
  onDuplicate: (id: string) => void;
  onClose: () => void;
  registry: WidgetDefinition[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const def = registry.find(w => w.id === state.widgetId);
  const config = configs.find(c => c.widget_id === state.widgetId);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Adjust position to stay in viewport
  const [pos, setPos] = useState({ x: state.x, y: state.y });
  useEffect(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let x = state.x;
    let y = state.y;
    if (x + rect.width > vw - 8) x = vw - rect.width - 8;
    if (y + rect.height > vh - 8) y = vh - rect.height - 8;
    setPos({ x, y });
  }, [state]);

  const widthLabel = config?.width === 'full' ? 'Completo' : config?.width === 'half' ? 'Mitad' : '1/3';
  const canResize = def && def.allowedWidths.length > 1;

  return (
    <div
      ref={ref}
      style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 9999 }}
      className="w-52 bg-white dark:bg-neutral-900 rounded-xl shadow-2xl border border-neutral-200 dark:border-white/10 py-1.5 overflow-hidden"
    >
      <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-white/30">
        {def?.label || 'Widget'}
      </p>
      <div className="h-px bg-neutral-100 dark:bg-white/8 mx-2 mb-1" />

      {canResize && (
        <button
          onClick={() => { onCycleWidth(state.widgetId); onClose(); }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-neutral-700 dark:text-white/70 hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors"
        >
          <Maximize2 className="w-3.5 h-3.5 text-neutral-400 dark:text-white/30" />
          Tamaño: <span className="font-medium text-neutral-900 dark:text-white">{widthLabel}</span>
        </button>
      )}

      <button
        onClick={() => { onDuplicate(state.widgetId); onClose(); }}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-neutral-700 dark:text-white/70 hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors"
      >
        <Copy className="w-3.5 h-3.5 text-neutral-400 dark:text-white/30" />
        Configurar
      </button>

      <div className="h-px bg-neutral-100 dark:bg-white/8 mx-2 my-1" />

      <button
        onClick={() => { onHide(state.widgetId); onClose(); }}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/8 transition-colors"
      >
        <EyeOff className="w-3.5 h-3.5" />
        Ocultar del dashboard
      </button>
    </div>
  );
}

// ── Main WidgetGrid ────────────────────────────────────────────────────────────

export function WidgetGrid({ usuario }: Props) {
  const [configs, setConfigs] = useState<WidgetConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // DnD state
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const role = usuario.rol as UserRole;

  // ── Load configs ─────────────────────────────────────────────────────────────
  const loadConfigs = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('dashboard_widget_configs')
        .select('*')
        .eq('usuario_id', usuario.id)
        .eq('rol', role)
        .order('position');

      if (data && data.length > 0) {
        setConfigs(data.map(r => ({
          widget_id: r.widget_id,
          visible: r.visible,
          position: r.position,
          width: r.width as WidgetConfig['width'],
          custom_settings: r.custom_settings ?? {},
        })));
      } else {
        setConfigs(getDefaultLayout(role));
      }
    } catch {
      setConfigs(getDefaultLayout(role));
    } finally {
      setLoading(false);
    }
  }, [usuario.id, role]);

  useEffect(() => { loadConfigs(); }, [loadConfigs]);

  // ── Save configs ─────────────────────────────────────────────────────────────
  const saveConfigs = async (newConfigs: WidgetConfig[]) => {
    setSaving(true);
    try {
      const rows = newConfigs.map((c, i) => ({
        usuario_id: usuario.id,
        widget_id: c.widget_id,
        rol: role,
        visible: c.visible,
        position: i,
        width: c.width,
        custom_settings: c.custom_settings,
      }));
      await supabase
        .from('dashboard_widget_configs')
        .upsert(rows, { onConflict: 'usuario_id,widget_id' });
    } catch { /* silent */ }
    finally { setSaving(false); }
  };

  // ── Edit helpers ──────────────────────────────────────────────────────────────
  const toggleVisible = (widgetId: string) => {
    const next = configs.map(c =>
      c.widget_id === widgetId ? { ...c, visible: !c.visible } : c
    );
    setConfigs(next);
    saveConfigs(next);
  };

  const cycleWidth = (widgetId: string) => {
    const def = WIDGET_REGISTRY.find(w => w.id === widgetId);
    if (!def || def.allowedWidths.length <= 1) return;
    const next = configs.map(c => {
      if (c.widget_id !== widgetId) return c;
      const idx = def.allowedWidths.indexOf(c.width);
      return { ...c, width: def.allowedWidths[(idx + 1) % def.allowedWidths.length] };
    });
    setConfigs(next);
    saveConfigs(next);
  };

  const addWidget = (widgetId: string) => {
    if (configs.find(c => c.widget_id === widgetId)) {
      const next = configs.map(c => c.widget_id === widgetId ? { ...c, visible: true } : c);
      setConfigs(next);
      saveConfigs(next);
      return;
    }
    const def = WIDGET_REGISTRY.find(w => w.id === widgetId)!;
    const newConfig: WidgetConfig = {
      widget_id: widgetId,
      visible: true,
      position: configs.length,
      width: def.defaultWidth,
      custom_settings: {},
    };
    const next = [...configs, newConfig];
    setConfigs(next);
    saveConfigs(next);
  };

  const resetLayout = () => {
    const defaults = getDefaultLayout(role);
    setConfigs(defaults);
    saveConfigs(defaults);
    setEditMode(false);
  };

  // ── Drag & Drop ───────────────────────────────────────────────────────────────
  const onDragStart = (widgetId: string) => {
    setDragId(widgetId);
  };

  const onDragOver = (e: React.DragEvent, widgetId: string) => {
    e.preventDefault();
    if (widgetId !== dragId) setDragOverId(widgetId);
  };

  const onDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) { endDrag(); return; }

    const next = [...configs];
    const fromIdx = next.findIndex(c => c.widget_id === dragId);
    const toIdx   = next.findIndex(c => c.widget_id === targetId);
    if (fromIdx === -1 || toIdx === -1) { endDrag(); return; }

    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    next.forEach((c, i) => { c.position = i; });
    setConfigs(next);
    saveConfigs(next);
    endDrag();
  };

  const endDrag = () => {
    setDragId(null);
    setDragOverId(null);
  };

  // Visible widgets sorted by position, excluding pinned ones
  const visibleWidgets = configs
    .filter(c => c.visible && c.widget_id !== 'chava_insights' && c.widget_id !== 'accesos_rapidos')
    .sort((a, b) => a.position - b.position);

  const hiddenCount = configs.filter(
    c => !c.visible && c.widget_id !== 'chava_insights' && c.widget_id !== 'accesos_rapidos'
  ).length;

  if (loading) return <WidgetGridSkeleton />;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {editMode && hiddenCount > 0 && (
            <span className="text-xs text-neutral-400 dark:text-white/30">
              {hiddenCount} widget{hiddenCount > 1 ? 's' : ''} oculto{hiddenCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {editMode && (
            <>
              <button
                onClick={() => setShowPicker(true)}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors border border-blue-200 dark:border-blue-500/20"
              >
                <Plus className="w-3.5 h-3.5" /> Agregar
              </button>
              <button
                onClick={resetLayout}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-neutral-100 dark:bg-white/5 text-neutral-600 dark:text-white/50 hover:bg-neutral-200 dark:hover:bg-white/10 transition-colors"
              >
                Restablecer
              </button>
            </>
          )}
          <button
            onClick={() => setEditMode(!editMode)}
            className={cn(
              'inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors border',
              editMode
                ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 border-transparent'
                : 'bg-white dark:bg-white/5 text-neutral-600 dark:text-white/50 border-neutral-200 dark:border-white/10 hover:bg-neutral-50 dark:hover:bg-white/8'
            )}
          >
            <Settings2 className="w-3.5 h-3.5" />
            {editMode ? 'Listo' : 'Personalizar'}
            {saving && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-50 animate-pulse" />}
          </button>
        </div>
      </div>

      {/* Edit mode hint */}
      {editMode && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-500/8 border border-blue-100 dark:border-blue-500/15 text-xs text-blue-600 dark:text-blue-400">
          <GripVertical className="w-3.5 h-3.5 flex-shrink-0" />
          Arrastra los widgets para reordenarlos. Usa el menú <MoreHorizontal className="w-3 h-3 mx-0.5 inline" /> para más opciones.
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-12 gap-4">
        {visibleWidgets.map((config) => {
          const Component = WIDGET_COMPONENTS[config.widget_id];
          if (!Component) return null;

          const isDragging = dragId === config.widget_id;
          const isDropTarget = dragOverId === config.widget_id;

          return (
            <div
              key={config.widget_id}
              draggable={editMode}
              onDragStart={() => onDragStart(config.widget_id)}
              onDragOver={(e) => onDragOver(e, config.widget_id)}
              onDrop={() => onDrop(config.widget_id)}
              onDragEnd={endDrag}
              className={cn(
                WIDTH_CLASSES[config.width],
                'relative group transition-all duration-200',
                editMode && 'cursor-grab active:cursor-grabbing',
                isDragging && 'opacity-40 scale-[0.98]',
                isDropTarget && editMode && 'ring-2 ring-[rgb(var(--movi-accent-rgb))] ring-offset-2 dark:ring-offset-neutral-950 rounded-2xl',
              )}
            >
              {/* Drag handle — edit mode only */}
              {editMode && (
                <div className="absolute top-2 left-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white dark:bg-neutral-800 shadow-sm border border-neutral-200 dark:border-white/10 text-neutral-400 dark:text-white/30">
                    <GripVertical className="w-3 h-3" />
                  </div>
                </div>
              )}

              {/* Context menu trigger — always visible on hover */}
              <div className="absolute top-2 right-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setContextMenu({ widgetId: config.widget_id, x: e.clientX, y: e.clientY });
                  }}
                  className="flex items-center justify-center w-7 h-7 rounded-lg bg-white dark:bg-neutral-800 shadow-sm border border-neutral-200 dark:border-white/10 text-neutral-400 dark:text-white/40 hover:text-neutral-600 dark:hover:text-white/70 transition-colors"
                  title="Opciones del widget"
                >
                  <MoreHorizontal className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Drop zone indicator */}
              {isDropTarget && editMode && (
                <div className="absolute inset-0 z-10 rounded-2xl bg-[rgb(var(--movi-accent-rgb))]/5 pointer-events-none border-2 border-dashed border-[rgb(var(--movi-accent-rgb))]/40" />
              )}

              <Component usuario={usuario} config={config} />
            </div>
          );
        })}
      </div>

      {/* Hidden widgets panel in edit mode */}
      {editMode && hiddenCount > 0 && (
        <div className="rounded-xl border border-dashed border-neutral-200 dark:border-white/10 p-4">
          <p className="text-xs font-medium text-neutral-400 dark:text-white/30 mb-3">Widgets ocultos</p>
          <div className="flex flex-wrap gap-2">
            {configs
              .filter(c => !c.visible && c.widget_id !== 'chava_insights' && c.widget_id !== 'accesos_rapidos')
              .map(c => {
                const def = WIDGET_REGISTRY.find(w => w.id === c.widget_id);
                return (
                  <button
                    key={c.widget_id}
                    onClick={() => toggleVisible(c.widget_id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-white/4 text-xs font-medium text-neutral-600 dark:text-white/50 hover:border-neutral-300 dark:hover:border-white/20 hover:text-neutral-800 dark:hover:text-white/80 transition-colors"
                  >
                    <Eye className="w-3 h-3" />
                    {def?.label || c.widget_id}
                  </button>
                );
              })
            }
          </div>
        </div>
      )}

      {/* Widget Picker */}
      {showPicker && (
        <WidgetPicker
          role={role}
          currentConfigs={configs}
          onAdd={addWidget}
          onClose={() => setShowPicker(false)}
        />
      )}

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          state={contextMenu}
          configs={configs}
          onHide={toggleVisible}
          onCycleWidth={cycleWidth}
          onDuplicate={() => { /* future: per-widget settings */ }}
          onClose={() => setContextMenu(null)}
          registry={WIDGET_REGISTRY}
        />
      )}
    </div>
  );
}

// ── Widget Picker Modal ────────────────────────────────────────────────────────

function WidgetPicker({
  role,
  currentConfigs,
  onAdd,
  onClose,
}: {
  role: UserRole;
  currentConfigs: WidgetConfig[];
  onAdd: (id: string) => void;
  onClose: () => void;
}) {
  const allowed = WIDGET_REGISTRY.filter(w =>
    w.id !== 'chava_insights' && w.id !== 'accesos_rapidos' &&
    (w.allowedRoles.length === 0 || w.allowedRoles.includes(role))
  );

  const getStatus = (def: WidgetDefinition): 'visible' | 'hidden' | 'absent' => {
    const c = currentConfigs.find(x => x.widget_id === def.id);
    if (!c) return 'absent';
    return c.visible ? 'visible' : 'hidden';
  };

  const categories = ['kpi', 'list', 'chart', 'actions'] as const;
  const catLabels: Record<string, string> = {
    kpi: 'Métricas clave', list: 'Listas', chart: 'Gráficas', actions: 'Acciones',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden border border-neutral-200 dark:border-white/10">
        <div className="flex items-center justify-between p-5 border-b border-neutral-100 dark:border-white/8">
          <div>
            <h3 className="font-semibold text-neutral-900 dark:text-white text-sm">Widgets disponibles</h3>
            <p className="text-xs text-neutral-400 mt-0.5">Agrega o quita secciones de tu dashboard</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-white/5 text-neutral-500 dark:text-white/40">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {categories.map(cat => {
            const items = allowed.filter(w => w.category === cat);
            if (items.length === 0) return null;
            return (
              <div key={cat}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-white/30 mb-2 px-1">{catLabels[cat]}</p>
                <div className="space-y-1.5">
                  {items.map(def => {
                    const status = getStatus(def);
                    const isActive = status === 'visible';
                    return (
                      <button
                        key={def.id}
                        onClick={() => onAdd(def.id)}
                        className={cn(
                          'w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border text-left transition-all',
                          isActive
                            ? 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20'
                            : 'bg-neutral-50 dark:bg-white/3 border-neutral-100 dark:border-white/6 hover:bg-neutral-100 dark:hover:bg-white/6'
                        )}
                      >
                        <div>
                          <p className={cn('text-xs font-semibold', isActive ? 'text-blue-700 dark:text-blue-300' : 'text-neutral-700 dark:text-white/80')}>{def.label}</p>
                          <p className="text-[11px] text-neutral-400 dark:text-white/35 mt-0.5">{def.description}</p>
                        </div>
                        {isActive
                          ? <Check className="w-4 h-4 text-blue-500 flex-shrink-0" />
                          : <Plus className="w-4 h-4 text-neutral-300 dark:text-white/20 flex-shrink-0" />
                        }
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function WidgetGridSkeleton() {
  return (
    <div className="grid grid-cols-12 gap-4 animate-pulse">
      {[1, 2, 3].map(i => (
        <div key={i} className="col-span-12 md:col-span-4 h-28 rounded-2xl bg-neutral-100 dark:bg-white/5" />
      ))}
      <div className="col-span-12 md:col-span-6 h-64 rounded-2xl bg-neutral-100 dark:bg-white/5" />
      <div className="col-span-12 md:col-span-6 h-64 rounded-2xl bg-neutral-100 dark:bg-white/5" />
    </div>
  );
}
