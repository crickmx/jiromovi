import { useState, useEffect } from 'react';
import { useChavaAgente } from '../lib/ChavaAgenteContext';
import ChatInterface from '../components/ChatInterface';
import ConversationSidebar from '../components/ConversationSidebar';
import ChavaAgenteAuthModal from '../components/ChavaAgenteAuthModal';
import {
  Shield, Bot, BookOpen, Scale, FileText, Cpu, Users, Star,
  Menu, X, LogOut, MessageSquare, ChevronRight, Building2, Zap, Award
} from 'lucide-react';

const AUDIENCE_ITEMS = [
  { icon: Building2, title: 'Agentes de seguros', desc: 'Argumentos de venta, coberturas y técnica aseguradora al instante.' },
  { icon: Users, title: 'Promotores y directores', desc: 'Soporte técnico para tu equipo de agentes en tiempo real.' },
  { icon: Award, title: 'Estudiantes (Cédula A)', desc: 'Preparación para el examen con explicaciones claras y ejemplos.' },
  { icon: Zap, title: 'Empresarios y particulares', desc: 'Entiende tus seguros y toma mejores decisiones de cobertura.' },
];

const CAPABILITIES = [
  { icon: BookOpen, label: 'Base de conocimiento\ninstitucional', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
  { icon: Scale, label: 'Marco regulatorio\nCNSF · LISF', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
  { icon: FileText, label: 'Análisis de pólizas\ny condiciones', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  { icon: Cpu, label: 'IA especializada\nen seguros MX', color: 'text-cyan-600', bg: 'bg-cyan-50', border: 'border-cyan-200' },
];

export default function ChavaAgenteLanding() {
  const { chavaUser, loading, logout } = useChavaAgente();
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pendingMsg, setPendingMsg] = useState('');
  const [showSidebar, setShowSidebar] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    if (chavaUser) setShowSidebar(true);
  }, [chavaUser]);

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
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-cyan-200 border-t-cyan-500 rounded-full animate-spin" />
          <p className="text-sm text-slate-500">Cargando Chava Agente...</p>
        </div>
      </div>
    );
  }

  // Authenticated view with sidebar
  if (chavaUser) {
    return (
      <div className="flex h-screen bg-slate-50 overflow-hidden">
        {/* Sidebar — desktop */}
        <div className="hidden lg:flex flex-col w-72 flex-shrink-0 border-r border-slate-200 overflow-hidden">
          <div className="bg-slate-900 h-full flex flex-col">
            {/* Logo */}
            <div className="px-5 py-4 border-b border-slate-700/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center">
                  <Bot className="w-4.5 h-4.5 text-cyan-400" style={{ width: '1.125rem', height: '1.125rem' }} />
                </div>
                <div>
                  <p className="text-sm font-bold text-white leading-none">Chava Agente</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Experto en seguros — Grupo JIRO</p>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <ConversationSidebar
                activeId={activeConvId}
                onSelect={id => setActiveConvId(id)}
                onNew={handleNewConversation}
              />
            </div>
            {/* User footer */}
            <div className="border-t border-slate-700/50 p-3">
              <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl">
                <div className="w-7 h-7 rounded-full bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-[11px] font-bold text-cyan-400">
                    {chavaUser.nombre_completo.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-200 truncate">{chavaUser.nombre_completo}</p>
                  <p className="text-[10px] text-slate-500 truncate">{chavaUser.email}</p>
                </div>
                <button onClick={logout} title="Cerrar sesión" className="text-slate-500 hover:text-slate-300 transition-colors p-1 rounded-lg hover:bg-slate-700/50">
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile sidebar overlay */}
        {mobileSidebarOpen && (
          <div className="fixed inset-0 z-40 flex lg:hidden">
            <div className="absolute inset-0 bg-black/60" onClick={() => setMobileSidebarOpen(false)} />
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

        {/* Main chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Mobile header */}
          <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-slate-200 bg-white">
            <button onClick={() => setMobileSidebarOpen(true)} className="text-slate-600 hover:text-slate-800">
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-cyan-500" />
              <p className="text-sm font-semibold text-slate-800">Chava Agente</p>
            </div>
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

  // Landing page (unauthenticated)
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex flex-col">
      {/* Navbar */}
      <nav className="px-6 py-4 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center">
            <Bot className="w-4.5 h-4.5 text-cyan-400" style={{ width: '1.125rem', height: '1.125rem' }} />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Chava Agente</p>
            <p className="text-[10px] text-slate-400">by Grupo JIRO</p>
          </div>
        </div>
        <button
          onClick={() => setShowAuthModal(true)}
          className="text-sm text-slate-300 hover:text-white border border-slate-600 hover:border-slate-400 px-4 py-2 rounded-xl transition-all"
        >
          Iniciar sesión
        </button>
      </nav>

      {/* Hero / Main content */}
      <div className="flex-1 flex flex-col lg:flex-row">

        {/* Left panel — branding & info */}
        <div className="lg:w-[46%] flex flex-col justify-between px-8 py-10 lg:px-12 lg:py-12 border-b lg:border-b-0 lg:border-r border-white/5">
          {/* Headline */}
          <div>
            <div className="inline-flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/20 rounded-full px-3.5 py-1.5 mb-6">
              <Star className="w-3.5 h-3.5 text-cyan-400 fill-cyan-400" />
              <span className="text-xs text-cyan-300 font-medium">Impulsado por IA + 50 años de experiencia</span>
            </div>

            <h1 className="text-3xl lg:text-4xl font-bold text-white leading-tight mb-4">
              Tu experto en seguros,<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-cyan-200">
                disponible 24/7
              </span>
            </h1>

            <p className="text-slate-400 text-base leading-relaxed mb-8 max-w-md">
              Chava Agente combina inteligencia artificial con el conocimiento institucional de Grupo JIRO para darte respuestas precisas sobre seguros, coberturas, siniestros y el marco regulatorio mexicano.
            </p>

            {/* Capabilities grid */}
            <div className="grid grid-cols-2 gap-3 mb-8">
              {CAPABILITIES.map((cap, i) => {
                const Icon = cap.icon;
                return (
                  <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-3.5 hover:bg-white/8 transition-colors">
                    <div className={`w-8 h-8 rounded-lg ${cap.bg} border ${cap.border} flex items-center justify-center mb-2`}>
                      <Icon className={`w-4 h-4 ${cap.color}`} />
                    </div>
                    <p className="text-xs text-slate-300 font-medium leading-snug whitespace-pre-line">{cap.label}</p>
                  </div>
                );
              })}
            </div>

            {/* Audience */}
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-3">Para quién es</p>
              <div className="space-y-2">
                {AUDIENCE_ITEMS.map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <div key={i} className="flex items-start gap-3 py-2.5 px-3 rounded-xl hover:bg-white/5 transition-colors">
                      <div className="w-7 h-7 rounded-lg bg-slate-700/60 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Icon className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-200">{item.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5 leading-snug">{item.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Trust badges */}
          <div className="flex items-center gap-4 mt-8 pt-6 border-t border-white/5">
            <div className="flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-slate-500" />
              <span className="text-xs text-slate-500">Datos protegidos</span>
            </div>
            <div className="flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-slate-500" />
              <span className="text-xs text-slate-500">Historial guardado</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Bot className="w-4 h-4 text-slate-500" />
              <span className="text-xs text-slate-500">GPT-4o mini</span>
            </div>
          </div>
        </div>

        {/* Right panel — live chat */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 flex flex-col bg-slate-50 lg:bg-white overflow-hidden relative">
            {/* Chat glass overlay */}
            <div className="flex-1 overflow-hidden flex flex-col">
              <ChatInterface
                conversationId={null}
                onConversationCreated={() => {}}
                onAuthRequired={handleAuthRequired}
              />
            </div>

            {/* Auth prompt bar */}
            {!chavaUser && (
              <div className="border-t border-slate-200 bg-gradient-to-r from-slate-50 to-cyan-50/50 px-4 py-3 flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-xs font-medium text-slate-700">Guarda tu historial de conversaciones</p>
                  <p className="text-[10px] text-slate-500">Crea una cuenta gratuita o inicia sesión</p>
                </div>
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-white bg-cyan-500 hover:bg-cyan-600 px-3.5 py-2 rounded-xl transition-colors flex-shrink-0"
                >
                  Crear cuenta
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
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
