import { useState, useEffect, useRef } from 'react';
import { Camera, CalendarDays, Upload, Trash2, X, ZoomIn } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { PlanMKTPremiumBlock } from '../components/PlanMKTPremiumBlock';
import { PageHeader } from '@/components/ui/page-header';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { LoadingState } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';

interface FotoEstudio {
  name: string;
  url: string;
  size: number;
  created_at: string;
}

export default function FotosEstudio() {
  const { usuario, reloadUsuario } = useAuth();
  const [fotos, setFotos] = useState<FotoEstudio[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [fotoAmpliada, setFotoAmpliada] = useState<FotoEstudio | null>(null);
  const [eliminando, setEliminando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isAdmin = usuario?.rol === 'Administrador';
  const tienePremium = usuario?.plan_mkt_premium ?? false;

  useEffect(() => {
    if (tienePremium) cargarFotos();
  }, [usuario?.id, tienePremium]);

  async function cargarFotos() {
    if (!usuario) return;
    setLoading(true);
    setError(null);

    const { data: archivos, error: listError } = await supabase.storage
      .from('fotos-estudio')
      .list(usuario.id, { limit: 200, sortBy: { column: 'created_at', order: 'desc' } });

    if (listError) {
      setError('No se pudieron cargar las fotos.');
      setLoading(false);
      return;
    }

    const imagenes = (archivos ?? []).filter(f => f.name !== '.emptyFolderPlaceholder');

    const fotosConUrl = await Promise.all(
      imagenes.map(async (archivo) => {
        const { data } = await supabase.storage
          .from('fotos-estudio')
          .createSignedUrl(`${usuario.id}/${archivo.name}`, 3600);
        return {
          name: archivo.name,
          url: data?.signedUrl ?? '',
          size: archivo.metadata?.size ?? 0,
          created_at: archivo.created_at ?? '',
        };
      })
    );

    setFotos(fotosConUrl.filter(f => f.url));
    setLoading(false);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!usuario || !e.target.files?.length) return;
    setUploading(true);
    setError(null);

    const archivos = Array.from(e.target.files);
    const resultados = await Promise.all(
      archivos.map(async (archivo) => {
        const ext = archivo.name.split('.').pop();
        const nombre = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage
          .from('fotos-estudio')
          .upload(`${usuario.id}/${nombre}`, archivo, { contentType: archivo.type });
        return error;
      })
    );

    const errores = resultados.filter(Boolean);
    if (errores.length) setError('Algunas fotos no se pudieron subir.');

    e.target.value = '';
    setUploading(false);
    await cargarFotos();
  }

  async function handleEliminar(foto: FotoEstudio) {
    if (!usuario) return;
    setEliminando(foto.name);
    await supabase.storage.from('fotos-estudio').remove([`${usuario.id}/${foto.name}`]);
    setEliminando(null);
    setFotos(prev => prev.filter(f => f.name !== foto.name));
    if (fotoAmpliada?.name === foto.name) setFotoAmpliada(null);
  }

  function formatFecha(iso: string | null | undefined) {
    if (!iso) return '—';
    try {
      return format(new Date(iso), "d 'de' MMMM, yyyy", { locale: es });
    } catch {
      return '—';
    }
  }

  if (!tienePremium) {
    return (
      <div className="space-y-5">
        <PageHeader
          title="Fotos de Estudio"
          description="Tu carpeta personal de fotos de estudio profesionales"
          icon={Camera}
        />
        <PlanMKTPremiumBlock inline />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Fotos de Estudio"
        description="Tu carpeta personal de fotos de estudio profesionales"
        icon={Camera}
      />
      {/* Tarjeta de suscripción premium */}
      <div className="rounded-2xl bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-950/30 dark:to-violet-950/30 border border-purple-200 dark:border-purple-800/40 p-5 flex flex-wrap gap-6 items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center">
            <Camera className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <p className="text-xs font-medium text-purple-500 dark:text-purple-400 uppercase tracking-wide">
              Plan MKT Premium
            </p>
            <p className="text-sm font-semibold text-purple-900 dark:text-purple-100">
              Fotos de Estudio
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-6 text-sm">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-purple-400" />
            <span className="text-neutral-500 dark:text-white/50">Inicio:</span>
            <span className="font-medium text-neutral-800 dark:text-white/90">
              {formatFecha(usuario?.mkt_premium_fecha_inicio)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-purple-400" />
            <span className="text-neutral-500 dark:text-white/50">Pago:</span>
            <span className="font-medium text-neutral-800 dark:text-white/90">
              {formatFecha(usuario?.mkt_premium_fecha_pago)}
            </span>
          </div>
        </div>

        {isAdmin && tienePremium && (
          <div className="ml-auto">
            <button
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium transition disabled:opacity-60"
            >
              <Upload className="w-4 h-4" />
              {uploading ? 'Subiendo…' : 'Subir fotos'}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={handleUpload}
            />
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
      )}

      {/* Galería */}
      {loading ? (
        <LoadingState text="Cargando fotos…" />
      ) : fotos.length === 0 ? (
        <EmptyState
          icon={Camera}
          title="Sin fotos de estudio"
          description="Aún no tienes fotos de estudio disponibles."
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {fotos.map(foto => (
            <div
              key={foto.name}
              className="group relative aspect-square rounded-xl overflow-hidden bg-neutral-100 dark:bg-white/5 border border-neutral-200 dark:border-white/8"
            >
              <img
                src={foto.url}
                alt={foto.name}
                className="w-full h-full object-cover transition group-hover:scale-105"
                onError={e => { (e.target as HTMLImageElement).src = ''; }}
              />

              {/* Overlay con acciones */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                <button
                  onClick={() => setFotoAmpliada(foto)}
                  className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center hover:bg-white transition"
                >
                  <ZoomIn className="w-4 h-4 text-neutral-800" />
                </button>
                {isAdmin && (
                  <button
                    onClick={() => handleEliminar(foto)}
                    disabled={eliminando === foto.name}
                    className="w-8 h-8 rounded-full bg-red-500/90 flex items-center justify-center hover:bg-red-600 transition disabled:opacity-60"
                  >
                    <Trash2 className="w-4 h-4 text-white" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

    {/* Lightbox */}
      {fotoAmpliada && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setFotoAmpliada(null)}
        >
          <button
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
            onClick={() => setFotoAmpliada(null)}
          >
            <X className="w-5 h-5 text-white" />
          </button>
          <img
            src={fotoAmpliada.url}
            alt={fotoAmpliada.name}
            className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
