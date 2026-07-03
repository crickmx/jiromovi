import { useState, useEffect, useRef } from 'react';
import { Search, Upload, Trash2, ZoomIn, X, Camera, CheckCircle, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { PageHeader } from '@/components/ui/page-header';
import { LoadingState } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { resolveImageUrl } from '../lib/storageUtils';

interface Agente {
  id: string;
  nombre: string;
  apellidos: string;
  puesto: string;
  imagen_perfil_url: string;
  plan_mkt_premium: boolean;
  oficina: { nombre: string } | null;
}

interface Foto {
  name: string;
  url: string;
  size: number;
}

const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export default function FotosEstudioAdmin({ embedded }: { embedded?: boolean } = {}) {
  const { usuario } = useAuth();
  const [agentes, setAgentes] = useState<Agente[]>([]);
  const [loadingAgentes, setLoadingAgentes] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [soloConPremium, setSoloConPremium] = useState(false);

  const [agenteSeleccionado, setAgenteSeleccionado] = useState<Agente | null>(null);
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [loadingFotos, setLoadingFotos] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [eliminando, setEliminando] = useState<string | null>(null);
  const [fotoAmpliada, setFotoAmpliada] = useState<Foto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    cargarAgentes();
  }, []);

  useEffect(() => {
    if (agenteSeleccionado) cargarFotos(agenteSeleccionado.id);
  }, [agenteSeleccionado]);

  async function cargarAgentes() {
    setLoadingAgentes(true);
    const { data } = await supabase
      .from('usuarios')
      .select('id, nombre, apellidos, puesto, imagen_perfil_url, plan_mkt_premium, oficinas:oficina_id(nombre)')
      .eq('activo', true)
      .order('nombre');
    setAgentes(
      (data ?? []).map((u: any) => ({
        ...u,
        oficina: Array.isArray(u.oficinas) ? u.oficinas[0] ?? null : u.oficinas ?? null,
      }))
    );
    setLoadingAgentes(false);
  }

  async function cargarFotos(userId: string) {
    setLoadingFotos(true);
    setError(null);
    setFotos([]);

    const { data: archivos, error: listError } = await supabase.storage
      .from('fotos-estudio')
      .list(userId, { limit: 200, sortBy: { column: 'created_at', order: 'desc' } });

    if (listError) {
      setError('No se pudieron cargar las fotos.');
      setLoadingFotos(false);
      return;
    }

    const imagenes = (archivos ?? []).filter(f => f.name !== '.emptyFolderPlaceholder');

    const fotosConUrl = await Promise.all(
      imagenes.map(async (archivo) => {
        const { data } = await supabase.storage
          .from('fotos-estudio')
          .createSignedUrl(`${userId}/${archivo.name}`, 3600);
        return { name: archivo.name, url: data?.signedUrl ?? '', size: archivo.metadata?.size ?? 0 };
      })
    );

    setFotos(fotosConUrl.filter(f => f.url));
    setLoadingFotos(false);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!agenteSeleccionado || !e.target.files?.length) return;
    setSubiendo(true);
    setError(null);

    const archivos = Array.from(e.target.files);
    const resultados = await Promise.all(
      archivos.map(async (archivo) => {
        const ext = archivo.name.split('.').pop();
        const nombre = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage
          .from('fotos-estudio')
          .upload(`${agenteSeleccionado.id}/${nombre}`, archivo, { contentType: archivo.type });
        return error;
      })
    );

    const errores = resultados.filter(Boolean);
    if (errores.length) setError(`Error al subir: ${(errores[0] as any)?.message ?? 'desconocido'}`);

    e.target.value = '';
    setSubiendo(false);
    await cargarFotos(agenteSeleccionado.id);
  }

  async function handleEliminar(foto: Foto) {
    if (!agenteSeleccionado) return;
    setEliminando(foto.name);
    await supabase.storage.from('fotos-estudio').remove([`${agenteSeleccionado.id}/${foto.name}`]);
    setEliminando(null);
    setFotos(prev => prev.filter(f => f.name !== foto.name));
    if (fotoAmpliada?.name === foto.name) setFotoAmpliada(null);
  }

  const agentesFiltrados = agentes.filter(a => {
    const coincide = busqueda === '' ||
      norm(`${a.nombre} ${a.apellidos}`).includes(norm(busqueda)) ||
      norm(a.oficina?.nombre ?? '').includes(norm(busqueda));
    const premium = !soloConPremium || a.plan_mkt_premium;
    return coincide && premium;
  });

  if (usuario?.rol !== 'Administrador') return null;

  return (
    <div className="space-y-5">
      {!embedded && (
        <PageHeader
          title="Fotos de Estudio — Admin"
          description="Gestiona la carpeta de fotos de estudio de cada agente"
          icon={Camera}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-5 items-start">

        {/* ── Panel izquierdo: lista de agentes ── */}
        <div className="rounded-2xl border border-neutral-200 dark:border-white/8 bg-white dark:bg-white/3 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-neutral-100 dark:border-white/8 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Buscar agente…"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 text-neutral-800 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={soloConPremium}
                onChange={e => setSoloConPremium(e.target.checked)}
                className="accent-purple-600 w-4 h-4"
              />
              <span className="text-xs text-neutral-600 dark:text-white/60">Solo con Plan Premium activo</span>
            </label>
          </div>

          <div className="overflow-y-auto max-h-[65vh]">
            {loadingAgentes ? (
              <LoadingState text="Cargando agentes…" compact />
            ) : agentesFiltrados.length === 0 ? (
              <p className="text-sm text-neutral-400 text-center py-8">Sin resultados</p>
            ) : (
              agentesFiltrados.map(agente => {
                const activo = agenteSeleccionado?.id === agente.id;
                return (
                  <button
                    key={agente.id}
                    onClick={() => setAgenteSeleccionado(agente)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition border-b border-neutral-100 dark:border-white/5 last:border-0 ${
                      activo
                        ? 'bg-purple-50 dark:bg-purple-900/20'
                        : 'hover:bg-neutral-50 dark:hover:bg-white/4'
                    }`}
                  >
                    {agente.imagen_perfil_url ? (
                      <img
                        src={resolveImageUrl(agente.imagen_perfil_url, 'avatars')}
                        alt=""
                        className="w-9 h-9 rounded-full object-cover shrink-0"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-neutral-100 dark:bg-white/10 flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-neutral-400" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-neutral-800 dark:text-white truncate">
                        {agente.nombre} {agente.apellidos}
                      </p>
                      <p className="text-xs text-neutral-400 truncate">{agente.oficina?.nombre ?? '—'}</p>
                    </div>
                    {agente.plan_mkt_premium && (
                      <CheckCircle className="w-4 h-4 text-purple-500 shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ── Panel derecho: carpeta del agente ── */}
        {!agenteSeleccionado ? (
          <div className="rounded-2xl border border-neutral-200 dark:border-white/8 bg-white dark:bg-white/3">
            <EmptyState
              icon={Camera}
              title="Selecciona un agente"
              description="Elige un agente de la lista para ver y gestionar sus fotos de estudio."
              compact
            />
          </div>
        ) : (
          <div className="rounded-2xl border border-neutral-200 dark:border-white/8 bg-white dark:bg-white/3 overflow-hidden">
            {/* Cabecera del agente */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 dark:border-white/8">
              <div>
                <p className="font-semibold text-neutral-800 dark:text-white">
                  {agenteSeleccionado.nombre} {agenteSeleccionado.apellidos}
                </p>
                <p className="text-xs text-neutral-400">{agenteSeleccionado.oficina?.nombre ?? '—'} · {fotos.length} foto{fotos.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="flex items-center gap-2">
                {agenteSeleccionado.plan_mkt_premium && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-purple-600 bg-purple-50 dark:bg-purple-900/30 px-2.5 py-1 rounded-full border border-purple-200 dark:border-purple-700">
                    <CheckCircle className="w-3 h-3" /> Premium
                  </span>
                )}
                <button
                  onClick={() => inputRef.current?.click()}
                  disabled={subiendo}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium transition disabled:opacity-60"
                >
                  <Upload className="w-4 h-4" />
                  {subiendo ? 'Subiendo…' : 'Subir fotos'}
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
            </div>

            {/* Galería */}
            <div className="p-5">
              {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

              {loadingFotos ? (
                <LoadingState text="Cargando fotos…" compact />
              ) : fotos.length === 0 ? (
                <EmptyState
                  icon={Camera}
                  title="Sin fotos"
                  description="Sube las primeras fotos de estudio para este agente."
                  action={{ label: 'Subir fotos', onClick: () => inputRef.current?.click() }}
                  compact
                />
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {fotos.map(foto => (
                    <div
                      key={foto.name}
                      className="group relative aspect-square rounded-xl overflow-hidden bg-neutral-100 dark:bg-white/5 border border-neutral-200 dark:border-white/8"
                    >
                      <img
                        src={foto.url}
                        alt={foto.name}
                        className="w-full h-full object-cover transition group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                        <button
                          onClick={() => setFotoAmpliada(foto)}
                          className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center hover:bg-white transition"
                        >
                          <ZoomIn className="w-4 h-4 text-neutral-800" />
                        </button>
                        <button
                          onClick={() => handleEliminar(foto)}
                          disabled={eliminando === foto.name}
                          className="w-8 h-8 rounded-full bg-red-500/90 flex items-center justify-center hover:bg-red-600 transition disabled:opacity-60"
                        >
                          <Trash2 className="w-4 h-4 text-white" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

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
