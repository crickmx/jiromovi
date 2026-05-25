import { useEffect, useState } from 'react';
import { Download, Search, FileText, File, Calendar } from 'lucide-react';
import { useSeguwallet } from '../lib/SeguwalletContext';
import { getSeguwalletSicasClients, logDownload } from '../lib/seguwalletAuth';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

interface Document {
  id: string;
  nombre_archivo: string;
  tipo_documento: string;
  numero_poliza: string;
  aseguradora_nombre: string;
  fecha_documento: string;
  url: string;
}

export function SeguwalletDescargas() {
  const { customer } = useSeguwallet();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [filtered, setFiltered] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    if (!customer) return;
    loadDocuments();
  }, [customer]);

  useEffect(() => {
    if (search.trim()) {
      const q = search.toLowerCase();
      setFiltered(documents.filter(d =>
        d.nombre_archivo?.toLowerCase().includes(q) ||
        d.numero_poliza?.toLowerCase().includes(q) ||
        d.tipo_documento?.toLowerCase().includes(q) ||
        d.aseguradora_nombre?.toLowerCase().includes(q)
      ));
    } else {
      setFiltered(documents);
    }
  }, [search, documents]);

  const loadDocuments = async () => {
    if (!customer) return;
    try {
      const clients = await getSeguwalletSicasClients(customer.id);
      if (clients.length === 0) {
        setDocuments([]);
        setLoading(false);
        return;
      }

      const clientIds = clients.map((c: any) => c.sicas_client_id);

      // Try to get documents from sicas_digital_files or centro_digital_archivos
      const { data } = await supabase
        .from('sicas_digital_files')
        .select('id, nombre_archivo, tipo_documento, numero_poliza, aseguradora_nombre, fecha_documento, url')
        .in('desp_id', clientIds)
        .order('fecha_documento', { ascending: false })
        .limit(100);

      setDocuments((data || []) as Document[]);
    } catch (err) {
      console.error('Error loading documents:', err);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (doc: Document) => {
    if (!customer) return;
    setDownloading(doc.id);
    try {
      await logDownload(customer.id, {
        document_id: doc.id,
        document_type: doc.tipo_documento,
        document_name: doc.nombre_archivo,
        policy_number: doc.numero_poliza,
      });

      if (doc.url) {
        window.open(doc.url, '_blank');
      }
    } catch (err) {
      console.error('Error downloading:', err);
    } finally {
      setDownloading(null);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-[3px] border-sky-200 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Centro de Descargas</h1>
        <p className="text-sm text-neutral-500 mt-1">Descarga tus documentos y recibos de polizas</p>
      </div>

      {/* Search */}
      <div className="bg-white rounded-2xl border border-neutral-200/50 shadow-sm p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, poliza, tipo..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50/50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-sky-300 transition-all"
          />
        </div>
      </div>

      {/* Documents */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-neutral-200/50 shadow-sm p-12 text-center">
          <File className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-neutral-500">
            {documents.length === 0 ? 'No hay documentos disponibles' : 'No se encontraron resultados'}
          </p>
          <p className="text-xs text-neutral-400 mt-1">
            {documents.length === 0 ? 'Los documentos apareceran aqui cuando esten disponibles' : 'Intenta con otra busqueda'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((doc) => (
            <div
              key={doc.id}
              className="bg-white rounded-2xl border border-neutral-200/50 shadow-sm p-4 hover:shadow-md hover:border-teal-100 transition-all flex items-center gap-4"
            >
              <div className="p-2.5 rounded-xl bg-teal-50 flex-shrink-0">
                <FileText className="w-5 h-5 text-teal-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-neutral-900 truncate">{doc.nombre_archivo || 'Documento'}</p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                  {doc.tipo_documento && (
                    <span className="text-xs text-neutral-500">{doc.tipo_documento}</span>
                  )}
                  {doc.numero_poliza && (
                    <span className="text-xs text-neutral-400">Poliza: {doc.numero_poliza}</span>
                  )}
                  {doc.fecha_documento && (
                    <span className="text-xs text-neutral-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(doc.fecha_documento)}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleDownload(doc)}
                disabled={downloading === doc.id}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all",
                  "bg-teal-50 text-teal-700 hover:bg-teal-100",
                  downloading === doc.id && "opacity-50 cursor-not-allowed"
                )}
              >
                <Download className="w-3.5 h-3.5" />
                {downloading === doc.id ? 'Descargando...' : 'Descargar'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
