import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import App from './App.tsx';
import './index.css';

const PUBLIC_HOSTS = new Set(["agentedeseguros.website", "www.agentedeseguros.website"]);
const MAIN_REDIRECT = "https://www.movi.digital";

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
