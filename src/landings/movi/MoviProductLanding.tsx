import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  Shield,
  ShieldCheck,
  Smartphone,
  FileText,
  Download,
  PhoneCall,
  Sparkles,
  Lock,
  CheckCircle2,
  ArrowRight,
  ChevronRight,
  ChevronDown,
  Calendar,
  Zap,
  Car,
  HeartPulse,
  Building2,
  Menu,
  X,
  ExternalLink,
  MessageSquare,
  Clock,
  Laptop,
  Check,
  AlertTriangle,
  Info,
  HelpCircle,
  FileCheck,
  QrCode,
  Share2,
  Plus,
  Send,
  UserCheck,
  FolderOpen,
  Layers,
  Database,
  RefreshCw,
  TrendingUp,
  Cpu,
  BarChart3,
  Users,
  Briefcase,
  GraduationCap,
  Store,
  Palette,
  Sliders,
  DollarSign,
  Compass,
  Award,
  Globe,
  Bell,
  Mail,
  MessageCircle,
  Megaphone,
  SlidersHorizontal,
  Star,
  CheckCircle,
  ArrowUpRight,
  Eye,
  Settings
} from 'lucide-react';

// ─── RECURSOS LOCALES ────────────────────────────────────────────────────────
const LOGO_MOVI = '/movirecurso_2.png';
const LOGO_JIRO = '/logojiro.png';
const LOGO_SEGUWALLET = '/seguwallet-logo.png';
const LOGO_CHAVA = '/chava-ai-logo.svg';

const CARRIERS = [
  { name: 'GNP Seguros', logo: '/gnp-logo-png_seeklogo-61558.png' },
  { name: 'Quálitas', logo: '/qualitas-compania-de-seguros-logo-png_seeklogo-329374-2.png' },
  { name: 'Chubb', logo: '/chubb-logo-png_seeklogo-299281.png' },
  { name: 'Zurich', logo: '/zurich-logo-png_seeklogo-156664.png' },
  { name: 'MAPFRE', logo: '/mapfre-seguros-logo-png_seeklogo-225013.png' },
  { name: 'ANA Seguros', logo: '/ana-seguros-logo-png_seeklogo-187684.png' },
  { name: 'Afirme', logo: '/afirme-logo-png_seeklogo-4173.png' },
  { name: 'BX+', logo: '/logo-bx.png' },
  { name: 'Seguros Atlas', logo: '/seguros-atlas-logo-png_seeklogo-251455.png' },
  { name: 'Allianz', logo: '/allianz-seguros-logo-png_seeklogo-179147.png' },
  { name: 'Inbursa', logo: '/inbursa-logo-png_seeklogo-403106.png' },
  { name: 'Bupa', logo: '/logo-bupa.png' },
];

