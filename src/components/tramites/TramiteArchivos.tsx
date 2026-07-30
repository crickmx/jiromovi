import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { supabaseUrl } from '../../lib/supabase';
import { FileText, Download, Upload, Eye, FolderDown, Trash2, Music, Video, FileSpreadsheet, FileType2, File, Tag, X, AlertCircle, Share2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { FilePreviewModal } from './FilePreviewModal';
import JSZip from 'jszip';

interface Categoria {
  id: string;
  nombre: string;
  orden: number;
}

interface Archivo {
  id: string;
  nombre: string;
  url: string;
  tipo: string | null;
  tamano: number | null;
  fecha_subida: string;
  eliminado_at: string | null;
  categoria_id: string | null;
  categoria?: { nombre: string } | null;
  usuarios: {
    nombre_completo: string;
  } | null;
}

interface TramiteArchivosProps {
  tramiteId: string;
}

// El bucket 'ticket-archivos' no es público — la URL guardada en BD tiene forma de
// URL pública pero el navegador la rechaza directo (403); hay que firmarla primero,
// mismo patrón que ya usan la descarga y FilePreviewModal.
async function getSignedFileUrl(url: string): Promise<string> {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/storage/v1/object/public/ticket-archivos/');
    if (pathParts.length > 1) {
      const { data } = await supabase.storage
        .from('ticket-archivos')
        .createSignedUrl(decodeURIComponent(pathParts[1]), 3600);
      if (data) return data.signedUrl;
    }
  } catch {
    // cae al fallback de abajo
  }
  return url;
}

