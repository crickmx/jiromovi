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
 * Qué identifica a un build publicado.
 *
 * **`version`, no `commitHash`.** Al principio se comparaba el commit, y eso
 * fallaba justo en el caso más común: volver a desplegar SIN commits nuevos —
 * para reintentar, o porque alguien ya había subido lo mismo—. El commit no
 * cambiaba nunca, así que el panel se quedaba en "Construyendo…" hasta
 * rendirse a los 12 minutos, aunque el build hubiera terminado bien.
 *
 * `version` es `String(Date.now())` del momento del build (`vite.config.ts`),
 * así que cambia SIEMPRE. `commitHash` queda de respaldo por si algún build
 * viejo publicó un `version.json` sin ese campo.
 */
export function huellaDeBuild(v: VersionPublicada | null): string | null {
  return v?.version ?? v?.commitHash ?? null;
}

/**
 * Qué mostrar según lo último que respondió el servidor.
 *
 * `remoto` es null cuando la petición falló — durante un deploy es normal, el
 * servidor se reinicia. Por eso un fallo NO se trata como error mientras haya
 * tiempo: solo se reporta si además se acabó la espera.
 */
export function estadoDeBuild(args: {
  huellaPrevia: string | null;
  remoto: VersionPublicada | null;
  transcurridoMs: number;
}): EstadoBuild {
  const { huellaPrevia, remoto, transcurridoMs } = args;
  const huellaRemota = huellaDeBuild(remoto);

  if (huellaRemota && huellaRemota !== huellaPrevia) return 'listo';
  if (transcurridoMs >= ESPERA_MAXIMA_MS) return remoto ? 'tardo_demasiado' : 'sin_respuesta';
  return 'esperando';
}

/**
 * Dominios que sirven la app en cada ambiente.
 *
 * Producción vive en `app.movi.digital`: `movi.digital` a secas es el WordPress
 * de la empresa y no publica `version.json`. El botón de Deploy dice
 * "movi.digital" por costumbre, así que se aceptan los dos nombres.
 */
export const HOST_POR_AMBIENTE: Record<'beta' | 'produccion', string[]> = {
  beta: ['beta.movi.digital'],
  produccion: ['app.movi.digital', 'produccion.movi.digital', 'movi.digital'],
};

/**
 * Solo se puede seguir el build del sitio en el que estás parado: `version.json`
 * no manda cabeceras de CORS, así que pedirlo al otro dominio truena.
 */
export function puedeSeguirse(ambiente: 'beta' | 'produccion', hostname: string): boolean {
  return HOST_POR_AMBIENTE[ambiente].includes(hostname);
}

/** Lee `/version.json` del propio sitio, esquivando cualquier caché. */
export async function leerVersionPublicada(): Promise<VersionPublicada | null> {
  // Con el servidor reiniciándose a media construcción, una petición se puede
  // quedar colgada. Sin este tope el `await` no vuelve nunca y el panel se
  // congela —ni avanza el reloj ni detecta el build nuevo.
  const corte = AbortSignal.timeout ? AbortSignal.timeout(4000) : undefined;
  try {
    const res = await fetch(`/version.json?_=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
      signal: corte,
    });
    if (!res.ok) return null;
    return (await res.json()) as VersionPublicada;
  } catch {
    return null;
  }
}
