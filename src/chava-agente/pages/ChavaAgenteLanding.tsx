import { useState, useEffect } from 'react';
import { useChavaAgente } from '../lib/ChavaAgenteContext';
import ChatInterface from '../components/ChatInterface';
import ConversationSidebar from '../components/ConversationSidebar';
import ChavaAgenteAuthModal from '../components/ChavaAgenteAuthModal';
import { ChavaBrandLogo } from '../../components/chava/ChavaBrandLogo';
import { ChavaAvatar } from '../../components/chava/ChavaAvatar';
import {
  LogOut, ChevronRight, Menu, Shield, BookOpen, Scale, Cpu,
  MessageSquare, FileSearch, GitCompare, GraduationCap,
  Briefcase, HeartHandshake, ChevronDown,
} from 'lucide-react';

const PILLARS = [
  { icon: BookOpen, label: 'Base institucional JIRO' },
  { icon: Scale, label: 'Marco regulatorio CNSF · LISF' },
  { icon: Cpu, label: 'IA especializada en seguros MX' },
  { icon: Shield, label: 'Privacidad y datos protegidos' },
];

const BENEFITS = [
  {
    icon: MessageSquare,
    title: 'Resuelve dudas frecuentes',
    items: ['¿Qué cubre una póliza?', '¿Qué es un deducible?', '¿Qué es un coaseguro?'],
  },
  {
    icon: FileSearch,
    title: 'Entiende situaciones reales',
    items: ['Siniestros', 'Cobranza', 'Reclamaciones', 'Renovaciones'],
  },
  {
    icon: GitCompare,
    title: 'Compara opciones',
    items: ['Coberturas', 'Seguros', 'Beneficios', 'Exclusiones'],
  },
  {
    icon: GraduationCap,
    title: 'Aprende sobre seguros',
    items: ['Conceptos', 'Productos', 'Procesos', 'Regulación'],
  },
  {
    icon: Briefcase,
    title: 'Apoyo para agentes',
    items: ['Argumentos de venta', 'Capacitación', 'Comunicación con clientes'],
  },
  {
    icon: HeartHandshake,
    title: 'Apoyo para asegurados',
    items: ['Entender pólizas', 'Comprender coberturas', 'Resolver dudas'],
  },
];

const USE_CASES = [
  'Explicar una póliza de vida o GMM',
  'Analizar coberturas y exclusiones',
  'Entender condiciones generales',
  'Resolver dudas de siniestros',
  'Preparar reuniones con clientes',
  'Aprender conceptos aseguradores',
  'Comparar alternativas de seguros',
  'Entender renovaciones y cobranza',
];

