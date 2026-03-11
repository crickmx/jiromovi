import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Settings, Plus, CreditCard as Edit2, Trash2, Save, X } from 'lucide-react';

interface CatalogItem {
  id: string;
  nombre: string;
  descripcion?: string | null;
  activo: boolean;
}

type CatalogType = 'tramite_activity_types' | 'insurance_types' | 'aseguradoras';

export function ConfiguracionCatalogos() {
  const { usuario } = useAuth();
  const [activeTab, setActiveTab] = useState<CatalogType>('tramite_activity_types');
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [formData, setFormData] = useState({ nombre: '', descripcion: '' });

  const isAdmin = usuario?.rol === 'admin';

  useEffect(() => {
    if (isAdmin) {
      loadItems();
    }
  }, [activeTab, isAdmin]);

  const loadItems = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from(activeTab)
      .select('*')
      .order('nombre');

    if (!error && data) {
      setItems(data);
    }
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!formData.nombre.trim()) return;

    const { error } = await supabase
      .from(activeTab)
      .insert({
        nombre: formData.nombre,
        descripcion: formData.descripcion || null,
        activo: true
      });

    if (!error) {
      setFormData({ nombre: '', descripcion: '' });
      setCreating(false);
      loadItems();
    }
  };

  const handleUpdate = async (id: string) => {
    if (!formData.nombre.trim()) return;

    const { error } = await supabase
      .from(activeTab)
      .update({
        nombre: formData.nombre,
        descripcion: formData.descripcion || null
      })
      .eq('id', id);

    if (!error) {
      setEditing(null);
      setFormData({ nombre: '', descripcion: '' });
      loadItems();
    }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    const { error } = await supabase
      .from(activeTab)
      .update({ activo: !currentActive })
      .eq('id', id);

    if (!error) {
      loadItems();
    }
  };

  const startEdit = (item: CatalogItem) => {
    setEditing(item.id);
    setFormData({ nombre: item.nombre, descripcion: item.descripcion || '' });
  };

  const cancelEdit = () => {
    setEditing(null);
    setCreating(false);
    setFormData({ nombre: '', descripcion: '' });
  };

  const getCatalogTitle = (type: CatalogType) => {
    switch (type) {
      case 'tramite_activity_types':
        return 'Tipos de Trámite';
      case 'insurance_types':
        return 'Tipos de Seguro';
      case 'aseguradoras':
        return 'Aseguradoras';
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Acceso Denegado
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Solo los administradores pueden acceder a esta página
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-soft border border-neutral-200 dark:border-gray-700 p-6">
        <div className="flex items-center gap-3 mb-6">
          <Settings className="w-8 h-8 text-accent" />
          <div>
            <h1 className="text-3xl font-display font-bold text-accent dark:text-white">
              Configuración de Catálogos
            </h1>
            <p className="text-neutral-600 dark:text-gray-400">
              Gestiona los catálogos del módulo Registro de Actividades
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-2 border-b border-neutral-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('tramite_activity_types')}
            className={`px-6 py-3 font-semibold transition-all ${
              activeTab === 'tramite_activity_types'
                ? 'text-accent border-b-2 border-accent dark:text-blue-400'
                : 'text-neutral-600 hover:text-neutral-900 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            Tipos de Trámite
          </button>
          <button
            onClick={() => setActiveTab('insurance_types')}
            className={`px-6 py-3 font-semibold transition-all ${
              activeTab === 'insurance_types'
                ? 'text-accent border-b-2 border-accent dark:text-blue-400'
                : 'text-neutral-600 hover:text-neutral-900 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            Tipos de Seguro
          </button>
          <button
            onClick={() => setActiveTab('aseguradoras')}
            className={`px-6 py-3 font-semibold transition-all ${
              activeTab === 'aseguradoras'
                ? 'text-accent border-b-2 border-accent dark:text-blue-400'
                : 'text-neutral-600 hover:text-neutral-900 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            Aseguradoras
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-soft border border-neutral-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {getCatalogTitle(activeTab)}
          </h2>
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Agregar
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Formulario de creación */}
            {creating && (
              <div className="border-2 border-blue-300 dark:border-blue-700 rounded-lg p-4 bg-blue-50 dark:bg-blue-900/20">
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Nombre"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                  <input
                    type="text"
                    placeholder="Descripción (opcional)"
                    value={formData.descripcion}
                    onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={cancelEdit}
                      className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleCreate}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Save className="w-4 h-4" />
                      Guardar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Lista de items */}
            {items.map((item) => (
              <div
                key={item.id}
                className={`border rounded-lg p-4 transition-colors ${
                  item.activo
                    ? 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                    : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 opacity-60'
                }`}
              >
                {editing === item.id ? (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={formData.nombre}
                      onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                    <input
                      type="text"
                      value={formData.descripcion}
                      onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                      placeholder="Descripción (opcional)"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={cancelEdit}
                        className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleUpdate(item.id)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <Save className="w-4 h-4" />
                        Guardar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {item.nombre}
                      </h3>
                      {item.descripcion && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {item.descripcion}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleActive(item.id, item.activo)}
                        className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                          item.activo
                            ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-300'
                            : 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900 dark:text-red-300'
                        }`}
                      >
                        {item.activo ? 'Activo' : 'Inactivo'}
                      </button>
                      <button
                        onClick={() => startEdit(item)}
                        className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {items.length === 0 && !creating && (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                No hay elementos en este catálogo
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
