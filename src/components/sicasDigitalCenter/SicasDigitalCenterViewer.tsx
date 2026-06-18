import { useState, useEffect, useCallback } from 'react';
import {
  Folder, FolderOpen, FileText, FileImage, File, Download, Eye,
  RefreshCw, X, Search, ChevronRight, ChevronDown, AlertCircle,
  FolderOpen as FolderOpenIcon, Loader2, Clock, CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getSicasDigitalCenter } from '@/lib/sicasDigitalCenterService';
import type { CentroDigitalParams, CentroDigitalFile, CentroDigitalFolder, CentroDigitalResult } from '@/lib/sicasDigitalCenterTypes';

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export type ViewerMode = 'modal' | 'drawer' | 'embedded';

interface Props {
  params: CentroDigitalParams;
  mode?: ViewerMode;
  title?: string;
  /** Only used in modal / drawer mode */
  open?: boolean;
  onClose?: () => void;
  className?: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function getFileIcon(ext: string) {
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext))
    return <FileImage className="w-4 h-4 text-sky-500 flex-shrink-0" />;
  if (ext === 'pdf')
    return <FileText className="w-4 h-4 text-red-500 flex-shrink-0" />;
  return <File className="w-4 h-4 text-neutral-400 flex-shrink-0" />;
}