// ─── Authenticated layout ──────────────────────────────────────────────────────

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

  function handleNewConversation() {
    setActiveConvId(null);
    setMobileSidebarOpen(false);
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#0A183D' }}>
      {/* Sidebar desktop */}
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

      {/* Mobile sidebar */}
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
  const [showBenefits, setShowBenefits] = useState(false);

  function openLogin() { setAuthInitialView('login'); setShowAuthModal(true); }
  function openRegister() { setAuthInitialView('register'); setShowAuthModal(true); }
  function handleAuthRequired(msg: string) { setPendingMsg(msg); setAuthInitialView('register'); setShowAuthModal(true); }

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
      <div
        className="min-h-screen flex flex-col"
        style={{ background: 'linear-gradient(160deg, #060f25 0%, #0A183D 55%, #071020 100%)' }}
      >
        {/* Background decoration */}
        <div className="fixed inset-0 pointer-events-none" style={{
          backgroundImage: 'linear-gradient(rgba(0,229,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(0,229,255,0.015) 1px, transparent 1px)',
          backgroundSize: '64px 64px', zIndex: 0,
        }} />
        <div className="fixed top-0 right-1/4 w-[600px] h-[500px] pointer-events-none" style={{ background: 'radial-gradient(ellipse at 60% 0%, rgba(13,110,253,0.12) 0%, transparent 65%)', zIndex: 0 }} />
        <div className="fixed bottom-0 left-0 w-[400px] h-[400px] pointer-events-none" style={{ background: 'radial-gradient(ellipse at 0% 100%, rgba(0,229,255,0.05) 0%, transparent 70%)', zIndex: 0 }} />

        {/* Mobile nav */}
        <nav className="relative z-10 lg:hidden flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <ChavaBrandLogo size="sm" showDomain={false} />
          <div className="flex items-center gap-2">
            <button onClick={openLogin} className="text-xs font-medium px-3 py-1.5 rounded-lg" style={{ color: 'rgba(255,255,255,0.65)', border: '1px solid rgba(255,255,255,0.1)' }}>
              Iniciar sesión
            </button>
            <button onClick={openRegister} className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white" style={{ background: 'linear-gradient(135deg, #0D6EFD, #00c8e0)' }}>
              Crear cuenta
            </button>
          </div>
        </nav>

        {/* Main layout */}
        <div className="relative z-10 flex-1 flex flex-col lg:flex-row">

          {/* ── LEFT PANEL ─────────────────────────────────────────────── */}
          <div
            className="w-full lg:w-[44%] xl:w-[42%] flex-shrink-0 flex flex-col border-b lg:border-b-0 lg:border-r overflow-y-auto"
            style={{ borderColor: 'rgba(255,255,255,0.05)' }}
          >
            {/* Hero */}
            <div className="px-7 lg:px-10 xl:px-12 pt-8 lg:pt-10 pb-6">
              {/* Desktop logo */}
              <div className="hidden lg:flex items-center justify-between mb-8">
                <ChavaBrandLogo size="md" animate />
              </div>

              {/* Headline row */}
              <div className="flex items-start gap-4 mb-5">
                <ChavaAvatar size="lg" animate className="flex-shrink-0 hidden sm:block" />
                <div>
                  <div className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full mb-3" style={{ color: '#00E5FF', background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.2)' }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                    Disponible 24/7
                  </div>
                  <h1 className="text-2xl xl:text-3xl font-bold text-white leading-tight">
                    Tu experto en seguros,{' '}
                    <span style={{ color: '#00E5FF' }}>disponible 24/7</span>
                  </h1>
                  <p className="text-sm leading-relaxed mt-2" style={{ color: 'rgba(255,255,255,0.42)' }}>
                    La solución de IA especializada en seguros, respaldada por la experiencia de Grupo JIRO.
                  </p>
                </div>
              </div>

              {/* Pillars grid */}
              <div className="grid grid-cols-2 gap-1.5 mb-6">
                {PILLARS.map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(0,229,255,0.1)', border: '1px solid rgba(0,229,255,0.18)' }}>
                      <Icon className="w-2.5 h-2.5" style={{ color: '#00E5FF' }} />
                    </div>
                    <span className="text-[10px] font-medium leading-tight" style={{ color: 'rgba(255,255,255,0.5)' }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Login options */}
            <div className="px-7 lg:px-10 xl:px-12 pb-5">
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'rgba(255,255,255,0.28)' }}>
                ¿Ya eres usuario? Accede con tu plataforma
              </p>
              <div className="grid grid-cols-2 gap-3 mb-4">
                {/* MOVI Digital */}
                <button
                  onClick={openLogin}
                  className="group flex flex-col items-center gap-2 rounded-2xl p-4 transition-all duration-200"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                  onMouseEnter={e => { Object.assign(e.currentTarget.style, { border: '1px solid rgba(13,110,253,0.4)', background: 'rgba(13,110,253,0.07)' }); }}
                  onMouseLeave={e => { Object.assign(e.currentTarget.style, { border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)' }); }}
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(13,110,253,0.12)', border: '1px solid rgba(13,110,253,0.25)' }}>
                    <img src="/logojiro.png" alt="MOVI" className="h-5 w-auto object-contain opacity-75" style={{ mixBlendMode: 'screen' }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-semibold text-white">MOVI Digital</p>
                    <p className="text-[10px] leading-tight mt-0.5" style={{ color: 'rgba(255,255,255,0.38)' }}>Agentes y equipos</p>
                  </div>
                  <span className="text-[10px] font-semibold px-2.5 py-1 rounded-lg w-full text-center" style={{ background: 'rgba(13,110,253,0.18)', color: '#60a5fa' }}>
                    Iniciar sesión
                  </span>
                </button>

                {/* Seguwallet */}
                <button
                  onClick={openLogin}
                  className="group flex flex-col items-center gap-2 rounded-2xl p-4 transition-all duration-200"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                  onMouseEnter={e => { Object.assign(e.currentTarget.style, { border: '1px solid rgba(52,211,153,0.4)', background: 'rgba(52,211,153,0.05)' }); }}
                  onMouseLeave={e => { Object.assign(e.currentTarget.style, { border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)' }); }}
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)' }}>
                    <img src="/seguwallet-logo.png" alt="Seguwallet" className="h-5 w-auto object-contain opacity-80" style={{ mixBlendMode: 'screen' }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-semibold text-white">Seguwallet</p>
                    <p className="text-[10px] leading-tight mt-0.5" style={{ color: 'rgba(255,255,255,0.38)' }}>Asegurados y clientes</p>
                  </div>
                  <span className="text-[10px] font-semibold px-2.5 py-1 rounded-lg w-full text-center" style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399' }}>
                    Iniciar sesión
                  </span>
                </button>
              </div>

              {/* Register CTA */}
              <div className="rounded-2xl p-4" style={{ background: 'rgba(0,229,255,0.035)', border: '1px solid rgba(0,229,255,0.12)' }}>
                <p className="text-xs font-semibold text-white mb-1">¿No tienes cuenta?</p>
                <p className="text-[10px] leading-relaxed mb-3" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Crea tu cuenta gratuita y comienza a usar Chava AI en segundos.
                </p>
                <div className="grid grid-cols-2 gap-y-1.5 mb-3.5">
                  {['Sin costo', 'Acceso inmediato', 'Especializado en seguros', 'Disponible 24/7'].map(b => (
                    <div key={b} className="flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: '#00E5FF' }} />
                      <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.5)' }}>{b}</span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={openRegister}
                  className="w-full flex items-center justify-center gap-2 h-9 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98]"
                  style={{ background: 'linear-gradient(135deg, #0D6EFD, #00c8e0)' }}
                >
                  Crear cuenta gratis
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Expandable benefits */}
            <div className="px-7 lg:px-10 xl:px-12 pb-5">
              <button
                onClick={() => setShowBenefits(v => !v)}
                className="w-full flex items-center justify-between py-3 text-left"
                style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
              >
                <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.55)' }}>¿Cómo puede ayudarte Chava AI?</span>
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showBenefits ? 'rotate-180' : ''}`} style={{ color: 'rgba(255,255,255,0.3)' }} />
              </button>

              {showBenefits && (
                <div className="pt-2 pb-3 space-y-2">
                  {BENEFITS.map(({ icon: Icon, title, items }) => (
                    <div key={title} className="flex gap-3 rounded-xl px-3.5 py-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.15)' }}>
                        <Icon className="w-3.5 h-3.5" style={{ color: '#00E5FF' }} />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-white mb-0.5">{title}</p>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                          {items.map(item => (
                            <span key={item} className="text-[10px]" style={{ color: 'rgba(255,255,255,0.38)' }}>{item}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Use cases */}
                  <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <p className="text-xs font-semibold text-white mb-2.5">Casos de uso</p>
                    <div className="grid grid-cols-2 gap-y-1.5 gap-x-4">
                      {USE_CASES.map(uc => (
                        <div key={uc} className="flex items-start gap-1.5">
                          <span className="w-1 h-1 rounded-full flex-shrink-0 mt-1.5" style={{ background: '#00E5FF' }} />
                          <span className="text-[10px] leading-snug" style={{ color: 'rgba(255,255,255,0.42)' }}>{uc}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Institutional backing */}
            <div className="px-7 lg:px-10 xl:px-12 pb-8 mt-auto">
              <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'rgba(255,255,255,0.22)' }}>
                  Respaldado por Grupo JIRO
                </p>
                <p className="text-[10px] leading-relaxed mb-3" style={{ color: 'rgba(255,255,255,0.32)' }}>
                  Más de 50 años de experiencia en el sector asegurador mexicano. Especialistas en seguros, tecnología, capacitación y desarrollo de agentes.
                </p>
                <div className="flex items-center gap-4 flex-wrap">
                  <img src="/logojiro.png" alt="Grupo JIRO" className="h-5 object-contain opacity-35 hover:opacity-55 transition-opacity" style={{ mixBlendMode: 'screen' }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                  <img src="/seguwallet-logo.png" alt="Seguwallet" className="h-4 object-contain opacity-30 hover:opacity-50 transition-opacity" style={{ mixBlendMode: 'screen' }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                </div>
              </div>
            </div>
          </div>

          {/* ── RIGHT PANEL: Chat ───────────────────────────────────────── */}
          <div
            className="relative z-10 flex-1 flex flex-col overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.01)', minHeight: '60vh' }}
          >
            {/* Chat header (desktop) */}
            <div className="hidden lg:flex items-center gap-3 px-6 py-4 border-b flex-shrink-0" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-medium flex-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Chava AI · En línea</span>
              <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.22)' }}>agentedeseguros.ai</span>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
              <ChatInterface
                conversationId={null}
                onConversationCreated={() => {}}
                onAuthRequired={handleAuthRequired}
              />
            </div>

            {/* Conversion bar */}
            <div className="border-t px-4 py-3 flex items-center gap-3 flex-shrink-0" style={{ borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(0,229,255,0.025)' }}>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white leading-tight">Guarda tu historial de conversaciones</p>
                <p className="text-[10px] mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.35)' }}>Crea una cuenta gratuita o inicia sesión para conservar tus consultas</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={openLogin}
                  className="hidden sm:block text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                  style={{ color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.12)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'white')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
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
    </>
  );
}
