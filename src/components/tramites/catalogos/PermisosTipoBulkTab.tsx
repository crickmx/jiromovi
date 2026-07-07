import { useState, useEffect, useMemo, useRef, useCallback, Fragment } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../lib/supabase';
import {
  ChevronDown, ChevronUp, Search, Check, AlertTriangle,
  Loader as Loader2, Circle as XCircle,
} from 'lucide-react';

/**
 * Vista masiva (matriz) sobre las mismas tablas que ya usa PermisosPanel
 * (tramite_tipo_rol_permisos / tramite_tipo_usuario_override), para no
 * tener que entrar tipo por tipo cuando se quiere configurar por rol o
 * por varios usuarios a la vez.
 */

const ROLES_CONFIGURABLES = ['Agente', 'Empleado', 'Gerente'] as const;

interface TipoRow {
  id: string;
  value: string;
  label: string;
  area: string;
}

interface RolPermisoRow {
  tramite_tipo_id: string;
  rol: string;
  puede_ver: boolean;
  puede_crear: boolean;
  puede_editar: boolean;
}

interface OverrideRow {
  tramite_tipo_id: string;
  user_id: string;
  puede_ver: boolean | null;
  puede_crear: boolean | null;
  puede_editar: boolean | null;
}

interface UsuarioLite {
  id: string;
  nombre: string;
  apellidos: string;
  rol: string;
}

type Field = 'puede_ver' | 'puede_crear' | 'puede_editar';
const FIELDS: readonly Field[] = ['puede_ver', 'puede_crear', 'puede_editar'];
const FIELD_LABEL: Record<Field, string> = { puede_ver: 'Ver', puede_crear: 'Crear', puede_editar: 'Editar' };
type DraftValue = 'permitir' | 'bloquear' | 'hereda';

function rolKey(tipoId: string, rol: string) { return `${tipoId}::${rol}`; }
function userKey(tipoId: string, userId: string) { return `${tipoId}::${userId}`; }
function draftKey(tipoId: string, field: Field) { return `${tipoId}::${field}`; }

