import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ChavaAgenteProvider } from './chava-agente/lib/ChavaAgenteContext';
import { type ReactNode } from 'react';

// Seguwallet pages
import { SeguwalletLogin } from './seguwallet/pages/SeguwalletLogin';
import Dashboard from './pages/Dashboard';
import Polizas from './pages/Polizas';
import PolizaDetalle from './pages/PolizaDetalle';
import Cobranza from './pages/Cobranza';
import Documentos from './pages/Documentos';
import Perfil from './pages/Perfil';
import ChavaSeguwallet from './pages/ChavaSeguwallet';

// Chava Agente pages
import ChavaAgenteLanding from './chava-agente/pages/ChavaAgenteLanding';
import ChavaAgenteUsuariosAdmin from './chava-agente/pages/admin/ChavaAgenteUsuariosAdmin';
import ChavaAgenteConversacionesAdmin from './chava-agente/pages/admin/ChavaAgenteConversacionesAdmin';
import ChavaAgenteTerminosAdmin from './chava-agente/pages/admin/ChavaAgenteTerminosAdmin';

// ── Domain detection ────────────────────────────────────────────────────────
const hostname = window.location.hostname;

const CHAVA_DOMAINS = ['agentedeseguros.ai', 'www.agentedeseguros.ai'];
const SEGUWALLET_DOMAINS = ['seguwallet.mx', 'www.seguwallet.mx', 'app.seguwallet.mx'];
const MOVI_DOMAINS = ['movi.digital', 'www.movi.digital'];

const isChavaDomain = CHAVA_DOMAINS.includes(hostname);
const isSeguwalletDomain = SEGUWALLET_DOMAINS.includes(hostname);
const isMoviDomain = MOVI_DOMAINS.includes(hostname);

// ── Shared private route guard (Seguwallet) ──────────────────────────────────
function PrivateRoute({ children }: { children: ReactNode }) {
  const { customer, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center"
      style={{ background: 'linear-gradient(135deg, #050e24 0%, #0a2260 50%, #030810 100%)' }}>
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border-4 border-blue-900 border-t-blue-400 animate-spin" />
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Cargando...</p>
      </div>
    </div>
  );
  return customer ? <>{children}</> : <Navigate to="/login" replace />;
}

// ── 1. Chava Agente app (agentedeseguros.ai) ─────────────────────────────────
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

// ── 2. Seguwallet app (seguwallet.mx) — passwordless OTP ────────────────────
function SeguwalletApp() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/seguwallet/dashboard" replace />} />
          <Route path="/login" element={<SeguwalletLogin />} />
          <Route path="/seguwallet/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/seguwallet/polizas" element={<PrivateRoute><Polizas /></PrivateRoute>} />
          <Route path="/seguwallet/polizas/:id" element={<PrivateRoute><PolizaDetalle /></PrivateRoute>} />
          <Route path="/seguwallet/cobranza" element={<PrivateRoute><Cobranza /></PrivateRoute>} />
          <Route path="/seguwallet/documentos" element={<PrivateRoute><Documentos /></PrivateRoute>} />
          <Route path="/seguwallet/chava" element={<PrivateRoute><ChavaSeguwallet /></PrivateRoute>} />
          <Route path="/seguwallet/perfil" element={<PrivateRoute><Perfil /></PrivateRoute>} />
          <Route path="*" element={<Navigate to="/seguwallet/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

// ── 3. MOVI Digital splash (movi.digital) ───────────────────────────────────
// movi.digital is the marketing domain — app.movi.digital is the actual platform
function MoviApp() {
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
        {/* Background */}
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(135deg, #040c1f 0%, #061428 40%, #081a38 60%, #04101f 100%)',
        }} />
        <div className="absolute -top-56 -right-56 w-[700px] h-[700px] rounded-full" style={{
          background: 'radial-gradient(circle, #0D6EFD 0%, transparent 65%)',
          opacity: 0.12,
          animation: 'movi-pulse 10s ease-in-out infinite',
        }} />
        <div className="absolute bottom-0 -left-40 w-[500px] h-[500px] rounded-full" style={{
          background: 'radial-gradient(circle, #0047bb 0%, transparent 65%)',
          opacity: 0.1,
          animation: 'movi-pulse 14s ease-in-out infinite 3s',
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
            <span style={{
              background: 'linear-gradient(90deg, #0D6EFD, #00c8e0)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              para agentes de seguros
            </span>
          </h1>

          <p className="text-base mb-10 leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
            CRM, producción, comisiones y más — todo en un solo lugar.
          </p>

          <a
            href="https://app.movi.digital"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl text-sm font-bold text-white transition-all duration-200 active:scale-[0.98]"
            style={{
              background: 'linear-gradient(135deg, #0D6EFD, #0047bb)',
              boxShadow: '0 4px 24px rgba(13,110,253,0.4)',
            }}
            onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 6px 32px rgba(13,110,253,0.55)')}
            onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 4px 24px rgba(13,110,253,0.4)')}
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

// ── 4. Default / app.movi.digital / localhost — full MOVI platform ───────────
function DefaultApp() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/seguwallet/dashboard" replace />} />
          <Route path="/login" element={<SeguwalletLogin />} />
          <Route path="/seguwallet/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/seguwallet/polizas" element={<PrivateRoute><Polizas /></PrivateRoute>} />
          <Route path="/seguwallet/polizas/:id" element={<PrivateRoute><PolizaDetalle /></PrivateRoute>} />
          <Route path="/seguwallet/cobranza" element={<PrivateRoute><Cobranza /></PrivateRoute>} />
          <Route path="/seguwallet/documentos" element={<PrivateRoute><Documentos /></PrivateRoute>} />
          <Route path="/seguwallet/chava" element={<PrivateRoute><ChavaSeguwallet /></PrivateRoute>} />
          <Route path="/seguwallet/perfil" element={<PrivateRoute><Perfil /></PrivateRoute>} />

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

          <Route path="*" element={<Navigate to="/seguwallet/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

// ── Root entry point ─────────────────────────────────────────────────────────
export default function App() {
  if (isChavaDomain) return <ChavaAgenteApp />;
  if (isSeguwalletDomain) return <SeguwalletApp />;
  if (isMoviDomain) return <MoviApp />;
  return <DefaultApp />;
}
