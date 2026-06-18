import { useState, useEffect, useCallback } from 'react';
import { Upload, FileText, Download, CircleCheck as CheckCircle2, Circle as XCircle, TriangleAlert as AlertTriangle, Loader as Loader2, Play, RefreshCw, Trash2, Clock, Database, Brain, ChartBar as BarChart3, FolderOpen, ChevronDown, ChevronRight, ExternalLink, MailWarning as FileWarning } from 'lucide-react';
import { PageHeader } from '../components/ui/page-header';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { EmptyState } from '../components/ui/empty-state';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface ImportJob {
  id: string;
  titulo: string;
  estado: string;
  archivo_html_nombre: string | null;
  total_links_encontrados: number;
  total_descargables: number;
  total_no_descargables: number;
  total_descargados: number;
  total_duplicados: number;
  total_errores: number;
  total_indexados: number;
  carpeta_destino_id: string | null;
  error_global: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

interface ImportItem {
  id: string;
  titulo: string;
  url_original: string;
  aseguradora: string | null;
  categoria: string | null;
  ramo: string | null;
  estado: string;
  es_descargable: boolean;
  tipo_mime_detectado: string | null;
  tamano_bytes: number | null;
  error_mensaje: string | null;
  nombre_archivo_original: string | null;
  extension: string | null;
}

interface Carpeta {
  id: string;
  nombre: string;
  enable_chava_ai: boolean;
}

const ESTADO_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  pending: { label: 'Pendiente', color: 'text-amber-400 bg-amber-400/10', icon: Clock },
  parsing: { label: 'Analizando HTML', color: 'text-blue-400 bg-blue-400/10', icon: Loader2 },
  downloading: { label: 'Descargando', color: 'text-cyan-400 bg-cyan-400/10', icon: Download },
  indexing: { label: 'Indexando IA', color: 'text-emerald-400 bg-emerald-400/10', icon: Brain },
  completed: { label: 'Completado', color: 'text-green-400 bg-green-400/10', icon: CheckCircle2 },
  error: { label: 'Error', color: 'text-red-400 bg-red-400/10', icon: XCircle },
  cancelled: { label: 'Cancelado', color: 'text-slate-400 bg-slate-400/10', icon: XCircle },
};

const ITEM_ESTADO_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pendiente', color: 'bg-amber-400/10 text-amber-400 border-amber-400/20' },
  downloading: { label: 'Descargando', color: 'bg-blue-400/10 text-blue-400 border-blue-400/20' },
  downloaded: { label: 'Descargado', color: 'bg-cyan-400/10 text-cyan-400 border-cyan-400/20' },
  stored: { label: 'Almacenado', color: 'bg-teal-400/10 text-teal-400 border-teal-400/20' },
  indexed: { label: 'Indexado', color: 'bg-green-400/10 text-green-400 border-green-400/20' },
  error: { label: 'Error', color: 'bg-red-400/10 text-red-400 border-red-400/20' },
  skipped: { label: 'Omitido', color: 'bg-slate-400/10 text-slate-400 border-slate-400/20' },
  duplicate: { label: 'Duplicado', color: 'bg-orange-400/10 text-orange-400 border-orange-400/20' },
};

