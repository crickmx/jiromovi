import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import './index.css';
import { MoviAuthProvider } from './contexts/MoviAuthContext';
import { ImpersonationProvider } from './contexts/ImpersonationContext';
import { LoadingProvider } from './contexts/LoadingContext';
import { LoadingOverlay } from './components/loading/LoadingOverlay';
import MoviFullRoutes from './pages/MoviFullRoutes';
import MoviLogin from './pages/MoviLogin';

// ── Seguwallet pages (lazy) ────────────────────────────────────────────────
import { SeguwalletAuthProvider } from './seguwallet/lib/SeguwalletAuthContext';
import { SeguwalletProvider } from './seguwallet/lib/SeguwalletContext';
import { AgentBrandProvider } from './seguwallet/lib/AgentBrandContext';
import { SeguwalletProtectedRoute } from './seguwallet/components/SeguwalletProtectedRoute';
const SeguwalletLogin     = lazy(() => import('./seguwallet/pages/SeguwalletLogin').then(m => ({ default: m.SeguwalletLogin })));
const SeguwalletDashboard = lazy(() => import('./seguwallet/pages/SeguwalletDashboard').then(m => ({ default: m.SeguwalletDashboard })));
const SeguwalletPolizas   = lazy(() => import('./seguwallet/pages/SeguwalletPolizas').then(m => ({ default: m.SeguwalletPolizas })));
const SeguwalletChava     = lazy(() => import('./seguwallet/pages/SeguwalletChava').then(m => ({ default: m.SeguwalletChava })));
const SeguwalletPerfil    = lazy(() => import('./seguwallet/pages/SeguwalletPerfil').then(m => ({ default: m.SeguwalletPerfil })));
const SeguwalletCotizar   = lazy(() => import('./seguwallet/pages/SeguwalletCotizar').then(m => ({ default: m.SeguwalletCotizar })));
const SeguwalletDescargas = lazy(() => import('./seguwallet/pages/SeguwalletDescargas').then(m => ({ default: m.SeguwalletDescargas })));
const SeguwalletAseguradoras = lazy(() => import('./seguwallet/pages/SeguwalletAseguradoras').then(m => ({ default: m.SeguwalletAseguradoras })));
const SeguwalletCompleteProfile = lazy(() => import('./seguwallet/pages/SeguwalletCompleteProfile').then(m => ({ default: m.SeguwalletCompleteProfile })));

// ── Chava Agente pages (lazy) ──────────────────────────────────────────────
import { ChavaAgenteProvider } from './chava-agente/lib/ChavaAgenteContext';
const ChavaAgenteLanding = lazy(() => import('./chava-agente/pages/ChavaAgenteLanding'));

// ── Public advisor page (lazy, no auth) ───────────────────────────────────
const PaginaPublicaAsesor = lazy(() => import('./pages/PaginaPublicaAsesor'));

// ── Domain detection ──────────────────────────────────────────────────────
const HOST = typeof window !== 'undefined' ? window.location.hostname : '';
const isAgenteSite   = HOST === 'agentedeseguros.website' || HOST.endsWith('.agentedeseguros.website');
const isChavaSite    = HOST === 'agentedeseguros.ai'      || HOST.endsWith('.agentedeseguros.ai');
const isSeguwallet   = HOST === 'app.seguwallet.mx'       || HOST.endsWith('.seguwallet.mx');
// Everything else (app.movi.digital, localhost, Bolt preview, etc.) is MOVI

// ── Redirect to grupojiro.com for bare agentedeseguros.website root ────────
function AgenteRootRedirect() {
  const { slug } = useParams<{ slug: string }>();
  if (!slug) {
    if (typeof window !== 'undefined') window.location.replace('https://www.grupojiro.com');
    return null;
  }
  return null;
}

// ── Seguwallet provider stack ─────────────────────────────────────────────
function SeguwalletStack({ children }: { children: React.ReactNode }) {
  return (
    <SeguwalletAuthProvider>
      <SeguwalletProvider>
        <AgentBrandProvider>
          {children}
        </AgentBrandProvider>
      </SeguwalletProvider>
    </SeguwalletAuthProvider>
  );
}

// ── Per-domain apps ───────────────────────────────────────────────────────

