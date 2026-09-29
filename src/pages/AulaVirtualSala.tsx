import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { solicitarSala100ms } from '../lib/aulaVirtual100ms';

/**
 * Sala virtual con 100ms Prebuilt embebido por iframe.
 * La edge function resuelve la sesión, decide el rol en el servidor y devuelve
 * la URL de la sala; así el SDK de 100ms (≈12 MB) no entra al bundle.
 */
export function AulaVirtualSala() {
  const { id, roomId } = useParams<{ id?: string; roomId?: string }>();
  const { usuario } = useAuth();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const userId = usuario?.id;
  const nombre = usuario ? (usuario.nombre_completo || `${usuario.nombre} ${usuario.apellidos}`) : '';
  const identifier = id || roomId;

  useEffect(() => {
    if (!userId || !identifier) return;
    let cancelled = false;
    solicitarSala100ms({ sesion: identifier, name: nombre })
      .then((r) => { if (!cancelled) setUrl(r.url); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'No fue posible entrar a la sala'); });
    return () => { cancelled = true; };
    // nombre se lee solo al entrar; no debe reconectar la sala si cambia el perfil.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, identifier]);

  if (error) return <div className="flex min-h-screen items-center justify-center text-red-600">{error}</div>;
  if (!url) return <div className="flex min-h-screen items-center justify-center">Cargando sala…</div>;
  return (
    <iframe
      title="Aula virtual"
      src={url}
      allow="camera *; microphone *; display-capture *; autoplay *; fullscreen *"
      className="block h-screen w-full border-0"
    />
  );
}

export default AulaVirtualSala;
