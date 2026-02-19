import { useState } from 'react';
import { CheckCircle2, Mail, User, FileText, RefreshCw } from 'lucide-react';
import type { MatchedVendorGroup } from '../../lib/documentImportTypes';
import ReasignarUsuarioModal from './ReasignarUsuarioModal';

interface VendedoresReconocidosTableProps {
  groups: MatchedVendorGroup[];
  batchId: string;
  onRefresh: () => void;
}

export default function VendedoresReconocidosTable({
  groups,
  batchId,
  onRefresh,
}: VendedoresReconocidosTableProps) {
  const [selectedGroup, setSelectedGroup] = useState<MatchedVendorGroup | null>(null);

  const handleOpenModal = (group: MatchedVendorGroup) => {
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
    return null;
  }

  return (
    <>
      <div className="bg-white rounded-xl sm:rounded-2xl shadow-soft overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg flex-shrink-0">
              <CheckCircle2 className="h-5 h-5 sm:h-6 sm:w-6 text-green-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                Vendedores reconocidos
              </h3>
              <p className="text-xs sm:text-sm text-gray-600">
                {groups.length} {groups.length === 1 ? 'usuario tiene' : 'usuarios tienen'} documentos asignados
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Usuario asignado
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  # Documentos
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                  Vendedores detectados
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                  Emails detectados
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {groups.map((group) => (
                <tr key={group.movi_user_id} className="hover:bg-gray-50 transition">
                  <td className="px-3 sm:px-6 py-4">
                    <div className="flex items-center gap-2 min-w-0">
                      <User className="h-5 w-5 text-accent flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {group.user_name}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{group.user_email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 sm:px-6 py-4">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      <span className="text-sm font-semibold text-gray-900">
                        {group.document_count}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 sm:px-6 py-4 hidden md:table-cell">
                    {group.vendor_names_detected && group.vendor_names_detected.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {group.vendor_names_detected.slice(0, 2).map((name, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center px-2 py-1 bg-primary-50 border border-primary-200 rounded text-xs text-primary-700"
                          >
                            {name}
                          </span>
                        ))}
                        {group.vendor_names_detected.length > 2 && (
                          <span className="px-2 py-1 text-xs text-gray-500">
                            +{group.vendor_names_detected.length - 2}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-3 sm:px-6 py-4 hidden lg:table-cell">
                    {group.vendor_emails_detected && group.vendor_emails_detected.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {group.vendor_emails_detected.slice(0, 2).map((email, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 border border-green-200 rounded text-xs text-green-700"
                          >
                            <Mail className="h-3 w-3 flex-shrink-0" />
                            {email}
                          </span>
                        ))}
                        {group.vendor_emails_detected.length > 2 && (
                          <span className="px-2 py-1 text-xs text-gray-500">
                            +{group.vendor_emails_detected.length - 2}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-3 sm:px-6 py-4">
                    <button
                      onClick={() => handleOpenModal(group)}
                      className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-gray-100 text-gray-700 text-xs sm:text-sm font-medium rounded-lg hover:bg-gray-200 transition min-h-[36px]"
                    >
                      <RefreshCw className="h-4 w-4 flex-shrink-0" />
                      <span className="hidden sm:inline">Reasignar</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedGroup && (
        <ReasignarUsuarioModal
          group={selectedGroup}
          batchId={batchId}
          onClose={handleCloseModal}
          onSuccess={handleSuccess}
        />
      )}
    </>
  );
}
