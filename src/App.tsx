import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MoviAuthProvider } from './contexts/MoviAuthContext';
import { useMoviAuth } from './contexts/MoviAuthContext';
import { ChavaAgenteProvider } from './chava-agente/lib/ChavaAgenteContext';
import { ImpersonationProvider } from './contexts/ImpersonationContext';
import { SeguwalletProvider } from './seguwallet/lib/SeguwalletContext';
import { AgentBrandProvider } from './seguwallet/lib/AgentBrandContext';
import { SeguwalletProtectedRoute } from './seguwallet/components/SeguwalletProtectedRoute';
import { SeguwalletLayout } from './seguwallet/components/SeguwalletLayout';
import { type ReactNode } from 'react';

// Seguwallet pages
import { SeguwalletLogin } from './seguwallet/pages/SeguwalletLogin';
import { SeguwalletDashboard } from './seguwallet/pages/SeguwalletDashboard';
import { SeguwalletPolizas } from './seguwallet/pages/SeguwalletPolizas';
import { SeguwalletPerfil } from './seguwallet/pages/SeguwalletPerfil';
import { SeguwalletChava } from './seguwallet/pages/SeguwalletChava';
import { SeguwalletCotizar } from './seguwallet/pages/SeguwalletCotizar';
import { SeguwalletAseguradoras } from './seguwallet/pages/SeguwalletAseguradoras';
import { SeguwalletDescargas } from './seguwallet/pages/SeguwalletDescargas';
import { SeguwalletCompleteProfile } from './seguwallet/pages/SeguwalletCompleteProfile';

// MOVI login
import MoviLogin from './pages/MoviLogin';

// Chava Agente pages
import ChavaAgenteLanding from './chava-agente/pages/ChavaAgenteLanding';
import ChavaAgenteUsuariosAdmin from './chava-agente/pages/admin/ChavaAgenteUsuariosAdmin';
import ChavaAgenteConversacionesAdmin from './chava-agente/pages/admin/ChavaAgenteConversacionesAdmin';
import ChavaAgenteTerminosAdmin from './chava-agente/pages/admin/ChavaAgenteTerminosAdmin';

// MOVI full platform routes (lazy-loaded)
const MoviFullRoutes = lazy(() => import('./pages/MoviFullRoutes'));
const PaginaPublicaAsesor = lazy(() => import('./pages/PaginaPublicaAsesor'));

// ── Domain detection ────────────────────────────────────────────────────────
const hostname = window.location.hostname;
const CHAVA_DOMAINS = ['agentedeseguros.ai', 'www.agentedeseguros.ai'];
const SEGUWALLET_DOMAINS = ['seguwallet.mx', 'www.seguwallet.mx', 'app.seguwallet.mx'];
const MOVI_SPLASH_DOMAINS = ['movi.digital', 'www.movi.digital'];
const PUBLIC_PROFILE_DOMAINS = ['agentedeseguros.website', 'www.agentedeseguros.website'];

const isChavaDomain = CHAVA_DOMAINS.includes(hostname);
const isSeguwalletDomain = SEGUWALLET_DOMAINS.includes(hostname);
const isMoviSplashDomain = MOVI_SPLASH_DOMAINS.includes(hostname);
const isPublicProfileDomain = PUBLIC_PROFILE_DOMAINS.includes(hostname);

// ── MOVI private route ───────────────────────────────────────────────────────
function MoviPrivateRoute({ children }: { children: ReactNode }) {
  const { usuario, loading } = useMoviAuth();
  console.log('[MoviPrivateRoute] loading=', loading, 'usuario=', !!usuario);
  if (loading) return <MoviLoader />;
  return usuario ? <>{children}</> : <Navigate to="/login" replace />;
}

function MoviLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border-4 border-slate-200 border-t-slate-600 animate-spin" />
        <p className="text-sm text-slate-500">Cargando...</p>
      </div>
    </div>
  );
}

