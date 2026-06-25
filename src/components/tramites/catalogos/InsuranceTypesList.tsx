import { useState, useEffect } from 'react';
import { Plus, Save, Pencil, Trash2, Shield, Search } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { InsuranceType } from './types';

interface Props {
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export function InsuranceTypesList({ showToast }: Props) {
  const [insuranceTypes, setInsuranceTypes] = useState<InsuranceType[]>([]);
  const [editingInsType, setEditingInsType] = useState<string | null>(null);
  const [newInsType, setNewInsType] = useState({ nombre: '', descripcion: '' });
  const [editInsData, setEditInsData] = useState({ nombre: '', descripcion: '' });
  const [showNewInsForm, setShowNewInsForm] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    const { data } = await supabase.from('insurance_types').select('*').order('nombre');
    if (data) setInsuranceTypes(data);
  };

  const filtered = search.trim()
    ? insuranceTypes.filter(t =>
        t.nombre.toLowerCase().includes(search.toLowerCase()) ||
        (t.descripcion || '').toLowerCase().includes(search.toLowerCase())
      )
    : insuranceTypes;

  const handleCreate = async () => {
    if (!newInsType.nombre.trim()) { showToast('El nombre es obligatorio', 'error'); return; }
    const { error } = await supabase.from('insurance_types').insert({
      nombre: newInsType.nombre.trim(), descripcion: newInsType.descripcion.trim() || null, activo: true,
    });
    if (error) { showToast('Error: ' + error.message, 'error'); return; }
    showToast('Tipo de seguro creado');
    setNewInsType({ nombre: '', descripcion: '' });
    setShowNewInsForm(false);
    await load();
  };

  const handleEdit = async (id: string) => {
    if (!editInsData.nombre.trim()) { showToast('El nombre es obligatorio', 'error'); return; }
    const { error } = await supabase.from('insurance_types').update({
      nombre: editInsData.nombre.trim(), descripcion: editInsData.descripcion.trim() || null,
    }).eq('id', id);
    if (error) { showToast('Error: ' + error.message, 'error'); return; }
    showToast('Tipo de seguro actualizado');
    setEditingInsType(null);
    await load();
  };

  const handleToggle = async (id: string, current: boolean) => {
    await supabase.from('insurance_types').update({ activo: !current }).eq('id', id);
    await load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este tipo de seguro?')) return;
    await supabase.from('insurance_types').delete().eq('id', id);
    await load();
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-green-600" />
          <h2 className="text-xl font-bold text-neutral-900">Tipos de Seguro</h2>
        </div>
        <button
          onClick={() => setShowNewInsForm(!showNewInsForm)}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 text-sm"
        >
          <Plus className="w-4 h-4" />
          Nuevo Tipo
        </button>
      </div>

      {insuranceTypes.length > 4 && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar tipo de seguro..."
            className="w-full pl-9 pr-3 py-2 border border-neutral-200 rounded-lg text-sm focus:ring-2 focus:ring-green-400 focus:outline-none"
          />
        </div>
      )}

      {showNewInsForm && (
        <div className="bg-neutral-50 rounded-lg p-4 mb-4 space-y-3 border border-neutral-200">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Nombre *</label>
            <input
              type="text"
              value={newInsType.nombre}
              onChange={(e) => setNewInsType({ ...newInsType, nombre: e.target.value })}
              placeholder="Ej: Auto"
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Descripción</label>
            <input
              type="text"
              value={newInsType.descripcion}
              onChange={(e) => setNewInsType({ ...newInsType, descripcion: e.target.value })}
              placeholder="Descripción opcional"
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 text-sm">
              <Save className="w-4 h-4" />Guardar
            </button>
            <button
              onClick={() => { setShowNewInsForm(false); setNewInsType({ nombre: '', descripcion: '' }); }}
              className="px-4 py-2 bg-neutral-200 text-neutral-700 rounded-lg hover:bg-neutral-300 transition-colors text-sm"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <p className="text-neutral-500 text-center py-8">
            {search ? 'Sin resultados para esa búsqueda' : 'No hay tipos de seguro registrados'}
          </p>
        ) : filtered.map(type => (
          <div key={type.id} className={`border rounded-lg p-4 ${type.activo ? 'border-neutral-200' : 'border-red-200 bg-red-50'}`}>
            {editingInsType === type.id ? (
              <div className="space-y-3">
                <input
                  type="text"
                  value={editInsData.nombre}
                  onChange={(e) => setEditInsData({ ...editInsData, nombre: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
                />
                <input
                  type="text"
                  value={editInsData.descripcion}
                  onChange={(e) => setEditInsData({ ...editInsData, descripcion: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
                />
                <div className="flex gap-2">
                  <button onClick={() => handleEdit(type.id)}
                    className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm flex items-center gap-2">
                    <Save className="w-4 h-4" />Guardar
                  </button>
                  <button onClick={() => setEditingInsType(null)}
                    className="px-3 py-1.5 bg-neutral-200 text-neutral-700 rounded-lg text-sm">
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-neutral-900">
                    {type.nombre}
                    {!type.activo && <span className="ml-2 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">Inactivo</span>}
                  </h3>
                  {type.descripcion && <p className="text-sm text-neutral-600 mt-0.5">{type.descripcion}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setEditingInsType(type.id); setEditInsData({ nombre: type.nombre, descripcion: type.descripcion || '' }); }}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleToggle(type.id, type.activo)}
                    className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${type.activo ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
                  >
                    {type.activo ? 'Desactivar' : 'Activar'}
                  </button>
                  <button onClick={() => handleDelete(type.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
