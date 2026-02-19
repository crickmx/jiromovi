import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Edit, Trash2, X, Clock } from 'lucide-react';
import { DIAS_SEMANA, DIAS_SEMANA_LABELS, DISPONIBILIDAD_DEFAULT, type DisponibilidadSemanal } from '../lib/espacioJiroUtils';
import type { Database } from '../lib/database.types';

type Area = Database['public']['Tables']['areas']['Row'];

interface AreasManagerProps {
  oficinaId: string;
  oficinaNombre: string;
  onClose: () => void;
}

export function AreasManager({ oficinaId, oficinaNombre, onClose }: AreasManagerProps) {
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedArea, setSelectedArea] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    nombre: '',
    detalles: '',
    disponibilidad_semanal: DISPONIBILIDAD_DEFAULT as DisponibilidadSemanal,
  });

  useEffect(() => {
    loadAreas();
  }, [oficinaId]);

  const loadAreas = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('areas')
      .select('*')
      .eq('oficina_id', oficinaId)
      .order('nombre');

    if (error) {
      console.error('Error loading areas:', error);
    } else {
      setAreas(data || []);
    }
    setLoading(false);
  };

  const openModal = (area: Area | null = null) => {
    setSelectedArea(area);
    if (area) {
      setFormData({
        nombre: area.nombre,
        detalles: area.detalles || '',
        disponibilidad_semanal: (area.disponibilidad_semanal as unknown as DisponibilidadSemanal) || DISPONIBILIDAD_DEFAULT,
      });
    } else {
      setFormData({
        nombre: '',
        detalles: '',
        disponibilidad_semanal: DISPONIBILIDAD_DEFAULT,
      });
    }
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (selectedArea) {
        const { error } = await supabase
          .from('areas')
          .update({
            nombre: formData.nombre,
            detalles: formData.detalles,
            disponibilidad_semanal: formData.disponibilidad_semanal as any,
            updated_at: new Date().toISOString(),
          })
          .eq('id', selectedArea.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('areas')
          .insert({
            oficina_id: oficinaId,
            nombre: formData.nombre,
            detalles: formData.detalles,
            disponibilidad_semanal: formData.disponibilidad_semanal as any,
            activo: true,
          });

        if (error) throw error;
      }

      setModalOpen(false);
      loadAreas();
    } catch (error: any) {
      console.error('Error saving area:', error);
      alert('Error al guardar: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (areaId: string) => {
    if (!confirm('¿Eliminar esta área? Se eliminarán todas las reservas asociadas.')) return;

    const { error } = await supabase
      .from('areas')
      .delete()
      .eq('id', areaId);

    if (error) {
      console.error('Error deleting area:', error);
      alert('Error al eliminar: ' + error.message);
    } else {
      loadAreas();
    }
  };

  const agregarFranja = (dia: keyof DisponibilidadSemanal) => {
    const nuevaDisponibilidad = { ...formData.disponibilidad_semanal };
    nuevaDisponibilidad[dia] = [...nuevaDisponibilidad[dia], { inicio: '09:00', fin: '18:00' }];
    setFormData({ ...formData, disponibilidad_semanal: nuevaDisponibilidad });
  };

  const eliminarFranja = (dia: keyof DisponibilidadSemanal, index: number) => {
    const nuevaDisponibilidad = { ...formData.disponibilidad_semanal };
    nuevaDisponibilidad[dia] = nuevaDisponibilidad[dia].filter((_, i) => i !== index);
    setFormData({ ...formData, disponibilidad_semanal: nuevaDisponibilidad });
  };

  const actualizarFranja = (
    dia: keyof DisponibilidadSemanal,
    index: number,
    campo: 'inicio' | 'fin',
    valor: string
  ) => {
    const nuevaDisponibilidad = { ...formData.disponibilidad_semanal };
    nuevaDisponibilidad[dia][index][campo] = valor;
    setFormData({ ...formData, disponibilidad_semanal: nuevaDisponibilidad });
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl max-w-5xl w-full my-8 flex flex-col max-h-[85vh]">
        <div className="flex-shrink-0 border-b border-slate-200 px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Áreas de {oficinaNombre}</h2>
            <p className="text-sm text-slate-600">Gestiona las áreas reservables del Espacio JIRO</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="mb-6">
            <button
              onClick={() => openModal(null)}
              className="flex items-center space-x-2 bg-accent text-white px-4 py-2 rounded-lg hover:bg-accent-hover transition"
            >
              <Plus className="w-5 h-5" />
              <span>Nueva Área</span>
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : areas.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <p>No hay áreas registradas</p>
              <p className="text-sm mt-2">Crea la primera área para este Espacio JIRO</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {areas.map((area) => (
                <div key={area.id} className="border border-slate-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-bold text-slate-900">{area.nombre}</h3>
                      {area.detalles && (
                        <p className="text-sm text-slate-600 mt-1">{area.detalles}</p>
                      )}
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => openModal(area)}
                        className="text-accent hover:bg-primary-50 p-2 rounded transition"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(area.id)}
                        className="text-red-600 hover:bg-red-50 p-2 rounded transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="text-xs text-slate-600 space-y-1">
                    {DIAS_SEMANA.map((dia) => {
                      const disponibilidad = area.disponibilidad_semanal as unknown as DisponibilidadSemanal;
                      const franjas = disponibilidad[dia] || [];
                      if (franjas.length === 0) return null;
                      return (
                        <div key={dia} className="flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          <strong className="mr-1">{DIAS_SEMANA_LABELS[dia]}:</strong>
                          {franjas.map((f, i) => (
                            <span key={i} className="mr-2">
                              {f.inicio}-{f.fin}
                            </span>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center z-[60] p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full my-8 flex flex-col max-h-[85vh]">
            <div className="flex-shrink-0 border-b border-slate-200 px-6 py-4 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-800">
                {selectedArea ? 'Editar Área' : 'Nueva Área'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              <form id="area-form" onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Nombre del Área <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: Sala de Juntas A"
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Detalles / Descripción
                </label>
                <textarea
                  value={formData.detalles}
                  onChange={(e) => setFormData({ ...formData, detalles: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Capacidad, amenidades, equipamiento, etc."
                />
              </div>

              <div className="mb-6">
                <h4 className="text-sm font-medium text-slate-700 mb-3">
                  Disponibilidad Semanal (Formato 24h)
                </h4>
                <div className="space-y-4">
                  {DIAS_SEMANA.map((dia) => (
                    <div key={dia} className="border border-slate-200 rounded-lg p-4">
                      <div className="flex justify-between items-center mb-3">
                        <label className="text-sm font-medium text-slate-700">
                          {DIAS_SEMANA_LABELS[dia]}
                        </label>
                        <button
                          type="button"
                          onClick={() => agregarFranja(dia)}
                          className="flex items-center space-x-1 text-xs text-accent hover:text-primary-700"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Agregar horario</span>
                        </button>
                      </div>
                      <div className="space-y-2">
                        {formData.disponibilidad_semanal[dia].map((franja, index) => (
                          <div key={index} className="flex items-center space-x-2">
                            <input
                              type="time"
                              value={franja.inicio}
                              onChange={(e) => actualizarFranja(dia, index, 'inicio', e.target.value)}
                              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <span className="text-slate-600">a</span>
                            <input
                              type="time"
                              value={franja.fin}
                              onChange={(e) => actualizarFranja(dia, index, 'fin', e.target.value)}
                              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <button
                              type="button"
                              onClick={() => eliminarFranja(dia, index)}
                              className="text-red-600 hover:bg-red-50 p-2 rounded transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                        {formData.disponibilidad_semanal[dia].length === 0 && (
                          <p className="text-sm text-slate-500 italic">No disponible este día</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              </form>
            </div>
            <div className="flex-shrink-0 border-t border-slate-200 px-6 py-4">
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  form="area-form"
                  disabled={saving}
                  className="px-6 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition disabled:opacity-50"
                >
                  {saving ? 'Guardando...' : selectedArea ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
