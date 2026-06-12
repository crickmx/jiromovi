import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { invalidateModuleVisibilityCache } from '../lib/useModuleVisibility';
import { PageHeader } from '@/components/ui/page-header';
import { Layers, Building2, RefreshCw, CircleCheck as CheckCircle2, Circle as XCircle, Loader as Loader2, ChevronDown, ChevronUp, Eye, EyeOff, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TOP_LEVEL_ITEMS, WORKSPACES } from '@/lib/workspaceConfig';
import type { UserRole } from '@/lib/workspaceConfig';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ModuleRow {
  key: string;     // path used as key, e.g. '/entrega-polizas'
  label: string;
  workspace: string;
}

interface VisibilityRule {
  id?: string;
  module_key: string;
  target_type: 'role' | 'office';
  target_value: string;
  visible: boolean;
}

interface Oficina {
  id: string;
  nombre: string;
}

const ALL_ROLES: UserRole[] = ['Administrador', 'Gerente', 'Empleado', 'Ejecutivo', 'Agente'];

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

// ─── RuleMap helpers ─────────────────────────────────────────────────────────

function ruleKey(moduleKey: string, targetType: 'role' | 'office', targetValue: string) {
  return `${moduleKey}||${targetType}||${targetValue}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

type TabId = 'roles' | 'oficinas';

export default function ModulosAdmin() {
  const { usuario } = useAuth();
  const [tab, setTab] = useState<TabId>('roles');
  const [rules, setRules] = useState<Map<string, VisibilityRule>>(new Map());
  const [oficinas, setOficinas] = useState<Oficina[]>([]);
  const [selectedOficina, setSelectedOficina] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null); // key being saved
  const [saveResult, setSaveResult] = useState<{ key: string; ok: boolean } | null>(null);
  const [expandedWorkspaces, setExpandedWorkspaces] = useState<Set<string>>(new Set(WORKSPACES.map(w => w.id)));

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: rulesData }, { data: oficinasData }] = await Promise.all([
      supabase.from('module_visibility').select('id, module_key, target_type, target_value, visible'),
      supabase.from('oficinas').select('id, nombre').eq('activa', true).order('nombre'),
    ]);

    const map = new Map<string, VisibilityRule>();
    for (const r of rulesData ?? []) {
      map.set(ruleKey(r.module_key, r.target_type, r.target_value), r as VisibilityRule);
    }
    setRules(map);
    const ofs = (oficinasData ?? []) as Oficina[];
    setOficinas(ofs);
    if (!selectedOficina && ofs.length > 0) setSelectedOficina(ofs[0].id);
    setLoading(false);
  }, [selectedOficina]);

  useEffect(() => { fetchAll(); }, []);

  // ── Toggle ─────────────────────────────────────────────────────────────────

  const toggleRule = async (moduleKey: string, targetType: 'role' | 'office', targetValue: string, currentlyVisible: boolean) => {
    const k = ruleKey(moduleKey, targetType, targetValue);
    const existing = rules.get(k);
    const newVisible = !currentlyVisible;
    setSaving(k);
    setSaveResult(null);

    let error: unknown = null;

    if (existing?.id) {
      // Update
      const { error: e } = await supabase
        .from('module_visibility')
        .update({ visible: newVisible, updated_by: usuario?.id, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
      error = e;
    } else {
      // Insert
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

  // ── Visibility getter ──────────────────────────────────────────────────────

  const getVisible = (moduleKey: string, targetType: 'role' | 'office', targetValue: string): boolean => {
    const r = rules.get(ruleKey(moduleKey, targetType, targetValue));
    return r ? r.visible : true; // default: visible
  };

  // ── Grouped modules ────────────────────────────────────────────────────────

  const modulesByWorkspace: { workspace: string; modules: ModuleRow[] }[] = [];
  const wsMap = new Map<string, ModuleRow[]>();
  for (const m of ALL_MODULES) {
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
        title="Visibilidad de Modulos"
        description="Controla que modulos son visibles para cada rol o cada oficina sin modificar el codigo."
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
          Por defecto todos los modulos son <strong>visibles</strong>. Usa los controles para <strong>ocultar</strong> un modulo a un rol o una oficina especifica.
          Los cambios aplican inmediatamente para los usuarios al recargar la pagina.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-neutral-100 dark:bg-white/[0.06] rounded-2xl w-fit">
        {([['roles', 'Por Rol', Layers], ['oficinas', 'Por Oficina', Building2]] as const).map(([id, label, Icon]) => (
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
      {tab === 'roles' ? (
        <RolesTab
          modulesByWorkspace={modulesByWorkspace}
          expandedWorkspaces={expandedWorkspaces}
          toggleWorkspace={toggleWorkspace}
          getVisible={getVisible}
          toggleRule={toggleRule}
          saving={saving}
          saveResult={saveResult}
        />
      ) : (
        <OficinaTab
          modulesByWorkspace={modulesByWorkspace}
          expandedWorkspaces={expandedWorkspaces}
          toggleWorkspace={toggleWorkspace}
          oficinas={oficinas}
          selectedOficina={selectedOficina}
          setSelectedOficina={setSelectedOficina}
          getVisible={getVisible}
          toggleRule={toggleRule}
          saving={saving}
          saveResult={saveResult}
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
  getVisible: (key: string, type: 'role' | 'office', value: string) => boolean;
  toggleRule: (key: string, type: 'role' | 'office', value: string, currentlyVisible: boolean) => Promise<void>;
  saving: string | null;
  saveResult: { key: string; ok: boolean } | null;
}

function RolesTab({ modulesByWorkspace, expandedWorkspaces, toggleWorkspace, getVisible, toggleRule, saving, saveResult }: RolesTabProps) {
  return (
    <div className="space-y-3">
      {modulesByWorkspace.map(({ workspace, modules }) => {
        const expanded = expandedWorkspaces.has(workspace);
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
                  moduleKey={module.key}
                  targetType="role"
                  targetValue={role}
                  visible={visible}
                  isSaving={saving === k}
                  saveResult={saveResult?.key === k ? saveResult : null}
                  onToggle={() => toggleRule(module.key, 'role', role, visible)}
                />
              );
            }}
          />
        );
      })}
    </div>
  );
}

// ─── Oficina Tab ──────────────────────────────────────────────────────────────

interface OficinaTabProps {
  modulesByWorkspace: { workspace: string; modules: ModuleRow[] }[];
  expandedWorkspaces: Set<string>;
  toggleWorkspace: (ws: string) => void;
  oficinas: Oficina[];
  selectedOficina: string;
  setSelectedOficina: (id: string) => void;
  getVisible: (key: string, type: 'role' | 'office', value: string) => boolean;
  toggleRule: (key: string, type: 'role' | 'office', value: string, currentlyVisible: boolean) => Promise<void>;
  saving: string | null;
  saveResult: { key: string; ok: boolean } | null;
}

function OficinaTab({ modulesByWorkspace, expandedWorkspaces, toggleWorkspace, oficinas, selectedOficina, setSelectedOficina, getVisible, toggleRule, saving, saveResult }: OficinaTabProps) {
  const selected = oficinas.find(o => o.id === selectedOficina);

  return (
    <div className="space-y-4">
      {/* Oficina picker */}
      <div className="flex flex-wrap gap-2">
        {oficinas.map(o => (
          <button
            key={o.id}
            onClick={() => setSelectedOficina(o.id)}
            className={cn(
              'px-3.5 py-1.5 rounded-xl text-sm font-medium border transition-all duration-200',
              o.id === selectedOficina
                ? 'bg-accent text-white border-accent shadow-sm'
                : 'bg-white dark:bg-white/[0.06] border-neutral-200 dark:border-white/10 text-neutral-700 dark:text-neutral-300 hover:border-accent/50 hover:text-accent'
            )}
          >
            {o.nombre}
          </button>
        ))}
        {oficinas.length === 0 && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">No hay oficinas activas registradas.</p>
        )}
      </div>

      {selected && (
        <div className="space-y-3">
          {modulesByWorkspace.map(({ workspace, modules }) => {
            const expanded = expandedWorkspaces.has(workspace);
            return (
              <WorkspaceSection
                key={workspace}
                workspace={workspace}
                modules={modules}
                expanded={expanded}
                onToggle={() => toggleWorkspace(workspace)}
                columns={[selected.nombre]}
                columnHeader={() => (
                  <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-200 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-accent" />
                    {selected.nombre}
                  </span>
                )}
                renderCell={(module) => {
                  const k = ruleKey(module.key, 'office', selected.id);
                  const visible = getVisible(module.key, 'office', selected.id);
                  return (
                    <ToggleCell
                      moduleKey={module.key}
                      targetType="office"
                      targetValue={selected.id}
                      visible={visible}
                      isSaving={saving === k}
                      saveResult={saveResult?.key === k ? saveResult : null}
                      onToggle={() => toggleRule(module.key, 'office', selected.id, visible)}
                    />
                  );
                }}
              />
            );
          })}
        </div>
      )}
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
}

function WorkspaceSection<C>({ workspace, modules, expanded, onToggle, columns, columnHeader, renderCell }: WorkspaceSectionProps<C>) {
  return (
    <div className="rounded-2xl border border-neutral-200 dark:border-white/[0.08] bg-white dark:bg-[#111113] overflow-hidden">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-neutral-50 dark:hover:bg-white/[0.04] transition-colors"
      >
        <span className="text-sm font-semibold text-neutral-800 dark:text-white">{workspace}</span>
        <div className="flex items-center gap-2 text-neutral-400 dark:text-neutral-500">
          <span className="text-xs">{modules.length} modulos</span>
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {expanded && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[500px]">
            <thead>
              <tr className="border-t border-neutral-100 dark:border-white/[0.06] bg-neutral-50/60 dark:bg-white/[0.025]">
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-neutral-500 dark:text-neutral-400 w-48">Modulo</th>
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

// ─── ToggleCell ───────────────────────────────────────────────────────────────

interface ToggleCellProps {
  moduleKey: string;
  targetType: 'role' | 'office';
  targetValue: string;
  visible: boolean;
  isSaving: boolean;
  saveResult: { key: string; ok: boolean } | null;
  onToggle: () => void;
}

function ToggleCell({ visible, isSaving, saveResult, onToggle }: ToggleCellProps) {
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
      title={visible ? 'Ocultar modulo' : 'Mostrar modulo'}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all duration-200 hover:scale-105 active:scale-95',
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
