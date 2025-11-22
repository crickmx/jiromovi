import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Users, Building2, UserCheck, Globe } from 'lucide-react';

interface Usuario {
  id: string;
  nombre_completo: string;
  rol: string;
  oficina_id: string;
}

interface Oficina {
  id: string;
  nombre: string;
}

export interface PermisosSeleccionados {
  visible_para_todos: boolean;
  roles: string[];
  oficinas: string[];
  usuarios: string[];
}

interface SelectorPermisosProps {
  permisos: PermisosSeleccionados;
  onChange: (permisos: PermisosSeleccionados) => void;
}

const ROLES_DISPONIBLES = ['Administrador', 'Gerente', 'Empleado', 'Agente'];

export function SelectorPermisos({ permisos, onChange }: SelectorPermisosProps) {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [oficinas, setOficinas] = useState<Oficina[]>([]);
  const [loading, setLoading] = useState(true);
  const [mostrarUsuarios, setMostrarUsuarios] = useState(false);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      // Cargar oficinas
      const { data: oficinasData } = await supabase
        .from('oficinas')
        .select('id, nombre')
        .order('nombre');

      // Cargar usuarios
      const { data: usuariosData } = await supabase
        .from('usuarios')
        .select('id, nombre_completo, rol, oficina_id')
        .order('nombre_completo');

      setOficinas(oficinasData || []);
      setUsuarios(usuariosData || []);
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVisibleParaTodosChange = (visible: boolean) => {
    onChange({
      ...permisos,
      visible_para_todos: visible,
      roles: visible ? [] : permisos.roles,
      oficinas: visible ? [] : permisos.oficinas,
      usuarios: visible ? [] : permisos.usuarios
    });
  };

  const handleRolToggle = (rol: string) => {
    const nuevosRoles = permisos.roles.includes(rol)
      ? permisos.roles.filter(r => r !== rol)
      : [...permisos.roles, rol];

    onChange({
      ...permisos,
      roles: nuevosRoles
    });
  };

  const handleOficinaToggle = (oficinaId: string) => {
    const nuevasOficinas = permisos.oficinas.includes(oficinaId)
      ? permisos.oficinas.filter(o => o !== oficinaId)
      : [...permisos.oficinas, oficinaId];

    onChange({
      ...permisos,
      oficinas: nuevasOficinas
    });
  };

  const handleUsuarioToggle = (usuarioId: string) => {
    const nuevosUsuarios = permisos.usuarios.includes(usuarioId)
      ? permisos.usuarios.filter(u => u !== usuarioId)
      : [...permisos.usuarios, usuarioId];

    onChange({
      ...permisos,
      usuarios: nuevosUsuarios
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-neutral-800 mb-4 flex items-center gap-2">
          <UserCheck className="w-5 h-5 text-primary-600" />
          ¿Quiénes pueden ver este evento?
        </h3>

        {/* Opción: Visible para todos */}
        <div className="mb-6">
          <label className="flex items-center space-x-3 p-4 bg-neutral-50 rounded-xl border-2 border-neutral-200 hover:border-primary-300 transition cursor-pointer">
            <input
              type="checkbox"
              checked={permisos.visible_para_todos}
              onChange={(e) => handleVisibleParaTodosChange(e.target.checked)}
              className="w-5 h-5 text-primary-600 rounded focus:ring-2 focus:ring-primary-500"
            />
            <Globe className="w-5 h-5 text-primary-600" />
            <div>
              <p className="font-semibold text-neutral-800">Mostrar a todos los usuarios</p>
              <p className="text-sm text-neutral-600">Todos podrán ver este evento</p>
            </div>
          </label>
        </div>

        {/* Opciones específicas (solo si NO es visible para todos) */}
        {!permisos.visible_para_todos && (
          <div className="space-y-4">
            {/* Filtrar por Roles */}
            <div className="border border-neutral-200 rounded-xl p-4">
              <h4 className="font-medium text-neutral-800 mb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-primary-600" />
                Filtrar por Roles
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {ROLES_DISPONIBLES.map(rol => (
                  <label
                    key={rol}
                    className="flex items-center space-x-2 p-2 bg-neutral-50 rounded-lg hover:bg-neutral-100 transition cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={permisos.roles.includes(rol)}
                      onChange={() => handleRolToggle(rol)}
                      className="w-4 h-4 text-primary-600 rounded focus:ring-2 focus:ring-primary-500"
                    />
                    <span className="text-sm text-neutral-700">{rol}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Filtrar por Oficinas */}
            <div className="border border-neutral-200 rounded-xl p-4">
              <h4 className="font-medium text-neutral-800 mb-3 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary-600" />
                Filtrar por Oficinas
              </h4>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {oficinas.map(oficina => (
                  <label
                    key={oficina.id}
                    className="flex items-center space-x-2 p-2 bg-neutral-50 rounded-lg hover:bg-neutral-100 transition cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={permisos.oficinas.includes(oficina.id)}
                      onChange={() => handleOficinaToggle(oficina.id)}
                      className="w-4 h-4 text-primary-600 rounded focus:ring-2 focus:ring-primary-500"
                    />
                    <span className="text-sm text-neutral-700">{oficina.nombre}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Selección individual de usuarios */}
            <div className="border border-neutral-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-neutral-800 flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-primary-600" />
                  Usuarios Específicos (opcional)
                </h4>
                <button
                  type="button"
                  onClick={() => setMostrarUsuarios(!mostrarUsuarios)}
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  {mostrarUsuarios ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>

              {mostrarUsuarios && (
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {usuarios.map(usuario => (
                    <label
                      key={usuario.id}
                      className="flex items-center space-x-2 p-2 bg-neutral-50 rounded-lg hover:bg-neutral-100 transition cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={permisos.usuarios.includes(usuario.id)}
                        onChange={() => handleUsuarioToggle(usuario.id)}
                        className="w-4 h-4 text-primary-600 rounded focus:ring-2 focus:ring-primary-500"
                      />
                      <span className="text-sm text-neutral-700 flex-1">
                        {usuario.nombre_completo}
                      </span>
                      <span className="text-xs text-neutral-500">
                        {usuario.rol}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Resumen de selección */}
            <div className="bg-primary-50 border border-primary-200 rounded-xl p-4">
              <h4 className="font-medium text-primary-800 mb-2">Resumen de Permisos</h4>
              <div className="text-sm text-primary-700 space-y-1">
                {permisos.roles.length > 0 && (
                  <p>✓ {permisos.roles.length} rol(es) seleccionado(s)</p>
                )}
                {permisos.oficinas.length > 0 && (
                  <p>✓ {permisos.oficinas.length} oficina(s) seleccionada(s)</p>
                )}
                {permisos.usuarios.length > 0 && (
                  <p>✓ {permisos.usuarios.length} usuario(s) específico(s)</p>
                )}
                {permisos.roles.length === 0 && permisos.oficinas.length === 0 && permisos.usuarios.length === 0 && (
                  <p className="text-amber-600">⚠️ No hay permisos seleccionados. Nadie podrá ver este evento.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