// ── 1. Chava Agente (agentedeseguros.ai) ─────────────────────────────────────
function ChavaAgenteApp() {
  return (
    <BrowserRouter>
      <ChavaAgenteProvider>
        <Routes>
          <Route path="*" element={<ChavaAgenteLanding />} />
        </Routes>
      </ChavaAgenteProvider>
    </BrowserRouter>
  );
}

// ── 2. Seguwallet (seguwallet.mx) — passwordless OTP ─────────────────────────
function SeguwalletApp() {
  return (
    <BrowserRouter>
      <ImpersonationProvider>
        <SeguwalletProvider>
          <AgentBrandProvider>
            <Routes>
              <Route path="/" element={<Navigate to="/seguwallet/dashboard" replace />} />
              <Route path="/login" element={<Navigate to="/seguwallet/login" replace />} />
              <Route path="/seguwallet/login" element={<SeguwalletLogin />} />
              <Route path="/seguwallet/dashboard" element={
                <SeguwalletProtectedRoute><SeguwalletLayout><SeguwalletDashboard /></SeguwalletLayout></SeguwalletProtectedRoute>
              } />
              <Route path="/seguwallet/polizas" element={
                <SeguwalletProtectedRoute><SeguwalletLayout><SeguwalletPolizas /></SeguwalletLayout></SeguwalletProtectedRoute>
              } />
              <Route path="/seguwallet/perfil" element={
                <SeguwalletProtectedRoute><SeguwalletLayout><SeguwalletPerfil /></SeguwalletLayout></SeguwalletProtectedRoute>
              } />
              <Route path="/seguwallet/chava" element={
                <SeguwalletProtectedRoute><SeguwalletLayout><SeguwalletChava /></SeguwalletLayout></SeguwalletProtectedRoute>
              } />
              <Route path="/seguwallet/cotizar" element={
                <SeguwalletProtectedRoute><SeguwalletLayout><SeguwalletCotizar /></SeguwalletLayout></SeguwalletProtectedRoute>
              } />
              <Route path="/seguwallet/aseguradoras" element={
                <SeguwalletProtectedRoute><SeguwalletLayout><SeguwalletAseguradoras /></SeguwalletLayout></SeguwalletProtectedRoute>
              } />
              <Route path="/seguwallet/descargas" element={
                <SeguwalletProtectedRoute><SeguwalletLayout><SeguwalletDescargas /></SeguwalletLayout></SeguwalletProtectedRoute>
              } />
              <Route path="/seguwallet/completa-perfil" element={
                <SeguwalletProtectedRoute><SeguwalletCompleteProfile /></SeguwalletProtectedRoute>
              } />
              <Route path="*" element={<Navigate to="/seguwallet/dashboard" replace />} />
            </Routes>
          </AgentBrandProvider>
        </SeguwalletProvider>
      </ImpersonationProvider>
    </BrowserRouter>
  );
}

// ── 3.5. agentedeseguros.website — public agent profile pages ────────────────
function PublicProfileApp() {
  return (
    <BrowserRouter>
      <MoviAuthProvider>
        <Routes>
          <Route path="/p/:slug" element={
            <Suspense fallback={<MoviLoader />}>
              <PaginaPublicaAsesor />
            </Suspense>
          } />
          <Route path="/:slug" element={
            <Suspense fallback={<MoviLoader />}>
              <PaginaPublicaAsesor />
            </Suspense>
          } />
          <Route path="*" element={
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
              <p className="text-slate-500 text-sm">Página no encontrada</p>
            </div>
          } />
        </Routes>
      </MoviAuthProvider>
    </BrowserRouter>
  );
}

// ── 3. movi.digital marketing splash ─────────────────────────────────────────
function MoviSplashApp() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="*" element={<MoviSplash />} />
      </Routes>
    </BrowserRouter>
  );
}