export function PermisosTipoBulkTab() {
  const { usuario } = useAuth();
  const [subTab, setSubTab] = useState<'rol' | 'usuario'>('rol');
  const [tipos, setTipos] = useState<TipoRow[]>([]);
  const [rolPermisos, setRolPermisos] = useState<Map<string, RolPermisoRow>>(new Map());
  const [overrides, setOverrides] = useState<Map<string, OverrideRow>>(new Map());
  const [users, setUsers] = useState<UsuarioLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedAreas, setExpandedAreas] = useState<Set<string>>(new Set());

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: tiposData }, { data: rolData }, { data: overData }, { data: usersData }] = await Promise.all([
      supabase.from('ticket_tipos').select('id, value, label, area').eq('activo', true).order('area').order('orden'),
      supabase.from('tramite_tipo_rol_permisos').select('tramite_tipo_id, rol, puede_ver, puede_crear, puede_editar'),
      supabase.from('tramite_tipo_usuario_override').select('tramite_tipo_id, user_id, puede_ver, puede_crear, puede_editar'),
      supabase.from('usuarios').select('id, nombre, apellidos, rol').eq('activo', true).in('rol', ROLES_CONFIGURABLES as unknown as string[]).order('nombre'),
    ]);
    const tp = (tiposData ?? []) as TipoRow[];
    setTipos(tp);
    setExpandedAreas(prev => (prev.size > 0 ? prev : new Set(tp.map(t => t.area))));
    setRolPermisos(new Map((rolData ?? []).map((r: any) => [rolKey(r.tramite_tipo_id, r.rol), r as RolPermisoRow])));
    setOverrides(new Map((overData ?? []).map((o: any) => [userKey(o.tramite_tipo_id, o.user_id), o as OverrideRow])));
    setUsers((usersData ?? []) as UsuarioLite[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const tiposByArea = useMemo(() => {
    const map = new Map<string, TipoRow[]>();
    for (const t of tipos) {
      if (!map.has(t.area)) map.set(t.area, []);
      map.get(t.area)!.push(t);
    }
    return Array.from(map.entries()).map(([area, items]) => ({ area, items }));
  }, [tipos]);

  const toggleArea = (area: string) => {
    setExpandedAreas(prev => {
      const next = new Set(prev);
      if (next.has(area)) next.delete(area); else next.add(area);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
        <strong>Ver</strong> = aparece como opción al crear un trámite nuevo. <strong>Crear</strong> = puede efectivamente crearlo.
        <strong> Editar</strong> = puede modificar un trámite de este tipo después de creado.
        Administrador y Gerente siempre tienen acceso total, sin importar esta configuración.
      </div>

      <div className="flex gap-1 p-1 bg-neutral-100 rounded-xl w-fit">
        {([['rol', 'Por Rol'], ['usuario', 'Por Usuario']] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setSubTab(id)}
            className={[
              'px-4 py-1.5 rounded-lg text-sm font-medium transition-colors',
              subTab === id ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {subTab === 'rol' ? (
        <RolMatrixTab
          tiposByArea={tiposByArea}
          expandedAreas={expandedAreas}
          toggleArea={toggleArea}
          rolPermisos={rolPermisos}
          setRolPermisos={setRolPermisos}
          usuarioId={usuario?.id}
        />
      ) : (
        <UsuarioBulkPermisosTab
          tiposByArea={tiposByArea}
          expandedAreas={expandedAreas}
          toggleArea={toggleArea}
          overrides={overrides}
          users={users}
          usuarioId={usuario?.id}
          onSaved={fetchAll}
        />
      )}
    </div>
  );
}

// ─── Por Rol (inmediato, como PermisosPanel pero para todos los tipos a la vez) ──

interface RolMatrixTabProps {
  tiposByArea: { area: string; items: TipoRow[] }[];
  expandedAreas: Set<string>;
  toggleArea: (area: string) => void;
  rolPermisos: Map<string, RolPermisoRow>;
  setRolPermisos: React.Dispatch<React.SetStateAction<Map<string, RolPermisoRow>>>;
  usuarioId: string | undefined;
}

function RolMatrixTab({ tiposByArea, expandedAreas, toggleArea, rolPermisos, setRolPermisos, usuarioId }: RolMatrixTabProps) {
  const [saving, setSaving] = useState<string | null>(null);

  const getValue = (tipoId: string, rol: string, field: Field): boolean =>
    rolPermisos.get(rolKey(tipoId, rol))?.[field] ?? true;

  const toggle = async (tipoId: string, rol: string, field: Field) => {
    const cellId = `${rolKey(tipoId, rol)}::${field}`;
    const next = !getValue(tipoId, rol, field);
    setSaving(cellId);
    const { error } = await supabase
      .from('tramite_tipo_rol_permisos')
      .upsert({ tramite_tipo_id: tipoId, rol, [field]: next, updated_by: usuarioId }, { onConflict: 'tramite_tipo_id,rol' });
    if (!error) {
      setRolPermisos(prev => {
        const nextMap = new Map(prev);
        const existing = nextMap.get(rolKey(tipoId, rol));
        nextMap.set(rolKey(tipoId, rol), {
          tramite_tipo_id: tipoId, rol, puede_ver: true, puede_crear: true, puede_editar: true, ...existing, [field]: next,
        });
        return nextMap;
      });
    }
    setSaving(null);
  };

  return (
    <div className="space-y-3">
      {tiposByArea.map(({ area, items }) => {
        const expanded = expandedAreas.has(area);
        return (
          <div key={area} className="border border-neutral-200 rounded-xl overflow-hidden bg-white">
            <button
              onClick={() => toggleArea(area)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-neutral-50 transition-colors"
            >
              <span className="text-sm font-semibold text-neutral-800">{area}</span>
              <div className="flex items-center gap-2 text-neutral-400">
                <span className="text-xs">{items.length} tipos</span>
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </button>
            {expanded && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50">
                    <tr>
                      <th className="text-left px-4 py-2 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider" rowSpan={2}>Tipo</th>
                      {ROLES_CONFIGURABLES.map(rol => (
                        <th key={rol} colSpan={3} className="px-4 py-1.5 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider text-center border-l border-neutral-100">
                          {rol}
                        </th>
                      ))}
                    </tr>
                    <tr>
                      {ROLES_CONFIGURABLES.map(rol => (
                        <Fragment key={rol}>
                          {FIELDS.map((f, i) => (
                            <th key={f} className={`px-2 py-1 text-[10px] font-medium text-neutral-400 ${i === 0 ? 'border-l border-neutral-100' : ''}`}>
                              {FIELD_LABEL[f]}
                            </th>
                          ))}
                        </Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {items.map(tipo => (
                      <tr key={tipo.id} className="hover:bg-neutral-50">
                        <td className="px-4 py-2 text-sm text-neutral-800">{tipo.label}</td>
                        {ROLES_CONFIGURABLES.map(rol => (
                          <Fragment key={rol}>
                            {FIELDS.map(field => {
                              const cellId = `${rolKey(tipo.id, rol)}::${field}`;
                              const active = getValue(tipo.id, rol, field);
                              const isSaving = saving === cellId;
                              return (
                                <td
                                  key={field}
                                  className={`px-2 py-2 text-center ${field === 'puede_ver' ? 'border-l border-neutral-100' : ''}`}
                                >
                                  {isSaving ? (
                                    <Loader2 className="w-4 h-4 animate-spin text-neutral-400 mx-auto" />
                                  ) : (
                                    <button
                                      onClick={() => toggle(tipo.id, rol, field)}
                                      title={field === 'puede_ver' ? 'Puede ver este tipo al crear' : field === 'puede_crear' ? 'Puede crear este tipo' : 'Puede editar un trámite de este tipo después de creado'}
                                      className={[
                                        'w-6 h-6 rounded-md border-2 transition-colors mx-auto flex items-center justify-center text-xs',
                                        active
                                          ? 'bg-green-600 border-green-600 text-white'
                                          : 'border-neutral-300 bg-white hover:border-red-400 hover:bg-red-50 hover:text-red-600',
                                      ].join(' ')}
                                    >
                                      {active ? '✓' : '✗'}
                                    </button>
                                  )}
                                </td>
                              );
                            })}
                          </Fragment>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Por Usuario (borrador + confirmación, varios usuarios a la vez) ────────────

interface UsuarioBulkPermisosTabProps {
  tiposByArea: { area: string; items: TipoRow[] }[];
  expandedAreas: Set<string>;
  toggleArea: (area: string) => void;
  overrides: Map<string, OverrideRow>;
  users: UsuarioLite[];
  usuarioId: string | undefined;
  onSaved: () => void;
}

function UsuarioBulkPermisosTab({ tiposByArea, expandedAreas, toggleArea, overrides, users, usuarioId, onSaved }: UsuarioBulkPermisosTabProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [draft, setDraft] = useState<Map<string, DraftValue>>(new Map()); // key = draftKey(tipoId, field)
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const setDraftValue = (tipoId: string, field: Field, next: DraftValue | null) => {
    setDraft(prev => {
      const nextMap = new Map(prev);
      const k = draftKey(tipoId, field);
      if (next === null) nextMap.delete(k); else nextMap.set(k, next);
      return nextMap;
    });
  };

  const cycle = (tipoId: string, field: Field) => {
    const current = draft.get(draftKey(tipoId, field)) ?? null;
    if (current === null) setDraftValue(tipoId, field, 'permitir');
    else if (current === 'permitir') setDraftValue(tipoId, field, 'bloquear');
    else if (current === 'bloquear') setDraftValue(tipoId, field, 'hereda');
    else setDraftValue(tipoId, field, null);
  };

  const tipoLabelById = useMemo(() => {
    const m = new Map<string, string>();
    for (const { area, items } of tiposByArea) for (const t of items) m.set(t.id, `${area} · ${t.label}`);
    return m;
  }, [tiposByArea]);

  const changesList = useMemo(() => Array.from(draft.entries()).map(([k, action]) => {
    const [tipoId, field] = k.split('::') as [string, Field];
    return { tipoId, field, action, label: `${tipoLabelById.get(tipoId) ?? tipoId} — ${FIELD_LABEL[field]}` };
  }), [draft, tipoLabelById]);

  const userOptions = useMemo(
    () => users.map(u => ({ id: u.id, label: `${u.nombre} ${u.apellidos}`, sublabel: u.rol })),
    [users]
  );

  const selectedLabels = selected.map(id => userOptions.find(o => o.id === id)?.label ?? id);

  const getCurrent = (tipoId: string, field: Field, userId: string): boolean | null => {
    const o = overrides.get(userKey(tipoId, userId));
    return o ? (o[field] ?? null) : null;
  };

  const handleConfirm = async () => {
    setSaving(true);
    setErrorMsg(null);

    const rowsMap = new Map<string, Record<string, unknown>>();
    for (const { tipoId, field, action } of changesList) {
      for (const uId of selected) {
        const rk = `${tipoId}::${uId}`;
        const row = rowsMap.get(rk) ?? { tramite_tipo_id: tipoId, user_id: uId, updated_by: usuarioId, updated_at: new Date().toISOString() };
        row[field] = action === 'permitir' ? true : action === 'bloquear' ? false : null;
        rowsMap.set(rk, row);
      }
    }
    const rows = Array.from(rowsMap.values());

    try {
      if (rows.length > 0) {
        const { error } = await supabase
          .from('tramite_tipo_usuario_override')
          .upsert(rows, { onConflict: 'tramite_tipo_id,user_id' });
        if (error) throw error;
      }
      setDraft(new Map());
      setConfirmOpen(false);
      setSuccessMsg(`Cambios aplicados a ${selected.length} usuario${selected.length > 1 ? 's' : ''}.`);
      setTimeout(() => setSuccessMsg(null), 4000);
      onSaved();
    } catch (e: any) {
      setErrorMsg(e?.message ?? 'Error al guardar los cambios.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <MultiSelectUsers options={userOptions} selected={selected} onChange={setSelected} />
        {successMsg && <span className="text-sm font-medium text-green-700">{successMsg}</span>}
      </div>

      {users.length === 0 ? (
        <p className="text-sm text-neutral-500">No hay usuarios activos con rol Agente, Empleado o Gerente.</p>
      ) : selected.length === 0 ? (
        <p className="text-sm text-neutral-500 px-1">Selecciona al menos un usuario arriba para configurar sus permisos por tipo.</p>
      ) : (
        <>
          <div className="space-y-3 pb-16">
            {tiposByArea.map(({ area, items }) => {
              const expanded = expandedAreas.has(area);
              return (
                <div key={area} className="border border-neutral-200 rounded-xl overflow-hidden bg-white">
                  <button
                    onClick={() => toggleArea(area)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-neutral-50 transition-colors"
                  >
                    <span className="text-sm font-semibold text-neutral-800">{area}</span>
                    <div className="flex items-center gap-2 text-neutral-400">
                      <span className="text-xs">{items.length} tipos</span>
                      {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </button>
                  {expanded && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-neutral-50">
                          <tr>
                            <th className="text-left px-4 py-2 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Tipo</th>
                            {FIELDS.map(f => (
                              <th key={f} className="px-3 py-2 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider text-center">{FIELD_LABEL[f]}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100">
                          {items.map(tipo => (
                            <tr key={tipo.id} className="hover:bg-neutral-50">
                              <td className="px-4 py-2 text-sm text-neutral-800">{tipo.label}</td>
                              {FIELDS.map(field => (
                                <td key={field} className="px-3 py-2 text-center">
                                  <DraftPermButton
                                    value={draft.get(draftKey(tipo.id, field)) ?? null}
                                    current={selected.length === 1 ? getCurrent(tipo.id, field, selected[0]) : null}
                                    onClick={() => cycle(tipo.id, field)}
                                  />
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
            })}
          </div>

          {draft.size > 0 && (
            <div className="fixed bottom-0 left-0 right-0 md:left-[72px] z-10 flex items-center justify-between gap-3 px-5 py-3 bg-white/95 backdrop-blur border-t border-neutral-200">
              <p className="text-sm text-neutral-600">
                <strong>{draft.size}</strong> cambio{draft.size > 1 ? 's' : ''} pendiente{draft.size > 1 ? 's' : ''} para{' '}
                <strong>{selected.length}</strong> usuario{selected.length > 1 ? 's' : ''}
              </p>
              <div className="flex items-center gap-2">
                <button onClick={() => setDraft(new Map())} className="px-3.5 py-2 rounded-xl text-sm font-medium text-neutral-600 hover:bg-neutral-100 transition-colors">
                  Descartar
                </button>
                <button onClick={() => { setErrorMsg(null); setConfirmOpen(true); }} className="px-4 py-2 rounded-xl text-sm font-semibold bg-neutral-900 text-white hover:bg-neutral-800 transition-colors">
                  Guardar cambios
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {confirmOpen && (
        <ConfirmPermModal
          targetLabels={selectedLabels}
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

// ─── DraftPermButton ────────────────────────────────────────────────────────────

function DraftPermButton({ value, current, onClick }: { value: DraftValue | null; current: boolean | null; onClick: () => void }) {
  const label = value === null ? (current === null ? '—' : current ? '✓' : '✗') : value === 'permitir' ? '✓' : value === 'bloquear' ? '✗' : '↺';
  const title = value === null
    ? `Sin cambios${current !== null ? ` (actual: ${current ? 'permitido' : 'bloqueado'})` : ' (hereda del rol)'}`
    : value === 'permitir' ? 'Se aplicará: permitir'
    : value === 'bloquear' ? 'Se aplicará: bloquear'
    : 'Se aplicará: volver a heredar del rol';

  return (
    <button
      onClick={onClick}
      title={title}
      className={[
        'w-7 h-7 rounded-md border-2 transition-colors mx-auto flex items-center justify-center text-xs font-bold',
        value === null && current === null && 'border-neutral-300 bg-neutral-50 text-neutral-400',
        value === null && current === true && 'border-green-200 bg-green-50 text-green-600',
        value === null && current === false && 'border-red-200 bg-red-50 text-red-500',
        value === 'permitir' && 'bg-green-600 border-green-600 text-white',
        value === 'bloquear' && 'bg-red-500 border-red-500 text-white',
        value === 'hereda' && 'bg-blue-100 border-blue-400 text-blue-600',
      ].filter(Boolean).join(' ')}
    >
      {label}
    </button>
  );
}

// ─── MultiSelectUsers ───────────────────────────────────────────────────────────

function MultiSelectUsers({ options, selected, onChange }: {
  options: { id: string; label: string; sublabel?: string }[]; selected: string[]; onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter(o => o.label.toLowerCase().includes(q) || o.sublabel?.toLowerCase().includes(q));
  }, [options, search]);

  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id]);
  const label = selected.length === 0 ? 'Seleccionar usuarios...' : `${selected.length} seleccionado${selected.length > 1 ? 's' : ''}`;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className={[
          'inline-flex items-center justify-between gap-2 min-w-[240px] px-3.5 py-2.5 rounded-xl text-sm font-medium border transition-colors',
          selected.length > 0 ? 'bg-neutral-900/5 border-neutral-300 text-neutral-900' : 'bg-white border-neutral-200 text-neutral-600',
        ].join(' ')}
      >
        {label}
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-20 mt-1.5 w-80 max-h-96 overflow-hidden flex flex-col rounded-2xl border border-neutral-200 bg-white shadow-xl">
          <div className="p-2 border-b border-neutral-100 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="w-full pl-7 pr-2 py-1.5 rounded-lg text-sm bg-neutral-100 text-neutral-800 placeholder:text-neutral-400 focus:outline-none"
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
                <button key={o.id} onClick={() => toggle(o.id)} className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-neutral-50 transition-colors">
                  <div className={`w-4 h-4 rounded flex items-center justify-center border flex-shrink-0 ${checked ? 'bg-neutral-900 border-neutral-900' : 'border-neutral-300'}`}>
                    {checked && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-neutral-800 truncate">{o.label}</p>
                    {o.sublabel && <p className="text-xs text-neutral-400 truncate">{o.sublabel}</p>}
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

// ─── ConfirmPermModal ────────────────────────────────────────────────────────────

function ConfirmPermModal({ targetLabels, changes, saving, errorMsg, onCancel, onConfirm }: {
  targetLabels: string[];
  changes: { label: string; action: DraftValue }[];
  saving: boolean;
  errorMsg: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div className="w-full max-w-md rounded-2xl bg-white border border-neutral-200 shadow-2xl p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-4.5 h-4.5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-neutral-800">Confirmar cambios de permisos</h3>
            <p className="text-xs text-neutral-500 mt-0.5">
              Se aplicará a {targetLabels.length} usuario{targetLabels.length > 1 ? 's' : ''}: {targetLabels.slice(0, 5).join(', ')}
              {targetLabels.length > 5 ? ` y ${targetLabels.length - 5} más` : ''}.
            </p>
          </div>
        </div>

        <div className="max-h-48 overflow-y-auto rounded-xl border border-neutral-100 divide-y divide-neutral-100">
          {changes.map((c, i) => (
            <div key={i} className="flex items-center justify-between px-3 py-2 text-sm gap-3">
              <span className="text-neutral-700 truncate">{c.label}</span>
              <span className={[
                'text-xs font-semibold px-2 py-0.5 rounded-lg flex-shrink-0',
                c.action === 'permitir' ? 'bg-green-50 text-green-700' : c.action === 'bloquear' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600',
              ].join(' ')}>
                {c.action === 'permitir' ? 'Permitir' : c.action === 'bloquear' ? 'Bloquear' : 'Hereda'}
              </span>
            </div>
          ))}
        </div>

        {errorMsg && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
            <XCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onCancel} disabled={saving} className="px-3.5 py-2 rounded-xl text-sm font-medium text-neutral-600 hover:bg-neutral-100 transition-colors disabled:opacity-50">
            Cancelar
          </button>
          <button onClick={onConfirm} disabled={saving} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold bg-neutral-900 text-white hover:bg-neutral-800 transition-colors disabled:opacity-60">
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {saving ? 'Guardando...' : errorMsg ? 'Reintentar' : 'Confirmar y guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
