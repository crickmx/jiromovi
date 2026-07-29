/**
 * useAppUpdate — polls /version.json every 5 minutes to detect new deploys.
 *
 * When a new version is detected:
 *   1. Shows a non-intrusive top banner ("Nueva versión disponible…")
 *   2. After a 2-second countdown, clears app caches (NOT auth/prefs) and reloads
 *
 * Auth tokens, theme preferences, and all user data are preserved.
 *
 * ⚠️ Guardia anti-bucle: si el servidor/proxy sirve un index.html/bundle viejo
 * (con __APP_VERSION__ viejo) mientras /version.json ya devuelve la versión nueva
 * (se pide con `no-store`, siempre fresco), recargar NO cambia la versión que corre
 * y la app entraría en un bucle infinito de recargas ("la página se pasma + popup").
 * Por eso solo se auto-recarga UNA vez por versión remota detectada (marca en
 * sessionStorage): si tras recargar seguimos en el bundle viejo, ya no se vuelve a
 * recargar — la app queda usable con el código viejo hasta que el server sirva bien.
 */

import { useEffect, useRef, useState } from 'react';
import { checkAndHandleVersionChange, getAppVersion } from './appVersion';

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const VERSION_URL = '/version.json';
// Marca (por pestaña) de la versión remota para la que ya intentamos recargar.
const RELOAD_ATTEMPT_KEY = 'movi_reload_attempt_version';

interface RemoteVersion {
  version: string;
  buildTimestamp: string;
}

async function fetchRemoteVersion(): Promise<RemoteVersion | null> {
  try {
    const res = await fetch(`${VERSION_URL}?_=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export function useAppUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const currentVersion = getAppVersion();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reloadingRef = useRef(false);

  async function checkForUpdate() {
    if (reloadingRef.current) return;
    const remote = await fetchRemoteVersion();
    if (!remote) return;

    if (remote.version === currentVersion) {
      // Al día: limpia cualquier marca de intento previo para que un deploy
      // futuro distinto vuelva a poder recargar sin trabas.
      try { sessionStorage.removeItem(RELOAD_ATTEMPT_KEY); } catch { /* ignore */ }
      return;
    }

    // Hay una versión remota distinta a la que corre. Antes de recargar,
    // verifica que no estemos ya en un bucle: si ya recargamos una vez para
    // ESTA misma versión remota y seguimos con el bundle viejo, recargar de
    // nuevo no arregla nada (el server sirve algo cacheado/desincronizado).
    let attempted: string | null = null;
    try { attempted = sessionStorage.getItem(RELOAD_ATTEMPT_KEY); } catch { /* ignore */ }
    if (attempted === remote.version) {
      // Ya se intentó; no volver a recargar. Dejar la app usable.
      return;
    }

    setUpdateAvailable(true);
    scheduleReload(remote.version);
  }

  function scheduleReload(remoteVersion: string) {
    if (reloadingRef.current) return;
    reloadingRef.current = true;
    // Recuerda (por pestaña) que ya vamos a recargar para esta versión remota,
    // para no entrar en bucle si la recarga no cambia el bundle servido.
    try { sessionStorage.setItem(RELOAD_ATTEMPT_KEY, remoteVersion); } catch { /* ignore */ }
    // Wait 2.5 s so the banner is visible, then reload cleanly
    setTimeout(() => {
      // Run selective cache cleanup (preserves auth, prefs)
      checkAndHandleVersionChange();
      // Clear Cache API for stale SW assets — the new SW will rebuild it
      if (typeof caches !== 'undefined') {
        caches.keys()
          .then(keys => Promise.all(keys.map(k => caches.delete(k))))
          .catch(() => { /* ignore */ })
          .finally(() => window.location.reload());
      } else {
        window.location.reload();
      }
    }, 2500);
  }

  useEffect(() => {
    // Check immediately on mount (catches a deploy that happened while tab was closed)
    checkForUpdate();

    // Then poll every 5 minutes
    intervalRef.current = setInterval(checkForUpdate, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return { updateAvailable };
}
