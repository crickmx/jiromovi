import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Clock,
  Users,
  FileText,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  getAllBatches,
  getUnmatchedVendorGroups,
  getBatchById,
  deleteBatch,
} from '../lib/documentImportUtils';
import type { DocumentImportBatch } from '../lib/documentImportTypes';
import VendedoresNoReconocidosTable from '../components/documentImport/VendedoresNoReconocidosTable';

export default function DocumentosImportar() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [batches, setBatches] = useState<DocumentImportBatch[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingBatches, setLoadingBatches] = useState(true);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [selectedBatch, setSelectedBatch] = useState<DocumentImportBatch | null>(null);
  const [unmatchedGroups, setUnmatchedGroups] = useState<any[]>([]);

  useEffect(() => {
    if (usuario?.rol !== 'Administrador') {
      navigate('/');
      return;
    }
    loadBatches();
  }, [usuario, navigate]);

  const loadBatches = async () => {
    setLoadingBatches(true);
    try {
      const data = await getAllBatches();
      setBatches(data);
    } catch (error) {
      console.error('Error al cargar lotes:', error);
    } finally {
      setLoadingBatches(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (
        file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.type === 'application/vnd.ms-excel'
      ) {
        setSelectedFile(file);
      } else {
        alert('Por favor selecciona un archivo Excel (.xlsx o .xls)');
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setLoading(true);
    setUploadProgress('Subiendo archivo...');

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('No hay sesión activa');
      }

      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('columnMapping', JSON.stringify({}));

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-document-import`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al procesar el archivo');
      }

      const result = await response.json();

      if (result.success) {
        setUploadProgress('');
        setSelectedFile(null);
        await loadBatches();

        const batchData = await getBatchById(result.batch.id);
        if (batchData) {
          setSelectedBatch(batchData);
          if (batchData.records_unmatched > 0) {
            const groups = await getUnmatchedVendorGroups(batchData.id);
            setUnmatchedGroups(groups);
          }
        }
      }
    } catch (error: any) {
      console.error('Error al importar:', error);
      alert(error.message || 'Error al procesar el archivo');
      setUploadProgress('');
    } finally {
      setLoading(false);
    }
  };

  const handleViewBatch = async (batch: DocumentImportBatch) => {
    setSelectedBatch(batch);
    if (batch.records_unmatched > 0) {
      const groups = await getUnmatchedVendorGroups(batch.id);
      setUnmatchedGroups(groups);
    } else {
      setUnmatchedGroups([]);
    }
  };

  const handleRefreshBatch = async () => {
    if (!selectedBatch) return;

    const batchData = await getBatchById(selectedBatch.id);
    if (batchData) {
      setSelectedBatch(batchData);
      if (batchData.records_unmatched > 0) {
        const groups = await getUnmatchedVendorGroups(batchData.id);
        setUnmatchedGroups(groups);
      } else {
        setUnmatchedGroups([]);
      }

      await loadBatches();
    }
  };

  const handleDeleteBatch = async (batch: DocumentImportBatch) => {
    const confirmed = window.confirm(
      `¿Estás seguro de que deseas eliminar este lote?\n\n` +
      `Archivo: ${batch.file_name}\n` +
      `Total de documentos: ${batch.records_total}\n\n` +
      `Esta acción no se puede deshacer.`
    );

    if (!confirmed) return;

    try {
      const result = await deleteBatch(batch.id);

      alert(
        `Lote eliminado exitosamente.\n\n` +
        `Documentos eliminados: ${result.documents_deleted}`
      );

      await loadBatches();
    } catch (error: any) {
      console.error('Error al eliminar batch:', error);
      alert(error.message || 'Error al eliminar el lote. Por favor intenta de nuevo.');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
            <CheckCircle2 className="h-3 w-3" />
            Completado
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
            <Clock className="h-3 w-3" />
            Procesando
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-100 text-red-800 text-xs font-medium rounded-full">
            <AlertCircle className="h-3 w-3" />
            Fallido
          </span>
        );
      case 'partial':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-orange-100 text-orange-800 text-xs font-medium rounded-full">
            <AlertCircle className="h-3 w-3" />
            Parcial
          </span>
        );
      default:
        return null;
    }
  };

  if (selectedBatch) {
    return (
      <div className="p-4 md:p-6 lg:p-8">
        <button
          onClick={() => setSelectedBatch(null)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="font-medium">Volver a la lista</span>
        </button>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Detalle del lote</h2>
              <p className="text-gray-600 mt-1">{selectedBatch.file_name}</p>
            </div>
            {getStatusBadge(selectedBatch.status)}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-gray-600" />
                <div>
                  <p className="text-sm text-gray-600">Total</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {selectedBatch.records_total}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-sm text-green-700">Reconocidos</p>
                  <p className="text-2xl font-bold text-green-900">
                    {selectedBatch.records_matched}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-8 w-8 text-orange-600" />
                <div>
                  <p className="text-sm text-orange-700">Sin reconocer</p>
                  <p className="text-2xl font-bold text-orange-900">
                    {selectedBatch.records_unmatched}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 text-sm text-gray-600">
            <p>
              Importado el{' '}
              {new Date(selectedBatch.imported_at).toLocaleString('es-MX', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </p>
          </div>
        </div>

        {selectedBatch.records_unmatched > 0 && (
          <VendedoresNoReconocidosTable
            groups={unmatchedGroups}
            batchId={selectedBatch.id}
            onRefresh={handleRefreshBatch}
          />
        )}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <button
        onClick={() => navigate('/comisiones')}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition"
      >
        <ArrowLeft className="h-5 w-5" />
        <span className="font-medium">Volver a Comisiones</span>
      </button>

      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
          Importar documentos desde Excel
        </h1>
        <p className="text-gray-600 mt-1">
          Sube un archivo Excel para procesar documentos y asignar vendedores automáticamente
        </p>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Upload className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Cargar archivo</h3>
            <p className="text-sm text-gray-600">Selecciona un archivo Excel (.xlsx o .xls)</p>
          </div>
        </div>

        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8">
          <div className="text-center">
            <FileSpreadsheet className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <label className="cursor-pointer">
              <span className="text-blue-600 hover:text-blue-700 font-medium">
                Selecciona un archivo
              </span>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
                disabled={loading}
              />
            </label>
            <p className="text-sm text-gray-500 mt-2">o arrastra y suelta aquí</p>
          </div>

          {selectedFile && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="h-8 w-8 text-blue-600" />
                  <div>
                    <p className="font-medium text-gray-900">{selectedFile.name}</p>
                    <p className="text-sm text-gray-600">
                      {(selectedFile.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleUpload}
                  disabled={loading}
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      {uploadProgress}
                    </>
                  ) : (
                    <>
                      <Upload className="h-5 w-5" />
                      Procesar archivo
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Clock className="h-6 w-6 text-gray-600" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Historial de importaciones</h3>
              <p className="text-sm text-gray-600">Lotes procesados recientemente</p>
            </div>
          </div>
        </div>

        {loadingBatches ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : batches.length === 0 ? (
          <div className="text-center py-12">
            <FileSpreadsheet className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg mb-2">No hay importaciones</p>
            <p className="text-gray-400 text-sm">Sube tu primer archivo Excel para comenzar</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Archivo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Total
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Reconocidos
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Pendientes
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Fecha
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {batches.map((batch) => (
                  <tr key={batch.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="h-5 w-5 text-green-600" />
                        <span className="text-sm font-medium text-gray-900">
                          {batch.file_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(batch.status)}</td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-semibold text-gray-900">
                        {batch.records_total}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-semibold text-green-600">
                        {batch.records_matched}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {batch.records_unmatched > 0 ? (
                        <span className="text-sm font-semibold text-orange-600">
                          {batch.records_unmatched}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">0</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600">
                        {new Date(batch.imported_at).toLocaleDateString('es-MX', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleViewBatch(batch)}
                          className="text-sm font-medium text-blue-600 hover:text-blue-700 transition"
                        >
                          Ver detalle
                        </button>
                        <button
                          onClick={() => handleDeleteBatch(batch)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Eliminar lote"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