export default function ImportacionMasivaCentroDigital() {
  const { usuario } = useAuth();
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<ImportJob | null>(null);
  const [jobItems, setJobItems] = useState<ImportItem[]>([]);
  const [carpetas, setCarpetas] = useState<Carpeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [indexing, setIndexing] = useState(false);
  const [itemFilter, setItemFilter] = useState<string>('all');
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  // Form state
  const [titulo, setTitulo] = useState('');
  const [carpetaDestinoId, setCarpetaDestinoId] = useState('');
  const [htmlFile, setHtmlFile] = useState<File | null>(null);

  useEffect(() => {
    loadJobs();
    loadCarpetas();
  }, []);

  useEffect(() => {
    if (selectedJob) {
      loadJobItems(selectedJob.id);
    }
  }, [selectedJob, itemFilter]);

  const loadJobs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('bulk_import_jobs')
      .select('*')
      .order('created_at', { ascending: false });
    setJobs(data || []);
    setLoading(false);
  };

  const loadCarpetas = async () => {
    const { data } = await supabase
      .from('centro_digital_carpetas')
      .select('id, nombre, enable_chava_ai')
      .eq('activa', true)
      .order('nombre');
    setCarpetas(data || []);
  };

  const loadJobItems = async (jobId: string) => {
    let query = supabase
      .from('bulk_import_items')
      .select('*')
      .eq('job_id', jobId)
      .order('aseguradora', { ascending: true });

    if (itemFilter !== 'all') {
      query = query.eq('estado', itemFilter);
    }

    const { data } = await query.limit(200);
    setJobItems(data || []);
  };

  const handleUploadHtml = async () => {
    if (!htmlFile || !carpetaDestinoId) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('html_file', htmlFile);
      formData.append('titulo', titulo || 'Importacion Masiva');
      formData.append('carpeta_destino_id', carpetaDestinoId);

      const { data: { session } } = await supabase.auth.getSession();
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bulk-import-parse-html`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al procesar HTML');
      }

      setHtmlFile(null);
      setTitulo('');
      await loadJobs();

      if (result.job_id) {
        const newJob = (await supabase.from('bulk_import_jobs').select('*').eq('id', result.job_id).single()).data;
        if (newJob) {
          setSelectedJob(newJob);
          setExpandedJob(newJob.id);
        }
      }
    } catch (err: any) {
      console.error('Upload error:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleStartDownloads = async (jobId: string) => {
    setProcessing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bulk-import-process-downloads`;

      let hasMore = true;
      let totalProcessed = 0;

      while (hasMore) {
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ job_id: jobId, batch_size: 5 }),
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error);

        totalProcessed += result.processed || 0;
        hasMore = (result.remaining || 0) > 0;

        // Refresh UI every batch
        await loadJobs();
        if (selectedJob?.id === jobId) {
          await loadJobItems(jobId);
        }
      }
    } catch (err: any) {
      console.error('Download processing error:', err);
      alert(`Error en descarga: ${err.message}`);
    } finally {
      setProcessing(false);
      await loadJobs();
    }
  };

  const handleStartIndexing = async (jobId: string) => {
    setIndexing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bulk-import-index-batch`;

      let hasMore = true;

      while (hasMore) {
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ job_id: jobId, batch_size: 3 }),
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error);

        hasMore = (result.remaining || 0) > 0;

        await loadJobs();
        if (selectedJob?.id === jobId) {
          await loadJobItems(jobId);
        }
      }
    } catch (err: any) {
      console.error('Indexing error:', err);
      alert(`Error en indexación: ${err.message}`);
    } finally {
      setIndexing(false);
      await loadJobs();
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    if (!confirm('Eliminar este job de importación y todos sus items?')) return;

    await supabase.from('bulk_import_jobs').delete().eq('id', jobId);
    if (selectedJob?.id === jobId) {
      setSelectedJob(null);
      setJobItems([]);
    }
    await loadJobs();
  };

  const formatBytes = (bytes: number | null) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
  };

  if (usuario?.rol !== 'Administrador') {
    return (
      <div className="p-8">
        <EmptyState icon={FileWarning} title="Acceso restringido" description="Solo administradores pueden acceder a esta sección." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Importación Masiva Centro Digital"
        description="Importa documentos de seguros desde archivos HTML al Centro Digital y activa la indexación para Chava AI"
        icon={Database}
      />

      {/* Upload Section */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h3 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Upload className="w-4 h-4 text-teal-600" />
          Nueva Importación
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Título del job</label>
            <Input
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              placeholder="Ej: Importación Mayo 2026"
              className="text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Carpeta destino *</label>
            <select
              value={carpetaDestinoId}
              onChange={e => setCarpetaDestinoId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
            >
              <option value="">Seleccionar carpeta...</option>
              {carpetas.map(c => (
                <option key={c.id} value={c.id}>
                  {c.nombre} {c.enable_chava_ai ? '(AI)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Archivo HTML *</label>
            <input
              type="file"
              accept=".html,.htm"
              onChange={e => setHtmlFile(e.target.files?.[0] || null)}
              className="w-full text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 file:cursor-pointer cursor-pointer"
            />
          </div>

          <div className="flex items-end">
            <Button
              onClick={handleUploadHtml}
              disabled={!htmlFile || !carpetaDestinoId || uploading}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white"
            >
              {uploading ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Analizando...</>
              ) : (
                <><Upload className="w-4 h-4 mr-2" /> Analizar HTML</>
              )}
            </Button>
          </div>
        </div>

        {!carpetas.some(c => c.enable_chava_ai) && (
          <p className="mt-3 text-xs text-amber-600 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Ninguna carpeta tiene Chava AI habilitado. Los documentos no se indexarán para la IA.
          </p>
        )}
      </div>

      {/* Jobs List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-slate-500" />
            Historial de Importaciones ({jobs.length})
          </h3>
          <Button onClick={loadJobs} variant="ghost" size="sm">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="p-8">
            <EmptyState icon={Database} title="Sin importaciones" description="Sube un archivo HTML para iniciar tu primera importación masiva." />
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {jobs.map(job => (
              <JobRow
                key={job.id}
                job={job}
                isExpanded={expandedJob === job.id}
                isSelected={selectedJob?.id === job.id}
                processing={processing}
                indexing={indexing}
                onToggle={() => {
                  setExpandedJob(expandedJob === job.id ? null : job.id);
                  setSelectedJob(job);
                }}
                onStartDownloads={() => handleStartDownloads(job.id)}
                onStartIndexing={() => handleStartIndexing(job.id)}
                onDelete={() => handleDeleteJob(job.id)}
                formatDate={formatDate}
              />
            ))}
          </div>
        )}
      </div>

      {/* Items Detail Panel */}
      {selectedJob && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">
              Documentos: {selectedJob.titulo}
            </h3>
            <div className="flex items-center gap-2">
              <select
                value={itemFilter}
                onChange={e => setItemFilter(e.target.value)}
                className="text-xs px-2 py-1 border border-slate-200 rounded-md"
              >
                <option value="all">Todos</option>
                <option value="pending">Pendientes</option>
                <option value="stored">Almacenados</option>
                <option value="indexed">Indexados</option>
                <option value="error">Errores</option>
                <option value="duplicate">Duplicados</option>
                <option value="skipped">Omitidos</option>
              </select>
              <span className="text-xs text-slate-500">{jobItems.length} items</span>
            </div>
          </div>

          {jobItems.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">No hay items con este filtro.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium text-slate-600">Título</th>
                    <th className="px-4 py-2.5 text-left font-medium text-slate-600">Aseguradora</th>
                    <th className="px-4 py-2.5 text-left font-medium text-slate-600">Categoría</th>
                    <th className="px-4 py-2.5 text-left font-medium text-slate-600">Ext</th>
                    <th className="px-4 py-2.5 text-left font-medium text-slate-600">Tamaño</th>
                    <th className="px-4 py-2.5 text-left font-medium text-slate-600">Estado</th>
                    <th className="px-4 py-2.5 text-left font-medium text-slate-600">Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {jobItems.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-2 max-w-[200px]">
                        <p className="truncate font-medium text-slate-700">{item.titulo}</p>
                        <a href={item.url_original} target="_blank" rel="noopener noreferrer" className="text-[10px] text-slate-400 hover:text-teal-500 truncate block">
                          {item.url_original}
                        </a>
                      </td>
                      <td className="px-4 py-2 text-slate-600">{item.aseguradora || '-'}</td>
                      <td className="px-4 py-2 text-slate-600">{item.categoria || '-'}</td>
                      <td className="px-4 py-2 text-slate-500 uppercase">{item.extension || '-'}</td>
                      <td className="px-4 py-2 text-slate-500">{formatBytes(item.tamano_bytes)}</td>
                      <td className="px-4 py-2">
                        <ItemEstadoBadge estado={item.estado} />
                      </td>
                      <td className="px-4 py-2 max-w-[150px]">
                        {item.error_mensaje && (
                          <p className="text-[10px] text-red-500 truncate" title={item.error_mensaje}>
                            {item.error_mensaje}
                          </p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function JobRow({ job, isExpanded, isSelected, processing, indexing, onToggle, onStartDownloads, onStartIndexing, onDelete, formatDate }: {
  job: ImportJob;
  isExpanded: boolean;
  isSelected: boolean;
  processing: boolean;
  indexing: boolean;
  onToggle: () => void;
  onStartDownloads: () => void;
  onStartIndexing: () => void;
  onDelete: () => void;
  formatDate: (d: string | null) => string;
}) {
  const config = ESTADO_CONFIG[job.estado] || ESTADO_CONFIG.pending;
  const Icon = config.icon;
  const isRunning = job.estado === 'downloading' || job.estado === 'indexing' || job.estado === 'parsing';
  const canDownload = job.estado === 'pending' && job.total_descargables > 0;
  const canIndex = (job.estado === 'completed' || job.estado === 'downloading') && job.total_descargados > 0;

  const progress = job.total_descargables > 0
    ? Math.round(((job.total_descargados + job.total_errores + job.total_duplicados) / job.total_descargables) * 100)
    : 0;

  return (
    <div className={`transition-colors ${isSelected ? 'bg-teal-50/30' : ''}`}>
      <div className="px-6 py-3 flex items-center gap-4 cursor-pointer hover:bg-slate-50/50" onClick={onToggle}>
        <button className="text-slate-400">
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-slate-800 truncate">{job.titulo}</p>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${config.color}`}>
              <Icon className={`w-3 h-3 ${isRunning ? 'animate-spin' : ''}`} />
              {config.label}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {job.archivo_html_nombre || 'Sin archivo'} | {formatDate(job.created_at)}
          </p>
        </div>

        {/* Stats */}
        <div className="hidden md:flex items-center gap-4 text-[11px]">
          <div className="text-center">
            <p className="font-semibold text-slate-700">{job.total_descargables}</p>
            <p className="text-slate-400">Archivos</p>
          </div>
          <div className="text-center">
            <p className="font-semibold text-green-600">{job.total_descargados}</p>
            <p className="text-slate-400">Descargados</p>
          </div>
          <div className="text-center">
            <p className="font-semibold text-emerald-600">{job.total_indexados}</p>
            <p className="text-slate-400">Indexados</p>
          </div>
          <div className="text-center">
            <p className="font-semibold text-red-500">{job.total_errores}</p>
            <p className="text-slate-400">Errores</p>
          </div>
          <div className="text-center">
            <p className="font-semibold text-orange-500">{job.total_duplicados}</p>
            <p className="text-slate-400">Duplicados</p>
          </div>
        </div>
      </div>

      {/* Expanded Actions */}
      {isExpanded && (
        <div className="px-6 pb-4 pt-1 ml-8 border-t border-slate-100">
          {/* Progress bar */}
          {job.total_descargables > 0 && (
            <div className="mb-3">
              <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                <span>Progreso descargas</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            {canDownload && (
              <Button
                onClick={e => { e.stopPropagation(); onStartDownloads(); }}
                disabled={processing}
                size="sm"
                className="bg-cyan-600 hover:bg-cyan-700 text-white text-xs"
              >
                {processing ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Download className="w-3 h-3 mr-1" />}
                Iniciar Descargas
              </Button>
            )}

            {canIndex && (
              <Button
                onClick={e => { e.stopPropagation(); onStartIndexing(); }}
                disabled={indexing}
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
              >
                {indexing ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Brain className="w-3 h-3 mr-1" />}
                Indexar para Chava AI
              </Button>
            )}

            <Button
              onClick={e => { e.stopPropagation(); onDelete(); }}
              variant="ghost"
              size="sm"
              className="text-red-500 hover:text-red-700 hover:bg-red-50 text-xs ml-auto"
            >
              <Trash2 className="w-3 h-3 mr-1" /> Eliminar
            </Button>
          </div>

          {job.error_global && (
            <p className="mt-2 text-xs text-red-500 flex items-center gap-1">
              <XCircle className="w-3 h-3 flex-shrink-0" />
              {job.error_global}
            </p>
          )}

          {/* Summary stats on mobile */}
          <div className="flex md:hidden items-center gap-3 mt-3 text-[10px] text-slate-500 flex-wrap">
            <span>{job.total_no_descargables} no descargables</span>
            <span>{job.total_duplicados} duplicados</span>
            {job.completed_at && <span>Completado: {formatDate(job.completed_at)}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function ItemEstadoBadge({ estado }: { estado: string }) {
  const config = ITEM_ESTADO_CONFIG[estado] || ITEM_ESTADO_CONFIG.pending;
  return (
    <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium border ${config.color}`}>
      {config.label}
    </span>
  );
}
