import { useState, useEffect } from 'react';
import { useChavaAgente } from '../lib/ChavaAgenteContext';
import ChatInterface from '../components/ChatInterface';
import ConversationSidebar from '../components/ConversationSidebar';
import ChavaAgenteAuthModal from '../components/ChavaAgenteAuthModal';
import { ChavaBrandLogo } from '../../components/chava/ChavaBrandLogo';
import { ChavaAvatar } from '../../components/chava/ChavaAvatar';
import { LogOut, ChevronRight, Menu, Check } from 'lucide-react';

const COMPACT_BENEFITS = [
  'Dudas frecuentes de seguros',
  'Comparativos de coberturas',
  'Situaciones reales: siniestros y cobranza',
  'Explicación de pólizas y condiciones',
  'Apoyo para agentes y asegurados',
  'Disponible 24/7, sin esperas',
];

// ─── Authenticated layout ─────────────────────────────────────────────────────

function AuthenticatedLayout({
  chavaUser,
  logout,
  activeConvId,
  setActiveConvId,
}: {
  chavaUser: NonNullable<ReturnType<typeof useChavaAgente>['chavaUser']>;
  logout: () => void;
  activeConvId: string | null;
  setActiveConvId: (id: string | null) => void;
}) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#0A183D' }}>
      <div className="hidden lg:flex flex-col w-72 flex-shrink-0 border-r overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="h-full flex flex-col" style={{ background: 'rgba(255,255,255,0.03)' }}>
          <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <ChavaBrandLogo size="sm" />
          </div>
          <div className="flex-1 overflow-hidden">
            <ConversationSidebar
              activeId={activeConvId}
              onSelect={id => setActiveConvId(id)}
              onNew={() => setActiveConvId(null)}
            />
          </div>
          <div className="border-t p-3" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl">
              <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.3)' }}>
                <span className="text-[11px] font-bold" style={{ color: '#00E5FF' }}>
                  {chavaUser.nombre_completo.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-200 truncate">{chavaUser.nombre_completo}</p>
                <p className="text-[10px] text-slate-500 truncate">{chavaUser.email}</p>
              </div>
              <button onClick={logout} title="Cerrar sesión" className="text-slate-500 hover:text-slate-300 transition-colors p-1 rounded-lg hover:bg-white/5">
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div className="absolute inset-0 bg-black/70" onClick={() => setMobileSidebarOpen(false)} />
          <div className="relative z-10 w-72">
            <ConversationSidebar
              activeId={activeConvId}
              onSelect={id => { setActiveConvId(id); setMobileSidebarOpen(false); }}
              onNew={() => { setActiveConvId(null); setMobileSidebarOpen(false); }}
              onClose={() => setMobileSidebarOpen(false)}
            />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.03)' }}>
          <button onClick={() => setMobileSidebarOpen(true)} className="text-slate-400 hover:text-white">
            <Menu className="w-5 h-5" />
          </button>
          <ChavaBrandLogo size="sm" showDomain={false} />
        </div>
        <ChatInterface
          conversationId={activeConvId}
          onConversationCreated={id => setActiveConvId(id)}
          onAuthRequired={() => {}}
        />
      </div>
    </div>
  );
}

// ─── Landing page ─────────────────────────────────────────────────────────────

