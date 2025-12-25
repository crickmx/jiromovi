import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Upload, File, Trash2, Download, Edit2, X } from 'lucide-react';

interface Documento {
  id: string;
  nombre_archivo: string;
  tipo_documento: string;
  url_archivo: string;
  tamano_bytes: number;
  tipo_mime: string;
  created_at: string;
}

interface DocumentsSectionProps {
  usuarioId: string;
  canEdit?: boolean;
}

export function DocumentsSection({ usuarioId, canEdit = false }: DocumentsSectionProps) {
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editingDoc, setEditingDoc] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState('');

  useEffect(() => {
    loadDocuments();
  }, [usuarioId]);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('documentos_usuarios')
        .select('*')
        .eq('usuario_id', usuarioId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocumentos(data || []);
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${usuarioId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('documentos')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('documentos')
        .getPublicUrl(fileName);

      const { error: dbError } = await supabase
        .from('documentos_usuarios')
        .insert({
          usuario_id: usuarioId,
          nombre_archivo: file.name,
          tipo_documento: '',
          url_archivo: fileName,
          tamano_bytes: file.size,
          tipo_mime: file.type,
        });

      if (dbError) throw dbError;

      await loadDocuments();
      event.target.value = '';
    } catch (error: any) {
      console.error('Error uploading file:', error);
      alert('Error al subir el archivo: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId: string, urlArchivo: string) => {
    if (!confirm('¿Estás seguro de eliminar este documento?')) return;

    try {
      const { error: storageError } = await supabase.storage
        .from('documentos')
        .remove([urlArchivo]);

      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from('documentos_usuarios')
        .delete()
        .eq('id', docId);

      if (dbError) throw dbError;

      await loadDocuments();
    } catch (error: any) {
      console.error('Error deleting document:', error);
      alert('Error al eliminar el documento: ' + error.message);
    }
  };

  const handleDownload = async (urlArchivo: string, nombreArchivo: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('documentos')
        .download(urlArchivo);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = nombreArchivo;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Error downloading file:', error);
      alert('Error al descargar el archivo: ' + error.message);
    }
  };

  const startEdit = (doc: Documento) => {
    setEditingDoc(doc.id);
    setEditName(doc.nombre_archivo);
    setEditType(doc.tipo_documento);
  };

  const cancelEdit = () => {
    setEditingDoc(null);
    setEditName('');
    setEditType('');
  };

  const saveEdit = async (docId: string) => {
    try {
      const { error } = await supabase
        .from('documentos_usuarios')
        .update({
          nombre_archivo: editName,
          tipo_documento: editType,
          updated_at: new Date().toISOString(),
        })
        .eq('id', docId);

      if (error) throw error;

      await loadDocuments();
      cancelEdit();
    } catch (error: any) {
      console.error('Error updating document:', error);
      alert('Error al actualizar el documento: ' + error.message);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <File className="w-6 h-6 text-slate-700" />
          <h3 className="text-lg font-semibold text-slate-900">Documentos</h3>
        </div>
        {canEdit && (
          <label className="flex items-center space-x-2 bg-primary-600 text-white px-4 py-2 rounded-lg cursor-pointer hover:bg-primary-700 transition">
            <Upload className="w-4 h-4" />
            <span>{uploading ? 'Subiendo...' : 'Subir Documento'}</span>
            <input
              type="file"
              onChange={handleFileUpload}
              disabled={uploading}
              className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
            />
          </label>
        )}
      </div>

      {documentos.length === 0 ? (
        <div className="text-center py-8">
          <File className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No hay documentos cargados</p>
        </div>
      ) : (
        <div className="space-y-3">
          {documentos.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition"
            >
              {editingDoc === doc.id ? (
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Nombre del archivo"
                    className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <input
                    type="text"
                    value={editType}
                    onChange={(e) => setEditType(e.target.value)}
                    placeholder="Tipo de documento (opcional)"
                    className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              ) : (
                <div className="flex items-center space-x-3 flex-1">
                  <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                    <File className="w-5 h-5 text-primary-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 truncate">{doc.nombre_archivo}</p>
                    <div className="flex items-center space-x-3 text-xs text-slate-500">
                      {doc.tipo_documento && (
                        <span className="bg-slate-200 px-2 py-0.5 rounded">{doc.tipo_documento}</span>
                      )}
                      <span>{formatFileSize(doc.tamano_bytes)}</span>
                      <span>{formatDate(doc.created_at)}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center space-x-2 ml-3">
                {editingDoc === doc.id ? (
                  <>
                    <button
                      onClick={() => saveEdit(doc.id)}
                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition"
                      title="Guardar"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="p-2 text-slate-600 hover:bg-slate-200 rounded-lg transition"
                      title="Cancelar"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handleDownload(doc.url_archivo, doc.nombre_archivo)}
                      className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition"
                      title="Descargar"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    {canEdit && (
                      <>
                        <button
                          onClick={() => startEdit(doc)}
                          className="p-2 text-slate-600 hover:bg-slate-200 rounded-lg transition"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(doc.id, doc.url_archivo)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
