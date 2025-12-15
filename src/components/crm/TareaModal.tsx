import { useState } from 'react';
import { X, Flag } from 'lucide-react';
import { crearTarea, actualizarTarea } from '../../lib/crmUtils';
import { useAuth } from '../../contexts/AuthContext';
import type { CRMTarea, EstatusTarea, PrioridadTarea } from '../../lib/crmTypes';

interface Props {
  contactoId?: string;
  tarea?: CRMTarea;
  onClose: () => void;
  onSave: () => void;
}

export default function TareaModal({ contactoId, tarea, onClose, onSave }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    descripcion: tarea?.descripcion || '',
    tipo_actividad: tarea?.tipo_actividad || 'Llamada',
    fecha_vencimiento: tarea?.fecha_vencimiento
      ? new Date(tarea.fecha_vencimiento).toISOString().slice(0, 16)
      : '',
    prioridad: (tarea?.prioridad || 'Media') as PrioridadTarea,
    estatus: (tarea?.estatus || 'Pendiente') as EstatusTarea,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      setLoading(true);

      const data: any = {
        descripcion: formData.descripcion,
        tipo_actividad: formData.tipo_actividad as any,
        fecha_vencimiento: formData.fecha_vencimiento,
        prioridad: formData.prioridad,
        estatus: formData.estatus,
      };

      if (contactoId) {
        data.contacto_id = contactoId;
      }

      if (tarea) {
        await actualizarTarea(tarea.id, data);
      } else {
        await crearTarea(data, user.id);
      }

      onSave();
    } catch (error) {
      console.error('Error:', error);
      alert('Error al guardar tarea');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold text-gray-900">
            {tarea ? 'Editar Tarea' : 'Nueva Tarea'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo de Actividad *
              </label>
              <select
                value={formData.tipo_actividad}
                onChange={(e) => setFormData({ ...formData, tipo_actividad: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                required
              >
                <option value="Llamada">Llamada</option>
                <option value="Email">Email</option>
                <option value="Reunión">Reunión</option>
                <option value="Otro">Otro</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                <Flag className="h-4 w-4" />
                Prioridad *
              </label>
              <select
                value={formData.prioridad}
                onChange={(e) => setFormData({ ...formData, prioridad: e.target.value as PrioridadTarea })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                required
              >
                <option value="Alta">Alta</option>
                <option value="Media">Media</option>
                <option value="Baja">Baja</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Estatus *</label>
            <select
              value={formData.estatus}
              onChange={(e) => setFormData({ ...formData, estatus: e.target.value as EstatusTarea })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              required
            >
              <option value="Pendiente">Pendiente</option>
              <option value="En Proceso">En Proceso</option>
              <option value="Completada">Completada</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción *</label>
            <textarea
              value={formData.descripcion}
              onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              rows={4}
              required
              placeholder="Describe la tarea a realizar..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha y Hora de Vencimiento *
            </label>
            <input
              type="datetime-local"
              value={formData.fecha_vencimiento}
              onChange={(e) => setFormData({ ...formData, fecha_vencimiento: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Guardando...' : 'Guardar Tarea'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
