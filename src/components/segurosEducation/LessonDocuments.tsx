import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Upload, FileText, Trash2, Download, X } from 'lucide-react';

interface Document {
  id: string;
  nombre_archivo: string;
  archivo_url: string;
  tipo_archivo: string | null;
  tamano_bytes: number | null;
  descripcion: string | null;
  orden: number;
}

interface LessonDocumentsProps {
  lessonId: string | null;
  isAdmin: boolean;
  isEditMode: boolean;
}

export function LessonDocuments({ lessonId, isAdmin, isEditMode }: LessonDocumentsProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (lessonId) {
      fetchDocuments();
    }
  }, [lessonId]);

  const fetchDocuments = async () => {
    if (!lessonId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('seguros_lesson_documents')
        .select('*')
        .eq('lesson_id', lessonId)
        .order('orden');

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadDocument = async (file: File) => {
    if (!lessonId || !isAdmin) return;

    // Check if we already have 5 documents
    if (documents.length >= 5) {
      showToast('Solo puedes subir máximo 5 documentos por lección', 'error');
      return;
    }

    try {
      setUploading(true);

      // Upload to storage
      const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const { error: uploadError } = await supabase.storage
        .from('seguros-lesson-documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('seguros-lesson-documents')
        .getPublicUrl(fileName);

      // Create document record
      const { error: insertError } = await supabase
        .from('seguros_lesson_documents')
        .insert({
          lesson_id: lessonId,
          nombre_archivo: file.name,
          archivo_url: publicUrlData.publicUrl,
          tipo_archivo: file.type,
          tamano_bytes: file.size,
          orden: documents.length,
        });

      if (insertError) throw insertError;

      showToast('Documento subido exitosamente', 'success');
      fetchDocuments();
    } catch (error: any) {
      console.error('Error uploading document:', error);
      showToast('Error al subir documento: ' + error.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (doc: Document) => {
    if (!isAdmin) return;

    const confirmDelete = window.confirm(
      `¿Estás seguro de eliminar "${doc.nombre_archivo}"?`
    );

    if (!confirmDelete) return;

    try {
      // Extract filename from URL
      const urlParts = doc.archivo_url.split('/');
      const fileName = urlParts[urlParts.length - 1];

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('seguros-lesson-documents')
        .remove([fileName]);

      if (storageError) console.warn('Storage deletion warning:', storageError);

      // Delete from database
      const { error: dbError } = await supabase
        .from('seguros_lesson_documents')
        .delete()
        .eq('id', doc.id);

      if (dbError) throw dbError;

      showToast('Documento eliminado', 'success');
      fetchDocuments();
    } catch (error: any) {
      console.error('Error deleting document:', error);
      showToast('Error al eliminar documento: ' + error.message, 'error');
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Desconocido';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    return <FileText className="w-5 h-5" />;
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    const toast = document.createElement('div');
    const bgColor = type === 'success' ? 'bg-emerald-500' : 'bg-red-500';
    toast.className = `fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg text-white z-50 max-w-md ${bgColor}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  };

  if (!lessonId && !isEditMode) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <p className="text-sm text-amber-800">
          Primero guarda la lección para poder agregar documentos de apoyo.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-neutral-500">Cargando documentos...</p>
      </div>
    );
  }

  return (
    <div className={isEditMode ? 'space-y-4' : 'space-y-2'}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className={`font-semibold text-neutral-700 ${isEditMode ? 'text-sm' : 'text-xs'}`}>
            Documentos de Apoyo
          </h3>
          {isEditMode && (
            <p className="text-xs text-neutral-500 mt-1">
              {documents.length}/5 documentos subidos
            </p>
          )}
        </div>
      </div>

      {/* Upload section - only for admins when editing existing lesson */}
      {isAdmin && lessonId && documents.length < 5 && isEditMode && (
        <div className="border-2 border-dashed border-neutral-300 rounded-lg p-4 text-center hover:border-primary-500 transition-colors">
          <input
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                handleUploadDocument(file);
                e.target.value = '';
              }
            }}
            className="hidden"
            id="document-upload"
            disabled={uploading}
          />
          <label htmlFor="document-upload" className="cursor-pointer">
            <Upload className="w-8 h-8 text-neutral-400 mx-auto mb-2" />
            <p className="text-sm text-neutral-600">
              {uploading ? 'Subiendo...' : 'Click para subir documento'}
            </p>
            <p className="text-xs text-neutral-500 mt-1">
              PDF, Word, Excel, PowerPoint, TXT, ZIP, RAR
            </p>
          </label>
        </div>
      )}

      {/* Documents list */}
      {documents.length > 0 ? (
        <div className={isEditMode ? 'space-y-2' : 'space-y-1'}>
          {documents.map((doc) => (
            <div
              key={doc.id}
              className={`flex items-center justify-between bg-neutral-50 rounded-lg border border-neutral-200 hover:bg-neutral-100 transition-colors group ${
                isEditMode ? 'p-3' : 'p-2'
              }`}
            >
              <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                <div className="text-primary-600 flex-shrink-0">
                  {getFileIcon(doc.nombre_archivo)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-medium text-neutral-900 truncate ${
                    isEditMode ? 'text-sm' : 'text-xs'
                  }`}>
                    {doc.nombre_archivo}
                  </p>
                  {isEditMode && (
                    <p className="text-xs text-neutral-500">
                      {formatFileSize(doc.tamano_bytes)}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <a
                  href={doc.archivo_url}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`text-primary-600 hover:bg-primary-50 rounded-lg transition-colors ${
                    isEditMode ? 'p-2' : 'p-1.5'
                  }`}
                  title="Descargar"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Download className={isEditMode ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
                </a>
                {isAdmin && isEditMode && (
                  <button
                    onClick={() => handleDeleteDocument(doc)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        !isEditMode ? (
          <p className="text-xs text-neutral-500 italic">
            No hay documentos de apoyo para esta lección
          </p>
        ) : (
          <div className="text-center py-8">
            <FileText className="w-12 h-12 text-neutral-300 mx-auto mb-2" />
            <p className="text-sm text-neutral-500">
              {isAdmin && lessonId
                ? 'No hay documentos de apoyo. Sube uno para comenzar.'
                : 'Esta lección no tiene documentos de apoyo'}
            </p>
          </div>
        )
      )}
    </div>
  );
}
