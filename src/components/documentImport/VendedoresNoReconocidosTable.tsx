import { useState } from 'react';
import { AlertCircle, Mail, User, FileText, UserPlus, HelpCircle } from 'lucide-react';
import type { UnmatchedVendorGroup } from '../../lib/documentImportTypes';
import AsignarVendedorModal from './AsignarVendedorModal';
import { getVendorGroupLabel } from '../../lib/documentImportUtils';

interface VendedoresNoReconocidosTableProps {
  groups: UnmatchedVendorGroup[];
  batchId: string;
  onRefresh: () => void;
}

export default function VendedoresNoReconocidosTable({
  groups,
  batchId,
  onRefresh,
}: VendedoresNoReconocidosTableProps) {
  const [selectedGroup, setSelectedGroup] = useState<UnmatchedVendorGroup | null>(null);

  const handleOpenModal = (group: UnmatchedVendorGroup) => {
    setSelectedGroup(group);
  };

  const handleCloseModal = () => {
    setSelectedGroup(null);
  };

  const handleSuccess = () => {
    setSelectedGroup(null);
    onRefresh();
  };

  if (groups.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-green-100 rounded-lg">
            <AlertCircle className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Todos los vendedores fueron reconocidos
            </h3>
            <p className="text-sm text-gray-600">
              No hay vendedores pendientes de asignar
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <AlertCircle className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Vendedores no reconocidos
              </h3>
              <p className="text-sm text-gray-600">
                {groups.length} {groups.length === 1 ? 'vendedor requiere' : 'vendedores requieren'} asignación manual
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tipo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vendedor detectado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  # Documentos
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Información adicional
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ejemplos
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {groups.map((group) => (
                <tr key={group.vendor_key} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {group.type === 'name' ? (
                        <>
                          <User className="h-5 w-5 text-blue-600" />
                          <span className="text-sm font-medium text-gray-900">Nombre</span>
                        </>
                      ) : group.type === 'email' ? (
                        <>
                          <Mail className="h-5 w-5 text-green-600" />
                          <span className="text-sm font-medium text-gray-900">Email</span>
                        </>
                      ) : (
                        <>
                          <HelpCircle className="h-5 w-5 text-gray-400" />
                          <span className="text-sm font-medium text-gray-500">Desconocido</span>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {getVendorGroupLabel(group)}
                      </p>
                      {group.display_value !== getVendorGroupLabel(group) && (
                        <p className="text-xs text-gray-500">
                          Normalizado: {group.display_value}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-gray-400" />
                      <span className="text-sm font-semibold text-gray-900">
                        {group.document_count}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {group.type === 'name' && group.emails_detected && group.emails_detected.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        <span className="text-xs text-gray-500 mr-1">Emails:</span>
                        {group.emails_detected.slice(0, 2).map((email, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700"
                          >
                            <Mail className="h-3 w-3" />
                            {email}
                          </span>
                        ))}
                        {group.emails_detected.length > 2 && (
                          <span className="px-2 py-1 text-xs text-gray-500">
                            +{group.emails_detected.length - 2}
                          </span>
                        )}
                      </div>
                    ) : group.type === 'email' && group.vendor_name_raw ? (
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-500">Nombre:</span>
                        <span className="text-xs text-gray-700">{group.vendor_name_raw}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {group.sample_documents.slice(0, 2).map((doc, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-gray-100 border border-gray-200 rounded text-xs text-gray-700"
                        >
                          {doc}
                        </span>
                      ))}
                      {group.sample_documents.length > 2 && (
                        <span className="px-2 py-1 text-xs text-gray-500">
                          +{group.sample_documents.length - 2}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleOpenModal(group)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
                    >
                      <UserPlus className="h-4 w-4" />
                      Asignar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedGroup && (
        <AsignarVendedorModal
          group={selectedGroup}
          batchId={batchId}
          onClose={handleCloseModal}
          onSuccess={handleSuccess}
        />
      )}
    </>
  );
}
