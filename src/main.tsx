import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initBugReportCapture } from './lib/bugReportCapture'
import { ErrorBoundary, esErrorDeCarga, recargarUnaVez } from './components/ErrorBoundary'

initBugReportCapture()

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(r => {
      if (r.active?.scriptURL?.includes('push-sw.js')) return;
      r.unregister();
    });
  });
  caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
}

// Vite avisa por su cuenta cuando no puede precargar un fragmento. Llega ANTES
// de que el error alcance al ErrorBoundary, así que atenderlo aquí evita que la
// pantalla llegue a quedarse en blanco.
window.addEventListener('vite:preloadError', (e) => {
  console.error('[MOVI] No se pudo precargar un fragmento:', e);
  if (recargarUnaVez()) e.preventDefault();
});

// Una importación diferida que falla fuera del renderizado no pasa por el
// boundary: se queda como promesa rechazada y la pantalla no reacciona.
window.addEventListener('unhandledrejection', (e) => {
  if (esErrorDeCarga(e.reason)) {
    console.error('[MOVI] Fragmento no cargado (promesa):', e.reason);
    recargarUnaVez();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