export default function ChavaAgenteLanding() {
  useEffect(() => { document.title = 'Chava AI — Tu experto en seguros'; }, []);
  const { chavaUser, loading, logout } = useChavaAgente();
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authInitialView, setAuthInitialView] = useState<'login' | 'register'>('login');
  const [pendingMsg, setPendingMsg] = useState('');

  function openLogin() { setAuthInitialView('login'); setShowAuthModal(true); }
  function openRegister() { setAuthInitialView('register'); setShowAuthModal(true); }
  function handleAuthRequired(msg: string) { setPendingMsg(msg); setAuthInitialView('register'); setShowAuthModal(true); }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: '#0A183D' }}>
        <div className="flex flex-col items-center gap-3">
          <ChavaAvatar size="lg" animate />
          <p className="text-sm text-slate-400">Cargando Chava AI...</p>
        </div>
      </div>
    );
  }

  if (chavaUser) {
    return (
      <AuthenticatedLayout
        chavaUser={chavaUser}
        logout={logout}
        activeConvId={activeConvId}
        setActiveConvId={setActiveConvId}
      />
    );
  }

  return (
    <>
      {/* Full-screen container — no scroll */}
      <div
        className="h-screen overflow-hidden flex flex-col"
        style={{ background: 'linear-gradient(160deg, #060f25 0%, #0A183D 55%, #071020 100%)' }}
      >
        {/* Background decoration */}
        <div className="fixed inset-0 pointer-events-none" style={{
          backgroundImage: 'linear-gradient(rgba(0,229,255,0.013) 1px, transparent 1px), linear-gradient(90deg, rgba(0,229,255,0.013) 1px, transparent 1px)',
          backgroundSize: '64px 64px', zIndex: 0,
        }} />
        <div className="fixed top-0 right-1/3 w-[500px] h-[400px] pointer-events-none" style={{ background: 'radial-gradient(ellipse at 60% 0%, rgba(13,110,253,0.1) 0%, transparent 65%)', zIndex: 0 }} />

        {/* ── Mobile header ──────────────────────────────────────────── */}
        <div className="relative z-10 lg:hidden flex items-center justify-between px-5 py-3 flex-shrink-0 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <ChavaBrandLogo size="sm" showDomain={false} />
          <div className="flex items-center gap-2">
            <button onClick={openLogin} className="text-xs font-medium px-2.5 py-1.5 rounded-lg" style={{ color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)' }}>
              Iniciar sesión
            </button>
            <button onClick={openRegister} className="text-xs font-semibold px-2.5 py-1.5 rounded-lg text-white" style={{ background: 'linear-gradient(135deg, #0D6EFD, #00c8e0)' }}>
              Crear cuenta
            </button>
          </div>
        </div>

        {/* ── Main split — fills remaining height ────────────────────── */}
        <div className="relative z-10 flex-1 flex flex-col lg:flex-row overflow-hidden">

          {/* ── LEFT PANEL ───────────────────────────────────────────── */}
          <div
            className="w-full lg:w-[42%] xl:w-[40%] flex-shrink-0 flex flex-col overflow-hidden border-b lg:border-b-0 lg:border-r"
            style={{ borderColor: 'rgba(255,255,255,0.06)' }}
          >
            {/* Scrollable inner — handles edge case where viewport is very short */}
            <div className="flex-1 flex flex-col overflow-y-auto px-6 lg:px-9 xl:px-11 py-5 lg:py-7 chava-left-scroll">

              {/* Brand hero */}
              <div className="flex items-center gap-4 mb-5">
                <ChavaAvatar size="lg" animate className="flex-shrink-0" />
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <img
                      src="/chava-ai-logo.svg"
                      alt="Chava AI"
                      className="h-9 w-auto object-contain"
                      onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                    />
                    <span className="hidden text-xl font-black tracking-tight text-white">CHAVA AI</span>
                  </div>
                  <h1 className="text-xl lg:text-2xl font-bold text-white leading-tight">
                    Tu experto en seguros,{' '}
                    <span style={{ color: '#00E5FF' }}>disponible 24/7</span>
                  </h1>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>
                      IA especializada en seguros · En línea
                    </span>
                  </div>
                </div>
              </div>

              {/* Compact benefits */}
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mb-5">
                {COMPACT_BENEFITS.map(b => (
                  <div key={b} className="flex items-start gap-1.5">
                    <Check className="w-3 h-3 flex-shrink-0 mt-0.5" style={{ color: '#00E5FF' }} />
                    <span className="text-[11px] leading-tight" style={{ color: 'rgba(255,255,255,0.5)' }}>{b}</span>
                  </div>
                ))}
              </div>

              {/* Divider */}
              <div className="mb-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />

              {/* Access label */}
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-2.5" style={{ color: 'rgba(255,255,255,0.25)' }}>
                Accede con tu plataforma
              </p>

              {/* MOVI + Seguwallet */}
              <div className="grid grid-cols-2 gap-2.5 mb-3">
                <button
                  onClick={openLogin}
                  className="flex items-center gap-2.5 rounded-xl p-3 transition-all duration-150 text-left"
                  style={{ background: 'rgba(13,110,253,0.06)', border: '1px solid rgba(13,110,253,0.2)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(13,110,253,0.12)'; e.currentTarget.style.borderColor = 'rgba(13,110,253,0.4)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(13,110,253,0.06)'; e.currentTarget.style.borderColor = 'rgba(13,110,253,0.2)'; }}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(13,110,253,0.15)' }}>
                    <img src="/logojiro.png" alt="MOVI" className="h-4 w-auto object-contain" style={{ mixBlendMode: 'screen' }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white leading-tight">MOVI Digital</p>
                    <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.38)' }}>Agentes y equipos</p>
                  </div>
                </button>

                <button
                  onClick={openLogin}
                  className="flex items-center gap-2.5 rounded-xl p-3 transition-all duration-150 text-left"
                  style={{ background: 'rgba(52,211,153,0.05)', border: '1px solid rgba(52,211,153,0.18)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(52,211,153,0.1)'; e.currentTarget.style.borderColor = 'rgba(52,211,153,0.38)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(52,211,153,0.05)'; e.currentTarget.style.borderColor = 'rgba(52,211,153,0.18)'; }}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(52,211,153,0.12)' }}>
                    <img src="/seguwallet-logo.png" alt="Seguwallet" className="h-4 w-auto object-contain" style={{ mixBlendMode: 'screen' }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white leading-tight">Seguwallet</p>
                    <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.38)' }}>Asegurados</p>
                  </div>
                </button>
              </div>

              {/* Register CTA */}
              <div className="rounded-xl p-3 mb-4" style={{ background: 'rgba(0,229,255,0.04)', border: '1px solid rgba(0,229,255,0.12)' }}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white">¿No tienes cuenta?</p>
                    <p className="text-[10px] mt-0.5 leading-tight" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      Gratis · Acceso inmediato · Sin tarjeta
                    </p>
                  </div>
                  <button
                    onClick={openRegister}
                    className="flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold text-white px-3.5 py-2 rounded-xl transition-all hover:opacity-90 active:scale-95"
                    style={{ background: 'linear-gradient(135deg, #0D6EFD, #00c8e0)' }}
                  >
                    Crear cuenta
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Spacer pushes footer down */}
              <div className="flex-1" />

              {/* Institutional footer */}
              <div className="flex items-center gap-4 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <span className="text-[9px] uppercase tracking-wider font-medium flex-shrink-0" style={{ color: 'rgba(255,255,255,0.18)' }}>Desarrollado por</span>
                <img src="/logojiro.png" alt="Grupo JIRO" className="h-4 object-contain opacity-25 hover:opacity-40 transition-opacity" style={{ mixBlendMode: 'screen' }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                <img src="/seguwallet-logo.png" alt="Seguwallet" className="h-3 object-contain opacity-20 hover:opacity-35 transition-opacity" style={{ mixBlendMode: 'screen' }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
              </div>
            </div>
          </div>

          {/* ── RIGHT PANEL: Chat ─────────────────────────────────────── */}
          <div className="relative z-10 flex-1 flex flex-col overflow-hidden" style={{ background: 'rgba(255,255,255,0.005)' }}>
            {/* Chat header (desktop) */}
            <div className="hidden lg:flex items-center gap-2.5 px-6 py-3 border-b flex-shrink-0" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-medium flex-1" style={{ color: 'rgba(255,255,255,0.45)' }}>Chava AI · En línea</span>
              <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.2)' }}>agentedeseguros.ai</span>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
              <ChatInterface
                conversationId={null}
                onConversationCreated={() => {}}
                onAuthRequired={handleAuthRequired}
              />
            </div>

            {/* Conversion bar */}
            <div className="border-t px-4 py-2.5 flex items-center gap-3 flex-shrink-0" style={{ borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(0,229,255,0.02)' }}>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white">Guarda tu historial</p>
                <p className="text-[10px] truncate" style={{ color: 'rgba(255,255,255,0.3)' }}>Crea una cuenta gratuita o inicia sesión</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={openLogin}
                  className="hidden sm:block text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                  style={{ color: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.1)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'white')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.55)')}
                >
                  Iniciar sesión
                </button>
                <button
                  onClick={openRegister}
                  className="flex items-center gap-1.5 text-xs font-semibold text-white px-3.5 py-1.5 rounded-lg transition-all hover:opacity-90 active:scale-95"
                  style={{ background: 'linear-gradient(135deg, #0D6EFD, #00c8e0)' }}
                >
                  Crear cuenta
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showAuthModal && (
        <ChavaAgenteAuthModal
          onClose={() => { setShowAuthModal(false); setPendingMsg(''); }}
          pendingMessage={pendingMsg}
          initialView={authInitialView}
        />
      )}

      <style>{`
        .chava-left-scroll::-webkit-scrollbar { width: 3px; }
        .chava-left-scroll::-webkit-scrollbar-track { background: transparent; }
        .chava-left-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.07); border-radius: 2px; }
      `}</style>
    </>
  );
}
