/**
 * useAppUpdate — polls /version.json every 5 minutes to detect new deploys.
 *
 * When a new version is detected:
 *   1. Shows a non-intrusive top banner ("Nueva versión disponible…")
 *   2. After a 2-second countdown, clears app caches (NOT auth/prefs) and reloads
 *
 * Auth tokens, theme preferences, and all user data are preserved.
 */

import { useEffect, useRef, useState } from 'react';
import { checkAndHandleVersionChange, getAppVersion } from './appVersion';

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const VERSION_URL = '/version.json';

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
    if (remote.version !== currentVersion) {
      setUpdateAvailable(true);
      scheduleReload();
    }
  }

  function scheduleReload() {
    if (reloadingRef.current) return;
    reloadingRef.current = true;
    // Wait 2.5 s so the banner is visible, then reload cleanly
    setTimeout(() => {
      // Run selective cache cleanup (preserves auth, prefs)
      checkAndHandleVersionChange();
      // Clear Cache API for stale SW assets — the new SW will rebuild it
      if ('caches' in window) {
        caches.keys().then(keys =>
          Promise.all(keys.map(k => caches.delete(k)))
        ).finally(() => window.location.reload());
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
