import { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { Equipo, Permiso, RolPermiso, UsuarioOverride } from './types';

const ROLES_CONFIGURABLES = ['Agente', 'Empleado', 'Gerente'];

type ShowToast = (msg: string, type?: 'success' | 'error') => void;

export function usePermisos(tipoId: string, usuarioId: string | undefined, showToast: ShowToast) {
  const [equiposPermisos, setEquiposPermisos] = useState<Equipo[]>([]);
  const [permisos, setPermisos] = useState<Permiso[]>([]);
  const [loadingPermisos, setLoadingPermisos] = useState(false);
  const [rolPermisos, setRolPermisos] = useState<RolPermiso[]>([]);
  const [usuarioOverrides, setUsuarioOverrides] = useState<UsuarioOverride[]>([]);
  const [savingPermId, setSavingPermId] = useState<string | null>(null);
  const [savingVisibilidad, setSavingVisibilidad] = useState<string | null>(null);
  const [equiposColapsados, setEquiposColapsados] = useState<Set<string>>(new Set());

  const loadPermisos = async () => {
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

    const { data: rolData } = await supabase
      .from('tramite_tipo_rol_permisos')
      .select('rol, puede_crear, puede_ver, puede_editar')
      .eq('tramite_tipo_id', tipoId);

    const rolMap: Record<string, RolPermiso> = {};
    for (const r of (rolData || [])) rolMap[r.rol] = r;
    setRolPermisos(ROLES_CONFIGURABLES.map(rol => rolMap[rol] ?? { rol, puede_crear: true, puede_ver: true, puede_editar: true }));

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

  const hasPermiso = (userId: string, teamId: string, action: 'crear_tramite' | 'editar_tramite') =>
    permisos.some(p => p.user_id === userId && p.team_id === teamId && p.permiso === action);

  const togglePermiso = async (userId: string, teamId: string, action: 'crear_tramite' | 'editar_tramite') => {
    const permKey = `${userId}-${teamId}-${action}`;
    setSavingPermId(permKey);
    const existing = permisos.find(p => p.user_id === userId && p.team_id === teamId && p.permiso === action);

    if (existing) {
      await supabase.from('usuario_team_permisos').update({ revoked_at: new Date().toISOString() }).eq('id', existing.id);
      setPermisos(prev => prev.filter(p => p.id !== existing.id));
    } else {
      const { data } = await supabase
        .from('usuario_team_permisos')
        .insert({ user_id: userId, team_id: teamId, tramite_tipo_id: tipoId, permiso: action, granted_by: usuarioId })
        .select()
        .single();
      if (data) setPermisos(prev => [...prev, data as Permiso]);
    }
    setSavingPermId(null);
  };

  const toggleRolVisibilidad = async (rol: string, campo: 'puede_crear' | 'puede_ver' | 'puede_editar') => {
    const key = `rol-${rol}-${campo}`;
    setSavingVisibilidad(key);
    const current = rolPermisos.find(r => r.rol === rol);
    const nuevoValor = !(current?.[campo] ?? true);
    const { error } = await supabase
      .from('tramite_tipo_rol_permisos')
      .upsert({ tramite_tipo_id: tipoId, rol, [campo]: nuevoValor, updated_by: usuarioId }, { onConflict: 'tramite_tipo_id,rol' });
    if (!error) setRolPermisos(prev => prev.map(r => r.rol === rol ? { ...r, [campo]: nuevoValor } : r));
    setSavingVisibilidad(null);
  };

  const toggleUsuarioOverride = async (userId: string, campo: 'puede_crear' | 'puede_ver' | 'puede_editar') => {
    const key = `user-${userId}-${campo}`;
    setSavingVisibilidad(key);
    const current = usuarioOverrides.find(u => u.user_id === userId);
    const prev = current?.[campo] ?? null;
    const nuevoValor = prev === null ? true : prev === true ? false : null;

    if (nuevoValor === null) {
      await supabase.from('tramite_tipo_usuario_override')
        .delete().eq('tramite_tipo_id', tipoId).eq('user_id', userId);
    } else {
      await supabase.from('tramite_tipo_usuario_override')
        .upsert({ tramite_tipo_id: tipoId, user_id: userId, [campo]: nuevoValor, updated_by: usuarioId }, { onConflict: 'tramite_tipo_id,user_id' });
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
    const currentVals = equipo.miembros.map(m => usuarioOverrides.find(u => u.user_id === m.usuario_id)?.[campo] ?? null);
    const allTrue = currentVals.every(v => v === true);
    const nuevoValor = allTrue ? null : true;
    for (const m of equipo.miembros) {
      if (nuevoValor === null) {
        await supabase.from('tramite_tipo_usuario_override').delete()
          .eq('tramite_tipo_id', tipoId).eq('user_id', m.usuario_id);
      } else {
        await supabase.from('tramite_tipo_usuario_override')
          .upsert({ tramite_tipo_id: tipoId, user_id: m.usuario_id, [campo]: nuevoValor, updated_by: usuarioId }, { onConflict: 'tramite_tipo_id,user_id' });
      }
    }
    setUsuarioOverrides(prev => prev.map(u =>
      equipo.miembros.some(m => m.usuario_id === u.user_id) ? { ...u, [campo]: nuevoValor } : u
    ));
  };

  return {
    equiposPermisos, permisos, loadingPermisos,
    rolPermisos, usuarioOverrides,
    savingPermId, savingVisibilidad,
    equiposColapsados,
    loadPermisos,
    hasPermiso, togglePermiso,
    toggleRolVisibilidad, toggleUsuarioOverride,
    toggleEquipoColapsado, toggleEquipoOverride,
  };
}
