import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Users, UserPlus, UserMinus, User, Search, ShieldCheck, Briefcase, Wrench,
  Plus, Pencil, Trash2, ChevronRight, Building2, X, Check,
  TriangleAlert as AlertTriangle, Loader as Loader2, Globe, Crown, Zap, Eye, ShieldAlert, Star,
  GitBranch, FileText, CheckCircle2,
} from 'lucide-react';
import { AREA_CONFIG } from '../../lib/registroActividadesTypes';

interface Grupo {
  id: string;
  nombre: string;
  descripcion: string | null;
  color: string;
  area_categoria: string | null;
  activo: boolean;
  all_offices: boolean;
  created_at: string;
  updated_at: string | null;
  member_count: number;
  office_count: number;
}

interface Miembro {
  id: string;
  usuario_id: string;
  nombre_completo: string;
  oficina_nombre: string | null;
  rol: string;
  oficina_id: string | null;
  rol_en_equipo: 'lider' | 'supervisor' | 'director' | 'ejecutivo' | 'miembro';
}

interface GrupoOficina {
  id: string;
  oficina_id: string;
  oficina_nombre: string;
}

interface GrupoRegla {
  id: string;
  usuario_id: string;
  usuario_nombre: string;
  oficina_nombre: string | null;
  ejecutivo_id: string | null;
  area: string | null;
}

interface AgentUser {
  id: string;
  nombre_completo: string;
  oficina_id: string | null;
  rol: string;
}

interface Usuario {
  id: string;
  nombre_completo: string;
  rol: string;
  oficina_id: string | null;
}

interface Oficina {
  id: string;
  nombre: string;
}

interface TipoPorArea {
  id: string;
  label: string;
}

interface AreaItem {
  id: string;
  nombre: string;
  color_hex: string;
}

const toSlug = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '_');

type FormTab = 'general' | 'miembros' | 'oficinas' | 'asignacion' | 'tramites';
type Panel = 'list' | 'form' | 'members' | 'offices';

const ROL_CONFIG = {
  director:   { label: 'Director',   bg: 'bg-purple-100',  text: 'text-purple-800',  icon: Star       },
  supervisor: { label: 'Supervisor', bg: 'bg-rose-100',    text: 'text-rose-700',    icon: ShieldAlert },
  lider:      { label: 'Líder',      bg: 'bg-amber-100',   text: 'text-amber-800',   icon: Crown      },
  ejecutivo:  { label: 'Ejecutivo',  bg: 'bg-blue-100',    text: 'text-blue-700',    icon: Zap        },
  miembro:    { label: 'Miembro',    bg: 'bg-neutral-100', text: 'text-neutral-600', icon: Eye        },
} as const;

const TEAM_COLOR_PALETTE = [
  '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6',
  '#ec4899', '#ef4444', '#f97316', '#f59e0b',
  '#84cc16', '#22c55e', '#14b8a6', '#94a3b8',
];

