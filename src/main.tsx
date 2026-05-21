import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import App from './App.tsx';
import './index.css';

const PUBLIC_HOSTS = new Set(["agentedeseguros.website", "www.agentedeseguros.website"]);
const isPublicDomain = PUBLIC_HOSTS.has(window.location.host.toLowerCase());

// On main domain only: register PWA service worker
if (!isPublicDomain && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
