import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { invalidateModuleVisibilityCache } from '../lib/useModuleVisibility';
import { PageHeader } from '@/components/ui/page-header';
import {
  Layers, Building2, RefreshCw, CircleCheck as CheckCircle2, Circle as XCircle,
  Loader as Loader2, ChevronDown, ChevronUp, Eye, EyeOff, Info, UserRound, Search,
  Undo2, AlertTriangle, Check, FlaskConical,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { TOP_LEVEL_ITEMS, WORKSPACES } from '@/lib/workspaceConfig';
import type { UserRole } from '@/lib/workspaceConfig';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ModuleRow {
  key: string;     // path used as key, e.g. '/entrega-polizas'
  label: string;
  workspace: string;
}

type TargetType = 'role' | 'office' | 'user' | 'beta_user';

interface VisibilityRule {
  id?: string;
  module_key: string;
  target_type: TargetType;
  target_value: string;
  visible: boolean;
}

interface Oficina {
  id: string;
  nombre: string;
}

interface UsuarioLite {
  id: string;
  nombre: string;
  apellidos: string;
  rol: string;
  oficina_id: string | null;
}

/** Estado de un cambio aún no guardado: 'hereda' = borrar el override (volver a heredar). */
type DraftValue = 'visible' | 'oculto' | 'hereda';

interface BulkChange {
  moduleKey: string;
  action: DraftValue;
}

interface TargetOption {
  id: string;
  label: string;
  sublabel?: string;
}

const ALL_ROLES: UserRole[] = ['Administrador', 'Gerente', 'Empleado', 'Agente'];

// Build the flat module list from workspaceConfig
function buildModuleList(): ModuleRow[] {
  const rows: ModuleRow[] = [];
  // Top-level items
  for (const item of TOP_LEVEL_ITEMS) {
    rows.push({ key: item.path, label: item.label, workspace: 'Principal' });
  }
  // Workspace items
  for (const ws of WORKSPACES) {
    for (const item of ws.items) {
      rows.push({ key: item.path, label: item.label, workspace: ws.label });
    }
  }
  // Deduplicate by key (some paths appear in both TOP_LEVEL and a workspace)
  const seen = new Set<string>();
  return rows.filter(r => { if (seen.has(r.key)) return false; seen.add(r.key); return true; });
}

const ALL_MODULES = buildModuleList();

// Prefijo para la llave de borrador de "Toda la sección" — nunca choca con un module_key
// real (esos siempre empiezan con "/"). Antes esto escribía module_key = ws.id (ej.
// "produccion"), pero el lado de lectura (isModuleVisible) SIEMPRE consulta item.path
// (ej. "/produccion") — esa fila nunca se leía, por eso "Toda la sección" no tenía efecto.
// Ahora "toda la sección" se resuelve aplicando el cambio a cada item real de esa sección.
const SECTION_PREFIX = '__section__:';
const sectionDraftKey = (workspace: string) => `${SECTION_PREFIX}${workspace}`;

// ─── RuleMap helpers ─────────────────────────────────────────────────────────

function ruleKey(moduleKey: string, targetType: TargetType, targetValue: string) {
  return `${moduleKey}||${targetType}||${targetValue}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

type TabId = 'roles' | 'oficinas' | 'usuarios' | 'beta';

// Widgets del Dashboard no tienen su propio label (son componentes fijos,
// no tarjetas genéricas) — mismo mapa que usa DashboardEditorAdmin.tsx.
const DASHBOARD_WIDGET_LABELS: Record<string, string> = {
  favoritos: 'Mis Favoritos',
  beta: 'Únete a la Beta',
  produccion_bonos: 'Mi Producción',
  campanias: 'Campañas Activas',
  convencion: 'Convención',
  avisos: 'Avisos',
};

export default function ModulosAdmin() {
  const { usuario } = useAuth();
  const [tab, setTab] = useState<TabId>('roles');
  const [rules, setRules] = useState<Map<string, VisibilityRule>>(new Map());
  const [oficinas, setOficinas] = useState<Oficina[]>([]);
  const [dashboardModules, setDashboardModules] = useState<ModuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null); // key being saved (solo tab Rol)
  const [saveResult, setSaveResult] = useState<{ key: string; ok: boolean } | null>(null);
  const [expandedWorkspaces, setExpandedWorkspaces] = useState<Set<string>>(new Set(WORKSPACES.map(w => w.id)));

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: rulesData }, { data: oficinasData }, { data: vcardsData }, { data: widgetsData }] = await Promise.all([
      supabase.from('module_visibility').select('id, module_key, target_type, target_value, visible'),
      supabase.from('oficinas').select('id, nombre').eq('activa', true).order('nombre'),
      supabase.from('dashboard_vcards').select('card_key, label').order('orden'),
      supabase.from('dashboard_widgets').select('widget_key').order('orden'),
    ]);

    const map = new Map<string, VisibilityRule>();
    for (const r of rulesData ?? []) {
      map.set(ruleKey(r.module_key, r.target_type, r.target_value), r as VisibilityRule);
    }
    setRules(map);
    setOficinas((oficinasData ?? []) as Oficina[]);
    setDashboardModules([
      ...(vcardsData ?? []).map(v => ({ key: `dashboard:vcard:${v.card_key}`, label: `Vcard: ${v.label}`, workspace: 'Dashboard' })),
      ...(widgetsData ?? []).map(w => ({ key: `dashboard:widget:${w.widget_key}`, label: `Widget: ${DASHBOARD_WIDGET_LABELS[w.widget_key] ?? w.widget_key}`, workspace: 'Dashboard' })),
    ]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Toggle binario inmediato (solo usado por la tab "Por Rol") ─────────────

  const toggleRule = async (moduleKey: string, targetType: TargetType, targetValue: string, currentlyVisible: boolean) => {
    const k = ruleKey(moduleKey, targetType, targetValue);
    const existing = rules.get(k);
    const newVisible = !currentlyVisible;
    setSaving(k);
    setSaveResult(null);

    let error: unknown = null;

    if (existing?.id) {
      const { error: e } = await supabase
        .from('module_visibility')
        .update({ visible: newVisible, updated_by: usuario?.id, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
      error = e;
    } else {
      const { error: e } = await supabase
        .from('module_visibility')
        .insert({ module_key: moduleKey, target_type: targetType, target_value: targetValue, visible: newVisible, updated_by: usuario?.id });
      error = e;
    }

    if (!error) {
      setRules(prev => {
        const next = new Map(prev);
        next.set(k, { ...(existing ?? { module_key: moduleKey, target_type: targetType, target_value: targetValue }), visible: newVisible });
        return next;
      });
      invalidateModuleVisibilityCache();
      setSaveResult({ key: k, ok: true });
      setTimeout(() => setSaveResult(null), 2000);
    } else {
      setSaveResult({ key: k, ok: false });
      setTimeout(() => setSaveResult(null), 3000);
    }
    setSaving(null);
  };

  // ── Toggle binario de TODA una sección a la vez (aplica a cada item real) ──

  const toggleSectionRule = async (groupKey: string, moduleKeys: string[], targetType: TargetType, targetValue: string, currentlyVisible: boolean) => {
    const newVisible = !currentlyVisible;
    setSaving(groupKey);
    setSaveResult(null);

    const rows = moduleKeys.map(mk => ({
      module_key: mk,
      target_type: targetType,
      target_value: targetValue,
      visible: newVisible,
      updated_by: usuario?.id,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase
      .from('module_visibility')
      .upsert(rows, { onConflict: 'module_key,target_type,target_value' });

    if (!error) {
      setRules(prev => {
        const next = new Map(prev);
        for (const mk of moduleKeys) {
          const k = ruleKey(mk, targetType, targetValue);
          const existing = next.get(k);
          next.set(k, { ...(existing ?? { module_key: mk, target_type: targetType, target_value: targetValue }), visible: newVisible });
        }
        return next;
      });
      invalidateModuleVisibilityCache();
      setSaveResult({ key: groupKey, ok: true });
      setTimeout(() => setSaveResult(null), 2000);
    } else {
      setSaveResult({ key: groupKey, ok: false });
      setTimeout(() => setSaveResult(null), 3000);
    }
    setSaving(null);
  };

  // ── Getters ──────────────────────────────────────────────────────────────

  /** Valor explícito guardado para esta combinación, o null si no hay regla. */
  const getRuleRaw = (moduleKey: string, targetType: TargetType, targetValue: string): boolean | null => {
    const r = rules.get(ruleKey(moduleKey, targetType, targetValue));
    return r ? r.visible : null;
  };

  const getVisible = (moduleKey: string, targetType: TargetType, targetValue: string): boolean =>
    getRuleRaw(moduleKey, targetType, targetValue) ?? true;

  // ── Guardado masivo (usado por "Por Oficina" y "Por Usuario") ──────────────

  const applyBulkChanges = async (
    targetType: TargetType,
    targetIds: string[],
    changes: BulkChange[]
  ): Promise<{ ok: true } | { ok: false; message: string }> => {
    const toUpsert = changes
      .filter(c => c.action !== 'hereda')
      .flatMap(c => targetIds.map(targetId => ({
        module_key: c.moduleKey,
        target_type: targetType,
        target_value: targetId,
        visible: c.action === 'visible',
        updated_by: usuario?.id,
        updated_at: new Date().toISOString(),
      })));

    const heredaKeys = changes.filter(c => c.action === 'hereda').map(c => c.moduleKey);

    try {
      if (toUpsert.length > 0) {
        const { error } = await supabase
          .from('module_visibility')
          .upsert(toUpsert, { onConflict: 'module_key,target_type,target_value' });
        if (error) throw error;
      }
      if (heredaKeys.length > 0) {
        const { error } = await supabase
          .from('module_visibility')
          .delete()
          .eq('target_type', targetType)
          .in('target_value', targetIds)
          .in('module_key', heredaKeys);
        if (error) throw error;
      }
      invalidateModuleVisibilityCache();
      await fetchAll();
      return { ok: true };
    } catch (e: any) {
      return { ok: false, message: e?.message ?? 'Error desconocido al guardar los cambios.' };
    }
  };

  // ── Grouped modules ────────────────────────────────────────────────────────

  const modulesByWorkspace: { workspace: string; modules: ModuleRow[] }[] = [];
  const wsMap = new Map<string, ModuleRow[]>();
  for (const m of [...ALL_MODULES, ...dashboardModules]) {
    if (!wsMap.has(m.workspace)) wsMap.set(m.workspace, []);
    wsMap.get(m.workspace)!.push(m);
  }
  wsMap.forEach((modules, workspace) => modulesByWorkspace.push({ workspace, modules }));

  const toggleWorkspace = (ws: string) => {
    setExpandedWorkspaces(prev => {
      const next = new Set(prev);
      if (next.has(ws)) next.delete(ws); else next.add(ws);
      return next;
    });
  };

  // ─────────────────────────────────────────────────────────────────────────

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
        title="Visibilidad de MOVI"
        description="Controla qué secciones y subsecciones ve cada rol, oficina o usuario, sin tocar código ni Supabase."
        icon={Layers}
        actions={
          <button
            onClick={fetchAll}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-xl border border-neutral-200 dark:border-white/10 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/8 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Actualizar
          </button>
        }
      />

      {/* Info banner */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/40 text-sm text-blue-800 dark:text-blue-300">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <p>
          Por defecto todo es <strong>visible</strong>. Cuando hay reglas en conflicto, gana la más específica:
          <strong> usuario &gt; oficina &gt; rol</strong>. Los Administradores siempre ven todo, sin excepción.
          En "Por Oficina" y "Por Usuario" puedes elegir varios a la vez y aplicar los cambios juntos con confirmación.
          "Por Beta" es aparte: solo <strong>agrega</strong> visibilidad extra a usuarios Beta específicos, y solo cuenta cuando ven <strong>beta.movi.digital</strong> — nunca oculta nada ni afecta producción.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-neutral-100 dark:bg-white/[0.06] rounded-2xl w-fit">
        {([['roles', 'Por Rol', Layers], ['oficinas', 'Por Oficina', Building2], ['usuarios', 'Por Usuario', UserRound], ['beta', 'Por Beta', FlaskConical]] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200',
              tab === id
                ? 'bg-white dark:bg-white/[0.12] text-neutral-900 dark:text-white shadow-sm'
                : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-white'
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'roles' && (
        <RolesTab
          modulesByWorkspace={modulesByWorkspace}
          expandedWorkspaces={expandedWorkspaces}
          toggleWorkspace={toggleWorkspace}
          getVisible={getVisible}
          toggleRule={toggleRule}
          toggleSectionRule={toggleSectionRule}
          saving={saving}
          saveResult={saveResult}
        />
      )}
      {tab === 'oficinas' && (
        <BulkTargetEditor
          targetOptions={oficinas.map(o => ({ id: o.id, label: o.nombre }))}
          emptyTargetsMessage="No hay oficinas activas registradas."
          pickerPlaceholder="Seleccionar oficinas..."
          nounSingular="oficina"
          nounPlural="oficinas"
          modulesByWorkspace={modulesByWorkspace}
          expandedWorkspaces={expandedWorkspaces}
          toggleWorkspace={toggleWorkspace}
          getCurrent={(moduleKey, targetId) => getRuleRaw(moduleKey, 'office', targetId)}
          onSave={(targetIds, changes) => applyBulkChanges('office', targetIds, changes)}
        />
      )}
      {tab === 'usuarios' && (
        <UsuarioBulkTab
          modulesByWorkspace={modulesByWorkspace}
          expandedWorkspaces={expandedWorkspaces}
          toggleWorkspace={toggleWorkspace}
          oficinas={oficinas}
          getRuleRaw={getRuleRaw}
          onSave={(targetIds, changes) => applyBulkChanges('user', targetIds, changes)}
        />
      )}
      {tab === 'beta' && (
        <BetaUsuarioBulkTab
          modulesByWorkspace={modulesByWorkspace}
          expandedWorkspaces={expandedWorkspaces}
          toggleWorkspace={toggleWorkspace}
          getRuleRaw={getRuleRaw}
          onSave={(targetIds, changes) => applyBulkChanges('beta_user', targetIds, changes)}
        />
      )}
    </div>
  );
}

// ─── Roles Tab ────────────────────────────────────────────────────────────────

interface RolesTabProps {
  modulesByWorkspace: { workspace: string; modules: ModuleRow[] }[];
  expandedWorkspaces: Set<string>;
  toggleWorkspace: (ws: string) => void;
  getVisible: (key: string, type: TargetType, value: string) => boolean;
  toggleRule: (key: string, type: TargetType, value: string, currentlyVisible: boolean) => Promise<void>;
  toggleSectionRule: (groupKey: string, moduleKeys: string[], type: TargetType, value: string, currentlyVisible: boolean) => Promise<void>;
  saving: string | null;
  saveResult: { key: string; ok: boolean } | null;
}

function RolesTab({ modulesByWorkspace, expandedWorkspaces, toggleWorkspace, getVisible, toggleRule, toggleSectionRule, saving, saveResult }: RolesTabProps) {
  return (
    <div className="space-y-3">
      {modulesByWorkspace.map(({ workspace, modules }) => {
        const expanded = expandedWorkspaces.has(workspace);
        const moduleKeys = modules.map(m => m.key);
        return (
          <WorkspaceSection
            key={workspace}
            workspace={workspace}
            modules={modules}
            expanded={expanded}
            onToggle={() => toggleWorkspace(workspace)}
            columns={ALL_ROLES}
            columnHeader={(role) => (
              <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-200 truncate">{role}</span>
            )}
            renderCell={(module, role) => {
              const k = ruleKey(module.key, 'role', role);
              const visible = getVisible(module.key, 'role', role);
              return (
                <ToggleCell
                  visible={visible}
                  isSaving={saving === k}
                  saveResult={saveResult?.key === k ? saveResult : null}
                  onToggle={() => toggleRule(module.key, 'role', role, visible)}
                />
              );
            }}
            renderSectionCell={(role) => {
              const groupKey = `section::${workspace}::role::${role}`;
              const visible = moduleKeys.every(mk => getVisible(mk, 'role', role));
              return (
                <ToggleCell
                  compact
                  visible={visible}
                  isSaving={saving === groupKey}
                  saveResult={saveResult?.key === groupKey ? saveResult : null}
                  onToggle={() => toggleSectionRule(groupKey, moduleKeys, 'role', role, visible)}
                />
              );
            }}
          />
        );
      })}
    </div>
  );
}

// ─── BulkTargetEditor (compartido por "Por Oficina" y "Por Usuario") ───────────

interface BulkTargetEditorProps {
  targetOptions: TargetOption[];
  emptyTargetsMessage: string;
  pickerPlaceholder: string;
  nounSingular: string;
  nounPlural: string;
  extraNote?: string;
  modulesByWorkspace: { workspace: string; modules: ModuleRow[] }[];
  expandedWorkspaces: Set<string>;
  toggleWorkspace: (ws: string) => void;
  /** Valor explícito actual (sin heredar) para mostrar como referencia cuando hay un solo destinatario seleccionado. */
  getCurrent: (moduleKey: string, targetId: string) => boolean | null;
  onSave: (targetIds: string[], changes: BulkChange[]) => Promise<{ ok: true } | { ok: false; message: string }>;
}

function BulkTargetEditor({
  targetOptions, emptyTargetsMessage, pickerPlaceholder, nounSingular, nounPlural, extraNote,
  modulesByWorkspace, expandedWorkspaces, toggleWorkspace, getCurrent, onSave,
}: BulkTargetEditorProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [draft, setDraft] = useState<Map<string, DraftValue>>(new Map());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const setDraftValue = (moduleKey: string, next: DraftValue | null) => {
    setDraft(prev => {
      const nextMap = new Map(prev);
      if (next === null) nextMap.delete(moduleKey); else nextMap.set(moduleKey, next);
      return nextMap;
    });
  };

  const moduleLabelByKey = useMemo(() => {
    const m = new Map<string, string>();
    for (const { workspace, modules } of modulesByWorkspace) {
      m.set(sectionDraftKey(workspace), `${workspace} (sección completa)`);
      for (const mod of modules) m.set(mod.key, `${workspace} · ${mod.label}`);
    }
    return m;
  }, [modulesByWorkspace]);

  // Lista para MOSTRAR en el modal de confirmación — compacta, sin expandir "sección completa".
  const changesList = useMemo(
    () => Array.from(draft.entries()).map(([moduleKey, action]) => ({ moduleKey, action, moduleLabel: moduleLabelByKey.get(moduleKey) ?? moduleKey })),
    [draft, moduleLabelByKey]
  );

  // Lista real a GUARDAR — expande "sección completa" a cada item real de esa sección
  // (si además hay un cambio explícito para un item puntual, ese gana sobre el de la sección).
  const buildChangesToSave = (): BulkChange[] => {
    const itemLevelKeys = new Set(Array.from(draft.keys()).filter(k => !k.startsWith(SECTION_PREFIX)));
    const result: BulkChange[] = [];
    for (const [moduleKey, action] of draft.entries()) {
      if (moduleKey.startsWith(SECTION_PREFIX)) {
        const workspace = moduleKey.slice(SECTION_PREFIX.length);
        const wsModules = modulesByWorkspace.find(w => w.workspace === workspace)?.modules ?? [];
        for (const mod of wsModules) {
          if (itemLevelKeys.has(mod.key)) continue;
          result.push({ moduleKey: mod.key, action });
        }
      } else {
        result.push({ moduleKey, action });
      }
    }
    return result;
  };

  const targetLabels = selected.map(id => targetOptions.find(o => o.id === id)?.label ?? id);

  const handleConfirm = async () => {
    setSaving(true);
    setErrorMsg(null);
    const result = await onSave(selected, buildChangesToSave());
    setSaving(false);
    if (result.ok) {
      setDraft(new Map());
      setConfirmOpen(false);
      setSuccessMsg(`Cambios aplicados a ${selected.length} ${selected.length === 1 ? nounSingular : nounPlural}.`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } else {
      setErrorMsg(result.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <MultiSelect options={targetOptions} selected={selected} onChange={setSelected} placeholder={pickerPlaceholder} />
        {successMsg && (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-4 h-4" /> {successMsg}
          </span>
        )}
      </div>

      {extraNote && <p className="text-xs text-neutral-400 dark:text-neutral-500">{extraNote}</p>}

      {targetOptions.length === 0 ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">{emptyTargetsMessage}</p>
      ) : selected.length === 0 ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400 px-1">
          Selecciona al menos {nounSingular === 'usuario' ? 'un usuario' : 'una oficina'} arriba para configurar sus secciones.
        </p>
      ) : (
        <>
          <div className="space-y-3 pb-16">
            {modulesByWorkspace.map(({ workspace, modules }) => {
              const expanded = expandedWorkspaces.has(workspace);
              const sectionKey = sectionDraftKey(workspace);
              return (
                <WorkspaceSection
                  key={workspace}
                  workspace={workspace}
                  modules={modules}
                  expanded={expanded}
                  onToggle={() => toggleWorkspace(workspace)}
                  columns={['draft']}
                  columnHeader={() => <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-200">Cambio a aplicar</span>}
                  renderCell={(module) => (
                    <DraftToggle
                      value={draft.get(module.key) ?? null}
                      current={selected.length === 1 ? getCurrent(module.key, selected[0]) : null}
                      onChange={(next) => setDraftValue(module.key, next)}
                    />
                  )}
                  renderSectionCell={() => (
                    <DraftToggle
                      compact
                      value={draft.get(sectionKey) ?? null}
                      current={null}
                      onChange={(next) => setDraftValue(sectionKey, next)}
                    />
                  )}
                />
              );
            })}
          </div>

          {draft.size > 0 && (
            <div className="fixed bottom-0 left-0 right-0 md:left-[84px] z-10 flex items-center justify-between gap-3 px-5 py-3 bg-white/95 dark:bg-[#111113]/95 backdrop-blur border-t border-neutral-200 dark:border-white/10">
              <p className="text-sm text-neutral-600 dark:text-neutral-300">
                <strong>{draft.size}</strong> cambio{draft.size > 1 ? 's' : ''} pendiente{draft.size > 1 ? 's' : ''} para{' '}
                <strong>{selected.length}</strong> {selected.length === 1 ? nounSingular : nounPlural}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDraft(new Map())}
                  className="px-3.5 py-2 rounded-xl text-sm font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/8 transition-colors"
                >
                  Descartar
                </button>
                <button
                  onClick={() => { setErrorMsg(null); setConfirmOpen(true); }}
                  className="px-4 py-2 rounded-xl text-sm font-semibold bg-accent text-white hover:bg-accent/90 transition-colors"
                >
                  Guardar cambios
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {confirmOpen && (
        <ConfirmModal
          targetLabels={targetLabels}
          changes={changesList}
          saving={saving}
          errorMsg={errorMsg}
          onCancel={() => { if (!saving) { setConfirmOpen(false); setErrorMsg(null); } }}
          onConfirm={handleConfirm}
        />
      )}
    </div>
  );
}

// ─── UsuarioBulkTab (busca usuarios y alimenta el BulkTargetEditor) ────────────

interface UsuarioBulkTabProps {
  modulesByWorkspace: { workspace: string; modules: ModuleRow[] }[];
  expandedWorkspaces: Set<string>;
  toggleWorkspace: (ws: string) => void;
  oficinas: Oficina[];
  getRuleRaw: (moduleKey: string, targetType: TargetType, targetValue: string) => boolean | null;
  onSave: (targetIds: string[], changes: BulkChange[]) => Promise<{ ok: true } | { ok: false; message: string }>;
}

function UsuarioBulkTab({ modulesByWorkspace, expandedWorkspaces, toggleWorkspace, oficinas, getRuleRaw, onSave }: UsuarioBulkTabProps) {
  const [users, setUsers] = useState<UsuarioLite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('usuarios')
        .select('id, nombre, apellidos, rol, oficina_id')
        .eq('activo', true)
        .neq('rol', 'Administrador')
        .order('nombre');
      setUsers((data ?? []) as UsuarioLite[]);
      setLoading(false);
    })();
  }, []);

  const oficinaNombre = (id: string | null) => oficinas.find(o => o.id === id)?.nombre ?? 'Sin oficina';

  const targetOptions: TargetOption[] = useMemo(
    () => users.map(u => ({ id: u.id, label: `${u.nombre} ${u.apellidos}`, sublabel: `${u.rol} · ${oficinaNombre(u.oficina_id)}` })),
    [users, oficinas]
  );

  const usersById = useMemo(() => new Map(users.map(u => [u.id, u])), [users]);

  const getCurrent = (moduleKey: string, userId: string): boolean | null => {
    const explicit = getRuleRaw(moduleKey, 'user', userId);
    if (explicit !== null) return explicit;
    const u = usersById.get(userId);
    if (!u) return null;
    if (u.oficina_id) {
      const officeVal = getRuleRaw(moduleKey, 'office', u.oficina_id);
      if (officeVal !== null) return officeVal;
    }
    const roleVal = getRuleRaw(moduleKey, 'role', u.rol);
    if (roleVal !== null) return roleVal;
    return true;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <BulkTargetEditor
      targetOptions={targetOptions}
      emptyTargetsMessage="No hay usuarios activos registrados."
      pickerPlaceholder="Seleccionar usuarios..."
      nounSingular="usuario"
      nounPlural="usuarios"
      extraNote="Los administradores no aparecen aquí — siempre ven todo, sin importar las reglas."
      modulesByWorkspace={modulesByWorkspace}
      expandedWorkspaces={expandedWorkspaces}
      toggleWorkspace={toggleWorkspace}
      getCurrent={getCurrent}
      onSave={onSave}
    />
  );
}

// ─── BetaUsuarioBulkTab (override que solo suma visibilidad, solo en beta.movi.digital) ──

interface BetaUsuarioBulkTabProps {
  modulesByWorkspace: { workspace: string; modules: ModuleRow[] }[];
  expandedWorkspaces: Set<string>;
  toggleWorkspace: (ws: string) => void;
  getRuleRaw: (moduleKey: string, targetType: TargetType, targetValue: string) => boolean | null;
  onSave: (targetIds: string[], changes: BulkChange[]) => Promise<{ ok: true } | { ok: false; message: string }>;
}

function BetaUsuarioBulkTab({ modulesByWorkspace, expandedWorkspaces, toggleWorkspace, getRuleRaw, onSave }: BetaUsuarioBulkTabProps) {
  const [users, setUsers] = useState<UsuarioLite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: betaRows } = await supabase.from('usuarios_beta').select('usuario_id');
      const betaIds = (betaRows ?? []).map((b: any) => b.usuario_id);
      if (betaIds.length === 0) { setUsers([]); setLoading(false); return; }
      const { data } = await supabase
        .from('usuarios')
        .select('id, nombre, apellidos, rol, oficina_id')
        .in('id', betaIds)
        .eq('activo', true)
        .order('nombre');
      setUsers((data ?? []) as UsuarioLite[]);
      setLoading(false);
    })();
  }, []);

  const targetOptions: TargetOption[] = useMemo(
    () => users.map(u => ({ id: u.id, label: `${u.nombre} ${u.apellidos}`, sublabel: u.rol })),
    [users]
  );

  const getCurrent = (moduleKey: string, userId: string): boolean | null => getRuleRaw(moduleKey, 'beta_user', userId);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <BulkTargetEditor
      targetOptions={targetOptions}
      emptyTargetsMessage="No hay usuarios Beta registrados todavía (Admin > Usuarios → botón 'Agregar a Beta')."
      pickerPlaceholder="Seleccionar usuarios Beta..."
      nounSingular="usuario"
      nounPlural="usuarios"
      extraNote="Este override solo SUMA visibilidad (nunca oculta) y solo aplica cuando el usuario ve beta.movi.digital — en producción no tiene ningún efecto."
      modulesByWorkspace={modulesByWorkspace}
      expandedWorkspaces={expandedWorkspaces}
      toggleWorkspace={toggleWorkspace}
      getCurrent={getCurrent}
      onSave={onSave}
    />
  );
}

// ─── MultiSelect ────────────────────────────────────────────────────────────────

function MultiSelect({ options, selected, onChange, placeholder }: {
  options: TargetOption[]; selected: string[]; onChange: (ids: string[]) => void; placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter(o => o.label.toLowerCase().includes(q) || o.sublabel?.toLowerCase().includes(q));
  }, [options, search]);

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id]);
  };

  const label = selected.length === 0 ? placeholder : `${selected.length} seleccionado${selected.length > 1 ? 's' : ''}`;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'inline-flex items-center justify-between gap-2 min-w-[240px] px-3.5 py-2.5 rounded-xl text-sm font-medium border transition-colors',
          selected.length > 0
            ? 'bg-accent/10 border-accent/40 text-accent'
            : 'bg-white dark:bg-[#111113] border-neutral-200 dark:border-white/10 text-neutral-600 dark:text-neutral-300'
        )}
      >
        {label}
        <ChevronDown className={cn('w-4 h-4 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute z-20 mt-1.5 w-80 max-h-96 overflow-hidden flex flex-col rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-[#16161a] shadow-xl">
          <div className="p-2 border-b border-neutral-100 dark:border-white/[0.06] flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="w-full pl-7 pr-2 py-1.5 rounded-lg text-sm bg-neutral-100 dark:bg-white/[0.06] text-neutral-800 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none"
              />
            </div>
            {selected.length > 0 && (
              <button onClick={() => onChange([])} className="text-xs font-medium text-neutral-500 hover:text-red-500 whitespace-nowrap">
                Limpiar
              </button>
            )}
          </div>
          <div className="overflow-y-auto flex-1">
            {filtered.map(o => {
              const checked = selected.includes(o.id);
              return (
                <button
                  key={o.id}
                  onClick={() => toggle(o.id)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-neutral-50 dark:hover:bg-white/[0.04] transition-colors"
                >
                  <div className={cn(
                    'w-4 h-4 rounded flex items-center justify-center border flex-shrink-0',
                    checked ? 'bg-accent border-accent' : 'border-neutral-300 dark:border-white/20'
                  )}>
                    {checked && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-neutral-800 dark:text-neutral-100 truncate">{o.label}</p>
                    {o.sublabel && <p className="text-xs text-neutral-400 dark:text-neutral-500 truncate">{o.sublabel}</p>}
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 && <p className="px-3 py-6 text-sm text-center text-neutral-400">Sin resultados.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ConfirmModal ─────────────────────────────────────────────────────────────

function ConfirmModal({ targetLabels, changes, saving, errorMsg, onCancel, onConfirm }: {
  targetLabels: string[];
  changes: { moduleLabel: string; action: DraftValue }[];
  saving: boolean;
  errorMsg: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onCancel}>
      <div
        className="w-full max-w-md rounded-2xl bg-white dark:bg-[#16161a] border border-neutral-200 dark:border-white/10 shadow-2xl p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-4.5 h-4.5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-neutral-800 dark:text-white">Confirmar cambios de visibilidad</h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              Se aplicará a {targetLabels.length} {targetLabels.length === 1 ? 'destinatario' : 'destinatarios'}:{' '}
              {targetLabels.slice(0, 5).join(', ')}{targetLabels.length > 5 ? ` y ${targetLabels.length - 5} más` : ''}.
            </p>
          </div>
        </div>

        <div className="max-h-48 overflow-y-auto rounded-xl border border-neutral-100 dark:border-white/[0.06] divide-y divide-neutral-100 dark:divide-white/[0.05]">
          {changes.map((c, i) => (
            <div key={i} className="flex items-center justify-between px-3 py-2 text-sm gap-3">
              <span className="text-neutral-700 dark:text-neutral-200 truncate">{c.moduleLabel}</span>
              <span className={cn(
                'text-xs font-semibold px-2 py-0.5 rounded-lg flex-shrink-0',
                c.action === 'visible' && 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400',
                c.action === 'oculto' && 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400',
                c.action === 'hereda' && 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400',
              )}>
                {c.action === 'visible' ? 'Visible' : c.action === 'oculto' ? 'Oculto' : 'Hereda'}
              </span>
            </div>
          ))}
        </div>

        {errorMsg && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 text-xs text-red-700 dark:text-red-400">
            <XCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onCancel}
            disabled={saving}
            className="px-3.5 py-2 rounded-xl text-sm font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/8 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={saving}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold bg-accent text-white hover:bg-accent/90 transition-colors disabled:opacity-60"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {saving ? 'Guardando...' : errorMsg ? 'Reintentar' : 'Confirmar y guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── WorkspaceSection ─────────────────────────────────────────────────────────

interface WorkspaceSectionProps<C> {
  workspace: string;
  modules: ModuleRow[];
  expanded: boolean;
  onToggle: () => void;
  columns: C[];
  columnHeader: (col: C) => React.ReactNode;
  renderCell: (module: ModuleRow, col: C) => React.ReactNode;
  /** Optional control to toggle the whole section (workspace) at once, shown in the header. */
  renderSectionCell?: (col: C) => React.ReactNode;
}

function WorkspaceSection<C>({ workspace, modules, expanded, onToggle, columns, columnHeader, renderCell, renderSectionCell }: WorkspaceSectionProps<C>) {
  return (
    <div className="rounded-2xl border border-neutral-200 dark:border-white/[0.08] bg-white dark:bg-[#111113] overflow-hidden">
      {/* Header */}
      <div className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-neutral-50 dark:hover:bg-white/[0.04] transition-colors">
        <button onClick={onToggle} className="flex items-center gap-2 text-left flex-1 min-w-0">
          <span className="text-sm font-semibold text-neutral-800 dark:text-white">{workspace}</span>
          <span className="text-xs text-neutral-400 dark:text-neutral-500">{modules.length} subsecciones</span>
        </button>
        <div className="flex items-center gap-3">
          {renderSectionCell && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-400 dark:text-neutral-500 hidden sm:inline">Toda la sección:</span>
              {columns.map((col, i) => <span key={i}>{renderSectionCell(col)}</span>)}
            </div>
          )}
          <button onClick={onToggle} className="text-neutral-400 dark:text-neutral-500">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[500px]">
            <thead>
              <tr className="border-t border-neutral-100 dark:border-white/[0.06] bg-neutral-50/60 dark:bg-white/[0.025]">
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-neutral-500 dark:text-neutral-400 w-48">Subsección</th>
                {columns.map((col, i) => (
                  <th key={i} className="px-4 py-2.5 text-center min-w-[110px]">
                    {columnHeader(col)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-white/[0.05]">
              {modules.map(mod => (
                <tr key={mod.key} className="hover:bg-neutral-50/60 dark:hover:bg-white/[0.025] transition-colors">
                  <td className="px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-neutral-800 dark:text-neutral-100">{mod.label}</p>
                      <p className="text-xs text-neutral-400 dark:text-neutral-500 font-mono">{mod.key}</p>
                    </div>
                  </td>
                  {columns.map((col, i) => (
                    <td key={i} className="px-4 py-3 text-center">
                      {renderCell(mod, col)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── ToggleCell (binario: usado en Rol) ────────────────────────────────────────

interface ToggleCellProps {
  visible: boolean;
  isSaving: boolean;
  saveResult: { key: string; ok: boolean } | null;
  onToggle: () => void;
  compact?: boolean;
}

function ToggleCell({ visible, isSaving, saveResult, onToggle, compact }: ToggleCellProps) {
  if (isSaving) {
    return (
      <div className="flex items-center justify-center">
        <Loader2 className="w-4 h-4 animate-spin text-accent" />
      </div>
    );
  }

  if (saveResult) {
    return (
      <div className="flex items-center justify-center">
        {saveResult.ok
          ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          : <XCircle className="w-4 h-4 text-red-500" />
        }
      </div>
    );
  }

  return (
    <button
      onClick={onToggle}
      title={visible ? 'Ocultar' : 'Mostrar'}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-xl text-xs font-semibold border transition-all duration-200 hover:scale-105 active:scale-95',
        compact ? 'px-2.5 py-1' : 'px-3 py-1.5',
        visible
          ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'
          : 'bg-neutral-100 dark:bg-white/[0.06] border-neutral-200 dark:border-white/10 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-white/[0.1]'
      )}
    >
      {visible
        ? <><Eye className="w-3 h-3" /> Visible</>
        : <><EyeOff className="w-3 h-3" /> Oculto</>
      }
    </button>
  );
}

// ─── DraftToggle (4 estados, sin guardar hasta confirmar: usado en Oficina/Usuario) ──

interface DraftToggleProps {
  /** null = sin cambios (no se toca al guardar) */
  value: DraftValue | null;
  /** Valor explícito actual, solo se muestra como referencia si hay un único destinatario seleccionado. */
  current: boolean | null;
  onChange: (next: DraftValue | null) => void;
  compact?: boolean;
}

function DraftToggle({ value, current, onChange, compact }: DraftToggleProps) {
  const cycle = () => {
    if (value === null) onChange('visible');
    else if (value === 'visible') onChange('oculto');
    else if (value === 'oculto') onChange('hereda');
    else onChange(null);
  };

  const currentLabel = current === null ? null : current ? 'visible' : 'oculto';

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        onClick={cycle}
        title={value === null ? 'Sin cambios — clic para editar' : `Se aplicará: ${value}`}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-xl text-xs font-semibold border transition-all duration-200 hover:scale-105 active:scale-95',
          compact ? 'px-2.5 py-1' : 'px-3 py-1.5',
          value === null && 'bg-neutral-50 dark:bg-white/[0.04] border-dashed border-neutral-300 dark:border-white/15 text-neutral-400 dark:text-neutral-500',
          value === 'visible' && 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-400',
          value === 'oculto' && 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800/40 text-red-600 dark:text-red-400',
          value === 'hereda' && 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/40 text-blue-600 dark:text-blue-400',
        )}
      >
        {value === null && 'Sin cambios'}
        {value === 'visible' && <><Eye className="w-3 h-3" /> Visible</>}
        {value === 'oculto' && <><EyeOff className="w-3 h-3" /> Oculto</>}
        {value === 'hereda' && <><Undo2 className="w-3 h-3" /> Hereda</>}
      </button>
      {currentLabel && !compact && (
        <span className="text-[10px] text-neutral-400 dark:text-neutral-500">actual: {currentLabel}</span>
      )}
    </div>
  );
}
