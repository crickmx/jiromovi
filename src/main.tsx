import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import './index.css'
import App from './App.tsx'
import { checkAndHandleVersionChange } from './lib/appVersion'

// ── FASE 2+6: Version check + stale cache cleanup ────────────────────────────
// Runs synchronously before React renders — clears stale caches when a new
// version is deployed. Does NOT affect auth tokens or user preferences.
checkAndHandleVersionChange();

// ── FASE 3+7: Service Worker registration ────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(registration => {
        // Check for updates every time the app loads
        registration.update();

        // When a new SW is waiting, activate it immediately
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New SW installed and waiting — tell it to skip waiting
              newWorker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
      })
      .catch(err => {
        // SW registration is optional — never block the app
        console.warn('[SW] Registration failed:', err);
      });

    // When the SW controller changes (new SW took over), reload once
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </StrictMode>,
)
