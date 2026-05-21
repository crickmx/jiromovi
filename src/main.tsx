import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import App from './App.tsx';
import './index.css';

const PUBLIC_HOSTS = new Set(["agentedeseguros.website", "www.agentedeseguros.website"]);
const MAIN_REDIRECT = "https://www.movi.digital";
const isPublicDomain = PUBLIC_HOSTS.has(window.location.host.toLowerCase());

// On public domain: unregister any stale service workers and clear caches
if (isPublicDomain && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => {
    regs.forEach(r => r.unregister());
  });
  if ('caches' in window) {
    caches.keys().then(names => {
      names.forEach(name => caches.delete(name));
    });
  }
}

// On main domain: register PWA service worker
if (!isPublicDomain && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' });
  });
}

function normalizeHost(h: string) {
  return h.toLowerCase();
}

function isSingleSlugPath(path: string) {
  return /^\/[^\/]+$/.test(path);
}

const RESERVED = new Set([
  "login", "dashboard", "crm", "comisiones", "publicidad", "admin", "api", "assets",
  "configuracion", "directorio", "chat", "vacaciones", "tramites", "store",
  "mis-comisiones", "mi-produccion", "oficinas", "notificaciones", "comunicados",
  "perfil", "usuarios", "education", "espacio-jiro", "movimeet", "catalogos"
]);

function getSlug(path: string) {
  return path.replace(/^\/+/, "").trim();
}

(function domainGate() {
  const host = normalizeHost(window.location.host);
  if (!PUBLIC_HOSTS.has(host)) return;

  const path = window.location.pathname || "/";

  if (path === "/" || path === "") {
    window.location.replace(MAIN_REDIRECT);
    return;
  }

  // Public paths that should always be allowed on agentedeseguros.website
  if (path.startsWith('/cotizar/') || path.startsWith('/cotizar?') || path === '/cotizar') return;
  if (path === '/registro-personal' || path.startsWith('/registro-personal')) return;

  if (!isSingleSlugPath(path)) {
    window.location.replace(MAIN_REDIRECT);
    return;
  }

  const slug = getSlug(path).toLowerCase();
  if (!slug || RESERVED.has(slug)) {
    window.location.replace(MAIN_REDIRECT);
    return;
  }
})();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