export function TramiteArchivos({ tramiteId }: TramiteArchivosProps) {
  const { usuario } = useAuth();
  const isAdmin = usuario?.rol === 'Administrador';
  const [archivos, setArchivos] = useState<Archivo[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [previewFile, setPreviewFile] = useState<Archivo | null>(null);

  // Category picker state
  const [pendingFiles, setPendingFiles] = useState<File[] | null>(null);
  const [selectedCategoriaId, setSelectedCategoriaId] = useState('');
  const [categoriaError, setCategoriaError] = useState(false);

  useEffect(() => {
    loadArchivos();
    loadCategorias();

    const subscription = supabase
      .channel(`tramite_archivos_${tramiteId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ticket_archivos',
          filter: `ticket_id=eq.${tramiteId}`
        },
        async (payload) => {
          const { data } = await supabase
            .from('ticket_archivos')
            .select('*, usuarios!usuario_id(nombre_completo), categoria:maestro_adjunto_categorias!categoria_id(nombre)')
            .eq('id', payload.new.id)
            .single();

          if (data) {
            setArchivos(prev => {
              const exists = prev.some(a => a.id === data.id);
              if (exists) return prev;
              return [data as Archivo, ...prev];
            });
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [tramiteId]);

  const loadCategorias = async () => {
    const { data } = await supabase
      .from('maestro_adjunto_categorias')
      .select('id, nombre, orden')
      .eq('activo', true)
      .order('orden');
    if (data) setCategorias(data as Categoria[]);
  };

  const loadArchivos = async () => {
    const { data } = await supabase
      .from('ticket_archivos')
      .select('*, usuarios!usuario_id(nombre_completo), categoria:maestro_adjunto_categorias!categoria_id(nombre)')
      .eq('ticket_id', tramiteId)
      .is('eliminado_at', null)
      .order('fecha_subida', { ascending: false });

    if (data) setArchivos(data as Archivo[]);
    setLoading(false);
  };

  const handleDeleteArchivo = async (archivoId: string) => {
    if (!usuario) return;
    if (!confirm('¿Mover este archivo a la papelera?')) return;
    await supabase.from('ticket_archivos').update({
      eliminado_at: new Date().toISOString(),
      eliminado_por: usuario.id,
    }).eq('id', archivoId);
    setArchivos(prev => prev.filter(a => a.id !== archivoId));
  };

  // Step 1: intercept file selection, show category picker
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setPendingFiles(Array.from(files));
    setSelectedCategoriaId('');
    setCategoriaError(false);
    e.target.value = '';
  };

  // Step 2: confirm category and upload
  const handleConfirmUpload = async () => {
    if (!selectedCategoriaId) {
      setCategoriaError(true);
      return;
    }
    const files = pendingFiles!;
    setPendingFiles(null);
    await doUpload(files, selectedCategoriaId);
  };

  const doUpload = async (files: File[], categoriaId: string) => {
    if (!usuario) return;
    setUploading(true);
    const tempFiles: Archivo[] = [];
    const uploadedFileIds: string[] = [];
    const categoriaObj = categorias.find(c => c.id === categoriaId);

    try {
      for (const file of files) {
        const tempId = `temp-${Date.now()}-${Math.random()}`;
        const optimisticFile: Archivo = {
          id: tempId,
          nombre: file.name,
          url: '',
          tipo: file.type,
          tamano: file.size,
          fecha_subida: new Date().toISOString(),
          eliminado_at: null,
          categoria_id: categoriaId,
          categoria: categoriaObj ? { nombre: categoriaObj.nombre } : null,
          usuarios: { nombre_completo: usuario.nombre_completo },
        };

        tempFiles.push(optimisticFile);
        setArchivos(prev => [optimisticFile, ...prev]);

        const fileExt = file.name.split('.').pop();
        const fileName = `${tramiteId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('ticket-archivos')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('ticket-archivos')
          .getPublicUrl(fileName);

        const { data: insertData, error: dbError } = await supabase
          .from('ticket_archivos')
          .insert({
            ticket_id: tramiteId,
            usuario_id: usuario.id,
            nombre: file.name,
            url: publicUrl,
            tipo: file.type,
            tamano: file.size,
            categoria_id: categoriaId,
          })
          .select()
          .single();

        if (dbError) throw dbError;

        uploadedFileIds.push(insertData.id);

        const { data, error: fetchError } = await supabase
          .from('ticket_archivos')
          .select('*, usuarios!usuario_id(nombre_completo), categoria:maestro_adjunto_categorias!categoria_id(nombre)')
          .eq('id', insertData.id)
          .single();

        if (fetchError) throw fetchError;

        setArchivos(prev =>
          prev.map(a => a.id === tempId ? data as Archivo : a)
        );
      }

      if (uploadedFileIds.length > 0) {
        dispatchDocumentNotification(uploadedFileIds, files);
      }
    } catch (err: any) {
      console.error('Error uploading file:', err);
      alert('Error al subir el archivo');
      setArchivos(prev =>
        prev.filter(a => !tempFiles.some(tf => tf.id === a.id))
      );
    } finally {
      setUploading(false);
    }
  };

  const dispatchDocumentNotification = async (fileIds: string[], files: File[]) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const fileNames = files.map(f => f.name).join(', ');
      const totalSize = files.reduce((sum, f) => sum + f.size, 0);
      const sizeLabel = totalSize < 1024 * 1024
        ? `${(totalSize / 1024).toFixed(1)} KB`
        : `${(totalSize / (1024 * 1024)).toFixed(1)} MB`;

      const response = await fetch(
        `${supabaseUrl}/functions/v1/ticket-notification-dispatcher`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            event_key: 'tramite_documento_cargado',
            ticket_id: tramiteId,
            triggered_by_user_id: usuario!.id,
            attachment_file_ids: fileIds,
            extra_variables: {
              nombre_archivo: fileIds.length === 1 ? fileNames : `${fileIds.length} archivos`,
              tamano_archivo: sizeLabel,
            },
          }),
        }
      );

      if (!response.ok) {
        const err = await response.text();
        console.error('Notification dispatch failed:', err);
      }
    } catch (err) {
      console.error('Error dispatching document notification:', err);
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Desconocido';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  };

  const friendlyName = (nombre: string): string => {
    const trimmed = nombre.trim();
    if (/^\[.+\]$/.test(trimmed)) {
      const inner = trimmed.slice(1, -1).toLowerCase();
      const labels: Record<string, string> = {
        documento: 'Documento', imagen: 'Imagen', audio: 'Audio',
        video: 'Video', sticker: 'Sticker', voice: 'Audio',
      };
      return labels[inner] ? `${labels[inner]} de WhatsApp` : 'Archivo de WhatsApp';
    }
    return trimmed;
  };

  const getEffectiveType = (tipo: string | null, nombre: string): string => {
    if (tipo && tipo !== 'application/octet-stream') return tipo;
    const ext = nombre.split('.').pop()?.toLowerCase() || '';
    const map: Record<string, string> = {
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
      webp: 'image/webp', svg: 'image/svg+xml',
      pdf: 'application/pdf',
      mp4: 'video/mp4', mov: 'video/quicktime', avi: 'video/x-msvideo', webm: 'video/webm',
      mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav', m4a: 'audio/mp4',
      doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      csv: 'text/csv',
    };
    return map[ext] || tipo || 'application/octet-stream';
  };

  const FileThumbnail = ({ archivo }: { archivo: Archivo }) => {
    const [imgError, setImgError] = useState(false);
    const [signedUrl, setSignedUrl] = useState<string | null>(null);
    const effectiveType = getEffectiveType(archivo.tipo, archivo.nombre);
    const ext = archivo.nombre.split('.').pop()?.toUpperCase() || '';
    const isImage = effectiveType.startsWith('image/');
    const isPdf = effectiveType.includes('pdf');
    const isAudio = effectiveType.startsWith('audio/');
    const isVideo = effectiveType.startsWith('video/');
    const isWord = effectiveType.includes('word') || effectiveType.includes('wordprocessingml');
    const isExcel = effectiveType.includes('excel') || effectiveType.includes('spreadsheetml') || effectiveType === 'text/csv';

    useEffect(() => {
      if (!isImage || !archivo.url) return;
      let cancelled = false;
      getSignedFileUrl(archivo.url).then(url => { if (!cancelled) setSignedUrl(url); });
      return () => { cancelled = true; };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [archivo.url]);

    if (isImage && !imgError) {
      if (!signedUrl) {
        return <div className="w-full h-full bg-neutral-100 dark:bg-neutral-700 animate-pulse" />;
      }
      return (
        <img
          src={signedUrl}
          alt={friendlyName(archivo.nombre)}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      );
    }
    if (isPdf) return (
      <div className="flex flex-col items-center gap-1.5">
        <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
          <FileType2 className="w-7 h-7 text-red-500" />
        </div>
        <span className="text-[11px] font-bold text-red-500 tracking-widest">PDF</span>
      </div>
    );
    if (isAudio) return (
      <div className="flex flex-col items-center gap-1.5">
        <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
          <Music className="w-7 h-7 text-purple-500" />
        </div>
        <span className="text-[11px] font-bold text-purple-500 tracking-widest">{ext || 'AUDIO'}</span>
      </div>
    );
    if (isVideo) return (
      <div className="flex flex-col items-center gap-1.5">
        <div className="w-12 h-12 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
          <Video className="w-7 h-7 text-orange-500" />
        </div>
        <span className="text-[11px] font-bold text-orange-500 tracking-widest">{ext || 'VIDEO'}</span>
      </div>
    );
    if (isWord) return (
      <div className="flex flex-col items-center gap-1.5">
        <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
          <FileText className="w-7 h-7 text-blue-600" />
        </div>
        <span className="text-[11px] font-bold text-blue-600 tracking-widest">{ext || 'DOC'}</span>
      </div>
    );
    if (isExcel) return (
      <div className="flex flex-col items-center gap-1.5">
        <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <FileSpreadsheet className="w-7 h-7 text-green-600" />
        </div>
        <span className="text-[11px] font-bold text-green-600 tracking-widest">{ext || 'XLS'}</span>
      </div>
    );
    return (
      <div className="flex flex-col items-center gap-1.5">
        <div className="w-12 h-12 rounded-xl bg-neutral-100 dark:bg-neutral-700 flex items-center justify-center">
          <File className="w-7 h-7 text-neutral-400" />
        </div>
        {ext && <span className="text-[11px] font-bold text-neutral-400 tracking-widest">{ext}</span>}
      </div>
    );
  };

  const handleDownloadAll = async () => {
    if (archivos.length === 0) return;
    setDownloading(true);

    try {
      const zip = new JSZip();

      for (const archivo of archivos) {
        try {
          let downloadUrl = archivo.url;

          const urlObj = new URL(archivo.url);
          const pathParts = urlObj.pathname.split('/storage/v1/object/public/ticket-archivos/');
          if (pathParts.length > 1) {
            const filePath = pathParts[1];
            const { data } = await supabase.storage
              .from('ticket-archivos')
              .createSignedUrl(filePath, 3600);
            if (data) downloadUrl = data.signedUrl;
          }

          const response = await fetch(downloadUrl);
          if (!response.ok) continue;
          const blob = await response.blob();
          zip.file(archivo.nombre, blob);
        } catch {
          continue;
        }
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `archivos-tramite.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading all files:', err);
      alert('Error al descargar los archivos');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-neutral-900">
          Archivos Adjuntos ({archivos.length})
        </h3>
        <div className="flex items-center space-x-2">
          {archivos.length > 0 && (
            <button
              onClick={handleDownloadAll}
              disabled={downloading}
              className="flex items-center space-x-2 px-4 py-2 bg-primary-100 hover:bg-primary-200 text-primary-700 rounded-xl transition-all font-semibold disabled:opacity-50"
            >
              <FolderDown className="w-5 h-5" />
              <span>{downloading ? 'Descargando...' : 'Descargar todo'}</span>
            </button>
          )}
          <label
            htmlFor="file-upload-archivos"
            className="flex items-center space-x-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-xl cursor-pointer transition-all font-semibold"
          >
            <Upload className="w-5 h-5" />
            <span>{uploading ? 'Subiendo...' : 'Subir Archivo'}</span>
            <input
              id="file-upload-archivos"
              type="file"
              multiple
              onChange={handleFileSelect}
              disabled={uploading}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {archivos.length === 0 ? (
        <div className="text-center py-12 text-neutral-500">
          <FileText className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
          <p>No hay archivos adjuntos</p>
          <p className="text-sm mt-2">Sube el primer archivo para comenzar</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {archivos.map((archivo) => (
            <div
              key={archivo.id}
              className="border border-neutral-200 dark:border-neutral-700 rounded-xl overflow-hidden hover:shadow-md hover:border-neutral-300 dark:hover:border-neutral-600 transition-all flex flex-col bg-white dark:bg-neutral-800/50"
            >
              {/* Thumbnail */}
              <div
                className="relative h-36 bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center overflow-hidden cursor-pointer"
                onClick={() => setPreviewFile(archivo)}
              >
                <FileThumbnail archivo={archivo} />
                <div className="absolute inset-0 bg-black/0 hover:bg-black/15 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
                  <div className="bg-white/90 dark:bg-neutral-900/90 rounded-full p-2">
                    <Eye className="w-5 h-5 text-neutral-700 dark:text-white" />
                  </div>
                </div>
              </div>

              {/* Info */}
              <div className="px-3 pt-2.5 pb-2 flex-1">
                <p
                  className="text-sm font-semibold text-neutral-900 dark:text-white truncate leading-tight"
                  title={friendlyName(archivo.nombre)}
                >
                  {friendlyName(archivo.nombre)}
                </p>
                <p className="text-xs text-neutral-400 dark:text-white/40 mt-1">
                  {formatFileSize(archivo.tamano)} · {new Date(archivo.fecha_subida).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
                {archivo.usuarios && (
                  <p className="text-[11px] text-neutral-400 dark:text-white/30 mt-0.5 truncate">
                    {archivo.usuarios.nombre_completo}
                  </p>
                )}
                {archivo.categoria && (
                  <span className="inline-flex items-center gap-1 mt-1.5 px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-medium">
                    <Tag className="w-2.5 h-2.5" />
                    {archivo.categoria.nombre}
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="px-3 pb-3 flex items-center gap-1.5">
                <button
                  onClick={() => setPreviewFile(archivo)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-lg transition-all font-semibold text-xs"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Ver
                </button>
                <button
                  onClick={async () => {
                    const shareUrl = await getSignedFileUrl(archivo.url);
                    const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void>; canShare?: (data?: ShareData) => boolean };
                    if (nav.share) {
                      try {
                        await nav.share({ title: friendlyName(archivo.nombre), url: shareUrl });
                        return;
                      } catch {
                        // usuario canceló el share nativo — no hacer nada más
                        return;
                      }
                    }
                    // Sin Web Share API (la mayoría de navegadores de escritorio): abrir en
                    // pestaña nueva — desde ahí el usuario puede imprimir (Ctrl+P) o copiar el link.
                    window.open(shareUrl, '_blank');
                  }}
                  className="p-1.5 text-neutral-400 dark:text-white/30 hover:text-accent hover:bg-accent/10 rounded-lg transition-colors"
                  title="Compartir / Imprimir"
                >
                  <Share2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={async () => {
                    try {
                      const urlObj = new URL(archivo.url);
                      const pathParts = urlObj.pathname.split('/storage/v1/object/public/ticket-archivos/');
                      let downloadUrl = archivo.url;
                      if (pathParts.length > 1) {
                        const filePath = pathParts[1];
                        const { data } = await supabase.storage.from('ticket-archivos').createSignedUrl(filePath, 3600);
                        if (data) downloadUrl = data.signedUrl;
                      }
                      const link = document.createElement('a');
                      link.href = downloadUrl;
                      link.download = archivo.nombre;
                      link.target = '_blank';
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    } catch {
                      window.open(archivo.url, '_blank');
                    }
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 text-neutral-700 dark:text-white/80 rounded-lg transition-all font-semibold text-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  Bajar
                </button>
                {isAdmin && (
                  <button
                    onClick={() => handleDeleteArchivo(archivo.id)}
                    className="p-1.5 text-neutral-300 dark:text-white/20 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    title="Eliminar archivo"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {previewFile && (
        <FilePreviewModal
          isOpen={!!previewFile}
          onClose={() => setPreviewFile(null)}
          fileName={previewFile.nombre}
          fileUrl={previewFile.url}
          fileType={previewFile.tipo}
          fileSize={previewFile.tamano}
        />
      )}

      {/* Category picker modal */}
      {pendingFiles && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <Tag className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-neutral-900">Categoría del adjunto</h2>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {pendingFiles.length === 1
                      ? pendingFiles[0].name
                      : `${pendingFiles.length} archivos seleccionados`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPendingFiles(null)}
                className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors"
              >
                <X className="w-4 h-4 text-neutral-400" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                  Categoría <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedCategoriaId}
                  onChange={(e) => { setSelectedCategoriaId(e.target.value); setCategoriaError(false); }}
                  className={`w-full px-3 py-2 text-sm border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                    categoriaError ? 'border-red-400 bg-red-50' : 'border-neutral-200'
                  }`}
                >
                  <option value="">Selecciona una categoría...</option>
                  {categorias.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
                {categoriaError && (
                  <p className="flex items-center gap-1 mt-1.5 text-xs text-red-600">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    Debes seleccionar una categoría para continuar
                  </p>
                )}
              </div>
            </div>

            <div className="px-5 py-4 border-t border-neutral-100 flex justify-end gap-2">
              <button
                onClick={() => setPendingFiles(null)}
                className="px-4 py-2 text-sm text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmUpload}
                className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors font-semibold"
              >
                Subir archivo{pendingFiles.length > 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
