import { useState, useEffect } from 'react';
import { useChavaAgente } from '../lib/ChavaAgenteContext';
import ChatInterface from '../components/ChatInterface';
import ConversationSidebar from '../components/ConversationSidebar';
import ChavaAgenteAuthModal from '../components/ChavaAgenteAuthModal';
import { ChavaBrandLogo } from '../../components/chava/ChavaBrandLogo';
import { ChavaAvatar } from '../../components/chava/ChavaAvatar';
import { LogOut, ChevronRight, Menu, Check, Sparkles } from 'lucide-react';

const COMPACT_BENEFITS = [
  'Dudas frecuentes de seguros',
  'Comparativos de coberturas',
  'Situaciones reales: siniestros',
  'Explicación de pólizas',
  'Apoyo para agentes',
  'Disponible 24/7',
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

// ─── Platform access card ──────────────────────────────────────────────────────

function PlatformCard({
  onClick,
  accentRgb,
  icon,
  title,
  subtitle,
  cta,
}: {
  onClick: () => void;
  accentRgb: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  cta: string;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col rounded-2xl p-4 transition-all duration-200 text-left w-full"
      style={{
        background: `rgba(${accentRgb},0.06)`,
        border: `1px solid rgba(${accentRgb},0.18)`,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = `rgba(${accentRgb},0.11)`;
        e.currentTarget.style.borderColor = `rgba(${accentRgb},0.38)`;
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = `rgba(${accentRgb},0.06)`;
        e.currentTarget.style.borderColor = `rgba(${accentRgb},0.18)`;
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {/* Icon + title row */}
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `rgba(${accentRgb},0.14)` }}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-white leading-tight">{title}</p>
          <p className="text-[11px] leading-tight mt-0.5" style={{ color: 'rgba(255,255,255,0.42)' }}>{subtitle}</p>
        </div>
      </div>
      {/* CTA row */}
      <div
        className="flex items-center justify-between w-full rounded-xl px-3 py-2"
        style={{ background: `rgba(${accentRgb},0.1)` }}
      >
        <span className="text-xs font-semibold" style={{ color: `rgba(${accentRgb === '13,110,253' ? '120,180,255' : '52,211,153'},1)` }}>
          {cta}
        </span>
        <ChevronRight className="w-3.5 h-3.5 opacity-60 group-hover:translate-x-0.5 transition-transform" style={{ color: `rgba(${accentRgb === '13,110,253' ? '120,180,255' : '52,211,153'},0.8)` }} />
      </div>
    </button>
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
      {/* Root — full viewport, no scroll */}
      <div
        className="h-screen overflow-hidden flex flex-col"
        style={{ background: 'linear-gradient(160deg, #060f25 0%, #091730 55%, #071020 100%)' }}
      >
        {/* Subtle grid background */}
        <div className="fixed inset-0 pointer-events-none" style={{
          backgroundImage: 'linear-gradient(rgba(0,229,255,0.012) 1px, transparent 1px), linear-gradient(90deg, rgba(0,229,255,0.012) 1px, transparent 1px)',
          backgroundSize: '72px 72px', zIndex: 0,
        }} />
        {/* Top glow blob */}
        <div className="fixed top-0 left-1/3 w-[600px] h-[300px] pointer-events-none" style={{
          background: 'radial-gradient(ellipse at 40% 0%, rgba(13,110,253,0.09) 0%, transparent 65%)', zIndex: 0,
        }} />

        {/* ── Mobile nav ──────────────────────────────────────────────── */}
        <div className="relative z-10 lg:hidden flex items-center justify-between px-4 py-3 flex-shrink-0 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <ChavaBrandLogo size="sm" showDomain={false} />
          <div className="flex items-center gap-2">
            <button onClick={openLogin} className="text-xs font-medium px-2.5 py-1.5 rounded-lg" style={{ color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)' }}>
              Entrar
            </button>
            <button onClick={openRegister} className="text-xs font-semibold px-2.5 py-1.5 rounded-lg text-white" style={{ background: 'linear-gradient(135deg, #0D6EFD, #00c8e0)' }}>
              Crear cuenta
            </button>
          </div>
        </div>

        {/* ── Main two-column layout ───────────────────────────────────── */}
        <div className="relative z-10 flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">

          {/* ════════ LEFT PANEL ════════ */}
          <div
            className="w-full lg:w-[42%] xl:w-[38%] flex-shrink-0 flex flex-col overflow-hidden border-b lg:border-b-0 lg:border-r"
            style={{ borderColor: 'rgba(255,255,255,0.06)' }}
          >
            {/* Inner: flex column that fills height and distributes space */}
            <div className="flex-1 flex flex-col overflow-y-auto px-7 lg:px-9 xl:px-10 py-6 lg:py-0 chava-left-scroll">

              {/* ── BLOQUE 1+2+3: Brand hero ─────────────────────────── */}
              <div className="lg:pt-8 xl:pt-10 mb-5">
                {/* Avatar + wordmark */}
                <div className="flex items-center gap-4 mb-5">
                  <ChavaAvatar size="xl" animate className="flex-shrink-0" />
                  <div>
                    <img
                      src="/chava-ai-logo.svg"
                      alt="Chava AI"
                      className="h-10 w-auto object-contain mb-1"
                      onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                    />
                    {/* Live badge */}
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                      <span className="text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.38)' }}>
                        IA especializada en seguros · En línea
                      </span>
                    </div>
                  </div>
                </div>

                {/* Headline */}
                <h1 className="text-[22px] lg:text-2xl xl:text-[26px] font-extrabold text-white leading-[1.2] mb-2">
                  Tu experto en seguros,{' '}
                  <span style={{ color: '#00E5FF' }}>disponible 24/7</span>
                </h1>

                {/* Subtitle */}
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.42)' }}>
                  Resuelve dudas, compara coberturas y entiende tus pólizas con inteligencia artificial especializada.
                </p>
              </div>

              {/* ── BLOQUE 4: Benefits ───────────────────────────────── */}
              <div className="mb-5">
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  {COMPACT_BENEFITS.map(b => (
                    <div key={b} className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(0,229,255,0.1)' }}>
                        <Check className="w-2.5 h-2.5" style={{ color: '#00E5FF' }} />
                      </div>
                      <span className="text-[11px] leading-tight font-medium" style={{ color: 'rgba(255,255,255,0.52)' }}>{b}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Divider */}
              <div className="mb-5" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }} />

              {/* ── BLOQUE 5: Platform access ────────────────────────── */}
              <div className="mb-4">
                <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.22)' }}>
                  Accede con tu plataforma
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <PlatformCard
                    onClick={openLogin}
                    accentRgb="13,110,253"
                    icon={
                      /* movirecurso_2 = white MOVI logo, perfect for dark bg */
                      <img
                        src="/movirecurso_2.png"
                        alt="MOVI Digital"
                        className="h-5 w-auto object-contain"
                        onError={e => {
                          const img = e.currentTarget as HTMLImageElement;
                          img.style.display = 'none';
                          // Fallback: show M letter
                          const span = document.createElement('span');
                          span.textContent = 'M';
                          span.style.cssText = 'color:#7ab4ff;font-weight:900;font-size:14px';
                          img.parentElement?.appendChild(span);
                        }}
                      />
                    }
                    title="MOVI Digital"
                    subtitle="Para agentes y equipos"
                    cta="Iniciar sesión"
                  />
                  <PlatformCard
                    onClick={openLogin}
                    accentRgb="52,211,153"
                    icon={
                      <img
                        src="/seguwallet-logo.png"
                        alt="Seguwallet"
                        className="h-6 w-auto object-contain"
                        style={{ mixBlendMode: 'screen' }}
                        onError={e => {
                          const img = e.currentTarget as HTMLImageElement;
                          img.style.display = 'none';
                          const span = document.createElement('span');
                          span.textContent = 'S';
                          span.style.cssText = 'color:#34d399;font-weight:900;font-size:14px';
                          img.parentElement?.appendChild(span);
                        }}
                      />
                    }
                    title="Seguwallet"
                    subtitle="Para asegurados"
                    cta="Iniciar sesión"
                  />
                </div>
              </div>

              {/* ── BLOQUE 6: Register CTA ───────────────────────────── */}
              <div
                className="rounded-2xl p-4 mb-5"
                style={{
                  background: 'linear-gradient(135deg, rgba(13,110,253,0.1) 0%, rgba(0,229,255,0.06) 100%)',
                  border: '1px solid rgba(0,229,255,0.18)',
                }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#00E5FF' }} />
                  <p className="text-sm font-bold text-white">¿No tienes cuenta?</p>
                </div>
                <p className="text-[11px] mb-3 leading-snug" style={{ color: 'rgba(255,255,255,0.42)' }}>
                  Acceso gratuito e inmediato. Sin tarjeta de crédito.
                </p>
                <button
                  onClick={openRegister}
                  className="w-full flex items-center justify-center gap-2 text-sm font-bold text-white py-2.5 rounded-xl transition-all hover:opacity-90 active:scale-[0.98]"
                  style={{ background: 'linear-gradient(135deg, #0D6EFD, #00c8e0)' }}
                >
                  Crear cuenta gratis
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Spacer — pushes footer to bottom */}
              <div className="flex-1" />

              {/* ── BLOQUE 7: Institutional footer ──────────────────── */}
              <div
                className="flex items-center gap-3 py-4 lg:pb-6"
                style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
              >
                <span className="text-[9px] uppercase tracking-widest font-semibold flex-shrink-0" style={{ color: 'rgba(255,255,255,0.16)' }}>
                  Desarrollado por
                </span>
                {/* JIRO logo: has white bg, use screen blend */}
                <img
                  src="/logojiro.png"
                  alt="Grupo JIRO"
                  className="h-3.5 w-auto object-contain flex-shrink-0"
                  style={{ mixBlendMode: 'screen', opacity: 0.45 }}
                  onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                />
                <span style={{ color: 'rgba(255,255,255,0.1)', fontSize: '10px' }}>·</span>
                {/* MOVI icon only for footer — transparent bg, no blend needed */}
                <img
                  src="/movirecurso_7.png"
                  alt="MOVI Digital"
                  className="h-3.5 w-auto object-contain flex-shrink-0"
                  style={{ opacity: 0.35 }}
                  onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
            </div>
          </div>

          {/* ════════ RIGHT PANEL: Chat ════════ */}
          <div
            className="relative z-10 flex-1 flex flex-col overflow-hidden min-w-0"
            style={{ background: 'rgba(255,255,255,0.005)' }}
          >
            {/* Chat topbar — desktop only */}
            <div
              className="hidden lg:flex items-center gap-3 px-6 py-3 border-b flex-shrink-0"
              style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}
            >
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
              <span className="text-xs font-medium flex-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Chava AI · En línea
              </span>
              <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.18)' }}>
                agentedeseguros.ai
              </span>
            </div>

            {/* Chat area */}
            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
              <ChatInterface
                conversationId={null}
                onConversationCreated={() => {}}
                onAuthRequired={handleAuthRequired}
              />
            </div>

            {/* Conversion bar — bottom of chat */}
            <div
              className="border-t px-4 py-2.5 flex items-center gap-3 flex-shrink-0"
              style={{ borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(0,229,255,0.018)' }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white leading-tight">Guarda tu historial</p>
                <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.28)' }}>Crea una cuenta gratuita o inicia sesión</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={openLogin}
                  className="hidden sm:block text-xs font-medium px-3 py-1.5 rounded-lg transition-all"
                  style={{ color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.09)' }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'white'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; }}
                >
                  Iniciar sesión
                </button>
                <button
                  onClick={openRegister}
                  className="flex items-center gap-1.5 text-xs font-bold text-white px-3.5 py-1.5 rounded-lg transition-all hover:opacity-90 active:scale-95"
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
        .chava-left-scroll { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.07) transparent; }
        .chava-left-scroll::-webkit-scrollbar { width: 3px; }
        .chava-left-scroll::-webkit-scrollbar-track { background: transparent; }
        .chava-left-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.07); border-radius: 2px; }
      `}</style>
    </>
  );
}