export function GestionGruposVisualizacion() {
  const { usuario } = useAuth();

  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [oficinas, setOficinas] = useState<Oficina[]>([]);
  const [loading, setLoading] = useState(true);

  const [panel, setPanel] = useState<Panel>('list');
  const [selectedGrupo, setSelectedGrupo] = useState<Grupo | null>(null);

  // Members panel
  const [miembros, setMiembros] = useState<Miembro[]>([]);
  const [searchMiembro, setSearchMiembro] = useState('');
  const [pendingAdd, setPendingAdd] = useState<{ userId: string; rol: 'lider' | 'supervisor' | 'director' | 'ejecutivo' | 'miembro' } | null>(null);
  const [editingRolMiembro, setEditingRolMiembro] = useState<string | null>(null);

  // Offices panel
  const [grupoOficinas, setGrupoOficinas] = useState<GrupoOficina[]>([]);
  const [searchOficina, setSearchOficina] = useState('');

  // Areas
  const [areasDisponibles, setAreasDisponibles] = useState<AreaItem[]>([]);

  // Form state
  const [formNombre, setFormNombre] = useState('');
  const [formDescripcion, setFormDescripcion] = useState('');
  const [formArea, setFormArea] = useState<string | null>(null);
  const [formAreaId, setFormAreaId] = useState<string | null>(null);
  const [formActivo, setFormActivo] = useState(true);
  const [formAllOffices, setFormAllOffices] = useState(false);
  const [formSelectedOficinas, setFormSelectedOficinas] = useState<string[]>([]);
  const [formOficinaSearch, setFormOficinaSearch] = useState('');
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // REQ-05: Team color picker
  const [formColor, setFormColor] = useState('#94a3b8');
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const colorPickerRef = useRef<HTMLDivElement>(null);

  // REQ-01: Inline area creation
  const [formCreatingArea, setFormCreatingArea] = useState(false);
  const [formNewAreaName, setFormNewAreaName] = useState('');

  // Form tabs
  const [formTab, setFormTab] = useState<FormTab>('general');
  const [grupoReglas, setGrupoReglas] = useState<GrupoRegla[]>([]);
  const [agentesParaReglas, setAgentesParaReglas] = useState<AgentUser[]>([]);
  const [filterReglaOficinaId, setFilterReglaOficinaId] = useState('');
  const [searchReglaOficina, setSearchReglaOficina] = useState('');
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [savingEjecutivoReglaId, setSavingEjecutivoReglaId] = useState<string | null>(null);
  const [savingRegla, setSavingRegla] = useState(false);
  const [reglaError, setReglaError] = useState('');

  // REQ-04: Filter asignados by type
  const [filterAsignacionTipo, setFilterAsignacionTipo] = useState<'todos' | 'pool' | 'asignado'>('todos');

  // REQ-06/07: Tipos por area
  const [tiposPorArea, setTiposPorArea] = useState<TipoPorArea[]>([]);
  const [teamTipoConfig, setTeamTipoConfig] = useState<Record<string, boolean>>({});
  const [savingTipoToggle, setSavingTipoToggle] = useState<string | null>(null);
  const [loadingTipos, setLoadingTipos] = useState(false);

  // Delete confirm
  const [confirmDelete, setConfirmDelete] = useState<Grupo | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isAdmin = usuario?.rol === 'Administrador';

  // â”€â”€ TOAST â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  };

  // â”€â”€ OUTSIDE CLICK FOR COLOR PICKER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setColorPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // â”€â”€ DATA LOADING â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const loadData = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadGrupos(), loadUsuarios(), loadOficinas(), loadAgentesParaReglas(), loadAreas()]);
    setLoading(false);
  }, []);

  const loadAreas = async () => {
    const { data } = await supabase
      .from('tramites_areas')
      .select('id, nombre, color_hex')
      .eq('activa', true)
      .order('nombre');
    setAreasDisponibles((data || []) as AreaItem[]);
  };

  useEffect(() => { loadData(); }, [loadData]);

  const loadGrupos = async () => {
    const { data, error } = await supabase.rpc('get_tramite_teams_full');
    if (!error && data) setGrupos(data as Grupo[]);
  };

  const loadUsuarios = async () => {
    const { data } = await supabase
      .from('usuarios')
      .select('id, nombre_completo, rol, oficina_id')
      .in('rol', ['Empleado', 'Gerente', 'Administrador'])
      .order('nombre_completo');
    if (data) {
      setUsuarios(data.map(u => ({
        id: u.id,
        nombre_completo: u.nombre_completo || u.id,
        rol: u.rol,
        oficina_id: u.oficina_id ?? null,
      })));
    }
  };

  const loadOficinas = async () => {
    const { data } = await supabase.from('oficinas').select('id, nombre').eq('activa', true).order('nombre');
    if (data) setOficinas(data);
  };

  const loadAgentesParaReglas = async () => {
    const { data } = await supabase
      .from('usuarios')
      .select('id, nombre_completo, rol, oficina_id')
      .order('nombre_completo');
    if (data) {
      const seen = new Set<string>();
      const unique = data.filter(u => { if (seen.has(u.id)) return false; seen.add(u.id); return true; });
      setAgentesParaReglas(unique.map(u => ({
        id: u.id,
        nombre_completo: u.nombre_completo || u.id,
        rol: u.rol,
        oficina_id: u.oficina_id ?? null,
      })));
    }
  };

  const loadMiembros = async (grupoId: string) => {
    const { data } = await supabase.rpc('get_grupo_miembros', { p_grupo_id: grupoId });
    if (data) setMiembros(data.map((m: Record<string, unknown>) => ({ ...m, usuario_id: m.id as string })) as Miembro[]);
  };

  const loadGrupoOficinas = async (grupoId: string) => {
    const { data } = await supabase.rpc('get_grupo_oficinas', { p_grupo_id: grupoId });
    if (data) setGrupoOficinas(data as GrupoOficina[]);
  };

  // REQ-06/07: Load tipos by area + team config
  const loadTiposPorArea = async (area: string | null, grupoId: string) => {
    setLoadingTipos(true);
    setTiposPorArea([]);
    setTeamTipoConfig({});
    try {
      let q = supabase.from('ticket_tipos').select('id, label').eq('activo', true);
      if (area) q = q.eq('area', area);
      const { data: tipos } = await q.order('label');

      const { data: config } = await supabase
        .from('tramite_team_tipo_config')
        .select('tipo_id, habilitado')
        .eq('team_id', grupoId);

      const configMap: Record<string, boolean> = {};
      if (config) config.forEach(c => { configMap[c.tipo_id] = c.habilitado; });

      setTiposPorArea((tipos || []) as TipoPorArea[]);
      setTeamTipoConfig(configMap);
    } catch {
      // Table may not exist yet (pending migration)
    }
    setLoadingTipos(false);
  };

  // â”€â”€ FORM â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const openCreate = () => {
    setSelectedGrupo(null);
    setFormNombre('');
    setFormDescripcion('');
    setFormArea(null);
    setFormAreaId(null);
    setFormActivo(true);
    setFormAllOffices(false);
    setFormSelectedOficinas([]);
    setFormOficinaSearch('');
    setFormError('');
    setFormColor('#94a3b8');
    setFormCreatingArea(false);
    setFormNewAreaName('');
    setPanel('form');
  };

  const openEdit = async (g: Grupo) => {
    setSelectedGrupo(g);
    setFormNombre(g.nombre);
    setFormDescripcion(g.descripcion || '');
    setFormArea(g.area_categoria ?? null);
    setFormAreaId(areasDisponibles.find(a => a.nombre === g.area_categoria)?.id ?? null);
    setFormActivo(g.activo);
    setFormAllOffices(g.all_offices);
    setFormColor(g.color || '#94a3b8');
    setFormOficinaSearch('');
    setFormError('');
    setFormTab('general');
    setSearchMiembro('');
    setSearchOficina('');
    setSearchReglaOficina('');
    setFilterReglaOficinaId('');
    setFilterAsignacionTipo('todos');
    setSelectedAgentIds([]);
    setEditingRolMiembro(null);
    setPendingAdd(null);
    setFormCreatingArea(false);
    setFormNewAreaName('');
    setColorPickerOpen(false);
    const [oficinasRes] = await Promise.all([
      supabase.rpc('get_grupo_oficinas', { p_grupo_id: g.id }),
      loadMiembros(g.id),
      loadGrupoOficinas(g.id),
      loadGrupoReglas(g.id),
    ]);
    setFormSelectedOficinas(oficinasRes.data ? (oficinasRes.data as GrupoOficina[]).map(o => o.oficina_id) : []);
    setPanel('form');
  };

  const handleSaveForm = async () => {
    if (!formNombre.trim()) { setFormError('El nombre es requerido.'); return; }
    setFormSaving(true);
    setFormError('');

    const payload = {
      nombre: formNombre.trim(),
      descripcion: formDescripcion.trim() || null,
      area_categoria: formArea,
      area_id: formAreaId ?? null,
      activo: formActivo,
      all_offices: formAllOffices,
      color: formColor,
      updated_at: new Date().toISOString(),
      updated_by: usuario?.id,
    };

    let grupoId: string;

    if (selectedGrupo) {
      const { error } = await supabase
        .from('tramites_grupos_visualizacion')
        .update(payload)
        .eq('id', selectedGrupo.id);
      if (error) { setFormError('Error al guardar: ' + error.message); setFormSaving(false); return; }
      grupoId = selectedGrupo.id;
      await supabase.from('ticket_team_audit_logs').insert({
        team_id: grupoId,
        action: 'team_edited',
        old_value: { nombre: selectedGrupo.nombre, area_categoria: selectedGrupo.area_categoria, activo: selectedGrupo.activo },
        new_value: payload,
        performed_by: usuario?.id,
      });
    } else {
      const { data, error } = await supabase
        .from('tramites_grupos_visualizacion')
        .insert({ ...payload, created_by: usuario?.id })
        .select('id')
        .single();
      if (error) { setFormError('Error al crear: ' + error.message); setFormSaving(false); return; }
      grupoId = data.id;
      await supabase.from('ticket_team_audit_logs').insert({
        team_id: grupoId,
        action: 'team_created',
        new_value: payload,
        performed_by: usuario?.id,
      });
    }

    if (!formAllOffices) {
      await supabase.from('tramites_grupos_oficinas').delete().eq('grupo_id', grupoId);
      if (formSelectedOficinas.length > 0) {
        await supabase.from('tramites_grupos_oficinas').insert(
          formSelectedOficinas.map(oficina_id => ({ grupo_id: grupoId, oficina_id, created_by: usuario?.id }))
        );
      }
    }

    await loadGrupos();
    setFormSaving(false);
    setPanel('list');
    showToast(selectedGrupo ? 'Equipo actualizado correctamente' : 'Equipo creado correctamente');
  };

  const handleConfirmNewArea = async () => {
    const name = formNewAreaName.trim();
    if (!name) return;
    const existing = areasDisponibles.find(a => a.nombre.toLowerCase() === name.toLowerCase());
    if (existing) {
      setFormArea(existing.nombre);
      setFormAreaId(existing.id);
      setFormCreatingArea(false);
      setFormNewAreaName('');
      return;
    }
    const { data } = await supabase
      .from('tramites_areas')
      .insert({ nombre: name, slug: toSlug(name), color_hex: '#94a3b8', activa: true })
      .select('id, nombre, color_hex')
      .single();
    if (data) {
      setAreasDisponibles(prev => [...prev, data].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setFormArea(data.nombre);
      setFormAreaId(data.id);
    }
    setFormCreatingArea(false);
    setFormNewAreaName('');
  };

  // REQ-07: Toggle tipo enabled per team
  const handleTipoToggle = async (tipoId: string, habilitado: boolean) => {
    if (!selectedGrupo) return;
    setSavingTipoToggle(tipoId);
    await supabase
      .from('tramite_team_tipo_config')
      .upsert(
        { team_id: selectedGrupo.id, tipo_id: tipoId, habilitado, updated_by: usuario?.id },
        { onConflict: 'team_id,tipo_id' }
      );
    setTeamTipoConfig(prev => ({ ...prev, [tipoId]: habilitado }));
    setSavingTipoToggle(null);
  };

  // â”€â”€ TOGGLE ACTIVE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const handleToggleActive = async (g: Grupo) => {
    await supabase
      .from('tramites_grupos_visualizacion')
      .update({ activo: !g.activo, updated_at: new Date().toISOString(), updated_by: usuario?.id })
      .eq('id', g.id);
    await supabase.from('ticket_team_audit_logs').insert({
      team_id: g.id,
      action: g.activo ? 'team_deactivated' : 'team_activated',
      performed_by: usuario?.id,
    });
    await loadGrupos();
  };

  // â”€â”€ DELETE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    await supabase.from('tramites_grupos_miembros').delete().eq('grupo_id', confirmDelete.id);
    await supabase.from('tramites_grupos_oficinas').delete().eq('grupo_id', confirmDelete.id);
    await supabase.from('tramites_grupos_visualizacion').delete().eq('id', confirmDelete.id);
    await supabase.from('ticket_team_audit_logs').insert({
      team_id: confirmDelete.id,
      action: 'team_deleted',
      performed_by: usuario?.id,
    });
    setConfirmDelete(null);
    setDeleting(false);
    await loadGrupos();
    showToast('Equipo eliminado');
  };

  // â”€â”€ MEMBERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const openMembers = async (g: Grupo) => {
    setSelectedGrupo(g);
    setSearchMiembro('');
    await loadMiembros(g.id);
    setPanel('members');
  };

  const handleAgregarMiembro = async (usuarioId: string, rol: 'lider' | 'supervisor' | 'director' | 'ejecutivo' | 'miembro' = 'ejecutivo') => {
    if (!selectedGrupo) return;
    const { error } = await supabase
      .from('tramites_grupos_miembros')
      .insert({ grupo_id: selectedGrupo.id, usuario_id: usuarioId, rol_en_equipo: rol });
    if (error && error.code !== '23505') { alert('Error: ' + error.message); return; }
    await supabase.from('ticket_team_audit_logs').insert({
      team_id: selectedGrupo.id, action: 'member_added',
      new_value: { usuario_id: usuarioId, rol_en_equipo: rol }, performed_by: usuario?.id,
    });
    await loadMiembros(selectedGrupo.id);
    await loadGrupos();
  };

  const handleChangeRolMiembro = async (usuarioId: string, nuevoRol: 'lider' | 'supervisor' | 'director' | 'ejecutivo' | 'miembro') => {
    if (!selectedGrupo) return;
    const { error } = await supabase
      .from('tramites_grupos_miembros')
      .update({ rol_en_equipo: nuevoRol })
      .eq('grupo_id', selectedGrupo.id)
      .eq('usuario_id', usuarioId);
    if (error) { alert('Error: ' + error.message); return; }
    setEditingRolMiembro(null);
    await loadMiembros(selectedGrupo.id);
  };

  const handleRemoverMiembro = async (usuarioId: string) => {
    if (!selectedGrupo) return;
    await supabase
      .from('tramites_grupos_miembros')
      .delete()
      .eq('grupo_id', selectedGrupo.id)
      .eq('usuario_id', usuarioId);
    await supabase.from('ticket_team_audit_logs').insert({
      team_id: selectedGrupo.id, action: 'member_removed',
      old_value: { usuario_id: usuarioId }, performed_by: usuario?.id,
    });
    await loadMiembros(selectedGrupo.id);
    await loadGrupos();
  };

  // â”€â”€ REGLAS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const loadGrupoReglas = async (grupoId: string) => {
    const { data } = await supabase
      .from('tramites_grupos_reglas')
      .select('id, usuario_id, ejecutivo_id, area')
      .eq('grupo_id', grupoId)
      .eq('activo', true);
    if (data) {
      setGrupoReglas(data.map(r => {
        const agente = agentesParaReglas.find(a => a.id === r.usuario_id);
        return {
          id: r.id,
          usuario_id: r.usuario_id,
          usuario_nombre: agente?.nombre_completo || r.usuario_id,
          oficina_nombre: agente?.oficina_id ? (oficinas.find(o => o.id === agente.oficina_id)?.nombre || null) : null,
          ejecutivo_id: r.ejecutivo_id ?? null,
          area: r.area ?? null,
        };
      }));
    }
  };

  const handleAgregarReglas = async () => {
    if (!selectedGrupo || selectedAgentIds.length === 0) return;
    setSavingRegla(true);
    setReglaError('');
    const grupoArea = selectedGrupo.area_categoria ?? null;
    try {
      for (const uid of selectedAgentIds) {
        let q = supabase.from('tramites_grupos_reglas').select('id').eq('usuario_id', uid);
        if (grupoArea) { q = q.eq('area', grupoArea); } else { q = q.is('area', null); }
        const { data: existing, error: qErr } = await q.limit(1).maybeSingle();
        if (qErr) throw new Error('Consulta fallida: ' + qErr.message);
        if (existing) {
          const { error } = await supabase
            .from('tramites_grupos_reglas')
            .update({ grupo_id: selectedGrupo.id, activo: true, created_by: usuario?.id })
            .eq('id', existing.id);
          if (error) throw new Error('Error al actualizar: ' + error.message);
        } else {
          const { error } = await supabase
            .from('tramites_grupos_reglas')
            .insert({ grupo_id: selectedGrupo.id, usuario_id: uid, created_by: usuario?.id, activo: true, area: grupoArea });
          if (error) throw new Error('Error al insertar: ' + error.message);
        }
      }
      setSelectedAgentIds([]);
      setSearchReglaOficina('');
      await loadGrupoReglas(selectedGrupo.id);
    } catch (e: unknown) {
      setReglaError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setSavingRegla(false);
    }
  };

  const handleRemoverRegla = async (reglaId: string) => {
    if (!selectedGrupo) return;
    await supabase.from('tramites_grupos_reglas').update({ activo: false }).eq('id', reglaId);
    await loadGrupoReglas(selectedGrupo.id);
  };

  const handleCambiarEjecutivoEnRegla = async (reglaId: string, ejecutivoId: string | null) => {
    setSavingEjecutivoReglaId(reglaId);
    await supabase.from('tramites_grupos_reglas').update({ ejecutivo_id: ejecutivoId }).eq('id', reglaId);
    setGrupoReglas(prev => prev.map(r => r.id === reglaId ? { ...r, ejecutivo_id: ejecutivoId } : r));
    setSavingEjecutivoReglaId(null);
  };

  // â”€â”€ OFFICES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const openOffices = async (g: Grupo) => {
    setSelectedGrupo(g);
    setSearchOficina('');
    await loadGrupoOficinas(g.id);
    setPanel('offices');
  };

  const handleAgregarOficina = async (oficinaId: string) => {
    if (!selectedGrupo) return;
    const { error } = await supabase
      .from('tramites_grupos_oficinas')
      .insert({ grupo_id: selectedGrupo.id, oficina_id: oficinaId, created_by: usuario?.id });
    if (error && error.code !== '23505') { alert('Error: ' + error.message); return; }
    await supabase.from('ticket_team_audit_logs').insert({
      team_id: selectedGrupo.id, action: 'office_added',
      new_value: { oficina_id: oficinaId }, performed_by: usuario?.id,
    });
    await loadGrupoOficinas(selectedGrupo.id);
    await loadGrupos();
  };

  const handleRemoverOficina = async (oficAssocId: string, oficinaId: string) => {
    if (!selectedGrupo) return;
    await supabase.from('tramites_grupos_oficinas').delete().eq('id', oficAssocId);
    await supabase.from('ticket_team_audit_logs').insert({
      team_id: selectedGrupo.id, action: 'office_removed',
      old_value: { oficina_id: oficinaId }, performed_by: usuario?.id,
    });
    await loadGrupoOficinas(selectedGrupo.id);
    await loadGrupos();
  };

  // â”€â”€ HELPERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const getAC = (area: string | null) =>
    area && (AREA_CONFIG as Record<string, { color: string; bg: string; border: string }>)[area]
      ? (AREA_CONFIG as Record<string, { color: string; bg: string; border: string }>)[area]
      : { bg: 'bg-neutral-50', color: 'text-neutral-600', border: 'border-neutral-200' };

  const AreaIcon = ({ area }: { area: string | null }) =>
    area === 'Comercial' ? <Briefcase className="w-4 h-4" /> : <Wrench className="w-4 h-4" />;

  const miembrosDisponibles = usuarios.filter(
    u => !miembros.some(m => m.usuario_id === u.id) &&
      u.nombre_completo.toLowerCase().includes(searchMiembro.toLowerCase())
  );

  const oficinasDisponibles = oficinas.filter(
    o => !grupoOficinas.some(go => go.oficina_id === o.id) &&
      o.nombre.toLowerCase().includes(searchOficina.toLowerCase())
  );

  // â”€â”€ GUARD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  if (!isAdmin) {
    return (
      <div className="text-center py-12 text-neutral-500">
        <ShieldCheck className="w-12 h-12 mx-auto mb-3 text-neutral-300" />
        <p className="font-medium">Solo los administradores pueden gestionar los equipos de trabajo.</p>
      </div>
    );
  }

  // Skeleton loading
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="border border-neutral-200 rounded-2xl p-5 animate-pulse">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-neutral-200 flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-neutral-200 rounded w-40" />
                <div className="h-3 bg-neutral-100 rounded w-24" />
                <div className="flex gap-4 mt-1">
                  <div className="h-3 bg-neutral-100 rounded w-20" />
                  <div className="h-3 bg-neutral-100 rounded w-20" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // â”€â”€ LIST PANEL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  if (panel === 'list') {
    const active = grupos.filter(g => g.activo);
    const areas = [...new Set(active.map(g => g.area_categoria))].sort((a, b) => {
      if (a === null) return 1;
      if (b === null) return -1;
      return a.localeCompare(b);
    });

    return (
      <>
        {/* Toast */}
        {toast && (
          <div className={`fixed bottom-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm font-medium animate-in slide-in-from-bottom-2 ${
            toast.type === 'success' ? 'bg-neutral-900 text-white' : 'bg-red-600 text-white'
          }`}>
            {toast.type === 'success'
              ? <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
              : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
            {toast.msg}
          </div>
        )}

        <div className="space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-neutral-900">Equipos de Trabajo</h3>
              <p className="text-sm text-neutral-500 mt-0.5">Equipos de atenciÃ³n a trÃ¡mites organizados por Ã¡rea.</p>
            </div>
            <button
              onClick={openCreate}
              className="flex items-center gap-2 bg-neutral-900 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-neutral-700 transition-colors flex-shrink-0"
            >
              <Plus className="w-4 h-4" /> Crear equipo
            </button>
          </div>

          {active.length === 0 ? (
            <div className="text-center py-10 bg-neutral-50 rounded-2xl border-2 border-dashed border-neutral-200">
              <Users className="w-10 h-10 mx-auto text-neutral-300 mb-2" />
              <p className="text-sm text-neutral-500">No hay equipos activos. Crea el primero.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {areas.map(area => {
                const gruposArea = active.filter(g => g.area_categoria === area);
                const ac = getAC(area);
                return (
                  <div key={area ?? '__sin_area__'}>
                    <h4 className={`text-xs font-bold uppercase tracking-wide mb-2 ${ac.color}`}>
                      {area ?? 'Sin Ã¡rea asignada'}
                    </h4>
                    <div className="grid grid-cols-1 gap-3">
                      {gruposArea.map(g => {
                        const gac = getAC(g.area_categoria);
                        return (
                          <div key={g.id} className="border border-neutral-200 rounded-2xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow">
                            <div className="px-5 py-4 flex items-start gap-4">
                              <div className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center" style={{ backgroundColor: g.color + '22' }}>
                                <span style={{ color: g.color }}><AreaIcon area={g.area_categoria} /></span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="font-bold text-neutral-900">{g.nombre}</h4>
                                  {g.area_categoria && (
                                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: g.color + '20', color: g.color }}>
                                      {g.area_categoria}
                                    </span>
                                  )}
                                  {g.all_offices && (
                                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 flex items-center gap-1">
                                      <Globe className="w-3 h-3" /> Todas las oficinas
                                    </span>
                                  )}
                                </div>
                                {g.descripcion && <p className="text-xs text-neutral-500 mt-1 line-clamp-1">{g.descripcion}</p>}
                                <div className="flex items-center gap-4 mt-2">
                                  <button onClick={() => openMembers(g)} className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-900 transition-colors">
                                    <Users className="w-3.5 h-3.5" />
                                    <span className="font-semibold">{g.member_count}</span> miembros
                                    <ChevronRight className="w-3 h-3" />
                                  </button>
                                  <button onClick={() => openOffices(g)} className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-900 transition-colors">
                                    <Building2 className="w-3.5 h-3.5" />
                                    {g.all_offices ? 'Todas las oficinas' : <><span className="font-semibold">{g.office_count}</span> oficinas</>}
                                    <ChevronRight className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <button onClick={() => openEdit(g)} className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700 transition-colors" title="Editar">
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button onClick={() => setConfirmDelete(g)} className="p-2 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors" title="Eliminar">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                            {!g.all_offices && g.office_count === 0 && (
                              <div className="px-5 py-2 bg-amber-50 border-t border-amber-100 flex items-center gap-2 text-xs text-amber-700">
                                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                                Sin oficinas asignadas â€” este equipo no verÃ¡ ningÃºn trÃ¡mite.
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {confirmDelete && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2.5 bg-red-50 rounded-xl"><Trash2 className="w-5 h-5 text-red-600" /></div>
                  <div>
                    <h3 className="font-bold text-neutral-900">Eliminar equipo</h3>
                    <p className="text-sm text-neutral-500">"{confirmDelete.nombre}"</p>
                  </div>
                </div>
                {(confirmDelete.member_count > 0 || confirmDelete.office_count > 0) && (
                  <div className="bg-amber-50 rounded-xl p-3 mb-4 text-sm text-amber-800 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>
                      Este equipo tiene {confirmDelete.member_count} miembro{confirmDelete.member_count !== 1 ? 's' : ''} y{' '}
                      {confirmDelete.office_count} oficina{confirmDelete.office_count !== 1 ? 's' : ''} asignada{confirmDelete.office_count !== 1 ? 's' : ''}.
                      Se eliminarÃ¡n junto con el equipo.
                    </span>
                  </div>
                )}
                <p className="text-sm text-neutral-600 mb-4">Â¿Seguro que deseas eliminar este equipo? Esta acciÃ³n no se puede deshacer.</p>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 text-sm rounded-xl border border-neutral-200 hover:bg-neutral-50">Cancelar</button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="px-4 py-2 text-sm rounded-xl bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </>
    );
  }

  // â”€â”€ FORM PANEL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  if (panel === 'form') {
    return (
      <>
        {/* Toast */}
        {toast && (
          <div className={`fixed bottom-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${
            toast.type === 'success' ? 'bg-neutral-900 text-white' : 'bg-red-600 text-white'
          }`}>
            {toast.type === 'success'
              ? <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
              : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
            {toast.msg}
          </div>
        )}

        <div className="space-y-5">
          {/* Header */}
          <div className="flex items-center gap-3">
            <button onClick={() => setPanel('list')} className="p-2 rounded-xl hover:bg-neutral-100 text-neutral-500 transition-colors">
              <X className="w-4 h-4" />
            </button>
            <div className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center" style={{ backgroundColor: formColor + '22' }}>
              <span style={{ color: formColor }}>
                {formArea === 'Comercial' ? <Briefcase className="w-4 h-4" /> : <Wrench className="w-4 h-4" />}
              </span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-neutral-900">{selectedGrupo ? 'Editar equipo' : 'Nuevo equipo'}</h3>
              <p className="text-sm text-neutral-500">{formArea ? `Ãrea: ${formArea}` : 'Sin Ã¡rea asignada'}</p>
            </div>
          </div>

          {/* Tab bar â€” only when editing */}
          {selectedGrupo && (
            <div className="flex gap-1 border-b border-neutral-200 overflow-x-auto">
              {([
                { key: 'general',    label: 'General',    icon: Wrench },
                { key: 'miembros',   label: 'Miembros',   icon: Users },
                { key: 'oficinas',   label: 'Oficinas',   icon: Building2 },
                { key: 'asignacion', label: 'AsignaciÃ³n', icon: GitBranch },
                { key: 'tramites',   label: 'TrÃ¡mites',   icon: FileText },
              ] as const).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => {
                    setFormTab(key);
                    if (key === 'tramites' && selectedGrupo) {
                      void loadTiposPorArea(formArea, selectedGrupo.id);
                    }
                  }}
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-all border-b-2 -mb-px whitespace-nowrap ${
                    formTab === key
                      ? 'text-neutral-900 border-amber-500'
                      : 'text-neutral-500 border-transparent hover:text-neutral-700'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                  {key === 'miembros' && miembros.length > 0 && (
                    <span className="text-[11px] bg-neutral-200 text-neutral-600 px-1.5 py-0.5 rounded-full font-semibold">{miembros.length}</span>
                  )}
                  {key === 'oficinas' && grupoOficinas.length > 0 && !selectedGrupo.all_offices && (
                    <span className="text-[11px] bg-neutral-200 text-neutral-600 px-1.5 py-0.5 rounded-full font-semibold">{grupoOficinas.length}</span>
                  )}
                  {key === 'asignacion' && grupoReglas.length > 0 && (
                    <span className="text-[11px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-semibold">{grupoReglas.length}</span>
                  )}
                  {key === 'tramites' && Object.values(teamTipoConfig).filter(v => v === false).length > 0 && (
                    <span className="text-[11px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-semibold">
                      {Object.values(teamTipoConfig).filter(v => v === false).length} off
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* â”€â”€ TAB: GENERAL â”€â”€ */}
          {(!selectedGrupo || formTab === 'general') && (
            <div className="space-y-4 bg-white rounded-2xl border border-neutral-200 p-5">
              {/* Nombre + Color picker (REQ-05) */}
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-1.5">Nombre del equipo *</label>
                <div className="flex gap-2 items-start">
                  {/* Color picker button */}
                  <div className="relative flex-shrink-0" ref={colorPickerRef}>
                    <button
                      type="button"
                      onClick={() => setColorPickerOpen(v => !v)}
                      title="Elegir color del equipo"
                      className="w-10 h-10 rounded-xl border-2 border-neutral-200 hover:border-neutral-400 transition-colors ring-offset-2 hover:ring-2 hover:ring-neutral-300"
                      style={{ backgroundColor: formColor }}
                    />
                    {colorPickerOpen && (
                      <div className="absolute top-full left-0 mt-2 z-30 bg-white border border-neutral-200 rounded-xl shadow-xl p-3 min-w-[176px]">
                        <p className="text-[10px] text-neutral-400 font-semibold uppercase tracking-wider mb-2">Color del equipo</p>
                        <div className="grid grid-cols-6 gap-1.5 mb-3">
                          {TEAM_COLOR_PALETTE.map(c => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => { setFormColor(c); setColorPickerOpen(false); }}
                              className="w-6 h-6 rounded-lg transition-transform hover:scale-110 flex-shrink-0"
                              style={{
                                backgroundColor: c,
                                outline: formColor === c ? `2px solid ${c}` : 'none',
                                outlineOffset: '2px',
                              }}
                            />
                          ))}
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={formColor}
                            onChange={e => setFormColor(e.target.value)}
                            className="w-7 h-7 rounded cursor-pointer border-0 p-0 bg-transparent flex-shrink-0"
                          />
                          <input
                            type="text"
                            value={formColor}
                            onChange={e => { if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) setFormColor(e.target.value); }}
                            className="flex-1 text-xs font-mono px-2 py-1.5 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-900 min-w-0"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  <input
                    type="text"
                    value={formNombre}
                    onChange={e => setFormNombre(e.target.value)}
                    placeholder="Ej. Operaciones CDMX Norte"
                    className="flex-1 px-3 py-2.5 border border-neutral-300 rounded-xl text-sm focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-1.5">DescripciÃ³n</label>
                <textarea
                  value={formDescripcion}
                  onChange={e => setFormDescripcion(e.target.value)}
                  placeholder="Describe quÃ© trÃ¡mites gestiona este equipo..."
                  rows={2}
                  className="w-full px-3 py-2.5 border border-neutral-300 rounded-xl text-sm focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900 outline-none resize-none"
                />
              </div>

              {/* Ãrea (REQ-01: inline creation) */}
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-1.5">Ãrea</label>
                <div className="flex flex-wrap gap-2">
                  {areasDisponibles.map(a => {
                    const cfg = getAC(a.nombre);
                    const active = formAreaId === a.id;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => {
                          if (active) { setFormArea(null); setFormAreaId(null); }
                          else { setFormArea(a.nombre); setFormAreaId(a.id); }
                        }}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
                          active
                            ? `${cfg.bg} ${cfg.color} ${cfg.border} border-2`
                            : 'bg-white text-neutral-500 border-neutral-200 hover:border-neutral-300'
                        }`}
                      >
                        {a.nombre === 'Comercial' ? <Briefcase className="w-3.5 h-3.5" /> : <Wrench className="w-3.5 h-3.5" />}
                        {a.nombre}
                      </button>
                    );
                  })}

                  {/* Inline area creation */}
                  {formCreatingArea ? (
                    <div className="flex items-center gap-1.5 border-2 border-neutral-400 rounded-xl px-2.5 py-1.5 bg-white">
                      <input
                        autoFocus
                        type="text"
                        value={formNewAreaName}
                        onChange={e => setFormNewAreaName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleConfirmNewArea();
                          if (e.key === 'Escape') { setFormCreatingArea(false); setFormNewAreaName(''); }
                        }}
                        placeholder="Nombre del Ã¡rea"
                        className="text-sm font-medium outline-none w-32 placeholder:text-neutral-300"
                      />
                      <button type="button" onClick={handleConfirmNewArea} className="text-green-600 hover:text-green-700 flex-shrink-0">
                        <Check className="w-4 h-4" />
                      </button>
                      <button type="button" onClick={() => { setFormCreatingArea(false); setFormNewAreaName(''); }} className="text-neutral-400 hover:text-neutral-600 flex-shrink-0">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setFormCreatingArea(true)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-neutral-300 text-sm text-neutral-400 hover:border-neutral-400 hover:text-neutral-600 transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Nueva Ã¡rea
                    </button>
                  )}
                </div>
                <p className="text-xs text-neutral-400 mt-1.5">Sin Ã¡rea = comodÃ­n para cualquier tipo de trÃ¡mite.</p>
              </div>

              {/* All offices toggle */}
              <div className={`flex items-start gap-3 p-3.5 rounded-xl border ${formAllOffices ? 'bg-teal-50 border-teal-200' : 'bg-neutral-50 border-neutral-200'}`}>
                <button
                  type="button"
                  onClick={() => setFormAllOffices(v => !v)}
                  className={`w-5 h-5 rounded flex-shrink-0 mt-0.5 flex items-center justify-center border-2 transition-colors ${formAllOffices ? 'bg-teal-600 border-teal-600 text-white' : 'border-neutral-300 bg-white'}`}
                >
                  {formAllOffices && <Check className="w-3 h-3" />}
                </button>
                <div>
                  <p className="text-sm font-semibold text-neutral-700">Todas las oficinas</p>
                  <p className="text-xs text-neutral-500 mt-0.5">El equipo tendrÃ¡ acceso a trÃ¡mites de todas las oficinas actuales y futuras.</p>
                </div>
              </div>

              {/* Specific offices picker */}
              {!formAllOffices && (
                <div className="border border-neutral-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 bg-neutral-50 border-b border-neutral-100 flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-neutral-700 flex items-center gap-2">
                      <Building2 className="w-4 h-4" /> Oficinas asignadas
                    </h4>
                    {formSelectedOficinas.length > 0 && (
                      <span className="text-xs bg-neutral-200 text-neutral-700 px-2 py-0.5 rounded-full font-semibold">
                        {formSelectedOficinas.length} seleccionada{formSelectedOficinas.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  {formSelectedOficinas.length > 0 && (
                    <div className="px-3 pt-3 flex flex-wrap gap-2">
                      {formSelectedOficinas.map(id => {
                        const of = oficinas.find(o => o.id === id);
                        if (!of) return null;
                        return (
                          <span key={id} className="inline-flex items-center gap-1.5 bg-neutral-900 text-white text-xs font-medium px-2.5 py-1 rounded-full">
                            {of.nombre}
                            <button type="button" onClick={() => setFormSelectedOficinas(prev => prev.filter(x => x !== id))} className="hover:text-red-300 transition-colors">
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                  <div className="p-3 space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
                      <input
                        type="text"
                        placeholder="Buscar oficina..."
                        value={formOficinaSearch}
                        onChange={e => setFormOficinaSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 border border-neutral-200 rounded-lg text-sm focus:ring-2 focus:ring-neutral-900 outline-none"
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {oficinas.filter(o => !formSelectedOficinas.includes(o.id) && o.nombre.toLowerCase().includes(formOficinaSearch.toLowerCase())).length === 0 ? (
                        <p className="text-xs text-neutral-400 text-center py-3">
                          {formOficinaSearch ? 'Sin resultados' : formSelectedOficinas.length === oficinas.length ? 'Todas las oficinas asignadas' : 'No hay oficinas disponibles'}
                        </p>
                      ) : (
                        oficinas
                          .filter(o => !formSelectedOficinas.includes(o.id) && o.nombre.toLowerCase().includes(formOficinaSearch.toLowerCase()))
                          .map(o => (
                            <button
                              key={o.id}
                              type="button"
                              onClick={() => { setFormSelectedOficinas(prev => [...prev, o.id]); setFormOficinaSearch(''); }}
                              className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-neutral-100 hover:bg-neutral-50 text-left transition-colors group"
                            >
                              <div className="flex items-center gap-2">
                                <Building2 className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
                                <span className="text-sm text-neutral-800">{o.nombre}</span>
                              </div>
                              <Plus className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-700 transition-colors" />
                            </button>
                          ))
                      )}
                    </div>
                  </div>
                  {formSelectedOficinas.length === 0 && (
                    <div className="px-4 pb-3 flex items-center gap-2 text-xs text-amber-600">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                      Sin oficinas asignadas â€” el equipo no verÃ¡ ningÃºn trÃ¡mite.
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between p-3.5 rounded-xl bg-neutral-50 border border-neutral-200">
                <div>
                  <p className="text-sm font-semibold text-neutral-700">Estado</p>
                  <p className="text-xs text-neutral-500">{formActivo ? 'Activo â€” el equipo puede ver trÃ¡mites' : 'Inactivo â€” el equipo estÃ¡ pausado'}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormActivo(v => !v)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${formActivo ? 'bg-green-500' : 'bg-neutral-300'}`}
                >
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${formActivo ? 'left-7' : 'left-1'}`} />
                </button>
              </div>

              {formError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{formError}</p>}
            </div>
          )}

          {/* â”€â”€ TAB: MIEMBROS â”€â”€ */}
          {selectedGrupo && formTab === 'miembros' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="border-2 border-amber-200 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 bg-amber-50">
                  <h4 className="font-bold text-sm text-amber-700 flex items-center gap-2">
                    <Users className="w-4 h-4" /> Miembros actuales ({miembros.length})
                  </h4>
                </div>
                <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
                  {miembros.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
                      <Users className="w-8 h-8 text-neutral-300" />
                      <p className="text-sm text-neutral-400 font-medium">Sin miembros en este equipo</p>
                      <p className="text-xs text-neutral-400">Busca y agrega agentes desde el panel derecho</p>
                    </div>
                  ) : (
                    miembros.map(m => {
                      const rc = ROL_CONFIG[m.rol_en_equipo] ?? ROL_CONFIG.miembro;
                      const RolIcon = rc.icon;
                      return (
                        <div key={m.usuario_id} className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl group hover:bg-neutral-100 transition-colors">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-neutral-900 text-sm truncate">{m.nombre_completo}</p>
                              <div className="relative">
                                <button
                                  onClick={() => setEditingRolMiembro(editingRolMiembro === m.usuario_id ? null : m.usuario_id)}
                                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-semibold ${rc.bg} ${rc.text} hover:opacity-75 transition-opacity flex-shrink-0`}
                                >
                                  <RolIcon className="w-2.5 h-2.5" />{rc.label}
                                </button>
                                {editingRolMiembro === m.usuario_id && (
                                  <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-neutral-200 rounded-xl shadow-lg p-1 space-y-0.5 min-w-[130px]">
                                    {(['director', 'supervisor', 'lider', 'ejecutivo', 'miembro'] as const).map(rol => {
                                      const rci = ROL_CONFIG[rol]; const RCI = rci.icon;
                                      return (
                                        <button key={rol} onClick={() => handleChangeRolMiembro(m.usuario_id, rol)}
                                          className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${m.rol_en_equipo === rol ? `${rci.bg} ${rci.text}` : 'text-neutral-700 hover:bg-neutral-50'}`}>
                                          <RCI className="w-3 h-3" />{rci.label}
                                          {m.rol_en_equipo === rol && <Check className="w-3 h-3 ml-auto" />}
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-xs text-neutral-500">
                              <span>{m.rol}</span>
                              {m.oficina_nombre && <><span className="text-neutral-300">Â·</span><span>{m.oficina_nombre}</span></>}
                            </div>
                          </div>
                          <button onClick={() => handleRemoverMiembro(m.usuario_id)} className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-100 transition-all ml-2 flex-shrink-0">
                            <UserMinus className="w-4 h-4 text-red-600" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
              <div className="border border-neutral-200 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 bg-neutral-50 border-b border-neutral-100">
                  <h4 className="font-bold text-sm text-neutral-700 flex items-center gap-2"><UserPlus className="w-4 h-4" /> Agregar miembros</h4>
                </div>
                <div className="p-4 space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                    <input type="text" placeholder="Buscar por nombre..." value={searchMiembro} onChange={e => setSearchMiembro(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border border-neutral-200 rounded-xl text-sm focus:ring-2 focus:ring-neutral-900 outline-none" />
                  </div>
                  <div className="max-h-64 overflow-y-auto space-y-1">
                    {miembrosDisponibles.length === 0 ? (
                      <p className="text-sm text-neutral-400 text-center py-4">{searchMiembro ? 'Sin resultados' : 'Todos ya estÃ¡n asignados'}</p>
                    ) : (
                      miembrosDisponibles.map(u => (
                        <div key={u.id} className="border border-neutral-100 rounded-xl overflow-hidden">
                          <div className="flex items-center justify-between p-3 hover:bg-neutral-50 transition-colors">
                            <div className="min-w-0">
                              <p className="font-medium text-neutral-900 text-sm truncate">{u.nombre_completo}</p>
                              <p className="text-xs text-neutral-500">{u.rol}{u.oficina_id ? ` Â· ${oficinas.find(o => o.id === u.oficina_id)?.nombre ?? ''}` : ''}</p>
                            </div>
                            {pendingAdd?.userId === u.id ? (
                              <button onClick={() => setPendingAdd(null)} className="p-1.5 rounded-lg hover:bg-neutral-100 transition-colors flex-shrink-0">
                                <X className="w-3.5 h-3.5 text-neutral-400" />
                              </button>
                            ) : (
                              <button onClick={() => setPendingAdd({ userId: u.id, rol: 'ejecutivo' })} className="p-1.5 rounded-lg hover:bg-green-100 transition-colors flex-shrink-0">
                                <UserPlus className="w-4 h-4 text-green-600" />
                              </button>
                            )}
                          </div>
                          {pendingAdd?.userId === u.id && (
                            <div className="px-3 pb-3 bg-neutral-50 border-t border-neutral-100">
                              <p className="text-[11px] text-neutral-500 font-medium mb-2 mt-2">Rol en el equipo:</p>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {(['director', 'supervisor', 'lider', 'ejecutivo', 'miembro'] as const).map(rol => {
                                  const rci = ROL_CONFIG[rol]; const RCI = rci.icon;
                                  return (
                                    <button key={rol} onClick={() => { void handleAgregarMiembro(u.id, rol); setPendingAdd(null); }}
                                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border-2 transition-colors ${pendingAdd.rol === rol ? `${rci.bg} ${rci.text} border-current` : 'border-neutral-200 text-neutral-500 hover:border-neutral-400'}`}
                                      onMouseEnter={() => setPendingAdd(prev => prev ? { ...prev, rol } : prev)}>
                                      <RCI className="w-3 h-3" />{rci.label}
                                    </button>
                                  );
                                })}
                                <button onClick={() => { void handleAgregarMiembro(u.id, pendingAdd.rol); setPendingAdd(null); }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-600 text-white hover:bg-green-700 transition-colors ml-auto">
                                  <Check className="w-3 h-3" /> Agregar
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* â”€â”€ TAB: OFICINAS â”€â”€ */}
          {selectedGrupo && formTab === 'oficinas' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="border-2 border-teal-200 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 bg-teal-50">
                  <h4 className="font-bold text-sm text-teal-700 flex items-center gap-2">
                    <Building2 className="w-4 h-4" /> Oficinas asignadas
                  </h4>
                </div>
                <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
                  {selectedGrupo.all_offices ? (
                    <p className="text-sm text-teal-700 text-center py-4 bg-teal-50 rounded-xl">Acceso a todas las oficinas activas</p>
                  ) : grupoOficinas.length === 0 ? (
                    <div className="text-center py-6">
                      <AlertTriangle className="w-8 h-8 mx-auto text-amber-400 mb-2" />
                      <p className="text-sm text-neutral-400">Sin oficinas asignadas</p>
                      <p className="text-xs text-amber-600 mt-1">Este equipo no verÃ¡ ningÃºn trÃ¡mite</p>
                    </div>
                  ) : (
                    grupoOficinas.map(go => (
                      <div key={go.id} className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl group hover:bg-neutral-100 transition-colors">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
                          <span className="text-sm font-medium text-neutral-800">{go.oficina_nombre}</span>
                        </div>
                        <button onClick={() => handleRemoverOficina(go.id, go.oficina_id)} className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-100 transition-all">
                          <X className="w-4 h-4 text-red-600" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
              {!selectedGrupo.all_offices && (
                <div className="border border-neutral-200 rounded-2xl overflow-hidden">
                  <div className="px-4 py-3 bg-neutral-50 border-b border-neutral-100">
                    <h4 className="font-bold text-sm text-neutral-700 flex items-center gap-2"><Plus className="w-4 h-4" /> Agregar oficinas</h4>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                      <input type="text" placeholder="Buscar oficina..." value={searchOficina} onChange={e => setSearchOficina(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 border border-neutral-200 rounded-xl text-sm focus:ring-2 focus:ring-neutral-900 outline-none" />
                    </div>
                    <div className="max-h-64 overflow-y-auto space-y-1">
                      {oficinasDisponibles.length === 0 ? (
                        <p className="text-sm text-neutral-400 text-center py-4">{searchOficina ? 'Sin resultados' : 'Todas las oficinas ya estÃ¡n asignadas'}</p>
                      ) : (
                        oficinasDisponibles.map(o => (
                          <div key={o.id} className="flex items-center justify-between p-3 border border-neutral-100 rounded-xl hover:bg-neutral-50 transition-colors">
                            <div className="flex items-center gap-2">
                              <Building2 className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
                              <span className="text-sm font-medium text-neutral-800">{o.nombre}</span>
                            </div>
                            <button onClick={() => handleAgregarOficina(o.id)} className="p-1.5 rounded-lg hover:bg-teal-100 transition-colors flex-shrink-0">
                              <Plus className="w-4 h-4 text-teal-600" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* â”€â”€ TAB: ASIGNACIÃ“N â”€â”€ */}
          {selectedGrupo && formTab === 'asignacion' && (() => {
            // REQ-02: Only show assigned offices in filter (unless all_offices)
            const oficinasParaFiltro = formAllOffices
              ? oficinas
              : oficinas.filter(o => formSelectedOficinas.includes(o.id));

            const disponibles = agentesParaReglas.filter(a =>
              !grupoReglas.some(r => r.usuario_id === a.id) &&
              (filterReglaOficinaId === '' || a.oficina_id === filterReglaOficinaId) &&
              (searchReglaOficina === '' || a.nombre_completo.toLowerCase().includes(searchReglaOficina.toLowerCase()))
            );
            const allSelected = disponibles.length > 0 && disponibles.every(a => selectedAgentIds.includes(a.id));

            // REQ-04: Filter asignados by type
            const reglasFiltradas = grupoReglas.filter(r => {
              if (filterAsignacionTipo === 'pool') return !r.ejecutivo_id;
              if (filterAsignacionTipo === 'asignado') return !!r.ejecutivo_id;
              return true;
            });

            return (
              <div className="space-y-4">
                {/* REQ-03: Default pool banner */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2 text-sm text-blue-800">
                  <GitBranch className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-500" />
                  <div>
                    TrÃ¡mites sin regla asignada van al <strong>pool del equipo</strong>.
                    {grupoReglas.length === 0
                      ? ' Actualmente todos los trÃ¡mites de este equipo llegan al pool general.'
                      : <> {grupoReglas.length} vendedor{grupoReglas.length !== 1 ? 'es' : ''} con regla activa.</>}
                    {selectedGrupo?.area_categoria && (
                      <> Aplica solo a trÃ¡mites del Ã¡rea <strong>{selectedGrupo.area_categoria}</strong>.</>
                    )}
                  </div>
                </div>

                {/* Vendedores asignados */}
                <div className="border border-neutral-200 rounded-2xl overflow-hidden">
                  <div className="px-4 py-3 bg-neutral-50 border-b border-neutral-100 flex items-center gap-2 flex-wrap">
                    <h4 className="font-bold text-sm text-neutral-700">Vendedores asignados ({grupoReglas.length})</h4>
                    {/* REQ-04: Filter by assignment type */}
                    <select
                      value={filterAsignacionTipo}
                      onChange={e => setFilterAsignacionTipo(e.target.value as typeof filterAsignacionTipo)}
                      className="ml-auto text-xs border border-neutral-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                    >
                      <option value="todos">Todos</option>
                      <option value="pool">En pool</option>
                      <option value="asignado">Con ejecutivo</option>
                    </select>
                  </div>
                  <div className="p-4 space-y-2 max-h-52 overflow-y-auto">
                    {reglasFiltradas.length === 0 ? (
                      <p className="text-sm text-neutral-400 text-center py-6">
                        {filterAsignacionTipo !== 'todos' ? 'Sin resultados para ese filtro.' : 'Sin vendedores asignados. Los trÃ¡mites llegarÃ¡n al pool general.'}
                      </p>
                    ) : (
                      reglasFiltradas.map(r => {
                        const ejecutivosDisponibles = miembros.filter(m => ['lider','supervisor','director','ejecutivo'].includes(m.rol_en_equipo));
                        return (
                          <div key={r.id} className="flex items-center gap-2 p-3 bg-neutral-50 rounded-xl group hover:bg-neutral-100 transition-colors">
                            <User className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-sm font-medium text-neutral-800 truncate">{r.usuario_nombre}</span>
                                {r.oficina_nombre && (
                                  <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-full bg-neutral-100 text-neutral-500 shrink-0">{r.oficina_nombre}</span>
                                )}
                              </div>
                              {ejecutivosDisponibles.length > 0 && (
                                <div className="flex items-center gap-1 mt-1">
                                  <Zap className="w-3 h-3 text-blue-400 flex-shrink-0" />
                                  <select
                                    value={r.ejecutivo_id ?? ''}
                                    disabled={savingEjecutivoReglaId === r.id}
                                    onChange={e => handleCambiarEjecutivoEnRegla(r.id, e.target.value || null)}
                                    className="text-[11px] text-neutral-500 bg-transparent border-none outline-none cursor-pointer hover:text-neutral-800 py-0 pr-4"
                                  >
                                    <option value="">Pool del equipo</option>
                                    {ejecutivosDisponibles.map(m => (
                                      <option key={m.usuario_id} value={m.usuario_id}>{m.nombre_completo}</option>
                                    ))}
                                  </select>
                                  {savingEjecutivoReglaId === r.id && <Loader2 className="w-3 h-3 animate-spin text-neutral-400" />}
                                </div>
                              )}
                            </div>
                            <button onClick={() => handleRemoverRegla(r.id)} className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-100 transition-all flex-shrink-0">
                              <X className="w-4 h-4 text-red-600" />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Agregar vendedores */}
                <div className="border border-neutral-200 rounded-2xl overflow-hidden">
                  <div className="px-4 py-3 bg-neutral-50 border-b border-neutral-100 flex items-center justify-between">
                    <h4 className="font-bold text-sm text-neutral-700 flex items-center gap-2"><Plus className="w-4 h-4" /> Agregar vendedores</h4>
                    {selectedAgentIds.length > 0 && (
                      <button
                        onClick={handleAgregarReglas}
                        disabled={savingRegla}
                        className="px-3 py-1 text-xs font-semibold rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors disabled:opacity-50"
                      >
                        {savingRegla ? 'Guardandoâ€¦' : `Agregar ${selectedAgentIds.length} seleccionado${selectedAgentIds.length > 1 ? 's' : ''}`}
                      </button>
                    )}
                  </div>
                  {reglaError && (
                    <div className="px-4 py-2 bg-red-50 border-b border-red-100 text-xs text-red-700 flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />{reglaError}
                    </div>
                  )}
                  <div className="p-4 space-y-3">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                        <input type="text" placeholder="Buscar vendedor..." value={searchReglaOficina} onChange={e => setSearchReglaOficina(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 border border-neutral-200 rounded-xl text-sm focus:ring-2 focus:ring-neutral-900 outline-none" />
                      </div>
                      {/* REQ-02: Only show assigned offices */}
                      <select
                        value={filterReglaOficinaId}
                        onChange={e => setFilterReglaOficinaId(e.target.value)}
                        className="px-3 py-2 border border-neutral-200 rounded-xl text-sm focus:ring-2 focus:ring-neutral-900 outline-none max-w-[160px]"
                      >
                        <option value="">Todas las oficinas</option>
                        {oficinasParaFiltro.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                      </select>
                    </div>
                    {disponibles.length > 0 && (
                      <label className="flex items-center gap-2 px-2 py-1 cursor-pointer text-sm text-neutral-600 hover:text-neutral-900">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={() => {
                            if (allSelected) {
                              setSelectedAgentIds(prev => prev.filter(id => !disponibles.some(a => a.id === id)));
                            } else {
                              setSelectedAgentIds(prev => [...new Set([...prev, ...disponibles.map(a => a.id)])]);
                            }
                          }}
                          className="rounded"
                        />
                        <span className="font-medium">Seleccionar todos ({disponibles.length})</span>
                      </label>
                    )}
                    <div className="max-h-56 overflow-y-auto space-y-1">
                      {disponibles.length === 0 ? (
                        <p className="text-sm text-neutral-400 text-center py-4">
                          {searchReglaOficina || filterReglaOficinaId ? 'Sin resultados' : 'Todos los usuarios ya estÃ¡n asignados'}
                        </p>
                      ) : (
                        disponibles.map(a => (
                          <label key={a.id} className="flex items-center gap-3 p-2.5 border border-neutral-100 rounded-xl hover:bg-neutral-50 transition-colors cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedAgentIds.includes(a.id)}
                              onChange={() => setSelectedAgentIds(prev =>
                                prev.includes(a.id) ? prev.filter(x => x !== a.id) : [...prev, a.id]
                              )}
                              className="rounded flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-neutral-800 truncate">{a.nombre_completo}</p>
                              <p className="text-[11px] text-neutral-400">{a.rol}{a.oficina_id ? ` Â· ${oficinas.find(o => o.id === a.oficina_id)?.nombre ?? ''}` : ''}</p>
                            </div>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* â”€â”€ TAB: TRÃMITES (REQ-06 + REQ-07) â”€â”€ */}
          {selectedGrupo && formTab === 'tramites' && (
            <div className="space-y-4">
              {!formArea ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                  <strong>Sin Ã¡rea asignada</strong> â€” este equipo recibe trÃ¡mites de cualquier tipo.
                  Asigna un Ã¡rea en la pestaÃ±a <strong>General</strong> para ver y configurar los tipos aplicables.
                </div>
              ) : (
                <>
                  <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-3 flex items-start gap-2 text-sm text-neutral-700">
                    <FileText className="w-4 h-4 mt-0.5 flex-shrink-0 text-neutral-400" />
                    <div>
                      Tipos de trÃ¡mite del Ã¡rea <strong>{formArea}</strong>.
                      {isAdmin
                        ? ' Activa o desactiva cada tipo para este equipo. Por defecto todos estÃ¡n habilitados.'
                        : ' Solo los administradores pueden cambiar la configuraciÃ³n.'}
                    </div>
                  </div>
                  {loadingTipos ? (
                    <div className="flex justify-center py-10">
                      <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
                    </div>
                  ) : tiposPorArea.length === 0 ? (
                    <div className="text-center py-10 bg-neutral-50 rounded-2xl border border-neutral-200">
                      <FileText className="w-8 h-8 mx-auto text-neutral-300 mb-2" />
                      <p className="text-sm text-neutral-400">No hay tipos de trÃ¡mite configurados para el Ã¡rea {formArea}.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {tiposPorArea.map(tipo => {
                        const habilitado = teamTipoConfig[tipo.id] !== false;
                        return (
                          <div
                            key={tipo.id}
                            className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                              habilitado
                                ? 'bg-white border-neutral-200'
                                : 'bg-neutral-50 border-neutral-200 opacity-60'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <FileText className={`w-4 h-4 flex-shrink-0 ${habilitado ? 'text-neutral-400' : 'text-neutral-300'}`} />
                              <span className={`text-sm font-medium truncate ${habilitado ? 'text-neutral-800' : 'text-neutral-400'}`}>
                                {tipo.label}
                              </span>
                              {!habilitado && (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-neutral-200 text-neutral-500 flex-shrink-0">Desactivado</span>
                              )}
                            </div>
                            {isAdmin && (
                              <button
                                disabled={savingTipoToggle === tipo.id}
                                onClick={() => handleTipoToggle(tipo.id, !habilitado)}
                                className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ml-3 ${habilitado ? 'bg-green-500' : 'bg-neutral-300'}`}
                              >
                                {savingTipoToggle === tipo.id
                                  ? <Loader2 className="w-3 h-3 animate-spin text-white absolute top-1 left-3.5" />
                                  : <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${habilitado ? 'left-5' : 'left-0.5'}`} />
                                }
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Bottom actions â€” only on General tab */}
          {(!selectedGrupo || formTab === 'general') && (
            <div className="flex gap-3 justify-end">
              <button onClick={() => setPanel('list')} className="px-5 py-2.5 text-sm rounded-xl border border-neutral-200 hover:bg-neutral-50 font-medium">Cancelar</button>
              <button
                onClick={handleSaveForm}
                disabled={formSaving}
                className="px-5 py-2.5 text-sm rounded-xl font-semibold text-white transition-all flex items-center gap-2 disabled:opacity-50 hover:opacity-90"
                style={{ backgroundColor: formColor }}
              >
                {formSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {selectedGrupo ? 'Guardar cambios' : 'Crear equipo'}
              </button>
            </div>
          )}

          {/* Close button for non-General tabs */}
          {selectedGrupo && formTab !== 'general' && (
            <div className="flex justify-end">
              <button onClick={() => setPanel('list')} className="px-5 py-2.5 text-sm rounded-xl border border-neutral-200 hover:bg-neutral-50 font-medium">Cerrar</button>
            </div>
          )}
        </div>
      </>
    );
  }

  // â”€â”€ MEMBERS PANEL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  if (panel === 'members' && selectedGrupo) {
    const ac = getAC(selectedGrupo.area_categoria);
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => setPanel('list')} className="p-2 rounded-xl hover:bg-neutral-100 text-neutral-500 transition-colors">
            <X className="w-4 h-4" />
          </button>
          <div className={`p-2 rounded-lg ${ac.bg} flex-shrink-0`}>
            <span className={ac.color}><AreaIcon area={selectedGrupo.area_categoria} /></span>
          </div>
          <div>
            <h3 className="font-bold text-neutral-900">{selectedGrupo.nombre}</h3>
            <p className="text-xs text-neutral-500">GestiÃ³n de miembros Â· {miembros.length} actuales</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className={`border-2 rounded-2xl overflow-hidden ${ac.border}`}>
            <div className={`px-4 py-3 ${ac.bg}`}>
              <h4 className={`font-bold text-sm ${ac.color} flex items-center gap-2`}>
                <Users className="w-4 h-4" /> Miembros actuales ({miembros.length})
              </h4>
              <p className="text-xs text-neutral-500 mt-0.5">
                {selectedGrupo.area_categoria === 'Comercial'
                  ? 'Ven trÃ¡mites comerciales de las oficinas asignadas al equipo'
                  : 'Ven trÃ¡mites operativos de las oficinas asignadas al equipo'}
              </p>
            </div>
            <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
              {miembros.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
                  <Users className="w-8 h-8 text-neutral-300" />
                  <p className="text-sm text-neutral-400 font-medium">Sin miembros en este equipo</p>
                  <p className="text-xs text-neutral-400">Busca y agrega agentes desde el panel derecho</p>
                </div>
              ) : (
                miembros.map(m => {
                  const rc = ROL_CONFIG[m.rol_en_equipo] ?? ROL_CONFIG.miembro;
                  const RolIcon = rc.icon;
                  return (
                    <div key={m.usuario_id} className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl group hover:bg-neutral-100 transition-colors">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-neutral-900 text-sm truncate">{m.nombre_completo}</p>
                          <div className="relative">
                            <button
                              onClick={() => setEditingRolMiembro(editingRolMiembro === m.usuario_id ? null : m.usuario_id)}
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-semibold ${rc.bg} ${rc.text} hover:opacity-75 transition-opacity flex-shrink-0`}
                              title="Cambiar rol en equipo"
                            >
                              <RolIcon className="w-2.5 h-2.5" />
                              {rc.label}
                            </button>
                            {editingRolMiembro === m.usuario_id && (
                              <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-neutral-200 rounded-xl shadow-lg p-1 space-y-0.5 min-w-[130px]">
                                {(['director', 'supervisor', 'lider', 'ejecutivo', 'miembro'] as const).map(rol => {
                                  const rci = ROL_CONFIG[rol]; const RCI = rci.icon;
                                  return (
                                    <button key={rol} onClick={() => handleChangeRolMiembro(m.usuario_id, rol)}
                                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${m.rol_en_equipo === rol ? `${rci.bg} ${rci.text}` : 'text-neutral-700 hover:bg-neutral-50'}`}>
                                      <RCI className="w-3 h-3" />{rci.label}
                                      {m.rol_en_equipo === rol && <Check className="w-3 h-3 ml-auto" />}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-neutral-500">
                          <span>{m.rol}</span>
                          {m.oficina_nombre && <><span className="text-neutral-300">Â·</span><span>{m.oficina_nombre}</span></>}
                        </div>
                      </div>
                      <button onClick={() => handleRemoverMiembro(m.usuario_id)} className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-100 transition-all ml-2 flex-shrink-0" title="Remover del equipo">
                        <UserMinus className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="border border-neutral-200 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 bg-neutral-50 border-b border-neutral-100">
              <h4 className="font-bold text-sm text-neutral-700 flex items-center gap-2">
                <UserPlus className="w-4 h-4" /> Agregar miembros
                <span className="text-xs font-normal text-neutral-400">(Empleados, Gerentes, Admins)</span>
              </h4>
            </div>
            <div className="p-4 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input type="text" placeholder="Buscar por nombre..." value={searchMiembro} onChange={e => setSearchMiembro(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-neutral-200 rounded-xl text-sm focus:ring-2 focus:ring-neutral-900 outline-none" />
              </div>
              <div className="max-h-72 overflow-y-auto space-y-1">
                {miembrosDisponibles.length === 0 ? (
                  <p className="text-sm text-neutral-400 text-center py-4">
                    {searchMiembro ? 'Sin resultados' : 'Todos los usuarios ya estÃ¡n asignados'}
                  </p>
                ) : (
                  miembrosDisponibles.map(u => (
                    <div key={u.id} className="border border-neutral-100 rounded-xl overflow-hidden">
                      <div className="flex items-center justify-between p-3 hover:bg-neutral-50 transition-colors">
                        <div className="min-w-0">
                          <p className="font-medium text-neutral-900 text-sm truncate">{u.nombre_completo}</p>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-neutral-500">
                            <span>{u.rol}</span>
                            {u.oficina_id && oficinas.find(o => o.id === u.oficina_id) && <><span className="text-neutral-300">Â·</span><span>{oficinas.find(o => o.id === u.oficina_id)!.nombre}</span></>}
                          </div>
                        </div>
                        {pendingAdd?.userId === u.id ? (
                          <button onClick={() => setPendingAdd(null)} className="p-1.5 rounded-lg hover:bg-neutral-100 transition-colors flex-shrink-0">
                            <X className="w-3.5 h-3.5 text-neutral-400" />
                          </button>
                        ) : (
                          <button onClick={() => setPendingAdd({ userId: u.id, rol: 'ejecutivo' })} className="p-1.5 rounded-lg hover:bg-green-100 transition-colors flex-shrink-0" title="Agregar al equipo">
                            <UserPlus className="w-4 h-4 text-green-600" />
                          </button>
                        )}
                      </div>
                      {pendingAdd?.userId === u.id && (
                        <div className="px-3 pb-3 bg-neutral-50 border-t border-neutral-100">
                          <p className="text-[11px] text-neutral-500 font-medium mb-2 mt-2">Rol en el equipo:</p>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {(['director', 'supervisor', 'lider', 'ejecutivo', 'miembro'] as const).map(rol => {
                              const rci = ROL_CONFIG[rol]; const RCI = rci.icon;
                              return (
                                <button key={rol} onClick={() => { void handleAgregarMiembro(u.id, rol); setPendingAdd(null); }}
                                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border-2 transition-colors ${pendingAdd.rol === rol ? `${rci.bg} ${rci.text} border-current` : 'border-neutral-200 text-neutral-500 hover:border-neutral-400'}`}
                                  onMouseEnter={() => setPendingAdd(prev => prev ? { ...prev, rol } : prev)}>
                                  <RCI className="w-3 h-3" />{rci.label}
                                </button>
                              );
                            })}
                            <button onClick={() => { void handleAgregarMiembro(u.id, pendingAdd.rol); setPendingAdd(null); }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-600 text-white hover:bg-green-700 transition-colors ml-auto">
                              <Check className="w-3 h-3" /> Agregar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // â”€â”€ OFFICES PANEL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  if (panel === 'offices' && selectedGrupo) {
    const ac = getAC(selectedGrupo.area_categoria);
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => setPanel('list')} className="p-2 rounded-xl hover:bg-neutral-100 text-neutral-500 transition-colors">
            <X className="w-4 h-4" />
          </button>
          <div className={`p-2 rounded-lg ${ac.bg} flex-shrink-0`}>
            <span className={ac.color}><Building2 className="w-4 h-4" /></span>
          </div>
          <div>
            <h3 className="font-bold text-neutral-900">{selectedGrupo.nombre}</h3>
            <p className="text-xs text-neutral-500">
              Oficinas asignadas Â· {selectedGrupo.all_offices ? 'Todas' : `${grupoOficinas.length} asignadas`}
            </p>
          </div>
        </div>

        {selectedGrupo.all_offices && (
          <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 flex items-center gap-2 text-sm text-teal-800">
            <Globe className="w-4 h-4 flex-shrink-0" />
            Este equipo tiene acceso a todas las oficinas activas.
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="border-2 border-teal-200 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 bg-teal-50">
              <h4 className="font-bold text-sm text-teal-700 flex items-center gap-2">
                <Building2 className="w-4 h-4" /> Oficinas asignadas
              </h4>
            </div>
            <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
              {selectedGrupo.all_offices ? (
                <p className="text-sm text-teal-700 text-center py-4 bg-teal-50 rounded-xl">Acceso a todas las oficinas activas</p>
              ) : grupoOficinas.length === 0 ? (
                <div className="text-center py-6">
                  <AlertTriangle className="w-8 h-8 mx-auto text-amber-400 mb-2" />
                  <p className="text-sm text-neutral-400">Sin oficinas asignadas</p>
                  <p className="text-xs text-amber-600 mt-1">Este equipo no verÃ¡ ningÃºn trÃ¡mite</p>
                </div>
              ) : (
                grupoOficinas.map(go => (
                  <div key={go.id} className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl group hover:bg-neutral-100 transition-colors">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
                      <span className="text-sm font-medium text-neutral-800">{go.oficina_nombre}</span>
                    </div>
                    <button onClick={() => handleRemoverOficina(go.id, go.oficina_id)} className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-100 transition-all" title="Quitar oficina">
                      <X className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {!selectedGrupo.all_offices && (
            <div className="border border-neutral-200 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 bg-neutral-50 border-b border-neutral-100">
                <h4 className="font-bold text-sm text-neutral-700 flex items-center gap-2"><Plus className="w-4 h-4" /> Agregar oficinas</h4>
              </div>
              <div className="p-4 space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                  <input type="text" placeholder="Buscar oficina..." value={searchOficina} onChange={e => setSearchOficina(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-neutral-200 rounded-xl text-sm focus:ring-2 focus:ring-neutral-900 outline-none" />
                </div>
                <div className="max-h-72 overflow-y-auto space-y-1">
                  {oficinasDisponibles.length === 0 ? (
                    <p className="text-sm text-neutral-400 text-center py-4">{searchOficina ? 'Sin resultados' : 'Todas las oficinas ya estÃ¡n asignadas'}</p>
                  ) : (
                    oficinasDisponibles.map(o => (
                      <div key={o.id} className="flex items-center justify-between p-3 border border-neutral-100 rounded-xl hover:bg-neutral-50 transition-colors">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
                          <span className="text-sm font-medium text-neutral-800">{o.nombre}</span>
                        </div>
                        <button onClick={() => handleAgregarOficina(o.id)} className="p-1.5 rounded-lg hover:bg-teal-100 transition-colors flex-shrink-0" title="Asignar oficina">
                          <Plus className="w-4 h-4 text-teal-600" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
