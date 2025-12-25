import { useState } from 'react';
import { X, Upload, Download, ExternalLink } from 'lucide-react';
import { crearPoliza, actualizarPoliza, subirArchivoCRM, descargarArchivoCRM, abrirArchivoCRM } from '../../lib/crmUtils';
import { useAuth } from '../../contexts/AuthContext';
import type { CRMPoliza } from '../../lib/crmTypes';

interface Props {
  contactoId: string;
  poliza?: CRMPoliza;
  onClose: () => void;
  onSave: () => void;
}

export default function PolizaModal({ contactoId, poliza, onClose, onSave }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [archivo, setArchivo] = useState<File | null>(null);

  const [formData, setFormData] = useState({
    numero_poliza: poliza?.numero_poliza || '',
    tipo_ramo: poliza?.tipo_ramo || '',
    compania_aseguradora: poliza?.compania_aseguradora || '',
    fecha_emision: poliza?.fecha_emision || new Date().toISOString().split('T')[0],
    fecha_vencimiento: poliza?.fecha_vencimiento || '',
    prima_total: poliza?.prima_total?.toString() || '',
    observaciones: poliza?.observaciones || '',
  });

  const tiposRamo = [
    'Autos',
    'Vida',
    'GMM (Gastos Médicos Mayores)',
    'Daños',
    'Responsabilidad Civil',
    'Transporte',
    'Hogar',
    'Empresarial',
    'Otro',
  ];

  const handleArchivoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        alert('Solo se permiten archivos PDF');
        return;
      }
      setArchivo(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      setLoading(true);

      let archivoUrl = poliza?.archivo_url;

      if (archivo) {
        const timestamp = Date.now();
        const path = `polizas/${contactoId}/${timestamp}_${archivo.name}`;
        await subirArchivoCRM(archivo, path);
        archivoUrl = path;
      }

      const data = {
        contacto_id: contactoId,
        numero_poliza: formData.numero_poliza,
        tipo_ramo: formData.tipo_ramo,
        compania_aseguradora: formData.compania_aseguradora,
        fecha_emision: formData.fecha_emision,
        fecha_vencimiento: formData.fecha_vencimiento,
        prima_total: parseFloat(formData.prima_total),
        observaciones: formData.observaciones || undefined,
        archivo_url: archivoUrl,
      };

      if (poliza) {
        await actualizarPoliza(poliza.id, data);
      } else {
        await crearPoliza(data, user.id);
      }

      onSave();
    } catch (error) {
      console.error('Error:', error);
      alert('Error al guardar póliza');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white">
          <h2 className="text-xl font-bold text-gray-900">
            {poliza ? 'Editar Póliza' : 'Nueva Póliza'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Número de Póliza *
              </label>
              <input
                type="text"
                value={formData.numero_poliza}
                onChange={(e) => setFormData({ ...formData, numero_poliza: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Ramo *</label>
              <select
                value={formData.tipo_ramo}
                onChange={(e) => setFormData({ ...formData, tipo_ramo: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Seleccionar...</option>
                {tiposRamo.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {tipo}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Compañía Aseguradora *
            </label>
            <input
              type="text"
              value={formData.compania_aseguradora}
              onChange={(e) => setFormData({ ...formData, compania_aseguradora: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha de Emisión *
              </label>
              <input
                type="date"
                value={formData.fecha_emision}
                onChange={(e) => setFormData({ ...formData, fecha_emision: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha de Vencimiento *
              </label>
              <input
                type="date"
                value={formData.fecha_vencimiento}
                onChange={(e) => setFormData({ ...formData, fecha_vencimiento: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Prima Total *</label>
            <input
              type="number"
              step="0.01"
              value={formData.prima_total}
              onChange={(e) => setFormData({ ...formData, prima_total: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="0.00"
              required
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Archivo PDF</label>
            <div className="mt-1 flex items-center gap-3">
              <label className="flex-1 cursor-pointer">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-primary-500 transition">
                  <div className="flex items-center justify-center gap-2 text-gray-600">
                    <Upload className="h-5 w-5" />
                    <span className="text-sm">
                      {archivo ? archivo.name : 'Seleccionar archivo PDF (opcional)'}
                    </span>
                  </div>
                </div>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleArchivoChange}
                  className="hidden"
                />
              </label>
            </div>
            {poliza?.archivo_url && !archivo && (
              <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-700 truncate flex-1">
                    {poliza.archivo_url.split('/').pop()}
                  </p>
                  <div className="flex items-center gap-2 ml-3">
                    <button
                      type="button"
                      onClick={() => abrirArchivoCRM(poliza.archivo_url!)}
                      className="text-primary-600 hover:text-primary-800 p-1.5 hover:bg-primary-50 rounded transition"
                      title="Abrir en nueva pestaña"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => descargarArchivoCRM(poliza.archivo_url!, `Poliza_${poliza.numero_poliza}.pdf`)}
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
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Guardando...' : 'Guardar Póliza'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
