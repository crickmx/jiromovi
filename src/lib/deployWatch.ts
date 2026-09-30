// Seguimiento del build después de disparar un deploy.
//
// El botón solo avisa que el deploy se DISPARÓ; el pull y el build tardan
// varios minutos más y no había forma de saber cuándo terminaron salvo recargar
// a ciegas. El sitio ya publica `/version.json` con el commit y la hora del
// build (lo escribe el plugin `write-version-json` de vite.config.ts), así que
// basta con mirarlo hasta que el commit cambie.

/** Cuánto se espera antes de rendirse. Un build de MOVI ronda los 2-4 minutos. */
export const ESPERA_MAXIMA_MS = 12 * 60 * 1000;
export const INTERVALO_SONDEO_MS = 5000;

export interface VersionPublicada {
  version?: string;
  commitHash?: string;
  buildTimestamp?: string;
}

export type EstadoBuild = 'esperando' | 'listo' | 'sin_respuesta' | 'tardo_demasiado';

/**
 * Qué mostrar según lo último que respondió el servidor.
 *
 * `remoto` es null cuando la petición falló — durante un deploy es normal, el
 * servidor se reinicia. Por eso un fallo NO se trata como error mientras haya
 * tiempo: solo se reporta si además se acabó la espera.
 */
export function estadoDeBuild(args: {
  commitPrevio: string | null;
  remoto: VersionPublicada | null;
  transcurridoMs: number;
}): EstadoBuild {
  const { commitPrevio, remoto, transcurridoMs } = args;
  const commitRemoto = remoto?.commitHash ?? null;

  if (commitRemoto && commitRemoto !== commitPrevio) return 'listo';
  if (transcurridoMs >= ESPERA_MAXIMA_MS) return remoto ? 'tardo_demasiado' : 'sin_respuesta';
  return 'esperando';
}

/** Dominio que sirve cada ambiente. */
export const HOST_POR_AMBIENTE: Record<'beta' | 'produccion', string> = {
  beta: 'beta.movi.digital',
  produccion: 'movi.digital',
};

/**
 * Solo se puede seguir el build del sitio en el que estás parado: `version.json`
 * no manda cabeceras de CORS, así que pedirlo al otro dominio truena.
 */
export function puedeSeguirse(ambiente: 'beta' | 'produccion', hostname: string): boolean {
  return hostname === HOST_POR_AMBIENTE[ambiente];
}

/** Lee `/version.json` del propio sitio, esquivando cualquier caché. */
export async function leerVersionPublicada(): Promise<VersionPublicada | null> {
  try {
    const res = await fetch(`/version.json?_=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!res.ok) return null;
    return (await res.json()) as VersionPublicada;
  } catch {
    return null;
  }
}
