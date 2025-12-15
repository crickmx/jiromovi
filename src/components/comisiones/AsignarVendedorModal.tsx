import { useState, useEffect } from 'react';
import { X, Mail, User, Search, FileText, TrendingUp, Save, Check } from 'lucide-react';
import { asignarVendedorManualmente, obtenerUsuariosMOVI } from '../../lib/vendorMappingUtils';
import type { UnmatchedVendor } from '../../lib/vendorMappingTypes';
import { useAuth } from '../../contexts/AuthContext';

interface Props {
  batchId: string;
  vendor: UnmatchedVendor;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AsignarVendedorModal({ batchId, vendor, onClose, onSuccess }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState<string | null>(null);
  const [guardarMapeo, setGuardarMapeo] = useState(true);
  const [mostrarLista, setMostrarLista] = useState(false);

  useEffect(() => {
    cargarUsuarios();
  }, []);

  const cargarUsuarios = async () => {
    try {
      const data = await obtenerUsuariosMOVI();
      setUsuarios(data || []);
    } catch (error) {
      console.error('Error al cargar usuarios:', error);
    }
  };

  const usuariosFiltrados = usuarios.filter((u) =>
    u.nombre_completo.toLowerCase().includes(busqueda.toLowerCase()) ||
    u.email.toLowerCase().includes(busqueda.toLowerCase())
  );

  const usuario = usuarios.find((u) => u.id === usuarioSeleccionado);

  const handleAsignar = async () => {
    if (!usuarioSeleccionado || !user) return;

    try {
      setLoading(true);

      const result = await asignarVendedorManualmente(
        batchId,
        vendor.vendor_key,
        usuarioSeleccionado,
        guardarMapeo,
        user.id
      );

      alert(
        `Asignación exitosa!\n\n` +
          `${result.updated_count} póliza${result.updated_count !== 1 ? 's' : ''} actualizada${
            result.updated_count !== 1 ? 's' : ''
          }.\n` +
          `${
            result.mapping_created
              ? 'Mapeo guardado para futuros lotes.'
              : 'No se guardó mapeo persistente.'
          }`
      );

      onSuccess();
    } catch (error: any) {
      console.error('Error al asignar vendedor:', error);
      alert('Error al asignar vendedor: ' + (error.message || 'Error desconocido'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white">
          <h2 className="text-xl font-bold text-gray-900">Asignar Usuario MOVI</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-3 flex items-center space-x-2">
              {vendor.vendor_type === 'email' ? (
                <Mail className="h-5 w-5" />
              ) : (
                <User className="h-5 w-5" />
              )}
              <span>Datos del Vendedor Detectado</span>
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {vendor.vendor_email && (
                <div>
                  <p className="text-xs text-blue-700 font-medium mb-1">Email</p>
                  <p className="text-sm text-blue-900 font-mono bg-white px-3 py-2 rounded">
                    {vendor.vendor_email}
                  </p>
                </div>
              )}
              {vendor.vendor_name && (
                <div>
                  <p className="text-xs text-blue-700 font-medium mb-1">Nombre</p>
                  <p className="text-sm text-blue-900 bg-white px-3 py-2 rounded">
                    {vendor.vendor_name}
                  </p>
                </div>
              )}
              <div>
                <p className="text-xs text-blue-700 font-medium mb-1">Pólizas Incluidas</p>
                <p className="text-sm text-blue-900 font-semibold bg-white px-3 py-2 rounded flex items-center space-x-2">
                  <FileText className="h-4 w-4" />
                  <span>{vendor.polizas_count}</span>
                </p>
              </div>
              <div>
                <p className="text-xs text-blue-700 font-medium mb-1">Comisión Total</p>
                <p className="text-sm text-blue-900 font-semibold bg-white px-3 py-2 rounded flex items-center space-x-2">
                  <TrendingUp className="h-4 w-4" />
                  <span>
                    ${Number(vendor.total_commission).toLocaleString('es-MX', {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </p>
              </div>
            </div>

            <details className="mt-4 group">
              <summary className="cursor-pointer text-sm text-blue-700 hover:text-blue-800 font-medium flex items-center space-x-1">
                <span>Ver ejemplos de pólizas</span>
                <svg
                  className="h-4 w-4 transition-transform group-open:rotate-180"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </summary>
              <div className="mt-3 bg-white rounded-lg overflow-hidden">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">
                        Póliza
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">
                        Ramo
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">
                        Aseguradora
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-700">
                        Comisión
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {vendor.example_polizas.slice(0, 3).map((poliza) => (
                      <tr key={poliza.id}>
                        <td className="px-3 py-2 font-mono text-xs">{poliza.poliza}</td>
                        <td className="px-3 py-2 text-xs">{poliza.ramo}</td>
                        <td className="px-3 py-2 text-xs">{poliza.aseguradora}</td>
                        <td className="px-3 py-2 text-right text-xs font-semibold">
                          ${poliza.commission_neta.toLocaleString('es-MX')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-3">
              Seleccionar Usuario MOVI
            </label>
            {usuarioSeleccionado ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-green-600 text-white flex items-center justify-center font-semibold">
                      {usuario?.nombre_completo.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-green-900">{usuario?.nombre_completo}</p>
                      <p className="text-sm text-green-700">{usuario?.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setUsuarioSeleccionado(null)}
                    className="text-green-600 hover:text-green-700"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    value={busqueda}
                    onChange={(e) => {
                      setBusqueda(e.target.value);
                      setMostrarLista(true);
                    }}
                    onFocus={() => setMostrarLista(true)}
                    placeholder="Buscar por nombre o email..."
                    className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {mostrarLista && busqueda && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                    {usuariosFiltrados.length === 0 ? (
                      <div className="p-4 text-center text-sm text-gray-500">
                        No se encontraron usuarios
                      </div>
                    ) : (
                      usuariosFiltrados.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => {
                            setUsuarioSeleccionado(u.id);
                            setMostrarLista(false);
                            setBusqueda('');
                          }}
                          className="w-full flex items-center space-x-3 p-3 hover:bg-blue-50 border-b border-gray-100 last:border-b-0 text-left transition-colors"
                        >
                          <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold">
                            {u.nombre_completo.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-gray-900">{u.nombre_completo}</p>
                            <p className="text-sm text-gray-600">{u.email}</p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <label className="flex items-start space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={guardarMapeo}
                onChange={(e) => setGuardarMapeo(e.target.checked)}
                className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <div>
                <p className="font-medium text-gray-900 flex items-center space-x-2">
                  <Save className="h-4 w-4" />
                  <span>Recordar esta asignación para futuros lotes</span>
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  {vendor.vendor_type === 'email'
                    ? `Se guardará un mapeo por email (${vendor.vendor_email}) para reconocimiento automático en futuras cargas.`
                    : `Se guardará un mapeo por nombre (${vendor.vendor_name}) para reconocimiento automático en futuras cargas.`}
                </p>
              </div>
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50 sticky bottom-0">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleAsignar}
            disabled={!usuarioSeleccionado || loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Asignando...</span>
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                <span>Asignar y Guardar</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