function AgenteWebsiteApp() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Root with no slug → redirect to grupojiro.com */}
          <Route path="/" element={<RootToGrupoJiro />} />
          {/* Any slug → public advisor page */}
          <Route path="/:slug" element={<PaginaPublicaAsesor />} />
          <Route path="*" element={<RootToGrupoJiro />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

function RootToGrupoJiro() {
  if (typeof window !== 'undefined') window.location.replace('https://www.grupojiro.com');
  return null;
}

function ChavaAIApp() {
  return (
    <BrowserRouter>
      <ChavaAgenteProvider>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/*" element={<ChavaAgenteLanding />} />
          </Routes>
        </Suspense>
      </ChavaAgenteProvider>
    </BrowserRouter>
  );
}

// ── Seguwallet standalone app (app.seguwallet.mx) ─────────────────────────
// Routes without the /seguwallet/ prefix: /login, /dashboard, /polizas, etc.
function SeguwalletApp() {
  return (
    <BrowserRouter>
      <ImpersonationProvider>
        <SeguwalletStack>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={<SeguwalletLogin />} />
              <Route path="/completa-perfil" element={
                <SeguwalletProtectedRoute loginPath="/login" profilePath="/completa-perfil">
                  <SeguwalletCompleteProfile />
                </SeguwalletProtectedRoute>
              } />
              <Route path="/dashboard" element={
                <SeguwalletProtectedRoute loginPath="/login" profilePath="/completa-perfil">
                  <SeguwalletDashboard />
                </SeguwalletProtectedRoute>
              } />
              <Route path="/polizas" element={
                <SeguwalletProtectedRoute loginPath="/login" profilePath="/completa-perfil">
                  <SeguwalletPolizas />
                </SeguwalletProtectedRoute>
              } />
              <Route path="/polizas/:id" element={
                <SeguwalletProtectedRoute loginPath="/login" profilePath="/completa-perfil">
                  <SeguwalletPolizas />
                </SeguwalletProtectedRoute>
              } />
              <Route path="/chava" element={
                <SeguwalletProtectedRoute loginPath="/login" profilePath="/completa-perfil">
                  <SeguwalletChava />
                </SeguwalletProtectedRoute>
              } />
              <Route path="/perfil" element={
                <SeguwalletProtectedRoute loginPath="/login" profilePath="/completa-perfil">
                  <SeguwalletPerfil />
                </SeguwalletProtectedRoute>
              } />
              <Route path="/cotizar" element={
                <SeguwalletProtectedRoute loginPath="/login" profilePath="/completa-perfil">
                  <SeguwalletCotizar />
                </SeguwalletProtectedRoute>
              } />
              <Route path="/descargas" element={
                <SeguwalletProtectedRoute loginPath="/login" profilePath="/completa-perfil">
                  <SeguwalletDescargas />
                </SeguwalletProtectedRoute>
              } />
              <Route path="/aseguradoras" element={
                <SeguwalletProtectedRoute loginPath="/login" profilePath="/completa-perfil">
                  <SeguwalletAseguradoras />
                </SeguwalletProtectedRoute>
              } />
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </Suspense>
        </SeguwalletStack>
      </ImpersonationProvider>
    </BrowserRouter>
  );
}

function MoviApp() {
  return (
    <BrowserRouter>
      <MoviAuthProvider>
        <ImpersonationProvider>
          <LoadingProvider>
            <LoadingOverlay />
            <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* MOVI login (passwordless) */}
                <Route path="/login" element={<MoviLogin />} />

                {/* Seguwallet customer sub-app under /seguwallet/* */}
                <Route path="/seguwallet/login" element={
                  <SeguwalletStack><SeguwalletLogin /></SeguwalletStack>
                } />
                <Route path="/seguwallet/completa-perfil" element={
                  <SeguwalletStack>
                    <SeguwalletProtectedRoute><SeguwalletCompleteProfile /></SeguwalletProtectedRoute>
                  </SeguwalletStack>
                } />
                <Route path="/seguwallet/dashboard" element={
                  <SeguwalletStack>
                    <SeguwalletProtectedRoute><SeguwalletDashboard /></SeguwalletProtectedRoute>
                  </SeguwalletStack>
                } />
                <Route path="/seguwallet/polizas" element={
                  <SeguwalletStack>
                    <SeguwalletProtectedRoute><SeguwalletPolizas /></SeguwalletProtectedRoute>
                  </SeguwalletStack>
                } />
                <Route path="/seguwallet/polizas/:id" element={
                  <SeguwalletStack>
                    <SeguwalletProtectedRoute><SeguwalletPolizas /></SeguwalletProtectedRoute>
                  </SeguwalletStack>
                } />
                <Route path="/seguwallet/chava" element={
                  <SeguwalletStack>
                    <SeguwalletProtectedRoute><SeguwalletChava /></SeguwalletProtectedRoute>
                  </SeguwalletStack>
                } />
                <Route path="/seguwallet/perfil" element={
                  <SeguwalletStack>
                    <SeguwalletProtectedRoute><SeguwalletPerfil /></SeguwalletProtectedRoute>
                  </SeguwalletStack>
                } />
                <Route path="/seguwallet/cotizar" element={
                  <SeguwalletStack>
                    <SeguwalletProtectedRoute><SeguwalletCotizar /></SeguwalletProtectedRoute>
                  </SeguwalletStack>
                } />
                <Route path="/seguwallet/descargas" element={
                  <SeguwalletStack>
                    <SeguwalletProtectedRoute><SeguwalletDescargas /></SeguwalletProtectedRoute>
                  </SeguwalletStack>
                } />
                <Route path="/seguwallet/aseguradoras" element={
                  <SeguwalletStack>
                    <SeguwalletProtectedRoute><SeguwalletAseguradoras /></SeguwalletProtectedRoute>
                  </SeguwalletStack>
                } />

                {/* Full MOVI platform routes */}
                <Route path="/*" element={<MoviFullRoutes />} />
              </Routes>
            </Suspense>
          </LoadingProvider>
        </ImpersonationProvider>
      </MoviAuthProvider>
    </BrowserRouter>
  );
}

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#040c1f]">
      <div className="w-10 h-10 border-[3px] border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
    </div>
  );
}

function App() {
  if (isAgenteSite) return <AgenteWebsiteApp />;
  if (isChavaSite)  return <ChavaAIApp />;
  if (isSeguwallet) return <SeguwalletApp />;
  return <MoviApp />;
}

export default App;