function formatDate(raw: string) {
  if (!raw) return '';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ──────────────────────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────────────────────

function FileRow({ file }: { file: CentroDigitalFile }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800/50 group transition-colors">
      {getFileIcon(file.extension)}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-neutral-800 dark:text-neutral-100 truncate">{file.nombre_archivo}</p>
        <p className="text-xs text-neutral-400 mt-0.5">
          {file.tamanio_legible}
          {file.fecha_subida ? ` · ${formatDate(file.fecha_subida)}` : ''}
        </p>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {file.can_preview && (
          <button
            className="p-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors"
            title="Vista previa"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
        )}
        {file.can_download && (
          <button
            className="p-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors"
            title="Descargar"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function FolderTree({
  folders,
  search,
}: {
  folders: CentroDigitalFolder[];
  search: string;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    folders.forEach(f => { init[f.id] = true; });
    return init;
  });

  const toggle = (id: string) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const filteredFolders = folders.map(folder => ({
    ...folder,
    files: search
      ? folder.files.filter(f =>
          f.nombre_archivo.toLowerCase().includes(search.toLowerCase())
        )
      : folder.files,
  })).filter(f => !search || f.files.length > 0);

  if (filteredFolders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-neutral-400">
        <Search className="w-8 h-8 mb-2 opacity-40" />
        <p className="text-sm">Sin resultados para "{search}"</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {filteredFolders.map(folder => {
        const isOpen = expanded[folder.id] !== false;
        return (
          <div key={folder.id}>
            <button
              onClick={() => toggle(folder.id)}
              className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors text-left"
            >
              {isOpen
                ? <ChevronDown className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
                : <ChevronRight className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />}
              {isOpen
                ? <FolderOpen className="w-4 h-4 text-amber-500 flex-shrink-0" />
                : <Folder className="w-4 h-4 text-amber-500 flex-shrink-0" />}
              <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-200 flex-1 truncate">
                {folder.name}
              </span>
              <span className="text-xs text-neutral-400 ml-auto flex-shrink-0">
                {folder.files.length} archivo{folder.files.length !== 1 ? 's' : ''}
              </span>
            </button>
            {isOpen && (
              <div className="ml-6 border-l border-neutral-100 dark:border-neutral-800 pl-2 space-y-0.5 mb-1">
                {folder.files.map(file => (
                  <FileRow key={file.id} file={file} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Empty + Error + Loading states
// ──────────────────────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-neutral-400">
      <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      <p className="text-sm font-medium">Consultando Centro Digital SICAS...</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-neutral-400">
      <FolderOpenIcon className="w-12 h-12 opacity-30" />
      <p className="text-sm font-semibold">Sin archivos</p>
      <p className="text-xs text-center max-w-xs">
        Este documento no tiene archivos registrados en el Centro Digital de SICAS.
      </p>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-neutral-500">
      <AlertCircle className="w-10 h-10 text-red-400" />
      <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">No se pudo cargar</p>
      <p className="text-xs text-center max-w-xs text-neutral-400">{message}</p>
      <button
        onClick={onRetry}
        className="mt-2 flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
      >
        <RefreshCw className="w-3.5 h-3.5" /> Reintentar
      </button>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Main viewer body
// ──────────────────────────────────────────────────────────────────────────────

function ViewerBody({
  params,
  title,
  onClose,
  showClose,
}: {
  params: CentroDigitalParams;
  title: string;
  onClose?: () => void;
  showClose: boolean;
}) {
  const [result, setResult] = useState<CentroDigitalResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const res = await getSicasDigitalCenter({ ...params, forceRefresh: force });
      setResult(res);
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    load(false);
  }, [load]);

  const handleRefresh = () => load(true);

  const sourceLabel = result?.source === 'cache' ? 'cache' : 'SICAS live';

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-neutral-100 dark:border-neutral-800 flex-shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
            <FolderOpen className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white truncate">{title}</h3>
            <p className="text-[10px] text-neutral-400 uppercase tracking-wider font-medium">Centro Digital SICAS</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {result && (
            <span className={cn(
              'flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full',
              result.source === 'cache'
                ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400'
                : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400'
            )}>
              {result.source === 'cache' ? <Clock className="w-2.5 h-2.5" /> : <CheckCircle2 className="w-2.5 h-2.5" />}
              {sourceLabel}
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="p-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-400 hover:text-neutral-700 dark:hover:text-white transition-colors disabled:opacity-50"
            title="Actualizar desde SICAS"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
          </button>
          {showClose && onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-400 hover:text-neutral-700 dark:hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      {result?.has_files && (
        <div className="px-4 py-2.5 border-b border-neutral-100 dark:border-neutral-800 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
            <input
              type="text"
              placeholder="Buscar archivos..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Summary strip */}
      {result?.has_files && !loading && (
        <div className="px-4 py-2 flex items-center gap-2 bg-neutral-50 dark:bg-neutral-900/50 border-b border-neutral-100 dark:border-neutral-800 flex-shrink-0">
          <span className="text-xs text-neutral-500">
            <span className="font-semibold text-neutral-700 dark:text-neutral-200">{result.total_files}</span> archivos
            en <span className="font-semibold text-neutral-700 dark:text-neutral-200">{result.folders.length}</span> carpeta{result.folders.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-3 py-2 min-h-0">
        {loading ? (
          <LoadingState />
        ) : !result?.success ? (
          <ErrorState message={result?.error || 'Error desconocido'} onRetry={handleRefresh} />
        ) : !result.has_files ? (
          <EmptyState />
        ) : (
          <FolderTree folders={result.folders} search={search} />
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Export: main component with mode switching
// ──────────────────────────────────────────────────────────────────────────────

export function SicasDigitalCenterViewer({
  params,
  mode = 'modal',
  title = 'Archivos del documento',
  open = false,
  onClose,
  className,
}: Props) {
  if (mode === 'embedded') {
    return (
      <div className={cn('border border-neutral-200 dark:border-neutral-700 rounded-xl overflow-hidden bg-white dark:bg-neutral-900', className)}>
        <ViewerBody params={params} title={title} showClose={false} />
      </div>
    );
  }

  if (mode === 'drawer') {
    if (!open) return null;
    return (
      <>
        <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
        <div className={cn(
          'fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-neutral-900 z-50 shadow-2xl flex flex-col',
          'translate-x-0 transition-transform duration-300',
        )}>
          <ViewerBody params={params} title={title} onClose={onClose} showClose />
        </div>
      </>
    );
  }

  // modal (default)
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className={cn(
        'relative bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-lg flex flex-col',
        'max-h-[80vh]',
        className,
      )}>
        <ViewerBody params={params} title={title} onClose={onClose} showClose />
      </div>
    </div>
  );
}
