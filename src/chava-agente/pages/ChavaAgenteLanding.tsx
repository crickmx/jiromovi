import { useState } from 'react';
import { useChavaAgente } from '../lib/ChavaAgenteContext';
import ChatInterface from '../components/ChatInterface';
import ConversationSidebar from '../components/ConversationSidebar';
import ChavaAgenteAuthModal from '../components/ChavaAgenteAuthModal';
import { ChavaBrandLogo } from '../../components/chava/ChavaBrandLogo';
import { ChavaAvatar } from '../../components/chava/ChavaAvatar';
import {
  Shield, BookOpen, Scale, FileText, Cpu,
  Star, LogOut, MessageSquare, ChevronRight,
  Building2, Zap, Award, Users, Sparkles, Menu,
} from 'lucide-react';

const CAPABILITIES = [
  { icon: BookOpen, label: 'Base de conocimiento\ninstitucional', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  { icon: Scale, label: 'Marco regulatorio\nCNSF · LISF', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  { icon: FileText, label: 'Análisis de pólizas\ny condiciones', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  { icon: Cpu, label: 'IA especializada\nen seguros MX', color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
];

const AUDIENCE_ITEMS = [
  { icon: Building2, title: 'Agentes de seguros', desc: 'Argumentos de venta y coberturas al instante.' },
  { icon: Users, title: 'Promotores y directores', desc: 'Soporte técnico para tu equipo en tiempo real.' },
  { icon: Award, title: 'Estudiantes (Cédula A)', desc: 'Preparación para el examen con ejemplos claros.' },
  { icon: Zap, title: 'Empresarios y particulares', desc: 'Entiende tus seguros y toma mejores decisiones.' },
];

export default function ChavaAgenteLanding() {
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

  // Authenticated view
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

  // Landing page (unauthenticated) — fits exactly in viewport
  return (
    <>
      <div
        className="h-screen overflow-hidden flex flex-col lg:flex-row relative"
        style={{ background: 'linear-gradient(160deg, #0a1836 0%, #0A183D 50%, #071020 100%)' }}
      >
        {/* Background decorations */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: 'linear-gradient(rgba(0,229,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(0,229,255,0.025) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
        }} />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] pointer-events-none" style={{ background: 'radial-gradient(ellipse at 80% 10%, rgba(13,110,253,0.14) 0%, transparent 60%)' }} />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] pointer-events-none" style={{ background: 'radial-gradient(ellipse at 20% 90%, rgba(0,229,255,0.08) 0%, transparent 60%)' }} />

        {/* LEFT PANEL */}
        <div className="relative z-10 lg:w-[44%] xl:w-[42%] flex flex-col justify-between px-8 lg:px-12 xl:px-14 py-8 lg:py-10 border-b lg:border-b-0 lg:border-r flex-shrink-0 overflow-y-auto lg:overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>

          {/* Logo — hero element, no header */}
          <div>
            <div className="flex items-center justify-between mb-8">
              <ChavaBrandLogo size="md" animate />
              <button
                onClick={() => setShowAuthModal(true)}
                className="text-xs font-medium transition-all px-3.5 py-2 rounded-xl lg:hidden"
                style={{ color: 'rgba(255,255,255,0.75)', border: '1px solid rgba(255,255,255,0.12)' }}
              >
                Iniciar sesión
              </button>
            </div>

            {/* Badge */}
            <div className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 mb-5" style={{ background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.2)' }}>
              <Star className="w-3 h-3 fill-current" style={{ color: '#00E5FF' }} />
              <span className="text-xs font-medium" style={{ color: '#00E5FF' }}>IA + 50 años de experiencia aseguradora</span>
            </div>

            <h1 className="text-3xl xl:text-4xl font-bold text-white leading-tight mb-3">
              Tu experto en seguros,<br />
              <span className="font-extrabold" style={{ color: '#00E5FF' }}>disponible 24/7</span>
            </h1>

            <p className="text-sm leading-relaxed mb-6 max-w-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Chava AI combina inteligencia artificial con el conocimiento institucional de Grupo JIRO para responder sobre seguros, coberturas, siniestros y el marco regulatorio mexicano.
            </p>

            {/* Capabilities grid */}
            <div className="grid grid-cols-2 gap-2.5 mb-6">
              {CAPABILITIES.map((cap, i) => {
                const Icon = cap.icon;
                return (
                  <div key={i} className="rounded-xl p-3 transition-all" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div className={`w-7 h-7 rounded-lg ${cap.bg} border ${cap.border} flex items-center justify-center mb-2`}>
                      <Icon className={`w-3.5 h-3.5 ${cap.color}`} />
                    </div>
                    <p className="text-xs font-medium leading-snug whitespace-pre-line" style={{ color: 'rgba(255,255,255,0.7)' }}>{cap.label}</p>
                  </div>
                );
              })}
            </div>

            {/* Audience */}
            <div className="hidden lg:block">
              <p className="text-[10px] uppercase tracking-wider font-medium mb-2" style={{ color: 'rgba(255,255,255,0.28)' }}>Para quién es</p>
              <div className="grid grid-cols-2 gap-1.5">
                {AUDIENCE_ITEMS.map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <div key={i} className="flex items-center gap-2 py-2 px-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.025)' }}>
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.12)' }}>
                        <Icon className="w-3 h-3" style={{ color: '#00E5FF' }} />
                      </div>
                      <p className="text-xs font-medium leading-tight" style={{ color: 'rgba(255,255,255,0.7)' }}>{item.title}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bottom — trust badges + login button */}
          <div className="mt-6">
            <button
              onClick={() => setShowAuthModal(true)}
              className="hidden lg:flex w-full items-center justify-center gap-2 mb-5 h-10 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg, #0D6EFD, #00c8e0)' }}
            >
              Iniciar sesión
              <ChevronRight className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              {[
                { icon: Shield, label: 'Datos protegidos' },
                { icon: MessageSquare, label: 'Historial guardado' },
                { icon: Sparkles, label: 'GPT-4o mini' },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <Icon className="w-3 h-3" style={{ color: 'rgba(255,255,255,0.22)' }} />
                  <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.28)' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT PANEL — live chat preview */}
        <div className="relative z-10 flex-1 flex flex-col overflow-hidden" style={{ background: 'rgba(255,255,255,0.012)' }}>
          <div className="flex-1 overflow-hidden flex flex-col">
            <ChatInterface
              conversationId={null}
              onConversationCreated={() => {}}
              onAuthRequired={handleAuthRequired}
            />
          </div>

          {/* Auth prompt bar */}
          <div className="border-t px-4 py-2.5 flex items-center gap-3 flex-shrink-0" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(0,229,255,0.04)' }}>
            <div className="flex-1">
              <p className="text-xs font-medium text-white">Guarda tu historial de conversaciones</p>
              <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.38)' }}>Crea una cuenta gratuita o inicia sesión</p>
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