export default function MoviProductLanding() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Tabs del Mockup Interactivo Principal
  const [activeFeatureTab, setActiveFeatureTab] = useState<
    'tramites' | 'crm' | 'produccion' | 'miweb' | 'notificaciones' | 'education' | 'comunicados'
  >('tramites');

  // Estado del simulador "Mi Página Web" (Agente Demo)
  const [webColorTheme, setWebColorTheme] = useState<'blue' | 'emerald' | 'navy' | 'wine'>('blue');
  const [leadSent, setLeadSent] = useState(false);
  const [demoQuoteType, setDemoQuoteType] = useState<'auto' | 'gmm' | 'vida' | 'hogar'>('auto');

  // Calculadora de Productividad y ROI
  const [agentsCount, setAgentsCount] = useState<number>(20);
  const [monthlyPolicies, setMonthlyPolicies] = useState<number>(120);

  const hoursSavedPerMonth = Math.round(agentsCount * 14 + monthlyPolicies * 0.5);
  const moneySavedEstimate = Math.round(hoursSavedPerMonth * 195).toLocaleString('es-MX');

  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    const root = document.getElementById('root');
    root?.classList.add('public-page');
    return () => {
      root?.classList.remove('public-page');
    };
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMobileMenuOpen(false);
  };

  const getThemeColor = () => {
    switch (webColorTheme) {
      case 'emerald': return '#059669';
      case 'navy': return '#0F172A';
      case 'wine': return '#991B1B';
      default: return '#1C37E0';
    }
  };

  return (
    <>
      <Helmet>
        <title>MOVI Digital | Plataforma de Gestión de Grupo JIRO y Asociados</title>
        <meta
          name="description"
          content="MOVI Digital es la plataforma integral de gestión para agentes y promotorías de Grupo JIRO y Asociados. Control de trámites, Mi CRM, Central de Producción, Mi Página Web y notificaciones por WhatsApp y correo."
        />
        <meta
          name="keywords"
          content="MOVI Digital, Grupo JIRO, Grupo JIRO y Asociados, gestión de seguros, control de tramites, mi crm seguros, central de produccion, cotizador agentes, seguros education, comisiones aseguradoras, SICAS REST"
        />
        <link rel="canonical" href="https://movi.digital/" />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content="MOVI Digital | Plataforma de Gestión de Grupo JIRO y Asociados" />
        <meta
          property="og:description"
          content="El SaaS operativo definitivo para la red de agentes de Grupo JIRO. Trámites, CRM, comisiones, web personalizada y automatización."
        />
        <meta property="og:url" content="https://movi.digital/" />
        <meta property="og:image" content="https://movi.digital/movirecurso_2.png" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="MOVI Digital · Grupo JIRO y Asociados" />
        <meta
          name="twitter:description"
          content="Plataforma de gestión tecnológica para asesores y promotorías de seguros."
        />
      </Helmet>

      <div className="min-h-screen bg-[#030917] text-white selection:bg-[#1C37E0] selection:text-white font-sans antialiased">

        {/* ─── 1. NAVBAR SUPERIOR FIJO ─────────────────────────────────────── */}
        <header
          className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
          style={{
            background: 'rgba(3, 9, 23, 0.92)',
            backdropFilter: 'blur(20px)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
          }}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16 sm:h-20">
              
              {/* Logo MOVI + Respaldo Grupo JIRO */}
              <div className="flex items-center gap-3.5">
                <a
                  href="#inicio"
                  onClick={(e) => { e.preventDefault(); scrollTo('inicio'); }}
                  className="flex items-center gap-3 group"
                >
                  <img
                    src={LOGO_MOVI}
                    alt="MOVI Digital"
                    className="h-8 sm:h-10 w-auto object-contain transition-transform group-hover:scale-105"
                  />
                </a>
                <div className="h-5 w-[1px] bg-white/20 hidden sm:block" />
                <div className="hidden sm:flex items-center gap-2 text-xs text-white/60">
                  <span className="font-semibold text-white/90">Grupo JIRO y Asociados</span>
                </div>
              </div>

              {/* Desktop Menu */}
              <nav className="hidden lg:flex items-center gap-6 xl:gap-7">
                <button
                  onClick={() => scrollTo('funciones')}
                  className="text-xs xl:text-sm font-medium text-white/70 hover:text-white transition-colors cursor-pointer"
                >
                  Funciones Clave
                </button>
                <button
                  onClick={() => scrollTo('mi-web')}
                  className="text-xs xl:text-sm font-medium text-white/70 hover:text-white transition-colors cursor-pointer"
                >
                  Mi Página Web
                </button>
                <button
                  onClick={() => scrollTo('central-produccion')}
                  className="text-xs xl:text-sm font-medium text-white/70 hover:text-white transition-colors cursor-pointer"
                >
                  Central de Producción
                </button>
                <button
                  onClick={() => scrollTo('education')}
                  className="text-xs xl:text-sm font-medium text-white/70 hover:text-white transition-colors cursor-pointer"
                >
                  Seguros Education
                </button>
                <button
                  onClick={() => scrollTo('roi')}
                  className="text-xs xl:text-sm font-medium text-white/70 hover:text-white transition-colors cursor-pointer"
                >
                  Calculadora ROI
                </button>
                <button
                  onClick={() => scrollTo('faq')}
                  className="text-xs xl:text-sm font-medium text-white/70 hover:text-white transition-colors cursor-pointer"
                >
                  FAQ
                </button>
              </nav>

              {/* CTAs */}
              <div className="hidden sm:flex items-center gap-3">
                <a
                  href="https://app.movi.digital/login"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white transition-all duration-200 active:scale-95 shadow-lg shadow-blue-600/30 hover:shadow-blue-600/50"
                  style={{
                    background: 'linear-gradient(135deg, #1C37E0 0%, #3B58F0 100%)'
                  }}
                >
                  <Lock className="w-4 h-4" />
                  <span>Ingresar a MOVI</span>
                  <ArrowRight className="w-4 h-4 ml-0.5" />
                </a>
              </div>

              {/* Mobile menu toggle */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Abrir menú"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>

            </div>
          </div>

          {/* Mobile menu panel */}
          {mobileMenuOpen && (
            <div className="lg:hidden border-t border-white/10 bg-[#050F28]/98 px-5 py-6 space-y-4 backdrop-blur-2xl">
              <div className="space-y-2">
                {[
                  { label: 'Funciones Clave', id: 'funciones' },
                  { label: 'Mi Página Web (Agente Demo)', id: 'mi-web' },
                  { label: 'Central de Producción', id: 'central-produccion' },
                  { label: 'Seguros Education', id: 'education' },
                  { label: 'Calculadora ROI', id: 'roi' },
                  { label: 'Preguntas Frecuentes', id: 'faq' }
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => scrollTo(item.id)}
                    className="block w-full text-left px-4 py-3 text-base font-semibold text-white/80 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="pt-4 border-t border-white/10 space-y-3">
                <a
                  href="https://app.movi.digital/login"
                  className="flex items-center justify-center gap-2 w-full px-5 py-3.5 rounded-xl font-bold text-sm text-white text-center shadow-lg shadow-blue-600/30"
                  style={{ background: 'linear-gradient(135deg, #1C37E0 0%, #3B58F0 100%)' }}
                >
                  <Lock className="w-4 h-4" />
                  <span>Ingresar a MOVI App</span>
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            </div>
          )}
        </header>

        {/* ─── 2. HERO PRINCIPAL: AAA DEEP-TECH SAAS ───────────────────────── */}
        <section
          id="inicio"
          className="relative min-h-[94vh] flex items-center pt-24 pb-16 lg:pt-32 lg:pb-24 overflow-hidden"
          style={{
            background: 'radial-gradient(circle at 50% 15%, #0B2468 0%, #051028 45%, #030917 100%)'
          }}
        >
          {/* Geometría e iluminación de fondo */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
                                linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)`,
              backgroundSize: '64px 64px'
            }}
          />
          <div
            className="absolute -top-32 right-1/4 w-[650px] h-[650px] rounded-full pointer-events-none"
            style={{
              background: 'radial-gradient(circle, #1C37E0 0%, transparent 70%)',
              opacity: 0.25,
              filter: 'blur(70px)'
            }}
          />
          <div
            className="absolute bottom-10 left-10 w-[500px] h-[500px] rounded-full pointer-events-none"
            style={{
              background: 'radial-gradient(circle, #00E5FF 0%, transparent 70%)',
              opacity: 0.12,
              filter: 'blur(60px)'
            }}
          />

          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
            <div className="grid lg:grid-cols-12 gap-12 lg:gap-8 items-center">
              
              {/* Columna Izquierda: Copy Hero */}
              <div className="lg:col-span-7 space-y-7 text-center lg:text-left">
                
                {/* Badge Oficial */}
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.12] backdrop-blur-md">
                  <span className="w-2 h-2 rounded-full bg-[#00E5FF] animate-pulse" />
                  <span className="text-xs font-bold text-[#00E5FF] tracking-wide uppercase">
                    Plataforma Oficial de Grupo JIRO y Asociados
                  </span>
                </div>

                {/* Titular Principal */}
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-[1.08] tracking-tight">
                  El sistema operativo definitivo para{' '}
                  <span
                    className="bg-clip-text text-transparent"
                    style={{
                      backgroundImage: 'linear-gradient(135deg, #5B78FF 0%, #00E5FF 100%)'
                    }}
                  >
                    Agentes y Promotorías.
                  </span>
                </h1>

                {/* Subtítulo descriptivo */}
                <p className="text-base sm:text-lg text-white/75 leading-relaxed max-w-2xl mx-auto lg:mx-0">
                  Control de trámites en tiempo real, notificaciones automáticas por WhatsApp y correo, tu CRM integrado, Central de Producción para conciliar comisiones y tu página web personalizable para captar más pólizas.
                </p>

                {/* Botones de Acción */}
                <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3.5 pt-2">
                  <a
                    href="https://app.movi.digital/login"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl font-bold text-base text-white transition-all duration-200 active:scale-95 shadow-xl shadow-blue-600/35 hover:shadow-blue-600/50"
                    style={{
                      background: 'linear-gradient(135deg, #1C37E0 0%, #3B58F0 100%)'
                    }}
                  >
                    <Lock className="w-5 h-5" />
                    <span>Entrar a mi Portal MOVI</span>
                    <ArrowRight className="w-5 h-5" />
                  </a>

                  <button
                    onClick={() => scrollTo('funciones')}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-4 rounded-2xl font-semibold text-sm text-white/85 bg-white/[0.05] hover:bg-white/[0.10] border border-white/[0.12] transition-colors cursor-pointer"
                  >
                    <SlidersHorizontal className="w-4 h-4 text-[#00E5FF]" />
                    <span>Explorar Funciones</span>
                  </button>
                </div>

                {/* Badges de Métricas de Plataforma */}
                <div className="pt-6 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-4 text-left">
                  <div className="space-y-1">
                    <p className="text-xl sm:text-2xl font-black text-white">100%</p>
                    <p className="text-xs text-white/50 leading-tight">Control de trámites y pólizas</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xl sm:text-2xl font-black text-[#00E5FF]">WhatsApp</p>
                    <p className="text-xs text-white/50 leading-tight">Avisos automáticos en línea</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xl sm:text-2xl font-black text-emerald-400">SICAS</p>
                    <p className="text-xs text-white/50 leading-tight">Conciliación directa de comisiones</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xl sm:text-2xl font-black text-purple-400">Mi Web</p>
                    <p className="text-xs text-white/50 leading-tight">Conectada directo a tu CRM</p>
                  </div>
                </div>

              </div>

              {/* Columna Derecha: Mockup Interactivo del SaaS MOVI */}
              <div className="lg:col-span-5 flex justify-center lg:justify-end">
                <div className="relative w-full max-w-lg">
                  
                  {/* Glow */}
                  <div
                    className="absolute -inset-4 rounded-[36px] pointer-events-none"
                    style={{
                      background: 'linear-gradient(135deg, rgba(28,55,224,0.4) 0%, rgba(0,229,255,0.2) 100%)',
                      filter: 'blur(32px)'
                    }}
                  />

                  {/* Ventana Glassmorphic del SaaS */}
                  <div className="relative rounded-3xl border border-white/15 bg-[#081638]/95 shadow-2xl overflow-hidden backdrop-blur-xl">
                    
                    {/* Header de la ventana */}
                    <div className="px-5 py-3.5 bg-white/[0.04] border-b border-white/10 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-rose-500/80" />
                        <span className="w-3 h-3 rounded-full bg-amber-500/80" />
                        <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
                        <span className="ml-2 text-xs font-mono text-white/50">app.movi.digital</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span>Grupo JIRO Online</span>
                      </div>
                    </div>

                    {/* Selector de Pestañas del Mockup */}
                    <div className="flex overflow-x-auto no-scrollbar gap-1 p-2 bg-black/25 border-b border-white/10 text-[11px] font-bold text-center">
                      <button
                        onClick={() => setActiveFeatureTab('tramites')}
                        className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all ${
                          activeFeatureTab === 'tramites' ? 'bg-[#1C37E0] text-white shadow-xs' : 'text-white/60 hover:text-white'
                        }`}
                      >
                        Trámites
                      </button>
                      <button
                        onClick={() => setActiveFeatureTab('crm')}
                        className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all ${
                          activeFeatureTab === 'crm' ? 'bg-[#1C37E0] text-white shadow-xs' : 'text-white/60 hover:text-white'
                        }`}
                      >
                        Mi CRM
                      </button>
                      <button
                        onClick={() => setActiveFeatureTab('produccion')}
                        className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all ${
                          activeFeatureTab === 'produccion' ? 'bg-[#1C37E0] text-white shadow-xs' : 'text-white/60 hover:text-white'
                        }`}
                      >
                        Producción
                      </button>
                      <button
                        onClick={() => setActiveFeatureTab('notificaciones')}
                        className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all ${
                          activeFeatureTab === 'notificaciones' ? 'bg-[#1C37E0] text-white shadow-xs' : 'text-white/60 hover:text-white'
                        }`}
                      >
                        WhatsApp / Email
                      </button>
                      <button
                        onClick={() => setActiveFeatureTab('comunicados')}
                        className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all ${
                          activeFeatureTab === 'comunicados' ? 'bg-[#1C37E0] text-white shadow-xs' : 'text-white/60 hover:text-white'
                        }`}
                      >
                        Comunicados
                      </button>
                    </div>

                    {/* Contenido Dinámico de la Pestaña Activa */}
                    <div className="p-5 space-y-4 min-h-[380px] bg-[#050F28]">
                      
                      {/* Pestaña 1: Control de Trámites */}
                      {activeFeatureTab === 'tramites' && (
                        <div className="space-y-3 animate-in fade-in duration-200">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-white flex items-center gap-1.5">
                              <FileText className="w-4 h-4 text-blue-400" />
                              Mesa de Control de Trámites
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-bold text-[10px]">
                              18 Activos
                            </span>
                          </div>

                          <div className="space-y-2">
                            <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-between">
                              <div className="space-y-0.5 text-left">
                                <p className="text-xs font-bold text-white">Emisión Auto GNP · Folio #TR-4029</p>
                                <p className="text-[11px] text-white/50">Cliente: Logística del Norte · Póliza Anual</p>
                              </div>
                              <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                                Póliza Emitida
                              </span>
                            </div>

                            <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-between">
                              <div className="space-y-0.5 text-left">
                                <p className="text-xs font-bold text-white">Endoso GMM Quálitas · Folio #TR-4030</p>
                                <p className="text-[11px] text-white/50">Inclusión de dependiente · Alta médica</p>
                              </div>
                              <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold">
                                En Revisión JIRO
                              </span>
                            </div>

                            <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-between">
                              <div className="space-y-0.5 text-left">
                                <p className="text-xs font-bold text-white">Cotización Flotilla Chubb · Folio #TR-4031</p>
                                <p className="text-[11px] text-white/50">12 Unidades Nissan NP300</p>
                              </div>
                              <span className="px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold">
                                Cotización Lista
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Pestaña 2: Mi CRM */}
                      {activeFeatureTab === 'crm' && (
                        <div className="space-y-3 animate-in fade-in duration-200">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-white flex items-center gap-1.5">
                              <Users className="w-4 h-4 text-purple-400" />
                              Pipeline de Prospectos y Clientes
                            </span>
                            <span className="text-[10px] text-white/50">46 Contactos Activos</span>
                          </div>

                          <div className="space-y-2">
                            <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-between">
                              <div className="text-left space-y-0.5">
                                <p className="text-xs font-bold text-white">Ing. Roberto Sánchez</p>
                                <p className="text-[11px] text-white/50">Lead captado desde Mi Página Web · Auto GNP</p>
                              </div>
                              <span className="px-2.5 py-1 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] font-bold">
                                Lead Calificado
                              </span>
                            </div>

                            <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-between">
                              <div className="text-left space-y-0.5">
                                <p className="text-xs font-bold text-white">Dra. Claudia Morales</p>
                                <p className="text-[11px] text-white/50">Gastos Médicos Mayores · Renovación Octubre</p>
                              </div>
                              <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                                Cliente Vigente
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Pestaña 3: Central de Producción */}
                      {activeFeatureTab === 'produccion' && (
                        <div className="space-y-3 animate-in fade-in duration-200">
                          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-600/30 to-indigo-600/30 border border-blue-500/30 space-y-1 text-left">
                            <p className="text-xs text-blue-300 font-semibold">Comisiones Conciliadas (Quincena 19)</p>
                            <p className="text-2xl font-black text-white">$628,450.00 MXN</p>
                            <p className="text-[11px] text-emerald-400 font-semibold">✓ Layout SICAS verificado con aseguradoras</p>
                          </div>

                          <div className="space-y-1.5 text-xs">
                            <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-between">
                              <span>GNP Seguros (Emisión y Cobranza)</span>
                              <span className="font-bold text-emerald-400">$294,100.00 ✓</span>
                            </div>
                            <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-between">
                              <span>Quálitas Compañía de Seguros</span>
                              <span className="font-bold text-emerald-400">$218,600.00 ✓</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Pestaña 4: Notificaciones WhatsApp / Email */}
                      {activeFeatureTab === 'notificaciones' && (
                        <div className="space-y-3 animate-in fade-in duration-200 text-left">
                          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2.5">
                            <MessageCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                            <div>
                              <p className="text-xs font-bold text-emerald-300">WhatsApp Gateway JIRO</p>
                              <p className="text-[10.5px] text-white/60">Disparo automático al cambiar estatus del trámite</p>
                            </div>
                          </div>

                          <div className="p-3 rounded-2xl bg-[#0B1E40] border border-white/10 space-y-2 text-xs">
                            <div className="flex items-center justify-between text-[10px] text-white/40">
                              <span>Mensaje automático al cliente</span>
                              <span>Entregado ✓✓</span>
                            </div>
                            <p className="text-white/80 leading-relaxed text-[11px]">
                              "Hola <strong>Carlos</strong>, tu póliza de auto <strong>GNP #9281-9920</strong> ha sido emitida con éxito. Puedes descargar tu carátula y recibo directamente en tu Seguwallet."
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Pestaña 5: Comunicados y Circulares */}
                      {activeFeatureTab === 'comunicados' && (
                        <div className="space-y-2.5 animate-in fade-in duration-200 text-left">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-white flex items-center gap-1.5">
                              <Megaphone className="w-4 h-4 text-amber-400" />
                              Canal Institucional Grupo JIRO
                            </span>
                            <span className="text-[10px] text-amber-400 font-bold">Oficial</span>
                          </div>

                          <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] space-y-1">
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold">Campaña GNP</span>
                              <span className="text-white/40">Hoy</span>
                            </div>
                            <p className="text-xs font-bold text-white">Bono Trimestral de Autos y Gastos Médicos 2026</p>
                            <p className="text-[11px] text-white/60">Conoce los porcentajes adicionales por cumplimiento de meta mensual.</p>
                          </div>
                        </div>
                      )}

                    </div>

                    {/* Footer del Mockup */}
                    <div className="p-4 bg-white/[0.03] border-t border-white/10 flex items-center justify-between text-xs">
                      <span className="text-white/50">Plataforma MOVI · Grupo JIRO</span>
                      <a
                        href="https://app.movi.digital/login"
                        className="font-bold text-[#00E5FF] hover:underline flex items-center gap-1"
                      >
                        <span>Acceder al sistema</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </a>
                    </div>

                  </div>

                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ─── 3. CARROUSEL DE ASEGURADORAS ALIADAS ─────────────────────────── */}
        <section
          id="aseguradoras"
          className="py-12 bg-[#020714] border-y border-white/[0.08] relative overflow-hidden"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6 text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-white/40">
              Conectado y compatible con las principales aseguradoras de México a través de Grupo JIRO
            </p>
          </div>

          <div className="flex overflow-x-auto no-scrollbar gap-8 sm:gap-12 py-2 px-6 items-center justify-center flex-wrap opacity-80 hover:opacity-100 transition-opacity">
            {CARRIERS.map((c, i) => (
              <div
                key={i}
                className="h-10 sm:h-12 px-4 py-2 bg-white/[0.04] rounded-xl border border-white/[0.06] flex items-center justify-center transition-all hover:bg-white/[0.08] hover:scale-105"
              >
                <img
                  src={c.logo}
                  alt={c.name}
                  className="max-h-6 sm:max-h-7 max-w-[110px] w-auto object-contain filter brightness-110"
                  onError={(e) => {
                    const span = document.createElement('span');
                    span.textContent = c.name;
                    span.className = 'text-xs font-bold text-white/80';
                    e.currentTarget.parentElement?.appendChild(span);
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            ))}
          </div>
        </section>

        {/* ─── 4. SECCIÓN DE FUNCIONES PRINCIPALES (BENTO GRID) ─────────────── */}
        <section id="funciones" className="py-24 bg-[#030917] relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            
            <div className="text-center space-y-4 max-w-3xl mx-auto mb-16">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-[#5B78FF] text-xs font-bold uppercase tracking-wide">
                <Sparkles className="w-3.5 h-3.5" /> Todo en una sola plataforma
              </span>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-tight">
                Las herramientas que potencian tu despacho de seguros
              </h2>
              <p className="text-base text-white/60 leading-relaxed">
                Diseñado por y para asesores de seguros. Cada módulo resuelve de raíz la carga administrativa, la comunicación con clientes y el control de cartera.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              
              {/* Card 1: Control de Trámites */}
              <div className="rounded-3xl p-8 bg-white/[0.03] border border-white/[0.07] hover:border-blue-500/40 hover:bg-white/[0.05] transition-all duration-300 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#1C37E0] to-[#3B58F0] flex items-center justify-center text-white shadow-lg shadow-blue-600/30">
                  <FileText className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-white">Control de Trámites en Vivo</h3>
                <p className="text-sm text-white/60 leading-relaxed">
                  Monitorea cotizaciones, emisiones, cancelaciones, siniestros y cobranza con folios únicos, asignación de responsables y estados transparentes.
                </p>
              </div>

              {/* Card 2: Notificaciones WhatsApp & Correo */}
              <div className="rounded-3xl p-8 bg-white/[0.03] border border-white/[0.07] hover:border-emerald-500/40 hover:bg-white/[0.05] transition-all duration-300 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-emerald-600/30">
                  <MessageCircle className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-white">Notificaciones por WhatsApp y Correo</h3>
                <p className="text-sm text-white/60 leading-relaxed">
                  Envía alertas inmediatas a tus clientes cuando su póliza es emitida, cuando vence un recibo o cuando hay un avance en su trámite.
                </p>
              </div>

              {/* Card 3: Mi CRM */}
              <div className="rounded-3xl p-8 bg-white/[0.03] border border-white/[0.07] hover:border-purple-500/40 hover:bg-white/[0.05] transition-all duration-300 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-purple-600/30">
                  <Users className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-white">Mi CRM de Clientes y Prospectos</h3>
                <p className="text-sm text-white/60 leading-relaxed">
                  Gestión integral de contactos, expedientes digitales, pólizas vinculadas, historial de cotizaciones y registro de llamadas o citas.
                </p>
              </div>

              {/* Card 4: Central de Producción (CP) */}
              <div className="rounded-3xl p-8 bg-white/[0.03] border border-white/[0.07] hover:border-cyan-500/40 hover:bg-white/[0.05] transition-all duration-300 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-600/30">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-white">Central de Producción (CP)</h3>
                <p className="text-sm text-white/60 leading-relaxed">
                  Conciliación de estados de cuenta de aseguradoras, cálculo automático de comisiones, bonos y dispersión precisa con base de datos SICAS.
                </p>
              </div>

              {/* Card 5: Mi Página Web Personalizable */}
              <div className="rounded-3xl p-8 bg-white/[0.03] border border-white/[0.07] hover:border-rose-500/40 hover:bg-white/[0.05] transition-all duration-300 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-600 to-amber-600 flex items-center justify-center text-white shadow-lg shadow-rose-600/30">
                  <Globe className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-white">Mi Página Web Conectada al CRM</h3>
                <p className="text-sm text-white/60 leading-relaxed">
                  Tu sitio profesional con cotizadores de autos, GMM, vida y agenda online. Cada prospecto que cotiza entra directo a tu CRM.
                </p>
              </div>

              {/* Card 6: Comunicados y Circulares */}
              <div className="rounded-3xl p-8 bg-white/[0.03] border border-white/[0.07] hover:border-amber-500/40 hover:bg-white/[0.05] transition-all duration-300 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-600 to-orange-600 flex items-center justify-center text-white shadow-lg shadow-amber-600/30">
                  <Megaphone className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-white">Comunicados y Campañas Grupo JIRO</h3>
                <p className="text-sm text-white/60 leading-relaxed">
                  Accede a circulares oficiales, incentivos comerciales, políticas de suscripción y avisos prioritarios de todas las compañías.
                </p>
              </div>

            </div>

          </div>
        </section>

        {/* ─── 5. INTERACTIVO: MI PÁGINA WEB (EJEMPLO AGENTE DEMO) ──────────── */}
        <section id="mi-web" className="py-24 bg-[#050F28] border-y border-white/[0.08] relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            
            <div className="text-center space-y-4 max-w-3xl mx-auto mb-16">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wide">
                <Globe className="w-3.5 h-3.5" /> Tu presencia digital profesional
              </span>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-tight">
                Mi Página Web: Captación 24/7 conectada a tu CRM
              </h2>
              <p className="text-base text-white/70 leading-relaxed">
                Cada asesor de Grupo JIRO cuenta con su propia web profesional personalizada bajo su propio enlace. Prueba a continuación cómo se personaliza y funciona con el <strong>Agente Demo</strong>.
              </p>
            </div>

            <div className="grid lg:grid-cols-12 gap-8 items-start">
              
              {/* Columna Izquierda: Controles del Agente */}
              <div className="lg:col-span-5 space-y-6">
                
                <div className="p-6 rounded-3xl bg-white/[0.04] border border-white/[0.10] space-y-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Settings className="w-5 h-5 text-blue-400" />
                      <span>Personalizador de Marca</span>
                    </h3>
                    <span className="text-xs text-white/50">Módulo Mi Marca</span>
                  </div>

                  {/* Selector de Paleta de Color */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-white/80">Color Corporativo de tu Web:</label>
                    <div className="grid grid-cols-4 gap-2">
                      <button
                        onClick={() => setWebColorTheme('blue')}
                        className={`p-3 rounded-xl border flex flex-col items-center gap-1 text-xs font-bold transition-all ${
                          webColorTheme === 'blue' ? 'border-blue-400 bg-blue-500/20 text-white' : 'border-white/10 text-white/60'
                        }`}
                      >
                        <span className="w-5 h-5 rounded-full bg-[#1C37E0]" />
                        <span>Azul JIRO</span>
                      </button>

                      <button
                        onClick={() => setWebColorTheme('emerald')}
                        className={`p-3 rounded-xl border flex flex-col items-center gap-1 text-xs font-bold transition-all ${
                          webColorTheme === 'emerald' ? 'border-emerald-400 bg-emerald-500/20 text-white' : 'border-white/10 text-white/60'
                        }`}
                      >
                        <span className="w-5 h-5 rounded-full bg-[#059669]" />
                        <span>Esmeralda</span>
                      </button>

                      <button
                        onClick={() => setWebColorTheme('navy')}
                        className={`p-3 rounded-xl border flex flex-col items-center gap-1 text-xs font-bold transition-all ${
                          webColorTheme === 'navy' ? 'border-sky-400 bg-slate-700/50 text-white' : 'border-white/10 text-white/60'
                        }`}
                      >
                        <span className="w-5 h-5 rounded-full bg-[#0F172A] border border-white/40" />
                        <span>Navy</span>
                      </button>

                      <button
                        onClick={() => setWebColorTheme('wine')}
                        className={`p-3 rounded-xl border flex flex-col items-center gap-1 text-xs font-bold transition-all ${
                          webColorTheme === 'wine' ? 'border-rose-400 bg-rose-900/30 text-white' : 'border-white/10 text-white/60'
                        }`}
                      >
                        <span className="w-5 h-5 rounded-full bg-[#991B1B]" />
                        <span>Vino</span>
                      </button>
                    </div>
                  </div>

                  {/* Datos del Asesor Demo */}
                  <div className="space-y-3 pt-3 border-t border-white/10 text-xs">
                    <p className="font-bold text-white/90">Datos del Perfil (Agente Demo):</p>
                    <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/05 space-y-1.5">
                      <p className="text-white font-bold">Lic. Carlos Méndez · Asesor Patrimonial</p>
                      <p className="text-white/60">Oficina: Grupo JIRO CDMX / Marsella</p>
                      <p className="text-emerald-400 font-mono text-[11px]">agentedeseguros.website/agente-demo</p>
                    </div>
                  </div>

                  {/* Ramos activos */}
                  <div className="space-y-2 pt-2 text-xs">
                    <label className="font-bold text-white/80">Ramos Destacados en Web:</label>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className="p-2 rounded-lg bg-white/[0.04] border border-white/10 flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Auto Individual</span>
                      </div>
                      <div className="p-2 rounded-lg bg-white/[0.04] border border-white/10 flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Gastos Médicos Mayores</span>
                      </div>
                      <div className="p-2 rounded-lg bg-white/[0.04] border border-white/10 flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Vida & Ahorro</span>
                      </div>
                      <div className="p-2 rounded-lg bg-white/[0.04] border border-white/10 flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Hogar Seguro</span>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Badge de integración CRM */}
                <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-200 flex items-start gap-3">
                  <Zap className="w-5 h-5 text-[#00E5FF] flex-shrink-0 mt-0.5" />
                  <p>
                    <strong>Conexión Total:</strong> Cada persona que llena una cotización o agenda una llamada en esta página web aparece automáticamente en tu pestaña <strong>Mi CRM</strong> con notificación por correo y WhatsApp.
                  </p>
                </div>

              </div>

              {/* Columna Derecha: Vista Previa en Vivo de la Web del Asesor */}
              <div className="lg:col-span-7">
                <div className="rounded-3xl border border-white/20 bg-white shadow-2xl overflow-hidden text-slate-900">
                  
                  {/* Browser Header Bar */}
                  <div className="bg-slate-100 px-4 py-3 border-b border-slate-200 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-rose-400" />
                      <span className="w-3 h-3 rounded-full bg-amber-400" />
                      <span className="w-3 h-3 rounded-full bg-emerald-400" />
                      <span className="ml-2 font-mono text-slate-600 bg-white px-3 py-1 rounded-md border border-slate-200 truncate">
                        https://agentedeseguros.website/agente-demo
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                      En Línea
                    </span>
                  </div>

                  {/* Cuerpo de la Página Web del Asesor Demo */}
                  <div className="p-6 sm:p-8 space-y-6 max-h-[580px] overflow-y-auto">
                    
                    {/* Header de la Web del Asesor */}
                    <div className="flex flex-col sm:flex-row items-center gap-5 pb-6 border-b border-slate-100">
                      <div
                        className="w-20 h-20 rounded-2xl flex items-center justify-center text-white text-2xl font-black shadow-md flex-shrink-0"
                        style={{ background: getThemeColor() }}
                      >
                        CM
                      </div>
                      <div className="text-center sm:text-left space-y-1">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                          <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                          <span>Asesor Certificado · Grupo JIRO</span>
                        </div>
                        <h4 className="text-xl font-black text-slate-900">Lic. Carlos Méndez</h4>
                        <p className="text-xs text-slate-500">
                          Especialista en Protección Patrimonial, Seguros de Autos y Gastos Médicos
                        </p>
                      </div>
                    </div>

                    {/* Selector de Cotizador en Vivo */}
                    <div className="space-y-3">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Selecciona el seguro que deseas cotizar:
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                          { id: 'auto', label: 'Seguro de Auto', icon: Car },
                          { id: 'gmm', label: 'Gastos Médicos', icon: HeartPulse },
                          { id: 'vida', label: 'Vida & Ahorro', icon: Shield },
                          { id: 'hogar', label: 'Hogar / Casa', icon: Building2 }
                        ].map((item) => {
                          const IconC = item.icon;
                          const isSel = demoQuoteType === item.id;
                          return (
                            <button
                              key={item.id}
                              onClick={() => { setDemoQuoteType(item.id as any); setLeadSent(false); }}
                              className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                                isSel
                                  ? 'text-white shadow-md'
                                  : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                              }`}
                              style={{
                                background: isSel ? getThemeColor() : undefined,
                                borderColor: isSel ? getThemeColor() : undefined
                              }}
                            >
                              <IconC className="w-4 h-4" />
                              <span>{item.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Formulario de Cotización Integrado */}
                    <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-slate-800">
                          Cotización Express · {demoQuoteType.toUpperCase()}
                        </p>
                        <span className="text-[11px] text-slate-500">Entrada directa a CRM</span>
                      </div>

                      {leadSent ? (
                        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-center space-y-2 animate-in fade-in">
                          <CheckCircle className="w-8 h-8 text-emerald-600 mx-auto" />
                          <p className="text-xs font-bold text-emerald-900">¡Cotización enviada al Asesor!</p>
                          <p className="text-[11px] text-emerald-700">
                            Se ha registrado en el CRM de Carlos Méndez y se disparó una alerta a su WhatsApp.
                          </p>
                          <button
                            onClick={() => setLeadSent(false)}
                            className="text-xs text-blue-600 font-bold hover:underline pt-1 cursor-pointer"
                          >
                            Probar otra cotización
                          </button>
                        </div>
                      ) : (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            setLeadSent(true);
                          }}
                          className="space-y-3"
                        >
                          <div className="grid sm:grid-cols-2 gap-3">
                            <input
                              type="text"
                              required
                              placeholder="Nombre completo *"
                              defaultValue="Ana Paula Gutiérrez"
                              className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <input
                              type="tel"
                              required
                              placeholder="WhatsApp / Celular *"
                              defaultValue="55 4920 1823"
                              className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>

                          <div className="grid sm:grid-cols-2 gap-3">
                            <input
                              type="email"
                              required
                              placeholder="Correo electrónico *"
                              defaultValue="anapaula@empresa.com"
                              className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <input
                              type="text"
                              placeholder="Código Postal / Ciudad"
                              defaultValue="06600, CDMX"
                              className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>

                          <button
                            type="submit"
                            className="w-full py-3 rounded-xl text-white font-bold text-xs shadow-md transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2"
                            style={{ background: getThemeColor() }}
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Solicitar Cotización Inmediata</span>
                          </button>
                        </form>
                      )}
                    </div>

                    {/* Footer de la Web Asesor Demo */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                      <span>Respaldo Oficial Grupo JIRO y Asociados</span>
                      <span>Protegido con SSL 256 bits</span>
                    </div>

                  </div>

                </div>
              </div>

            </div>

          </div>
        </section>

        {/* ─── 6. SECCIÓN: CENTRAL DE PRODUCCIÓN (CP) ───────────────────────── */}
        <section id="central-produccion" className="py-24 bg-[#030917] relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            
            <div className="grid lg:grid-cols-12 gap-12 items-center">
              
              <div className="lg:col-span-6 space-y-6">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-bold uppercase tracking-wide">
                  <BarChart3 className="w-3.5 h-3.5" /> Conciliación sin errores
                </span>
                
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-tight">
                  Central de Producción (CP): Conciliación de comisiones con SICAS
                </h2>

                <p className="text-base text-white/70 leading-relaxed">
                  Elimina los errores de cálculo y las hojas de cálculo manuales. La Central de Producción de MOVI procesa los layouts de todas las aseguradoras, coteja recibos pagados y genera el desglose de liquidación para cada agente con total transparencia.
                </p>

                <div className="space-y-3 pt-2">
                  <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-white">Importación de Layouts Oficiales</p>
                      <p className="text-xs text-white/60">Lectura automática de estados de cuenta de GNP, Quálitas, Chubb, Zurich, MAPFRE y más.</p>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-white">Cálculo de Bonos y Retenciones Fiscales</p>
                      <p className="text-xs text-white/60">Desglose neto con impuestos, comisiones directas y bonos comerciales aplicados al instante.</p>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-white">Auditoría en Línea para el Asesor</p>
                      <p className="text-xs text-white/60">Cada agente consulta en tiempo real sus recibos cobrados y fechas estimadas de dispersión.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Mockup CP */}
              <div className="lg:col-span-6">
                <div className="rounded-3xl p-8 bg-gradient-to-br from-[#08183E] via-[#05112E] to-[#030917] border border-blue-500/30 shadow-2xl space-y-6">
                  
                  <div className="flex items-center justify-between pb-4 border-b border-white/10">
                    <div>
                      <p className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Tablero de Liquidaciones</p>
                      <h4 className="text-lg font-black text-white">Central de Producción JIRO</h4>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold">
                      SICAS Conectado
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-left">
                    <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/05 space-y-1">
                      <p className="text-[11px] text-white/50">Total Comisiones Procesadas</p>
                      <p className="text-2xl font-black text-white">$1,480,920</p>
                      <p className="text-[10px] text-emerald-400">100% Conciliado</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/05 space-y-1">
                      <p className="text-[11px] text-white/50">Recibos Auditados</p>
                      <p className="text-2xl font-black text-[#00E5FF]">842 Pólizas</p>
                      <p className="text-[10px] text-white/50">Sin discrepancias</p>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/05 space-y-2 text-xs text-left">
                    <p className="font-bold text-white/80">Desglose por Aseguradora:</p>
                    <div className="space-y-1.5 text-[11.5px]">
                      <div className="flex justify-between p-2 rounded-lg bg-black/20">
                        <span>GNP Seguros</span>
                        <span className="font-mono text-emerald-400 font-bold">$680,240.00 MXN</span>
                      </div>
                      <div className="flex justify-between p-2 rounded-lg bg-black/20">
                        <span>Quálitas</span>
                        <span className="font-mono text-emerald-400 font-bold">$490,120.00 MXN</span>
                      </div>
                      <div className="flex justify-between p-2 rounded-lg bg-black/20">
                        <span>Chubb</span>
                        <span className="font-mono text-emerald-400 font-bold">$310,560.00 MXN</span>
                      </div>
                    </div>
                  </div>

                </div>
              </div>

            </div>

          </div>
        </section>

        {/* ─── 7. SECCIÓN: SEGUROS EDUCATION ───────────────────────────────── */}
        <section id="education" className="py-24 bg-[#050F28] border-y border-white/[0.08] relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            
            <div className="rounded-3xl p-8 sm:p-14 bg-gradient-to-br from-[#0B2468] via-[#08183E] to-[#040C1F] border border-blue-500/30 shadow-2xl relative overflow-hidden">
              
              <div className="grid lg:grid-cols-2 gap-10 items-center relative z-10">
                <div className="space-y-6">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 text-amber-300 text-xs font-bold uppercase tracking-wide border border-amber-500/20">
                    <GraduationCap className="w-3.5 h-3.5 text-amber-400" /> Formación y Certificación Continua
                  </span>
                  
                  <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-tight">
                    Seguros Education: El Campus Virtual de Grupo JIRO
                  </h2>

                  <p className="text-base text-white/75 leading-relaxed">
                    Capacitación de alto nivel para consolidar tu carrera como asesor profesional. Cursos on-demand, simuladores de examen para la Cédula A de la CNSF, certificaciones con aseguradoras (Universidad Quálitas) y convenios universitarios con UTEL.
                  </p>

                  <div className="grid sm:grid-cols-2 gap-3 pt-2 text-xs">
                    <div className="p-3.5 rounded-xl bg-white/[0.06] border border-white/10 space-y-1">
                      <p className="font-bold text-white">Preparación Cédula A</p>
                      <p className="text-white/60">Simulador de reactivos y módulos normativos de la CNSF.</p>
                    </div>
                    <div className="p-3.5 rounded-xl bg-white/[0.06] border border-white/10 space-y-1">
                      <p className="font-bold text-white">Convenios Universitarios</p>
                      <p className="text-white/60">Licenciaturas y diplomados ejecutivos con UTEL.</p>
                    </div>
                  </div>

                  <div className="pt-2">
                    <a
                      href="https://seguros.education"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-sm transition-all shadow-lg active:scale-95"
                    >
                      <span>Ir a Seguros Education</span>
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>

                <div className="space-y-3 bg-white/[0.04] p-6 rounded-2xl border border-white/10 backdrop-blur-md">
                  <p className="text-xs font-bold text-white/80 uppercase tracking-wider">Cursos Más Populares:</p>
                  
                  <div className="space-y-2.5 text-xs text-left">
                    <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-between">
                      <div>
                        <p className="font-bold text-white">Estrategias de Venta en Gastos Médicos Mayores</p>
                        <p className="text-[11px] text-white/50">4 Módulos · Certificado Digital</p>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-bold text-[10px]">On Demand</span>
                    </div>

                    <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-between">
                      <div>
                        <p className="font-bold text-white">Suscripción y Cotización de Flotillas Pesadas</p>
                        <p className="text-[11px] text-white/50">Impartido por Directores de Aseguradoras</p>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[10px]">Avanzado</span>
                    </div>

                    <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-between">
                      <div>
                        <p className="font-bold text-white">Cumplimiento Art. 492 & Prevención de Lavado</p>
                        <p className="text-[11px] text-white/50">Obligatorio CNSF · Validez Oficial</p>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 font-bold text-[10px]">Normativo</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ─── 8. CALCULADORA DE PRODUCTIVIDAD Y ROI ───────────────────────── */}
        <section id="roi" className="py-24 bg-[#030917] relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            
            <div className="grid lg:grid-cols-12 gap-12 items-center">
              
              <div className="lg:col-span-6 space-y-6">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wide">
                  <TrendingUp className="w-3.5 h-3.5" /> Retorno de Inversión
                </span>
                
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-tight">
                  Calcula el impacto operativo en tu promotoría o despacho
                </h2>

                <p className="text-base text-white/70 leading-relaxed">
                  Al automatizar el seguimiento de trámites, la emisión de notificaciones de cobranza y la conciliación de comisiones, liberas a tu equipo para cerrar más negocios.
                </p>

                <div className="space-y-6 pt-2 bg-white/[0.03] p-6 rounded-2xl border border-white/[0.08]">
                  
                  {/* Slider 1: Número de Asesores */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-bold text-white">Número de Agentes / Asesores:</span>
                      <span className="font-black text-[#00E5FF] text-base">{agentsCount} asesores</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={150}
                      value={agentsCount}
                      onChange={(e) => setAgentsCount(Number(e.target.value))}
                      className="w-full accent-[#1C37E0] cursor-pointer"
                    />
                  </div>

                  {/* Slider 2: Pólizas Mensuales */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-bold text-white">Pólizas Nuevas y Renovaciones / Mes:</span>
                      <span className="font-black text-[#00E5FF] text-base">{monthlyPolicies} pólizas</span>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={600}
                      step={10}
                      value={monthlyPolicies}
                      onChange={(e) => setMonthlyPolicies(Number(e.target.value))}
                      className="w-full accent-[#1C37E0] cursor-pointer"
                    />
                  </div>

                </div>
              </div>

              {/* Tarjeta de Resultados ROI */}
              <div className="lg:col-span-6">
                <div className="rounded-3xl p-8 sm:p-10 bg-gradient-to-br from-[#0A2260] via-[#0D2E80] to-[#06142F] border border-blue-500/30 shadow-2xl space-y-8">
                  
                  <div className="space-y-2">
                    <p className="text-xs uppercase font-extrabold tracking-wider text-blue-200">
                      Impacto Estimado con MOVI Digital
                    </p>
                    <h3 className="text-2xl font-black text-white">
                      Ahorro en tiempo y costos administrativos
                    </h3>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="p-5 rounded-2xl bg-white/[0.08] border border-white/10 space-y-1">
                      <p className="text-xs text-white/70 font-medium">Horas operativas ahorradas / mes</p>
                      <p className="text-3xl sm:text-4xl font-black text-[#00E5FF]">{hoursSavedPerMonth} hrs</p>
                      <p className="text-[11px] text-white/50">Equivale a {Math.round(hoursSavedPerMonth / 8)} días de trabajo</p>
                    </div>

                    <div className="p-5 rounded-2xl bg-white/[0.08] border border-white/10 space-y-1">
                      <p className="text-xs text-white/70 font-medium">Ahorro operativo mensual estimado</p>
                      <p className="text-3xl sm:text-4xl font-black text-emerald-400">${moneySavedEstimate}</p>
                      <p className="text-[11px] text-white/50">MXN en optimización de procesos</p>
                    </div>
                  </div>

                  <div className="pt-2">
                    <a
                      href="https://app.movi.digital/login"
                      className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-bold text-base text-white shadow-xl shadow-blue-600/40 hover:shadow-blue-600/60 transition-all active:scale-95"
                      style={{ background: 'linear-gradient(135deg, #1C37E0 0%, #3B58F0 100%)' }}
                    >
                      <Lock className="w-5 h-5" />
                      <span>Ingresar a MOVI Digital</span>
                      <ArrowRight className="w-5 h-5" />
                    </a>
                  </div>

                </div>
              </div>

            </div>

          </div>
        </section>

        {/* ─── 9. PREGUNTAS FRECUENTES (FAQ) ───────────────────────────────── */}
        <section id="faq" className="py-24 bg-[#050F28]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            
            <div className="text-center space-y-4 mb-16">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-[#5B78FF] text-xs font-bold uppercase tracking-wide">
                <HelpCircle className="w-3.5 h-3.5" /> Resolvemos tus dudas
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-white">
                Preguntas Frecuentes sobre MOVI Digital
              </h2>
            </div>

            <div className="space-y-4">
              {[
                {
                  q: '¿Qué es MOVI Digital y cuál es su relación con Grupo JIRO y Asociados?',
                  a: 'MOVI Digital es la plataforma tecnológica propietaria desarrollada para la red nacional de promotorías, agentes y ejecutivos de Grupo JIRO y Asociados. Centraliza el control de trámites, cobranza, comisiones y herramientas de venta para asesores.'
                },
                {
                  q: '¿Cómo funciona la asignación de prospectos desde Mi Página Web?',
                  a: 'Cada asesor cuenta con su slug personalizado (ej. agentedeseguros.website/tu-nombre). Cuando un prospecto cotiza auto, gastos médicos o vida en tu web, el lead entra directamente a tu CRM con sus datos completos y recibes una alerta inmediata en tu WhatsApp.'
                },
                {
                  q: '¿Cómo se concilian las comisiones con la Central de Producción?',
                  a: 'El sistema importa los layouts de estados de cuenta de aseguradoras como GNP, Quálitas, Chubb, etc., y los cruza automáticamente con la base de datos de SICAS REST para generar los reportes y dispersiones quincenales exactas.'
                },
                {
                  q: '¿Mis clientes pueden consultar sus pólizas?',
                  a: 'Sí. A través de Seguwallet (seguwallet.mx), cada cliente de Grupo JIRO puede acceder a su cartera digital con código OTP sin contraseñas, descargar carátulas y reportar siniestros 24/7.'
                }
              ].map((faq, index) => {
                const isOpen = openFaq === index;
                return (
                  <div
                    key={index}
                    className="rounded-2xl bg-white/[0.03] border border-white/[0.07] overflow-hidden transition-all duration-200"
                  >
                    <button
                      onClick={() => setOpenFaq(isOpen ? null : index)}
                      className="w-full flex items-center justify-between p-6 text-left cursor-pointer hover:bg-white/[0.02]"
                    >
                      <span className="text-base sm:text-lg font-bold text-white pr-4">
                        {faq.q}
                      </span>
                      <ChevronDown
                        className={`w-5 h-5 text-[#5B78FF] flex-shrink-0 transition-transform duration-200 ${
                          isOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {isOpen && (
                      <div className="px-6 pb-6 text-sm text-white/70 leading-relaxed border-t border-white/[0.05] pt-4 animate-in fade-in duration-150">
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

          </div>
        </section>

        {/* ─── 10. CTA FINAL & ACCESO ──────────────────────────────────────── */}
        <section className="py-20 bg-gradient-to-b from-[#050F28] to-[#02050E] relative">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
            
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-[#1C37E0] to-[#00E5FF] flex items-center justify-center text-white mx-auto shadow-2xl shadow-blue-500/30">
              <ShieldCheck className="w-8 h-8" />
            </div>

            <div className="space-y-4 max-w-2xl mx-auto">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-tight">
                Impulsa tu carrera con la tecnología de Grupo JIRO
              </h2>
              <p className="text-base sm:text-lg text-white/70">
                Ingresa hoy a tu portal MOVI Digital y gestiona tus trámites, clientes y comisiones desde un solo lugar.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href="https://app.movi.digital/login"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl font-bold text-base text-white shadow-xl shadow-blue-600/40 hover:shadow-blue-600/60 transition-all active:scale-95"
                style={{ background: 'linear-gradient(135deg, #1C37E0 0%, #3B58F0 100%)' }}
              >
                <Lock className="w-5 h-5" />
                <span>Ingresar a MOVI App</span>
                <ArrowRight className="w-5 h-5" />
              </a>
            </div>

          </div>
        </section>

        {/* ─── 11. FOOTER INSTITUCIONAL ────────────────────────────────────── */}
        <footer className="border-t border-white/[0.08] bg-[#02050E] py-14">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
            
            <div className="grid md:grid-cols-4 gap-8">
              
              <div className="md:col-span-2 space-y-4">
                <div className="flex items-center gap-3">
                  <img src={LOGO_MOVI} alt="MOVI Digital" className="h-9 w-auto object-contain" />
                </div>
                <p className="text-sm text-white/50 leading-relaxed max-w-sm">
                  MOVI Digital es la plataforma de gestión operativa y comercial de <strong>Grupo JIRO y Asociados</strong> para asesores y promotorías de seguros en México.
                </p>
                <div className="flex items-center gap-4 pt-2 text-xs text-white/40">
                  <span>Protegido con encriptación SSL de 256 bits · Integración SICAS REST</span>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-white">Funciones Principales</p>
                <ul className="space-y-2 text-sm text-white/60">
                  <li><button onClick={() => scrollTo('funciones')} className="hover:text-white transition-colors cursor-pointer">Control de Trámites</button></li>
                  <li><button onClick={() => scrollTo('mi-web')} className="hover:text-white transition-colors cursor-pointer">Mi Página Web (Agente Demo)</button></li>
                  <li><button onClick={() => scrollTo('central-produccion')} className="hover:text-white transition-colors cursor-pointer">Central de Producción</button></li>
                  <li><button onClick={() => scrollTo('education')} className="hover:text-white transition-colors cursor-pointer">Seguros Education</button></li>
                  <li><button onClick={() => scrollTo('roi')} className="hover:text-white transition-colors cursor-pointer">Calculadora ROI</button></li>
                </ul>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-white">Ecosistema JIRO</p>
                <ul className="space-y-2 text-sm text-white/60">
                  <li><a href="https://app.movi.digital" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">MOVI Core App</a></li>
                  <li><a href="https://seguwallet.mx" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Seguwallet</a></li>
                  <li><a href="https://seguros.education" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Seguros Education</a></li>
                  <li><a href="https://agentedeseguros.ai" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Chava AI</a></li>
                  <li><a href="https://grupojiro.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Grupo JIRO y Asociados</a></li>
                </ul>
              </div>

            </div>

            <div className="pt-8 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/40">
              <p>© {new Date().getFullYear()} MOVI Digital · Grupo JIRO y Asociados. Todos los derechos reservados.</p>
              <div className="flex items-center gap-4">
                <a href="/login" className="hover:text-white/70 transition-colors">Acceso Asesores</a>
                <span>·</span>
                <a href="https://grupojiro.com" target="_blank" rel="noopener noreferrer" className="hover:text-white/70 transition-colors">Aviso de Privacidad</a>
              </div>
            </div>

          </div>
        </footer>

      </div>
    </>
  );
}
