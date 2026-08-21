import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { supabaseUrl } from '../../lib/supabase';
import { FileText, Download, Upload, Eye, FolderDown, Trash2, Music, Video, FileSpreadsheet, FileType2, File, Tag, X, AlertCircle, Share2, Printer, Loader2, Check } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { FilePreviewModal } from './FilePreviewModal';
import { getPdfThumbnail } from '../../lib/pdfThumbnail';
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
  /** Administrador y lider del equipo del tramite pueden recategorizar un archivo ya subido. */
  puedeEditarCategoria?: boolean;
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

export function TramiteArchivos({ tramiteId, puedeEditarCategoria }: TramiteArchivosProps) {
  const { usuario } = useAuth();
  const isAdmin = usuario?.rol === 'Administrador';
  const [archivos, setArchivos] = useState<Archivo[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [previewFile, setPreviewFile] = useState<Archivo | null>(null);
  const [previewAutoPrint, setPreviewAutoPrint] = useState(false);
  const [editingCategoriaId, setEditingCategoriaId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const [extractionStatus, setExtractionStatus] = useState<Record<string, { estado: 'pendiente' | 'ok' | 'error'; mensaje?: string }>>({});
  const [tiposConfigAdjunto, setTiposConfigAdjunto] = useState<{ categoria_id: string; requerido: boolean; dispara_extraccion: boolean }[]>([]);

  // Category picker state
  const [pendingFiles, setPendingFiles] = useState<File[] | null>(null);
  const [pendingFileTypes, setPendingFileTypes] = useState<Record<number, string>>({});
  const [selectedCategoriaId, setSelectedCategoriaId] = useState('');
  const [categoriaError, setCategoriaError] = useState(false);

  useEffect(() => {
    loadArchivos();
    loadCategorias();
    loadTiposConfig();

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

  const loadTiposConfig = async () => {
    const { data: ticket } = await supabase.from('tickets').select('tipo_tramite').eq('id', tramiteId).single();
    if (!ticket?.tipo_tramite) return;
    const { data: tipo } = await supabase.from('ticket_tipos').select('id').eq('value', ticket.tipo_tramite).single();
    if (!tipo?.id) return;
    const { data: campos } = await supabase.from('tramite_tipo_campos').select('config').eq('tramite_tipo_id', tipo.id).eq('tipo', 'adjunto');
    const configs = (campos || []).flatMap(c => (c.config?.tipos_config || []) as { categoria_id: string; requerido: boolean; dispara_extraccion: boolean }[]);
    setTiposConfigAdjunto(configs.filter(tc => tc.categoria_id));
  };

  const loadArchivos = async () => {
    const [{ data }, { data: extraidos }] = await Promise.all([
      supabase
        .from('ticket_archivos')
        .select('*, usuarios!usuario_id(nombre_completo), categoria:maestro_adjunto_categorias!categoria_id(nombre)')
        .eq('ticket_id', tramiteId)
        .is('eliminado_at', null)
        .order('fecha_subida', { ascending: false }),
      supabase
        .from('poliza_datos_extraidos')
        .select('archivo_id, estado, error_detalle')
        .eq('ticket_id', tramiteId),
    ]);

    if (data) setArchivos(data as Archivo[]);
    if (extraidos) {
      const map: Record<string, { estado: 'pendiente' | 'ok' | 'error'; mensaje?: string }> = {};
      for (const e of extraidos) {
        if (e.archivo_id && e.estado !== 'no_reconocida') {
          map[e.archivo_id] = { estado: e.estado as any, mensaje: e.error_detalle ?? undefined };
        }
      }
      setExtractionStatus(map);
    }
    setLoading(false);
  };

  const handleCambiarCategoria = async (archivoId: string, nuevaCategoriaId: string) => {
    const categoriaObj = categorias.find(c => c.id === nuevaCategoriaId) ?? null;
    const { error } = await supabase
      .from('ticket_archivos')
      .update({ categoria_id: nuevaCategoriaId || null })
      .eq('id', archivoId);
    if (error) { showToast('No se pudo cambiar la categoría: ' + error.message, 'error'); return; }
    setArchivos(prev => prev.map(a => a.id === archivoId
      ? { ...a, categoria_id: nuevaCategoriaId || null, categoria: categoriaObj ? { nombre: categoriaObj.nombre } : null }
      : a));
    setEditingCategoriaId(null);
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
    const arr = Array.from(files);
    setPendingFiles(arr);
    setPendingFileTypes(tiposConfigAdjunto.length > 0 ? Object.fromEntries(arr.map((_, i) => [i, ''])) : {});
    setSelectedCategoriaId('');
    setCategoriaError(false);
    e.target.value = '';
  };

  // Step 2: confirm category and upload
  const handleConfirmUpload = async () => {
    const files = pendingFiles!;
    if (tiposConfigAdjunto.length > 0) {
      if (files.some((_, i) => !pendingFileTypes[i])) { setCategoriaError(true); return; }
      setPendingFiles(null);
      await doUpload(files.map((f, i) => ({ file: f, categoriaId: pendingFileTypes[i] })));
    } else {
      if (!selectedCategoriaId) { setCategoriaError(true); return; }
      setPendingFiles(null);
      await doUpload(files.map(f => ({ file: f, categoriaId: selectedCategoriaId })));
    }
  };

  const doUpload = async (items: { file: File; categoriaId: string }[]) => {
    if (!usuario) return;
    setUploading(true);
    const tempFiles: Archivo[] = [];
    const uploadedFileIds: string[] = [];

    try {
      for (const { file, categoriaId } of items) {
        const categoriaObj = categorias.find(c => c.id === categoriaId);
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

        const debeExtraer = tiposConfigAdjunto.some(
          tc => tc.dispara_extraccion && tc.categoria_id === insertData.categoria_id
        );
        if (debeExtraer) {
          triggerPolizaExtraccion(insertData.id);
        }
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

  const triggerPolizaExtraccion = async (archivoId: string) => {
    setExtractionStatus(prev => ({ ...prev, [archivoId]: { estado: 'pendiente' } }));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const resp = await fetch(`${supabaseUrl}/functions/v1/process-poliza-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ ticket_id: tramiteId, archivo_id: archivoId }),
      });
      const result = await resp.json();
      if (result.estado === 'no_configurado') {
        setExtractionStatus(prev => { const s = { ...prev }; delete s[archivoId]; return s; });
      } else if (result.ok) {
        setExtractionStatus(prev => ({ ...prev, [archivoId]: { estado: 'ok' } }));
        if (result.xlsx_error) {
          showToast(`Datos extraídos, pero falló el Excel: ${result.xlsx_error}`, 'error');
        } else {
          showToast('Datos de póliza extraídos correctamente. Excel SICAS generado.', 'success');
        }
      } else {
        const msg = result.error ?? 'Error al extraer datos del PDF';
        setExtractionStatus(prev => ({ ...prev, [archivoId]: { estado: 'error', mensaje: msg } }));
        showToast(`Error en extracción: ${msg}`, 'error');
      }
    } catch (err: any) {
      const msg = err?.message ?? 'Error de red al contactar el extractor';
      setExtractionStatus(prev => ({ ...prev, [archivoId]: { estado: 'error', mensaje: msg } }));
      showToast(`Error en extracción: ${msg}`, 'error');
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
    const [pdfError, setPdfError] = useState(false);
    const [pdfThumb, setPdfThumb] = useState<string | null>(null);
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

    useEffect(() => {
      if (!isPdf || !archivo.url) return;
      let cancelled = false;
      (async () => {
        const url = await getSignedFileUrl(archivo.url);
        const thumb = await getPdfThumbnail(url);
        if (cancelled) return;
        if (thumb) setPdfThumb(thumb); else setPdfError(true);
      })();
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
    if (isPdf && !pdfError) {
      if (!pdfThumb) {
        return <div className="w-full h-full bg-neutral-100 dark:bg-neutral-700 animate-pulse" />;
      }
      return (
        <img
          src={pdfThumb}
          alt={friendlyName(archivo.nombre)}
          className="w-full h-full object-cover object-top"
          onError={() => setPdfError(true)}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
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
                {extractionStatus[archivo.id] && (
                  <div className="absolute top-2 right-2 z-10">
                    {extractionStatus[archivo.id].estado === 'pendiente' && (
                      <div className="bg-amber-400 text-white rounded-full p-1 shadow" title="Extrayendo datos del PDF...">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      </div>
                    )}
                    {extractionStatus[archivo.id].estado === 'ok' && (
                      <div className="bg-green-500 text-white rounded-full p-1 shadow" title="Datos extraídos correctamente">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    )}
                    {extractionStatus[archivo.id].estado === 'error' && (
                      <div
                        className="bg-red-500 text-white rounded-full p-1 shadow cursor-help"
                        title={extractionStatus[archivo.id].mensaje || 'Error al extraer datos del PDF'}
                      >
                        <X className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </div>
                )}
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
                {extractionStatus[archivo.id]?.estado === 'pendiente' && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin shrink-0" /> Extrayendo datos…
                  </p>
                )}
                {extractionStatus[archivo.id]?.estado === 'ok' && (
                  <p className="text-[11px] text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
                    <Check className="w-3 h-3 shrink-0" /> Datos extraídos · Excel generado
                  </p>
                )}
                {extractionStatus[archivo.id]?.estado === 'error' && (
                  <p className="text-[11px] text-red-500 mt-1 leading-tight" title={extractionStatus[archivo.id].mensaje}>
                    <AlertCircle className="w-3 h-3 inline mr-0.5 shrink-0" />
                    Error: {extractionStatus[archivo.id].mensaje?.slice(0, 60) ?? 'Error al extraer datos'}
                  </p>
                )}
                {puedeEditarCategoria ? (
                  editingCategoriaId === archivo.id ? (
                    <select
                      autoFocus
                      value={archivo.categoria_id ?? ''}
                      onChange={(e) => handleCambiarCategoria(archivo.id, e.target.value)}
                      onBlur={() => setEditingCategoriaId(null)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1.5 w-full text-[11px] font-medium border border-blue-300 rounded px-1 py-0.5 bg-white dark:bg-neutral-800 dark:text-white"
                    >
                      <option value="">Sin categoría</option>
                      {categorias.map(c => (
                        <option key={c.id} value={c.id}>{c.nombre}</option>
                      ))}
                    </select>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingCategoriaId(archivo.id); }}
                      className="inline-flex items-center gap-1 mt-1.5 px-1.5 py-0.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded text-[10px] font-medium transition-colors"
                      title="Cambiar categoría"
                    >
                      <Tag className="w-2.5 h-2.5" />
                      {archivo.categoria?.nombre ?? 'Sin categoría'}
                    </button>
                  )
                ) : (
                  archivo.categoria && (
                    <span className="inline-flex items-center gap-1 mt-1.5 px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-medium">
                      <Tag className="w-2.5 h-2.5" />
                      {archivo.categoria.nombre}
                    </span>
                  )
                )}
              </div>

              {/* Actions */}
              <div className="px-3 pb-3 flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => { setPreviewFile(archivo); setPreviewAutoPrint(false); }}
                    className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-lg transition-all font-semibold text-xs"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Ver
                  </button>
                  <button
                    onClick={() => { setPreviewFile(archivo); setPreviewAutoPrint(true); }}
                    className="p-1.5 text-neutral-400 dark:text-white/30 hover:text-accent hover:bg-accent/10 rounded-lg transition-colors"
                    title="Imprimir"
                  >
                    <Printer className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={async () => {
                      const shareUrl = await getSignedFileUrl(archivo.url);
                      const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void>; canShare?: (data?: ShareData) => boolean };
                      if (nav.share) {
                        try {
                          await nav.share({ title: friendlyName(archivo.nombre), url: shareUrl });
                        } catch {
                          // usuario canceló el share nativo
                        }
                        return;
                      }
                      // Sin Web Share API (la mayoría de navegadores de escritorio): copiar el
                      // enlace en vez de solo abrir una pestaña, que confundía a los usuarios.
                      try {
                        await navigator.clipboard.writeText(shareUrl);
                        showToast('Enlace copiado al portapapeles');
                      } catch {
                        window.open(shareUrl, '_blank');
                      }
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-all font-semibold text-xs"
                    title="Compartir"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    Compartir
                  </button>
                </div>
                <div className="flex items-center gap-1.5">
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
            </div>
          ))}
        </div>
      )}

      {previewFile && (
        <FilePreviewModal
          isOpen={!!previewFile}
          onClose={() => { setPreviewFile(null); setPreviewAutoPrint(false); }}
          fileName={previewFile.nombre}
          fileUrl={previewFile.url}
          fileType={previewFile.tipo}
          fileSize={previewFile.tamano}
          autoPrint={previewAutoPrint}
        />
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-[60] px-4 py-3 rounded-xl shadow-lg text-sm font-semibold text-white ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
          {toast.message}
        </div>
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
              {tiposConfigAdjunto.length > 0 ? (
                /* Per-file type selector */
                <div className="space-y-2">
                  {(pendingFiles || []).map((f, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs text-neutral-500 truncate flex-1 min-w-0" title={f.name}>{f.name}</span>
                      <select
                        value={pendingFileTypes[i] || ''}
                        onChange={(e) => { setPendingFileTypes(prev => ({ ...prev, [i]: e.target.value })); setCategoriaError(false); }}
                        className={`shrink-0 w-36 px-2 py-1.5 text-xs border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          categoriaError && !pendingFileTypes[i] ? 'border-red-400 bg-red-50' : 'border-neutral-200'
                        }`}
                      >
                        <option value="">Tipo...</option>
                        {tiposConfigAdjunto.map(tc => {
                          const cat = categorias.find(c => c.id === tc.categoria_id);
                          return cat ? <option key={tc.categoria_id} value={tc.categoria_id}>{cat.nombre}</option> : null;
                        })}
                      </select>
                    </div>
                  ))}
                  {categoriaError && (
                    <p className="flex items-center gap-1 text-xs text-red-600">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      Elige el tipo de cada archivo
                    </p>
                  )}
                </div>
              ) : (
                /* Single category for all files (legacy) */
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
              )}
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
