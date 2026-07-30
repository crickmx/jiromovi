import { useEffect, useState } from 'react';
import { Download, Loader as Loader2, Rows3 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { generarPlecaBlob, descargarBlob, PLECA_TEMPLATE_URL } from '../../lib/plecaUtils';

export function PlecaDescargable() {
  const { usuario } = useAuth();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState('');

  const nombre = usuario ? `${usuario.nombre} ${usuario.apellidos}`.trim() : '';
  const telefono = usuario?.celular_laboral || usuario?.celular_personal || '';
  const email = usuario?.email_laboral || usuario?.email_personal || '';

  useEffect(() => {
    let activeUrl: string | null = null;
    let cancelled = false;

    (async () => {
      if (!usuario) return;
      try {
        const blob = await generarPlecaBlob({ nombre, telefono, email });
        if (cancelled) return;
        activeUrl = URL.createObjectURL(blob);
        setPreviewUrl(activeUrl);
      } catch {
        if (!cancelled) setError('No se pudo generar la vista previa');
      }
    })();

    return () => {
      cancelled = true;
      if (activeUrl) URL.revokeObjectURL(activeUrl);
    };
  }, [usuario?.id, nombre, telefono, email]);

  const handleDescargar = async () => {
    if (!usuario) return;
    setGenerando(true);
    setError('');
    try {
      const blob = await generarPlecaBlob({ nombre, telefono, email });
      const slug = nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      descargarBlob(blob, `pleca-${slug || 'asesor'}.png`);
    } catch (err: any) {
      setError(err.message || 'No se pudo generar la pleca');
    } finally {
      setGenerando(false);
    }
  };

  if (!usuario) return null;

  return (
    <div className="bg-white dark:bg-neutral-800/50 rounded-xl border border-neutral-200/60 dark:border-white/8 p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-3">
        <Rows3 className="w-4 h-4 text-accent" />
        <h3 className="text-sm font-bold text-neutral-900 dark:text-white">Tu pleca de contacto</h3>
      </div>
      <p className="text-xs text-neutral-500 dark:text-white/50 mb-3">
        Rótulo con tu nombre, teléfono y correo, listo para usar en tus videos y publicaciones.
      </p>
      <div className="rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-900 mb-3">
        <img
          src={previewUrl ?? PLECA_TEMPLATE_URL}
          alt="Vista previa de tu pleca"
          className="w-full h-auto"
        />
      </div>
      {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
      <Button size="sm" onClick={handleDescargar} disabled={generando}>
        {generando ? (
          <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Generando...</>
        ) : (
          <><Download className="w-3.5 h-3.5 mr-1.5" /> Descargar pleca</>
        )}
      </Button>
    </div>
  );
}
