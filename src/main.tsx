import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/sora'
import '@fontsource-variable/manrope'
import './index.css'
import App from './App.tsx'
import { initBugReportCapture } from './lib/bugReportCapture'
import { initNative } from './native/initNative'
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

// Vite avisa por su cuenta cuando no puede precargar un fragmento: pasa cuando
// una pestaña lleva horas abierta y entre tanto hubo un despliegue, así que los
// fragmentos que su `index.html` menciona ya no existen en el servidor.
//
// 🔑 NO se llama `preventDefault()` aquí, aunque la versión anterior sí lo
// hacía y por eso el usuario veía este error:
//
//     TypeError: can't access property "default", u._result is undefined
//
// El ayudante de Vite es, literal, `return a().catch(c)`, donde `c` relanza el
// error **solo si nadie canceló el evento**. Al cancelarlo, el `catch` devuelve
// `undefined` y entonces la importación **resuelve con `undefined`** en vez de
// rechazar. `React.lazy` lo guarda como módulo bueno (`_status = Resolved`,
// `_result = undefined`) y al siguiente render lee `_result.default`: de ahí
// sale ese TypeError, que no se parece en nada a un fragmento que no cargó y
// que por eso ninguna de las tres redes reconocía.
//
// Dejándolo pasar, el error real llega al ErrorBoundary, que ya sabe tratarlo
// (dice "No se pudo cargar esta parte de MOVI" en vez de "Algo salió mal"). La
// recarga de abajo sigue siendo lo que de verdad lo arregla; esto solo evita
// que, si la recarga tarda, la pantalla mientras tanto mienta.
window.addEventListener('vite:preloadError', (e) => {
  console.error('[MOVI] No se pudo precargar un fragmento:', e);
  recargarUnaVez();
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

// Solo hace algo dentro de la app de iOS/Android (Capacitor).
initNative()
