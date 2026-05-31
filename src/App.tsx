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

// MOVI login (standalone, used when on movi.digital)
import MoviLogin from './pages/MoviLogin';

// Chava Agente pages
import ChavaAgenteLanding from './chava-agente/pages/ChavaAgenteLanding';
import ChavaAgenteUsuariosAdmin from './chava-agente/pages/admin/ChavaAgenteUsuariosAdmin';
import ChavaAgenteConversacionesAdmin from './chava-agente/pages/admin/ChavaAgenteConversacionesAdmin';
import ChavaAgenteTerminosAdmin from './chava-agente/pages/admin/ChavaAgenteTerminosAdmin';

// ── Domain detection ────────────────────────────────────────────────────────
const hostname = window.location.hostname;
const CHAVA_DOMAINS = ['agentedeseguros.ai', 'www.agentedeseguros.ai'];
const SEGUWALLET_DOMAINS = ['seguwallet.mx', 'www.seguwallet.mx', 'app.seguwallet.mx'];
const MOVI_DOMAINS = ['movi.digital', 'www.movi.digital', 'app.movi.digital'];

const isChavaDomain = CHAVA_DOMAINS.includes(hostname);
const isSeguwalletDomain = SEGUWALLET_DOMAINS.includes(hostname);
const isMoviDomain = MOVI_DOMAINS.includes(hostname);

// ── Shared private route guard ───────────────────────────────────────────────
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

// ── 2. Seguwallet app (seguwallet.mx) — passwordless OTP login ───────────────
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

// ── 3. MOVI Digital app (movi.digital) — password login, full MOVI platform ──
function MoviApp() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<MoviLogin />} />

          {/* Chava Agente — public platform accessible from MOVI */}
          <Route path="/chava-agente" element={
            <ChavaAgenteProvider>
              <ChavaAgenteLanding />
            </ChavaAgenteProvider>
          } />

          {/* Chava Agente — MOVI admin */}
          <Route path="/admin/chava-agente/usuarios" element={
            <ChavaAgenteProvider>
              <ChavaAgenteUsuariosAdmin />
            </ChavaAgenteProvider>
          } />
          <Route path="/admin/chava-agente/conversaciones" element={
            <ChavaAgenteProvider>
              <ChavaAgenteConversacionesAdmin />
            </ChavaAgenteProvider>
          } />
          <Route path="/admin/chava-agente/terminos" element={
            <ChavaAgenteProvider>
              <ChavaAgenteTerminosAdmin />
            </ChavaAgenteProvider>
          } />

          {/* All other MOVI routes are handled by the full MOVI app bundle */}
          <Route path="*" element={<MoviFullApp />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

// Lazy-loaded full MOVI routes (only rendered on movi.digital after login)
function MoviFullApp() {
  const { customer, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center"
      style={{ background: '#040c1f' }}>
      <div className="w-10 h-10 rounded-full border-4 border-blue-900 border-t-blue-400 animate-spin" />
    </div>
  );
  if (!customer) return <Navigate to="/login" replace />;
  // When authenticated on movi.digital, render the full MOVI application
  return <MoviDashboardRedirect />;
}

function MoviDashboardRedirect() {
  return <Navigate to="/dashboard" replace />;
}

// ── 4. Default / localhost — full MOVI platform (legacy) ────────────────────
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
            <ChavaAgenteProvider>
              <ChavaAgenteLanding />
            </ChavaAgenteProvider>
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
