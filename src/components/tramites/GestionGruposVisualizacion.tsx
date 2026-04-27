import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Users, UserPlus, UserMinus, Search, ShieldCheck, Briefcase, Wrench } from 'lucide-react';
import { AREA_CONFIG, type AreaCategoria } from '../../lib/registroActividadesTypes';

interface Grupo {
  id: string;
  nombre: string;
  descripcion: string | null;
  color: string;
  area_categoria: AreaCategoria | null;
  activo: boolean;
}

interface Miembro {
  id: string;
  usuario_id: string;
  nombre_completo: string;
  oficina_nombre: string | null;
  rol: string;
  oficina_id: string | null;
}

interface Usuario {
  id: string;
  nombre_completo: string;
  rol: string;
  oficina_nombre: string | null;
}

export function GestionGruposVisualizacion() {
  const { usuario } = useAuth();
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [grupoSeleccionado, setGrupoSeleccionado] = useState<Grupo | null>(null);
  const [miembros, setMiembros] = useState<Miembro[]>([]);
  const [searchUsuario, setSearchUsuario] = useState('');
  const [saving, setSaving] = useState(false);

  const isAdmin = usuario?.rol === 'Administrador';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([loadGrupos(), loadUsuarios()]);
    setLoading(false);
  };

  const loadGrupos = async () => {
    const { data, error } = await supabase
      .from('tramites_grupos_visualizacion')
      .select('*')
      .eq('activo', true)
      .not('area_categoria', 'is', null)
      .order('nombre');

    if (error) {
      console.error('Error loading grupos:', error);
      return;
    }
    setGrupos(data || []);
  };

  const loadUsuarios = async () => {
    const { data, error } = await supabase
      .from('usuarios')
      .select(`
        id,
        nombre,
        apellidos,
        rol,
        oficinas(nombre)
      `)
      .eq('estado', 'Activo')
      .in('rol', ['Empleado', 'Gerente', 'Ejecutivo'])
      .order('nombre');

    if (error) {
      console.error('Error loading usuarios:', error);
      return;
    }

    setUsuarios(
      (data || []).map(u => ({
        id: u.id,
        nombre_completo: `${u.nombre || ''} ${u.apellidos || ''}`.trim().toUpperCase(),
        rol: u.rol,
        oficina_nombre: (u.oficinas as any)?.nombre || null,
      }))
    );
  };

  const loadMiembros = async (grupoId: string) => {
    const { data, error } = await supabase.rpc('get_grupo_miembros', {
      p_grupo_id: grupoId,
    });

    if (error) {
      console.error('Error loading miembros:', error);
      return;
    }

    setMiembros(
      (data || []).map((m: any) => ({
        ...m,
        usuario_id: m.id,
      }))
    );
  };

  const handleAgregarMiembro = async (usuarioId: string) => {
    if (!grupoSeleccionado) return;
    setSaving(true);

    const { error } = await supabase
      .from('tramites_grupos_miembros')
      .insert({ grupo_id: grupoSeleccionado.id, usuario_id: usuarioId });

    if (error) {
      if (error.code === '23505') {
        alert('Este usuario ya está en el grupo');
      } else {
        alert('Error al agregar miembro: ' + error.message);
      }
      setSaving(false);
      return;
    }

    await loadMiembros(grupoSeleccionado.id);
    setSaving(false);
  };

  const handleRemoverMiembro = async (usuarioId: string) => {
    if (!grupoSeleccionado) return;
    setSaving(true);

    const { error } = await supabase
      .from('tramites_grupos_miembros')
      .delete()
      .eq('grupo_id', grupoSeleccionado.id)
      .eq('usuario_id', usuarioId);

    if (error) {
      alert('Error al remover miembro: ' + error.message);
      setSaving(false);
      return;
    }

    await loadMiembros(grupoSeleccionado.id);
    setSaving(false);
  };

  const openMiembrosPanel = async (grupo: Grupo) => {
    setGrupoSeleccionado(grupo);
    setSearchUsuario('');
    await loadMiembros(grupo.id);
  };

  const usuariosDisponibles = usuarios.filter(
    u =>
      !miembros.some(m => m.usuario_id === u.id) &&
      u.nombre_completo.toLowerCase().includes(searchUsuario.toLowerCase())
  );

  const getAreaIcon = (area: string | null) => {
    if (area === 'Comercial') return <Briefcase className="w-5 h-5" />;
    return <Wrench className="w-5 h-5" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="text-center py-12 text-neutral-500">
        <ShieldCheck className="w-12 h-12 mx-auto mb-3 text-neutral-300" />
        <p className="font-medium">Solo los administradores pueden gestionar los grupos de visualizacion.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-neutral-900">Equipos de Trabajo</h3>
        <p className="text-sm text-neutral-500 mt-1">
          Asigna usuarios a cada equipo para controlar que tramites pueden ver. Los usuarios de Comercial solo ven tramites de su oficina. Los usuarios de Operaciones ven tramites de toda la organizacion.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {grupos.map(grupo => {
          const area = grupo.area_categoria as AreaCategoria;
          const ac = area ? AREA_CONFIG[area] : { bg: 'bg-neutral-50', color: 'text-neutral-700', border: 'border-neutral-200' };
          const isSelected = grupoSeleccionado?.id === grupo.id;

          return (
            <button
              key={grupo.id}
              onClick={() => openMiembrosPanel(grupo)}
              className={`text-left border-2 rounded-xl p-5 transition-all hover:shadow-md ${
                isSelected ? `${ac.border} shadow-md ring-2 ring-offset-1` : 'border-neutral-200 hover:border-neutral-300'
              }`}
              style={isSelected ? { ringColor: grupo.color } : undefined}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2.5 rounded-lg ${ac.bg}`}>
                  <span className={ac.color}>{getAreaIcon(grupo.area_categoria)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-neutral-900">{grupo.nombre}</h4>
                  {grupo.descripcion && (
                    <p className="text-xs text-neutral-500 mt-1 line-clamp-2">{grupo.descripcion}</p>
                  )}
                  <div className="mt-2">
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${ac.bg} ${ac.color}`}>
                      {grupo.area_categoria}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Members panel */}
      {grupoSeleccionado && (() => {
        const area = grupoSeleccionado.area_categoria as AreaCategoria;
        const ac = area ? AREA_CONFIG[area] : { bg: 'bg-neutral-50', color: 'text-neutral-700', border: 'border-neutral-200' };

        return (
          <div className={`border-2 rounded-xl overflow-hidden ${ac.border}`}>
            <div className={`px-5 py-4 ${ac.bg} flex items-center justify-between`}>
              <div>
                <h4 className={`font-bold ${ac.color}`}>
                  {grupoSeleccionado.nombre} - Miembros ({miembros.length})
                </h4>
                <p className="text-xs text-neutral-500 mt-0.5">
                  {grupoSeleccionado.area_categoria === 'Comercial'
                    ? 'Estos usuarios solo veran tramites Comercial de su oficina'
                    : 'Estos usuarios veran tramites Operaciones de toda la organizacion'}
                </p>
              </div>
            </div>

            <div className="p-5 space-y-5">
              {/* Current members */}
              <div>
                <h5 className="text-sm font-semibold text-neutral-700 mb-2 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Miembros Actuales
                </h5>
                {miembros.length === 0 ? (
                  <p className="text-sm text-neutral-400 text-center py-6 bg-neutral-50 rounded-lg">
                    No hay miembros asignados a este grupo
                  </p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {miembros.map(m => (
                      <div
                        key={m.usuario_id}
                        className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg group hover:bg-neutral-100 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-neutral-900 text-sm">{m.nombre_completo}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-neutral-500">{m.rol}</span>
                            {m.oficina_nombre && (
                              <>
                                <span className="text-neutral-300">|</span>
                                <span className="text-xs text-neutral-500">{m.oficina_nombre}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRemoverMiembro(m.usuario_id); }}
                          disabled={saving}
                          className="p-1.5 hover:bg-red-100 rounded-lg transition opacity-0 group-hover:opacity-100"
                          title="Remover del grupo"
                        >
                          <UserMinus className="w-4 h-4 text-red-600" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add users */}
              <div>
                <h5 className="text-sm font-semibold text-neutral-700 mb-2 flex items-center gap-2">
                  <UserPlus className="w-4 h-4" />
                  Agregar Usuarios
                  <span className="text-xs font-normal text-neutral-400">(Empleados y Gerentes)</span>
                </h5>

                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                  <input
                    type="text"
                    placeholder="Buscar por nombre..."
                    value={searchUsuario}
                    onChange={e => setSearchUsuario(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-accent text-sm"
                  />
                </div>

                <div className="max-h-64 overflow-y-auto space-y-1">
                  {usuariosDisponibles.length === 0 ? (
                    <p className="text-sm text-neutral-400 text-center py-4">
                      {searchUsuario ? 'Sin resultados' : 'Todos los usuarios ya estan asignados'}
                    </p>
                  ) : (
                    usuariosDisponibles.map(u => (
                      <div
                        key={u.id}
                        className="flex items-center justify-between p-3 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-neutral-900 text-sm">{u.nombre_completo}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-neutral-500">{u.rol}</span>
                            {u.oficina_nombre && (
                              <>
                                <span className="text-neutral-300">|</span>
                                <span className="text-xs text-neutral-500">{u.oficina_nombre}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleAgregarMiembro(u.id)}
                          disabled={saving}
                          className="p-1.5 hover:bg-green-100 rounded-lg transition"
                          title="Agregar al grupo"
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
        );
      })()}
    </div>
  );
}
