import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import {
  crearContacto,
  actualizarContacto,
  obtenerCamposPersonalizados,
  obtenerEtiquetas,
  obtenerFuentesOrigen,
} from '../../lib/crmUtils';
import { useAuth } from '../../contexts/AuthContext';
import type { CRMContacto, CRMCampoPersonalizado, CRMEtiqueta, CRMFuenteOrigen } from '../../lib/crmTypes';

interface Props {
  contacto: CRMContacto | null;
  onClose: () => void;
  onSave: () => void;
}

export default function ContactoModal({ contacto, onClose, onSave }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [camposPersonalizados, setCamposPersonalizados] = useState<CRMCampoPersonalizado[]>([]);
  const [etiquetas, setEtiquetas] = useState<CRMEtiqueta[]>([]);
  const [fuentes, setFuentes] = useState<CRMFuenteOrigen[]>([]);

  const [formData, setFormData] = useState({
    tipo_contacto: 'Persona',
    nombre_completo: '',
    celular: '',
    email: '',
    fecha_nacimiento: '',
    estatus: 'Prospecto',
    fuente_origen: '',
    etiquetas_segmentacion: [] as string[],
    campos_personalizados: {} as Record<string, any>,
  });

  useEffect(() => {
    cargarConfiguracion();
    if (contacto) {
      setFormData({
        tipo_contacto: contacto.tipo_contacto,
        nombre_completo: contacto.nombre_completo,
        celular: contacto.celular,
        email: contacto.email || '',
        fecha_nacimiento: (contacto as any).fecha_nacimiento || '',
        estatus: contacto.estatus,
        fuente_origen: contacto.fuente_origen || '',
        etiquetas_segmentacion: contacto.etiquetas_segmentacion || [],
        campos_personalizados: contacto.campos_personalizados || {},
      });
    }
  }, [contacto]);

  const cargarConfiguracion = async () => {
    try {
      const [campos, etiq, fuent] = await Promise.all([
        obtenerCamposPersonalizados(),
        obtenerEtiquetas(),
        obtenerFuentesOrigen(),
      ]);
      setCamposPersonalizados(campos);
      setEtiquetas(etiq);
      setFuentes(fuent);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      setLoading(true);
      if (contacto) {
        await actualizarContacto(contacto.id, formData);
      } else {
        await crearContacto(formData, user.id);
      }
      onSave();
    } catch (error) {
      console.error('Error:', error);
      alert('Error al guardar contacto');
    } finally {
      setLoading(false);
    }
  };

  const toggleEtiqueta = (etiqueta: string) => {
    setFormData((prev) => ({
      ...prev,
      etiquetas_segmentacion: prev.etiquetas_segmentacion.includes(etiqueta)
        ? prev.etiquetas_segmentacion.filter((e) => e !== etiqueta)
        : [...prev.etiquetas_segmentacion, etiqueta],
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white">
          <h2 className="text-xl font-bold text-gray-900">
            {contacto ? 'Editar Contacto' : 'Nuevo Contacto'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo de Contacto *
              </label>
              <select
                value={formData.tipo_contacto}
                onChange={(e) => setFormData({ ...formData, tipo_contacto: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="Persona">Persona</option>
                <option value="Empresa">Empresa</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estatus *</label>
              <select
                value={formData.estatus}
                onChange={(e) => setFormData({ ...formData, estatus: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="Prospecto">Prospecto</option>
                <option value="Cotización Presentada">Cotización Presentada</option>
                <option value="Negociación">Negociación</option>
                <option value="Cliente">Cliente</option>
                <option value="Perdido">Perdido</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre Completo *
            </label>
            <input
              type="text"
              value={formData.nombre_completo}
              onChange={(e) => setFormData({ ...formData, nombre_completo: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Celular *</label>
              <input
                type="tel"
                value={formData.celular}
                onChange={(e) => setFormData({ ...formData, celular: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {formData.tipo_contacto === 'Persona' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha de Nacimiento
              </label>
              <input
                type="date"
                value={formData.fecha_nacimiento}
                onChange={(e) => setFormData({ ...formData, fecha_nacimiento: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                max={new Date().toISOString().split('T')[0]}
              />
              <p className="text-xs text-gray-500 mt-1">
                📅 Se generará un recordatorio automático en tu calendario el día del cumpleaños
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fuente de Origen</label>
            <select
              value={formData.fuente_origen}
              onChange={(e) => setFormData({ ...formData, fuente_origen: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Seleccionar...</option>
              {fuentes.map((f) => (
                <option key={f.id} value={f.nombre}>
                  {f.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Etiquetas de Segmentación
            </label>
            <div className="flex flex-wrap gap-2">
              {etiquetas.map((etiqueta) => (
                <button
                  key={etiqueta.id}
                  type="button"
                  onClick={() => toggleEtiqueta(etiqueta.nombre)}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition ${
                    formData.etiquetas_segmentacion.includes(etiqueta.nombre)
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {etiqueta.nombre}
                </button>
              ))}
            </div>
          </div>

          {camposPersonalizados.length > 0 && (
            <div className="pt-4 border-t">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Campos Personalizados</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {camposPersonalizados.map((campo) => (
                  <div key={campo.id}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {campo.etiqueta} {campo.requerido && '*'}
                    </label>
                    {campo.tipo_campo === 'Texto' && (
                      <input
                        type="text"
                        value={formData.campos_personalizados[campo.nombre_campo] || ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            campos_personalizados: {
                              ...formData.campos_personalizados,
                              [campo.nombre_campo]: e.target.value,
                            },
                          })
                        }
                        required={campo.requerido}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    )}
                    {campo.tipo_campo === 'Número' && (
                      <input
                        type="number"
                        value={formData.campos_personalizados[campo.nombre_campo] || ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            campos_personalizados: {
                              ...formData.campos_personalizados,
                              [campo.nombre_campo]: e.target.value,
                            },
                          })
                        }
                        required={campo.requerido}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    )}
                    {campo.tipo_campo === 'Fecha' && (
                      <input
                        type="date"
                        value={formData.campos_personalizados[campo.nombre_campo] || ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            campos_personalizados: {
                              ...formData.campos_personalizados,
                              [campo.nombre_campo]: e.target.value,
                            },
                          })
                        }
                        required={campo.requerido}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    )}
                    {campo.tipo_campo === 'Selector' && (
                      <select
                        value={formData.campos_personalizados[campo.nombre_campo] || ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            campos_personalizados: {
                              ...formData.campos_personalizados,
                              [campo.nombre_campo]: e.target.value,
                            },
                          })
                        }
                        required={campo.requerido}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Seleccionar...</option>
                        {campo.opciones_selector.map((opcion) => (
                          <option key={opcion} value={opcion}>
                            {opcion}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

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
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
