import { useState, useEffect, useRef } from 'react';
import {
  Plus, Trash2, Save, Shield, Tag, Pencil, X,
  ChevronLeft, ChevronDown, GripVertical, Settings, Users,
  Search, Eye,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { invalidateTiposTramiteCache } from '../../hooks/useTiposTramite';

// ── Types ─────────────────────────────────────────────────────────────────

interface InsuranceType {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
}

interface TicketTipo {
  id: string;
  value: string;
  label: string;
  area: string;
  color: string;
  activo: boolean;
  is_custom: boolean;
  orden: number;
}

type CampoTipo = 'texto_corto' | 'texto_largo' | 'numerico' | 'adjunto' | 'estatus' | 'fecha' | 'booleano' | 'dropdown' | 'seleccion_multiple';

interface TipoCampo {
  id: string;
  tramite_tipo_id: string;
  key: string;
  label: string;
  tipo: CampoTipo;
  requerido: boolean;
  ayuda: string | null;
  display_order: number;
  config: Record<string, any>;
  activo: boolean;
}

interface EquipoMiembro {
  usuario_id: string;
  nombre_completo: string;
}

interface Equipo {
  id: string;
  nombre: string;
  miembros: EquipoMiembro[];
}

interface Permiso {
  id: string;
  user_id: string;
  team_id: string;
  tramite_tipo_id: string;
  permiso: 'crear_tramite' | 'editar_tramite';
}

// ── Constants ─────────────────────────────────────────────────────────────

const AREAS = ['Comercial', 'Operaciones', 'Mercadotecnia', 'Administración', 'Otro'] as const;
type Area = typeof AREAS[number];

const COLOR_SWATCHES = [
  '#0369a1', '#1d4ed8', '#0891b2', '#6366f1',
  '#7c3aed', '#9333ea', '#db2777', '#e11d48',
  '#dc2626', '#ea580c', '#b45309', '#d97706',
  '#65a30d', '#16a34a', '#059669', '#374151',
  '#64748b', '#78716c',
];

const CAMPO_TIPOS: { tipo: CampoTipo; label: string; icon: string; desc: string }[] = [
  { tipo: 'texto_corto', label: 'Texto corto',  icon: 'Aa', desc: 'Una línea de texto' },
  { tipo: 'texto_largo', label: 'Texto largo',  icon: '¶',  desc: 'Párrafo u observaciones' },
  { tipo: 'numerico',    label: 'Numérico',     icon: '#',  desc: 'Número entero o decimal' },
  { tipo: 'fecha',       label: 'Fecha',        icon: 'D',  desc: 'Selector de fecha' },
  { tipo: 'adjunto',     label: 'Adjunto',      icon: '@',  desc: 'Archivos con filtro de tipo' },
  { tipo: 'estatus',            label: 'Estatus',            icon: '=',  desc: 'Lista de opciones personalizada' },
  { tipo: 'booleano',           label: 'Casilla',            icon: 'v',  desc: 'Sí / No' },
  { tipo: 'dropdown',           label: 'Dropdown',           icon: '▾',  desc: 'Selección única de lista' },
  { tipo: 'seleccion_multiple', label: 'Selección múltiple', icon: '☑',  desc: 'Varias opciones de lista' },
];

const MIME_OPTIONS = [
  { label: 'PDF',  value: 'application/pdf' },
  { label: 'PNG',  value: 'image/png' },
  { label: 'JPG',  value: 'image/jpeg' },
  { label: 'DOCX', value: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  { label: 'XLSX', value: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  { label: 'XML',  value: 'application/xml' },
];

// ── Helpers ───────────────────────────────────────────────────────────────

function slugify(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s_]/g, '')
    .trim()
    .replace(/\s+/g, '_');
}

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {COLOR_SWATCHES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
            style={{
              backgroundColor: c,
              borderColor: value === c ? '#111' : 'transparent',
              boxShadow: value === c ? '0 0 0 2px white, 0 0 0 4px #111' : undefined,
            }}
          />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full border border-neutral-300 shrink-0" style={{ backgroundColor: value }} />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
          className="w-28 px-2 py-1 text-xs border border-neutral-300 rounded-lg font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
        />
      </div>
    </div>
  );
}

// ── Form Preview ──────────────────────────────────────────────────────────