function MoviSplash() {
  return (
    <>
      <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(135deg, #040c1f 0%, #061428 40%, #081a38 60%, #04101f 100%)',
        }} />
        <div className="absolute -top-56 -right-56 w-[700px] h-[700px] rounded-full" style={{
          background: 'radial-gradient(circle, #0D6EFD 0%, transparent 65%)',
          opacity: 0.12, animation: 'movi-pulse 10s ease-in-out infinite',
        }} />
        <div className="absolute bottom-0 -left-40 w-[500px] h-[500px] rounded-full" style={{
          background: 'radial-gradient(circle, #0047bb 0%, transparent 65%)',
          opacity: 0.1, animation: 'movi-pulse 14s ease-in-out infinite 3s',
        }} />
        <div className="absolute inset-0" style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)`,
          backgroundSize: '80px 80px',
        }} />

        <div className="relative z-10 text-center px-6 max-w-lg">
          <img src="/logojiro.png" alt="MOVI Digital" className="h-14 w-auto mx-auto mb-8" />
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight mb-4">
            La plataforma digital<br />
            <span style={{ background: 'linear-gradient(90deg, #0D6EFD, #00c8e0)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              para agentes de seguros
            </span>
          </h1>
          <p className="text-base mb-10 leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
            CRM, produccion, comisiones y mas — todo en un solo lugar.
          </p>
          <a
            href="https://app.movi.digital"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl text-sm font-bold text-white transition-all duration-200 active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, #0D6EFD, #0047bb)', boxShadow: '0 4px 24px rgba(13,110,253,0.4)' }}
          >
            Acceder a MOVI Digital
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
          </a>
          <div className="mt-16 flex items-center justify-center gap-6 text-[11px]" style={{ color: 'rgba(255,255,255,0.22)' }}>
            <a href="https://seguwallet.mx" target="_blank" rel="noopener noreferrer" className="hover:text-white/50 transition-colors">seguwallet.mx</a>
            <span className="w-px h-3" style={{ background: 'rgba(255,255,255,0.15)' }} />
            <a href="https://agentedeseguros.ai" target="_blank" rel="noopener noreferrer" className="hover:text-white/50 transition-colors">agentedeseguros.ai</a>
            <span className="w-px h-3" style={{ background: 'rgba(255,255,255,0.15)' }} />
            <span>© {new Date().getFullYear()} Grupo JIRO</span>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes movi-pulse {
          0%, 100% { opacity: 0.12; transform: scale(1); }
          50%       { opacity: 0.2; transform: scale(1.08); }
        }
      `}</style>
    </>
  );
}

// ── 4. MOVI full platform (app.movi.digital + localhost) ─────────────────────
function MoviApp() {
  return (
    <BrowserRouter>
      <MoviAuthProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<MoviLogin />} />

          {/* Chava Agente — public platform routes */}
          <Route path="/chava-agente" element={
            <ChavaAgenteProvider><ChavaAgenteLanding /></ChavaAgenteProvider>
          } />
          <Route path="/admin/chava-agente/usuarios" element={
            <ChavaAgenteProvider><ChavaAgenteUsuariosAdmin /></ChavaAgenteProvider>
          } />
          <Route path="/admin/chava-agente/conversaciones" element={
            <ChavaAgenteProvider><ChavaAgenteConversacionesAdmin /></ChavaAgenteProvider>
          } />
          <Route path="/admin/chava-agente/terminos" element={
            <ChavaAgenteProvider><ChavaAgenteTerminosAdmin /></ChavaAgenteProvider>
          } />

          {/* Public agent web pages — no auth required */}
          <Route path="/p/:slug" element={
            <Suspense fallback={<MoviLoader />}>
              <PaginaPublicaAsesor />
            </Suspense>
          } />

          {/* All other MOVI routes — requires auth, loaded lazily */}
          <Route path="*" element={
            <MoviPrivateRoute>
              <Suspense fallback={<MoviLoader />}>
                <MoviFullRoutes />
              </Suspense>
            </MoviPrivateRoute>
          } />
        </Routes>
      </MoviAuthProvider>
    </BrowserRouter>
  );
}

// ── Root entry point ─────────────────────────────────────────────────────────
export default function App() {
  if (isChavaDomain) return <ChavaAgenteApp />;
  if (isSeguwalletDomain) return <SeguwalletApp />;
  if (isMoviSplashDomain) return <MoviSplashApp />;
  if (isPublicProfileDomain) return <PublicProfileApp />;
  return <MoviApp />;
}
