import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(r => {
      if (r.active?.scriptURL?.includes('push-sw.js')) return;
      r.unregister();
    });
  });
  caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
