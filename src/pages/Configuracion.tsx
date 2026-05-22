import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Settings, Save, Plus, X } from 'lucide-react';
import type { Database } from '../lib/database.types';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/ui/loading-state';

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
    return <LoadingState text="Cargando configuracion..." />;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Configuracion del Sistema"
        description="Gestiona permisos y campos personalizados"
        icon={Settings}
      >
        <div className="flex gap-1 border-b border-neutral-200 dark:border-white/8">
          {([['permisos', 'Permisos de Campos'], ['campos', 'Campos Personalizados']] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px ${
                activeTab === key
                  ? 'text-accent border-accent'
                  : 'text-neutral-500 dark:text-white/50 border-transparent hover:text-neutral-700 dark:hover:text-white/70'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </PageHeader>

      <div className="bg-white dark:bg-neutral-800/50 rounded-xl border border-neutral-200/60 dark:border-white/8 p-5 sm:p-8">
          {message && (
            <div
              className={`mb-6 px-4 py-3 rounded-lg text-sm ${
                message.type === 'success'
                  ? 'bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-500/20'
                  : 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/20'
              }`}
            >
              {message.text}
            </div>
          )}

          {activeTab === 'permisos' ? (
            <>
              <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  <strong>Nota:</strong> Los administradores siempre tienen acceso completo a todos los campos.
                  Esta configuracion afecta a Empleados, Agentes y Gerentes.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-neutral-50 dark:bg-white/5 border-b border-neutral-200 dark:border-white/10">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 dark:text-white/60 uppercase tracking-wider">
                        Campo
                      </th>
                      {roles.map((rol) => (
                        <th
                          key={rol}
                          className="px-4 py-3 text-center text-xs font-semibold text-neutral-600 dark:text-white/60 uppercase tracking-wider"
                        >
                          <div>{rol}</div>
                          <div className="text-[10px] font-normal text-neutral-400 dark:text-white/30 mt-1">
                            <span className="inline-block mr-3">V = Visible</span>
                            <span className="inline-block">E = Editable</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-white/5">
                    {campos.map((campo) => (
                      <tr key={campo.key} className="hover:bg-neutral-50 dark:hover:bg-white/3 transition">
                        <td className="px-4 py-3 text-sm font-medium text-neutral-900 dark:text-white">
                          {campo.label}
                        </td>
                        {roles.map((rol) => {
                          const permiso = getPermiso(rol, campo.key);
                          if (!permiso) return <td key={rol}></td>;

                          return (
                            <td key={rol} className="px-4 py-3">
                              <div className="flex items-center justify-center space-x-4">
                                <label className="flex items-center space-x-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={permiso.visible}
                                    onChange={() => toggleVisible(rol, campo.key)}
                                    className="w-4 h-4 text-accent rounded focus:ring-2 focus:ring-accent/30 cursor-pointer"
                                  />
                                  <span className="text-xs text-neutral-500 dark:text-white/50">V</span>
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
                                    className="w-4 h-4 text-green-600 rounded focus:ring-2 focus:ring-green-500/30 cursor-pointer disabled:cursor-not-allowed"
                                  />
                                  <span className="text-xs text-neutral-500 dark:text-white/50">E</span>
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
                <Button onClick={handleSavePermisos} disabled={saving}>
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? 'Guardando...' : 'Guardar Configuracion'}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                <p className="text-sm text-neutral-600 dark:text-white/50">
                  Crea campos personalizados que se mostraran en todos los perfiles de usuario
                </p>
                <Button size="sm" onClick={() => setShowNewFieldModal(true)}>
                  <Plus className="w-4 h-4 mr-1.5" />
                  Agregar Campo
                </Button>
              </div>

              {camposPersonalizados.length === 0 ? (
                <div className="text-center py-12 bg-neutral-50 dark:bg-white/3 rounded-lg">
                  <p className="text-neutral-600 dark:text-white/60">No hay campos personalizados creados</p>
                  <p className="text-sm text-neutral-500 dark:text-white/40 mt-2">
                    Haz clic en "Agregar Campo" para crear uno nuevo
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {camposPersonalizados.map((campo) => (
                    <div
                      key={campo.id}
                      className={`border rounded-xl p-5 transition-all ${
                        campo.activo
                          ? 'border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-800/30'
                          : 'border-neutral-200 dark:border-white/5 bg-neutral-50 dark:bg-white/3 opacity-75'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-3">
                            <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                              {campo.nombre}
                            </h3>
                            <span
                              className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                                campo.activo
                                  ? 'bg-green-100 dark:bg-green-500/10 text-green-700 dark:text-green-400'
                                  : 'bg-neutral-200 dark:bg-white/10 text-neutral-600 dark:text-white/50'
                              }`}
                            >
                              {campo.activo ? 'Activo' : 'Inactivo'}
                            </span>
                            <span className="px-2 py-0.5 text-[10px] font-semibold bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 rounded-full">
                              {campo.tipo}
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-4">
                            <label className="flex items-center space-x-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={campo.visible}
                                onChange={(e) =>
                                  handleUpdateField(campo.id, { visible: e.target.checked })
                                }
                                className="w-4 h-4 text-accent rounded focus:ring-2 focus:ring-accent/30"
                              />
                              <span className="text-xs text-neutral-700 dark:text-white/60">Visible</span>
                            </label>
                            <label className="flex items-center space-x-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={campo.editable}
                                onChange={(e) =>
                                  handleUpdateField(campo.id, { editable: e.target.checked })
                                }
                                className="w-4 h-4 text-accent rounded focus:ring-2 focus:ring-accent/30"
                              />
                              <span className="text-xs text-neutral-700 dark:text-white/60">Editable</span>
                            </label>
                            <label className="flex items-center space-x-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={campo.requerido}
                                onChange={(e) =>
                                  handleUpdateField(campo.id, { requerido: e.target.checked })
                                }
                                className="w-4 h-4 text-accent rounded focus:ring-2 focus:ring-accent/30"
                              />
                              <span className="text-xs text-neutral-700 dark:text-white/60">Requerido</span>
                            </label>
                          </div>
                        </div>

                        <Button
                          variant={campo.activo ? 'destructive' : 'outline'}
                          size="sm"
                          onClick={() => handleToggleFieldActive(campo.id, campo.activo)}
                        >
                          {campo.activo ? 'Desactivar' : 'Activar'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
      </div>

      {showNewFieldModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 dark:border-white/10">
              <h2 className="text-base font-bold text-neutral-900 dark:text-white">Nuevo Campo Personalizado</h2>
              <button
                onClick={() => setShowNewFieldModal(false)}
                className="text-neutral-400 hover:text-neutral-600 dark:hover:text-white/70 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-[11px] font-medium text-neutral-500 dark:text-white/40 uppercase tracking-wider mb-1.5">
                  Nombre del Campo
                </label>
                <input
                  type="text"
                  value={newField.nombre}
                  onChange={(e) => setNewField({ ...newField, nombre: e.target.value })}
                  placeholder="Ej: Numero de Seguro Social"
                  className="w-full px-3 py-2 text-sm bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all text-neutral-700 dark:text-white/80"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-neutral-500 dark:text-white/40 uppercase tracking-wider mb-1.5">
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
                  className="w-full px-3 py-2 text-sm bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all text-neutral-700 dark:text-white/80"
                >
                  <option value="texto">Texto</option>
                  <option value="numero">Numero</option>
                  <option value="fecha">Fecha</option>
                  <option value="booleano">Si/No</option>
                </select>
              </div>

              <div className="space-y-2.5">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newField.visible}
                    onChange={(e) => setNewField({ ...newField, visible: e.target.checked })}
                    className="w-4 h-4 text-accent rounded focus:ring-2 focus:ring-accent/30"
                  />
                  <span className="text-sm text-neutral-700 dark:text-white/70">Visible para usuarios</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newField.editable}
                    onChange={(e) => setNewField({ ...newField, editable: e.target.checked })}
                    className="w-4 h-4 text-accent rounded focus:ring-2 focus:ring-accent/30"
                  />
                  <span className="text-sm text-neutral-700 dark:text-white/70">Editable por usuarios</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newField.requerido}
                    onChange={(e) => setNewField({ ...newField, requerido: e.target.checked })}
                    className="w-4 h-4 text-accent rounded focus:ring-2 focus:ring-accent/30"
                  />
                  <span className="text-sm text-neutral-700 dark:text-white/70">Campo requerido</span>
                </label>
              </div>
            </div>

            <div className="px-5 py-4 bg-neutral-50 dark:bg-white/3 rounded-b-xl border-t border-neutral-200 dark:border-white/10 flex justify-end gap-3">
              <Button variant="outline" size="sm" onClick={() => setShowNewFieldModal(false)}>
                Cancelar
              </Button>
              <Button size="sm" onClick={handleCreateField} disabled={saving}>
                {saving ? 'Creando...' : 'Crear Campo'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
