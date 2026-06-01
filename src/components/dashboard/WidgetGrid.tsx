import { useState, useEffect, useCallback } from 'react';
import { Settings2, X, GripVertical, Eye, EyeOff, Plus, Check } from 'lucide-react';
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

export function WidgetGrid({ usuario }: Props) {
  const [configs, setConfigs] = useState<WidgetConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const role = usuario.rol as UserRole;

  // ── Load configs ──────────────────────────────────────────────────────────
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

  // ── Save configs ──────────────────────────────────────────────────────────
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

  // ── Edit helpers ──────────────────────────────────────────────────────────
  const toggleVisible = (widgetId: string) => {
    const next = configs.map(c =>
      c.widget_id === widgetId ? { ...c, visible: !c.visible } : c
    );
    setConfigs(next);
    saveConfigs(next);
  };

  const moveWidget = (idx: number, dir: -1 | 1) => {
    const next = [...configs];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    next.forEach((c, i) => { c.position = i; });
    setConfigs(next);
    saveConfigs(next);
  };

  const cycleWidth = (widgetId: string) => {
    const def = WIDGET_REGISTRY.find(w => w.id === widgetId);
    if (!def || def.allowedWidths.length <= 1) return;
    const next = configs.map(c => {
      if (c.widget_id !== widgetId) return c;
      const idx = def.allowedWidths.indexOf(c.width);
      const nextW = def.allowedWidths[(idx + 1) % def.allowedWidths.length];
      return { ...c, width: nextW };
    });
    setConfigs(next);
    saveConfigs(next);
  };

  const addWidget = (widgetId: string) => {
    if (configs.find(c => c.widget_id === widgetId)) {
      // toggle visibility
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

  // Visible widgets sorted by position
  const visibleWidgets = configs
    .filter(c => c.visible)
    .sort((a, b) => a.position - b.position);

  if (loading) return <WidgetGridSkeleton />;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-end gap-2">
        {editMode && (
          <>
            <button
              onClick={() => setShowPicker(true)}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors border border-blue-200 dark:border-blue-500/20"
            >
              <Plus className="w-3.5 h-3.5" /> Agregar widget
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

      {/* Grid */}
      <div className="grid grid-cols-12 gap-4">
        {visibleWidgets.map((config, idx) => {
          // chava_insights is handled in Dashboard.tsx above the grid
          if (config.widget_id === 'chava_insights') return null;

          const Component = WIDGET_COMPONENTS[config.widget_id];
          if (!Component) return null;

          const def = WIDGET_REGISTRY.find(w => w.id === config.widget_id);

          return (
            <div
              key={config.widget_id}
              className={cn(
                WIDTH_CLASSES[config.width],
                'relative group',
                editMode && 'ring-2 ring-dashed ring-neutral-200 dark:ring-white/15 rounded-2xl'
              )}
            >
              {/* Edit overlay */}
              {editMode && (
                <div className="absolute inset-0 z-10 rounded-2xl pointer-events-none" />
              )}

              {editMode && (
                <div className="absolute -top-2 -right-2 z-20 flex items-center gap-1">
                  {def && def.allowedWidths.length > 1 && (
                    <button
                      onClick={() => cycleWidth(config.widget_id)}
                      className="w-6 h-6 rounded-full bg-blue-500 text-white text-[9px] font-bold flex items-center justify-center shadow-lg hover:bg-blue-600"
                      title="Cambiar tamaño"
                    >
                      {config.width === 'full' ? 'F' : config.width === 'half' ? 'H' : '⅓'}
                    </button>
                  )}
                  <button
                    onClick={() => toggleVisible(config.widget_id)}
                    className="w-6 h-6 rounded-full bg-neutral-800 dark:bg-neutral-700 text-white flex items-center justify-center shadow-lg hover:bg-red-500"
                    title="Ocultar widget"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              {editMode && idx > 0 && (
                <button
                  onClick={() => moveWidget(idx, -1)}
                  className="absolute -left-2 top-1/2 -translate-y-1/2 z-20 w-6 h-6 rounded-full bg-neutral-800 dark:bg-neutral-700 text-white flex items-center justify-center shadow-lg hover:bg-neutral-600 rotate-90"
                  title="Mover arriba"
                >
                  <GripVertical className="w-3 h-3" />
                </button>
              )}

              <Component usuario={usuario} config={config} />
            </div>
          );
        })}
      </div>

      {/* Widget Picker */}
      {showPicker && (
        <WidgetPicker
          role={role}
          currentConfigs={configs}
          onAdd={addWidget}
          onClose={() => setShowPicker(false)}
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
    w.id !== 'chava_insights' && (w.allowedRoles.length === 0 || w.allowedRoles.includes(role))
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
      <div className="col-span-12 h-40 rounded-2xl bg-neutral-100 dark:bg-white/5" />
      {[1, 2, 3].map(i => (
        <div key={i} className="col-span-12 md:col-span-4 h-28 rounded-2xl bg-neutral-100 dark:bg-white/5" />
      ))}
      <div className="col-span-12 md:col-span-6 h-64 rounded-2xl bg-neutral-100 dark:bg-white/5" />
      <div className="col-span-12 md:col-span-6 h-64 rounded-2xl bg-neutral-100 dark:bg-white/5" />
    </div>
  );
}
