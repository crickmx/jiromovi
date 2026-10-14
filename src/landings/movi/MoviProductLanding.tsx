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
  Globe
} from 'lucide-react';

// ─── ASSETS & CONSTANTES LOCALES ──────────────────────────────────────────────
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

const ECOSYSTEM_PLATFORMS = [
  {
    id: 'core',
    title: 'MOVI Core App',
    category: 'SaaS Operativo & Mesa de Control',
    description: 'Conciliación automatizada de comisiones, mesa de trámites, pipeline comercial y auditoría de cartera con sincronización nativa SICAS REST.',
    url: 'https://app.movi.digital',
    badge: 'Plataforma Central',
    badgeColor: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    icon: Database,
    color: '#1C37E0'
  },
  {
    id: 'seguwallet',
    title: 'Seguwallet',
    category: 'Cartera Digital de Clientes',
    description: 'Wallet móvil inteligente para tus asegurados. Consulta de pólizas, descarga de recibos y reporte de siniestros sin contraseñas (OTP vía WhatsApp).',
    url: 'https://seguwallet.mx',
    badge: 'App Clientes',
    badgeColor: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    icon: Smartphone,
    color: '#00E5FF'
  },
  {
    id: 'chava',
    title: 'Chava IA Copilot',
    category: 'Inteligencia Artificial Especializada',
    description: 'El primer copiloto de IA entrenado en condiciones generales, deducibles, coaseguros y normativas de seguros en México disponible 24/7.',
    url: 'https://agentedeseguros.ai',
    badge: 'AI Engine',
    badgeColor: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    icon: Cpu,
    color: '#8B5CF6'
  },
  {
    id: 'education',
    title: 'Seguros Education',
    category: 'Academia & Certificación de Asesores',
    description: 'Campus virtual con cursos on-demand, preparación para Cédula A de la CNSF, Universidad Quálitas y diplomados universitarios con UTEL.',
    url: 'https://seguros.education',
    badge: 'Formación Continua',
    badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    icon: GraduationCap,
    color: '#F59E0B'
  },
  {
    id: 'express',
    title: 'Seguros Express',
    category: 'Cotizador Público & Captación de Leads',
    description: 'Motor ultrarrápido de cotización de autos con asignación inteligente y geolocalizada de prospectos hacia los asesores de la red.',
    url: 'https://seguros.express',
    badge: 'Leads & Cotización',
    badgeColor: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
    icon: Zap,
    color: '#E11D48'
  },
  {
    id: 'website',
    title: 'Tu Web de Asesor',
    category: 'Marca Personal & Portal Profesional',
    description: 'Página web personalizada para cada agente con agenda interactiva, cotizadores integrados, links de WhatsApp y presentación profesional.',
    url: 'https://agentedeseguros.website',
    badge: 'Marketing Digital',
    badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    icon: Globe,
    color: '#10B981'
  },
  {
    id: 'tienda',
    title: 'MOVI Tienda',
    category: 'Merchandising & Recursos Corporativos',
    description: 'Catálogo de recursos oficiales, uniformes, papelería personalizada y material de ventas para consolidar tu presencia de marca.',
    url: 'https://tienda.movi.digital',
    badge: 'Brand Assets',
    badgeColor: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
    icon: Store,
    color: '#6366F1'
  },
  {
    id: 'landings',
    title: 'Hermes Landing Studio',
    category: 'Generador de Landings con IA',
    description: 'Suite de diseño y publicación instantánea de páginas de producto de alta conversión para campañas específicas de seguros y salud.',
    url: 'https://landings.movi.digital',
    badge: 'No-Code / Low-Code',
    badgeColor: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
    icon: Palette,
    color: '#EC4899'
  }
];

