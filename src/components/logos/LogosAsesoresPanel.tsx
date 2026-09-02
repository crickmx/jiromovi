import { useState, useEffect, useRef } from 'react';
import { Download, Trash2, Upload, Loader2 } from 'lucide-react';
import { obtenerTodosLogosAsesores, eliminarLogoPersonalizado, guardarLogoPersonalizado } from '@/lib/logoUtils';
import type { LogoGuardadoConUsuario } from '@/lib/logoUtils';

export function LogosAsesoresPanel() {
  const [logos, setLogos] = useState<LogoGuardadoConUsuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [eliminando, setEliminando] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState<string | null>(null); // usuario_id durante upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadingForUserId = useRef<string | null>(null);

  const cargar = () =>
    obtenerTodosLogosAsesores().then(data => {
      setLogos(data);
      setLoading(false);
    });

  useEffect(() => { cargar(); }, []);

  const handleEliminar = async (logo: LogoGuardadoConUsuario) => {
    if (!confirm(`¿Eliminar el logo de ${logo.usuario_nombre}?`)) return;
    setEliminando(logo.id);
    await eliminarLogoPersonalizado(logo.id);
    setLogos(prev => prev.filter(l => l.id !== logo.id));
    setEliminando(null);
  };

  const handleSubirNuevo = (usuarioId: string) => {
    uploadingForUserId.current = usuarioId;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const uid = uploadingForUserId.current;
    if (!file || !uid) return;
    e.target.value = '';
    setSubiendo(uid);
    try {
      await guardarLogoPersonalizado(uid, file);
      await cargar();
    } catch (err: any) {
      alert('Error al subir logo: ' + (err.message || err));
    } finally {
      setSubiendo(null);
      uploadingForUserId.current = null;
    }
  };

  if (loading) return <div className="text-center py-12 text-neutral-500">Cargando logos...</div>;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Logos de asesores</h2>
        <p className="text-sm text-neutral-500 dark:text-white/50 mt-1">
          Logos personalizados que los asesores han guardado. Puedes eliminar o agregar logos desde aquí.
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg"
        className="hidden"
        onChange={handleFileChange}
      />

      {logos.length === 0 ? (
        <div className="text-sm text-neutral-400">Aún no hay logos guardados por asesores.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {logos.map(logo => (
            <div
              key={logo.id}
              className="bg-white dark:bg-white/5 rounded-xl border border-neutral-200 dark:border-white/10 p-3 flex flex-col"
            >
              <div className="relative mb-2">
                <img
                  src={logo.url}
                  alt={logo.nombre}
                  className="w-full h-24 object-contain rounded-lg bg-neutral-50 dark:bg-white/5"
                />
              </div>
              <p className="text-sm font-medium text-neutral-900 dark:text-white truncate" title={logo.usuario_nombre}>
                {logo.usuario_nombre}
              </p>
              <p className="text-xs text-neutral-400 dark:text-white/40 mb-3">
                {new Date(logo.created_at).toLocaleDateString('es-MX')}
              </p>
              <div className="flex flex-col gap-1 mt-auto">
                <a
                  href={logo.url}
                  download={`${logo.usuario_nombre}-${logo.nombre}`}
                  className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:text-accent-hover transition-colors"
                >
                  <Download className="w-3 h-3" /> Descargar
                </a>
                <button
                  onClick={() => handleSubirNuevo(logo.usuario_id)}
                  disabled={subiendo === logo.usuario_id}
                  className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors disabled:opacity-50"
                >
                  {subiendo === logo.usuario_id
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <Upload className="w-3 h-3" />}
                  Reemplazar
                </button>
                <button
                  onClick={() => handleEliminar(logo)}
                  disabled={eliminando === logo.id}
                  className="inline-flex items-center gap-1 text-xs font-medium text-red-500 hover:text-red-700 transition-colors disabled:opacity-50"
                >
                  {eliminando === logo.id
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <Trash2 className="w-3 h-3" />}
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
