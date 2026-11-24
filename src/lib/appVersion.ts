/**
 * App version management:
 * - Detects when a new version is deployed
 * - Cleans up stale app cache (localStorage/sessionStorage) without touching auth/user prefs
 * - Triggers a page reload so users always run the latest code
 */

const APP_VERSION_KEY = 'movi_app_version';

// Keys that must NEVER be cleared (auth, user preferences, PWA install state)
const PRESERVED_KEYS = new Set([
  // Auth / session
  'sb-qhwvuuyjhcennqccgvse-auth-token',
  'supabase.auth.token',
  // User preferences
  'movi-theme-mode',   // dark/light/system toggle
  'movi_theme',
  'theme',
  'dark_mode',
  'color_scheme',
  // PWA install tracking
  'INSTALL_PROMPT_DISMISSED',
  'INSTALL_PROMPT_COUNT',
  'LAST_PROMPT_DATE',
  // Seguwallet auth
  'seguwallet_session',
  'seguwallet_token',
  'sw_token',
  // Impersonation
  'movi_impersonation',
  // App version key itself — never delete this
  'movi_app_version',
]);

// Prefix patterns for app-cache keys (safe to delete on version change)
const CACHE_PREFIXES = [
  'movi_cache_',
  'movi_data_',
  'dashboard_',
  'sicas_',
  'chava_cache_',
  'rc_', // react-query cache
  'rq_',
  'tq_',
];

function isCacheKey(key: string): boolean {
  return CACHE_PREFIXES.some(p => key.startsWith(p));
}

function clearAppCache() {
  // localStorage — only remove keys that match known cache prefixes
  // AND are not in the preserved set (double-safety)
  const lsKeys = Object.keys(localStorage);
  for (const key of lsKeys) {
    if (!PRESERVED_KEYS.has(key) && isCacheKey(key)) {
      localStorage.removeItem(key);
    }
  }

  // sessionStorage — safe to clear entirely (no auth stored there by Supabase)
  try { sessionStorage.clear(); } catch { /* ignore */ }
}

export function checkAndHandleVersionChange(): boolean {
  const currentVersion = __APP_VERSION__;
  const storedVersion = localStorage.getItem(APP_VERSION_KEY);

  if (storedVersion === currentVersion) return false; // same version, nothing to do

  if (storedVersion !== null) {
    // A new version was deployed — clean up stale caches
    console.info(`[MOVI] New version detected: ${storedVersion} → ${currentVersion}. Clearing app cache.`);
    clearAppCache();
  }

  // Store the new version
  localStorage.setItem(APP_VERSION_KEY, currentVersion);
  return storedVersion !== null; // true only if this was an actual upgrade (not first visit)
}

export function getAppVersion(): string {
  return __APP_VERSION__;
}