function FormPreview({ campos }: { campos: TipoCampo[] }) {
  if (campos.length === 0) return null;
  return (
    <div className="space-y-4 border border-neutral-200 rounded-xl p-4 bg-white">
      <p className="text-[11px] text-neutral-400 text-center uppercase tracking-wider mb-2">Vista previa — solo lectura</p>
      {campos.map(campo => (
        <div key={campo.id} className="space-y-1">
          <label className="block text-sm font-medium text-neutral-700">
            {campo.label}
            {campo.requerido && <span className="text-red-500 ml-1">*</span>}
          </label>
          {campo.ayuda && <p className="text-xs text-neutral-400">{campo.ayuda}</p>}
          {(campo.tipo === 'texto_corto') && (
            <input disabled type="text" placeholder="Texto corto..."
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg bg-neutral-50 text-sm text-neutral-400 cursor-not-allowed" />
          )}
          {campo.tipo === 'texto_largo' && (
            <textarea disabled placeholder="Texto largo..." rows={3}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg bg-neutral-50 text-sm text-neutral-400 resize-none cursor-not-allowed" />
          )}
          {campo.tipo === 'numerico' && (
            <input disabled type="number" placeholder="0"
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg bg-neutral-50 text-sm text-neutral-400 cursor-not-allowed" />
          )}
          {campo.tipo === 'fecha' && (
            <input disabled type="date"
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg bg-neutral-50 text-sm text-neutral-400 cursor-not-allowed" />
          )}
          {campo.tipo === 'booleano' && (
            <label className="flex items-center gap-2 cursor-not-allowed opacity-60">
              <input type="checkbox" disabled className="rounded" />
              <span className="text-sm text-neutral-500">{campo.label}</span>
            </label>
          )}
          {campo.tipo === 'adjunto' && (
            <div className="w-full py-5 border-2 border-dashed border-neutral-200 rounded-lg bg-neutral-50 text-center text-xs text-neutral-400">
              Arrastra archivos o haz clic para adjuntar
            </div>
          )}
          {(campo.tipo === 'estatus' || campo.tipo === 'dropdown') && (
            <select disabled className="w-full px-3 py-2 border border-neutral-200 rounded-lg bg-neutral-50 text-sm text-neutral-400 cursor-not-allowed">
              <option>Selecciona una opción...</option>
              {(campo.config?.opciones || []).map((opt: { label: string; slug: string }) => (
                <option key={opt.slug}>{opt.label}</option>
              ))}
            </select>
          )}
          {campo.tipo === 'seleccion_multiple' && (
            <div className="space-y-1.5 opacity-60">
              {(campo.config?.opciones || []).map((opt: { label: string; slug: string }) => (
                <label key={opt.slug} className="flex items-center gap-2 cursor-not-allowed">
                  <input type="checkbox" disabled className="rounded" />
                  <span className="text-sm text-neutral-500">{opt.label}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────

export function GestionCatalogosRegistro() {
  const { usuario } = useAuth();
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  };

  // ── Navigation ──────────────────────────────────────────────────────────
  const [view, setView] = useState<'list' | 'edit'>('list');
  const [activeTipo, setActiveTipo] = useState<TicketTipo | null>(null);
  const [activeTab, setActiveTab] = useState<'config' | 'campos' | 'permisos'>('config');

  // ── Insurance types ─────────────────────────────────────────────────────
  const [insuranceTypes, setInsuranceTypes] = useState<InsuranceType[]>([]);
  const [editingInsType, setEditingInsType] = useState<string | null>(null);
  const [newInsType, setNewInsType] = useState({ nombre: '', descripcion: '' });
  const [editInsData, setEditInsData] = useState({ nombre: '', descripcion: '' });
  const [showNewInsForm, setShowNewInsForm] = useState(false);

  // ── Ticket tipos ────────────────────────────────────────────────────────
  const [tiposTramite, setTiposTramite] = useState<TicketTipo[]>([]);
  const [showNewTipoForm, setShowNewTipoForm] = useState(false);
  const [newTipo, setNewTipo] = useState({ label: '', area: 'Comercial' as Area, color: '#0369a1' });

  // ── Edit - Config tab ───────────────────────────────────────────────────
  const [editConfig, setEditConfig] = useState({ label: '', area: 'Comercial' as Area, color: '#0369a1' });
  const [savingConfig, setSavingConfig] = useState(false);

  // ── Edit - Campos tab ───────────────────────────────────────────────────
  const [campos, setCampos] = useState<TipoCampo[]>([]);
  const [loadingCampos, setLoadingCampos] = useState(false);
  const [showAddField, setShowAddField] = useState(false);
  const [editingCampo, setEditingCampo] = useState<TipoCampo | null>(null);
  const [editCampoLabel, setEditCampoLabel] = useState('');
  const [editCampoReq, setEditCampoReq] = useState(false);
  const [editCampoConfig, setEditCampoConfig] = useState<Record<string, any>>({});
  const [editCampoAyuda, setEditCampoAyuda] = useState('');
  const [savingCampo, setSavingCampo] = useState(false);
  const dragIdx = useRef<number | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);

  // ── Edit - Permisos tab ─────────────────────────────────────────────────
  const [equiposPermisos, setEquiposPermisos] = useState<Equipo[]>([]);
  const [permisos, setPermisos] = useState<Permiso[]>([]);
  const [loadingPermisos, setLoadingPermisos] = useState(false);
  const [savingPermId, setSavingPermId] = useState<string | null>(null);

  // Visibilidad por rol y por usuario
  const ROLES_CONFIGURABLES = ['Agente', 'Empleado', 'Gerente'];
  interface RolPermiso { rol: string; puede_crear: boolean; puede_ver: boolean; puede_editar: boolean }
  interface UsuarioOverride { user_id: string; nombre_completo: string; puede_crear: boolean | null; puede_ver: boolean | null; puede_editar: boolean | null }
  const [rolPermisos, setRolPermisos] = useState<RolPermiso[]>([]);
  const [usuarioOverrides, setUsuarioOverrides] = useState<UsuarioOverride[]>([]);
  const [savingVisibilidad, setSavingVisibilidad] = useState<string | null>(null);
  const [equiposColapsados, setEquiposColapsados] = useState<Set<string>>(new Set());

  // ── Search ──────────────────────────────────────────────────────────────
  const [searchIns, setSearchIns] = useState('');
  const [searchTipo, setSearchTipo] = useState('');

  // ── Form preview ────────────────────────────────────────────────────────
  const [showPreview, setShowPreview] = useState(false);

  const isAdmin = usuario?.rol === 'Administrador';

  // ── Loaders ───────────────────────────────────────────────────────────

  useEffect(() => {
    loadInsuranceTypes();
    loadTiposTramite();
  }, []);

  useEffect(() => {
    if (view !== 'edit' || !activeTipo) return;
    if (activeTab === 'campos') loadCampos(activeTipo.id);
    if (activeTab === 'permisos') loadPermisos(activeTipo.id);
  }, [view, activeTab, activeTipo?.id]);

  const loadInsuranceTypes = async () => {
    const { data } = await supabase.from('insurance_types').select('*').order('nombre');
    if (data) setInsuranceTypes(data);
  };

  const loadTiposTramite = async () => {
    const { data } = await supabase.from('ticket_tipos').select('*').order('orden');
    if (data) setTiposTramite(data as TicketTipo[]);
  };

  const loadCampos = async (tipoId: string) => {
    setLoadingCampos(true);
    const { data } = await supabase
      .from('tramite_tipo_campos')
      .select('*')
      .eq('tramite_tipo_id', tipoId)
      .eq('activo', true)
      .order('display_order');
    if (data) setCampos(data as TipoCampo[]);
    setLoadingCampos(false);
  };

  const loadPermisos = async (tipoId: string) => {
    setLoadingPermisos(true);

    const { data: equiposData } = await supabase
      .from('tramites_grupos_visualizacion')
      .select('id, nombre')
      .eq('activo', true)
      .order('nombre');

    if (!equiposData) { setLoadingPermisos(false); return; }

    const { data: miembrosData } = await supabase
      .from('tramites_grupos_miembros')
      .select('grupo_id, usuario_id, usuarios(id, nombre_completo)')
      .in('grupo_id', equiposData.map(e => e.id));

    const equiposConMiembros: Equipo[] = equiposData
      .map(e => ({
        id: e.id,
        nombre: e.nombre,
        miembros: (miembrosData || [])
          .filter(m => m.grupo_id === e.id)
          .map(m => {
            const u = m.usuarios as { id: string; nombre_completo: string } | null;
            return { usuario_id: m.usuario_id, nombre_completo: u?.nombre_completo || '' };
          })
          .filter(m => m.nombre_completo),
      }))
      .filter(e => e.miembros.length > 0);

    setEquiposPermisos(equiposConMiembros);

    const { data: permisosData } = await supabase
      .from('usuario_team_permisos')
      .select('*')
      .eq('tramite_tipo_id', tipoId)
      .is('revoked_at', null);

    if (permisosData) setPermisos(permisosData as Permiso[]);

    // Cargar permisos de visibilidad por rol
    const { data: rolData } = await supabase
      .from('tramite_tipo_rol_permisos')
      .select('rol, puede_crear, puede_ver, puede_editar')
      .eq('tramite_tipo_id', tipoId);

    const rolMap: Record<string, RolPermiso> = {};
    for (const r of (rolData || [])) rolMap[r.rol] = r;
    setRolPermisos(ROLES_CONFIGURABLES.map(rol => rolMap[rol] ?? { rol, puede_crear: true, puede_ver: true, puede_editar: true }));

    // Cargar overrides por usuario (todos los miembros de equipos)
    const todosLosUsuarios: { user_id: string; nombre_completo: string }[] = [];
    const vistosIds = new Set<string>();
    for (const eq of equiposConMiembros) {
      for (const m of eq.miembros) {
        if (!vistosIds.has(m.usuario_id)) { todosLosUsuarios.push(m); vistosIds.add(m.usuario_id); }
      }
    }

    const { data: overridesData } = await supabase
      .from('tramite_tipo_usuario_override')
      .select('user_id, puede_crear, puede_ver, puede_editar')
      .eq('tramite_tipo_id', tipoId);

    const overMap: Record<string, { puede_crear: boolean | null; puede_ver: boolean | null; puede_editar: boolean | null }> = {};
    for (const o of (overridesData || [])) overMap[o.user_id] = o;

    setUsuarioOverrides(todosLosUsuarios.map(u => ({
      ...u,
      puede_crear: overMap[u.user_id]?.puede_crear ?? null,
      puede_ver: overMap[u.user_id]?.puede_ver ?? null,
      puede_editar: overMap[u.user_id]?.puede_editar ?? null,
    })));

    setLoadingPermisos(false);
  };

  // ── Editor navigation ──────────────────────────────────────────────────

  const openEditor = (tipo: TicketTipo) => {
    setActiveTipo(tipo);
    setEditConfig({ label: tipo.label, area: tipo.area as Area, color: tipo.color });
    setActiveTab('config');
    setView('edit');
    setCampos([]);
    setPermisos([]);
    setEditingCampo(null);
    setShowAddField(false);
    setShowPreview(false);
  };

  const closeEditor = () => {
    setView('list');
    setActiveTipo(null);
  };

  const switchTab = (tab: 'config' | 'campos' | 'permisos') => {
    if (activeTab === 'config' && activeTipo && (
      editConfig.label !== activeTipo.label ||
      editConfig.color !== activeTipo.color ||
      (activeTipo.is_custom && editConfig.area !== activeTipo.area)
    )) {
      if (!confirm('Tienes cambios sin guardar en Configuración. ¿Continuar sin guardar?')) return;
    }
    setActiveTab(tab);
    setEditingCampo(null);
    setShowAddField(false);
    setShowPreview(false);
  };

  // ── Config tab ─────────────────────────────────────────────────────────

  const handleSaveConfig = async () => {
    if (!activeTipo || !editConfig.label.trim()) { showToast('El nombre es obligatorio', 'error'); return; }
    setSavingConfig(true);
    const payload: Record<string, string> = { label: editConfig.label.trim(), color: editConfig.color };
    if (activeTipo.is_custom) payload.area = editConfig.area;
    const { error } = await supabase.from('ticket_tipos').update(payload).eq('id', activeTipo.id);
    if (error) { showToast('Error: ' + error.message, 'error'); }
    else {
      setActiveTipo({ ...activeTipo, ...payload });
      invalidateTiposTramiteCache();
      await loadTiposTramite();
      showToast('Tipo de trámite actualizado');
    }
    setSavingConfig(false);
  };

  // ── Campos tab ─────────────────────────────────────────────────────────

  const handleAddCampo = async (tipo: CampoTipo) => {
    if (!activeTipo) return;
    const meta = CAMPO_TIPOS.find(t => t.tipo === tipo);
    const label = (meta?.label || 'Campo') + ' ' + (campos.length + 1);
    const key = slugify(label);
    const defaultConfig: Record<string, any> = {};
    if (tipo === 'texto_corto') defaultConfig.max_length = 255;
    if (tipo === 'texto_largo') defaultConfig.max_length = 2000;
    if (tipo === 'numerico') { defaultConfig.es_entero = false; }
    if (tipo === 'adjunto') { defaultConfig.tipos_mime = ['application/pdf']; defaultConfig.max_archivos = 1; defaultConfig.max_mb = 10; }
    if (tipo === 'estatus') defaultConfig.opciones = [
      { label: 'Pendiente', slug: 'pendiente', clasificacion: 'inicio' },
      { label: 'Completado', slug: 'completado', clasificacion: 'terminacion' },
    ];

    const { data, error } = await supabase
      .from('tramite_tipo_campos')
      .insert({
        tramite_tipo_id: activeTipo.id,
        key,
        label,
        tipo,
        requerido: false,
        display_order: campos.length + 1,
        config: defaultConfig,
        activo: true,
      })
      .select()
      .single();

    if (error) { showToast('Error al agregar campo: ' + error.message, 'error'); return; }
    if (data) {
      const nuevo = data as TipoCampo;
      setCampos(prev => [...prev, nuevo]);
      setShowAddField(false);
      startEditCampo(nuevo);
    }
  };

  const startEditCampo = (campo: TipoCampo) => {
    setEditingCampo(campo);
    setEditCampoLabel(campo.label);
    setEditCampoReq(campo.requerido);
    setEditCampoConfig({ ...(campo.config || {}) });
    setEditCampoAyuda(campo.ayuda || '');
    setShowAddField(false);
  };

  const handleSaveCampo = async () => {
    if (!editingCampo || !editCampoLabel.trim()) return;
    setSavingCampo(true);
    const { error } = await supabase
      .from('tramite_tipo_campos')
      .update({
        label: editCampoLabel.trim(),
        requerido: editCampoReq,
        config: editCampoConfig,
        ayuda: editCampoAyuda.trim() || null,
      })
      .eq('id', editingCampo.id);

    if (error) { showToast('Error al guardar campo', 'error'); setSavingCampo(false); return; }
    setCampos(prev => prev.map(c =>
      c.id === editingCampo.id
        ? { ...c, label: editCampoLabel.trim(), requerido: editCampoReq, config: editCampoConfig, ayuda: editCampoAyuda || null }
        : c
    ));
    setEditingCampo(null);
    showToast('Campo guardado');
    setSavingCampo(false);
  };

  const handleDeleteCampo = async (campo: TipoCampo) => {
    const { count } = await supabase
      .from('tramite_respuestas')
      .select('*', { count: 'exact', head: true })
      .eq('campo_id', campo.id);

    const hasData = (count || 0) > 0;
    const msg = hasData
      ? `Este campo tiene ${count} respuestas registradas. Se desactivará en trámites nuevos pero los datos históricos se conservan. ¿Continuar?`
      : '¿Eliminar este campo? Esta acción no se puede deshacer.';

    if (!confirm(msg)) return;

    if (hasData) {
      await supabase.from('tramite_tipo_campos').update({ activo: false }).eq('id', campo.id);
    } else {
      await supabase.from('tramite_tipo_campos').delete().eq('id', campo.id);
    }
    setCampos(prev => prev.filter(c => c.id !== campo.id));
    if (editingCampo?.id === campo.id) setEditingCampo(null);
    showToast('Campo eliminado');
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    dragIdx.current = index;
    setDragging(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    setDragging(null);
    if (dragIdx.current === null || dragIdx.current === dropIndex) return;
    const reordered = [...campos];
    const [moved] = reordered.splice(dragIdx.current, 1);
    reordered.splice(dropIndex, 0, moved);
    const updated = reordered.map((c, i) => ({ ...c, display_order: i + 1 }));
    setCampos(updated);
    dragIdx.current = null;
    for (const c of updated) {
      await supabase.from('tramite_tipo_campos').update({ display_order: c.display_order }).eq('id', c.id);
    }
  };

  // ── Permisos tab ───────────────────────────────────────────────────────

  const hasPermiso = (userId: string, teamId: string, action: 'crear_tramite' | 'editar_tramite') =>
    permisos.some(p => p.user_id === userId && p.team_id === teamId && p.permiso === action);

  const togglePermiso = async (userId: string, teamId: string, action: 'crear_tramite' | 'editar_tramite') => {
    if (!activeTipo) return;
    const permKey = `${userId}-${teamId}-${action}`;
    setSavingPermId(permKey);
    const existing = permisos.find(p => p.user_id === userId && p.team_id === teamId && p.permiso === action);

    if (existing) {
      await supabase.from('usuario_team_permisos').update({ revoked_at: new Date().toISOString() }).eq('id', existing.id);
      setPermisos(prev => prev.filter(p => p.id !== existing.id));
    } else {
      const { data } = await supabase
        .from('usuario_team_permisos')
        .insert({ user_id: userId, team_id: teamId, tramite_tipo_id: activeTipo.id, permiso: action, granted_by: usuario?.id })
        .select()
        .single();
      if (data) setPermisos(prev => [...prev, data as Permiso]);
    }
    setSavingPermId(null);
  };

  // ── Visibilidad: rol ──────────────────────────────────────────────────

  const toggleRolVisibilidad = async (rol: string, campo: 'puede_crear' | 'puede_ver' | 'puede_editar') => {
    if (!activeTipo) return;
    const key = `rol-${rol}-${campo}`;
    setSavingVisibilidad(key);

    const current = rolPermisos.find(r => r.rol === rol);
    const nuevoValor = !(current?.[campo] ?? true);

    const { error } = await supabase
      .from('tramite_tipo_rol_permisos')
      .upsert({ tramite_tipo_id: activeTipo.id, rol, [campo]: nuevoValor, updated_by: usuario?.id }, { onConflict: 'tramite_tipo_id,rol' });

    if (!error) {
      setRolPermisos(prev => prev.map(r => r.rol === rol ? { ...r, [campo]: nuevoValor } : r));
    }
    setSavingVisibilidad(null);
  };

  // ── Visibilidad: usuario override ─────────────────────────────────────

  const toggleUsuarioOverride = async (userId: string, campo: 'puede_crear' | 'puede_ver' | 'puede_editar') => {
    if (!activeTipo) return;
    const key = `user-${userId}-${campo}`;
    setSavingVisibilidad(key);

    const current = usuarioOverrides.find(u => u.user_id === userId);
    // Ciclo: null → true → false → null
    const prev = current?.[campo] ?? null;
    const nuevoValor = prev === null ? true : prev === true ? false : null;

    if (nuevoValor === null) {
      // Eliminar override
      await supabase.from('tramite_tipo_usuario_override')
        .delete()
        .eq('tramite_tipo_id', activeTipo.id)
        .eq('user_id', userId);
    } else {
      await supabase.from('tramite_tipo_usuario_override')
        .upsert({ tramite_tipo_id: activeTipo.id, user_id: userId, [campo]: nuevoValor, updated_by: usuario?.id }, { onConflict: 'tramite_tipo_id,user_id' });
    }

    setUsuarioOverrides(prev2 => prev2.map(u => u.user_id === userId ? { ...u, [campo]: nuevoValor } : u));
    setSavingVisibilidad(null);
  };

  const toggleEquipoColapsado = (equipoId: string) => {
    setEquiposColapsados(prev => {
      const next = new Set(prev);
      if (next.has(equipoId)) next.delete(equipoId); else next.add(equipoId);
      return next;
    });
  };

  const toggleEquipoOverride = async (equipo: Equipo, campo: 'puede_ver' | 'puede_crear' | 'puede_editar') => {
    if (!activeTipo) return;
    const currentVals = equipo.miembros.map(m => usuarioOverrides.find(u => u.user_id === m.usuario_id)?.[campo] ?? null);
    const allTrue = currentVals.every(v => v === true);
    const nuevoValor = allTrue ? null : true;
    for (const m of equipo.miembros) {
      if (nuevoValor === null) {
        await supabase.from('tramite_tipo_usuario_override').delete()
          .eq('tramite_tipo_id', activeTipo.id).eq('user_id', m.usuario_id);
      } else {
        await supabase.from('tramite_tipo_usuario_override')
          .upsert({ tramite_tipo_id: activeTipo.id, user_id: m.usuario_id, [campo]: nuevoValor, updated_by: usuario?.id }, { onConflict: 'tramite_tipo_id,user_id' });
      }
    }
    setUsuarioOverrides(prev => prev.map(u =>
      equipo.miembros.some(m => m.usuario_id === u.user_id) ? { ...u, [campo]: nuevoValor } : u
    ));
  };

  // ── Insurance type handlers ────────────────────────────────────────────

  const handleCreateInsType = async () => {
    if (!newInsType.nombre.trim()) { showToast('El nombre es obligatorio', 'error'); return; }
    const { error } = await supabase.from('insurance_types').insert({
      nombre: newInsType.nombre.trim(), descripcion: newInsType.descripcion.trim() || null, activo: true,
    });
    if (error) { showToast('Error: ' + error.message, 'error'); return; }
    showToast('Tipo de seguro creado');
    setNewInsType({ nombre: '', descripcion: '' });
    setShowNewInsForm(false);
    await loadInsuranceTypes();
  };

  const handleEditInsType = async (id: string) => {
    if (!editInsData.nombre.trim()) { showToast('El nombre es obligatorio', 'error'); return; }
    const { error } = await supabase.from('insurance_types').update({
      nombre: editInsData.nombre.trim(), descripcion: editInsData.descripcion.trim() || null,
    }).eq('id', id);
    if (error) { showToast('Error: ' + error.message, 'error'); return; }
    showToast('Tipo de seguro actualizado');
    setEditingInsType(null);
    await loadInsuranceTypes();
  };

  const handleToggleInsType = async (id: string, current: boolean) => {
    await supabase.from('insurance_types').update({ activo: !current }).eq('id', id);
    await loadInsuranceTypes();
  };

  const handleDeleteInsType = async (id: string) => {
    if (!confirm('¿Eliminar este tipo de seguro?')) return;
    await supabase.from('insurance_types').delete().eq('id', id);
    await loadInsuranceTypes();
  };

  // ── Ticket tipo list handlers ──────────────────────────────────────────

  const handleCreateTipo = async () => {
    if (!newTipo.label.trim()) { showToast('El nombre es obligatorio', 'error'); return; }
    const value = slugify(newTipo.label);
    if (!value) { showToast('El nombre no genera un identificador válido', 'error'); return; }
    setLoading(true);
    const maxOrden = tiposTramite.reduce((m, t) => Math.max(m, t.orden), 0);
    const { error } = await supabase.from('ticket_tipos').insert({
      value, label: newTipo.label.trim(), area: newTipo.area, color: newTipo.color,
      activo: true, is_custom: true, orden: maxOrden + 1,
    });
    setLoading(false);
    if (error) {
      showToast(error.message?.includes('unique') ? 'Ya existe un tipo con ese nombre' : ('Error: ' + error.message), 'error');
      return;
    }
    showToast('Tipo de trámite creado');
    setNewTipo({ label: '', area: 'Comercial', color: '#0369a1' });
    setShowNewTipoForm(false);
    invalidateTiposTramiteCache();
    await loadTiposTramite();
  };

  const handleToggleTipo = async (id: string, current: boolean) => {
    await supabase.from('ticket_tipos').update({ activo: !current }).eq('id', id);
    invalidateTiposTramiteCache();
    await loadTiposTramite();
  };

  const handleDeleteTipo = async (id: string) => {
    const tipo = tiposTramite.find(t => t.id === id);
    if (!tipo) return;
    const { count } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .eq('tipo', tipo.value);
    const n = count || 0;
    const msg = n > 0
      ? `Este tipo tiene ${n} trámite${n !== 1 ? 's' : ''} registrado${n !== 1 ? 's' : ''}. Al eliminarlo esos trámites quedarán sin tipo asignado. ¿Continuar?`
      : '¿Eliminar este tipo de trámite personalizado? No se puede deshacer.';
    if (!confirm(msg)) return;
    const { error } = await supabase.from('ticket_tipos').delete().eq('id', id);
    if (error) { showToast('Error: ' + error.message, 'error'); return; }
    showToast('Tipo eliminado');
    invalidateTiposTramiteCache();
    await loadTiposTramite();
  };

  if (!isAdmin) {
    return (
      <div className="bg-white rounded-xl p-6">
        <p className="text-neutral-600">Solo los administradores pueden gestionar catálogos.</p>
      </div>
    );
  }

  const isDirty = activeTipo !== null && (
    editConfig.label !== activeTipo.label ||
    editConfig.color !== activeTipo.color ||
    (activeTipo.is_custom && editConfig.area !== activeTipo.area)
  );

  const filteredInsTypes = searchIns.trim()
    ? insuranceTypes.filter(t =>
        t.nombre.toLowerCase().includes(searchIns.toLowerCase()) ||
        (t.descripcion || '').toLowerCase().includes(searchIns.toLowerCase())
      )
    : insuranceTypes;

  const filteredTipos = searchTipo.trim()
    ? tiposTramite.filter(t =>
        t.label.toLowerCase().includes(searchTipo.toLowerCase()) ||
        t.value.toLowerCase().includes(searchTipo.toLowerCase())
      )
    : tiposTramite;

  const tiposGrouped = AREAS.map(area => ({
    area,
    items: filteredTipos.filter(t => t.area === area),
  })).filter(g => g.items.length > 0);

  // ── Toast ──────────────────────────────────────────────────────────────
  const ToastEl = toast ? (
    <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-xl text-sm font-medium shadow-lg z-50 ${
      toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
    }`}>
      {toast.msg}
    </div>
  ) : null;

  // ── Edit panel ─────────────────────────────────────────────────────────
  if (view === 'edit' && activeTipo) {
    return (
      <div className="flex flex-col" style={{ minHeight: 480 }}>
        {ToastEl}

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-neutral-200 bg-neutral-50 shrink-0">
          <button onClick={closeEditor} className="p-1.5 hover:bg-neutral-200 rounded-lg transition-colors">
            <ChevronLeft className="w-5 h-5 text-neutral-600" />
          </button>
          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: activeTipo.color }} />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-neutral-900 truncate">{activeTipo.label}</p>
            <p className="text-[11px] text-neutral-400 font-mono">{activeTipo.value}</p>
          </div>
          {!activeTipo.is_custom && (
            <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-500">
              Integrado
            </span>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-neutral-200 bg-white shrink-0">
          {[
            { id: 'config',   label: 'Configuración' },
            { id: 'campos',   label: 'Campos del formulario' },
            { id: 'permisos', label: 'Permisos' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => switchTab(tab.id as any)}
              className={`relative px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'text-blue-600 border-blue-600'
                  : 'text-neutral-500 border-transparent hover:text-neutral-700'
              }`}
            >
              {tab.label}
              {tab.id === 'config' && isDirty && (
                <span className="absolute top-2 right-1 w-1.5 h-1.5 rounded-full bg-amber-500" />
              )}
            </button>
          ))}
        </div>

        {/* Tab: Configuración */}
        {activeTab === 'config' && (
          <div className="p-5 space-y-5 overflow-auto">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Nombre *</label>
              <input
                type="text"
                value={editConfig.label}
                onChange={(e) => setEditConfig({ ...editConfig, label: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
              />
            </div>
            {activeTipo.is_custom && (
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Área</label>
                <select
                  value={editConfig.area}
                  onChange={(e) => setEditConfig({ ...editConfig, area: e.target.value as Area })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                >
                  {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Color</label>
              <ColorPicker value={editConfig.color} onChange={(c) => setEditConfig({ ...editConfig, color: c })} />
            </div>
            <button
              onClick={handleSaveConfig}
              disabled={savingConfig}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {savingConfig ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        )}

        {/* Tab: Campos */}
        {activeTab === 'campos' && (
          <div className="flex flex-1 overflow-hidden min-h-0">
            {/* Canvas */}
            <div className="flex-1 p-4 overflow-auto">
              {loadingCampos ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-12 bg-neutral-100 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs text-neutral-400 uppercase tracking-wider">
                      {campos.length} campo{campos.length !== 1 ? 's' : ''}
                      {!showPreview && campos.length > 0 && ' · arrastra para reordenar'}
                    </p>
                    {campos.length > 0 && (
                      <button
                        onClick={() => { setShowPreview(!showPreview); setEditingCampo(null); setShowAddField(false); }}
                        className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg transition-colors ${
                          showPreview ? 'bg-blue-100 text-blue-600' : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
                        }`}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        {showPreview ? 'Editar' : 'Vista previa'}
                      </button>
                    )}
                  </div>

                  {showPreview ? (
                    <FormPreview campos={campos} />
                  ) : (
                  <>

                  {campos.length === 0 && (
                    <div className="text-center py-12 text-neutral-400">
                      <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-neutral-100 flex items-center justify-center">
                        <Plus className="w-7 h-7 text-neutral-300" />
                      </div>
                      <p className="text-sm font-medium text-neutral-500">Sin campos definidos</p>
                      <p className="text-xs mt-1 mb-4">Los usuarios verán un formulario vacío al crear este trámite.</p>
                      <button
                        onClick={() => { setShowAddField(true); setEditingCampo(null); }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Agregar primer campo
                      </button>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    {campos.map((campo, idx) => (
                      <div
                        key={campo.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, idx)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, idx)}
                        onDragEnd={() => setDragging(null)}
                        className={`flex items-center gap-2 border rounded-xl p-2.5 bg-white transition-opacity ${
                          dragging === idx ? 'opacity-30' : 'opacity-100'
                        } ${editingCampo?.id === campo.id ? 'border-blue-400 ring-1 ring-blue-200' : 'border-neutral-200'}`}
                      >
                        <div className="cursor-grab p-1 text-neutral-300 hover:text-neutral-500">
                          <GripVertical className="w-4 h-4" />
                        </div>
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 bg-blue-50 text-blue-600 font-mono">
                          {CAMPO_TIPOS.find(t => t.tipo === campo.tipo)?.icon ?? '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-neutral-800 truncate">{campo.label}</p>
                          <p className="text-[10px] text-neutral-400 font-mono">{campo.key}</p>
                        </div>
                        {campo.requerido && (
                          <span className="text-[10px] text-red-500 font-mono shrink-0">req</span>
                        )}
                        <button
                          onClick={() => editingCampo?.id === campo.id ? setEditingCampo(null) : startEditCampo(campo)}
                          className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors text-neutral-400 hover:text-neutral-700"
                        >
                          <Settings className="w-3.5 h-3.5" />
                        </button>
                        {campo.tipo !== 'estatus' && (
                          <button
                            onClick={() => handleDeleteCampo(campo)}
                            className="p-1.5 hover:bg-red-50 rounded-lg transition-colors text-neutral-300 hover:text-red-500"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => { setShowAddField(!showAddField); setEditingCampo(null); }}
                    className="mt-3 w-full flex items-center justify-center gap-2 border-2 border-dashed border-neutral-300 rounded-xl py-2.5 text-sm text-neutral-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Agregar campo
                  </button>
                  </>
                  )}
                </>
              )}
            </div>

            {/* Right panel */}
            {(showAddField || editingCampo) && (
              <div className="w-64 border-l border-neutral-200 bg-neutral-50 p-4 overflow-auto shrink-0">
                {/* Type picker */}
                {showAddField && !editingCampo && (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Tipo de campo</p>
                      <button onClick={() => setShowAddField(false)} className="p-1 hover:bg-neutral-200 rounded">
                        <X className="w-3.5 h-3.5 text-neutral-500" />
                      </button>
                    </div>
                    <div className="space-y-1.5">
                      {CAMPO_TIPOS.map(({ tipo, label, icon, desc }) => (
                        <button
                          key={tipo}
                          onClick={() => handleAddCampo(tipo)}
                          className="w-full flex items-center gap-2.5 p-2.5 bg-white border border-neutral-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-colors text-left"
                        >
                          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-sm font-bold text-blue-600 shrink-0 font-mono">
                            {icon}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-neutral-800">{label}</p>
                            <p className="text-[10px] text-neutral-400 leading-tight">{desc}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {/* Campo config */}
                {editingCampo && (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Configurar campo</p>
                      <button onClick={() => setEditingCampo(null)} className="p-1 hover:bg-neutral-200 rounded">
                        <X className="w-3.5 h-3.5 text-neutral-500" />
                      </button>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-neutral-600 mb-1">Etiqueta *</label>
                        <input
                          type="text"
                          value={editCampoLabel}
                          onChange={(e) => setEditCampoLabel(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-neutral-600 mb-1">Texto de ayuda</label>
                        <input
                          type="text"
                          value={editCampoAyuda}
                          onChange={(e) => setEditCampoAyuda(e.target.value)}
                          placeholder="Ej: incluye prefijo 52"
                          className="w-full px-2.5 py-1.5 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>

                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={editCampoReq}
                          onChange={(e) => setEditCampoReq(e.target.checked)}
                          className="rounded"
                        />
                        <span className="text-sm text-neutral-700">Campo requerido</span>
                      </label>

                      {/* texto_corto / texto_largo */}
                      {(editingCampo.tipo === 'texto_corto' || editingCampo.tipo === 'texto_largo') && (
                        <div>
                          <label className="block text-xs font-medium text-neutral-600 mb-1">Longitud máxima</label>
                          <input
                            type="number"
                            value={editCampoConfig.max_length ?? (editingCampo.tipo === 'texto_corto' ? 255 : 2000)}
                            onChange={(e) => setEditCampoConfig({ ...editCampoConfig, max_length: Number(e.target.value) })}
                            className="w-full px-2.5 py-1.5 text-sm border border-neutral-300 rounded-lg"
                          />
                        </div>
                      )}

                      {/* numerico */}
                      {editingCampo.tipo === 'numerico' && (
                        <>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs font-medium text-neutral-600 mb-1">Mínimo</label>
                              <input
                                type="number"
                                value={editCampoConfig.min ?? ''}
                                onChange={(e) => setEditCampoConfig({ ...editCampoConfig, min: e.target.value !== '' ? Number(e.target.value) : undefined })}
                                className="w-full px-2 py-1.5 text-sm border border-neutral-300 rounded-lg"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-neutral-600 mb-1">Máximo</label>
                              <input
                                type="number"
                                value={editCampoConfig.max ?? ''}
                                onChange={(e) => setEditCampoConfig({ ...editCampoConfig, max: e.target.value !== '' ? Number(e.target.value) : undefined })}
                                className="w-full px-2 py-1.5 text-sm border border-neutral-300 rounded-lg"
                              />
                            </div>
                          </div>
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={editCampoConfig.es_entero || false}
                              onChange={(e) => setEditCampoConfig({ ...editCampoConfig, es_entero: e.target.checked })}
                              className="rounded"
                            />
                            <span className="text-sm text-neutral-700">Solo enteros</span>
                          </label>
                        </>
                      )}

                      {/* adjunto */}
                      {editingCampo.tipo === 'adjunto' && (
                        <>
                          <div>
                            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Tipos de archivo</label>
                            <div className="space-y-1">
                              {MIME_OPTIONS.map(opt => (
                                <label key={opt.value} className="flex items-center gap-2 cursor-pointer select-none">
                                  <input
                                    type="checkbox"
                                    checked={(editCampoConfig.tipos_mime || []).includes(opt.value)}
                                    onChange={(e) => {
                                      const current: string[] = editCampoConfig.tipos_mime || [];
                                      setEditCampoConfig({
                                        ...editCampoConfig,
                                        tipos_mime: e.target.checked
                                          ? [...current, opt.value]
                                          : current.filter(m => m !== opt.value),
                                      });
                                    }}
                                    className="rounded"
                                  />
                                  <span className="text-sm text-neutral-700">{opt.label}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs font-medium text-neutral-600 mb-1">Máx. archivos</label>
                              <input
                                type="number" min="1"
                                value={editCampoConfig.max_archivos || 1}
                                onChange={(e) => setEditCampoConfig({ ...editCampoConfig, max_archivos: Number(e.target.value) })}
                                className="w-full px-2 py-1.5 text-sm border border-neutral-300 rounded-lg"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-neutral-600 mb-1">Máx. MB</label>
                              <input
                                type="number" min="1"
                                value={editCampoConfig.max_mb || 10}
                                onChange={(e) => setEditCampoConfig({ ...editCampoConfig, max_mb: Number(e.target.value) })}
                                className="w-full px-2 py-1.5 text-sm border border-neutral-300 rounded-lg"
                              />
                            </div>
                          </div>
                        </>
                      )}

                      {/* estatus — con clasificación Inicio / Fin */}
                      {editingCampo.tipo === 'estatus' && (
                        <div>
                          <label className="block text-xs font-medium text-neutral-600 mb-1.5">Opciones</label>
                          {(editCampoConfig.opciones || []).map((opt: { label: string; slug: string; clasificacion?: string | null }, i: number) => (
                            <div key={i} className="flex gap-1 mb-1.5 items-center">
                              <input
                                type="text"
                                value={opt.label}
                                onChange={(e) => {
                                  const opts = [...(editCampoConfig.opciones || [])];
                                  opts[i] = { ...opts[i], label: e.target.value, slug: slugify(e.target.value) || opts[i].slug };
                                  setEditCampoConfig({ ...editCampoConfig, opciones: opts });
                                }}
                                className="flex-1 px-2 py-1 text-xs border border-neutral-300 rounded-lg focus:ring-1 focus:ring-blue-400 focus:outline-none"
                              />
                              {/* Clasificación */}
                              <div className="flex rounded-lg overflow-hidden border border-neutral-200 text-[10px] font-medium shrink-0">
                                <button
                                  onClick={() => {
                                    const opts = [...(editCampoConfig.opciones || [])];
                                    opts[i] = { ...opts[i], clasificacion: opt.clasificacion === 'inicio' ? null : 'inicio' };
                                    setEditCampoConfig({ ...editCampoConfig, opciones: opts });
                                  }}
                                  className={`px-2 py-1 transition-colors ${opt.clasificacion === 'inicio' ? 'bg-green-500 text-white' : 'bg-white text-neutral-400 hover:bg-green-50 hover:text-green-600'}`}
                                  title="Inicio de trámite"
                                >
                                  Inicio
                                </button>
                                <button
                                  onClick={() => {
                                    const opts = [...(editCampoConfig.opciones || [])];
                                    opts[i] = { ...opts[i], clasificacion: opt.clasificacion === 'terminacion' ? null : 'terminacion' };
                                    setEditCampoConfig({ ...editCampoConfig, opciones: opts });
                                  }}
                                  className={`px-2 py-1 border-l border-neutral-200 transition-colors ${opt.clasificacion === 'terminacion' ? 'bg-red-500 text-white' : 'bg-white text-neutral-400 hover:bg-red-50 hover:text-red-600'}`}
                                  title="Terminación de trámite"
                                >
                                  Fin
                                </button>
                              </div>
                              <button
                                onClick={() => {
                                  const opts = (editCampoConfig.opciones || []).filter((_: any, j: number) => j !== i);
                                  setEditCampoConfig({ ...editCampoConfig, opciones: opts });
                                }}
                                className="p-1 hover:bg-red-50 rounded text-neutral-400 hover:text-red-500"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={() => {
                              const opts = [...(editCampoConfig.opciones || []), { label: 'Nueva opción', slug: 'nueva_opcion', clasificacion: null }];
                              setEditCampoConfig({ ...editCampoConfig, opciones: opts });
                            }}
                            className="mt-1 w-full text-xs py-1 border border-dashed border-neutral-300 rounded-lg hover:border-blue-400 hover:text-blue-600 text-neutral-500 transition-colors"
                          >
                            + Agregar opción
                          </button>
                        </div>
                      )}

                      {/* dropdown / seleccion_multiple — sin clasificación */}
                      {(editingCampo.tipo === 'dropdown' || editingCampo.tipo === 'seleccion_multiple') && (
                        <div>
                          <label className="block text-xs font-medium text-neutral-600 mb-1.5">Opciones</label>
                          {(editCampoConfig.opciones || []).map((opt: { label: string; slug: string }, i: number) => (
                            <div key={i} className="flex gap-1 mb-1">
                              <input
                                type="text"
                                value={opt.label}
                                onChange={(e) => {
                                  const opts = [...(editCampoConfig.opciones || [])];
                                  opts[i] = { label: e.target.value, slug: slugify(e.target.value) || opts[i].slug };
                                  setEditCampoConfig({ ...editCampoConfig, opciones: opts });
                                }}
                                className="flex-1 px-2 py-1 text-xs border border-neutral-300 rounded-lg focus:ring-1 focus:ring-blue-400 focus:outline-none"
                              />
                              <button
                                onClick={() => {
                                  const opts = (editCampoConfig.opciones || []).filter((_: any, j: number) => j !== i);
                                  setEditCampoConfig({ ...editCampoConfig, opciones: opts });
                                }}
                                className="p-1 hover:bg-red-50 rounded text-neutral-400 hover:text-red-500"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={() => {
                              const opts = [...(editCampoConfig.opciones || []), { label: 'Nueva opción', slug: 'nueva_opcion' }];
                              setEditCampoConfig({ ...editCampoConfig, opciones: opts });
                            }}
                            className="mt-1 w-full text-xs py-1 border border-dashed border-neutral-300 rounded-lg hover:border-blue-400 hover:text-blue-600 text-neutral-500 transition-colors"
                          >
                            + Agregar opción
                          </button>
                        </div>
                      )}

                      {/* fecha */}
                      {editingCampo.tipo === 'fecha' && (
                        <div className="space-y-2">
                          <div>
                            <label className="block text-xs font-medium text-neutral-600 mb-1">Fecha mínima</label>
                            <input
                              type="date"
                              value={editCampoConfig.min_fecha || ''}
                              onChange={(e) => setEditCampoConfig({ ...editCampoConfig, min_fecha: e.target.value })}
                              className="w-full px-2 py-1 text-xs border border-neutral-300 rounded-lg"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-neutral-600 mb-1">Fecha máxima</label>
                            <input
                              type="date"
                              value={editCampoConfig.max_fecha || ''}
                              onChange={(e) => setEditCampoConfig({ ...editCampoConfig, max_fecha: e.target.value })}
                              className="w-full px-2 py-1 text-xs border border-neutral-300 rounded-lg"
                            />
                          </div>
                        </div>
                      )}

                      <button
                        onClick={handleSaveCampo}
                        disabled={savingCampo || !editCampoLabel.trim()}
                        className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                      >
                        <Save className="w-4 h-4" />
                        {savingCampo ? 'Guardando...' : 'Guardar campo'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab: Permisos */}
        {activeTab === 'permisos' && (
          <div className="p-4 overflow-auto space-y-6">

            {/* ── Visibilidad por Rol ── */}
            <div>
              <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3">Visibilidad por Rol</p>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3 text-xs text-amber-700">
                <strong>Ver</strong> = acceso al trámite. <strong>Crear</strong> = puede abrir nuevos trámites. <strong>Editar</strong> = puede modificar estatus y campos. Administrador y Gerente siempre tienen acceso total.
              </div>
              <table className="w-full text-sm border border-neutral-200 rounded-xl overflow-hidden">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className="text-left px-4 py-2 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Rol</th>
                    <th className="text-center px-4 py-2 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider w-20">Ver</th>
                    <th className="text-center px-4 py-2 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider w-20">Crear</th>
                    <th className="text-center px-4 py-2 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider w-20">Editar</th>
                  </tr>
                </thead>
                <tbody>
                  {rolPermisos.map(rp => (
                    <tr key={rp.rol} className="border-t border-neutral-100 hover:bg-neutral-50">
                      <td className="px-4 py-2.5 text-sm font-medium text-neutral-800">{rp.rol}</td>
                      {(['puede_ver', 'puede_crear', 'puede_editar'] as const).map(campo => {
                        const key = `rol-${rp.rol}-${campo}`;
                        const active = rp[campo];
                        const isSaving = savingVisibilidad === key;
                        return (
                          <td key={campo} className="text-center px-4 py-2.5">
                            <button
                              onClick={() => toggleRolVisibilidad(rp.rol, campo)}
                              disabled={isSaving}
                              title={campo === 'puede_ver' ? 'Acceso al trámite' : campo === 'puede_crear' ? 'Puede abrir nuevos trámites' : 'Puede modificar estatus y campos'}
                              className={`w-6 h-6 rounded-md border-2 transition-colors mx-auto flex items-center justify-center text-xs ${
                                active ? 'bg-green-600 border-green-600 text-white' : 'border-neutral-300 bg-white hover:border-red-400 hover:bg-red-50 hover:text-red-600'
                              } ${isSaving ? 'opacity-40' : ''}`}
                            >
                              {active ? '✓' : '✗'}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── Overrides por Usuario (agrupados por equipo) ── */}
            {equiposPermisos.length > 0 && (
              <div>
                <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3">Override por Usuario</p>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-3 text-xs text-blue-700">
                  <strong>Gris</strong> = hereda del rol. <strong>Verde</strong> = permitido. <strong>Rojo</strong> = bloqueado. El botón del equipo aplica a todos sus miembros a la vez.
                </div>
                <div className="space-y-2">
                  {equiposPermisos.map(equipo => {
                    const expanded = !equiposColapsados.has(equipo.id);
                    const miembrosUO = equipo.miembros.map(m =>
                      usuarioOverrides.find(u => u.user_id === m.usuario_id)
                      ?? { user_id: m.usuario_id, nombre_completo: m.nombre_completo, puede_ver: null as boolean | null, puede_crear: null as boolean | null, puede_editar: null as boolean | null }
                    );
                    return (
                      <div key={equipo.id} className="border border-neutral-200 rounded-xl overflow-hidden">
                        {/* Cabecera del equipo con bulk toggles */}
                        <div className="bg-neutral-50 px-3 py-2.5 flex items-center gap-2 border-b border-neutral-200">
                          <button onClick={() => toggleEquipoColapsado(equipo.id)} className="flex items-center gap-2 flex-1 text-left min-w-0">
                            <ChevronDown className={`w-3.5 h-3.5 text-neutral-400 flex-shrink-0 transition-transform ${expanded ? '' : '-rotate-90'}`} />
                            <span className="text-xs font-bold text-neutral-700 uppercase tracking-wider truncate">{equipo.nombre}</span>
                            <span className="text-xs text-neutral-400 flex-shrink-0">({equipo.miembros.length})</span>
                          </button>
                          {/* Bulk toggles por columna */}
                          <div className="flex items-center gap-3 flex-shrink-0">
                            {(['puede_ver', 'puede_crear', 'puede_editar'] as const).map(campo => {
                              const vals = miembrosUO.map(m => m[campo]);
                              const allTrue = vals.every(v => v === true);
                              const allNull = vals.every(v => v === null);
                              const label = campo === 'puede_ver' ? 'Ver' : campo === 'puede_crear' ? 'Crear' : 'Editar';
                              return (
                                <div key={campo} className="flex items-center gap-1">
                                  <span className="text-[10px] text-neutral-400">{label}</span>
                                  <button
                                    onClick={() => toggleEquipoOverride(equipo, campo)}
                                    title={allTrue ? `Quitar ${label.toLowerCase()} a todos` : `Dar ${label.toLowerCase()} a todos`}
                                    className={`w-6 h-6 rounded-md border-2 transition-colors flex items-center justify-center text-xs ${
                                      allTrue ? 'bg-green-600 border-green-600 text-white'
                                      : allNull ? 'border-neutral-300 bg-neutral-100 text-neutral-400'
                                      : 'border-yellow-400 bg-yellow-50 text-yellow-600'
                                    }`}
                                  >
                                    {allTrue ? '✓' : allNull ? '—' : '~'}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        {/* Filas individuales */}
                        {expanded && (
                          <table className="w-full text-sm">
                            <tbody>
                              {miembrosUO.map(uo => (
                                <tr key={uo.user_id} className="border-t border-neutral-100 hover:bg-neutral-50">
                                  <td className="px-4 py-2 pl-8 text-sm text-neutral-700">{uo.nombre_completo}</td>
                                  {(['puede_ver', 'puede_crear', 'puede_editar'] as const).map(campo => {
                                    const key = `user-${uo.user_id}-${campo}`;
                                    const val = uo[campo];
                                    const isSaving = savingVisibilidad === key;
                                    return (
                                      <td key={campo} className="text-center px-4 py-2 w-20">
                                        <button
                                          onClick={() => toggleUsuarioOverride(uo.user_id, campo)}
                                          disabled={isSaving}
                                          title={val === null ? 'Heredar del rol' : val ? 'Permitido' : 'Bloqueado'}
                                          className={`w-6 h-6 rounded-md border-2 transition-colors mx-auto flex items-center justify-center text-xs ${
                                            val === null ? 'border-neutral-300 bg-neutral-100 text-neutral-400'
                                            : val ? 'bg-green-600 border-green-600 text-white'
                                            : 'bg-red-500 border-red-500 text-white'
                                          } ${isSaving ? 'opacity-40' : ''}`}
                                        >
                                          {val === null ? '—' : val ? '✓' : '✗'}
                                        </button>
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Permisos de creación/edición por equipo (existente) ── */}
            <div>
              <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3">Permisos por Equipo</p>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 text-xs text-blue-700">
                Define quién puede <strong>crear</strong> o <strong>editar</strong> este tipo de trámite dentro de cada equipo.
                Los cambios se aplican de inmediato.
              </div>

            {loadingPermisos ? (
              <div className="space-y-3">
                {[...Array(2)].map((_, i) => <div key={i} className="h-24 bg-neutral-100 rounded-xl animate-pulse" />)}
              </div>
            ) : equiposPermisos.length === 0 ? (
              <div className="text-center py-10 text-neutral-400">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No hay equipos con miembros asignados.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {equiposPermisos.map(equipo => (
                  <div key={equipo.id} className="border border-neutral-200 rounded-xl overflow-hidden">
                    <div className="bg-neutral-50 px-4 py-2.5 border-b border-neutral-200">
                      <p className="text-xs font-bold text-neutral-700 uppercase tracking-wider">{equipo.nombre}</p>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr>
                          <th className="text-left px-4 py-2 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Usuario</th>
                          <th className="text-center px-4 py-2 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider w-20">Crear</th>
                          <th className="text-center px-4 py-2 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider w-20">Editar</th>
                        </tr>
                      </thead>
                      <tbody>
                        {equipo.miembros.map(miembro => (
                          <tr key={miembro.usuario_id} className="border-t border-neutral-100 hover:bg-neutral-50">
                            <td className="px-4 py-2.5">
                              <p className="text-sm font-medium text-neutral-800">{miembro.nombre_completo}</p>
                            </td>
                            {(['crear_tramite', 'editar_tramite'] as const).map(action => {
                              const active = hasPermiso(miembro.usuario_id, equipo.id, action);
                              const saving = savingPermId === `${miembro.usuario_id}-${equipo.id}-${action}`;
                              return (
                                <td key={action} className="text-center px-4 py-2.5">
                                  <button
                                    onClick={() => togglePermiso(miembro.usuario_id, equipo.id, action)}
                                    disabled={saving}
                                    className={`w-6 h-6 rounded-md border-2 transition-colors mx-auto flex items-center justify-center text-xs ${
                                      active
                                        ? 'bg-blue-600 border-blue-600 text-white'
                                        : 'border-neutral-300 bg-white hover:border-blue-400'
                                    } ${saving ? 'opacity-40' : ''}`}
                                  >
                                    {active && '✓'}
                                  </button>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}
            </div>{/* fin Permisos por Equipo */}
          </div>
        )}
      </div>
    );
  }

  // ── List view ──────────────────────────────────────────────────────────
  return (
    <div className="space-y-10 p-6">
      {ToastEl}

      {/* ── Tipos de Seguro ── */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-green-600" />
            <h2 className="text-xl font-bold text-neutral-900">Tipos de Seguro</h2>
          </div>
          <button
            onClick={() => setShowNewInsForm(!showNewInsForm)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" />
            Nuevo Tipo
          </button>
        </div>

        {insuranceTypes.length > 4 && (
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
            <input
              type="text"
              value={searchIns}
              onChange={(e) => setSearchIns(e.target.value)}
              placeholder="Buscar tipo de seguro..."
              className="w-full pl-9 pr-3 py-2 border border-neutral-200 rounded-lg text-sm focus:ring-2 focus:ring-green-400 focus:outline-none"
            />
          </div>
        )}

        {showNewInsForm && (
          <div className="bg-neutral-50 rounded-lg p-4 mb-4 space-y-3 border border-neutral-200">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Nombre *</label>
              <input
                type="text"
                value={newInsType.nombre}
                onChange={(e) => setNewInsType({ ...newInsType, nombre: e.target.value })}
                placeholder="Ej: Auto"
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Descripción</label>
              <input
                type="text"
                value={newInsType.descripcion}
                onChange={(e) => setNewInsType({ ...newInsType, descripcion: e.target.value })}
                placeholder="Descripción opcional"
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCreateInsType}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 text-sm"
              >
                <Save className="w-4 h-4" />
                Guardar
              </button>
              <button
                onClick={() => { setShowNewInsForm(false); setNewInsType({ nombre: '', descripcion: '' }); }}
                className="px-4 py-2 bg-neutral-200 text-neutral-700 rounded-lg hover:bg-neutral-300 transition-colors text-sm"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {filteredInsTypes.length === 0 ? (
            <p className="text-neutral-500 text-center py-8">
              {searchIns ? 'Sin resultados para esa búsqueda' : 'No hay tipos de seguro registrados'}
            </p>
          ) : filteredInsTypes.map(type => (
            <div key={type.id} className={`border rounded-lg p-4 ${type.activo ? 'border-neutral-200' : 'border-red-200 bg-red-50'}`}>
              {editingInsType === type.id ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={editInsData.nombre}
                    onChange={(e) => setEditInsData({ ...editInsData, nombre: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
                  />
                  <input
                    type="text"
                    value={editInsData.descripcion}
                    onChange={(e) => setEditInsData({ ...editInsData, descripcion: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <button onClick={() => handleEditInsType(type.id)} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm flex items-center gap-2">
                      <Save className="w-4 h-4" />Guardar
                    </button>
                    <button onClick={() => setEditingInsType(null)} className="px-3 py-1.5 bg-neutral-200 text-neutral-700 rounded-lg text-sm">
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-neutral-900">
                      {type.nombre}
                      {!type.activo && <span className="ml-2 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">Inactivo</span>}
                    </h3>
                    {type.descripcion && <p className="text-sm text-neutral-600 mt-0.5">{type.descripcion}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setEditingInsType(type.id); setEditInsData({ nombre: type.nombre, descripcion: type.descripcion || '' }); }}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleToggleInsType(type.id, type.activo)}
                      className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${type.activo ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
                    >
                      {type.activo ? 'Desactivar' : 'Activar'}
                    </button>
                    <button onClick={() => handleDeleteInsType(type.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Tipos de Trámite ── */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Tag className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-bold text-neutral-900">Tipos de Trámite</h2>
              <p className="text-xs text-neutral-500 mt-0.5">Haz clic en editar para configurar campos y permisos</p>
            </div>
          </div>
          <button
            onClick={() => setShowNewTipoForm(!showNewTipoForm)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" />
            Nuevo Tipo
          </button>
        </div>

        {tiposTramite.length > 4 && (
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
            <input
              type="text"
              value={searchTipo}
              onChange={(e) => setSearchTipo(e.target.value)}
              placeholder="Buscar tipo de trámite..."
              className="w-full pl-9 pr-3 py-2 border border-neutral-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
            />
          </div>
        )}

        {showNewTipoForm && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-6 space-y-4">
            <h3 className="font-semibold text-blue-800 text-sm">Nuevo tipo de trámite</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Nombre *</label>
                <input
                  type="text"
                  value={newTipo.label}
                  onChange={(e) => setNewTipo({ ...newTipo, label: e.target.value })}
                  placeholder="Ej: Consulta Jurídica"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                />
                {newTipo.label && (
                  <p className="text-[11px] text-neutral-400 mt-1 font-mono">ID: {slugify(newTipo.label) || '—'}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Área</label>
                <select
                  value={newTipo.area}
                  onChange={(e) => setNewTipo({ ...newTipo, area: e.target.value as Area })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                >
                  {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Color</label>
              <ColorPicker value={newTipo.color} onChange={(c) => setNewTipo({ ...newTipo, color: c })} />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCreateTipo}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 text-sm"
              >
                <Save className="w-4 h-4" />
                Guardar
              </button>
              <button
                onClick={() => { setShowNewTipoForm(false); setNewTipo({ label: '', area: 'Comercial', color: '#0369a1' }); }}
                className="px-4 py-2 bg-neutral-200 text-neutral-700 rounded-lg hover:bg-neutral-300 transition-colors text-sm"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {filteredTipos.length === 0 ? (
          <p className="text-neutral-500 text-center py-8">
            {searchTipo ? 'Sin resultados para esa búsqueda' : 'No hay tipos de trámite registrados'}
          </p>
        ) : (
          <div className="space-y-6">
            {tiposGrouped.map(({ area, items }) => (
              <div key={area}>
                <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400 mb-2 px-1">{area}</h3>
                <div className="space-y-2">
                  {items.map(tipo => (
                    <div
                      key={tipo.id}
                      className={`flex items-center gap-3 p-3 bg-white border rounded-xl ${!tipo.activo ? 'opacity-60' : ''}`}
                      style={{ borderColor: tipo.color + '55' }}
                    >
                      <div className="w-3 h-10 rounded-full shrink-0" style={{ backgroundColor: tipo.color }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-neutral-900 truncate">{tipo.label}</span>
                          {!tipo.is_custom && (
                            <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-500">
                              Integrado
                            </span>
                          )}
                          {!tipo.activo && (
                            <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-red-100 text-red-600">
                              Inactivo
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-neutral-400 font-mono mt-0.5">{tipo.value}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => openEditor(tipo)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Editar tipo"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        {tipo.is_custom && (
                          <>
                            <button
                              onClick={() => handleToggleTipo(tipo.id, tipo.activo)}
                              className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${tipo.activo ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
                            >
                              {tipo.activo ? 'Desactivar' : 'Activar'}
                            </button>
                            <button
                              onClick={() => handleDeleteTipo(tipo.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
