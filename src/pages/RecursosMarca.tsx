import { useState, useEffect, useRef } from 'react';
import { Upload, Trash2, Download, X, Image, FileText, FileArchive, File, Search, AlertTriangle, Copy, CheckCircle, ZoomIn } from 'lucide-react';
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
  const { usuario, isAdmin } = useAuth();
  const [recursos, setRecursos] = useState<Recurso[]>([]);
  const [loading, setLoading] = useState(true);
  const [bucketError, setBucketError] = useState(false);
  const [carpeta, setCarpeta] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [subiendo, setSubiendo] = useState(false);
  const [eliminando, setEliminando] = useState<string | null>(null);
  const [sqlCopiado, setSqlCopiado] = useState(false);
  const [ampliado, setAmpliado] = useState<Recurso | null>(null);
  const [carpetaUpload, setCarpetaUpload] = useState('logos/');
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
        if (error.message?.includes('not found') || error.message?.includes('Bucket')) {
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

    for (const file of Array.from(files)) {
      const path = `${carpetaUpload}${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
      await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
    }

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

  const BUCKET_SQL = `-- Ejecuta en Supabase Dashboard → SQL Editor
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('recursos-marca', 'recursos-marca', false, 52428800,
  ARRAY['image/png','image/jpeg','image/webp','image/svg+xml','application/pdf','application/zip','image/gif'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY IF NOT EXISTS "Auth read recursos-marca"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'recursos-marca' AND auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "Admin insert recursos-marca"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'recursos-marca' AND
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador'));

CREATE POLICY IF NOT EXISTS "Admin delete recursos-marca"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'recursos-marca' AND
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'Administrador'));`;

  if (!usuario) return null;

  if (bucketError) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 space-y-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Bucket "recursos-marca" no encontrado</p>
            <p className="text-xs text-amber-700 mt-1">
              Ejecuta el siguiente SQL en <strong>Supabase Dashboard → SQL Editor</strong> para crear el bucket de almacenamiento.
            </p>
          </div>
        </div>
        <div className="relative">
          <pre className="text-xs bg-amber-100 border border-amber-200 rounded-xl p-3 overflow-x-auto text-amber-900 whitespace-pre-wrap">
            {BUCKET_SQL}
          </pre>
          <button
            onClick={() => { navigator.clipboard.writeText(BUCKET_SQL); setSqlCopiado(true); setTimeout(() => setSqlCopiado(false), 2500); }}
            className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-amber-300 text-xs text-amber-800 hover:bg-amber-50 transition"
          >
            <Copy className="w-3 h-3" />
            {sqlCopiado ? 'Copiado ✓' : 'Copiar'}
          </button>
        </div>
        <button onClick={cargar} className="text-xs text-amber-700 underline">
          Ya creé el bucket — recargar
        </button>
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