const FAQS = [
  {
    q: '¿Qué es MOVI Digital y a quién está dirigido?',
    a: 'MOVI Digital es el ecosistema Insurtech y SaaS integral diseñado específicamente para promotorías, agentes y asesores de seguros en México. Centraliza la operación administrativa, automatiza la conciliación de comisiones con aseguradoras, sincroniza en tiempo real con SICAS y entrega herramientas digitales de venta, capacitación y atención al cliente.'
  },
  {
    q: '¿Cómo se integra MOVI con SICAS y las aseguradoras?',
    a: 'MOVI cuenta con conectividad nativa vía APIs REST y microservicios sincronizados con el ERP SICAS. Esto permite consultar pólizas, vigencias, recibos y estatus de cobranza en tiempo real, además de procesar automáticamente las pólizas emitidas con las más de 12 aseguradoras de la red nacional.'
  },
  {
    q: '¿Cómo funciona la conciliación automática de comisiones?',
    a: 'El motor de MOVI procesa los estados de cuenta y layout de comisiones de las aseguradoras (GNP, Quálitas, Chubb, etc.), calcula comisiones directas, bonos y retenciones fiscales, y genera la dispersión y reportes de liquidación en segundos, reduciendo hasta un 90% el trabajo administrativo manual.'
  },
  {
    q: '¿Mis clientes tienen acceso a una plataforma propia?',
    a: 'Sí. A través de Seguwallet (seguwallet.mx), cada cliente asegurado por tu promotoría o despacho recibe una cartera digital donde puede consultar todas sus pólizas, descargar recibos en PDF, reportar siniestros con marcación directa y resolver dudas 24/7 con Chava IA sin necesidad de recordar contraseñas.'
  },
  {
    q: '¿Qué seguridad y cumplimiento normativo tiene la plataforma?',
    a: 'MOVI opera bajo estrictos protocolos de encriptación bancaria SSL de 256 bits, cumplimiento de la Ley Federal de Protección de Datos Personales (LFPDPPP), validaciones de Expediente 492 y lineamientos de la Comisión Nacional de Seguros y Fianzas (CNSF).'
  }
];

