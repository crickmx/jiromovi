import { useState, useEffect } from 'react';
import { useChavaAgente } from '../lib/ChavaAgenteContext';
import ChatInterface from '../components/ChatInterface';
import ConversationSidebar from '../components/ConversationSidebar';
import ChavaAgenteAuthModal from '../components/ChavaAgenteAuthModal';
import { ChavaBrandLogo } from '../../components/chava/ChavaBrandLogo';
import { ChavaAvatar } from '../../components/chava/ChavaAvatar';
import { LogOut, ChevronRight, Menu, Shield, BookOpen, Scale, Cpu } from 'lucide-react';

const PILLARS = [
  { icon: BookOpen, label: 'Base institucional JIRO' },
  { icon: Scale, label: 'Marco regulatorio CNSF · LISF' },
  { icon: Cpu, label: 'IA especializada en seguros MX' },
  { icon: Shield, label: 'Privacidad y datos protegidos' },
];

export default function ChavaAgenteLanding() {
  useEffect(() => { document.title = 'Chava AI'; }, []);
  const { chavaUser, loading, logout } = useChavaAgente();
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pendingMsg, setPendingMsg] = useState('');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  function handleAuthRequired(msg: string) {
    setPendingMsg(msg);
    setShowAuthModal(true);
  }

  function handleNewConversation() {
    setActiveConvId(null);
    setMobileSidebarOpen(false);
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: '#0A183D' }}>
        <div className="flex flex-col items-center gap-4">
          <ChavaAvatar size="lg" animate />
          <p className="text-sm text-slate-400">Cargando Chava AI...</p>
        </div>
      </div>
    );
  }

  // ── Authenticated view ──────────────────────────────────────────────────────
  if (chavaUser) {
    return (
      <div className="flex h-screen overflow-hidden" style={{ background: '#0A183D' }}>
        {/* Sidebar — desktop */}
        <div className="hidden lg:flex flex-col w-72 flex-shrink-0 border-r overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <div className="h-full flex flex-col" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <ChavaBrandLogo size="sm" />
            </div>
            <div className="flex-1 overflow-hidden">
              <ConversationSidebar
                activeId={activeConvId}
                onSelect={id => setActiveConvId(id)}
                onNew={handleNewConversation}
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

        {/* Mobile sidebar overlay */}
        {mobileSidebarOpen && (
          <div className="fixed inset-0 z-40 flex lg:hidden">
            <div className="absolute inset-0 bg-black/70" onClick={() => setMobileSidebarOpen(false)} />
            <div className="relative z-10 w-72">
              <ConversationSidebar
                activeId={activeConvId}
                onSelect={id => { setActiveConvId(id); setMobileSidebarOpen(false); }}
                onNew={handleNewConversation}
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
            onAuthRequired={handleAuthRequired}
          />
        </div>

        {showAuthModal && (
          <ChavaAgenteAuthModal
            onClose={() => setShowAuthModal(false)}
            pendingMessage={pendingMsg}
          />
        )}
      </div>
    );
  }

  // ── Landing page (unauthenticated) ──────────────────────────────────────────
  return (
    <>
      <div
        className="h-screen overflow-hidden flex flex-col lg:flex-row relative"
        style={{ background: 'linear-gradient(160deg, #060f25 0%, #0A183D 60%, #071020 100%)' }}
      >
        {/* Subtle grid */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: 'linear-gradient(rgba(0,229,255,0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(0,229,255,0.018) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }} />
        {/* Ambient glow */}
        <div className="absolute top-0 right-1/4 w-[500px] h-[400px] pointer-events-none" style={{ background: 'radial-gradient(ellipse at 60% 0%, rgba(13,110,253,0.1) 0%, transparent 65%)' }} />

        {/* LEFT PANEL */}
        <div
          className="relative z-10 lg:w-[40%] xl:w-[38%] flex flex-col justify-between px-8 lg:px-12 xl:px-14 py-8 lg:py-12 border-b lg:border-b-0 lg:border-r flex-shrink-0 overflow-y-auto lg:overflow-hidden"
          style={{ borderColor: 'rgba(255,255,255,0.05)' }}
        >
          <div>
            {/* Logo row */}
            <div className="flex items-center justify-between mb-10">
              <ChavaBrandLogo size="md" animate />
              <button
                onClick={() => setShowAuthModal(true)}
                className="text-xs font-medium transition-all px-3.5 py-2 rounded-xl lg:hidden"
                style={{ color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                Iniciar sesión
              </button>
            </div>

            {/* Headline */}
            <h1 className="text-3xl xl:text-4xl font-bold text-white leading-tight mb-4">
              Tu experto en seguros,<br />
              <span className="font-extrabold" style={{ color: '#00E5FF' }}>disponible 24/7</span>
            </h1>

            <p className="text-sm leading-relaxed mb-8 max-w-xs" style={{ color: 'rgba(255,255,255,0.42)' }}>
              IA especializada en el mercado asegurador mexicano, respaldada por el conocimiento institucional de Grupo JIRO.
            </p>

            {/* Pillars */}
            <div className="space-y-2.5 mb-10">
              {PILLARS.map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.15)' }}>
                    <Icon className="w-3 h-3" style={{ color: '#00E5FF' }} />
                  </div>
                  <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.55)' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom */}
          <div>
            <button
              onClick={() => setShowAuthModal(true)}
              className="hidden lg:flex w-full items-center justify-center gap-2 h-11 rounded-xl text-sm font-semibold text-white mb-6 transition-all hover:opacity-90 active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg, #0D6EFD, #00c8e0)' }}
            >
              Iniciar sesión
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* Grupo JIRO attribution */}
            <div className="flex items-center gap-3 pt-5" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: 'rgba(255,255,255,0.2)' }}>Desarrollado por</span>
              <img
                src="/logojiro.png"
                alt="Grupo JIRO"
                className="h-5 object-contain opacity-40 hover:opacity-60 transition-opacity"
              />
            </div>
          </div>
        </div>

        {/* RIGHT PANEL — live chat */}
        <div className="relative z-10 flex-1 flex flex-col overflow-hidden" style={{ background: 'rgba(255,255,255,0.01)' }}>
          <div className="flex-1 overflow-hidden flex flex-col">
            <ChatInterface
              conversationId={null}
              onConversationCreated={() => {}}
              onAuthRequired={handleAuthRequired}
            />
          </div>

          {/* Auth prompt bar */}
          <div className="border-t px-4 py-3 flex items-center gap-3 flex-shrink-0" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(0,229,255,0.03)' }}>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white">Guarda tu historial de conversaciones</p>
              <p className="text-[10px] truncate" style={{ color: 'rgba(255,255,255,0.35)' }}>Crea una cuenta gratuita o inicia sesión</p>
            </div>
            <button
              onClick={() => setShowAuthModal(true)}
              className="flex items-center gap-1.5 text-xs font-semibold text-white px-3.5 py-2 rounded-xl transition-all flex-shrink-0 hover:opacity-90 active:scale-95"
              style={{ background: 'linear-gradient(135deg, #0D6EFD, #00c8e0)' }}
            >
              Crear cuenta
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {showAuthModal && (
        <ChavaAgenteAuthModal
          onClose={() => setShowAuthModal(false)}
          pendingMessage={pendingMsg}
        />
      )}
    </>
  );
}
