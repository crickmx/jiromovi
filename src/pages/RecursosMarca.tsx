import { useState, useEffect, useRef } from 'react';
import { Upload, Trash2, Download, X, Image, FileText, FileArchive, File, Search, AlertTriangle, Loader2, CheckCircle2, ZoomIn } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { LoadingState } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';

const BUCKET = 'recursos-marca';

const CARPETAS = [
  { key: '', label: 'Todos' },
  { key: 'logos/', label: 'Logos' },
  { key: 'plantillas/', label: 'Plantillas' },
  { key: 'guias/', label: 'Guías' },
  { key: 'otros/', label: 'Otros' },
];

interface Recurso {
  name: string;
  fullPath: string;
  size: number;
  url: string;
  mimeGuess: string;
}

function guessMime(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  if (['zip', 'rar', '7z'].includes(ext)) return 'archive';
  return 'file';
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function FileIcon({ tipo, className }: { tipo: string; className?: string }) {
  if (tipo === 'image') return <Image className={className} />;
  if (tipo === 'pdf') return <FileText className={className} />;
  if (tipo === 'archive') return <FileArchive className={className} />;
  return <File className={className} />;
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export default function RecursosMarca() {
  const { usuario } = useAuth();
  const isAdmin = usuario?.rol === 'Administrador';
  const [recursos, setRecursos] = useState<Recurso[]>([]);
  const [loading, setLoading] = useState(true);
  const [bucketError, setBucketError] = useState(false);
  const [carpeta, setCarpeta] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [subiendo, setSubiendo] = useState(false);
  const [eliminando, setEliminando] = useState<string | null>(null);
  const [ampliado, setAmpliado] = useState<Recurso | null>(null);
  const [carpetaUpload, setCarpetaUpload] = useState('logos/');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [configurando, setConfigurando] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { cargar(); }, [carpeta]);

  async function cargar() {
    setLoading(true);
    setBucketError(false);

    // Si hay carpeta seleccionada, listar solo esa; si no, listar todas
    const prefijos = carpeta ? [carpeta] : CARPETAS.filter(c => c.key).map(c => c.key);

    const resultados: Recurso[] = [];

    for (const prefijo of prefijos) {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .list(prefijo.replace(/\/$/, ''), { limit: 500, sortBy: { column: 'name', order: 'asc' } });

      if (error) {
        const msg = (error.message ?? '').toLowerCase();
        if (msg.includes('not found') || msg.includes('bucket') || msg.includes('does not exist')) {
          setBucketError(true);
          setLoading(false);
          return;
        }
        continue;
      }

      for (const archivo of data ?? []) {
        if (archivo.id === null) continue; // carpeta vacía
        const fullPath = `${prefijo}${archivo.name}`;
        const { data: signedData } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(fullPath, 3600);

        resultados.push({
          name: archivo.name,
          fullPath,
          size: archivo.metadata?.size ?? 0,
          url: signedData?.signedUrl ?? '',
          mimeGuess: guessMime(archivo.name),
        });
      }
    }

    setRecursos(resultados);
    setLoading(false);
  }

  async function subir(files: FileList | null) {
    if (!files?.length || !isAdmin) return;
    setSubiendo(true);
    setUploadError(null);

    const errores: string[] = [];
    for (const file of Array.from(files)) {
      const path = `${carpetaUpload}${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
      if (error) errores.push(`${file.name}: ${error.message}`);
    }

    if (errores.length) setUploadError(errores.join(' · '));
    await cargar();
    setSubiendo(false);
  }

  async function eliminar(recurso: Recurso) {
    if (!isAdmin) return;
    setEliminando(recurso.fullPath);
    await supabase.storage.from(BUCKET).remove([recurso.fullPath]);
    setRecursos(prev => prev.filter(r => r.fullPath !== recurso.fullPath));
    if (ampliado?.fullPath === recurso.fullPath) setAmpliado(null);
    setEliminando(null);
  }

  async function configurarBucket() {
    if (!isAdmin) return;
    setConfigurando(true);
    setConfigError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/setup-recursos-marca`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error desconocido');
      await cargar();
    } catch (e) {
      setConfigError(e instanceof Error ? e.message : 'Error al configurar');
    } finally {
      setConfigurando(false);
    }
  }

  function descargar(recurso: Recurso) {
    const a = document.createElement('a');
    a.href = recurso.url;
    a.download = recurso.name;
    a.target = '_blank';
    a.click();
  }

  const filtrados = recursos.filter(r =>
    busqueda === '' || norm(r.name).includes(norm(busqueda))
  );

  if (!usuario) return null;

  if (bucketError) {
    return (
      <div className="rounded-2xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-white/5 p-8 flex flex-col items-center text-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
          <AlertTriangle className="w-7 h-7 text-amber-500" />
        </div>
        <div>
          <p className="text-base font-semibold text-neutral-800 dark:text-white">Brand Kit no configurado</p>
          <p className="text-sm text-neutral-500 dark:text-white/50 mt-1 max-w-sm">
            El almacenamiento de archivos aún no está activo.
            {isAdmin ? ' Haz clic en el botón para configurarlo automáticamente.' : ' Pide a un administrador que lo configure.'}
          </p>
        </div>
        {isAdmin && (
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={configurarBucket}
              disabled={configurando}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent-hover transition disabled:opacity-60"
            >
              {configurando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {configurando ? 'Configurando…' : 'Configurar Brand Kit'}
            </button>
            {configError && (
              <p className="text-xs text-red-600 dark:text-red-400">{configError}</p>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* Barra de herramientas */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Filtro por carpeta */}
        <div className="flex gap-1 flex-wrap">
          {CARPETAS.map(c => (
            <button
              key={c.key}
              onClick={() => setCarpeta(c.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${
                carpeta === c.key
                  ? 'bg-accent text-white'
                  : 'bg-neutral-100 dark:bg-white/8 text-neutral-600 dark:text-white/60 hover:bg-neutral-200 dark:hover:bg-white/12'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Búsqueda */}
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
          <input
            type="text"
            placeholder="Buscar archivo…"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm rounded-xl border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 text-neutral-800 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        {/* Upload (solo admins) */}
        {isAdmin && (
          <div className="flex items-center gap-2">
            <select
              value={carpetaUpload}
              onChange={e => setCarpetaUpload(e.target.value)}
              className="text-xs px-2 py-1.5 rounded-xl border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 text-neutral-700 dark:text-white focus:outline-none"
            >
              {CARPETAS.filter(c => c.key).map(c => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </select>
            <button
              onClick={() => inputRef.current?.click()}
              disabled={subiendo}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent text-white text-xs font-semibold hover:bg-accent-hover transition disabled:opacity-60"
            >
              <Upload className="w-3.5 h-3.5" />
              {subiendo ? 'Subiendo…' : 'Subir'}
            </button>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.zip,.svg"
              className="hidden"
              onChange={e => subir(e.target.files)}
            />
          </div>
        )}
      </div>

      {uploadError && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-2.5">
          {uploadError}
        </p>
      )}

      {/* Contenido */}
      {loading ? (
        <LoadingState text="Cargando recursos…" compact />
      ) : filtrados.length === 0 ? (
        <EmptyState
          icon={Image}
          title="Sin archivos"
          description={busqueda ? 'No hay archivos que coincidan con la búsqueda.' : 'Aún no se han subido recursos de marca.'}
          compact
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {filtrados.map(recurso => (
            <div
              key={recurso.fullPath}
              className="group relative bg-white dark:bg-white/3 border border-neutral-200 dark:border-white/8 rounded-2xl overflow-hidden hover:shadow-md transition"
            >
              {/* Thumbnail o ícono */}
              <div
                className="aspect-square bg-neutral-50 dark:bg-white/5 flex items-center justify-center cursor-pointer overflow-hidden"
                onClick={() => recurso.mimeGuess === 'image' && setAmpliado(recurso)}
              >
                {recurso.mimeGuess === 'image' ? (
                  <img
                    src={recurso.url}
                    alt={recurso.name}
                    className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-300"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <FileIcon
                    tipo={recurso.mimeGuess}
                    className="w-10 h-10 text-neutral-300 dark:text-white/20"
                  />
                )}
                {recurso.mimeGuess === 'image' && (
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <ZoomIn className="w-6 h-6 text-white drop-shadow" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-2">
                <p className="text-xs font-medium text-neutral-700 dark:text-white/80 truncate" title={recurso.name}>
                  {recurso.name}
                </p>
                <p className="text-[10px] text-neutral-400 mt-0.5">{formatBytes(recurso.size)}</p>
              </div>

              {/* Acciones */}
              <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                <button
                  onClick={() => descargar(recurso)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-white dark:bg-neutral-800 shadow text-neutral-600 dark:text-white/70 hover:text-accent transition"
                  title="Descargar"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
                {isAdmin && (
                  <button
                    onClick={() => eliminar(recurso)}
                    disabled={eliminando === recurso.fullPath}
                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-white dark:bg-neutral-800 shadow text-neutral-600 dark:text-white/70 hover:text-red-500 transition disabled:opacity-50"
                    title="Eliminar"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {ampliado && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setAmpliado(null)}
        >
          <button
            className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition"
            onClick={() => setAmpliado(null)}
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={ampliado.url}
            alt={ampliado.name}
            className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3">
            <span className="text-white/80 text-sm">{ampliado.name}</span>
            <button
              onClick={e => { e.stopPropagation(); descargar(ampliado); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 text-white text-xs font-medium hover:bg-white/20 transition"
            >
              <Download className="w-3.5 h-3.5" />
              Descargar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
