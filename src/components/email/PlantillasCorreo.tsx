import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Edit2, Eye, Trash2, X, Save } from 'lucide-react';

interface Plantilla {
  id: string;
  nombre: string;
  tipo: 'bienvenida' | 'actualizacion_password' | 'cumpleanos' | 'aniversario' | 'notificaciones_internas';
  asunto: string;
  cuerpo_html: string;
  activo: boolean;
  envio_automatico: boolean;
  hora_envio: string;
}

export function PlantillasCorreo() {
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [editingPlantilla, setEditingPlantilla] = useState<Plantilla | null>(null);
  const [previewPlantilla, setPreviewPlantilla] = useState<Plantilla | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [formData, setFormData] = useState({
    nombre: '',
    tipo: 'bienvenida' as Plantilla['tipo'],
    asunto: '',
    cuerpo_html: '',
    activo: true,
    envio_automatico: false,
    hora_envio: '08:00:00',
  });

  useEffect(() => {
    loadPlantillas();
  }, []);

  const loadPlantillas = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('plantillas_correo')
      .select('*')
      .order('tipo');

    if (error) {
      console.error('Error loading templates:', error);
    } else {
      setPlantillas(data || []);
    }
    setLoading(false);
  };

  const handleEdit = (plantilla: Plantilla) => {
    setEditingPlantilla(plantilla);
    setFormData({
      nombre: plantilla.nombre,
      tipo: plantilla.tipo,
      asunto: plantilla.asunto,
      cuerpo_html: plantilla.cuerpo_html,
      activo: plantilla.activo,
      envio_automatico: plantilla.envio_automatico,
      hora_envio: plantilla.hora_envio,
    });
    setShowModal(true);
  };

  const handleCreate = () => {
    setEditingPlantilla(null);
    setFormData({
      nombre: '',
      tipo: 'bienvenida',
      asunto: '',
      cuerpo_html: '',
      activo: true,
      envio_automatico: false,
      hora_envio: '08:00:00',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    setMessage(null);
    try {
      if (editingPlantilla) {
        const { error } = await supabase
          .from('plantillas_correo')
          .update({
            ...formData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingPlantilla.id);

        if (error) throw error;
        setMessage({ type: 'success', text: 'Plantilla actualizada correctamente' });
      } else {
        const { error } = await supabase
          .from('plantillas_correo')
          .insert(formData);

        if (error) throw error;
        setMessage({ type: 'success', text: 'Plantilla creada correctamente' });
      }

      setShowModal(false);
      loadPlantillas();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta plantilla?')) return;

    try {
      const { error } = await supabase
        .from('plantillas_correo')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setMessage({ type: 'success', text: 'Plantilla eliminada correctamente' });
      loadPlantillas();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const handlePreview = (plantilla: Plantilla) => {
    setPreviewPlantilla(plantilla);
    setShowPreview(true);
  };

  const getPreviewHtml = () => {
    if (!previewPlantilla) return '';

    const ejemploVariables: Record<string, string> = {
      nombre: 'Juan Pérez',
      apellidos: 'García López',
      puesto: 'Desarrollador Senior',
      empresa: 'Nuestra Empresa',
      anios: '5',
      email: 'juan.perez@empresa.com',
    };

    let html = previewPlantilla.cuerpo_html;
    for (const [key, value] of Object.entries(ejemploVariables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      html = html.replace(regex, value);
    }

    return html;
  };

  const tipoLabels: Record<Plantilla['tipo'], string> = {
    bienvenida: 'Bienvenida',
    actualizacion_password: 'Actualización de contraseña',
    cumpleanos: 'Cumpleaños',
    aniversario: 'Aniversario laboral',
    notificaciones_internas: 'Notificaciones internas',
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div>
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

      <div className="mb-6 flex justify-between items-center">
        <div>
          <p className="text-slate-600">
            Variables disponibles: <code className="px-2 py-1 bg-slate-100 rounded text-sm">{'{{nombre}}'}</code>,{' '}
            <code className="px-2 py-1 bg-slate-100 rounded text-sm">{'{{apellidos}}'}</code>,{' '}
            <code className="px-2 py-1 bg-slate-100 rounded text-sm">{'{{puesto}}'}</code>,{' '}
            <code className="px-2 py-1 bg-slate-100 rounded text-sm">{'{{empresa}}'}</code>,{' '}
            <code className="px-2 py-1 bg-slate-100 rounded text-sm">{'{{anios}}'}</code>
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center space-x-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-medium transition"
        >
          <Plus className="w-5 h-5" />
          <span>Nueva Plantilla</span>
        </button>
      </div>

      <div className="space-y-4">
        {plantillas.map((plantilla) => (
          <div
            key={plantilla.id}
            className={`border rounded-lg p-6 ${
              plantilla.activo ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-50'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h3 className="text-lg font-semibold text-slate-900">{plantilla.nombre}</h3>
                  <span className="px-2 py-1 text-xs font-medium bg-primary-100 text-primary-700 rounded">
                    {tipoLabels[plantilla.tipo]}
                  </span>
                  {plantilla.activo && (
                    <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded">
                      Activo
                    </span>
                  )}
                  {plantilla.envio_automatico && (
                    <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded">
                      Envío automático
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-600 mb-1">
                  <strong>Asunto:</strong> {plantilla.asunto}
                </p>
                {plantilla.envio_automatico && (
                  <p className="text-sm text-slate-600">
                    <strong>Hora de envío:</strong> {plantilla.hora_envio}
                  </p>
                )}
              </div>

              <div className="flex items-center space-x-2 ml-4">
                <button
                  onClick={() => handlePreview(plantilla)}
                  className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
                  title="Vista previa"
                >
                  <Eye className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handleEdit(plantilla)}
                  className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition"
                  title="Editar"
                >
                  <Edit2 className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handleDelete(plantilla.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                  title="Eliminar"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white">
              <h2 className="text-xl font-bold text-slate-900">
                {editingPlantilla ? 'Editar Plantilla' : 'Nueva Plantilla'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Nombre</label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Tipo</label>
                <select
                  value={formData.tipo}
                  onChange={(e) => setFormData({ ...formData, tipo: e.target.value as Plantilla['tipo'] })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="bienvenida">Bienvenida</option>
                  <option value="actualizacion_password">Actualización de contraseña</option>
                  <option value="cumpleanos">Cumpleaños</option>
                  <option value="aniversario">Aniversario laboral</option>
                  <option value="notificaciones_internas">Notificaciones internas</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Asunto</label>
                <input
                  type="text"
                  value={formData.asunto}
                  onChange={(e) => setFormData({ ...formData, asunto: e.target.value })}
                  placeholder="Ej: ¡Bienvenido {{nombre}} a {{empresa}}!"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Cuerpo HTML</label>
                <textarea
                  value={formData.cuerpo_html}
                  onChange={(e) => setFormData({ ...formData, cuerpo_html: e.target.value })}
                  rows={12}
                  placeholder="<h1>Hola {{nombre}}</h1><p>Contenido del correo...</p>"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.activo}
                    onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                    className="w-4 h-4 text-primary-600 rounded"
                  />
                  <span className="text-sm text-slate-700">Plantilla activa</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.envio_automatico}
                    onChange={(e) => setFormData({ ...formData, envio_automatico: e.target.checked })}
                    className="w-4 h-4 text-primary-600 rounded"
                  />
                  <span className="text-sm text-slate-700">Envío automático</span>
                </label>
              </div>

              {formData.envio_automatico && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Hora de envío</label>
                  <input
                    type="time"
                    value={formData.hora_envio}
                    onChange={(e) => setFormData({ ...formData, hora_envio: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-slate-50 rounded-b-2xl flex justify-end space-x-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                className="flex items-center space-x-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition"
              >
                <Save className="w-5 h-5" />
                <span>Guardar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {showPreview && previewPlantilla && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white">
              <h2 className="text-xl font-bold text-slate-900">Vista Previa: {previewPlantilla.nombre}</h2>
              <button onClick={() => setShowPreview(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="mb-4 p-4 bg-slate-50 rounded-lg">
                <p className="text-sm text-slate-600 mb-1">
                  <strong>Asunto:</strong> {previewPlantilla.asunto}
                </p>
              </div>

              <div
                className="border border-slate-200 rounded-lg p-6 bg-white"
                dangerouslySetInnerHTML={{ __html: getPreviewHtml() }}
              />

              <div className="mt-4 p-4 bg-primary-50 border border-primary-200 rounded-lg">
                <p className="text-sm text-primary-800">
                  <strong>Nota:</strong> Esta es una vista previa con datos de ejemplo. Los valores reales se
                  reemplazarán al enviar el correo.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
