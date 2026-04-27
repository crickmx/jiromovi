import { useState, useEffect } from 'react';
import { Plus, CreditCard as Edit2, Trash2, Save, Shield } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

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
      const { data, error: fetchError } = await supabase
        .from('insurance_types')
        .select('*')
        .order('nombre');

      if (fetchError) throw fetchError;
      if (data) setInsuranceTypes(data);
    } catch (err: any) {
      setError('Error al cargar catálogos');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

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
      <div className="bg-white rounded-xl shadow-sm p-6">
        <p className="text-neutral-600">
          Solo los administradores pueden gestionar catálogos.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-700 text-sm">{success}</p>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-green-600" />
            <h2 className="text-xl font-bold text-neutral-900">
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

        {showNewInsuranceForm && (
          <div className="bg-neutral-50 rounded-lg p-4 mb-4 space-y-3">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Nombre *
              </label>
              <input
                type="text"
                value={newInsuranceType.nombre}
                onChange={(e) => setNewInsuranceType({ ...newInsuranceType, nombre: e.target.value })}
                placeholder="Ej: Auto"
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Descripción
              </label>
              <input
                type="text"
                value={newInsuranceType.descripcion}
                onChange={(e) => setNewInsuranceType({ ...newInsuranceType, descripcion: e.target.value })}
                placeholder="Descripción opcional"
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-green-500"
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
                className="px-4 py-2 bg-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-400 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {insuranceTypes.length === 0 ? (
            <p className="text-neutral-500 text-center py-8">
              No hay tipos de seguro registrados
            </p>
          ) : (
            insuranceTypes.map((type) => (
              <div
                key={type.id}
                className={`border ${type.activo ? 'border-neutral-200' : 'border-red-200 bg-red-50'} rounded-lg p-4`}
              >
                {editingInsuranceType === type.id ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">
                        Nombre *
                      </label>
                      <input
                        type="text"
                        value={editInsuranceData.nombre}
                        onChange={(e) => setEditInsuranceData({ ...editInsuranceData, nombre: e.target.value })}
                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">
                        Descripción
                      </label>
                      <input
                        type="text"
                        value={editInsuranceData.descripcion}
                        onChange={(e) => setEditInsuranceData({ ...editInsuranceData, descripcion: e.target.value })}
                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-green-500"
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
                        className="px-3 py-1.5 bg-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-400 transition-colors text-sm"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-neutral-900">
                        {type.nombre}
                        {!type.activo && (
                          <span className="ml-2 text-xs bg-red-100 text-red-700 px-2 py-1 rounded">
                            Inactivo
                          </span>
                        )}
                      </h3>
                      {type.descripcion && (
                        <p className="text-sm text-neutral-600 mt-1">
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
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleToggleInsuranceType(type.id, type.activo)}
                        className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                          type.activo
                            ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                            : 'bg-green-100 text-green-700 hover:bg-green-200'
                        }`}
                        title={type.activo ? 'Desactivar' : 'Activar'}
                      >
                        {type.activo ? 'Desactivar' : 'Activar'}
                      </button>
                      <button
                        onClick={() => handleDeleteInsuranceType(type.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
