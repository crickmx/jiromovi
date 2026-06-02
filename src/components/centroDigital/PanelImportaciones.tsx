import { useState, useEffect } from 'react';
import { RefreshCw, CircleCheck as CheckCircle, CircleAlert as AlertCircle, Clock, Download, Brain, FileText, ChevronDown, ChevronUp, Play } from 'lucide-react';
import { Button } from '../ui/button';
import { supabase } from '../../lib/supabase';

interface BulkImportJob {
  id: string;
  titulo: string;
  estado: string;
  archivo_html_nombre: string | null;
  total_links_encontrados: number;
  total_descargables: number;
  total_descargados: number;
  total_duplicados: number;
  total_errores: number;
  total_indexados: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  carpeta_destino?: { nombre: string } | null;
  iniciador?: { nombre_completo: string } | null;
}

const ESTADO_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  parsing: { label: 'Analizando', color: 'text-blue-600 bg-blue-50 border-blue-100', icon: RefreshCw },
  pending: { label: 'Pendiente', color: 'text-amber-600 bg-amber-50 border-amber-100', icon: Clock },
  downloading: { label: 'Descargando', color: 'text-blue-600 bg-blue-50 border-blue-100', icon: Download },
  indexing: { label: 'Indexando', color: 'text-emerald-600 bg-emerald-50 border-emerald-100', icon: Brain },
  completed: { label: 'Completado', color: 'text-green-700 bg-green-50 border-green-100', icon: CheckCircle },
  error: { label: 'Error', color: 'text-red-600 bg-red-50 border-red-100', icon: AlertCircle },
  cancelled: { label: 'Cancelado', color: 'text-gray-500 bg-gray-50 border-gray-100', icon: AlertCircle },
};

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
}

function StatusBadge({ estado }: { estado: string }) {
  const cfg = ESTADO_CONFIG[estado] || ESTADO_CONFIG.pending;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
      <Icon className={`w-3 h-3 ${['parsing', 'downloading', 'indexing'].includes(estado) ? 'animate-spin' : ''}`} />
      {cfg.label}
    </span>
  );
}

function ProgressBar({ value, total, color = 'bg-blue-500' }: { value: number; total: number; color?: string }) {
  const pct = total > 0 ? Math.min(100, (value / total) * 100) : 0;
  return (
    <div className="w-full bg-gray-100 rounded-full h-1.5">
      <div className={`${color} h-1.5 rounded-full transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

interface ResumeHandler {
  (jobId: string): Promise<void>;
}

interface JobRowProps {
  job: BulkImportJob;
  onResume: ResumeHandler;
}

function JobRow({ job, onResume }: JobRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [resuming, setResuming] = useState(false);

  const canResume = ['pending', 'downloading'].includes(job.estado);
  const isActive = ['parsing', 'downloading', 'indexing'].includes(job.estado);
  const total = job.total_descargables || 0;
  const downloaded = job.total_descargados || 0;
  const indexed = job.total_indexados || 0;

  async function handleResume() {
    setResuming(true);
    await onResume(job.id);
    setResuming(false);
  }

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <div
        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
          <FileText className="w-4 h-4 text-slate-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-900 truncate">{job.titulo}</p>
            <StatusBadge estado={job.estado} />
          </div>
          <p className="text-xs text-gray-500 mt-0.5 truncate">
            {job.archivo_html_nombre || 'sin archivo'} · {formatDate(job.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {total > 0 && (
            <div className="hidden sm:block w-28">
              <ProgressBar
                value={job.estado === 'indexing' || job.estado === 'completed' ? indexed : downloaded}
                total={total}
                color={job.estado === 'completed' ? 'bg-green-500' : 'bg-blue-500'}
              />
              <p className="text-xs text-gray-400 mt-0.5 text-right">
                {job.estado === 'completed' ? indexed : downloaded}/{total}
              </p>
            </div>
          )}
          {canResume && (
            <Button
              size="sm"
              variant="outline"
              onClick={e => { e.stopPropagation(); handleResume(); }}
              disabled={resuming}
            >
              {resuming
                ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                : <><Play className="w-3.5 h-3.5 mr-1" />Reanudar</>
              }
            </Button>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-50 bg-gray-50 px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          {[
            { label: 'Descargables', value: total, color: 'text-blue-600' },
            { label: 'Descargados', value: downloaded, color: 'text-green-600' },
            { label: 'Indexados', value: indexed, color: 'text-emerald-600' },
            { label: 'Duplicados', value: job.total_duplicados || 0, color: 'text-amber-600' },
            { label: 'Errores', value: job.total_errores || 0, color: 'text-red-500' },
            { label: 'Total enlaces', value: job.total_links_encontrados || 0, color: 'text-gray-600' },
          ].map(({ label, value, color }) => (
            <div key={label}>
              <p className="text-gray-400">{label}</p>
              <p className={`font-semibold text-sm ${color}`}>{value}</p>
            </div>
          ))}
          {job.carpeta_destino && (
            <div className="col-span-2">
              <p className="text-gray-400">Carpeta destino</p>
              <p className="font-medium text-gray-700 truncate">{job.carpeta_destino.nombre}</p>
            </div>
          )}
          {job.iniciador && (
            <div className="col-span-2">
              <p className="text-gray-400">Iniciado por</p>
              <p className="font-medium text-gray-700">{job.iniciador.nombre_completo}</p>
            </div>
          )}
          {job.completed_at && (
            <div className="col-span-2">
              <p className="text-gray-400">Completado</p>
              <p className="font-medium text-gray-700">{formatDate(job.completed_at)}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface Props {
  onResumeJob?: (jobId: string) => void;
}

export function PanelImportaciones({ onResumeJob }: Props) {
  const [jobs, setJobs] = useState<BulkImportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [resumingId, setResumingId] = useState<string | null>(null);

  useEffect(() => {
    loadJobs();
  }, []);

  async function loadJobs() {
    setLoading(true);
    const { data } = await supabase
      .from('bulk_import_jobs')
      .select(`
        id, titulo, estado, archivo_html_nombre,
        total_links_encontrados, total_descargables, total_descargados,
        total_duplicados, total_errores, total_indexados,
        started_at, completed_at, created_at,
        carpeta_destino:centro_digital_carpetas(nombre),
        iniciador:usuarios!bulk_import_jobs_iniciado_por_fkey(nombre_completo)
      `)
      .order('created_at', { ascending: false })
      .limit(50);
    setJobs((data as any[]) || []);
    setLoading(false);
  }

  async function handleResume(jobId: string) {
    setResumingId(jobId);
    if (onResumeJob) {
      onResumeJob(jobId);
    }
    setResumingId(null);
    await loadJobs();
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="border border-gray-100 rounded-xl p-4 animate-pulse">
            <div className="flex gap-3">
              <div className="w-9 h-9 bg-gray-200 rounded-lg" />
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-2" />
                <div className="h-3 bg-gray-100 rounded w-1/3" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500">No hay importaciones registradas</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm text-gray-500">{jobs.length} importacion{jobs.length !== 1 ? 'es' : ''}</p>
        <button onClick={loadJobs} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
      {jobs.map(job => (
        <JobRow key={job.id} job={job} onResume={handleResume} />
      ))}
    </div>
  );
}
