import { useState, useRef, useEffect } from 'react';
import { Upload, X, Image as ImageIcon, Loader2, Search } from 'lucide-react';
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
  const [accion, setAccion] = useState<{ id: string; tipo: 'subiendo' | 'eliminando' } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const targetUserId = useRef<string | null>(null);

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

  const handleSubir = (userId: string) => {
    targetUserId.current = userId;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const uid = targetUserId.current;
    if (!file || !uid) return;
    e.target.value = '';
    setError(null);
    setAccion({ id: uid, tipo: 'subiendo' });
    const result = await uploadUserLogo(uid, file);
    if (result.success && result.url) {
      setAsesores(prev => prev.map(a => a.id === uid ? { ...a, mi_logotipo_url: result.url! } : a));
    } else {
      setError(result.error || 'Error al subir el logo');
    }
    setAccion(null);
    targetUserId.current = null;
  };

  const handleEliminar = async (asesor: AsesorConLogo) => {
    if (!confirm(`¿Eliminar el logo de ${asesor.nombre}?`)) return;
    setError(null);
    setAccion({ id: asesor.id, tipo: 'eliminando' });
    const result = await deleteUserLogo(asesor.id);
    if (result.success) {
      setAsesores(prev => prev.map(a => a.id === asesor.id ? { ...a, mi_logotipo_url: null } : a));
    } else {
      setError(result.error || 'Error al eliminar el logo');
    }
    setAccion(null);
  };

  const filtrados = busqueda.trim()
    ? asesores.filter(a => a.nombre.toLowerCase().includes(busqueda.toLowerCase()))
    : asesores;

  // Separar: primero los que tienen logo
  const conLogo = filtrados.filter(a => a.mi_logotipo_url);
  const sinLogo = filtrados.filter(a => !a.mi_logotipo_url);

  if (loading) return <div className="text-center py-12 text-neutral-500">Cargando...</div>;

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Logos de asesores</h2>
          <p className="text-sm text-neutral-500 dark:text-white/50 mt-0.5">
            Mismo logotipo que cada asesor ve en Mi Marca → Mi Logotipo. Se usa en PDFs y materiales.
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Buscar asesor..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="pl-9 pr-4 py-2 text-sm border border-neutral-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-accent w-52"
          />
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {conLogo.length > 0 && (
        <>
          <p className="text-xs font-semibold text-neutral-400 dark:text-white/40 uppercase mb-3">Con logo ({conLogo.length})</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-8">
            {conLogo.map(asesor => (
              <AsesorCard
                key={asesor.id}
                asesor={asesor}
                accion={accion?.id === asesor.id ? accion.tipo : null}
                onSubir={handleSubir}
                onEliminar={handleEliminar}
              />
            ))}
          </div>
        </>
      )}

      {sinLogo.length > 0 && (
        <>
          <p className="text-xs font-semibold text-neutral-400 dark:text-white/40 uppercase mb-3">Sin logo ({sinLogo.length})</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {sinLogo.map(asesor => (
              <AsesorCard
                key={asesor.id}
                asesor={asesor}
                accion={accion?.id === asesor.id ? accion.tipo : null}
                onSubir={handleSubir}
                onEliminar={handleEliminar}
              />
            ))}
          </div>
        </>
      )}

      {filtrados.length === 0 && (
        <p className="text-sm text-neutral-400 py-8 text-center">No se encontraron asesores.</p>
      )}
    </div>
  );
}

function AsesorCard({
  asesor,
  accion,
  onSubir,
  onEliminar,
}: {
  asesor: AsesorConLogo;
  accion: 'subiendo' | 'eliminando' | null;
  onSubir: (id: string) => void;
  onEliminar: (a: AsesorConLogo) => void;
}) {
  const ocupado = accion !== null;
  return (
    <div className="bg-white dark:bg-white/5 rounded-xl border border-neutral-200 dark:border-white/10 p-4 flex flex-col items-center gap-3">
      {/* Preview */}
      <div className="w-full aspect-square rounded-lg border-2 border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 flex items-center justify-center overflow-hidden">
        {asesor.mi_logotipo_url ? (
          <img
            src={asesor.mi_logotipo_url}
            alt={asesor.nombre}
            className="w-full h-full object-contain"
          />
        ) : (
          <ImageIcon className="w-10 h-10 text-neutral-200 dark:text-white/20" />
        )}
      </div>

      {/* Nombre */}
      <p className="text-sm font-medium text-neutral-900 dark:text-white text-center leading-snug line-clamp-2 w-full" title={asesor.nombre}>
        {asesor.nombre}
      </p>

      {/* Botones */}
      <div className="flex gap-2 w-full">
        <button
          onClick={() => onSubir(asesor.id)}
          disabled={ocupado}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-white/10 text-xs font-medium text-neutral-700 dark:text-white/70 hover:border-accent hover:text-accent disabled:opacity-50 transition-colors"
        >
          {accion === 'subiendo' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          {asesor.mi_logotipo_url ? 'Cambiar' : 'Subir'}
        </button>
        {asesor.mi_logotipo_url && (
          <button
            onClick={() => onEliminar(asesor)}
            disabled={ocupado}
            className="inline-flex items-center justify-center p-1.5 rounded-lg border border-neutral-200 dark:border-white/10 text-neutral-400 hover:border-red-300 hover:text-red-500 disabled:opacity-50 transition-colors"
            title="Eliminar logo"
          >
            {accion === 'eliminando' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>
    </div>
  );
}
