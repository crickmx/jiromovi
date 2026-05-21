import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Users, UserPlus, UserMinus, Search, ShieldCheck, Briefcase, Wrench,
  Plus, Pencil, Trash2, ToggleLeft, ToggleRight, ChevronRight, Building2,
  X, Check, AlertTriangle, Loader2, Globe,
} from 'lucide-react';
import { AREA_CONFIG, type AreaCategoria } from '../../lib/registroActividadesTypes';

interface Grupo {
  id: string;
  nombre: string;
  descripcion: string | null;
  color: string;
  area_categoria: AreaCategoria | null;
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
}

interface GrupoOficina {
  id: string;
  oficina_id: string;
  oficina_nombre: string;
}

interface Usuario {
  id: string;
  nombre_completo: string;
  rol: string;
  oficina_nombre: string | null;
}

interface Oficina {
  id: string;
  nombre: string;
}

type Panel = 'list' | 'form' | 'members' | 'offices';

const AREA_COLORS: Record<AreaCategoria, string> = {
  Comercial: '#0ea5e9',
  Operaciones: '#f59e0b',
};

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

  // Offices panel
  const [grupoOficinas, setGrupoOficinas] = useState<GrupoOficina[]>([]);
  const [searchOficina, setSearchOficina] = useState('');

  // Form state
  const [formNombre, setFormNombre] = useState('');
  const [formDescripcion, setFormDescripcion] = useState('');
  const formArea: AreaCategoria = 'Operaciones';
  const [formActivo, setFormActivo] = useState(true);
  const [formAllOffices, setFormAllOffices] = useState(false);
  const [formSelectedOficinas, setFormSelectedOficinas] = useState<string[]>([]);
  const [formOficinaSearch, setFormOficinaSearch] = useState('');
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Delete confirm
  const [confirmDelete, setConfirmDelete] = useState<Grupo | null>(null);
  const [deleting, setDeleting] = useState(false);

  const isAdmin = usuario?.rol === 'Administrador';

  const loadData = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadGrupos(), loadUsuarios(), loadOficinas()]);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const loadGrupos = async () => {
    const { data, error } = await supabase.rpc('get_tramite_teams_full');
    if (!error && data) setGrupos(data as Grupo[]);
  };

  const loadUsuarios = async () => {
    const { data } = await supabase
      .from('usuarios')
      .select('id, nombre_completo, rol, oficinas(nombre)')
      .eq('estado', 'activo')
      .in('rol', ['Empleado', 'Gerente', 'Administrador', 'Ejecutivo'])
      .order('nombre_completo');
    if (data) {
      setUsuarios(data.map(u => ({
        id: u.id,
        nombre_completo: u.nombre_completo || '',
        rol: u.rol,
        oficina_nombre: (u.oficinas as { nombre: string } | null)?.nombre || null,
      })));
    }
  };

  const loadOficinas = async () => {
    const { data } = await supabase.from('oficinas').select('id, nombre').eq('activa', true).order('nombre');
    if (data) setOficinas(data);
  };

  const loadMiembros = async (grupoId: string) => {
    const { data } = await supabase.rpc('get_grupo_miembros', { p_grupo_id: grupoId });
    if (data) setMiembros(data.map((m: Record<string, unknown>) => ({ ...m, usuario_id: m.id as string })) as Miembro[]);
  };

  const loadGrupoOficinas = async (grupoId: string) => {
    const { data } = await supabase.rpc('get_grupo_oficinas', { p_grupo_id: grupoId });
    if (data) setGrupoOficinas(data as GrupoOficina[]);
  };

  // ── FORM ──────────────────────────────────────────────────────────────────────

  const openCreate = () => {
    setSelectedGrupo(null);
    setFormNombre('');
    setFormDescripcion('');
    setFormActivo(true);
    setFormAllOffices(false);
    setFormSelectedOficinas([]);
    setFormOficinaSearch('');
    setFormError('');
    setPanel('form');
  };

  const openEdit = async (g: Grupo) => {
    setSelectedGrupo(g);
    setFormNombre(g.nombre);
    setFormDescripcion(g.descripcion || '');
    setFormActivo(g.activo);
    setFormAllOffices(g.all_offices);
    setFormOficinaSearch('');
    setFormError('');
    // Load current offices for this group
    const { data } = await supabase.rpc('get_grupo_oficinas', { p_grupo_id: g.id });
    setFormSelectedOficinas(data ? (data as GrupoOficina[]).map(o => o.oficina_id) : []);
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
      activo: formActivo,
      all_offices: formAllOffices,
      color: AREA_COLORS[formArea],
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

    // Sync offices if not "all offices" mode
    if (!formAllOffices) {
      // Delete all current office assignments for this group
      await supabase.from('tramites_grupos_oficinas').delete().eq('grupo_id', grupoId);
      // Insert selected offices
      if (formSelectedOficinas.length > 0) {
        await supabase.from('tramites_grupos_oficinas').insert(
          formSelectedOficinas.map(oficina_id => ({
            grupo_id: grupoId,
            oficina_id,
            created_by: usuario?.id,
          }))
        );
      }
    }

    await loadGrupos();
    setFormSaving(false);
    setPanel('list');
  };

  // ── TOGGLE ACTIVE ─────────────────────────────────────────────────────────────

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

  // ── DELETE ────────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    // Always hard-delete — members and offices cascade via FK or are deleted first
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
  };

  // ── MEMBERS ───────────────────────────────────────────────────────────────────

  const openMembers = async (g: Grupo) => {
    setSelectedGrupo(g);
    setSearchMiembro('');
    await loadMiembros(g.id);
    setPanel('members');
  };

  const handleAgregarMiembro = async (usuarioId: string) => {
    if (!selectedGrupo) return;
    const { error } = await supabase
      .from('tramites_grupos_miembros')
      .insert({ grupo_id: selectedGrupo.id, usuario_id: usuarioId });
    if (error && error.code !== '23505') { alert('Error: ' + error.message); return; }
    await supabase.from('ticket_team_audit_logs').insert({
      team_id: selectedGrupo.id, action: 'member_added',
      new_value: { usuario_id: usuarioId }, performed_by: usuario?.id,
    });
    await loadMiembros(selectedGrupo.id);
    await loadGrupos();
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

  // ── OFFICES ───────────────────────────────────────────────────────────────────

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

  // ── HELPERS ───────────────────────────────────────────────────────────────────

  const getAC = (area: AreaCategoria | null) =>
    area ? AREA_CONFIG[area] : { bg: 'bg-neutral-50', color: 'text-neutral-600', border: 'border-neutral-200' };

  const AreaIcon = ({ area }: { area: AreaCategoria | null }) =>
    area === 'Comercial' ? <Briefcase className="w-4 h-4" /> : <Wrench className="w-4 h-4" />;

  const miembrosDisponibles = usuarios.filter(
    u => !miembros.some(m => m.usuario_id === u.id) &&
      u.nombre_completo.toLowerCase().includes(searchMiembro.toLowerCase())
  );

  const oficinasDisponibles = oficinas.filter(
    o => !grupoOficinas.some(go => go.oficina_id === o.id) &&
      o.nombre.toLowerCase().includes(searchOficina.toLowerCase())
  );

  // ── GUARD ─────────────────────────────────────────────────────────────────────

  if (!isAdmin) {
    return (
      <div className="text-center py-12 text-neutral-500">
        <ShieldCheck className="w-12 h-12 mx-auto mb-3 text-neutral-300" />
        <p className="font-medium">Solo los administradores pueden gestionar los equipos de trabajo.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  // ── LIST PANEL ────────────────────────────────────────────────────────────────

  if (panel === 'list') {
    const active = grupos.filter(g => g.activo && g.area_categoria === 'Operaciones');

    return (
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-neutral-900">Equipos de Operaciones</h3>
            <p className="text-sm text-neutral-500 mt-0.5">
              Equipos con acceso a trámites operativos de múltiples oficinas. Los trámites comerciales son visibles por rol y oficina automaticamente.
            </p>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-neutral-900 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-neutral-700 transition-colors flex-shrink-0"
          >
            <Plus className="w-4 h-4" /> Crear equipo
          </button>
        </div>

        {/* Active teams */}
        {active.length === 0 ? (
          <div className="text-center py-10 bg-neutral-50 rounded-2xl border-2 border-dashed border-neutral-200">
            <Users className="w-10 h-10 mx-auto text-neutral-300 mb-2" />
            <p className="text-sm text-neutral-500">No hay equipos activos. Crea el primero.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {active.map(g => {
              const ac = getAC(g.area_categoria);
              return (
                <div key={g.id} className="border border-neutral-200 rounded-2xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow">
                  <div className="px-5 py-4 flex items-start gap-4">
                    <div className={`p-2.5 rounded-xl flex-shrink-0 ${ac.bg}`}>
                      <span className={ac.color}><AreaIcon area={g.area_categoria} /></span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-neutral-900">{g.nombre}</h4>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${ac.bg} ${ac.color}`}>
                          {g.area_categoria}
                        </span>
                        {g.all_offices && (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 flex items-center gap-1">
                            <Globe className="w-3 h-3" /> Todas las oficinas
                          </span>
                        )}
                      </div>
                      {g.descripcion && (
                        <p className="text-xs text-neutral-500 mt-1 line-clamp-1">{g.descripcion}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2">
                        <button
                          onClick={() => openMembers(g)}
                          className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-900 transition-colors"
                        >
                          <Users className="w-3.5 h-3.5" />
                          <span className="font-semibold">{g.member_count}</span> miembros
                          <ChevronRight className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => openOffices(g)}
                          className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-900 transition-colors"
                        >
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
                      Sin oficinas asignadas — este equipo no verá ningún trámite.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Delete confirm */}
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
                    Este equipo tiene {confirmDelete.member_count} miembro{confirmDelete.member_count !== 1 ? 's' : ''} y {confirmDelete.office_count} oficina{confirmDelete.office_count !== 1 ? 's' : ''} asignada{confirmDelete.office_count !== 1 ? 's' : ''}. Se eliminarán junto con el equipo.
                  </span>
                </div>
              )}
              <p className="text-sm text-neutral-600 mb-4">¿Seguro que deseas eliminar este equipo? Esta acción no se puede deshacer.</p>
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
    );
  }

  // ── FORM PANEL ────────────────────────────────────────────────────────────────

  if (panel === 'form') {
    const ac = getAC(formArea);
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => setPanel('list')} className="p-2 rounded-xl hover:bg-neutral-100 text-neutral-500 transition-colors">
            <X className="w-4 h-4" />
          </button>
          <div className={`p-2 rounded-lg ${AREA_CONFIG['Operaciones'].bg} flex-shrink-0`}>
            <span className={AREA_CONFIG['Operaciones'].color}><Wrench className="w-4 h-4" /></span>
          </div>
          <div>
            <h3 className="text-lg font-bold text-neutral-900">{selectedGrupo ? 'Editar equipo' : 'Nuevo equipo de Operaciones'}</h3>
            <p className="text-sm text-neutral-500">Correcciones, registros, solicitudes y operativos.</p>
          </div>
        </div>

        <div className="space-y-4 bg-white rounded-2xl border border-neutral-200 p-5">
          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-1.5">Nombre del equipo *</label>
            <input
              type="text"
              value={formNombre}
              onChange={e => setFormNombre(e.target.value)}
              placeholder="Ej. Operaciones CDMX Norte"
              className="w-full px-3 py-2.5 border border-neutral-300 rounded-xl text-sm focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-1.5">Descripción</label>
            <textarea
              value={formDescripcion}
              onChange={e => setFormDescripcion(e.target.value)}
              placeholder="Describe qué trámites gestiona este equipo..."
              rows={2}
              className="w-full px-3 py-2.5 border border-neutral-300 rounded-xl text-sm focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900 outline-none resize-none"
            />
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
              <p className="text-xs text-neutral-500 mt-0.5">El equipo tendrá acceso a trámites de todas las oficinas actuales y futuras.</p>
            </div>
          </div>

          {/* Specific offices picker (shown when not all_offices) */}
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

              {/* Selected chips */}
              {formSelectedOficinas.length > 0 && (
                <div className="px-3 pt-3 flex flex-wrap gap-2">
                  {formSelectedOficinas.map(id => {
                    const of = oficinas.find(o => o.id === id);
                    if (!of) return null;
                    return (
                      <span key={id} className="inline-flex items-center gap-1.5 bg-neutral-900 text-white text-xs font-medium px-2.5 py-1 rounded-full">
                        {of.nombre}
                        <button
                          type="button"
                          onClick={() => setFormSelectedOficinas(prev => prev.filter(x => x !== id))}
                          className="hover:text-red-300 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Search + list */}
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
                  {oficinas
                    .filter(o =>
                      !formSelectedOficinas.includes(o.id) &&
                      o.nombre.toLowerCase().includes(formOficinaSearch.toLowerCase())
                    )
                    .length === 0 ? (
                    <p className="text-xs text-neutral-400 text-center py-3">
                      {formOficinaSearch ? 'Sin resultados' : formSelectedOficinas.length === oficinas.length ? 'Todas las oficinas asignadas' : 'No hay oficinas disponibles'}
                    </p>
                  ) : (
                    oficinas
                      .filter(o =>
                        !formSelectedOficinas.includes(o.id) &&
                        o.nombre.toLowerCase().includes(formOficinaSearch.toLowerCase())
                      )
                      .map(o => (
                        <button
                          key={o.id}
                          type="button"
                          onClick={() => {
                            setFormSelectedOficinas(prev => [...prev, o.id]);
                            setFormOficinaSearch('');
                          }}
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
                  Sin oficinas asignadas — el equipo no verá ningún trámite.
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between p-3.5 rounded-xl bg-neutral-50 border border-neutral-200">
            <div>
              <p className="text-sm font-semibold text-neutral-700">Estado</p>
              <p className="text-xs text-neutral-500">{formActivo ? 'Activo — el equipo puede ver trámites' : 'Inactivo — el equipo está pausado'}</p>
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

        <div className="flex gap-3 justify-end">
          <button onClick={() => setPanel('list')} className="px-5 py-2.5 text-sm rounded-xl border border-neutral-200 hover:bg-neutral-50 font-medium">Cancelar</button>
          <button
            onClick={handleSaveForm}
            disabled={formSaving}
            className="px-5 py-2.5 text-sm rounded-xl font-semibold text-white transition-colors flex items-center gap-2 disabled:opacity-50"
            style={{ backgroundColor: AREA_COLORS['Operaciones'] }}
          >
            {formSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {selectedGrupo ? 'Guardar cambios' : 'Crear equipo'}
          </button>
        </div>
      </div>
    );
  }

  // ── MEMBERS PANEL ─────────────────────────────────────────────────────────────

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
            <p className="text-xs text-neutral-500">Gestión de miembros · {miembros.length} actuales</p>
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
                  ? 'Ven trámites comerciales de las oficinas asignadas al equipo'
                  : 'Ven trámites operativos de las oficinas asignadas al equipo'}
              </p>
            </div>
            <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
              {miembros.length === 0 ? (
                <p className="text-sm text-neutral-400 text-center py-6">No hay miembros asignados</p>
              ) : (
                miembros.map(m => (
                  <div key={m.usuario_id} className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl group hover:bg-neutral-100 transition-colors">
                    <div className="min-w-0">
                      <p className="font-medium text-neutral-900 text-sm truncate">{m.nombre_completo}</p>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-neutral-500">
                        <span>{m.rol}</span>
                        {m.oficina_nombre && <><span className="text-neutral-300">·</span><span>{m.oficina_nombre}</span></>}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoverMiembro(m.usuario_id)}
                      className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-100 transition-all"
                      title="Remover del equipo"
                    >
                      <UserMinus className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                ))
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
                <input
                  type="text"
                  placeholder="Buscar por nombre..."
                  value={searchMiembro}
                  onChange={e => setSearchMiembro(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-neutral-200 rounded-xl text-sm focus:ring-2 focus:ring-neutral-900 outline-none"
                />
              </div>
              <div className="max-h-72 overflow-y-auto space-y-1">
                {miembrosDisponibles.length === 0 ? (
                  <p className="text-sm text-neutral-400 text-center py-4">
                    {searchMiembro ? 'Sin resultados' : 'Todos los usuarios ya están asignados'}
                  </p>
                ) : (
                  miembrosDisponibles.map(u => (
                    <div key={u.id} className="flex items-center justify-between p-3 border border-neutral-100 rounded-xl hover:bg-neutral-50 transition-colors">
                      <div className="min-w-0">
                        <p className="font-medium text-neutral-900 text-sm truncate">{u.nombre_completo}</p>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-neutral-500">
                          <span>{u.rol}</span>
                          {u.oficina_nombre && <><span className="text-neutral-300">·</span><span>{u.oficina_nombre}</span></>}
                        </div>
                      </div>
                      <button
                        onClick={() => handleAgregarMiembro(u.id)}
                        className="p-1.5 rounded-lg hover:bg-green-100 transition-colors flex-shrink-0"
                        title="Agregar al equipo"
                      >
                        <UserPlus className="w-4 h-4 text-green-600" />
                      </button>
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

  // ── OFFICES PANEL ─────────────────────────────────────────────────────────────

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
              Oficinas asignadas · {selectedGrupo.all_offices ? 'Todas' : `${grupoOficinas.length} asignadas`}
            </p>
          </div>
        </div>

        {selectedGrupo.all_offices && (
          <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 flex items-center gap-2 text-sm text-teal-800">
            <Globe className="w-4 h-4 flex-shrink-0" />
            Este equipo tiene acceso a <strong>todas las oficinas</strong>. Edita el equipo para cambiar esta configuración.
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className={`border-2 rounded-2xl overflow-hidden ${ac.border}`}>
            <div className={`px-4 py-3 ${ac.bg}`}>
              <h4 className={`font-bold text-sm ${ac.color} flex items-center gap-2`}>
                <Building2 className="w-4 h-4" /> Oficinas asignadas ({selectedGrupo.all_offices ? 'todas' : grupoOficinas.length})
              </h4>
            </div>
            <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
              {selectedGrupo.all_offices ? (
                <p className="text-sm text-teal-700 text-center py-4 bg-teal-50 rounded-xl">Acceso a todas las oficinas activas</p>
              ) : grupoOficinas.length === 0 ? (
                <div className="text-center py-6">
                  <AlertTriangle className="w-8 h-8 mx-auto text-amber-400 mb-2" />
                  <p className="text-sm text-neutral-400">Sin oficinas asignadas</p>
                  <p className="text-xs text-amber-600 mt-1">Este equipo no verá ningún trámite</p>
                </div>
              ) : (
                grupoOficinas.map(go => (
                  <div key={go.id} className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl group hover:bg-neutral-100 transition-colors">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
                      <span className="text-sm font-medium text-neutral-800">{go.oficina_nombre}</span>
                    </div>
                    <button
                      onClick={() => handleRemoverOficina(go.id, go.oficina_id)}
                      className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-100 transition-all"
                      title="Quitar oficina"
                    >
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
                <h4 className="font-bold text-sm text-neutral-700 flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Agregar oficinas
                </h4>
              </div>
              <div className="p-4 space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                  <input
                    type="text"
                    placeholder="Buscar oficina..."
                    value={searchOficina}
                    onChange={e => setSearchOficina(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-neutral-200 rounded-xl text-sm focus:ring-2 focus:ring-neutral-900 outline-none"
                  />
                </div>
                <div className="max-h-72 overflow-y-auto space-y-1">
                  {oficinasDisponibles.length === 0 ? (
                    <p className="text-sm text-neutral-400 text-center py-4">
                      {searchOficina ? 'Sin resultados' : 'Todas las oficinas ya están asignadas'}
                    </p>
                  ) : (
                    oficinasDisponibles.map(o => (
                      <div key={o.id} className="flex items-center justify-between p-3 border border-neutral-100 rounded-xl hover:bg-neutral-50 transition-colors">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
                          <span className="text-sm font-medium text-neutral-800">{o.nombre}</span>
                        </div>
                        <button
                          onClick={() => handleAgregarOficina(o.id)}
                          className="p-1.5 rounded-lg hover:bg-teal-100 transition-colors flex-shrink-0"
                          title="Asignar oficina"
                        >
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
