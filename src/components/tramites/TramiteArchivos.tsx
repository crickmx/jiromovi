import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { FileText, Download, Upload, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface Archivo {
  id: string;
  nombre: string;
  url: string;
  tipo: string | null;
  tamano: number | null;
  fecha_subida: string;
  usuario: {
    nombre_completo: string;
  } | null;
}

interface TramiteArchivosProps {
  tramiteId: string;
}

export function TramiteArchivos({ tramiteId }: TramiteArchivosProps) {
  const { usuario } = useAuth();
  const [archivos, setArchivos] = useState<Archivo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadArchivos();

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
            .select('*, usuario:usuario_id(nombre_completo)')
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

  const loadArchivos = async () => {
    const { data } = await supabase
      .from('ticket_archivos')
      .select('*, usuario:usuario_id(nombre_completo)')
      .eq('ticket_id', tramiteId)
      .order('fecha_subida', { ascending: false });

    if (data) setArchivos(data as Archivo[]);
    setLoading(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !usuario) return;

    setUploading(true);
    const tempFiles: Archivo[] = [];

    try {
      for (const file of Array.from(files)) {
        const tempId = `temp-${Date.now()}-${Math.random()}`;
        const optimisticFile: Archivo = {
          id: tempId,
          nombre: file.name,
          url: '',
          tipo: file.type,
          tamano: file.size,
          fecha_subida: new Date().toISOString(),
          usuario: {
            nombre_completo: usuario.nombre_completo
          }
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

        const { data, error: dbError } = await supabase
          .from('ticket_archivos')
          .insert({
            ticket_id: tramiteId,
            usuario_id: usuario.id,
            nombre: file.name,
            url: publicUrl,
            tipo: file.type,
            tamano: file.size
          })
          .select('*, usuario:usuario_id(nombre_completo)')
          .single();

        if (dbError) throw dbError;

        setArchivos(prev =>
          prev.map(a => a.id === tempId ? data as Archivo : a)
        );
      }
    } catch (err: any) {
      console.error('Error uploading file:', err);
      alert('Error al subir el archivo');
      setArchivos(prev =>
        prev.filter(a => !tempFiles.some(tf => tf.id === a.id))
      );
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Desconocido';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  };

  const getFileIcon = (tipo: string | null) => {
    if (!tipo) return <FileText className="w-8 h-8 text-neutral-400" />;

    if (tipo.startsWith('image/')) {
      return <FileText className="w-8 h-8 text-primary-500" />;
    }
    if (tipo.includes('pdf')) {
      return <FileText className="w-8 h-8 text-red-500" />;
    }
    if (tipo.includes('word') || tipo.includes('document')) {
      return <FileText className="w-8 h-8 text-primary-600" />;
    }
    if (tipo.includes('excel') || tipo.includes('spreadsheet')) {
      return <FileText className="w-8 h-8 text-green-600" />;
    }
    return <FileText className="w-8 h-8 text-neutral-400" />;
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-neutral-900">
          Archivos Adjuntos ({archivos.length})
        </h3>
        <label
          htmlFor="file-upload-archivos"
          className="flex items-center space-x-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl cursor-pointer transition-all font-semibold"
        >
          <Upload className="w-5 h-5" />
          <span>{uploading ? 'Subiendo...' : 'Subir Archivo'}</span>
          <input
            id="file-upload-archivos"
            type="file"
            multiple
            onChange={handleFileUpload}
            disabled={uploading}
            className="hidden"
          />
        </label>
      </div>

      {archivos.length === 0 ? (
        <div className="text-center py-12 text-neutral-500">
          <FileText className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
          <p>No hay archivos adjuntos</p>
          <p className="text-sm mt-2">Sube el primer archivo para comenzar</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {archivos.map((archivo) => (
            <div
              key={archivo.id}
              className="border border-neutral-200 rounded-xl p-4 hover:shadow-medium transition-all"
            >
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  {getFileIcon(archivo.tipo)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-neutral-900 truncate" title={archivo.nombre}>
                    {archivo.nombre}
                  </p>
                  <p className="text-xs text-neutral-500 mt-1">
                    {formatFileSize(archivo.tamano)}
                  </p>
                  <p className="text-xs text-neutral-500 mt-1">
                    {new Date(archivo.fecha_subida).toLocaleDateString('es-MX', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </p>
                  {archivo.usuario && (
                    <p className="text-xs text-neutral-500 mt-1">
                      por {archivo.usuario.nombre_completo}
                    </p>
                  )}
                </div>
              </div>
              <a
                href={archivo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex items-center justify-center space-x-2 w-full px-3 py-2 bg-primary-100 hover:bg-primary-200 text-primary-700 rounded-lg transition-all font-semibold text-sm"
              >
                <Download className="w-4 h-4" />
                <span>Descargar</span>
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
