import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Settings, Save, Plus, Trash2, X } from 'lucide-react';
import type { Database } from '../lib/database.types';

type PermisosCampo = Database['public']['Tables']['permisos_campos']['Row'];
type CampoPersonalizado = Database['public']['Tables']['campos_personalizados']['Row'];

export function Configuracion() {
  const [activeTab, setActiveTab] = useState<'permisos' | 'campos'>('permisos');
  const [permisos, setPermisos] = useState<PermisosCampo[]>([]);
  const [camposPersonalizados, setCamposPersonalizados] = useState<CampoPersonalizado[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showNewFieldModal, setShowNewFieldModal] = useState(false);
  const [newField, setNewField] = useState({
    nombre: '',
    tipo: 'texto' as 'texto' | 'numero' | 'fecha' | 'booleano',
    visible: true,
    editable: true,
    requerido: false,
  });

  const roles = ['Empleado', 'Agente', 'Gerente'];

  const campos = [
    { key: 'nombre', label: 'Nombre' },
    { key: 'apellidos', label: 'Apellidos' },
    { key: 'puesto', label: 'Puesto' },
    { key: 'oficina_id', label: 'Oficina' },
    { key: 'fecha_nacimiento', label: 'Fecha de Nacimiento' },
    { key: 'fecha_ingreso', label: 'Fecha de Ingreso' },
    { key: 'celular_personal', label: 'Celular Personal' },
    { key: 'email_personal', label: 'Email Personal' },
    { key: 'celular_laboral', label: 'Celular Laboral' },
    { key: 'email_laboral', label: 'Email Laboral' },
    { key: 'extension_telefonica', label: 'Extensión Telefónica' },
    { key: 'url_web_jiro', label: 'URL Web Jiro' },
    { key: 'url_web_multicotizador', label: 'URL Web Multicotizador' },
    { key: 'imagen_perfil_url', label: 'Imagen de Perfil' },
  ];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [permisosRes, camposRes] = await Promise.all([
      supabase.from('permisos_campos').select('*').order('rol').order('nombre_campo'),
      supabase.from('campos_personalizados').select('*').order('orden').order('nombre'),
    ]);

    if (permisosRes.data) setPermisos(permisosRes.data);
    if (camposRes.data) setCamposPersonalizados(camposRes.data);
    setLoading(false);
  };

  const getPermiso = (rol: string, campo: string) => {
    return permisos.find((p) => p.rol === rol && p.nombre_campo === campo);
  };

  const toggleEditable = (rol: string, campo: string) => {
    const permiso = getPermiso(rol, campo);
    if (!permiso) return;

    setPermisos(
      permisos.map((p) =>
        p.id === permiso.id ? { ...p, editable: !p.editable } : p
      )
    );
  };

  const toggleVisible = (rol: string, campo: string) => {
    const permiso = getPermiso(rol, campo);
    if (!permiso) return;

    setPermisos(
      permisos.map((p) =>
        p.id === permiso.id ? { ...p, visible: !p.visible } : p
      )
    );
  };

  const handleSavePermisos = async () => {
    setSaving(true);
    setMessage(null);

    try {
      for (const permiso of permisos) {
        const { error } = await supabase
          .from('permisos_campos')
          .update({
            editable: permiso.editable,
            visible: permiso.visible,
            updated_at: new Date().toISOString(),
          })
          .eq('id', permiso.id);

        if (error) throw error;
      }

      setMessage({ type: 'success', text: 'Configuración guardada correctamente' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Error al guardar configuración' });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateField = async () => {
    if (!newField.nombre.trim()) {
      setMessage({ type: 'error', text: 'El nombre del campo es requerido' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const maxOrden = camposPersonalizados.reduce((max, c) => Math.max(max, c.orden || 0), 0);

      const { error } = await supabase.from('campos_personalizados').insert({
        nombre: newField.nombre,
        tipo: newField.tipo,
        visible: newField.visible,
        editable: newField.editable,
        requerido: newField.requerido,
        orden: maxOrden + 1,
        activo: true,
      });

      if (error) throw error;

      setMessage({ type: 'success', text: 'Campo personalizado creado correctamente' });
      setShowNewFieldModal(false);
      setNewField({
        nombre: '',
        tipo: 'texto',
        visible: true,
        editable: true,
        requerido: false,
      });
      await loadData();
    } catch (error) {
      setMessage({ type: 'error', text: 'Error al crear campo personalizado' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleFieldActive = async (fieldId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('campos_personalizados')
        .update({ activo: !currentStatus, updated_at: new Date().toISOString() })
        .eq('id', fieldId);

      if (error) throw error;

      setCamposPersonalizados(
        camposPersonalizados.map((c) =>
          c.id === fieldId ? { ...c, activo: !currentStatus } : c
        )
      );
      setMessage({ type: 'success', text: 'Campo actualizado correctamente' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Error al actualizar campo' });
    }
  };

  const handleUpdateField = async (
    fieldId: string,
    updates: Partial<CampoPersonalizado>
  ) => {
    try {
      const { error } = await supabase
        .from('campos_personalizados')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', fieldId);

      if (error) throw error;

      setCamposPersonalizados(
        camposPersonalizados.map((c) =>
          c.id === fieldId ? { ...c, ...updates } : c
        )
      );
    } catch (error) {
      setMessage({ type: 'error', text: 'Error al actualizar campo' });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-6">
          <div className="flex items-center space-x-3">
            <Settings className="w-8 h-8 text-white" />
            <div>
              <h1 className="text-2xl font-bold text-white">Configuración del Sistema</h1>
              <p className="text-primary-100 mt-1">Gestiona permisos y campos personalizados</p>
            </div>
          </div>
        </div>

        <div className="border-b border-slate-200">
          <div className="flex px-8">
            <button
              onClick={() => setActiveTab('permisos')}
              className={`px-6 py-4 font-medium transition border-b-2 ${
                activeTab === 'permisos'
                  ? 'border-accent text-accent'
                  : 'border-transparent text-slate-600 hover:text-slate-800'
              }`}
            >
              Permisos de Campos
            </button>
            <button
              onClick={() => setActiveTab('campos')}
              className={`px-6 py-4 font-medium transition border-b-2 ${
                activeTab === 'campos'
                  ? 'border-accent text-accent'
                  : 'border-transparent text-slate-600 hover:text-slate-800'
              }`}
            >
              Campos Personalizados
            </button>
          </div>
        </div>

        <div className="p-8">
          {message && (
            <div
              className={`mb-6 px-4 py-3 rounded-lg ${
                message.type === 'success'
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}
            >
              {message.text}
            </div>
          )}

          {activeTab === 'permisos' ? (
            <>
              <div className="mb-6 p-4 bg-primary-50 border border-primary-200 rounded-lg">
                <p className="text-sm text-primary-800">
                  <strong>Nota:</strong> Los administradores siempre tienen acceso completo a todos los campos.
                  Esta configuración afecta a Empleados, Agentes y Gerentes.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b-2 border-slate-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">
                        Campo
                      </th>
                      {roles.map((rol) => (
                        <th
                          key={rol}
                          className="px-6 py-4 text-center text-sm font-semibold text-slate-700"
                        >
                          <div>{rol}</div>
                          <div className="text-xs font-normal text-slate-500 mt-1">
                            <span className="inline-block mr-3">V = Visible</span>
                            <span className="inline-block">E = Editable</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {campos.map((campo) => (
                      <tr key={campo.key} className="hover:bg-slate-50 transition">
                        <td className="px-6 py-4 text-sm font-medium text-slate-900">
                          {campo.label}
                        </td>
                        {roles.map((rol) => {
                          const permiso = getPermiso(rol, campo.key);
                          if (!permiso) return <td key={rol}></td>;

                          return (
                            <td key={rol} className="px-6 py-4">
                              <div className="flex items-center justify-center space-x-4">
                                <label className="flex items-center space-x-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={permiso.visible}
                                    onChange={() => toggleVisible(rol, campo.key)}
                                    className="w-5 h-5 text-accent rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
                                  />
                                  <span className="text-sm text-slate-600">V</span>
                                </label>
                                <label
                                  className={`flex items-center space-x-2 ${
                                    permiso.visible ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={permiso.editable}
                                    onChange={() => toggleEditable(rol, campo.key)}
                                    disabled={!permiso.visible}
                                    className="w-5 h-5 text-green-600 rounded focus:ring-2 focus:ring-green-500 cursor-pointer disabled:cursor-not-allowed"
                                  />
                                  <span className="text-sm text-slate-600">E</span>
                                </label>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-8 flex justify-end">
                <button
                  onClick={handleSavePermisos}
                  disabled={saving}
                  className="flex items-center space-x-2 bg-accent hover:bg-accent-hover text-white px-6 py-3 rounded-lg font-medium transition disabled:opacity-50"
                >
                  <Save className="w-5 h-5" />
                  <span>{saving ? 'Guardando...' : 'Guardar Configuración'}</span>
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="mb-6 flex justify-between items-center">
                <p className="text-sm text-slate-600">
                  Crea campos personalizados que se mostrarán en todos los perfiles de usuario
                </p>
                <button
                  onClick={() => setShowNewFieldModal(true)}
                  className="flex items-center space-x-2 bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-lg font-medium transition"
                >
                  <Plus className="w-5 h-5" />
                  <span>Agregar Campo</span>
                </button>
              </div>

              {camposPersonalizados.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-lg">
                  <p className="text-slate-600">No hay campos personalizados creados</p>
                  <p className="text-sm text-slate-500 mt-2">
                    Haz clic en "Agregar Campo" para crear uno nuevo
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {camposPersonalizados.map((campo) => (
                    <div
                      key={campo.id}
                      className={`border rounded-lg p-6 ${
                        campo.activo ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-3">
                            <h3 className="text-lg font-semibold text-slate-900">
                              {campo.nombre}
                            </h3>
                            <span
                              className={`px-2 py-1 text-xs font-medium rounded ${
                                campo.activo
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-slate-200 text-slate-600'
                              }`}
                            >
                              {campo.activo ? 'Activo' : 'Inactivo'}
                            </span>
                            <span className="px-2 py-1 text-xs font-medium bg-primary-100 text-primary-700 rounded">
                              {campo.tipo}
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-4">
                            <label className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={campo.visible}
                                onChange={(e) =>
                                  handleUpdateField(campo.id, { visible: e.target.checked })
                                }
                                className="w-4 h-4 text-accent rounded"
                              />
                              <span className="text-sm text-slate-700">Visible</span>
                            </label>
                            <label className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={campo.editable}
                                onChange={(e) =>
                                  handleUpdateField(campo.id, { editable: e.target.checked })
                                }
                                className="w-4 h-4 text-accent rounded"
                              />
                              <span className="text-sm text-slate-700">Editable</span>
                            </label>
                            <label className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={campo.requerido}
                                onChange={(e) =>
                                  handleUpdateField(campo.id, { requerido: e.target.checked })
                                }
                                className="w-4 h-4 text-accent rounded"
                              />
                              <span className="text-sm text-slate-700">Requerido</span>
                            </label>
                          </div>
                        </div>

                        <button
                          onClick={() => handleToggleFieldActive(campo.id, campo.activo)}
                          className={`ml-4 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                            campo.activo
                              ? 'bg-red-100 text-red-700 hover:bg-red-200'
                              : 'bg-green-100 text-green-700 hover:bg-green-200'
                          }`}
                        >
                          {campo.activo ? 'Desactivar' : 'Activar'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showNewFieldModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-900">Nuevo Campo Personalizado</h2>
              <button
                onClick={() => setShowNewFieldModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Nombre del Campo
                </label>
                <input
                  type="text"
                  value={newField.nombre}
                  onChange={(e) => setNewField({ ...newField, nombre: e.target.value })}
                  placeholder="Ej: Número de Seguro Social"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Tipo de Dato
                </label>
                <select
                  value={newField.tipo}
                  onChange={(e) =>
                    setNewField({
                      ...newField,
                      tipo: e.target.value as 'texto' | 'numero' | 'fecha' | 'booleano',
                    })
                  }
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="texto">Texto</option>
                  <option value="numero">Número</option>
                  <option value="fecha">Fecha</option>
                  <option value="booleano">Sí/No</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={newField.visible}
                    onChange={(e) => setNewField({ ...newField, visible: e.target.checked })}
                    className="w-4 h-4 text-accent rounded"
                  />
                  <span className="text-sm text-slate-700">Visible para usuarios</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={newField.editable}
                    onChange={(e) => setNewField({ ...newField, editable: e.target.checked })}
                    className="w-4 h-4 text-accent rounded"
                  />
                  <span className="text-sm text-slate-700">Editable por usuarios</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={newField.requerido}
                    onChange={(e) => setNewField({ ...newField, requerido: e.target.checked })}
                    className="w-4 h-4 text-accent rounded"
                  />
                  <span className="text-sm text-slate-700">Campo requerido</span>
                </label>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 rounded-b-2xl flex justify-end space-x-3">
              <button
                onClick={() => setShowNewFieldModal(false)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateField}
                disabled={saving}
                className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg transition disabled:opacity-50"
              >
                {saving ? 'Creando...' : 'Crear Campo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
