import { useState, useEffect, useRef } from 'react';
import {
  X, Upload, Trash2, Download, Eye, FileText, FileImage, File,
  Loader2, AlertCircle, FolderOpen, Pencil, Check, ChevronDown
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

const BUCKET = 'seguwallet-documents';

const TIPOS_DOCUMENTO = [
  'Identificación Oficial',
  'Comprobante de Domicilio',
  'RFC',
  'CURP',
  'Acta de Nacimiento',
  'Contrato / Póliza',
  'Cotización',
  'Factura / Recibo',
  'Carta',
  'Certificado',
  'Título Profesional',
  'NSS',
  'Otro',
];

interface DocRecord {
  id: string;
  nombre_archivo: string;
  tipo_documento: string;
  descripcion: string | null;
  archivo_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
}

interface Props {
  customerId: string;
  customerName: string;
  agentUserId?: string | null;
  onClose: () => void;
  readOnly?: boolean;
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mime: string | null) {
  if (!mime) return <File className="h-5 w-5 text-neutral-400" />;
  if (mime.startsWith('image/')) return <FileImage className="h-5 w-5 text-blue-500" />;
  if (mime === 'application/pdf') return <FileText className="h-5 w-5 text-red-500" />;
  return <File className="h-5 w-5 text-neutral-400" />;
}

export default function SeguwalletExpedienteModal({ customerId, customerName, agentUserId, onClose, readOnly = false }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [docs, setDocs] = useState<DocRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewMime, setPreviewMime] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // upload form state
  const [uploadNombre, setUploadNombre] = useState('');
  const [uploadTipo, setUploadTipo] = useState(TIPOS_DOCUMENTO[0]);
  const [uploadDesc, setUploadDesc] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showUploadForm, setShowUploadForm] = useState(false);

  // inline edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editTipo, setEditTipo] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [saving, setSaving] = useState(false);

  const loadDocs = async () => {
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('seguwallet_customer_documents')
        .select('id, nombre_archivo, tipo_documento, descripcion, archivo_path, mime_type, size_bytes, created_at')
        .eq('seguwallet_customer_id', customerId)
        .order('created_at', { ascending: false });
      if (err) throw err;
      setDocs(data || []);
    } catch (e: any) {
      setError(e.message || 'Error al cargar documentos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocs();
  }, [customerId]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    if (!uploadNombre) setUploadNombre(file.name.replace(/\.[^.]+$/, ''));
  };

  const handleUpload = async () => {
    if (!selectedFile || !uploadNombre.trim()) return;
    setUploading(true);
    setError('');
    try {
      const ext = selectedFile.name.split('.').pop();
      const path = `${customerId}/${Date.now()}_${selectedFile.name}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, selectedFile, {
        contentType: selectedFile.type,
        upsert: false,
      });
      if (upErr) throw upErr;

      const { error: dbErr } = await supabase
        .from('seguwallet_customer_documents')
        .insert({
          seguwallet_customer_id: customerId,
          nombre_archivo: uploadNombre.trim(),
          tipo_documento: uploadTipo,
          descripcion: uploadDesc.trim() || null,
          archivo_path: path,
          mime_type: selectedFile.type || null,
          size_bytes: selectedFile.size,
        });
      if (dbErr) {
        await supabase.storage.from(BUCKET).remove([path]);
        throw dbErr;
      }

      setUploadNombre('');
      setUploadTipo(TIPOS_DOCUMENTO[0]);
      setUploadDesc('');
      setSelectedFile(null);
      setShowUploadForm(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadDocs();

      // Notify agent (non-blocking)
      if (agentUserId) {
        supabase.rpc('notify', {
          p_event_code: 'seguwallet_492_documento_cargado',
          p_user_ids: [agentUserId],
          p_payload: {
            cliente_nombre: customerName || 'Cliente',
            nombre_documento: uploadNombre.trim(),
          },
          p_entity_id: customerId,
        }).then(({ error }) => {
          if (error) console.error('[expediente] notify 492_documento_cargado error:', error);
        });
      }
    } catch (e: any) {
      setError(e.message || 'Error al subir documento.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (doc: DocRecord) => {
    if (!confirm(`¿Eliminar "${doc.nombre_archivo}"?`)) return;
    setDeletingId(doc.id);
    setError('');
    try {
      await supabase.storage.from(BUCKET).remove([doc.archivo_path]);
      const { error: dbErr } = await supabase
        .from('seguwallet_customer_documents')
        .delete()
        .eq('id', doc.id);
      if (dbErr) throw dbErr;
      setDocs(prev => prev.filter(d => d.id !== doc.id));
    } catch (e: any) {
      setError(e.message || 'Error al eliminar documento.');
    } finally {
      setDeletingId(null);
    }
  };

  const getSignedUrl = async (path: string, forDownload = false): Promise<string | null> => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60, {
      download: forDownload,
    });
    if (error) return null;
    return data.signedUrl;
  };

  const handlePreview = async (doc: DocRecord) => {
    const url = await getSignedUrl(doc.archivo_path);
    if (!url) { setError('No se pudo generar URL de vista previa.'); return; }
    const mime = doc.mime_type || '';
    if (mime.startsWith('image/') || mime === 'application/pdf') {
      setPreviewUrl(url);
      setPreviewMime(mime);
      setPreviewName(doc.nombre_archivo);
    } else {
      window.open(url, '_blank');
    }
  };

  const handleDownload = async (doc: DocRecord) => {
    const url = await getSignedUrl(doc.archivo_path, true);
    if (!url) { setError('No se pudo generar URL de descarga.'); return; }
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.nombre_archivo;
    a.click();
  };

  const startEdit = (doc: DocRecord) => {
    setEditingId(doc.id);
    setEditNombre(doc.nombre_archivo);
    setEditTipo(doc.tipo_documento);
    setEditDesc(doc.descripcion || '');
  };

  const saveEdit = async () => {
    if (!editingId || !editNombre.trim()) return;
    setSaving(true);
    try {
      const { error: err } = await supabase
        .from('seguwallet_customer_documents')
        .update({ nombre_archivo: editNombre.trim(), tipo_documento: editTipo, descripcion: editDesc.trim() || null })
        .eq('id', editingId);
      if (err) throw err;
      setDocs(prev => prev.map(d => d.id === editingId
        ? { ...d, nombre_archivo: editNombre.trim(), tipo_documento: editTipo, descripcion: editDesc.trim() || null }
        : d
      ));
      setEditingId(null);
    } catch (e: any) {
      setError(e.message || 'Error al guardar cambios.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-neutral-100 dark:border-neutral-800">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center">
                <FolderOpen className="h-4 w-4 text-teal-600 dark:text-teal-400" />
              </div>
              <div>
                <h2 className="font-semibold text-neutral-900 dark:text-white text-sm">Expediente Digital</h2>
                <p className="text-xs text-neutral-500 dark:text-white/50 truncate max-w-[260px]">{customerName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!readOnly && (
                <button
                  onClick={() => setShowUploadForm(v => !v)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-teal-700 bg-teal-50 dark:bg-teal-900/20 dark:text-teal-400 rounded-lg hover:bg-teal-100 dark:hover:bg-teal-900/30 transition"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Subir
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showUploadForm ? 'rotate-180' : ''}`} />
                </button>
              )}
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Upload form */}
          {!readOnly && showUploadForm && (
            <div className="px-5 pt-4 pb-3 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50 space-y-3">
              <div
                className="border-2 border-dashed border-neutral-200 dark:border-neutral-700 rounded-xl p-4 text-center cursor-pointer hover:border-teal-400 dark:hover:border-teal-600 transition"
                onClick={() => fileInputRef.current?.click()}
              >
                {selectedFile ? (
                  <p className="text-sm font-medium text-teal-700 dark:text-teal-400">{selectedFile.name} ({formatBytes(selectedFile.size)})</p>
                ) : (
                  <div>
                    <Upload className="h-6 w-6 text-neutral-300 dark:text-neutral-600 mx-auto mb-1" />
                    <p className="text-xs text-neutral-500 dark:text-white/50">Haz clic para seleccionar archivo</p>
                    <p className="text-xs text-neutral-400 dark:text-white/30 mt-0.5">PDF, imagen, Word, Excel — máx 50 MB</p>
                  </div>
                )}
              </div>
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} accept="*/*" />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 dark:text-white/60 mb-1">Nombre del documento</label>
                  <input
                    type="text"
                    value={uploadNombre}
                    onChange={e => setUploadNombre(e.target.value)}
                    placeholder="Ej: INE Juan García"
                    className="w-full px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 dark:text-white/60 mb-1">Tipo de documento</label>
                  <select
                    value={uploadTipo}
                    onChange={e => setUploadTipo(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
                  >
                    {TIPOS_DOCUMENTO.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 dark:text-white/60 mb-1">Descripción (opcional)</label>
                <input
                  type="text"
                  value={uploadDesc}
                  onChange={e => setUploadDesc(e.target.value)}
                  placeholder="Notas adicionales..."
                  className="w-full px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => { setShowUploadForm(false); setSelectedFile(null); setUploadNombre(''); setUploadDesc(''); }}
                  className="px-3 py-1.5 text-sm text-neutral-600 dark:text-white/60 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleUpload}
                  disabled={!selectedFile || !uploadNombre.trim() || uploading}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 transition"
                >
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  Subir documento
                </button>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mx-5 mt-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 flex items-center gap-2 text-sm text-red-700 dark:text-red-400">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
              <button onClick={() => setError('')} className="ml-auto"><X className="h-3.5 w-3.5" /></button>
            </div>
          )}

          {/* Doc list */}
          <div className="flex-1 overflow-y-auto p-5">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-neutral-300 dark:text-neutral-600" />
              </div>
            ) : docs.length === 0 ? (
              <div className="text-center py-12">
                <FolderOpen className="h-10 w-10 text-neutral-200 dark:text-neutral-700 mx-auto mb-3" />
                <p className="text-sm font-medium text-neutral-600 dark:text-white/60">Sin documentos</p>
                {!readOnly && (
                  <p className="text-xs text-neutral-400 dark:text-white/40 mt-1">
                    Usa el botón "Subir" para agregar documentos al expediente.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {docs.map(doc => (
                  <div key={doc.id} className="rounded-xl border border-neutral-100 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50">
                    {editingId === doc.id ? (
                      <div className="p-3 space-y-2">
                        <input
                          type="text"
                          value={editNombre}
                          onChange={e => setEditNombre(e.target.value)}
                          className="w-full px-3 py-1.5 text-sm border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <select
                            value={editTipo}
                            onChange={e => setEditTipo(e.target.value)}
                            className="px-3 py-1.5 text-sm border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
                          >
                            {TIPOS_DOCUMENTO.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                          <input
                            type="text"
                            value={editDesc}
                            onChange={e => setEditDesc(e.target.value)}
                            placeholder="Descripción..."
                            className="px-3 py-1.5 text-sm border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <button onClick={() => setEditingId(null)} className="px-3 py-1 text-xs text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded transition">Cancelar</button>
                          <button onClick={saveEdit} disabled={saving} className="flex items-center gap-1 px-3 py-1 text-xs font-semibold bg-teal-600 text-white rounded hover:bg-teal-700 disabled:opacity-50 transition">
                            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                            Guardar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 p-3">
                        <div className="flex-shrink-0">{getFileIcon(doc.mime_type)}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">{doc.nombre_archivo}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-neutral-500 dark:text-white/40 bg-neutral-100 dark:bg-neutral-700 px-1.5 py-0.5 rounded">{doc.tipo_documento}</span>
                            {doc.size_bytes && <span className="text-xs text-neutral-400 dark:text-white/30">{formatBytes(doc.size_bytes)}</span>}
                            <span className="text-xs text-neutral-400 dark:text-white/30">{new Date(doc.created_at).toLocaleDateString('es-MX')}</span>
                          </div>
                          {doc.descripcion && <p className="text-xs text-neutral-500 dark:text-white/40 mt-0.5 truncate">{doc.descripcion}</p>}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => handlePreview(doc)}
                            title="Vista previa"
                            className="p-1.5 rounded-lg text-neutral-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDownload(doc)}
                            title="Descargar"
                            className="p-1.5 rounded-lg text-neutral-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </button>
                          {!readOnly && (
                            <>
                              <button
                                onClick={() => startEdit(doc)}
                                title="Editar"
                                className="p-1.5 rounded-lg text-neutral-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(doc)}
                                disabled={deletingId === doc.id}
                                title="Eliminar"
                                className="p-1.5 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition disabled:opacity-50"
                              >
                                {deletingId === doc.id
                                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  : <Trash2 className="h-3.5 w-3.5" />}
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

          {/* Footer */}
          <div className="p-4 border-t border-neutral-100 dark:border-neutral-800 flex justify-between items-center">
            <p className="text-xs text-neutral-400 dark:text-white/30">{docs.length} documento{docs.length !== 1 ? 's' : ''}</p>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-white/70 text-sm font-medium hover:bg-neutral-200 dark:hover:bg-neutral-700 transition"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>

      {/* Preview overlay */}
      {previewUrl && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80" onClick={() => setPreviewUrl(null)}>
          <div className="relative max-w-4xl w-full max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-white text-sm font-medium truncate flex-1">{previewName}</p>
              <button onClick={() => setPreviewUrl(null)} className="ml-4 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition">
                <X className="h-4 w-4" />
              </button>
            </div>
            {previewMime?.startsWith('image/') ? (
              <img src={previewUrl} alt={previewName} className="max-h-[80vh] w-full object-contain rounded-xl" />
            ) : (
              <iframe src={previewUrl} title={previewName} className="w-full h-[80vh] rounded-xl bg-white" />
            )}
          </div>
        </div>
      )}
    </>
  );
}
