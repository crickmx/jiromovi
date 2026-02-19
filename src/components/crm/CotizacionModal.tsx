import { useState } from 'react';
import { X, Upload, Download, ExternalLink } from 'lucide-react';
import { crearCotizacion, actualizarCotizacion, subirArchivoCRM, descargarArchivoCRM, abrirArchivoCRM } from '../../lib/crmUtils';
import { useAuth } from '../../contexts/AuthContext';
import type { CRMCotizacion } from '../../lib/crmTypes';

interface Props {
  contactoId: string;
  cotizacion?: CRMCotizacion;
  onClose: () => void;
  onSave: () => void;
}

export default function CotizacionModal({ contactoId, cotizacion, onClose, onSave }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [archivo, setArchivo] = useState<File | null>(null);

  const [formData, setFormData] = useState({
    nombre_documento: cotizacion?.nombre_documento || '',
    fecha_presentacion: cotizacion?.fecha_presentacion || new Date().toISOString().split('T')[0],
    estatus_cotizacion: cotizacion?.estatus_cotizacion || 'Nueva',
    monto_cotizado: cotizacion?.monto_cotizado?.toString() || '',
    observaciones: cotizacion?.observaciones || '',
  });

  const handleArchivoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        alert('Solo se permiten archivos PDF');
        return;
      }
      setArchivo(file);
      if (!formData.nombre_documento) {
        setFormData({ ...formData, nombre_documento: file.name });
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      setLoading(true);

      let archivoUrl = cotizacion?.archivo_url;

      if (archivo) {
        const timestamp = Date.now();
        const path = `cotizaciones/${contactoId}/${timestamp}_${archivo.name}`;
        await subirArchivoCRM(archivo, path);
        archivoUrl = path;
      }

      const data = {
        contacto_id: contactoId,
        nombre_documento: formData.nombre_documento,
        fecha_presentacion: formData.fecha_presentacion,
        estatus_cotizacion: formData.estatus_cotizacion as any,
        monto_cotizado: formData.monto_cotizado ? parseFloat(formData.monto_cotizado) : undefined,
        observaciones: formData.observaciones || undefined,
        archivo_url: archivoUrl,
      };

      if (cotizacion) {
        await actualizarCotizacion(cotizacion.id, data);
      } else {
        await crearCotizacion(data, user.id);
      }

      onSave();
    } catch (error) {
      console.error('Error:', error);
      alert('Error al guardar cotización');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white">
          <h2 className="text-xl font-bold text-gray-900">
            {cotizacion ? 'Editar Cotización' : 'Nueva Cotización'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre del Documento *
            </label>
            <input
              type="text"
              value={formData.nombre_documento}
              onChange={(e) => setFormData({ ...formData, nombre_documento: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha de Presentación *
              </label>
              <input
                type="date"
                value={formData.fecha_presentacion}
                onChange={(e) => setFormData({ ...formData, fecha_presentacion: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estatus *</label>
              <select
                value={formData.estatus_cotizacion}
                onChange={(e) => setFormData({ ...formData, estatus_cotizacion: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="Nueva">Nueva</option>
                <option value="Pendiente de Seguimiento">Pendiente de Seguimiento</option>
                <option value="Aprobada">Aprobada</option>
                <option value="Rechazada/Perdida">Rechazada/Perdida</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Monto Cotizado
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.monto_cotizado}
              onChange={(e) => setFormData({ ...formData, monto_cotizado: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
            <textarea
              value={formData.observaciones}
              onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Archivo PDF {!cotizacion && '*'}
            </label>
            <div className="mt-1 flex items-center gap-3">
              <label className="flex-1 cursor-pointer">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-accent transition">
                  <div className="flex items-center justify-center gap-2 text-gray-600">
                    <Upload className="h-5 w-5" />
                    <span className="text-sm">
                      {archivo ? archivo.name : 'Seleccionar archivo PDF'}
                    </span>
                  </div>
                </div>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleArchivoChange}
                  className="hidden"
                  required={!cotizacion}
                />
              </label>
            </div>
            {cotizacion?.archivo_url && !archivo && (
              <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-700 truncate flex-1">
                    {cotizacion.archivo_url.split('/').pop()}
                  </p>
                  <div className="flex items-center gap-2 ml-3">
                    <button
                      type="button"
                      onClick={() => abrirArchivoCRM(cotizacion.archivo_url!)}
                      className="text-accent hover:text-primary-800 p-1.5 hover:bg-primary-50 rounded transition"
                      title="Abrir en nueva pestaña"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => descargarArchivoCRM(cotizacion.archivo_url!, cotizacion.nombre_documento + '.pdf')}
                      className="text-green-600 hover:text-green-800 p-1.5 hover:bg-green-50 rounded transition"
                      title="Descargar"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
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
              className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Guardando...' : 'Guardar Cotización'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
