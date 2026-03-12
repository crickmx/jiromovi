import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X, Tag, Shield } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface TramiteActivityType {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
}

interface InsuranceType {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
}

export function GestionCatalogosRegistro() {
  const { usuario } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Activity Types
  const [activityTypes, setActivityTypes] = useState<TramiteActivityType[]>([]);
  const [editingActivityType, setEditingActivityType] = useState<string | null>(null);
  const [newActivityType, setNewActivityType] = useState({ nombre: '', descripcion: '' });
  const [editActivityData, setEditActivityData] = useState({ nombre: '', descripcion: '' });
  const [showNewActivityForm, setShowNewActivityForm] = useState(false);

  // Insurance Types
  const [insuranceTypes, setInsuranceTypes] = useState<InsuranceType[]>([]);
  const [editingInsuranceType, setEditingInsuranceType] = useState<string | null>(null);
  const [newInsuranceType, setNewInsuranceType] = useState({ nombre: '', descripcion: '' });
  const [editInsuranceData, setEditInsuranceData] = useState({ nombre: '', descripcion: '' });
  const [showNewInsuranceForm, setShowNewInsuranceForm] = useState(false);

  const isAdmin = usuario?.rol === 'Administrador';

  useEffect(() => {
    loadCatalogs();
  }, []);

  const loadCatalogs = async () => {
    setLoading(true);
    try {
      const [activityRes, insuranceRes] = await Promise.all([
        supabase
          .from('tramite_activity_types')
          .select('*')
          .order('nombre'),
        supabase
          .from('insurance_types')
          .select('*')
          .order('nombre')
      ]);

      if (activityRes.data) setActivityTypes(activityRes.data);
      if (insuranceRes.data) setInsuranceTypes(insuranceRes.data);
    } catch (err: any) {
      setError('Error al cargar catálogos');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // ========== ACTIVITY TYPES ==========
  const handleCreateActivityType = async () => {
    if (!newActivityType.nombre.trim()) {
      setError('El nombre es obligatorio');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const { error: insertError } = await supabase
        .from('tramite_activity_types')
        .insert({
          nombre: newActivityType.nombre.trim(),
          descripcion: newActivityType.descripcion.trim() || null,
          activo: true
        });

      if (insertError) throw insertError;

      setSuccess('Tipo de trámite creado exitosamente');
      setNewActivityType({ nombre: '', descripcion: '' });
      setShowNewActivityForm(false);
      await loadCatalogs();

      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Error al crear tipo de trámite');
    } finally {
      setLoading(false);
    }
  };

  const handleEditActivityType = async (id: string) => {
    if (!editActivityData.nombre.trim()) {
      setError('El nombre es obligatorio');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const { error: updateError } = await supabase
        .from('tramite_activity_types')
        .update({
          nombre: editActivityData.nombre.trim(),
          descripcion: editActivityData.descripcion.trim() || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (updateError) throw updateError;

      setSuccess('Tipo de trámite actualizado exitosamente');
      setEditingActivityType(null);
      await loadCatalogs();

      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Error al actualizar tipo de trámite');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActivityType = async (id: string, currentStatus: boolean) => {
    setLoading(true);
    setError('');
    try {
      const { error: updateError } = await supabase
        .from('tramite_activity_types')
        .update({
          activo: !currentStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (updateError) throw updateError;

      setSuccess(`Tipo de trámite ${!currentStatus ? 'activado' : 'desactivado'} exitosamente`);
      await loadCatalogs();

      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Error al cambiar estado');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteActivityType = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar este tipo de trámite? Esta acción no se puede deshacer.')) {
      return;
    }

    setLoading(true);
    setError('');
    try {
      const { error: deleteError } = await supabase
        .from('tramite_activity_types')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      setSuccess('Tipo de trámite eliminado exitosamente');
      await loadCatalogs();

      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Error al eliminar tipo de trámite');
    } finally {
      setLoading(false);
    }
  };

  // ========== INSURANCE TYPES ==========
  const handleCreateInsuranceType = async () => {
    if (!newInsuranceType.nombre.trim()) {
      setError('El nombre es obligatorio');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const { error: insertError } = await supabase
        .from('insurance_types')
        .insert({
          nombre: newInsuranceType.nombre.trim(),
          descripcion: newInsuranceType.descripcion.trim() || null,
          activo: true
        });

      if (insertError) throw insertError;

      setSuccess('Tipo de seguro creado exitosamente');
      setNewInsuranceType({ nombre: '', descripcion: '' });
      setShowNewInsuranceForm(false);
      await loadCatalogs();

      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Error al crear tipo de seguro');
    } finally {
      setLoading(false);
    }
  };

  const handleEditInsuranceType = async (id: string) => {
    if (!editInsuranceData.nombre.trim()) {
      setError('El nombre es obligatorio');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const { error: updateError } = await supabase
        .from('insurance_types')
        .update({
          nombre: editInsuranceData.nombre.trim(),
          descripcion: editInsuranceData.descripcion.trim() || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (updateError) throw updateError;

      setSuccess('Tipo de seguro actualizado exitosamente');
      setEditingInsuranceType(null);
      await loadCatalogs();

      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Error al actualizar tipo de seguro');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleInsuranceType = async (id: string, currentStatus: boolean) => {
    setLoading(true);
    setError('');
    try {
      const { error: updateError } = await supabase
        .from('insurance_types')
        .update({
          activo: !currentStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (updateError) throw updateError;

      setSuccess(`Tipo de seguro ${!currentStatus ? 'activado' : 'desactivado'} exitosamente`);
      await loadCatalogs();

      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Error al cambiar estado');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteInsuranceType = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar este tipo de seguro? Esta acción no se puede deshacer.')) {
      return;
    }

    setLoading(true);
    setError('');
    try {
      const { error: deleteError } = await supabase
        .from('insurance_types')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      setSuccess('Tipo de seguro eliminado exitosamente');
      await loadCatalogs();

      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Error al eliminar tipo de seguro');
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <p className="text-gray-600 dark:text-gray-400">
          Solo los administradores pueden gestionar catálogos.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Mensajes de estado */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <p className="text-green-700 dark:text-green-400 text-sm">{success}</p>
        </div>
      )}

      {/* ========== TIPOS DE TRÁMITE ========== */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Tag className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Tipos de Trámite
            </h2>
          </div>
          <button
            onClick={() => setShowNewActivityForm(!showNewActivityForm)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Nuevo Tipo
          </button>
        </div>

        {/* Formulario para nuevo tipo */}
        {showNewActivityForm && (
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-4 space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nombre *
              </label>
              <input
                type="text"
                value={newActivityType.nombre}
                onChange={(e) => setNewActivityType({ ...newActivityType, nombre: e.target.value })}
                placeholder="Ej: Cotización"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Descripción
              </label>
              <input
                type="text"
                value={newActivityType.descripcion}
                onChange={(e) => setNewActivityType({ ...newActivityType, descripcion: e.target.value })}
                placeholder="Descripción opcional"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCreateActivityType}
                disabled={loading}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                Guardar
              </button>
              <button
                onClick={() => {
                  setShowNewActivityForm(false);
                  setNewActivityType({ nombre: '', descripcion: '' });
                }}
                className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Lista de tipos */}
        <div className="space-y-2">
          {activityTypes.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">
              No hay tipos de trámite registrados
            </p>
          ) : (
            activityTypes.map((type) => (
              <div
                key={type.id}
                className={`border ${type.activo ? 'border-gray-200 dark:border-gray-700' : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10'} rounded-lg p-4`}
              >
                {editingActivityType === type.id ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Nombre *
                      </label>
                      <input
                        type="text"
                        value={editActivityData.nombre}
                        onChange={(e) => setEditActivityData({ ...editActivityData, nombre: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Descripción
                      </label>
                      <input
                        type="text"
                        value={editActivityData.descripcion}
                        onChange={(e) => setEditActivityData({ ...editActivityData, descripcion: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditActivityType(type.id)}
                        disabled={loading}
                        className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm flex items-center gap-2 disabled:opacity-50"
                      >
                        <Save className="w-4 h-4" />
                        Guardar
                      </button>
                      <button
                        onClick={() => setEditingActivityType(null)}
                        className="px-3 py-1.5 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors text-sm"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {type.nombre}
                        {!type.activo && (
                          <span className="ml-2 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-2 py-1 rounded">
                            Inactivo
                          </span>
                        )}
                      </h3>
                      {type.descripcion && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {type.descripcion}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingActivityType(type.id);
                          setEditActivityData({ nombre: type.nombre, descripcion: type.descripcion || '' });
                        }}
                        className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleToggleActivityType(type.id, type.activo)}
                        className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                          type.activo
                            ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-200 dark:hover:bg-yellow-900/50'
                            : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                        }`}
                        title={type.activo ? 'Desactivar' : 'Activar'}
                      >
                        {type.activo ? 'Desactivar' : 'Activar'}
                      </button>
                      <button
                        onClick={() => handleDeleteActivityType(type.id)}
                        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* ========== TIPOS DE SEGURO ========== */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-green-600" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Tipos de Seguro
            </h2>
          </div>
          <button
            onClick={() => setShowNewInsuranceForm(!showNewInsuranceForm)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Nuevo Tipo
          </button>
        </div>

        {/* Formulario para nuevo tipo */}
        {showNewInsuranceForm && (
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-4 space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nombre *
              </label>
              <input
                type="text"
                value={newInsuranceType.nombre}
                onChange={(e) => setNewInsuranceType({ ...newInsuranceType, nombre: e.target.value })}
                placeholder="Ej: Auto"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Descripción
              </label>
              <input
                type="text"
                value={newInsuranceType.descripcion}
                onChange={(e) => setNewInsuranceType({ ...newInsuranceType, descripcion: e.target.value })}
                placeholder="Descripción opcional"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCreateInsuranceType}
                disabled={loading}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                Guardar
              </button>
              <button
                onClick={() => {
                  setShowNewInsuranceForm(false);
                  setNewInsuranceType({ nombre: '', descripcion: '' });
                }}
                className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Lista de tipos */}
        <div className="space-y-2">
          {insuranceTypes.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">
              No hay tipos de seguro registrados
            </p>
          ) : (
            insuranceTypes.map((type) => (
              <div
                key={type.id}
                className={`border ${type.activo ? 'border-gray-200 dark:border-gray-700' : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10'} rounded-lg p-4`}
              >
                {editingInsuranceType === type.id ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Nombre *
                      </label>
                      <input
                        type="text"
                        value={editInsuranceData.nombre}
                        onChange={(e) => setEditInsuranceData({ ...editInsuranceData, nombre: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Descripción
                      </label>
                      <input
                        type="text"
                        value={editInsuranceData.descripcion}
                        onChange={(e) => setEditInsuranceData({ ...editInsuranceData, descripcion: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditInsuranceType(type.id)}
                        disabled={loading}
                        className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm flex items-center gap-2 disabled:opacity-50"
                      >
                        <Save className="w-4 h-4" />
                        Guardar
                      </button>
                      <button
                        onClick={() => setEditingInsuranceType(null)}
                        className="px-3 py-1.5 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors text-sm"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {type.nombre}
                        {!type.activo && (
                          <span className="ml-2 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-2 py-1 rounded">
                            Inactivo
                          </span>
                        )}
                      </h3>
                      {type.descripcion && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {type.descripcion}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingInsuranceType(type.id);
                          setEditInsuranceData({ nombre: type.nombre, descripcion: type.descripcion || '' });
                        }}
                        className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleToggleInsuranceType(type.id, type.activo)}
                        className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                          type.activo
                            ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-200 dark:hover:bg-yellow-900/50'
                            : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                        }`}
                        title={type.activo ? 'Desactivar' : 'Activar'}
                      >
                        {type.activo ? 'Desactivar' : 'Activar'}
                      </button>
                      <button
                        onClick={() => handleDeleteInsuranceType(type.id)}
                        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
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
  );
}
