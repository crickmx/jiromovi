import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Upload, Trash2, FileText, Download, Edit2, X, Check } from 'lucide-react';

interface ExpedienteFile {
  id: string;
  nombre_archivo: string;
  descripcion: string;
  tipo_documento: string;
  archivo_url: string;
  archivo_path: string;
  size_bytes: number;
  mime_type: string;
  created_at: string;
  subido_por: string;
}

interface ExpedienteSectionProps {
  usuarioId: string;
  canEdit: boolean;
}

const TIPOS_DOCUMENTO = [
  'Contrato',
  'Identificación',
  'CV',
  'Comprobante de Domicilio',
  'Certificado',
  'Carta',
  'Acta',
  'RFC',
  'CURP',
  'NSS',
  'Título',
  'Otro'
];

export function ExpedienteSection({ usuarioId, canEdit }: ExpedienteSectionProps) {
  const { usuario: currentUser } = useAuth();
  const [files, setFiles] = useState<ExpedienteFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<{ descripcion: string; tipo_documento: string }>({
    descripcion: '',
    tipo_documento: 'Otro'
  });

  useEffect(() => {
    loadFiles();
  }, [usuarioId]);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('expediente_usuario')
        .select('*')
        .eq('usuario_id', usuarioId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setFiles(data);
    } catch (error) {
      console.error('Error loading expediente files:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${usuarioId}/${Date.now()}.${fileExt}`;
      const filePath = fileName;

      const { error: uploadError } = await supabase.storage
        .from('expediente-usuarios')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('expediente-usuarios')
        .getPublicUrl(filePath);

      const { error: insertError } = await supabase
        .from('expediente_usuario')
        .insert({
          usuario_id: usuarioId,
          nombre_archivo: file.name,
          descripcion: '',
          tipo_documento: 'Otro',
          archivo_url: publicUrl,
          archivo_path: filePath,
          size_bytes: file.size,
          mime_type: file.type,
          subido_por: currentUser.id
        });

      if (insertError) throw insertError;

      await loadFiles();
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Error al subir el archivo');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (fileId: string, filePath: string) => {
    if (!confirm('¿Estás seguro de eliminar este archivo?')) return;

    try {
      const { error: storageError } = await supabase.storage
        .from('expediente-usuarios')
        .remove([filePath]);

      if (storageError) throw storageError;

      const { error: deleteError } = await supabase
        .from('expediente_usuario')
        .delete()
        .eq('id', fileId);

      if (deleteError) throw deleteError;

      await loadFiles();
    } catch (error) {
      console.error('Error deleting file:', error);
      alert('Error al eliminar el archivo');
    }
  };

  const handleDownload = async (url: string, nombre: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = nombre;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Error downloading file:', error);
      alert('Error al descargar el archivo');
    }
  };

  const startEdit = (file: ExpedienteFile) => {
    setEditingId(file.id);
    setEditData({
      descripcion: file.descripcion,
      tipo_documento: file.tipo_documento
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditData({ descripcion: '', tipo_documento: 'Otro' });
  };

  const saveEdit = async (fileId: string) => {
    try {
      const { error } = await supabase
        .from('expediente_usuario')
        .update({
          descripcion: editData.descripcion,
          tipo_documento: editData.tipo_documento,
          updated_at: new Date().toISOString()
        })
        .eq('id', fileId);

      if (error) throw error;

      await loadFiles();
      cancelEdit();
    } catch (error) {
      console.error('Error updating file:', error);
      alert('Error al actualizar el archivo');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-slate-900">Expediente</h3>
        {canEdit && (
          <label className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg cursor-pointer transition">
            <Upload className="w-4 h-4" />
            <span>{uploading ? 'Subiendo...' : 'Subir Archivo'}</span>
            <input
              type="file"
              onChange={handleFileUpload}
              disabled={uploading}
              className="hidden"
            />
          </label>
        )}
      </div>

      {files.length === 0 ? (
        <div className="text-center py-8 text-slate-500">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No hay archivos en el expediente</p>
        </div>
      ) : (
        <div className="space-y-3">
          {files.map((file) => (
            <div
              key={file.id}
              className="bg-white rounded-lg p-4 border border-slate-200 hover:border-slate-300 transition"
            >
              {editingId === file.id ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Tipo de Documento
                    </label>
                    <select
                      value={editData.tipo_documento}
                      onChange={(e) => setEditData({ ...editData, tipo_documento: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {TIPOS_DOCUMENTO.map((tipo) => (
                        <option key={tipo} value={tipo}>
                          {tipo}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Descripción
                    </label>
                    <textarea
                      value={editData.descripcion}
                      onChange={(e) => setEditData({ ...editData, descripcion: e.target.value })}
                      placeholder="Descripción del archivo"
                      rows={2}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={cancelEdit}
                      className="flex items-center space-x-1 px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition"
                    >
                      <X className="w-4 h-4" />
                      <span className="text-sm">Cancelar</span>
                    </button>
                    <button
                      onClick={() => saveEdit(file.id)}
                      className="flex items-center space-x-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition"
                    >
                      <Check className="w-4 h-4" />
                      <span className="text-sm">Guardar</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    <FileText className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <h4 className="font-medium text-slate-900 truncate">
                          {file.nombre_archivo}
                        </h4>
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full flex-shrink-0">
                          {file.tipo_documento}
                        </span>
                      </div>
                      {file.descripcion && (
                        <p className="text-sm text-slate-600 mb-1">{file.descripcion}</p>
                      )}
                      <p className="text-xs text-slate-500">
                        {formatFileSize(file.size_bytes)} • {new Date(file.created_at).toLocaleDateString('es-MX')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 ml-3 flex-shrink-0">
                    <button
                      onClick={() => handleDownload(file.archivo_url, file.nombre_archivo)}
                      className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      title="Descargar"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    {canEdit && (
                      <>
                        <button
                          onClick={() => startEdit(file)}
                          className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(file.id, file.archivo_path)}
                          className="p-2 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
