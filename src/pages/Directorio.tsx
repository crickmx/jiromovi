import { useEffect, useState } from 'react';
import { supabase, supabaseUrl } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Search, UserPlus, Pencil as Edit, Trash2, ToggleLeft, ToggleRight, Users, ListFilter as Filter, Send, CircleCheck as CheckCircle, Eye, FlaskConical, Phone, Loader2 } from 'lucide-react';
import { UserModal } from '../components/UserModal';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/ui/loading-state';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import type { Database } from '../lib/database.types';
import {
  loadActiveTramiteTeams, loadUserTramiteTeamIds, validateTramiteTeamSelection,
  syncUserTramiteTeamAssignments, puedeTenerEquiposTramite, normalizeCategory,
} from '../lib/tramiteTeamAssignments';
import AgentTramiteTeamsSection from '../components/tramites/AgentTramiteTeamsSection';
import { SolicitudesAltaPanel } from '../components/admin/SolicitudesAltaPanel';
import { getOficinasDeGerente } from '../lib/oficinasUtils';

type Usuario = Database['public']['Tables']['usuarios']['Row'] & {
  oficinas?: { nombre: string } | null;
};
type Oficina = Database['public']['Tables']['oficinas']['Row'];

export function Directorio() {
  const { usuario: currentUser, reloadUsuario: refreshUsuario } = useAuth();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [oficinas, setOficinas] = useState<Oficina[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRol, setFilterRol] = useState<string>('');
  const [filterOficina, setFilterOficina] = useState<string>('');
  // La columna Estado pinta `activo`, no `estado`: el filtro usa el mismo campo
  // para que lo que se ve y lo que se filtra no puedan contradecirse.
  const [filterEstado, setFilterEstado] = useState<'' | 'activo' | 'inactivo'>('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Usuario | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<Usuario | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [sendingAccessId, setSendingAccessId] = useState<string | null>(null);
  const [accessSentId, setAccessSentId] = useState<string | null>(null);
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [betaIds, setBetaIds] = useState<Set<string>>(new Set());
  const [togglingBetaId, setTogglingBetaId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkEquiposOpen, setBulkEquiposOpen] = useState(false);
  const [bulkEquiposTeamIds, setBulkEquiposTeamIds] = useState<string[]>([]);
  const [bulkEquiposSaving, setBulkEquiposSaving] = useState(false);
  const [bulkEquiposResultado, setBulkEquiposResultado] = useState<string | null>(null);
  const [bulkCelularOpen, setBulkCelularOpen] = useState(false);
  const [bulkCelularSaving, setBulkCelularSaving] = useState(false);
  const [bulkActivarOpen, setBulkActivarOpen] = useState(false);
  const [bulkActivarSaving, setBulkActivarSaving] = useState(false);
  const [bulkActivarResultado, setBulkActivarResultado] = useState<string | null>(null);
  const { startImpersonation } = useImpersonation();

  const isAdmin = currentUser?.rol === 'Administrador';
  const isGerente = currentUser?.rol === 'Gerente';
  const isReadOnly = !isAdmin && !isGerente;

  // Load on mount unconditionally - anon policy allows reading
  useEffect(() => {
    loadData();
  }, []);

  // Reload when user context arrives (for role-based filtering)
  useEffect(() => {
    if (currentUser) loadData();
  }, [currentUser]);

  const handleSendAccess = async (usuario: Usuario) => {
    if (!usuario.email_laboral || sendingAccessId) return;
    setSendingAccessId(usuario.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch(`${supabaseUrl}/functions/v1/send-login-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ email: usuario.email_laboral, platform: 'movi' }),
      });
      setAccessSentId(usuario.id);
      setTimeout(() => setAccessSentId(null), 5000);
    } catch {
      // silent
    } finally {
      setSendingAccessId(null);
    }
  };

  const loadData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      // Direct query - works with both authenticated and anon roles
      const usersQuery = supabase
        .from('usuarios')
        .select('id, nombre, apellidos, email_laboral, email_personal, celular_personal, celular_laboral, username, rol, estado, activo, oficina_id, puesto, imagen_perfil_url, web_slug, is_deleted')
        .eq('is_deleted', false)
        .order('nombre')
        .limit(2000);

      if (currentUser) {
        const oficinasGerente = await getOficinasDeGerente(currentUser);
        if (oficinasGerente.length > 0) usersQuery.in('oficina_id', oficinasGerente);
      }

      const [usuariosRes, oficinasRes, betaRes] = await Promise.all([
        usersQuery,
        supabase.from('oficinas').select('id, nombre').eq('activa', true).order('nombre'),
        supabase.from('usuarios_beta').select('usuario_id'),
      ]);

      setBetaIds(new Set((betaRes.data || []).map((b: any) => b.usuario_id)));

      if (usuariosRes.error) {
        console.error('[DIRECTORIO] Query error:', usuariosRes.error);
        setLoadError(`Error: ${usuariosRes.error.message}`);
      } else if (usuariosRes.data && usuariosRes.data.length > 0) {
        const oficinasMap = new Map((oficinasRes.data || []).map((o: any) => [o.id, o.nombre]));
        const mapped = (usuariosRes.data as any[]).map((u: any) => ({
          ...u,
          oficinas: u.oficina_id ? { nombre: oficinasMap.get(u.oficina_id) || '-' } : null,
        }));
        setUsuarios(mapped as any);
      } else {
        setLoadError(`La consulta devolvio 0 usuarios. Verifica tu sesion o recarga la pagina (v2).`);
      }

      if (oficinasRes.data) setOficinas(oficinasRes.data as any);
    } catch (error: any) {
      console.error('[DIRECTORIO] Exception:', error);
      setLoadError(error?.message || 'Error de conexion');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (usuario: Usuario) => {
    setUserToDelete(usuario);
    setDeleteConfirmText('');
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;

    if (deleteConfirmText !== 'ELIMINAR') {
      alert('Debes escribir "ELIMINAR" para confirmar');
      return;
    }

    try {
      // Usar supabase.functions.invoke() que maneja automáticamente la autenticación
      const { data: result, error: invokeError } = await supabase.functions.invoke('delete-user', {
        body: {
          userId: userToDelete.id,
          reason: 'Eliminado desde el directorio por administrador'
        }
      });

      if (invokeError) {
        console.error('Delete user error:', invokeError);
        alert('Error al eliminar usuario: ' + invokeError.message);
        return;
      }

      if (!result?.success) {
        console.error('Delete user error response:', result);

        let errorMsg = 'Error al eliminar usuario';

        if (result.error_code === 'LAST_ADMIN') {
          errorMsg = 'No se puede eliminar el último administrador activo del sistema';
        } else if (result.error_code === 'CANNOT_DELETE_SELF') {
          errorMsg = 'No puedes eliminarte a ti mismo';
        } else if (result.error_code === 'USER_ALREADY_DELETED') {
          errorMsg = 'Este usuario ya está eliminado';
        } else if (result.error_code === 'USER_NOT_FOUND') {
          errorMsg = 'Usuario no encontrado';
        } else if (result.message) {
          errorMsg = result.message;
        } else if (result.error) {
          errorMsg = result.error;
        }

        if (result.details) {
          console.error('Error details:', result.details);
          errorMsg += '\n\nDetalles técnicos: ' + result.details;
        }

        alert(errorMsg);
      } else {
        alert('Usuario eliminado correctamente. El usuario ya no puede iniciar sesión.');
        setDeleteModalOpen(false);
        setUserToDelete(null);
        setDeleteConfirmText('');
        loadData();
      }
    } catch (error: any) {
      console.error('Error al eliminar usuario:', error);
      const errorMsg = error.message || 'Error de conexión al eliminar usuario';
      alert(errorMsg);
    }
  };

  const handleToggleActive = async (usuario: Usuario) => {
    // Verificar que el usuario actual es Admin (verificación adicional frontend)
    if (!isAdmin) {
      alert('Solo los Administradores pueden cambiar el estado de usuarios');
      return;
    }

    // Determinar el nuevo estado basado en el campo activo
    const nuevoActivo = !usuario.activo;

    // Lo que exige tener todos los equipos cubiertos es ACTIVAR al agente, no
    // guardar su ficha: un agente sin equipos no tiene a quién caerle, pero
    // corregirle el teléfono no debería estar prohibido por eso.
    if (nuevoActivo && usuario.rol === 'Agente') {
      try {
        const [teams, ids] = await Promise.all([
          loadActiveTramiteTeams(),
          loadUserTramiteTeamIds(usuario.id),
        ]);
        const { valid, missingCategories } = validateTramiteTeamSelection(teams, ids);
        if (!valid) {
          alert(
            `No se puede activar a este agente: le falta un equipo en ${missingCategories.join(', ')}.

` +
            'Asígnaselos en Editar Usuario y vuelve a intentarlo.'
          );
          return;
        }
      } catch (err) {
        console.error('Error revisando los equipos del agente:', err);
        // Si la revisión falla no se bloquea la activación: dejar a alguien
        // inactivo por un error de red es peor que activarlo sin revisar.
      }
    }

    try {
      // Call secure RPC function instead of direct update
      const { data, error } = await supabase
        .rpc('toggle_user_active_status', {
          p_user_id: usuario.id,
          p_activo: nuevoActivo
        });

      if (error) {
        console.error('Error al cambiar estado:', error);
        alert('Error: ' + error.message);
        return;
      }

      // Check response from function
      const result = data as { success: boolean; error?: string; message?: string; changed?: boolean };

      if (!result.success) {
        alert(result.error || 'Error desconocido');
        return;
      }

      // Show success message
      if (result.changed) {
        alert(result.message || 'Estado actualizado exitosamente');
      } else {
        alert(result.message || 'Sin cambios');
      }

      // Refresh data
      loadData();

    } catch (err) {
      console.error('Error inesperado:', err);
      alert('Error inesperado al cambiar estado del usuario');
    }
  };


  const handleToggleBeta = async (usuario: Usuario) => {
    if (!isAdmin || togglingBetaId) return;
    setTogglingBetaId(usuario.id);
    try {
      if (betaIds.has(usuario.id)) {
        const { error } = await supabase.from('usuarios_beta').delete().eq('usuario_id', usuario.id);
        if (error) { alert('Error al quitar de Beta: ' + error.message); return; }
        setBetaIds(prev => { const next = new Set(prev); next.delete(usuario.id); return next; });
      } else {
        const { error } = await supabase.from('usuarios_beta').insert({ usuario_id: usuario.id });
        if (error) { alert('Error al agregar a Beta: ' + error.message); return; }
        setBetaIds(prev => new Set(prev).add(usuario.id));
      }
    } finally {
      setTogglingBetaId(null);
    }
  };

  const normalize = (text: string) =>
    text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

  const filteredUsuarios = usuarios.filter((usuario) => {
    const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const q = norm(searchTerm);
    const matchesSearch =
      searchTerm === '' ||
      norm(usuario.nombre || '').includes(q) ||
      norm(usuario.apellidos || '').includes(q) ||
      norm(usuario.email_personal || '').includes(q) ||
      norm(usuario.email_laboral || '').includes(q) ||
      (usuario.celular_personal || '').includes(searchTerm) ||
      (usuario.celular_laboral || '').includes(searchTerm) ||
      norm(usuario.username || '').includes(q);

    const matchesRol = filterRol === '' || usuario.rol === filterRol;
    const matchesOficina = filterOficina === '' || usuario.oficina_id === filterOficina;
    const matchesEstado = filterEstado === '' || (filterEstado === 'activo' ? !!usuario.activo : !usuario.activo);

    return matchesSearch && matchesRol && matchesOficina && matchesEstado;
  });

  const puedeBulkEditar = isAdmin || isGerente;
  const allFilteredSelected = filteredUsuarios.length > 0 && filteredUsuarios.every((u) => selectedIds.has(u.id));
  const selectedUsuarios = usuarios.filter((u) => selectedIds.has(u.id));
  const selectedConEquipos = selectedUsuarios.filter((u) => puedeTenerEquiposTramite(u.rol));
  const selectedConCelularFaltante = selectedUsuarios.filter(
    (u) => (u.celular_personal || '').trim() !== '' && (u.celular_laboral || '').trim() === ''
  );
  const selectedInactivos = selectedUsuarios.filter((u) => !u.activo);

  const toggleSelectAllFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filteredUsuarios.forEach((u) => next.delete(u.id));
      } else {
        filteredUsuarios.forEach((u) => next.add(u.id));
      }
      return next;
    });
  };

  const toggleSelectedUser = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleBulkApplyEquipos = async () => {
    if (bulkEquiposTeamIds.length === 0 || selectedConEquipos.length === 0) return;
    setBulkEquiposSaving(true);
    setBulkEquiposResultado(null);
    try {
      const allTeams = await loadActiveTramiteTeams();
      const bulkTeams = allTeams.filter((t) => bulkEquiposTeamIds.includes(t.id));
      const bulkCategories = new Set(bulkTeams.map((t) => normalizeCategory(t.area_categoria)));

      let ok = 0;
      let fail = 0;
      for (const user of selectedConEquipos) {
        try {
          const existingIds = await loadUserTramiteTeamIds(user.id);
          // Las categorías que el admin SÍ tocó en este bulk reemplazan lo que
          // tuviera el usuario; las que no tocó se quedan como estaban.
          const existingKept = allTeams
            .filter((t) => existingIds.includes(t.id) && !bulkCategories.has(normalizeCategory(t.area_categoria)))
            .map((t) => t.id);
          await syncUserTramiteTeamAssignments(user.id, [...existingKept, ...bulkEquiposTeamIds]);
          ok++;
        } catch (err) {
          console.error(`Error asignando equipos a ${user.nombre} ${user.apellidos}:`, err);
          fail++;
        }
      }
      setBulkEquiposResultado(
        fail === 0 ? `Listo: ${ok} usuario(s) actualizados.` : `${ok} actualizados, ${fail} con error (ver consola).`
      );
      if (fail === 0) {
        loadData();
      }
    } finally {
      setBulkEquiposSaving(false);
    }
  };

  const handleBulkCopiarCelular = async () => {
    if (selectedConCelularFaltante.length === 0) return;
    setBulkCelularSaving(true);
    try {
      await Promise.all(
        selectedConCelularFaltante.map((u) =>
          supabase.from('usuarios').update({ celular_laboral: u.celular_personal }).eq('id', u.id)
        )
      );
      setBulkCelularOpen(false);
      setSelectedIds(new Set());
      loadData();
    } finally {
      setBulkCelularSaving(false);
    }
  };

  const handleBulkActivar = async () => {
    if (selectedInactivos.length === 0) return;
    setBulkActivarSaving(true);
    setBulkActivarResultado(null);
    try {
      // Mismo requisito que al activar uno por uno: un Agente necesita todas
      // sus categorías de equipo cubiertas antes de poder activarse.
      const hayAgentes = selectedInactivos.some((u) => u.rol === 'Agente');
      const teams = hayAgentes ? await loadActiveTramiteTeams() : [];

      let ok = 0;
      const bloqueados: string[] = [];
      let fail = 0;

      for (const user of selectedInactivos) {
        if (user.rol === 'Agente') {
          try {
            const ids = await loadUserTramiteTeamIds(user.id);
            const { valid } = validateTramiteTeamSelection(teams, ids);
            if (!valid) {
              bloqueados.push(`${user.nombre} ${user.apellidos}`);
              continue;
            }
          } catch (err) {
            console.error('Error validando equipos de', user.id, err);
          }
        }
        try {
          const { data, error } = await supabase.rpc('toggle_user_active_status', {
            p_user_id: user.id,
            p_activo: true,
          });
          if (error) throw error;
          const result = data as { success: boolean; error?: string };
          if (!result.success) throw new Error(result.error || 'Error desconocido');
          ok++;
        } catch (err) {
          console.error(`Error activando a ${user.nombre} ${user.apellidos}:`, err);
          fail++;
        }
      }

      const partes = [`${ok} activado(s)`];
      if (bloqueados.length > 0) partes.push(`${bloqueados.length} con equipos incompletos: ${bloqueados.join(', ')}`);
      if (fail > 0) partes.push(`${fail} con error (ver consola)`);
      setBulkActivarResultado(partes.join(' · '));
      if (ok > 0) loadData();
    } finally {
      setBulkActivarSaving(false);
    }
  };

  if (loading) {
    return <LoadingState text="Cargando directorio..." />;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Usuarios"
        description={isGerente ? 'Gestiona usuarios de tu oficina' : 'Directorio de usuarios del sistema (v2)'}
        icon={Users}
        badge={isReadOnly ? (
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400">
            Solo lectura
          </span>
        ) : undefined}
        actions={
          <Button size="sm" onClick={() => { setSelectedUser(null); setModalOpen(true); }}>
            <UserPlus className="w-4 h-4 mr-1.5" />
            Nuevo
          </Button>
        }
      />

      <SolicitudesAltaPanel isAdmin={isAdmin} onResuelta={loadData} />

      {loadError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-sm text-red-700 dark:text-red-300 font-medium">Error cargando usuarios</p>
          <p className="text-xs text-red-600 dark:text-red-400 mt-1 break-all">{loadError}</p>
          <div className="mt-3 flex gap-2">
            <button onClick={loadData} className="text-xs font-medium text-white bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded-md transition">
              Reintentar
            </button>
            <button onClick={() => window.location.reload()} className="text-xs font-medium text-red-700 dark:text-red-300 border border-red-300 px-3 py-1.5 rounded-md hover:bg-red-100 transition">
              Recargar pagina
            </button>
          </div>
        </div>
      )}

      <div className="bg-surface-card dark:bg-neutral-800/50 rounded-xl border border-neutral-200/60 dark:border-white/8 overflow-hidden">
        <div className="p-4 border-b border-neutral-100 dark:border-white/5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="sm:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 dark:text-white/45" />
              <input
                type="text"
                placeholder="Buscar por nombre, correo, telefono..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all placeholder:text-neutral-500 dark:placeholder:text-white/30 text-neutral-900 dark:text-white"
              />
            </div>

            <select
              value={filterRol}
              onChange={(e) => setFilterRol(e.target.value)}
              className="px-3 py-2 text-sm bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all text-neutral-700 dark:text-white/80"
            >
              <option value="">Todos los roles</option>
              <option value="Administrador">Administrador</option>
              <option value="Gerente">Gerente</option>
              <option value="Empleado">Empleado</option>
              <option value="Agente">Agente</option>
            </select>

            {currentUser?.rol !== 'Gerente' && (
              <select
                value={filterOficina}
                onChange={(e) => setFilterOficina(e.target.value)}
                className="px-3 py-2 text-sm bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all text-neutral-700 dark:text-white/80"
              >
                <option value="">Todas las oficinas</option>
                {oficinas.map((oficina) => (
                  <option key={oficina.id} value={oficina.id}>
                    {oficina.nombre}
                  </option>
                ))}
              </select>
            )}

            <select
              value={filterEstado}
              onChange={(e) => setFilterEstado(e.target.value as '' | 'activo' | 'inactivo')}
              className="px-3 py-2 text-sm bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all text-neutral-700 dark:text-white/80"
            >
              <option value="">Activos e inactivos</option>
              <option value="activo">Solo activos</option>
              <option value="inactivo">Solo inactivos</option>
            </select>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-neutral-500 dark:text-white/55">
              {filteredUsuarios.length} de {usuarios.length} usuarios
            </p>
          </div>

          {puedeBulkEditar && selectedIds.size > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2 bg-accent/5 border border-accent/20 rounded-lg px-3 py-2">
              <span className="text-xs font-semibold text-neutral-700 dark:text-white/80">
                {selectedIds.size} seleccionado{selectedIds.size !== 1 ? 's' : ''}
              </span>
              {isAdmin && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setBulkEquiposTeamIds([]); setBulkEquiposResultado(null); setBulkEquiposOpen(true); }}
                >
                  <Users className="w-3.5 h-3.5 mr-1.5" />
                  Editar equipos ({selectedConEquipos.length})
                </Button>
              )}
              {isAdmin && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setBulkActivarResultado(null); setBulkActivarOpen(true); }}
                >
                  <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                  Activar ({selectedInactivos.length})
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => setBulkCelularOpen(true)}>
                <Phone className="w-3.5 h-3.5 mr-1.5" />
                Copiar celular personal → trabajo ({selectedConCelularFaltante.length})
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
                Quitar selección
              </Button>
            </div>
          )}
        </div>

        <div className="overflow-auto max-h-[65vh]">
          <table className="w-full min-w-[760px]">
            <thead className="bg-neutral-50 border-b border-neutral-200 sticky top-0 z-10">
              <tr>
                {puedeBulkEditar && (
                  <th className="px-3 py-3 text-left w-10">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={toggleSelectAllFiltered}
                      className="h-4 w-4 rounded border-neutral-300 text-accent-ink focus:ring-accent"
                      aria-label="Seleccionar todos los filtrados"
                    />
                  </th>
                )}
                <th className="px-3 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Usuario
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Rol
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Oficina
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-3 py-3 text-right text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-neutral-200">
              {filteredUsuarios.map((usuario) => (
                <tr key={usuario.id} className="hover:bg-slate-50 transition">
                  {puedeBulkEditar && (
                    <td className="px-3 py-3 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(usuario.id)}
                        onChange={() => toggleSelectedUser(usuario.id)}
                        className="h-4 w-4 rounded border-neutral-300 text-accent-ink focus:ring-accent"
                        aria-label={`Seleccionar ${usuario.nombre} ${usuario.apellidos}`}
                      />
                    </td>
                  )}
                  <td className="px-3 py-3 whitespace-nowrap">
                    <div className="flex items-center">
                      {usuario.imagen_perfil_url ? (
                        <img
                          src={usuario.imagen_perfil_url}
                          alt=""
                          crossOrigin="anonymous"
                          className="w-10 h-10 rounded-full object-cover"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center">
                          <span className="text-white font-medium text-sm">
                            {usuario.nombre[0]}{usuario.apellidos[0]}
                          </span>
                        </div>
                      )}
                      <div className="ml-4">
                        <div className="flex items-center space-x-2">
                          <div className="text-sm font-medium text-neutral-900">
                            {usuario.nombre} {usuario.apellidos}
                          </div>
                          {usuario.estado === 'pendiente' && (
                            <span className="px-2 py-0.5 text-xs font-semibold bg-amber-100 text-amber-800 rounded">
                              Pendiente
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-neutral-500">{usuario.puesto}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        usuario.rol === 'Administrador'
                          ? 'bg-red-100 text-red-800'
                          : usuario.rol === 'Gerente'
                          ? 'bg-purple-100 text-purple-800'
                          : usuario.rol === 'Empleado'
                          ? 'bg-primary-100 text-primary-800'
                          : 'bg-green-100 text-green-800'
                      }`}
                    >
                      {usuario.rol}
                    </span>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-neutral-900">
                    {usuario.oficinas?.nombre || '-'}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {isAdmin ? (
                      <button
                        onClick={() => handleToggleActive(usuario)}
                        className="flex items-center space-x-2"
                      >
                        {usuario.activo ? (
                          <>
                            <ToggleRight className="w-6 h-6 text-green-600" />
                            <span className="text-sm text-green-600 font-medium">Activo</span>
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="w-6 h-6 text-neutral-500" />
                            <span className="text-sm text-neutral-500 font-medium">Inactivo</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <div className="flex items-center space-x-2">
                        {usuario.activo ? (
                          <>
                            <ToggleRight className="w-6 h-6 text-green-600" />
                            <span className="text-sm text-green-600 font-medium">Activo</span>
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="w-6 h-6 text-neutral-500" />
                            <span className="text-sm text-neutral-500 font-medium">Inactivo</span>
                          </>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end items-center space-x-1">
                      {(isAdmin || isGerente) && usuario.estado === 'activo' && (
                        <button
                          onClick={() => handleSendAccess(usuario)}
                          disabled={sendingAccessId === usuario.id || accessSentId === usuario.id}
                          className={`flex items-center p-2 rounded-lg transition disabled:opacity-60 ${
                            accessSentId === usuario.id
                              ? 'text-green-700 bg-green-50'
                              : 'text-neutral-600 hover:text-slate-900 hover:bg-slate-100'
                          }`}
                          title="Enviar código de acceso al correo y WhatsApp"
                        >
                          {accessSentId === usuario.id
                            ? <CheckCircle className="w-4 h-4" />
                            : sendingAccessId === usuario.id
                            ? <span className="w-4 h-4 border-2 border-neutral-300 border-t-neutral-500 rounded-full animate-spin" />
                            : <Send className="w-4 h-4" />
                          }
                        </button>
                      )}
                      {isAdmin && (
                        <button
                          onClick={() => handleToggleBeta(usuario)}
                          disabled={togglingBetaId === usuario.id}
                          className={`flex items-center p-2 rounded-lg transition disabled:opacity-60 ${
                            betaIds.has(usuario.id)
                              ? 'text-violet-700 bg-violet-50 hover:bg-violet-100'
                              : 'text-neutral-500 hover:text-violet-700 hover:bg-violet-50'
                          }`}
                          title={betaIds.has(usuario.id) ? 'Quitar de Beta' : 'Agregar a Beta'}
                        >
                          {togglingBetaId === usuario.id
                            ? <span className="w-4 h-4 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin" />
                            : <FlaskConical className="w-4 h-4" />
                          }
                        </button>
                      )}
                      {isAdmin && usuario.id !== currentUser?.id && usuario.rol !== 'Administrador' && (
                        <button
                          disabled={!!impersonatingId}
                          onClick={async () => {
                            setImpersonatingId(usuario.id);
                            const ok = await startImpersonation({ platform: 'movi', userId: usuario.id });
                            if (ok) {
                              window.location.href = '/dashboard';
                            } else {
                              setImpersonatingId(null);
                            }
                          }}
                          className="flex items-center p-2 rounded-lg text-amber-700 hover:text-amber-900 hover:bg-amber-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Ver como este usuario"
                        >
                          {impersonatingId === usuario.id
                            ? <span className="w-4 h-4 border-2 border-amber-400 border-t-amber-700 rounded-full animate-spin" />
                            : <Eye className="w-4 h-4" />
                          }
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setSelectedUser(usuario);
                          setModalOpen(true);
                        }}
                        className="flex items-center p-2 text-accent-ink hover:text-primary-900 hover:bg-primary-50 rounded-lg transition"
                        title={isReadOnly ? "Ver Usuario" : "Ver / Editar Usuario"}
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => handleDeleteClick(usuario)}
                          className="text-red-600 hover:text-red-900 p-2 hover:bg-red-50 rounded-lg transition"
                          title="Eliminar usuario"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredUsuarios.length === 0 && (
            <div className="text-center py-12">
              <Filter className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
              <p className="text-neutral-500">No se encontraron usuarios</p>
            </div>
          )}
        </div>
      </div>

      {modalOpen && (
        <UserModal
          user={selectedUser}
          onClose={() => {
            setModalOpen(false);
            setSelectedUser(null);
          }}
          onSave={() => {
            setModalOpen(false);
            setSelectedUser(null);
            loadData();
          }}
        />
      )}

      {bulkEquiposOpen && (
        <div className="fixed inset-0 bg-neutral-950/45 backdrop-blur-[3px] animate-overlay flex items-center justify-center p-4 z-50">
          <div className="bg-surface-card rounded-[var(--radius-xl)] shadow-e4 max-w-lg w-full p-6 animate-scale-in max-h-[85vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-neutral-900 mb-1">Editar equipos en bulk</h3>
            <p className="text-sm text-neutral-600 mb-4">
              Se aplicará a {selectedConEquipos.length} de los {selectedIds.size} usuarios seleccionados (solo Agente/Administrador pueden tener equipos de trámite). Las categorías que NO toques aquí se dejan como ya las tenía cada usuario.
            </p>

            {selectedConEquipos.length === 0 ? (
              <p className="text-sm text-neutral-500 italic mb-4">Ninguno de los seleccionados puede tener equipos de trámite.</p>
            ) : (
              <AgentTramiteTeamsSection
                selectedIds={bulkEquiposTeamIds}
                onSelectedIdsChange={setBulkEquiposTeamIds}
                disabled={bulkEquiposSaving}
              />
            )}

            {bulkEquiposResultado && (
              <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                {bulkEquiposResultado}
              </div>
            )}

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setBulkEquiposOpen(false)} disabled={bulkEquiposSaving}>
                Cerrar
              </Button>
              <Button
                onClick={handleBulkApplyEquipos}
                disabled={bulkEquiposSaving || bulkEquiposTeamIds.length === 0 || selectedConEquipos.length === 0}
              >
                {bulkEquiposSaving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
                Aplicar a {selectedConEquipos.length} usuario{selectedConEquipos.length !== 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        </div>
      )}

      {bulkCelularOpen && (
        <div className="fixed inset-0 bg-neutral-950/45 backdrop-blur-[3px] animate-overlay flex items-center justify-center p-4 z-50">
          <div className="bg-surface-card rounded-[var(--radius-xl)] shadow-e4 max-w-md w-full p-6 animate-scale-in">
            <h3 className="text-xl font-bold text-neutral-900 mb-2">Copiar celular personal → trabajo</h3>
            {selectedConCelularFaltante.length === 0 ? (
              <p className="text-sm text-neutral-600 mb-6">
                Ninguno de los {selectedIds.size} usuarios seleccionados tiene celular personal sin celular de trabajo.
              </p>
            ) : (
              <>
                <p className="text-sm text-neutral-600 mb-4">
                  De los {selectedIds.size} seleccionados, {selectedConCelularFaltante.length} tienen celular personal
                  capturado y el celular de trabajo vacío. Se copiará su celular personal al campo de trabajo:
                </p>
                <div className="bg-neutral-50 rounded-lg p-3 mb-6 max-h-48 overflow-y-auto text-sm space-y-1">
                  {selectedConCelularFaltante.map((u) => (
                    <div key={u.id} className="flex justify-between gap-2">
                      <span className="text-neutral-700 truncate">{u.nombre} {u.apellidos}</span>
                      <span className="font-mono text-neutral-500 flex-shrink-0">{u.celular_personal}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setBulkCelularOpen(false)} disabled={bulkCelularSaving}>
                Cancelar
              </Button>
              <Button
                onClick={handleBulkCopiarCelular}
                disabled={bulkCelularSaving || selectedConCelularFaltante.length === 0}
              >
                {bulkCelularSaving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
                Copiar en {selectedConCelularFaltante.length} usuario{selectedConCelularFaltante.length !== 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        </div>
      )}

      {bulkActivarOpen && (
        <div className="fixed inset-0 bg-neutral-950/45 backdrop-blur-[3px] animate-overlay flex items-center justify-center p-4 z-50">
          <div className="bg-surface-card rounded-[var(--radius-xl)] shadow-e4 max-w-md w-full p-6 animate-scale-in">
            <h3 className="text-xl font-bold text-neutral-900 mb-2">Activar usuarios</h3>
            {selectedInactivos.length === 0 ? (
              <p className="text-sm text-neutral-600 mb-6">
                Ninguno de los {selectedIds.size} usuarios seleccionados está inactivo.
              </p>
            ) : (
              <>
                <p className="text-sm text-neutral-600 mb-4">
                  Se activarán {selectedInactivos.length} de los {selectedIds.size} seleccionados que están inactivos.
                  A los que tengan rol Agente con equipos de trámite incompletos se les saltará, igual que al activar uno por uno.
                </p>
                <div className="bg-neutral-50 rounded-lg p-3 mb-6 max-h-48 overflow-y-auto text-sm space-y-1">
                  {selectedInactivos.map((u) => (
                    <div key={u.id} className="flex justify-between gap-2">
                      <span className="text-neutral-700 truncate">{u.nombre} {u.apellidos}</span>
                      <span className="text-neutral-500 flex-shrink-0">{u.rol}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {bulkActivarResultado && (
              <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                {bulkActivarResultado}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setBulkActivarOpen(false)} disabled={bulkActivarSaving}>
                Cerrar
              </Button>
              <Button
                onClick={handleBulkActivar}
                disabled={bulkActivarSaving || selectedInactivos.length === 0}
              >
                {bulkActivarSaving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
                Activar {selectedInactivos.length} usuario{selectedInactivos.length !== 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        </div>
      )}

      {deleteModalOpen && userToDelete && (
        <div className="fixed inset-0 bg-neutral-950/45 backdrop-blur-[3px] animate-overlay flex items-center justify-center p-4 z-50">
          <div className="bg-surface-card rounded-[var(--radius-xl)] shadow-e4 max-w-md w-full p-6 animate-scale-in">
            <div className="flex items-start space-x-4 mb-6">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <Trash2 className="w-6 h-6 text-red-600" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-neutral-900 mb-2">
                  Eliminar Usuario
                </h3>
                <p className="text-sm text-neutral-600 mb-4">
                  Esta acción bloqueará el acceso del usuario al sistema.
                </p>
              </div>
            </div>

            <div className="bg-neutral-50 rounded-lg p-4 mb-6">
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-semibold text-neutral-700">Nombre:</span>{' '}
                  <span className="text-neutral-900">{userToDelete.nombre} {userToDelete.apellidos}</span>
                </div>
                <div>
                  <span className="font-semibold text-neutral-700">Email:</span>{' '}
                  <span className="text-neutral-900">{userToDelete.email_laboral || 'N/A'}</span>
                </div>
                <div>
                  <span className="font-semibold text-neutral-700">Rol:</span>{' '}
                  <span className="text-neutral-900">{userToDelete.rol}</span>
                </div>
                {userToDelete.oficinas && (
                  <div>
                    <span className="font-semibold text-neutral-700">Oficina:</span>{' '}
                    <span className="text-neutral-900">{userToDelete.oficinas.nombre}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <h4 className="font-semibold text-yellow-900 mb-2 text-sm">Importante:</h4>
              <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
                <li>El usuario NO podrá iniciar sesión</li>
                <li>Se conservan todos sus datos históricos</li>
                <li>No se eliminarán sus registros en comisiones, pedidos, etc.</li>
                <li>Esta acción se registrará en el log de auditoría</li>
              </ul>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Escribe <span className="font-bold text-red-600">ELIMINAR</span> para confirmar:
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="ELIMINAR"
                autoFocus
              />
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setDeleteModalOpen(false);
                  setUserToDelete(null);
                  setDeleteConfirmText('');
                }}
                className="flex-1 px-4 py-2 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-slate-50 font-medium transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleteConfirmText !== 'ELIMINAR'}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Eliminar Usuario
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default Directorio;
