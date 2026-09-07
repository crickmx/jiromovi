import { useState, useRef, useEffect } from 'react';
import { Upload, X, Image as ImageIcon, Loader2, Search, User } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { uploadUserLogo, deleteUserLogo } from '@/lib/logoUtils';

interface AsesorConLogo {
  id: string;
  nombre: string;
  mi_logotipo_url: string | null;
}

export function LogosAsesoresPanel() {
  const [asesores, setAsesores] = useState<AsesorConLogo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [seleccionado, setSeleccionado] = useState<AsesorConLogo | null>(null);
  const [accion, setAccion] = useState<'subiendo' | 'eliminando' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cargar = async () => {
    const { data } = await supabase
      .from('usuarios')
      .select('id, nombre, mi_logotipo_url')
      .not('rol', 'eq', 'Sistema')
      .order('nombre');
    setAsesores(data ?? []);
    setLoading(false);
  };

  useEffect(() => { cargar(); }, []);

  const handleSubir = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !seleccionado) return;
    e.target.value = '';
    setError(null);
    setAccion('subiendo');
    const result = await uploadUserLogo(seleccionado.id, file);
    if (result.success && result.url) {
      const url = result.url;
      setAsesores(prev => prev.map(a => a.id === seleccionado.id ? { ...a, mi_logotipo_url: url } : a));
      setSeleccionado(prev => prev ? { ...prev, mi_logotipo_url: url } : prev);
    } else {
      setError(result.error || 'Error al subir el logo');
    }
    setAccion(null);
  };

  const handleEliminar = async () => {
    if (!seleccionado) return;
    if (!confirm(`¿Eliminar el logo de ${seleccionado.nombre}?`)) return;
    setError(null);
    setAccion('eliminando');
    const result = await deleteUserLogo(seleccionado.id);
    if (result.success) {
      setAsesores(prev => prev.map(a => a.id === seleccionado.id ? { ...a, mi_logotipo_url: null } : a));
      setSeleccionado(prev => prev ? { ...prev, mi_logotipo_url: null } : prev);
    } else {
      setError(result.error || 'Error al eliminar el logo');
    }
    setAccion(null);
  };

  const filtrados = busqueda.trim()
    ? asesores.filter(a => a.nombre.toLowerCase().includes(busqueda.toLowerCase()))
    : asesores;

  const seleccionar = (asesor: AsesorConLogo) => {
    setSeleccionado(asesor);
    setError(null);
  };

  if (loading) return <div className="text-center py-12 text-neutral-500">Cargando...</div>;

  return (
    <div className="flex gap-0 min-h-[600px] rounded-xl border border-neutral-200 dark:border-white/10 overflow-hidden">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Panel izquierdo — lista */}
      <div className="w-72 flex-shrink-0 border-r border-neutral-200 dark:border-white/10 flex flex-col bg-neutral-50 dark:bg-white/3">
        <div className="p-3 border-b border-neutral-200 dark:border-white/10">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
            <input
              type="text"
              placeholder="Buscar asesor..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-neutral-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtrados.length === 0 && (
            <p className="text-sm text-neutral-400 py-8 text-center">Sin resultados</p>
          )}
          {filtrados.map(asesor => {
            const activo = seleccionado?.id === asesor.id;
            return (
              <button
                key={asesor.id}
                onClick={() => seleccionar(asesor)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors border-b border-neutral-100 dark:border-white/5 last:border-b-0 ${
                  activo
                    ? 'bg-accent/10 dark:bg-accent/15'
                    : 'hover:bg-white dark:hover:bg-white/5'
                }`}
              >
                {/* Thumbnail pequeño */}
                <div className="w-9 h-9 rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-white/5 flex-shrink-0 flex items-center justify-center overflow-hidden">
                  {asesor.mi_logotipo_url ? (
                    <img src={asesor.mi_logotipo_url} alt="" className="w-full h-full object-contain" />
                  ) : (
                    <User className="w-4 h-4 text-neutral-300 dark:text-white/20" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${activo ? 'text-accent' : 'text-neutral-900 dark:text-white'}`}>
                    {asesor.nombre}
                  </p>
                  <p className="text-xs text-neutral-400 dark:text-white/40">
                    {asesor.mi_logotipo_url ? 'Con logo' : 'Sin logo'}
                  </p>
                </div>
                {asesor.mi_logotipo_url && (
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                )}
              </button>
            );
          })}
        </div>

        <div className="px-3 py-2 border-t border-neutral-200 dark:border-white/10">
          <p className="text-xs text-neutral-400 dark:text-white/30">
            {asesores.filter(a => a.mi_logotipo_url).length} de {asesores.length} con logo
          </p>
        </div>
      </div>

      {/* Panel derecho — detalle */}
      <div className="flex-1 flex flex-col bg-white dark:bg-neutral-900">
        {!seleccionado ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-neutral-400 dark:text-white/30">
            <ImageIcon className="w-12 h-12" />
            <p className="text-sm">Selecciona un asesor para ver su logo</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col p-8">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">{seleccionado.nombre}</h2>
              <p className="text-sm text-neutral-500 dark:text-white/50 mt-0.5">
                Logotipo personal · mismo que ve en Mi Marca → Mi Logotipo
              </p>
            </div>

            {error && (
              <div className="mb-5 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-start gap-8">
              {/* Preview grande */}
              <div className="flex-shrink-0">
                <div className="w-48 h-48 rounded-xl border-2 border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 flex items-center justify-center overflow-hidden">
                  {seleccionado.mi_logotipo_url ? (
                    <img
                      src={seleccionado.mi_logotipo_url}
                      alt={seleccionado.nombre}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <ImageIcon className="w-16 h-16 text-neutral-200 dark:text-white/15" />
                  )}
                </div>
                <p className="text-xs text-neutral-400 dark:text-white/30 text-center mt-2">
                  {seleccionado.mi_logotipo_url ? 'Logo actual' : 'Sin logo'}
                </p>
              </div>

              {/* Controles */}
              <div className="flex flex-col gap-4 pt-2">
                <div>
                  <p className="text-sm text-neutral-600 dark:text-white/60 mb-1">
                    Se usa en PDFs y materiales de marketing.
                  </p>
                  <p className="text-xs text-neutral-400 dark:text-white/30">
                    Formatos: PNG, JPG · Tamaño máx: 5MB
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleSubir}
                    disabled={accion !== null}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-neutral-200 dark:border-white/10 text-sm font-medium text-neutral-700 dark:text-white/70 hover:border-accent hover:text-accent disabled:opacity-50 transition-colors bg-white dark:bg-white/5"
                  >
                    {accion === 'subiendo'
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Upload className="w-4 h-4" />
                    }
                    {seleccionado.mi_logotipo_url ? 'Cambiar logo' : 'Subir logo'}
                  </button>

                  {seleccionado.mi_logotipo_url && (
                    <button
                      onClick={handleEliminar}
                      disabled={accion !== null}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-neutral-200 dark:border-white/10 text-sm font-medium text-neutral-400 hover:border-red-300 hover:text-red-500 disabled:opacity-50 transition-colors bg-white dark:bg-white/5"
                    >
                      {accion === 'eliminando'
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <X className="w-4 h-4" />
                      }
                      Eliminar
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
