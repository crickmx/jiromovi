import { useState, useEffect, useRef } from 'react';
import { Upload, FileText, Image, Trash2, Loader2, Paperclip } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { ATTACHMENT_CATEGORIES, getAttachmentCategoryLabel } from '../../lib/quoteFormTypes';
import type { QuoteFormAttachment } from '../../lib/quoteFormTypes';

interface Props {
  formData: Record<string, any>;
  quoteFormId: string | null;
  updateField: (field: string, value: any) => void;
}

export default function QuoteFormStepAttachments({ formData, quoteFormId, updateField }: Props) {
  const [attachments, setAttachments] = useState<QuoteFormAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('otro');
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (quoteFormId) loadAttachments();
  }, [quoteFormId]);

  const loadAttachments = async () => {
    if (!quoteFormId) return;
    const { data } = await supabase
      .from('quote_form_attachments')
      .select('*')
      .eq('quote_form_id', quoteFormId)
      .order('created_at', { ascending: false });
    if (data) setAttachments(data);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !quoteFormId) return;

    setUploading(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError('Sesion expirada'); return; }

      for (const file of Array.from(files)) {
        if (file.size > 10 * 1024 * 1024) {
          setError(`${file.name} excede el limite de 10 MB`);
          continue;
        }

        const ext = file.name.split('.').pop() || '';
        const path = `quote-forms/${quoteFormId}/${Date.now()}-${file.name}`;

        const { error: uploadErr } = await supabase.storage
          .from('ticket-archivos')
          .upload(path, file);

        if (uploadErr) {
          setError(`Error al subir ${file.name}: ${uploadErr.message}`);
          continue;
        }

        const { data: urlData } = supabase.storage
          .from('ticket-archivos')
          .getPublicUrl(path);

        const { error: insertErr } = await supabase.from('quote_form_attachments').insert({
          quote_form_id: quoteFormId,
          file_name: file.name,
          file_url: urlData.publicUrl,
          file_type: ext.toLowerCase(),
          file_size: file.size,
          category: selectedCategory,
          uploaded_by: user.id,
        });

        if (insertErr) {
          setError(`Error al registrar ${file.name}: ${insertErr.message}`);
        }
      }

      await loadAttachments();
    } catch {
      setError('Error inesperado al subir archivos');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const deleteAttachment = async (att: QuoteFormAttachment) => {
    const path = att.file_url.split('/ticket-archivos/')[1];
    if (path) await supabase.storage.from('ticket-archivos').remove([path]);
    await supabase.from('quote_form_attachments').delete().eq('id', att.id);
    setAttachments(prev => prev.filter(a => a.id !== att.id));
  };

  const getFileIcon = (type: string | null) => {
    const imgTypes = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
    if (type && imgTypes.includes(type)) return Image;
    return FileText;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Documentos adjuntos</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">Adjunta documentos relevantes para la cotizacion. Todos los archivos son opcionales. Max 10 MB por archivo.</p>
      </div>

      {!quoteFormId && (
        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-700 dark:text-amber-300 text-sm">
          <p>Guarda el formulario como borrador primero (haciendo clic en "Guardar borrador") para habilitar la carga de archivos.</p>
        </div>
      )}

      {quoteFormId && (
        <>
          {/* Upload area */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-900"
              >
                {ATTACHMENT_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{getAttachmentCategoryLabel(cat)}</option>
                ))}
              </select>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {uploading ? 'Subiendo...' : 'Seleccionar archivos'}
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.gif,.doc,.docx,.xls,.xlsx,.csv,.xml,.zip"
              onChange={handleFileSelect}
              className="hidden"
            />

            {/* Drop zone visual */}
            <div
              onClick={() => !uploading && fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl p-8 text-center cursor-pointer hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors"
            >
              <Paperclip className="w-8 h-8 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400">Haz clic o arrastra archivos aqui</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">PDF, imagenes, Excel, Word, XML (max 10 MB)</p>
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          )}

          {/* Attachments list */}
          {attachments.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Archivos adjuntos ({attachments.length})
              </label>
              <div className="space-y-2">
                {attachments.map(att => {
                  const Icon = getFileIcon(att.file_type);
                  return (
                    <div key={att.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-100 dark:border-gray-700">
                      <Icon className="w-5 h-5 text-gray-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 dark:text-gray-200 truncate">{att.file_name}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <span>{formatSize(att.file_size)}</span>
                          <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px]">{getAttachmentCategoryLabel(att.category)}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => deleteAttachment(att)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
