import { useState, useEffect } from 'react';
import { AlertTriangle, Mail, User, TrendingUp, FileText, UserPlus } from 'lucide-react';
import { obtenerVendedoresNoReconocidos } from '../../lib/vendorMappingUtils';
import type { UnmatchedVendor } from '../../lib/vendorMappingTypes';
import AsignarVendedorModal from './AsignarVendedorModal';

interface Props {
  batchId: string;
  onVendorAssigned: () => void;
}

export default function VendedoresNoReconocidos({ batchId, onVendorAssigned }: Props) {
  const [vendedores, setVendedores] = useState<UnmatchedVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<UnmatchedVendor | null>(null);

  useEffect(() => {
    cargarVendedores();
  }, [batchId]);

  const cargarVendedores = async () => {
    try {
      setLoading(true);
      const data = await obtenerVendedoresNoReconocidos(batchId);
      setVendedores(data);
    } catch (error) {
      console.error('Error al cargar vendedores no reconocidos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAsignar = (vendor: UnmatchedVendor) => {
    setSelectedVendor(vendor);
    setModalOpen(true);
  };

  const handleAsignacionCompleta = () => {
    setModalOpen(false);
    setSelectedVendor(null);
    cargarVendedores();
    onVendorAssigned();
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (vendedores.length === 0) {
    return (
      <div className="bg-green-50 rounded-lg border border-green-200 p-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
            <User className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <h3 className="font-semibold text-green-900">Todos los vendedores reconocidos</h3>
            <p className="text-sm text-green-700">
              No hay vendedores pendientes por asignar en este lote.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const totalPolizas = vendedores.reduce((sum, v) => sum + v.polizas_count, 0);
  const totalComision = vendedores.reduce((sum, v) => sum + Number(v.total_commission), 0);

  return (
    <>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Vendedores No Reconocidos
                </h3>
                <p className="text-sm text-gray-600">
                  {vendedores.length} vendedor{vendedores.length !== 1 ? 'es' : ''} requiere
                  {vendedores.length !== 1 ? 'n' : ''} asignación manual
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-6">
              <div className="text-right">
                <p className="text-sm text-gray-600">Total Pólizas</p>
                <p className="text-xl font-bold text-gray-900">{totalPolizas}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Total Comisión</p>
                <p className="text-xl font-bold text-gray-900">
                  ${totalComision.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="divide-y divide-gray-200">
          {vendedores.map((vendor) => (
            <div key={vendor.vendor_key} className="p-6 hover:bg-gray-50 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-3">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        vendor.vendor_type === 'email'
                          ? 'bg-blue-100'
                          : vendor.vendor_type === 'name'
                          ? 'bg-purple-100'
                          : 'bg-gray-100'
                      }`}
                    >
                      {vendor.vendor_type === 'email' ? (
                        <Mail className="h-5 w-5 text-blue-600" />
                      ) : vendor.vendor_type === 'name' ? (
                        <User className="h-5 w-5 text-purple-600" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 text-gray-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h4 className="font-semibold text-gray-900">
                          {vendor.vendor_email || vendor.vendor_name || 'Sin información'}
                        </h4>
                        <span
                          className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                            vendor.vendor_type === 'email'
                              ? 'bg-blue-100 text-blue-800'
                              : vendor.vendor_type === 'name'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {vendor.vendor_type === 'email'
                            ? 'Email'
                            : vendor.vendor_type === 'name'
                            ? 'Nombre'
                            : 'Desconocido'}
                        </span>
                      </div>
                      {vendor.vendor_email && vendor.vendor_name && (
                        <p className="text-sm text-gray-600 mt-1">
                          Nombre: {vendor.vendor_name}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="flex items-center space-x-2">
                      <FileText className="h-4 w-4 text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-600">Pólizas</p>
                        <p className="font-semibold text-gray-900">{vendor.polizas_count}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <TrendingUp className="h-4 w-4 text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-600">Comisión Total</p>
                        <p className="font-semibold text-gray-900">
                          ${Number(vendor.total_commission).toLocaleString('es-MX', {
                            minimumFractionDigits: 2,
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <TrendingUp className="h-4 w-4 text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-600">Comisión Promedio</p>
                        <p className="font-semibold text-gray-900">
                          $
                          {(Number(vendor.total_commission) / vendor.polizas_count).toLocaleString(
                            'es-MX',
                            { minimumFractionDigits: 2 }
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  <details className="group">
                    <summary className="cursor-pointer text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center space-x-1">
                      <span>Ver ejemplos de pólizas ({vendor.polizas_count})</span>
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
                    <div className="mt-3 overflow-x-auto">
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
                              Prima Base
                            </th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-700">
                              Comisión
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {vendor.example_polizas.slice(0, 5).map((poliza) => (
                            <tr key={poliza.id} className="hover:bg-gray-50">
                              <td className="px-3 py-2 font-mono text-xs">{poliza.poliza}</td>
                              <td className="px-3 py-2">{poliza.ramo}</td>
                              <td className="px-3 py-2">{poliza.aseguradora}</td>
                              <td className="px-3 py-2 text-right">
                                ${poliza.prima_base.toLocaleString('es-MX')}
                              </td>
                              <td className="px-3 py-2 text-right font-semibold">
                                ${poliza.commission_neta.toLocaleString('es-MX')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {vendor.polizas_count > 5 && (
                        <p className="text-xs text-gray-500 mt-2 text-center">
                          ... y {vendor.polizas_count - 5} póliza
                          {vendor.polizas_count - 5 !== 1 ? 's' : ''} más
                        </p>
                      )}
                    </div>
                  </details>
                </div>

                <button
                  onClick={() => handleAsignar(vendor)}
                  className="ml-6 flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <UserPlus className="h-4 w-4" />
                  <span>Asignar Usuario MOVI</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {modalOpen && selectedVendor && (
        <AsignarVendedorModal
          batchId={batchId}
          vendor={selectedVendor}
          onClose={() => setModalOpen(false)}
          onSuccess={handleAsignacionCompleta}
        />
      )}
    </>
  );
}
