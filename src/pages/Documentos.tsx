import { useEffect, useState, useRef } from 'react';
import { FolderOpen, Download, FileText, Upload, Sparkles, Plus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

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
          <h1 className="text-xl font-bold text-slate-800">Documentos</h1>
          <p className="text-slate-500 text-sm mt-0.5">{docs.length} archivo{docs.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate('/seguwallet/chava', { state: { modulo: 'documentos' } })}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-sm font-medium hover:bg-emerald-100 transition-colors">
            <Sparkles className="w-4 h-4" />Ayúdame
          </button>
          <button onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-60">
            {uploading ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Plus className="w-4 h-4" />}
            Subir
          </button>
          <input ref={fileRef} type="file" className="hidden" onChange={handleUpload}
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx" />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
      ) : docs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <FolderOpen className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="font-semibold text-slate-600 mb-1">Sin documentos</p>
          <p className="text-sm text-slate-400 mb-4">Sube tus pólizas, condiciones generales o cualquier documento.</p>
          <button onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors">
            <Upload className="w-4 h-4" />Subir documento
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="divide-y divide-slate-50">
            {docs.map(doc => (
              <div key={doc.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors">
                <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{doc.nombre_archivo}</p>
                  <p className="text-xs text-slate-400">
                    {doc.tipo_documento} · {formatSize(doc.size_bytes)} · {new Date(doc.created_at).toLocaleDateString('es-MX')}
                  </p>
                </div>
                {doc.archivo_url && (
                  <a href={doc.archivo_url} target="_blank" rel="noopener noreferrer"
                    className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
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
