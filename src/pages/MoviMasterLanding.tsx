import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  Shield,
  ShieldCheck,
  Smartphone,
  Laptop,
  Sparkles,
  Bot,
  GraduationCap,
  Zap,
  Globe,
  ShoppingBag,
  Layers,
  ArrowRight,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  Lock,
  BarChart3,
  Users,
  FileText,
  DollarSign,
  TrendingUp,
  RefreshCw,
  ExternalLink,
  Menu,
  X,
  Server,
  Database,
  Building2,
  Cpu,
  Workflow,
  HelpCircle,
  Clock,
  Car,
  HeartPulse,
  Send,
  Sliders,
  Check,
  Award
} from 'lucide-react';

// ─── LOCAL BRAND ASSETS ──────────────────────────────────────────────────────
const MOVI_LOGO_LIGHT = '/movirecurso_2.png';
const MOVI_LOGO_ICON = '/movirecurso_7.png';
const LOGO_JIRO = '/logojiro.png';
const SEGUWALLET_LOGO = '/seguwallet-logo.png';
const CHAVA_AI_LOGO = '/chava-ai-logo.svg';

// ─── LOCAL INSURER LOGOS ────────────────────────────────────────────────────
const CARRIERS = [
  { name: 'Quálitas', logo: '/qualitas-compania-de-seguros-logo-png_seeklogo-329374-2.png' },
  { name: 'GNP Seguros', logo: '/gnp-logo-png_seeklogo-61558.png' },
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

// ─── PLATAFORMAS DEL ECOSISTEMA ──────────────────────────────────────────────
interface PlatformItem {
  id: string;
  name: string;
  category: string;
  badge: string;
  url: string;
  icon: any;
  accent: string;
  bgGlow: string;
  description: string;
  features: string[];
}

const PLATFORMS: PlatformItem[] = [
  {
    id: 'movi-core',
    name: 'MOVI Core App',
    category: 'SaaS Operativo & ERP',
    badge: 'Plataforma Principal',
    url: 'https://app.movi.digital',
    icon: Laptop,
    accent: '#0D6EFD',
    bgGlow: 'from-blue-600/20 to-indigo-600/10',
    description: 'Gestión integral de pólizas, comisiones, cobranza, trámites en mesa de control y sincronización SICAS en tiempo real.',
    features: ['Sincronización SICAS', 'Cálculo y dispersión de comisiones', 'Bóveda Expediente 492', 'CRM & Pipeline de ventas']
  },
  {
    id: 'seguwallet',
    name: 'Seguwallet',
    category: 'App Asegurados & Clientes',
    badge: 'Wallet Digital',
    url: 'https://seguwallet.mx',
    icon: Smartphone,
    accent: '#1C37E0',
    bgGlow: 'from-blue-700/20 to-cyan-500/10',
    description: 'La cartera digital de pólizas para los clientes de tus agentes. Acceso sin contraseñas, descarga de recibos y reporte de siniestros.',
    features: ['Passwordless OTP WhatsApp/Email', 'Bóveda de PDFs de póliza', 'Marcación de siniestro 1-clic', 'Asistencias 24/7']
  },
  {
    id: 'chava-ai',
    name: 'Chava IA',
    category: 'Inteligencia Artificial',
    badge: 'Copilot 24/7',
    url: 'https://agentedeseguros.ai',
    icon: Bot,
    accent: '#00E5FF',
    bgGlow: 'from-cyan-500/20 to-blue-600/10',
    description: 'El agente de inteligencia artificial entrenado en el sector asegurador mexicano para responder dudas de pólizas, deducibles y coberturas.',
    features: ['Análisis de condiciones generales', 'Explicación de coberturas', 'Atención para agentes y clientes', 'Disponible 24/7']
  },
  {
    id: 'seguros-education',
    name: 'Seguros Education',
    category: 'Academia & Certificación',
    badge: 'Educación Continua',
    url: 'https://seguros.education',
    icon: GraduationCap,
    accent: '#6366F1',
    bgGlow: 'from-indigo-600/20 to-purple-600/10',
    description: 'Portal educativo de formación continua, preparación para Cédula A ante CNSF, Aula Virtual en vivo y programas académicos.',
    features: ['Cursos On Demand 24/7', 'Simulador de examen Cédula A', 'Aula Virtual en vivo', 'Alianzas Quálitas & UTEL']
  },
  {
    id: 'seguros-express',
    name: 'Seguros Express',
    category: 'Cotizador Público & Leads',
    badge: 'Captación en Línea',
    url: 'https://seguros.express',
    icon: Zap,
    accent: '#D92F3C',
    bgGlow: 'from-red-600/20 to-rose-600/10',
    description: 'Portal de prospección digital multirramo que conecta clientes con asesores certificados geolocalizados en toda la República Mexicana.',
    features: ['Cotización rápida multirramo', 'Asignación inteligente de leads', 'Red nacional de 32 estados', 'Atención sin call centers']
  },
  {
    id: 'agente-website',
    name: 'Tu Web de Asesor',
    category: 'Marca Blanca para Agentes',
    badge: 'Web Personalizada',
    url: 'https://agentedeseguros.website',
    icon: Globe,
    accent: '#10B981',
    bgGlow: 'from-emerald-600/20 to-teal-600/10',
    description: 'Página web profesional personalizable para cada agente con agenda de citas pública, cotizadores interactivos y branding propio.',
    features: ['URL personalizada (slug)', 'Agenda de citas online', 'Expediente digital de cliente', 'Optimizado para móvil']
  },
  {
    id: 'movi-tienda',
    name: 'MOVI Tienda',
    category: 'Merchandising & Branding',
    badge: 'Recursos de Marca',
    url: 'https://tienda.movi.digital',
    icon: ShoppingBag,
    accent: '#F59E0B',
    bgGlow: 'from-amber-500/20 to-orange-600/10',
    description: 'Tienda oficial de artículos promocionales, papelería corporativa y material de marketing diseñado exclusivamente para agentes MOVI.',
    features: ['Kits de bienvenida', 'Material publicitario', 'Identidad visual personalizada', 'Envíos a todo México']
  },
  {
    id: 'landings-studio',
    name: 'Hermes Landing Studio',
    category: 'Marketing Tech con IA',
    badge: 'Generador Web',
    url: 'https://landings.movi.digital',
    icon: Layers,
    accent: '#8B5CF6',
    bgGlow: 'from-purple-600/20 to-pink-600/10',
    description: 'Estudio de diseño y generación de landing pages asistido por Hermes Copilot para promocionar productos y membresías de seguros.',
    features: ['Editor visual en vivo', 'Instrucciones en lenguaje natural', 'Previsualización multi-dispositivo', 'Publicación instantánea']
  }
];

// ─── FAQ DATA ───────────────────────────────────────────────────────────────
const FAQS = [
  {
    q: '¿Qué es MOVI Digital y para quién fue creado?',
    a: 'MOVI Digital es el sistema operativo en la nube diseñado específicamente para promotorías, despachos y agentes de seguros y fianzas en México. Centraliza trámites de emisión, cálculo de comisiones, sincronización con aseguradoras (SICAS), CRM comercial, cumplimiento regulatorio (Expediente 492) y brinda aplicaciones de vanguardia para agentes y sus clientes.'
  },
  {
    q: '¿Cómo se conecta MOVI Digital con las aseguradoras?',
    a: 'MOVI se integra de forma directa mediante APIs REST y conectores con el sistema SICAS y servicios de las aseguradoras, sincronizando pólizas emitidas, estatus de cobranza, recibos y movimientos en tiempo real sin necesidad de capturas manuales repetitivas.'
  },
  {
    q: '¿Qué herramientas incluye para los clientes de mis agentes?',
    a: 'Incluye Seguwallet (seguwallet.mx), la cartera digital móvil para los asegurados con acceso sin contraseñas, descarga de pólizas y recibos en PDF, asistente virtual Chava IA 24/7 y botón de asistencia telefónica para reporte de siniestros.'
  },
  {
    q: '¿Mis agentes tienen su propia página web personalizada?',
    a: 'Sí. A través de agentedeseguros.website, cada asesor cuenta con una página web profesional con su nombre, foto, enlaces de WhatsApp, cotizadores multirramo y agenda pública sincronizada.'
  },
  {
    q: '¿Cómo protege MOVI la información y los datos personales?',
    a: 'La infraestructura de MOVI opera con encriptación SSL de 256 bits de grado bancario, bases de datos PostgreSQL con políticas estrictas de seguridad a nivel de fila (RLS), aislamiento por oficina/agente y cumplimiento de la Circular Única de Seguros y Fianzas (CUSF).'
  },
  {
    q: '¿Cómo puedo integrar mi promotoría o despacho a MOVI Digital?',
    a: 'Puedes solicitar una demostración personalizada o comunicarte con nuestro equipo comercial de Grupo JIRO para configurar tu espacio de trabajo, importar tu cartera y capacitar a tu equipo en cuestión de horas.'
  }
];

export default function MoviMasterLanding() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeDashboardTab, setActiveDashboardTab] = useState<'tramites' | 'comisiones' | 'sicas' | 'expediente'>('tramites');
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [agentCountSlider, setAgentCountSlider] = useState<number>(15);

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

  // ROI calculation simulation
  const hoursSavedPerMonth = Math.round(agentCountSlider * 28);
  const moneySavedPerMonth = (agentCountSlider * 4500).toLocaleString('es-MX');

  return (
    <>
      <Helmet>
        <title>MOVI Digital | El Sistema Operativo para el Sector Asegurador</title>
        <meta
          name="description"
          content="La plataforma tecnológica líder para agentes, promotorías y despachos de seguros: comisiones, SICAS, CRM, trámites, Seguwallet, Chava IA y Seguros Education."
        />
        <meta
          name="keywords"
          content="MOVI Digital, software para agentes de seguros, SICAS seguros, CRM seguros, promotoría de seguros, Grupo JIRO, Seguwallet, Chava IA, sistema para despachos de seguros México"
        />
        <link rel="canonical" href="https://movi.digital/" />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content="MOVI Digital | El Sistema Operativo para el Sector Asegurador" />
        <meta
          property="og:description"
          content="Toda la operación de seguros en un solo ecosistema inteligente. Trámites, comisiones, expedientes y apps para clientes."
        />
        <meta property="og:url" content="https://movi.digital/" />
        <meta property="og:image" content="/og-movi.jpg" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="MOVI Digital | Plataforma para Agentes de Seguros" />
        <meta
          name="twitter:description"
          content="Tecnología de vanguardia para promotorías y agentes de seguros en México."
        />

        {/* Schema.org */}
        <script type="application/ld+json">
          {JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'MOVI Digital',
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Cloud / Web / iOS / Android',
            description:
              'Ecosistema tecnológico integral para agentes, promotorías y despachos de seguros en México.',
            url: 'https://movi.digital',
            author: {
              '@type': 'Organization',
              name: 'Grupo JIRO'
            }
          })}
        </script>
      </Helmet>

      <div className="min-h-screen bg-[#030712] text-white selection:bg-[#0D6EFD] selection:text-white font-sans antialiased overflow-x-hidden">

        {/* ─── 1. NAVBAR SUPERIOR FIJO GLASSMORPHIC ───────────────────────── */}
        <header
          className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
          style={{
            background: 'rgba(3, 7, 18, 0.88)',
            backdropFilter: 'blur(20px)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
          }}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16 sm:h-20">
              
              {/* Logo MOVI */}
              <a href="#inicio" onClick={(e) => { e.preventDefault(); scrollTo('inicio'); }} className="flex items-center gap-3 group">
                <img
                  src={MOVI_LOGO_LIGHT}
                  alt="MOVI Digital"
                  className="h-8 sm:h-10 w-auto object-contain transition-transform group-hover:scale-105"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = MOVI_LOGO_ICON;
                  }}
                />
              </a>

              {/* Desktop Nav Links */}
              <nav className="hidden xl:flex items-center gap-7">
                <button
                  onClick={() => scrollTo('ecosistema')}
                  className="text-sm font-semibold text-white/75 hover:text-white transition-colors cursor-pointer"
                >
                  Ecosistema
                </button>
                <button
                  onClick={() => scrollTo('modulos')}
                  className="text-sm font-semibold text-white/75 hover:text-white transition-colors cursor-pointer"
                >
                  Módulos Core
                </button>
                <button
                  onClick={() => scrollTo('plataformas')}
                  className="text-sm font-semibold text-white/75 hover:text-white transition-colors cursor-pointer"
                >
                  Plataformas
                </button>
                <button
                  onClick={() => scrollTo('aseguradoras')}
                  className="text-sm font-semibold text-white/75 hover:text-white transition-colors cursor-pointer"
                >
                  Conectividad
                </button>
                <button
                  onClick={() => scrollTo('calculadora')}
                  className="text-sm font-semibold text-white/75 hover:text-white transition-colors cursor-pointer"
                >
                  Impacto & ROI
                </button>
                <button
                  onClick={() => scrollTo('faq')}
                  className="text-sm font-semibold text-white/75 hover:text-white transition-colors cursor-pointer"
                >
                  Preguntas
                </button>
              </nav>

              {/* Right CTA Actions */}
              <div className="hidden sm:flex items-center gap-3">
                <a
                  href="https://app.movi.digital/login"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.15] transition-all"
                >
                  <Lock className="w-4 h-4 text-[#00E5FF]" />
                  <span>Acceso Agentes</span>
                </a>

                <button
                  onClick={() => scrollTo('contacto')}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white transition-all duration-200 active:scale-95 shadow-lg shadow-blue-600/30 hover:shadow-blue-600/50 cursor-pointer"
                  style={{
                    background: 'linear-gradient(135deg, #0D6EFD 0%, #0047BB 100%)'
                  }}
                >
                  <span>Solicitar Demo</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {/* Mobile menu button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="xl:hidden p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Abrir navegación"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>

            </div>
          </div>

          {/* Mobile menu dropdown */}
          {mobileMenuOpen && (
            <div className="xl:hidden border-t border-white/10 bg-[#060F26]/98 px-5 py-6 space-y-4 backdrop-blur-2xl">
              <div className="space-y-1.5">
                {[
                  { label: 'Ecosistema Digital', id: 'ecosistema' },
                  { label: 'Módulos Core del SaaS', id: 'modulos' },
                  { label: 'Plataformas Integradas', id: 'plataformas' },
                  { label: 'Aseguradoras & Conectividad', id: 'aseguradoras' },
                  { label: 'Calculadora de Productividad', id: 'calculadora' },
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
                  className="flex items-center justify-center gap-2 w-full px-5 py-3.5 rounded-xl font-bold text-sm text-white bg-white/[0.08] border border-white/15"
                >
                  <Lock className="w-4 h-4 text-[#00E5FF]" />
                  <span>Ingresar a MOVI Core</span>
                </a>
                <button
                  onClick={() => scrollTo('contacto')}
                  className="flex items-center justify-center gap-2 w-full px-5 py-3.5 rounded-xl font-bold text-sm text-white shadow-lg shadow-blue-600/30"
                  style={{ background: 'linear-gradient(135deg, #0D6EFD 0%, #0047BB 100%)' }}
                >
                  <span>Solicitar Demostración</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </header>

        {/* ─── 2. HERO PRINCIPAL AAA TECH ─────────────────────────────────── */}
        <section
          id="inicio"
          className="relative min-h-[95vh] flex items-center pt-28 pb-16 lg:pt-36 lg:pb-24 overflow-hidden"
          style={{
            background: 'radial-gradient(ellipse at 50% 15%, #0B1E48 0%, #060F26 50%, #030712 100%)'
          }}
        >
          {/* Cybernetic Grid & Glow Nodes */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `linear-gradient(rgba(0, 229, 255, 0.03) 1px, transparent 1px),
                                linear-gradient(90deg, rgba(13, 110, 253, 0.03) 1px, transparent 1px)`,
              backgroundSize: '64px 64px'
            }}
          />

          {/* Light Orbs */}
          <div
            className="absolute -top-40 left-1/3 w-[700px] h-[700px] rounded-full pointer-events-none"
            style={{
              background: 'radial-gradient(circle, #0D6EFD 0%, transparent 65%)',
              opacity: 0.18,
              filter: 'blur(80px)'
            }}
          />
          <div
            className="absolute top-1/2 -right-40 w-[600px] h-[600px] rounded-full pointer-events-none"
            style={{
              background: 'radial-gradient(circle, #00E5FF 0%, transparent 65%)',
              opacity: 0.12,
              filter: 'blur(90px)'
            }}
          />

          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
            <div className="text-center space-y-7 max-w-4xl mx-auto">
              
              {/* Pill / Eyebrow Badge */}
              <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.12] backdrop-blur-md">
                <span className="w-2.5 h-2.5 rounded-full bg-[#00E5FF] animate-pulse" />
                <span className="text-xs font-bold text-white tracking-widest uppercase">
                  Insurtech Operating System · Grupo JIRO
                </span>
              </div>

              {/* Headline */}
              <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-white leading-[1.04] tracking-tight">
                El Sistema Operativo Definitivo para el{' '}
                <span
                  className="bg-clip-text text-transparent"
                  style={{
                    backgroundImage: 'linear-gradient(135deg, #0D6EFD 0%, #00E5FF 50%, #FFFFFF 100%)'
                  }}
                >
                  Sector Asegurador
                </span>
              </h1>

              {/* Subheadline */}
              <p className="text-base sm:text-xl text-white/70 leading-relaxed max-w-3xl mx-auto font-normal">
                Conectamos comisiones automáticas, sincronización SICAS en tiempo real, CRM de ventas, expedientes regulatorios 492 y aplicaciones inteligentes para clientes en un solo ecosistema integrado.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
                <a
                  href="https://app.movi.digital/login"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl font-bold text-base text-white shadow-xl shadow-blue-600/35 hover:shadow-blue-600/55 transition-all duration-200 active:scale-95"
                  style={{ background: 'linear-gradient(135deg, #0D6EFD 0%, #0047BB 100%)' }}
                >
                  <Lock className="w-5 h-5" />
                  <span>Ingresar a la Plataforma</span>
                  <ArrowRight className="w-5 h-5" />
                </a>

                <button
                  onClick={() => scrollTo('ecosistema')}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-bold text-base text-white/90 bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.15] transition-all cursor-pointer"
                >
                  <Workflow className="w-5 h-5 text-[#00E5FF]" />
                  <span>Explorar Ecosistema</span>
                </button>
              </div>

              {/* Institutional Endorsement */}
              <div className="pt-8 flex items-center justify-center gap-4 text-xs font-semibold text-white/45">
                <span>Desarrollado y respaldado por</span>
                <img
                  src={LOGO_JIRO}
                  alt="Grupo JIRO"
                  className="h-5 w-auto object-contain brightness-125 opacity-80"
                />
                <span>· Red Nacional de Agentes de Seguros</span>
              </div>

            </div>

            {/* Interactive SaaS Mockup Preview */}
            <div className="mt-14 max-w-5xl mx-auto relative">
              <div
                className="absolute -inset-4 rounded-3xl pointer-events-none"
                style={{
                  background: 'linear-gradient(180deg, rgba(13,110,253,0.3) 0%, rgba(0,229,255,0.15) 50%, transparent 100%)',
                  filter: 'blur(40px)'
                }}
              />

              <div className="relative rounded-3xl border border-white/[0.15] bg-[#07132F]/95 shadow-2xl overflow-hidden backdrop-blur-xl">
                
                {/* Window Topbar */}
                <div className="px-5 py-3.5 bg-[#050C20] border-b border-white/[0.08] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-red-500/80" />
                    <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
                    <span className="w-3 h-3 rounded-full bg-green-500/80" />
                    <span className="ml-3 text-xs font-mono text-white/40">app.movi.digital/dashboard</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> SICAS REST: Conectado
                    </span>
                  </div>
                </div>

                {/* Interactive Inner Tabs */}
                <div className="p-6 space-y-6">
                  
                  {/* Tab Selector */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-1.5 bg-white/[0.04] rounded-2xl border border-white/[0.08] text-xs font-bold">
                    <button
                      onClick={() => setActiveDashboardTab('tramites')}
                      className={`py-2.5 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
                        activeDashboardTab === 'tramites' ? 'bg-[#0D6EFD] text-white shadow-md' : 'text-white/60 hover:text-white'
                      }`}
                    >
                      <FileText className="w-4 h-4" />
                      <span>Mesa de Trámites</span>
                    </button>
                    <button
                      onClick={() => setActiveDashboardTab('comisiones')}
                      className={`py-2.5 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
                        activeDashboardTab === 'comisiones' ? 'bg-[#0D6EFD] text-white shadow-md' : 'text-white/60 hover:text-white'
                      }`}
                    >
                      <DollarSign className="w-4 h-4" />
                      <span>Comisiones Automáticas</span>
                    </button>
                    <button
                      onClick={() => setActiveDashboardTab('sicas')}
                      className={`py-2.5 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
                        activeDashboardTab === 'sicas' ? 'bg-[#0D6EFD] text-white shadow-md' : 'text-white/60 hover:text-white'
                      }`}
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>Producción SICAS</span>
                    </button>
                    <button
                      onClick={() => setActiveDashboardTab('expediente')}
                      className={`py-2.5 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
                        activeDashboardTab === 'expediente' ? 'bg-[#0D6EFD] text-white shadow-md' : 'text-white/60 hover:text-white'
                      }`}
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>Bóveda 492</span>
                    </button>
                  </div>

                  {/* Tab Visual Output */}
                  <div className="rounded-2xl bg-black/40 border border-white/[0.06] p-5 sm:p-6 min-h-[220px]">
                    
                    {activeDashboardTab === 'tramites' && (
                      <div className="space-y-3 animate-in fade-in duration-200">
                        <div className="flex items-center justify-between text-xs text-white/50 pb-2 border-b border-white/10">
                          <span>Folio / Trámite</span>
                          <span>Aseguradora</span>
                          <span>Ramo</span>
                          <span>Estado</span>
                        </div>
                        <div className="flex items-center justify-between text-sm py-2 border-b border-white/5">
                          <span className="font-semibold text-white">TR-2026-8941 · Renovación Flotilla</span>
                          <span className="text-white/70">Quálitas</span>
                          <span className="text-blue-400 font-medium">Autos</span>
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold">Emitida</span>
                        </div>
                        <div className="flex items-center justify-between text-sm py-2 border-b border-white/5">
                          <span className="font-semibold text-white">TR-2026-8942 · Emisión GMM Familiar</span>
                          <span className="text-white/70">GNP</span>
                          <span className="text-emerald-400 font-medium">Gastos Médicos</span>
                          <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold">En Análisis</span>
                        </div>
                        <div className="flex items-center justify-between text-sm py-2">
                          <span className="font-semibold text-white">TR-2026-8943 · Endoso Cambio Domicilio</span>
                          <span className="text-white/70">Chubb</span>
                          <span className="text-purple-400 font-medium">Daños</span>
                          <span className="px-2.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 text-xs font-bold">Revisión Docs</span>
                        </div>
                      </div>
                    )}

                    {activeDashboardTab === 'comisiones' && (
                      <div className="space-y-4 animate-in fade-in duration-200">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="p-4 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                            <p className="text-xs text-white/50">Comisiones del Mes</p>
                            <p className="text-2xl font-black text-emerald-400 mt-1">$148,250 MXN</p>
                            <p className="text-[11px] text-white/40 mt-0.5">Conciliadas automáticamente</p>
                          </div>
                          <div className="p-4 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                            <p className="text-xs text-white/50">Recibos Cobrados</p>
                            <p className="text-2xl font-black text-white mt-1">42 / 45</p>
                            <p className="text-[11px] text-emerald-400 mt-0.5">93.3% cobranza efectiva</p>
                          </div>
                          <div className="p-4 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                            <p className="text-xs text-white/50">Bono por Despacho</p>
                            <p className="text-2xl font-black text-[#00E5FF] mt-1">+12.5%</p>
                            <p className="text-[11px] text-white/40 mt-0.5">Meta Q2 alcanzada</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {activeDashboardTab === 'sicas' && (
                      <div className="space-y-3 animate-in fade-in duration-200">
                        <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                          <div className="flex items-center gap-3">
                            <Server className="w-5 h-5 text-emerald-400" />
                            <div>
                              <p className="text-sm font-bold text-white">SICAS 96 Catálogos & Pólizas</p>
                              <p className="text-xs text-white/40">Sincronización bidireccional activa</p>
                            </div>
                          </div>
                          <span className="text-xs font-mono text-emerald-400 font-bold">1,840 pólizas mapeadas</span>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                          <div className="flex items-center gap-3">
                            <Database className="w-5 h-5 text-blue-400" />
                            <div>
                              <p className="text-sm font-bold text-white">Vendedores & Despachos SICAS</p>
                              <p className="text-xs text-white/40">Mapeo unificado automático por clave</p>
                            </div>
                          </div>
                          <span className="text-xs font-mono text-blue-400 font-bold">100% sincronizado</span>
                        </div>
                      </div>
                    )}

                    {activeDashboardTab === 'expediente' && (
                      <div className="space-y-3 animate-in fade-in duration-200">
                        <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-between">
                          <div>
                            <p className="text-sm font-bold text-white">Cumplimiento Regulatorio Art. 492 / CUSF</p>
                            <p className="text-xs text-white/60">Identificación oficial, RFC, comprobante y cédula de identificación</p>
                          </div>
                          <span className="px-3 py-1 rounded-full bg-emerald-500 text-slate-900 text-xs font-black">
                            Blindaje 100%
                          </span>
                        </div>
                        <p className="text-xs text-white/50">
                          Todos los expedientes se validan y almacenan con hash criptográfico para auditorías de la CNSF.
                        </p>
                      </div>
                    )}

                  </div>

                </div>

              </div>
            </div>

          </div>
        </section>

        {/* ─── 3. ECOSISTEMA DE PLATAFORMAS (INTERACTIVE HUB) ─────────────── */}
        <section id="ecosistema" className="py-24 bg-[#040C1F] border-t border-white/[0.08] relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            
            <div className="text-center space-y-4 max-w-3xl mx-auto mb-16">
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-[#00E5FF] text-xs font-bold uppercase tracking-wider">
                <Workflow className="w-3.5 h-3.5" /> Ecosistema Completo
              </span>
              <h2 className="text-3xl sm:text-5xl font-black text-white leading-tight">
                8 Plataformas interconectadas para dominar el mercado
              </h2>
              <p className="text-base sm:text-lg text-white/60">
                Cada producto resuelve una necesidad específica de la cadena de valor: desde la administración interna del despacho hasta la experiencia digital del cliente final.
              </p>
            </div>

            {/* Platforms Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6" id="plataformas">
              {PLATFORMS.map((plat) => {
                const IconComponent = plat.icon;
                return (
                  <div
                    key={plat.id}
                    className="group rounded-3xl p-6 bg-white/[0.03] border border-white/[0.08] hover:border-white/[0.22] transition-all duration-300 flex flex-col justify-between hover:bg-white/[0.05] relative overflow-hidden"
                  >
                    <div className="space-y-4">
                      
                      {/* Category & Badge */}
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-white/50 uppercase tracking-wider">
                          {plat.category}
                        </span>
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white bg-white/10 border border-white/10"
                        >
                          {plat.badge}
                        </span>
                      </div>

                      {/* Icon & Title */}
                      <div className="flex items-center gap-3 pt-1">
                        <div
                          className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg"
                          style={{ backgroundColor: plat.accent }}
                        >
                          <IconComponent className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-white group-hover:text-[#00E5FF] transition-colors">
                            {plat.name}
                          </h3>
                        </div>
                      </div>

                      {/* Description */}
                      <p className="text-xs text-white/60 leading-relaxed">
                        {plat.description}
                      </p>

                      {/* Key features checklist */}
                      <ul className="space-y-1.5 pt-2 border-t border-white/5">
                        {plat.features.map((f, idx) => (
                          <li key={idx} className="flex items-center gap-2 text-[11px] text-white/70">
                            <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>

                    </div>

                    {/* Action link */}
                    <div className="pt-6 mt-4 border-t border-white/5">
                      <a
                        href={plat.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-between w-full text-xs font-bold text-white hover:text-[#00E5FF] transition-colors py-1"
                      >
                        <span>Visitar {plat.name}</span>
                        <ExternalLink className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        </section>

        {/* ─── 4. MÓDULOS CORE DEL SAAS (BENTO GRID) ───────────────────────── */}
        <section id="modulos" className="py-24 bg-[#030712] relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            
            <div className="text-center space-y-4 max-w-3xl mx-auto mb-16">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-[#0D6EFD] text-xs font-bold uppercase tracking-wide">
                <Cpu className="w-3.5 h-3.5" /> Motor SaaS
              </span>
              <h2 className="text-3xl sm:text-5xl font-black text-white leading-tight">
                Potencia operativa sin precedentes
              </h2>
              <p className="text-base text-white/60">
                Elimina las tareas manuales y automatiza la administración de tu cartera de seguros.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              
              <div className="md:col-span-2 rounded-3xl p-8 bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08] space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold">
                  <DollarSign className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold text-white">Conciliación y Dispersión de Comisiones</h3>
                <p className="text-sm text-white/60 leading-relaxed max-w-xl">
                  Calcula de forma automática los porcentajes de comisión por agente, despacho y promotoría. Importa estados de cuenta de aseguradoras y genera recibos de liquidación en segundos con desglose fiscal exacto.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                  <div className="p-3 bg-white/[0.03] rounded-xl border border-white/5">
                    <p className="text-xs text-white/40">Cálculo de Esquemas</p>
                    <p className="text-sm font-bold text-white">Directo, Escalonado, Bono</p>
                  </div>
                  <div className="p-3 bg-white/[0.03] rounded-xl border border-white/5">
                    <p className="text-xs text-white/40">Exportación</p>
                    <p className="text-sm font-bold text-white">Excel, PDF y XML Fiscal</p>
                  </div>
                  <div className="p-3 bg-white/[0.03] rounded-xl border border-white/5">
                    <p className="text-xs text-white/40">Error de Cálculo</p>
                    <p className="text-sm font-bold text-emerald-400">0.00% Garantizado</p>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl p-8 bg-white/[0.03] border border-white/[0.08] space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold">
                  <RefreshCw className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-white">Sincronización SICAS</h3>
                <p className="text-sm text-white/60 leading-relaxed">
                  Conexión directa vía REST con el sistema SICAS para sincronizar pólizas vigentes, canceladas, endosos y catálogos de aseguradoras.
                </p>
              </div>

              <div className="rounded-3xl p-8 bg-white/[0.03] border border-white/[0.08] space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-purple-600 text-white flex items-center justify-center font-bold">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-white">Expediente 492 Regulatorio</h3>
                <p className="text-sm text-white/60 leading-relaxed">
                  Control estricto de identificación del cliente (KYC), prevención de lavado de dinero y blindaje ante revisiones de la CNSF.
                </p>
              </div>

              <div className="md:col-span-2 rounded-3xl p-8 bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08] space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-cyan-600 text-white flex items-center justify-center font-bold">
                  <Bot className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold text-white">Chava IA Copilot Integrado</h3>
                <p className="text-sm text-white/60 leading-relaxed max-w-xl">
                  Inteligencia artificial que asiste al agente en la cotización, compara condiciones generales entre compañías y responde dudas de coberturas en lenguaje natural.
                </p>
              </div>

            </div>

          </div>
        </section>

        {/* ─── 5. ASEGURADORAS Y CONECTIVIDAD (MARQUEE LOCAL) ─────────────── */}
        <section id="aseguradoras" className="py-20 bg-[#060F26] border-y border-white/[0.08]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8 text-center space-y-2">
            <span className="text-xs font-bold text-[#00E5FF] uppercase tracking-widest">
              Conectividad con el Mercado
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-white">
              Soporte para las principales aseguradoras y ramos de México
            </h2>
          </div>

          <div className="flex overflow-x-auto no-scrollbar gap-6 py-4 px-6 items-center justify-center flex-wrap">
            {CARRIERS.map((c, i) => (
              <div
                key={i}
                className="h-14 px-5 py-2.5 bg-white/[0.04] rounded-2xl border border-white/[0.08] flex items-center justify-center hover:bg-white/[0.08] transition-all hover:scale-105"
              >
                <img
                  src={c.logo}
                  alt={c.name}
                  className="max-h-7 max-w-[120px] w-auto object-contain filter brightness-110"
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

        {/* ─── 6. CALCULADORA DE PRODUCTIVIDAD & ROI ───────────────────────── */}
        <section id="calculadora" className="py-24 bg-[#040C1F] relative">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            
            <div className="rounded-3xl p-8 sm:p-12 bg-gradient-to-br from-[#0B1E48] to-[#040C1F] border border-blue-500/30 shadow-2xl space-y-8">
              
              <div className="text-center space-y-3">
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-500/20 text-[#00E5FF] text-xs font-bold uppercase tracking-wider">
                  Calculadora de Productividad
                </span>
                <h2 className="text-3xl sm:text-4xl font-black text-white">
                  ¿Cuánto tiempo y dinero ahorra tu promotoría con MOVI?
                </h2>
                <p className="text-sm text-white/60 max-w-xl mx-auto">
                  Ajusta el número de agentes activos en tu equipo para calcular el ahorro mensual estimado en horas operativas y costos administrativos.
                </p>
              </div>

              {/* Slider */}
              <div className="space-y-4 max-w-xl mx-auto bg-white/[0.03] p-6 rounded-2xl border border-white/[0.08]">
                <div className="flex justify-between items-center text-sm font-bold">
                  <span className="text-white/70">Agentes / Asesores en tu equipo:</span>
                  <span className="text-2xl text-[#00E5FF] font-black">{agentCountSlider} agentes</span>
                </div>
                <input
                  type="range"
                  min="3"
                  max="150"
                  value={agentCountSlider}
                  onChange={(e) => setAgentCountSlider(Number(e.target.value))}
                  className="w-full h-2.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#00E5FF]"
                />
                <div className="flex justify-between text-[11px] text-white/40">
                  <span>3 agentes (Despacho boutique)</span>
                  <span>150+ agentes (Promotoría nacional)</span>
                </div>
              </div>

              {/* Output Metrics */}
              <div className="grid sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
                <div className="p-6 rounded-2xl bg-white/[0.05] border border-white/10 text-center space-y-2">
                  <Clock className="w-8 h-8 text-[#00E5FF] mx-auto" />
                  <p className="text-3xl sm:text-4xl font-black text-white">+{hoursSavedPerMonth} hrs</p>
                  <p className="text-xs text-white/60">Horas operativas ahorradas cada mes en conciliaciones y reportes</p>
                </div>

                <div className="p-6 rounded-2xl bg-white/[0.05] border border-white/10 text-center space-y-2">
                  <TrendingUp className="w-8 h-8 text-emerald-400 mx-auto" />
                  <p className="text-3xl sm:text-4xl font-black text-emerald-400">${moneySavedPerMonth} MXN</p>
                  <p className="text-xs text-white/60">Ahorro administrativo mensual estimado en errores y horas hombre</p>
                </div>
              </div>

              <div className="text-center pt-4">
                <button
                  onClick={() => scrollTo('contacto')}
                  className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl font-bold text-sm text-white bg-blue-600 hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/30 cursor-pointer"
                >
                  <span>Solicitar estudio para mi despacho</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

            </div>

          </div>
        </section>

        {/* ─── 7. PREGUNTAS FRECUENTES (FAQ) ───────────────────────────────── */}
        <section id="faq" className="py-24 bg-[#030712] border-t border-white/[0.08]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            
            <div className="text-center space-y-4 mb-16">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-[#00E5FF] text-xs font-bold uppercase tracking-wide">
                <HelpCircle className="w-3.5 h-3.5" /> Dudas Frecuentes
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-white">
                Preguntas sobre MOVI Digital
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
                        className={`w-5 h-5 text-[#00E5FF] flex-shrink-0 transition-transform duration-200 ${
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

        {/* ─── 8. CTA FINAL / CONTACTO ─────────────────────────────────────── */}
        <section id="contacto" className="py-24 bg-gradient-to-b from-[#030712] to-[#060F26] relative">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
            
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-[#0D6EFD] to-[#00E5FF] flex items-center justify-center text-white mx-auto shadow-2xl shadow-blue-500/40">
              <Award className="w-8 h-8" />
            </div>

            <div className="space-y-4 max-w-2xl mx-auto">
              <h2 className="text-3xl sm:text-5xl font-black text-white leading-tight">
                Transforma tu despacho en una potencia digital
              </h2>
              <p className="text-base sm:text-lg text-white/70">
                Únete a la red de promotorías y agentes de seguros más innovadora de México.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href="https://app.movi.digital/login"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl font-bold text-base text-white shadow-xl shadow-blue-600/40 hover:shadow-blue-600/60 transition-all active:scale-95"
                style={{ background: 'linear-gradient(135deg, #0D6EFD 0%, #0047BB 100%)' }}
              >
                <Lock className="w-5 h-5" />
                <span>Ingresar a MOVI Digital</span>
                <ArrowRight className="w-5 h-5" />
              </a>

              <a
                href="https://grupojiro.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-bold text-base text-white/80 bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.15] transition-all"
              >
                <span>Conocer Grupo JIRO</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>

          </div>
        </section>

        {/* ─── 9. FOOTER INSTITUCIONAL COMPLETO ────────────────────────────── */}
        <footer className="border-t border-white/[0.08] bg-[#02050E] py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
            
            <div className="grid md:grid-cols-5 gap-8">
              
              <div className="md:col-span-2 space-y-4">
                <img src={MOVI_LOGO_LIGHT} alt="MOVI Digital" className="h-9 w-auto object-contain" />
                <p className="text-sm text-white/50 leading-relaxed max-w-sm">
                  MOVI Digital es el sistema operativo integral para agentes y promotorías de seguros y fianzas en México. Una plataforma oficial desarrollada con el respaldo de Grupo JIRO.
                </p>
                <div className="flex items-center gap-3 text-xs text-white/40 pt-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Seguridad de nivel bancario con encriptación SSL 256-bit</span>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-white">Plataformas</p>
                <ul className="space-y-2 text-sm text-white/60">
                  <li><a href="https://app.movi.digital" className="hover:text-white transition-colors">MOVI Core App</a></li>
                  <li><a href="https://seguwallet.mx" className="hover:text-white transition-colors">Seguwallet</a></li>
                  <li><a href="https://agentedeseguros.ai" className="hover:text-white transition-colors">Chava IA</a></li>
                  <li><a href="https://seguros.education" className="hover:text-white transition-colors">Seguros Education</a></li>
                  <li><a href="https://seguros.express" className="hover:text-white transition-colors">Seguros Express</a></li>
                </ul>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-white">Recursos</p>
                <ul className="space-y-2 text-sm text-white/60">
                  <li><a href="https://tienda.movi.digital" className="hover:text-white transition-colors">MOVI Tienda</a></li>
                  <li><a href="https://landings.movi.digital" className="hover:text-white transition-colors">Hermes Studio</a></li>
                  <li><a href="https://agentedeseguros.website" className="hover:text-white transition-colors">Web de Asesores</a></li>
                  <li><a href="https://grupojiro.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Grupo JIRO</a></li>
                </ul>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-white">Navegación</p>
                <ul className="space-y-2 text-sm text-white/60">
                  <li><button onClick={() => scrollTo('ecosistema')} className="hover:text-white transition-colors cursor-pointer">Ecosistema</button></li>
                  <li><button onClick={() => scrollTo('modulos')} className="hover:text-white transition-colors cursor-pointer">Módulos</button></li>
                  <li><button onClick={() => scrollTo('aseguradoras')} className="hover:text-white transition-colors cursor-pointer">Aseguradoras</button></li>
                  <li><button onClick={() => scrollTo('calculadora')} className="hover:text-white transition-colors cursor-pointer">Calculadora</button></li>
                  <li><button onClick={() => scrollTo('faq')} className="hover:text-white transition-colors cursor-pointer">Preguntas</button></li>
                </ul>
              </div>

            </div>

            <div className="pt-8 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/40">
              <p>© {new Date().getFullYear()} MOVI Digital · Grupo JIRO. Todos los derechos reservados.</p>
              <div className="flex items-center gap-4">
                <a href="https://movi.digital" className="hover:text-white/70 transition-colors">Aviso de Privacidad</a>
                <span>·</span>
                <a href="https://movi.digital" className="hover:text-white/70 transition-colors">Términos de Servicio</a>
              </div>
            </div>

          </div>
        </footer>

      </div>
    </>
  );
}