export default function MoviProductLanding() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dashboardTab, setDashboardTab] = useState<'tramites' | 'comisiones' | 'sicas' | 'expediente'>('tramites');
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Calculadora interactiva de ROI
  const [agentsCount, setAgentsCount] = useState<number>(15);
  const [policiesPerMonth, setPoliciesPerMonth] = useState<number>(80);

  const hoursSavedPerMonth = Math.round(agentsCount * 12 + policiesPerMonth * 0.4);
  const moneySavedPerMonth = Math.round(hoursSavedPerMonth * 180).toLocaleString('es-MX');

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

  return (
    <>
      <Helmet>
        <title>MOVI Digital | El Ecosistema Insurtech para Promotorías y Agentes</title>
        <meta
          name="description"
          content="Centraliza tu operación, concilia comisiones en segundos, sincroniza con SICAS y ofrece a tus clientes una experiencia digital con Seguwallet y Chava IA."
        />
        <meta
          name="keywords"
          content="MOVI Digital, Insurtech México, SaaS seguros, promotoría de seguros, SICAS API, conciliación de comisiones, Seguwallet, Chava IA, Grupo JIRO"
        />
        <link rel="canonical" href="https://movi.digital/" />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content="MOVI Digital | El Ecosistema Insurtech para Promotorías y Agentes" />
        <meta
          property="og:description"
          content="El SaaS operativo definitivo para agentes y promotorías. Sincronización SICAS, comisiones automáticas y herramientas 360°."
        />
        <meta property="og:url" content="https://movi.digital/" />
        <meta property="og:image" content="https://movi.digital/movirecurso_2.png" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="MOVI Digital | Ecosistema Insurtech" />
        <meta
          name="twitter:description"
          content="Tecnología de vanguardia para promotorías y asesores de seguros."
        />

        {/* Schema.org */}
        <script type="application/ld+json">
          {JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'MOVI Digital',
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Cloud, Web, Mobile',
            offers: {
              '@type': 'Offer',
              price: '0',
              priceCurrency: 'MXN'
            },
            description:
              'Ecosistema Insurtech y SaaS operativo para agentes y promotorías de seguros con integración SICAS, conciliación de comisiones y CRM.',
            url: 'https://movi.digital',
            publisher: {
              '@type': 'Organization',
              name: 'Grupo JIRO / MOVI Digital'
            }
          })}
        </script>
      </Helmet>

      <div className="min-h-screen bg-[#030917] text-white selection:bg-[#1C37E0] selection:text-white font-sans antialiased">

        {/* ─── 1. NAVBAR SUPERIOR FLOTANTE ─────────────────────────────────── */}
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
              
              {/* Logo MOVI */}
              <a
                href="#inicio"
                onClick={(e) => { e.preventDefault(); scrollTo('inicio'); }}
                className="flex items-center gap-3 group"
              >
                <img
                  src={LOGO_MOVI}
                  alt="MOVI Digital"
                  className="h-9 sm:h-11 w-auto object-contain transition-transform group-hover:scale-105"
                />
              </a>

              {/* Desktop Menu */}
              <nav className="hidden lg:flex items-center gap-7">
                <button
                  onClick={() => scrollTo('plataforma')}
                  className="text-sm font-medium text-white/70 hover:text-white transition-colors cursor-pointer"
                >
                  Plataforma SaaS
                </button>
                <button
                  onClick={() => scrollTo('ecosistema')}
                  className="text-sm font-medium text-white/70 hover:text-white transition-colors cursor-pointer"
                >
                  Ecosistema 8-en-1
                </button>
                <button
                  onClick={() => scrollTo('aseguradoras')}
                  className="text-sm font-medium text-white/70 hover:text-white transition-colors cursor-pointer"
                >
                  Aseguradoras
                </button>
                <button
                  onClick={() => scrollTo('roi')}
                  className="text-sm font-medium text-white/70 hover:text-white transition-colors cursor-pointer"
                >
                  Calculadora ROI
                </button>
                <button
                  onClick={() => scrollTo('faq')}
                  className="text-sm font-medium text-white/70 hover:text-white transition-colors cursor-pointer"
                >
                  Preguntas Frecuentes
                </button>
              </nav>

              {/* Desktop CTAs */}
              <div className="hidden sm:flex items-center gap-3">
                <a
                  href="https://app.movi.digital/login"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white transition-all duration-200 active:scale-95 shadow-lg shadow-blue-600/30 hover:shadow-blue-600/50"
                  style={{
                    background: 'linear-gradient(135deg, #1C37E0 0%, #3B58F0 100%)'
                  }}
                >
                  <Lock className="w-4 h-4" />
                  <span>Ingresar a MOVI App</span>
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
                  { label: 'Plataforma SaaS', id: 'plataforma' },
                  { label: 'Ecosistema 8-en-1', id: 'ecosistema' },
                  { label: 'Aseguradoras', id: 'aseguradoras' },
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

        {/* ─── 2. HERO PRINCIPAL VANGUARDISTA AAA TECH ─────────────────────── */}
        <section
          id="inicio"
          className="relative min-h-[92vh] flex items-center pt-24 pb-16 lg:pt-32 lg:pb-24 overflow-hidden"
          style={{
            background: 'radial-gradient(circle at 50% 15%, #0B2468 0%, #051028 45%, #030917 100%)'
          }}
        >
          {/* Subtle grid pattern & glow orbs */}
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
              opacity: 0.22,
              filter: 'blur(70px)'
            }}
          />
          <div
            className="absolute bottom-10 left-10 w-[500px] h-[500px] rounded-full pointer-events-none"
            style={{
              background: 'radial-gradient(circle, #00E5FF 0%, transparent 70%)',
              opacity: 0.10,
              filter: 'blur(60px)'
            }}
          />

          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
            <div className="grid lg:grid-cols-12 gap-12 lg:gap-8 items-center">
              
              {/* Columna Izquierda: Copy Principal */}
              <div className="lg:col-span-7 space-y-7 text-center lg:text-left">
                
                {/* Badge Superior */}
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.12] backdrop-blur-md">
                  <span className="w-2 h-2 rounded-full bg-[#00E5FF] animate-pulse" />
                  <span className="text-xs font-semibold text-[#00E5FF] tracking-wide uppercase">
                    Ecosistema Insurtech & SaaS Operativo
                  </span>
                </div>

                {/* Titular Principal */}
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-[1.08] tracking-tight">
                  La plataforma definitiva para{' '}
                  <span
                    className="bg-clip-text text-transparent"
                    style={{
                      backgroundImage: 'linear-gradient(135deg, #5B78FF 0%, #00E5FF 100%)'
                    }}
                  >
                    Agentes y Promotorías.
                  </span>
                </h1>

                {/* Subtítulo */}
                <p className="text-base sm:text-lg text-white/70 leading-relaxed max-w-2xl mx-auto lg:mx-0">
                  Centraliza tu mesa de trámites, concilia comisiones con aseguradoras en segundos, sincroniza con SICAS en tiempo real y ofrece a tus clientes una cartera digital de última generación.
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
                    <span>Ingresar a MOVI App</span>
                    <ArrowRight className="w-5 h-5" />
                  </a>

                  <button
                    onClick={() => scrollTo('plataforma')}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-4 rounded-2xl font-semibold text-sm text-white/85 bg-white/[0.05] hover:bg-white/[0.10] border border-white/[0.12] transition-colors cursor-pointer"
                  >
                    <Layers className="w-4 h-4 text-[#00E5FF]" />
                    <span>Conocer Módulos</span>
                  </button>
                </div>

                {/* Badges de Métricas Clave */}
                <div className="pt-6 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-4 text-left">
                  <div className="space-y-1">
                    <p className="text-xl sm:text-2xl font-black text-white">+12</p>
                    <p className="text-xs text-white/50 leading-tight">Aseguradoras integradas</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xl sm:text-2xl font-black text-[#00E5FF]">SICAS</p>
                    <p className="text-xs text-white/50 leading-tight">Sincronización REST nativa</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xl sm:text-2xl font-black text-emerald-400">90%</p>
                    <p className="text-xs text-white/50 leading-tight">Menos tiempo en comisiones</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xl sm:text-2xl font-black text-white">8 en 1</p>
                    <p className="text-xs text-white/50 leading-tight">Plataformas interconectadas</p>
                  </div>
                </div>

              </div>

              {/* Columna Derecha: Mockup Interactivo de la Plataforma SaaS */}
              <div className="lg:col-span-5 flex justify-center lg:justify-end">
                <div className="relative w-full max-w-lg">
                  
                  {/* Glow de fondo */}
                  <div
                    className="absolute -inset-4 rounded-[36px] pointer-events-none"
                    style={{
                      background: 'linear-gradient(135deg, rgba(28,55,224,0.4) 0%, rgba(0,229,255,0.2) 100%)',
                      filter: 'blur(32px)'
                    }}
                  />

                  {/* Window frame glassmorphic */}
                  <div className="relative rounded-3xl border border-white/15 bg-[#081638]/90 shadow-2xl overflow-hidden backdrop-blur-xl">
                    
                    {/* Header de la ventana */}
                    <div className="px-5 py-3.5 bg-white/[0.04] border-b border-white/10 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-rose-500/80" />
                        <span className="w-3 h-3 rounded-full bg-amber-500/80" />
                        <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
                        <span className="ml-2 text-xs font-mono text-white/50">app.movi.digital</span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-emerald-400 font-semibold">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span>SICAS Online</span>
                      </div>
                    </div>

                    {/* Selector de Pestañas del Simulador */}
                    <div className="grid grid-cols-4 gap-1 p-2 bg-black/20 border-b border-white/10 text-xs font-bold text-center">
                      <button
                        onClick={() => setDashboardTab('tramites')}
                        className={`py-2 rounded-xl transition-all ${
                          dashboardTab === 'tramites' ? 'bg-[#1C37E0] text-white shadow-xs' : 'text-white/60 hover:text-white'
                        }`}
                      >
                        Trámites
                      </button>
                      <button
                        onClick={() => setDashboardTab('comisiones')}
                        className={`py-2 rounded-xl transition-all ${
                          dashboardTab === 'comisiones' ? 'bg-[#1C37E0] text-white shadow-xs' : 'text-white/60 hover:text-white'
                        }`}
                      >
                        Comisiones
                      </button>
                      <button
                        onClick={() => setDashboardTab('sicas')}
                        className={`py-2 rounded-xl transition-all ${
                          dashboardTab === 'sicas' ? 'bg-[#1C37E0] text-white shadow-xs' : 'text-white/60 hover:text-white'
                        }`}
                      >
                        SICAS REST
                      </button>
                      <button
                        onClick={() => setDashboardTab('expediente')}
                        className={`py-2 rounded-xl transition-all ${
                          dashboardTab === 'expediente' ? 'bg-[#1C37E0] text-white shadow-xs' : 'text-white/60 hover:text-white'
                        }`}
                      >
                        Exp. 492
                      </button>
                    </div>

                    {/* Contenido Dinámico del Simulador */}
                    <div className="p-5 space-y-4 min-h-[380px] bg-[#050F28]">
                      
                      {dashboardTab === 'tramites' && (
                        <div className="space-y-3 animate-in fade-in duration-200">
                          <div className="flex items-center justify-between text-xs text-white/70">
                            <span className="font-bold text-white">Mesa de Control y Emisión</span>
                            <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-bold">14 Trámites en Proceso</span>
                          </div>

                          <div className="space-y-2">
                            <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-between">
                              <div className="space-y-0.5">
                                <p className="text-xs font-bold text-white">Emisión Auto Cobertura Amplia</p>
                                <p className="text-[11px] text-white/50">Cliente: Transportes del Bajío S.A. · GNP</p>
                              </div>
                              <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">Póliza Emitida</span>
                            </div>

                            <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-between">
                              <div className="space-y-0.5">
                                <p className="text-xs font-bold text-white">Endoso Cambio de Domicilio</p>
                                <p className="text-[11px] text-white/50">Cliente: Dra. Sofía Valdés · Quálitas GMM</p>
                              </div>
                              <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold">En Revisión</span>
                            </div>

                            <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-between">
                              <div className="space-y-0.5">
                                <p className="text-xs font-bold text-white">Renovación Vida Individual</p>
                                <p className="text-[11px] text-white/50">Cliente: Ing. Marco R. · Seguros Monterrey</p>
                              </div>
                              <span className="px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold">Cotizado</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {dashboardTab === 'comisiones' && (
                        <div className="space-y-3 animate-in fade-in duration-200">
                          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-600/30 to-indigo-600/30 border border-blue-500/30 space-y-1">
                            <p className="text-xs text-blue-300 font-semibold">Liquidación Quincenal Procesada</p>
                            <p className="text-2xl font-black text-white">$482,920.00 MXN</p>
                            <p className="text-[11px] text-emerald-400 font-semibold">✓ 100% conciliado con estados de cuenta</p>
                          </div>

                          <div className="space-y-2 text-xs">
                            <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-between">
                              <span>GNP Seguros (Layout Oficial)</span>
                              <span className="font-bold text-emerald-400">$218,400.00 ✓</span>
                            </div>
                            <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-between">
                              <span>Quálitas Compañía de Seguros</span>
                              <span className="font-bold text-emerald-400">$164,220.00 ✓</span>
                            </div>
                            <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-between">
                              <span>Chubb Seguros México</span>
                              <span className="font-bold text-emerald-400">$100,300.00 ✓</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {dashboardTab === 'sicas' && (
                        <div className="space-y-3 animate-in fade-in duration-200">
                          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin" />
                              <span className="text-xs font-bold text-emerald-300">Sincronización Bidireccional Activa</span>
                            </div>
                            <span className="text-[10px] text-emerald-400 font-mono">200 OK</span>
                          </div>

                          <div className="p-3 rounded-xl bg-black/40 border border-white/10 font-mono text-[11px] text-white/80 space-y-1">
                            <p className="text-blue-400">&gt; GET /api/v1/sicas/polizas_vigentes</p>
                            <p className="text-emerald-400">&gt; Status: 200 (1,420 pólizas sincronizadas)</p>
                            <p className="text-purple-400">&gt; POST /api/v1/sicas/conciliacion_recibos</p>
                            <p className="text-white/50">&gt; Timestamp: {new Date().toLocaleTimeString()} (Latencia: 42ms)</p>
                          </div>
                        </div>
                      )}

                      {dashboardTab === 'expediente' && (
                        <div className="space-y-3 animate-in fade-in duration-200">
                          <div className="flex items-center justify-between text-xs text-white/80">
                            <span className="font-bold">Auditoría Regulatoria Art. 492</span>
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold">100% Cumplimiento</span>
                          </div>

                          <div className="space-y-2 text-xs">
                            <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-between">
                              <span className="flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                INE / Identificación Oficial Vigente
                              </span>
                              <span className="text-emerald-400 font-bold">Validado</span>
                            </div>
                            <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-between">
                              <span className="flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                Comprobante de Domicilio &lt; 3 meses
                              </span>
                              <span className="text-emerald-400 font-bold">Validado</span>
                            </div>
                            <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-between">
                              <span className="flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                Cédula de Identificación Fiscal (RFC)
                              </span>
                              <span className="text-emerald-400 font-bold">Validado</span>
                            </div>
                          </div>
                        </div>
                      )}

                    </div>

                    {/* Footer del Simulador */}
                    <div className="p-4 bg-white/[0.03] border-t border-white/10 flex items-center justify-between text-xs">
                      <span className="text-white/50">Módulos nativos para promotorías</span>
                      <a
                        href="https://app.movi.digital/login"
                        className="font-bold text-[#00E5FF] hover:underline flex items-center gap-1"
                      >
                        <span>Abrir en MOVI</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </a>
                    </div>

                  </div>

                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ─── 3. CARRUSEL DE ASEGURADORAS ALIADAS ─────────────────────────── */}
        <section
          id="aseguradoras"
          className="py-12 bg-[#020714] border-y border-white/[0.08] relative overflow-hidden"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6 text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-white/40">
              Conectado y compatible con las principales aseguradoras de México
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

        {/* ─── 4. ECOSISTEMA 8-EN-1 DE PLATAFORMAS ──────────────────────────── */}
        <section id="ecosistema" className="py-24 bg-[#030917] relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            
            <div className="text-center space-y-4 max-w-3xl mx-auto mb-16">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-[#5B78FF] text-xs font-bold uppercase tracking-wide">
                <Sparkles className="w-3.5 h-3.5" /> El Hub Insurtech Completo
              </span>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-tight">
                8 plataformas especializadas en un solo ecosistema
              </h2>
              <p className="text-base text-white/60 leading-relaxed">
                Cada herramienta de MOVI resuelve un eslabón crítico de tu cadena de valor: desde la captación del prospecto y la emisión hasta la postventa y la fidelización del asegurado.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {ECOSYSTEM_PLATFORMS.map((plat) => {
                const IconComp = plat.icon;
                return (
                  <div
                    key={plat.id}
                    className="rounded-3xl p-6 bg-white/[0.03] border border-white/[0.07] hover:border-blue-500/40 hover:bg-white/[0.05] transition-all duration-300 flex flex-col justify-between space-y-4 group"
                  >
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div
                          className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg"
                          style={{ background: plat.color }}
                        >
                          <IconComp className="w-6 h-6" />
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${plat.badgeColor}`}>
                          {plat.badge}
                        </span>
                      </div>

                      <div>
                        <h3 className="text-lg font-bold text-white group-hover:text-[#00E5FF] transition-colors">
                          {plat.title}
                        </h3>
                        <p className="text-xs text-white/40 font-semibold mb-2">
                          {plat.category}
                        </p>
                        <p className="text-xs text-white/60 leading-relaxed">
                          {plat.description}
                        </p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-white/[0.06]">
                      <a
                        href={plat.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-white/80 group-hover:text-white transition-colors"
                      >
                        <span>Abrir plataforma</span>
                        <ExternalLink className="w-3.5 h-3.5 text-[#00E5FF]" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        </section>

        {/* ─── 5. CALCULADORA INTERACTIVA DE ROI & HORAS OPERATIVAS ─────────── */}
        <section id="roi" className="py-24 bg-[#050F28] border-y border-white/[0.08] relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            
            <div className="grid lg:grid-cols-12 gap-12 items-center">
              
              <div className="lg:col-span-6 space-y-6">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wide">
                  <TrendingUp className="w-3.5 h-3.5" /> Eficiencia Comprobada
                </span>
                
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-tight">
                  Calcula el impacto operativo de MOVI en tu promotoría
                </h2>

                <p className="text-base text-white/70 leading-relaxed">
                  Automatizar la conciliación de comisiones, la carga de carátulas y el seguimiento de trámites libera cientos de horas hombre que tu equipo puede dedicar a reclutar agentes y cerrar nuevas ventas.
                </p>

                <div className="space-y-6 pt-2 bg-white/[0.03] p-6 rounded-2xl border border-white/[0.08]">
                  
                  {/* Slider 1: Número de Asesores */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-bold text-white">Número de Agentes / Asesores:</span>
                      <span className="font-black text-[#00E5FF] text-base">{agentsCount} agentes</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={100}
                      value={agentsCount}
                      onChange={(e) => setAgentsCount(Number(e.target.value))}
                      className="w-full accent-[#1C37E0] cursor-pointer"
                    />
                  </div>

                  {/* Slider 2: Pólizas Mensuales */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-bold text-white">Pólizas Nuevas y Renovaciones / Mes:</span>
                      <span className="font-black text-[#00E5FF] text-base">{policiesPerMonth} pólizas</span>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={500}
                      step={10}
                      value={policiesPerMonth}
                      onChange={(e) => setPoliciesPerMonth(Number(e.target.value))}
                      className="w-full accent-[#1C37E0] cursor-pointer"
                    />
                  </div>

                </div>
              </div>

              {/* Tarjeta de Resultados */}
              <div className="lg:col-span-6">
                <div className="rounded-3xl p-8 sm:p-10 bg-gradient-to-br from-[#0A2260] via-[#0D2E80] to-[#06142F] border border-blue-500/30 shadow-2xl space-y-8">
                  
                  <div className="space-y-2">
                    <p className="text-xs uppercase font-extrabold tracking-wider text-blue-200">
                      Ahorro Estimado con MOVI Digital
                    </p>
                    <h3 className="text-2xl font-black text-white">
                      Mayor rentabilidad y control absoluto
                    </h3>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="p-5 rounded-2xl bg-white/[0.08] border border-white/10 space-y-1">
                      <p className="text-xs text-white/70 font-medium">Horas operativas ahorradas / mes</p>
                      <p className="text-3xl sm:text-4xl font-black text-[#00E5FF]">{hoursSavedPerMonth} hrs</p>
                      <p className="text-[11px] text-white/50">Equivalente a {Math.round(hoursSavedPerMonth / 8)} días laborales</p>
                    </div>

                    <div className="p-5 rounded-2xl bg-white/[0.08] border border-white/10 space-y-1">
                      <p className="text-xs text-white/70 font-medium">Ahorro administrativo estimado</p>
                      <p className="text-3xl sm:text-4xl font-black text-emerald-400">${moneySavedPerMonth}</p>
                      <p className="text-[11px] text-white/50">MXN mensuales en carga operativa</p>
                    </div>
                  </div>

                  <div className="pt-2">
                    <a
                      href="https://app.movi.digital/login"
                      className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-bold text-base text-white shadow-xl shadow-blue-600/40 hover:shadow-blue-600/60 transition-all active:scale-95"
                      style={{ background: 'linear-gradient(135deg, #1C37E0 0%, #3B58F0 100%)' }}
                    >
                      <Lock className="w-5 h-5" />
                      <span>Comenzar a usar MOVI</span>
                      <ArrowRight className="w-5 h-5" />
                    </a>
                  </div>

                </div>
              </div>

            </div>

          </div>
        </section>

        {/* ─── 6. PREGUNTAS FRECUENTES (FAQ ACCORDION) ────────────────────── */}
        <section id="faq" className="py-24 bg-[#030917]">
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
              {FAQS.map((faq, index) => {
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

        {/* ─── 7. CTA FINAL ───────────────────────────────────────────────── */}
        <section className="py-20 bg-gradient-to-b from-[#030917] to-[#050F28] relative">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
            
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-[#1C37E0] to-[#00E5FF] flex items-center justify-center text-white mx-auto shadow-2xl shadow-blue-500/30">
              <ShieldCheck className="w-8 h-8" />
            </div>

            <div className="space-y-4 max-w-2xl mx-auto">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-tight">
                Transforma tu promotoría con tecnología Insurtech
              </h2>
              <p className="text-base sm:text-lg text-white/70">
                Únete a la red nacional de promotorías y agentes que operan con MOVI Digital.
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

        {/* ─── 8. FOOTER INSTITUCIONAL ─────────────────────────────────────── */}
        <footer className="border-t border-white/[0.08] bg-[#02050E] py-14">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
            
            <div className="grid md:grid-cols-4 gap-8">
              
              <div className="md:col-span-2 space-y-4">
                <img src={LOGO_MOVI} alt="MOVI Digital" className="h-10 w-auto object-contain" />
                <p className="text-sm text-white/50 leading-relaxed max-w-sm">
                  MOVI Digital es el ecosistema Insurtech y SaaS operativo para agentes y promotorías de seguros en México. Un desarrollo oficial respaldado por la Red Nacional de Grupo JIRO.
                </p>
                <div className="flex items-center gap-4 pt-2 text-xs text-white/40">
                  <span>Protegido con encriptación SSL de 256 bits · Conexión SICAS REST</span>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-white">Navegación</p>
                <ul className="space-y-2 text-sm text-white/60">
                  <li><button onClick={() => scrollTo('plataforma')} className="hover:text-white transition-colors cursor-pointer">Plataforma SaaS</button></li>
                  <li><button onClick={() => scrollTo('ecosistema')} className="hover:text-white transition-colors cursor-pointer">Ecosistema 8-en-1</button></li>
                  <li><button onClick={() => scrollTo('aseguradoras')} className="hover:text-white transition-colors cursor-pointer">Aseguradoras</button></li>
                  <li><button onClick={() => scrollTo('roi')} className="hover:text-white transition-colors cursor-pointer">Calculadora ROI</button></li>
                  <li><button onClick={() => scrollTo('faq')} className="hover:text-white transition-colors cursor-pointer">Preguntas Frecuentes</button></li>
                </ul>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-white">Ecosistema</p>
                <ul className="space-y-2 text-sm text-white/60">
                  <li><a href="https://app.movi.digital" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">MOVI Core App</a></li>
                  <li><a href="https://seguwallet.mx" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Seguwallet</a></li>
                  <li><a href="https://agentedeseguros.ai" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Chava AI</a></li>
                  <li><a href="https://seguros.education" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Seguros Education</a></li>
                  <li><a href="https://grupojiro.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Grupo JIRO</a></li>
                </ul>
              </div>

            </div>

            <div className="pt-8 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/40">
              <p>© {new Date().getFullYear()} MOVI Digital · Grupo JIRO. Todos los derechos reservados.</p>
              <div className="flex items-center gap-4">
                <a href="/login" className="hover:text-white/70 transition-colors">Acceso Operativo</a>
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
