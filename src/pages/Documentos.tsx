import { useEffect, useState, useRef } from 'react';
import { FolderOpen, Download, FileText, Upload, Sparkles, Plus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { LoadingState } from '../components/ui/loading-state';
import { EmptyState } from '../components/ui/empty-state';

interface Doc {
  id: string;
  nombre_archivo: string;
  tipo_documento: string;
  descripcion: string | null;
  archivo_url: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
}

export default function Documentos() {
  const { customer } = useAuth();
  const navigate = useNavigate();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!customer) return;
    loadDocs();
  }, [customer]);

  async function loadDocs() {
    const { data } = await supabase
      .from('seguwallet_customer_documents')
      .select('*')
      .eq('seguwallet_customer_id', customer!.id)
      .order('created_at', { ascending: false });
    setDocs(data || []);
    setLoading(false);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !customer) return;
    setUploading(true);
    try {
      const path = `${customer.id}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from('seguwallet-docs').upload(path, file);
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('seguwallet-docs').getPublicUrl(path);
      await supabase.from('seguwallet_customer_documents').insert({
        seguwallet_customer_id: customer.id,
        nombre_archivo: file.name,
        tipo_documento: 'documento',
        archivo_path: path,
        archivo_url: urlData.publicUrl,
        mime_type: file.type,
        size_bytes: file.size,
        subido_por: (await supabase.auth.getUser()).data.user?.id,
      });
      await loadDocs();
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function formatSize(bytes: number | null) {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-white">Documentos</h1>
          <p className="text-neutral-500 dark:text-white/50 text-sm mt-0.5">{docs.length} archivo{docs.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate('/seguwallet/chava', { state: { modulo: 'documentos' } })}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-sm font-medium hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors">
            <Sparkles className="w-4 h-4" />Ayúdame
          </button>
          <button onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-60">
            {uploading
              ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : <Plus className="w-4 h-4" />}
            Subir
          </button>
          <input ref={fileRef} type="file" className="hidden" onChange={handleUpload}
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx" />
        </div>
      </div>

      {loading ? (
        <LoadingState compact />
      ) : docs.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="Sin documentos"
          description="Sube tus pólizas, condiciones generales o cualquier documento."
          action={{ label: 'Subir documento', onClick: () => fileRef.current?.click() }}
          compact
        />
      ) : (
        <div className="bg-white dark:bg-neutral-800/60 rounded-2xl border border-neutral-200/60 dark:border-white/8 overflow-hidden">
          <div className="divide-y divide-neutral-100 dark:divide-white/5">
            {docs.map(doc => (
              <div key={doc.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-neutral-50 dark:hover:bg-white/4 transition-colors">
                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-500/15 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-800 dark:text-white truncate">{doc.nombre_archivo}</p>
                  <p className="text-xs text-neutral-400 dark:text-white/30">
                    {doc.tipo_documento} · {formatSize(doc.size_bytes)} · {new Date(doc.created_at).toLocaleDateString('es-MX')}
                  </p>
                </div>
                {doc.archivo_url && (
                  <a href={doc.archivo_url} target="_blank" rel="noopener noreferrer"
                    className="p-2 rounded-lg text-neutral-400 dark:text-white/30 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/15 transition-colors">
                    <Download className="w-4 h-4" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
