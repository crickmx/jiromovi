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
  Settings,
  Flame,
  LayoutDashboard,
  UserPlus,
  Phone
} from 'lucide-react';

// ─── RECURSOS LOCALES Y LOGOS ──────────────────────────────────────────────
const LOGO_MOVI = '/movirecurso_2.png';
const LOGO_JIRO = '/logojiro.png';
const LOGO_SEGUWALLET = '/seguwallet-logo.png';
const LOGO_EDUCATION = '/og-seguros-education.svg';
const AVATAR_DEMO = '/display-avatar.png';

export default function MoviProductLanding() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'tramites' | 'crm' | 'produccion' | 'notificaciones' | 'comunicados'>('tramites');
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Formulario del Mockup de Agente Demo
  const [demoFormSent, setDemoFormSent] = useState(false);
  const [selectedInsurance, setSelectedInsurance] = useState('Seguro de Auto');

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
        <title>MOVI Digital · Mi Oficina Virtual | Grupo JIRO</title>
        <meta
          name="description"
          content="MOVI Digital es la plataforma exclusiva de gestión para los agentes y asesores de Grupo JIRO. Control de trámites, Mi CRM, Central de Producción, tu propia página web y notificaciones automáticas."
        />
        <meta
          name="keywords"
          content="MOVI Digital, Mi Oficina Virtual, Grupo JIRO, agentes de seguros, CRM para agentes, control de tramites, comisiones seguros, Seguwallet, Seguros Education"
        />
        <link rel="canonical" href="https://movi.digital/" />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content="MOVI Digital · Mi Oficina Virtual | Grupo JIRO" />
        <meta
          property="og:description"
          content="La plataforma digital exclusiva para agentes de seguros de Grupo JIRO. Trámites, CRM, comisiones, tu web personalizada y automatización."
        />
        <meta property="og:url" content="https://movi.digital/" />
        <meta property="og:image" content="https://movi.digital/movirecurso_2.png" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="MOVI Digital · Mi Oficina Virtual | Grupo JIRO" />
        <meta
          name="twitter:description"
          content="La mejor herramienta de gestión comercial y operativa para nuestros agentes de seguros."
        />
      </Helmet>

      <div className="min-h-screen bg-[#F8FAFC] text-slate-900 selection:bg-blue-600 selection:text-white font-sans antialiased">

        {/* ─── 1. NAVBAR SUPERIOR FIJO Y CLARO ─────────────────────────────── */}
        <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200/90 transition-all duration-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16 sm:h-20">
              
              {/* Logos Institucionales: MOVI + Grupo JIRO */}
              <div className="flex items-center gap-3.5">
                <a
                  href="#inicio"
                  onClick={(e) => { e.preventDefault(); scrollTo('inicio'); }}
                  className="flex items-center gap-2 group"
                >
                  <img
                    src={LOGO_MOVI}
                    alt="MOVI Digital"
                    className="h-8 sm:h-9 w-auto object-contain transition-transform group-hover:scale-105"
                  />
                </a>
                <div className="h-6 w-[1px] bg-slate-200 hidden sm:block" />
                <a
                  href="https://www.grupojiro.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden sm:flex items-center gap-2 text-xs font-semibold text-slate-700 hover:text-blue-700 transition-colors"
                >
                  <img
                    src={LOGO_JIRO}
                    alt="Grupo JIRO"
                    className="h-6 sm:h-7 w-auto object-contain"
                  />
                </a>
              </div>

              {/* Menú de Navegación */}
              <nav className="hidden lg:flex items-center gap-7">
                <button
                  onClick={() => scrollTo('funciones')}
                  className="text-xs xl:text-sm font-bold text-slate-600 hover:text-blue-600 transition-colors cursor-pointer"
                >
                  Beneficios y Módulos
                </button>
                <button
                  onClick={() => scrollTo('mi-web')}
                  className="text-xs xl:text-sm font-bold text-slate-600 hover:text-blue-600 transition-colors cursor-pointer"
                >
                  Tu Página Web
                </button>
                <button
                  onClick={() => scrollTo('herramientas')}
                  className="text-xs xl:text-sm font-bold text-slate-600 hover:text-blue-600 transition-colors cursor-pointer"
                >
                  Herramientas
                </button>
                <button
                  onClick={() => scrollTo('faq')}
                  className="text-xs xl:text-sm font-bold text-slate-600 hover:text-blue-600 transition-colors cursor-pointer"
                >
                  Preguntas Frecuentes
                </button>
              </nav>

              {/* Botón de Ingreso al Portal */}
              <div className="hidden sm:flex items-center gap-3">
                <a
                  href="https://app.movi.digital/login"
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-extrabold text-xs sm:text-sm text-white bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all shadow-md shadow-blue-600/25 cursor-pointer"
                >
                  <Lock className="w-4 h-4" />
                  <span>Ingresar</span>
                </a>
              </div>

              {/* Mobile toggle */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 rounded-xl text-slate-700 hover:bg-slate-100 transition-colors"
                aria-label="Abrir menú"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>

            </div>
          </div>

          {/* Menú móvil */}
          {mobileMenuOpen && (
            <div className="lg:hidden border-t border-slate-200 bg-white px-5 py-6 space-y-4 shadow-xl">
              <div className="space-y-2">
                {[
                  { label: 'Beneficios y Módulos', id: 'funciones' },
                  { label: 'Tu Página Web (Ejemplo en Vivo)', id: 'mi-web' },
                  { label: 'Herramientas (Seguwallet & Education)', id: 'herramientas' },
                  { label: 'Preguntas Frecuentes', id: 'faq' }
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => scrollTo(item.id)}
                    className="block w-full text-left px-4 py-3 text-base font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-600 rounded-xl transition-colors"
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="pt-4 border-t border-slate-100 space-y-3">
                <a
                  href="https://app.movi.digital/login"
                  className="flex items-center justify-center gap-2 w-full px-5 py-3.5 rounded-xl font-bold text-sm text-white bg-blue-600 hover:bg-blue-700 text-center shadow-md shadow-blue-600/30"
                >
                  <Lock className="w-4 h-4" />
                  <span>Ingresar</span>
                </a>
              </div>
            </div>
          )}
        </header>

        {/* ─── 2. HERO PRINCIPAL: INSTITUCIONAL Y COMERCIAL CON LOGO MOVI ──── */}
        <section
          id="inicio"
          className="relative pt-24 pb-16 lg:pt-36 lg:pb-24 bg-gradient-to-b from-blue-50/70 via-white to-[#F8FAFC] overflow-hidden"
        >
          {/* Acentos de fondo */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-r from-blue-200/40 via-indigo-200/30 to-cyan-200/30 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-4xl mx-auto space-y-6">
              
              {/* Logo Oficial de MOVI Digital en el Hero */}
              <div className="flex justify-center mb-2 animate-in fade-in duration-300">
                <img
                  src={LOGO_MOVI}
                  alt="MOVI Digital"
                  className="h-14 sm:h-18 w-auto object-contain drop-shadow-md"
                />
              </div>

              {/* Badge Oficial */}
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-100/90 border border-blue-200 text-blue-900 text-xs font-extrabold tracking-wide uppercase shadow-xs">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <span>Plataforma Digital Exclusiva para Asesores de Grupo JIRO</span>
              </div>

              {/* Titular Principal */}
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 leading-[1.12] tracking-tight">
                MOVI.Digital ·{' '}
                <span className="text-blue-600">
                  Mi Oficina Virtual
                </span>
              </h1>

              {/* Subtítulo enfocado al agente */}
              <p className="text-lg sm:text-xl text-slate-600 leading-relaxed max-w-3xl mx-auto font-normal">
                La herramienta tecnológica todo-en-uno creada exclusivamente para respaldar el éxito de nuestros agentes de seguros en <strong>Grupo JIRO</strong>. Controla tus trámites, atiende a tus prospectos en tu CRM, consulta tus comisiones y haz crecer tu cartera con tu propia página web personalizada.
              </p>

              {/* Botones de Acción */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
                <a
                  href="https://app.movi.digital/login"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl font-bold text-base text-white bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all shadow-xl shadow-blue-600/30 hover:shadow-blue-600/40"
                >
                  <Lock className="w-5 h-5" />
                  <span>Ingresar</span>
                  <ArrowRight className="w-5 h-5" />
                </a>

                <a
                  href="https://agentedeseguros.website/ejemplo"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-4 rounded-2xl font-bold text-sm text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 shadow-sm transition-all"
                >
                  <Globe className="w-4 h-4 text-blue-600" />
                  <span>Ver Página Web de Ejemplo</span>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                </a>
              </div>

              {/* 4 Pilares Rápidos */}
              <div className="pt-8 grid grid-cols-2 sm:grid-cols-4 gap-4 text-left border-t border-slate-200/80">
                <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
                  <p className="text-2xl font-black text-blue-600">100%</p>
                  <p className="text-xs font-bold text-slate-800">Control de Trámites</p>
                  <p className="text-[11px] text-slate-500">Emisión y cotización en línea</p>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
                  <p className="text-2xl font-black text-emerald-600">WhatsApp</p>
                  <p className="text-xs font-bold text-slate-800">Notificaciones en Vivo</p>
                  <p className="text-[11px] text-slate-500">Avisos automáticos a clientes</p>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
                  <p className="text-2xl font-black text-indigo-600">Mi CRM</p>
                  <p className="text-xs font-bold text-slate-800">Cartera Centralizada</p>
                  <p className="text-[11px] text-slate-500">Historial y prospectos 360°</p>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
                  <p className="text-2xl font-black text-cyan-600">Mi Web</p>
                  <p className="text-xs font-bold text-slate-800">Sitio Profesional Propio</p>
                  <p className="text-[11px] text-slate-500">Con cotizadores integrados</p>
                </div>
              </div>

            </div>

            {/* Mockup Interactivo del SaaS MOVI */}
            <div className="mt-14 max-w-5xl mx-auto">
              <div className="rounded-3xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
                
                {/* Header de la ventana */}
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-rose-400" />
                    <span className="w-3 h-3 rounded-full bg-amber-400" />
                    <span className="w-3 h-3 rounded-full bg-emerald-400" />
                    <span className="ml-2 font-mono text-xs font-semibold text-slate-500 bg-white px-3 py-1 rounded-lg border border-slate-200">
                      app.movi.digital · Grupo JIRO
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Oficina Virtual Activa</span>
                  </div>
                </div>

                {/* Selector de Pestañas del Mockup */}
                <div className="flex overflow-x-auto no-scrollbar gap-2 p-3 bg-slate-100/80 border-b border-slate-200 text-xs font-bold">
                  {[
                    { id: 'tramites', label: 'Control de Trámites', icon: FileText },
                    { id: 'crm', label: 'Mi CRM y Prospectos', icon: Users },
                    { id: 'produccion', label: 'Central de Producción', icon: BarChart3 },
                    { id: 'notificaciones', label: 'WhatsApp & Correo', icon: MessageCircle },
                    { id: 'comunicados', label: 'Comunicados JIRO', icon: Megaphone }
                  ].map((tab) => {
                    const IconComp = tab.icon;
                    const isSelected = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl whitespace-nowrap transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200/80'
                        }`}
                      >
                        <IconComp className="w-4 h-4" />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Contenido Dinámico del Mockup */}
                <div className="p-6 sm:p-8 min-h-[380px] bg-white">
                  
                  {activeTab === 'tramites' && (
                    <div className="space-y-4 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-base font-extrabold text-slate-900">Mesa de Control de Trámites</h3>
                          <p className="text-xs text-slate-500">Monitoreo de solicitudes en tiempo real</p>
                        </div>
                        <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold">
                          14 Trámites en Curso
                        </span>
                      </div>

                      <div className="space-y-2.5">
                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 flex items-center justify-between">
                          <div className="space-y-1">
                            <p className="text-sm font-bold text-slate-900">Emisión Auto Cobertura Amplia · Folio #TR-8821</p>
                            <p className="text-xs text-slate-500">Cliente: Mariana Ríos · GNP Seguros · Póliza Anual</p>
                          </div>
                          <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                            Póliza Emitida ✓
                          </span>
                        </div>

                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 flex items-center justify-between">
                          <div className="space-y-1">
                            <p className="text-sm font-bold text-slate-900">Endoso Aumento de Suma Asegurada · Folio #TR-8822</p>
                            <p className="text-xs text-slate-500">Cliente: Constructora del Centro · Quálitas Flotillas</p>
                          </div>
                          <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold">
                            En Revisión Mesa JIRO
                          </span>
                        </div>

                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 flex items-center justify-between">
                          <div className="space-y-1">
                            <p className="text-sm font-bold text-slate-900">Cotización Gastos Médicos Mayores · Folio #TR-8823</p>
                            <p className="text-xs text-slate-500">Cliente: Dr. Esteban Garza · Plan Familiar</p>
                          </div>
                          <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-bold">
                            Cotización Lista
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'crm' && (
                    <div className="space-y-4 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-base font-extrabold text-slate-900">Mi CRM de Asesor</h3>
                          <p className="text-xs text-slate-500">Tus prospectos y clientes organizados en un solo lugar</p>
                        </div>
                        <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-bold">
                          48 Clientes Registrados
                        </span>
                      </div>

                      <div className="grid sm:grid-cols-2 gap-3">
                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-bold text-slate-900">Lic. Roberto Sánchez</p>
                            <span className="px-2.5 py-0.5 rounded-full bg-cyan-100 text-cyan-800 text-[11px] font-bold">Lead Web</span>
                          </div>
                          <p className="text-xs text-slate-500">Cotizó Seguro de Auto desde tu página web personalizada</p>
                          <div className="pt-1 flex items-center gap-2 text-xs font-semibold text-blue-600">
                            <PhoneCall className="w-3.5 h-3.5" /> 55 4920 1823 · WhatsApp Activo
                          </div>
                        </div>

                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-bold text-slate-900">Dra. Claudia Morales</p>
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">Cliente Vigente</span>
                          </div>
                          <p className="text-xs text-slate-500">Póliza GMM Quálitas · Renovación próxima en 28 días</p>
                          <div className="pt-1 flex items-center gap-2 text-xs font-semibold text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Recibo 1/4 Pagado y Validado
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'produccion' && (
                    <div className="space-y-4 animate-in fade-in duration-150">
                      <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-700 text-white space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-blue-100 uppercase tracking-wider">Tus Comisiones Quincenales</p>
                          <span className="px-2.5 py-1 rounded-full bg-white/20 text-xs font-bold">Liquidación Lista</span>
                        </div>
                        <p className="text-3xl font-black">$48,920.00 MXN</p>
                        <p className="text-xs text-blue-100">Dispersión programada con desglose por aseguradora</p>
                      </div>

                      <div className="space-y-2 text-xs">
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                          <span className="font-semibold text-slate-800">GNP Seguros (Emisiones del periodo)</span>
                          <span className="font-bold text-emerald-600 font-mono text-sm">$26,400.00</span>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                          <span className="font-semibold text-slate-800">Quálitas Compañía de Seguros</span>
                          <span className="font-bold text-emerald-600 font-mono text-sm">$14,820.00</span>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                          <span className="font-semibold text-slate-800">Chubb Seguros México</span>
                          <span className="font-bold text-emerald-600 font-mono text-sm">$7,700.00</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'notificaciones' && (
                    <div className="space-y-4 animate-in fade-in duration-150">
                      <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-3">
                        <MessageCircle className="w-6 h-6 text-emerald-600 flex-shrink-0" />
                        <div>
                          <p className="text-xs font-extrabold text-emerald-900">Avisos automáticos sin trabajo manual</p>
                          <p className="text-xs text-emerald-700">Tu cliente recibe alertas por WhatsApp cada vez que su póliza o recibo cambia de estado.</p>
                        </div>
                      </div>

                      <div className="p-5 rounded-2xl bg-slate-900 text-white space-y-3 font-mono text-xs">
                        <div className="flex items-center justify-between text-slate-400 text-[11px]">
                          <span>Mensaje WhatsApp automático enviado a cliente</span>
                          <span>Entregado ✓✓</span>
                        </div>
                        <p className="text-emerald-400 font-sans leading-relaxed text-sm">
                          "Hola <strong>Mariana</strong>, tu asesor <strong>Carlos Méndez (Grupo JIRO)</strong> te informa que tu póliza de auto <strong>GNP #9281-9920</strong> ya fue emitida. Puedes consultarla y descargar tu recibo oficial en tu Seguwallet."
                        </p>
                      </div>
                    </div>
                  )}

                  {activeTab === 'comunicados' && (
                    <div className="space-y-3 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between">
                        <h3 className="text-base font-extrabold text-slate-900">Comunicados y Campañas Grupo JIRO</h3>
                        <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold">Oficial</span>
                      </div>

                      <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-amber-900">Campaña de Autos GNP & Quálitas 2026</span>
                          <span className="text-[11px] text-amber-700 font-semibold">Vigente este mes</span>
                        </div>
                        <p className="text-xs text-slate-700 leading-relaxed">
                          Conoce la tabla de bonos especiales por volumen de pólizas emitidas en el ramo de automóviles para toda la red de agentes de Grupo JIRO.
                        </p>
                      </div>
                    </div>
                  )}

                </div>

                {/* Footer del Mockup */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <span className="text-slate-500 font-medium">Acceso seguro exclusivo para agentes de Grupo JIRO</span>
                  <a
                    href="https://app.movi.digital/login"
                    className="font-extrabold text-blue-600 hover:text-blue-800 flex items-center gap-1.5"
                  >
                    <span>Ingresar</span>
                    <ArrowRight className="w-4 h-4" />
                  </a>
                </div>

              </div>
            </div>

          </div>
        </section>

        {/* ─── 3. SECCIÓN: FUNCIONES CLAVE DE MI OFICINA VIRTUAL ────────────── */}
        <section id="funciones" className="py-20 bg-white border-y border-slate-200/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            
            <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold uppercase tracking-wider">
                Diseñado para el Asesor de Éxito
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                Todo lo que necesitas para operar tu negocio de seguros
              </h2>
              <p className="text-base text-slate-600 leading-relaxed">
                Olvídate de procesos manuales y hojas de cálculo dispersas. MOVI Digital concentra toda la fuerza comercial y operativa en tus manos.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              
              {/* Feature 1 */}
              <div className="p-8 rounded-3xl bg-slate-50 border border-slate-200/90 hover:border-blue-300 hover:shadow-lg transition-all duration-300 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
                  <FileText className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">Control Total de Trámites</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Ingresa y monitorea solicitudes de cotización, emisión, cancelaciones y endosos con asignación directa al equipo de operaciones de Grupo JIRO.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="p-8 rounded-3xl bg-slate-50 border border-slate-200/90 hover:border-emerald-300 hover:shadow-lg transition-all duration-300 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
                  <MessageCircle className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">Notificaciones por WhatsApp y Correo</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Mantén a tus clientes y a ti mismo informados al instante ante cualquier actualización o pago de póliza sin redactar mensajes manualmente.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="p-8 rounded-3xl bg-slate-50 border border-slate-200/90 hover:border-indigo-300 hover:shadow-lg transition-all duration-300 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
                  <Users className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">Mi CRM Integrado</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Historial completo de clientes, fechas de renovación, documentos oficiales y seguimiento oportuno para asegurar renovaciones y ventas cruzadas.
                </p>
              </div>

              {/* Feature 4 */}
              <div className="p-8 rounded-3xl bg-slate-50 border border-slate-200/90 hover:border-cyan-300 hover:shadow-lg transition-all duration-300 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-cyan-600 text-white flex items-center justify-center shadow-md shadow-cyan-500/20">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">Central de Producción</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Consulta de comisiones quincenales, recibos cobrados, estados de cuenta y bonos comerciales con máxima transparencia y exactitud.
                </p>
              </div>

              {/* Feature 5 */}
              <div className="p-8 rounded-3xl bg-slate-50 border border-slate-200/90 hover:border-rose-300 hover:shadow-lg transition-all duration-300 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center shadow-md shadow-rose-500/20">
                  <Globe className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">Tu Propia Página Web</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Un sitio web profesional personalizado con tu nombre, foto, datos de contacto y cotizadores que envían los prospectos directo a tu CRM.
                </p>
              </div>

              {/* Feature 6 */}
              <div className="p-8 rounded-3xl bg-slate-50 border border-slate-200/90 hover:border-amber-300 hover:shadow-lg transition-all duration-300 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
                  <Megaphone className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">Comunicados y Campañas JIRO</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Acceso directo a circulares de aseguradoras, promociones exclusivas, bonos y políticas comerciales emitidas por Grupo JIRO.
                </p>
              </div>

            </div>

          </div>
        </section>

        {/* ─── 4. SECCIÓN: TU PÁGINA WEB PERSONALIZADA (MOCKUP EXACTO) ─────── */}
        <section id="mi-web" className="py-24 bg-[#F8FAFC]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
            
            <div className="text-center max-w-3xl mx-auto space-y-4">
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-blue-100 text-blue-800 text-xs font-extrabold uppercase tracking-wider">
                <Globe className="w-4 h-4 text-blue-600" /> Tu Marca Personal en Internet
              </span>

              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 leading-tight">
                Tu propia Página Web conectada en tiempo real a tu CRM
              </h2>

              <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
                Cada asesor de Grupo JIRO cuenta con su propio sitio web oficial para captar prospectos, generar cotizaciones y recibir alertas directas por WhatsApp.
              </p>

              <div className="pt-2">
                <a
                  href="https://agentedeseguros.website/ejemplo"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md transition-all"
                >
                  <span>Abrir Página Web de Ejemplo en Vivo</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* MOCKUP REAL EXACTO AL DISEÑO ADJUNTO */}
            <div className="max-w-5xl mx-auto rounded-3xl border border-slate-200/90 bg-white shadow-2xl overflow-hidden text-slate-900">
              
              {/* Barra Superior del Navegador Simulado */}
              <div className="bg-slate-100 px-4 py-3 border-b border-slate-200 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-rose-400" />
                  <span className="w-3 h-3 rounded-full bg-amber-400" />
                  <span className="w-3 h-3 rounded-full bg-emerald-400" />
                  <span className="ml-2 font-mono text-slate-600 bg-white px-3 py-1 rounded-md border border-slate-200 truncate">
                    https://agentedeseguros.website/ejemplo
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-bold text-emerald-800 text-[11px]">En Línea</span>
                </div>
              </div>

              {/* Header Interno del Sitio Web del Asesor Demo */}
              <div className="px-6 sm:px-10 py-5 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex flex-col text-left leading-none">
                    <span className="text-sm font-extrabold text-slate-900 tracking-tight">seguros</span>
                    <span className="text-xs font-black text-amber-500">.studio</span>
                  </div>
                </div>

                <div className="hidden sm:flex items-center gap-6 text-xs font-bold text-slate-600">
                  <span className="px-3 py-1 rounded-full bg-slate-800 text-white">Inicio</span>
                  <span className="hover:text-slate-900 cursor-pointer">Aseguradoras</span>
                  <span className="hover:text-slate-900 cursor-pointer">Cotizar</span>
                  <span className="hover:text-slate-900 cursor-pointer">Sobre mi</span>
                  <span className="hover:text-slate-900 cursor-pointer">App</span>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href="https://agentedeseguros.website/ejemplo"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold shadow-xs transition"
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                    <span>WhatsApp</span>
                  </a>
                </div>
              </div>

              {/* Cuerpo del Mockup: 2 Columnas idénticas al screenshot */}
              <div className="p-6 sm:p-10 lg:p-12 grid lg:grid-cols-12 gap-10 items-start relative">
                
                {/* Columna Izquierda: Perfil y Botones de Contacto */}
                <div className="lg:col-span-5 space-y-6 text-left">
                  
                  {/* Logo pequeño superior */}
                  <div className="flex items-center gap-1.5">
                    <div className="flex flex-col text-left leading-none">
                      <span className="text-sm font-extrabold text-slate-900 tracking-tight">seguros</span>
                      <span className="text-xs font-black text-amber-500">.studio</span>
                    </div>
                  </div>

                  {/* Avatar Circular con Borde Multicolor */}
                  <div className="relative inline-block">
                    <div className="w-32 h-32 rounded-full p-1.5 bg-gradient-to-tr from-amber-400 via-emerald-400 to-blue-500 shadow-md">
                      <div className="w-full h-full rounded-full bg-slate-100 overflow-hidden flex items-center justify-center border-2 border-white">
                        <img
                          src={AVATAR_DEMO}
                          alt="Agente Demo"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            // Fallback cartoon avatar representation
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.parentElement!.innerHTML = `
                              <div class="w-full h-full bg-amber-50 flex items-center justify-center text-4xl">
                                👨‍💼
                              </div>
                            `;
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Nombre y Título del Asesor */}
                  <div className="space-y-1">
                    <h3 className="text-3xl font-black text-slate-900 tracking-tight">
                      AGENTE DEMO
                    </h3>
                    <p className="text-sm font-bold text-slate-600">
                      Asesor Personal de Seguros
                    </p>
                  </div>

                  {/* Bio */}
                  <p className="text-sm text-slate-600 leading-relaxed font-normal">
                    Te ayudo a encontrar el seguro perfecto para ti y tu familia. Cotizaciones sin costo, asesoria experta y atencion inmediata.
                  </p>

                  {/* 4 Botones de Acción (Pills) */}
                  <div className="space-y-2.5 pt-2">
                    <div className="grid grid-cols-2 gap-2.5">
                      <button className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-800 text-white font-bold text-xs shadow-xs hover:bg-slate-900 transition">
                        <MessageCircle className="w-4 h-4 text-emerald-400" />
                        <span>Escribir por WhatsApp</span>
                      </button>

                      <button className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-white border border-slate-300 text-slate-800 font-bold text-xs shadow-xs hover:bg-slate-50 transition">
                        <Phone className="w-4 h-4 text-slate-600" />
                        <span>Llamar</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <button className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#E5A823] hover:bg-[#D99A16] text-white font-bold text-xs shadow-xs transition">
                        <Car className="w-4 h-4 text-white" />
                        <span>Multicotizador de Autos</span>
                      </button>

                      <button className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-white border border-slate-300 text-slate-800 font-bold text-xs shadow-xs hover:bg-slate-50 transition">
                        <UserPlus className="w-4 h-4 text-slate-600" />
                        <span>Guardar Contacto</span>
                      </button>
                    </div>
                  </div>

                </div>

                {/* Columna Derecha: Tarjeta de Cotización */}
                <div className="lg:col-span-7">
                  <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xl space-y-6 text-left">
                    
                    <div className="space-y-1 pb-4 border-b border-slate-100">
                      <h4 className="text-2xl font-black text-slate-900 tracking-tight">
                        Solicita tu Cotizacion
                      </h4>
                      <p className="text-xs text-slate-500">
                        Completa el formulario y te contacto de inmediato — sin costo ni compromiso.
                      </p>
                    </div>

                    {demoFormSent ? (
                      <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-3 animate-in fade-in">
                        <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                        <h5 className="text-base font-extrabold text-emerald-900">¡Cotización Enviada al Asesor!</h5>
                        <p className="text-xs text-emerald-700 leading-relaxed">
                          La solicitud entró directamente a <strong>Mi CRM</strong> en MOVI y el agente recibió una alerta inmediata en su WhatsApp.
                        </p>
                        <button
                          onClick={() => setDemoFormSent(false)}
                          className="text-xs font-bold text-blue-600 hover:underline pt-2 cursor-pointer"
                        >
                          Enviar otra cotización de prueba
                        </button>
                      </div>
                    ) : (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          setDemoFormSent(true);
                        }}
                        className="space-y-4"
                      >
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-800">Nombre completo *</label>
                          <input
                            type="text"
                            required
                            placeholder="Tu nombre completo"
                            defaultValue="María Elena Torres"
                            className="w-full text-xs px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-800">Celular *</label>
                          <input
                            type="tel"
                            required
                            placeholder="55 1234 5678"
                            defaultValue="55 4920 1823"
                            className="w-full text-xs px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-800">Correo electronico *</label>
                          <input
                            type="email"
                            required
                            placeholder="tu@email.com"
                            defaultValue="maria.torres@ejemplo.com"
                            className="w-full text-xs px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-800">Seguro de interes *</label>
                          <select
                            value={selectedInsurance}
                            onChange={(e) => setSelectedInsurance(e.target.value)}
                            className="w-full text-xs px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="Seguro de Auto">Seguro de Auto</option>
                            <option value="Gastos Médicos Mayores">Gastos Médicos Mayores</option>
                            <option value="Seguro de Vida & Ahorro">Seguro de Vida & Ahorro</option>
                            <option value="Seguro de Hogar / Casa">Seguro de Hogar / Casa</option>
                            <option value="Seguro de Empresa y Flotillas">Seguro de Empresa y Flotillas</option>
                          </select>
                        </div>

                        <button
                          type="submit"
                          className="w-full py-3.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs shadow-md transition-all active:scale-98 cursor-pointer"
                        >
                          Solicitar Cotizacion Gratuita
                        </button>

                        <p className="text-[11px] text-center text-slate-400">
                          Al enviar, aceptas que te contactemos para ofrecerte informacion sobre seguros.
                        </p>
                      </form>
                    )}

                  </div>
                </div>

                {/* Burbuja flotante de WhatsApp en la esquina inferior derecha */}
                <div className="absolute bottom-6 right-6 hidden sm:flex items-center justify-center w-12 h-12 rounded-full bg-slate-800 text-white shadow-xl cursor-pointer hover:scale-105 transition">
                  <MessageCircle className="w-6 h-6 text-emerald-400" />
                </div>

              </div>

            </div>

          </div>
        </section>

        {/* ─── 5. SECCIÓN: HERRAMIENTAS (SEGUWALLET & EDUCATION CON LOGOS) ─── */}
        <section id="herramientas" className="py-24 bg-white border-y border-slate-200/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            
            <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold uppercase tracking-wider">
                Ecosistema de Soluciones
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                Herramientas Exclusivas para el Asesor de Grupo JIRO
              </h2>
              <p className="text-base text-slate-600 leading-relaxed">
                Potencia tu propuesta de valor ante tus clientes con tecnología móvil y fortalece tus competencias profesionales con formación continua.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              
              {/* Card Seguwallet */}
              <div className="p-8 sm:p-10 rounded-3xl bg-gradient-to-br from-[#06142F] to-[#0A2260] text-white space-y-6 shadow-xl flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <img
                      src={LOGO_SEGUWALLET}
                      alt="Seguwallet"
                      className="h-9 w-auto object-contain brightness-110"
                    />
                    <span className="px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-bold">
                      App para tus Clientes
                    </span>
                  </div>

                  <h3 className="text-2xl font-black text-white">
                    Seguwallet: La Cartera Digital de tus Clientes
                  </h3>

                  <p className="text-sm text-white/80 leading-relaxed">
                    Entrega a tus asegurados una experiencia digital insuperable. Tus clientes consultan sus pólizas, descargan recibos en PDF y reportan siniestros directamente sin recordar contraseñas (acceso OTP por WhatsApp).
                  </p>

                  <div className="space-y-2 text-xs text-white/70">
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-cyan-400" />
                      <span>Todas las aseguradoras reunidas en una sola app móvil (PWA).</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-cyan-400" />
                      <span>Marcación telefónica directa a cabinas de siniestros.</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/10">
                  <a
                    href="https://seguwallet.mx"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm transition-all shadow-md"
                  >
                    <span>Conocer Seguwallet</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>

              {/* Card Seguros Education */}
              <div className="p-8 sm:p-10 rounded-3xl bg-gradient-to-br from-[#1E293B] to-[#0F172A] text-white space-y-6 shadow-xl flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                        <GraduationCap className="w-6 h-6" />
                      </div>
                      <span className="font-black text-lg text-white tracking-tight">Seguros Education</span>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold">
                      Campus Virtual JIRO
                    </span>
                  </div>

                  <h3 className="text-2xl font-black text-white">
                    Seguros Education: Academia y Certificaciones
                  </h3>

                  <p className="text-sm text-white/80 leading-relaxed">
                    Capacitación continua de primer nivel. Cursos on-demand, preparación y simulador de examen para la Cédula A de la CNSF, certificaciones oficiales con aseguradoras y diplomados universitarios con UTEL.
                  </p>

                  <div className="space-y-2 text-xs text-white/70">
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-amber-400" />
                      <span>Contenido normativo obligatorio de la CNSF al día.</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-amber-400" />
                      <span>Talleres prácticos de ventas y suscripción de ramos complejos.</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/10">
                  <a
                    href="https://seguros.education"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs sm:text-sm transition-all shadow-md"
                  >
                    <span>Ir a Seguros Education</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>

            </div>

          </div>
        </section>

        {/* ─── 6. PREGUNTAS FRECUENTES (FAQ) ───────────────────────────────── */}
        <section id="faq" className="py-20 bg-[#F8FAFC]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            
            <div className="text-center max-w-2xl mx-auto space-y-4 mb-14">
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-blue-100 text-blue-800 text-xs font-extrabold uppercase tracking-wider">
                <HelpCircle className="w-4 h-4 text-blue-600" /> Resolvemos tus dudas
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                Preguntas Frecuentes de nuestros Agentes
              </h2>
            </div>

            <div className="space-y-4">
              {[
                {
                  q: '¿Cómo accedo a MOVI Digital / Mi Oficina Virtual?',
                  a: 'Si eres agente activo de Grupo JIRO, tu cuenta ya se encuentra habilitada. Puedes ingresar directamente desde https://app.movi.digital/login con tu correo y contraseña registrados en la promotoría.'
                },
                {
                  q: '¿Tiene algún costo para los asesores de Grupo JIRO?',
                  a: 'No. MOVI Digital, tu página web personalizada, Seguwallet y Seguros Education son beneficios tecnológicos 100% gratuitos y exclusivos para la fuerza de ventas de Grupo JIRO.'
                },
                {
                  q: '¿Cómo obtengo y configuro mi Página Web personalizada?',
                  a: 'Dentro de tu Oficina Virtual en MOVI, ingresa a la sección "Mi Marca" y "Mi Página Web". Podrás elegir tu slug personalizado (ej. agentedeseguros.website/tu-nombre), seleccionar los ramos que ofreces y personalizar tus colores.'
                },
                {
                  q: '¿Cómo recibo las alertas de prospectos y cambios de trámites?',
                  a: 'El sistema está conectado a un Gateway automático de WhatsApp y correo. Cuando un cliente solicita cotización en tu web o cuando un trámite es emitido por Grupo JIRO, recibes una notificación inmediata en tu teléfono móvil.'
                }
              ].map((faq, index) => {
                const isOpen = openFaq === index;
                return (
                  <div
                    key={index}
                    className="rounded-2xl bg-white border border-slate-200/90 overflow-hidden shadow-xs transition-all duration-200"
                  >
                    <button
                      onClick={() => setOpenFaq(isOpen ? null : index)}
                      className="w-full flex items-center justify-between p-6 text-left cursor-pointer hover:bg-slate-50"
                    >
                      <span className="text-base sm:text-lg font-bold text-slate-900 pr-4">
                        {faq.q}
                      </span>
                      <ChevronDown
                        className={`w-5 h-5 text-blue-600 flex-shrink-0 transition-transform duration-200 ${
                          isOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {isOpen && (
                      <div className="px-6 pb-6 text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-4">
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

          </div>
        </section>

        {/* ─── 7. CTA FINAL COMERCIAL ───────────────────────────────────────── */}
        <section className="py-20 bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 text-white relative">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
            
            <div className="w-16 h-16 rounded-3xl bg-white/10 border border-white/20 flex items-center justify-center text-white mx-auto shadow-xl backdrop-blur-md">
              <ShieldCheck className="w-8 h-8" />
            </div>

            <div className="space-y-4 max-w-2xl mx-auto">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black leading-tight">
                Haz crecer tu despacho con la tecnología de Grupo JIRO
              </h2>
              <p className="text-base sm:text-lg text-blue-100">
                Ingresa hoy a tu Oficina Virtual y aprovecha todas las herramientas que tenemos listas para ti.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href="https://app.movi.digital/login"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl font-bold text-base text-blue-700 bg-white hover:bg-blue-50 active:scale-95 transition-all shadow-xl"
              >
                <Lock className="w-5 h-5" />
                <span>Ingresar</span>
                <ArrowRight className="w-5 h-5" />
              </a>
            </div>

          </div>
        </section>

        {/* ─── 8. FOOTER INSTITUCIONAL Y CRÉDITOS ───────────────────────────── */}
        <footer className="border-t border-slate-200 bg-white py-14 text-slate-600">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
            
            <div className="grid md:grid-cols-4 gap-8">
              
              {/* Columna 1: MOVI + Grupo JIRO */}
              <div className="md:col-span-2 space-y-4">
                <div className="flex items-center gap-3">
                  <img src={LOGO_MOVI} alt="MOVI Digital" className="h-8 w-auto object-contain" />
                  <div className="h-5 w-[1px] bg-slate-200" />
                  <a href="https://www.grupojiro.com" target="_blank" rel="noopener noreferrer">
                    <img src={LOGO_JIRO} alt="Grupo JIRO" className="h-6 w-auto object-contain" />
                  </a>
                </div>
                <p className="text-sm text-slate-500 leading-relaxed max-w-md">
                  <strong>MOVI.Digital · Mi Oficina Virtual</strong> es la plataforma de gestión operativa y comercial exclusiva de <strong>Grupo JIRO</strong> para su red nacional de agentes y promotorías de seguros.
                </p>
                <div className="text-xs text-slate-400">
                  <a href="https://www.grupojiro.com" target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 underline">
                    www.grupojiro.com
                  </a>
                </div>
              </div>

              {/* Columna 2: Navegación Rápida */}
              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-900">Módulos</p>
                <ul className="space-y-2 text-sm text-slate-600">
                  <li><button onClick={() => scrollTo('funciones')} className="hover:text-blue-600 transition-colors cursor-pointer">Control de Trámites</button></li>
                  <li><button onClick={() => scrollTo('funciones')} className="hover:text-blue-600 transition-colors cursor-pointer">Mi CRM de Asesor</button></li>
                  <li><button onClick={() => scrollTo('funciones')} className="hover:text-blue-600 transition-colors cursor-pointer">Central de Producción</button></li>
                  <li><button onClick={() => scrollTo('mi-web')} className="hover:text-blue-600 transition-colors cursor-pointer">Mi Página Web</button></li>
                  <li><a href="https://agentedeseguros.website/ejemplo" target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 transition-colors">Página Web de Ejemplo</a></li>
                </ul>
              </div>

              {/* Columna 3: Ecosistema JIRO */}
              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-900">Ecosistema JIRO</p>
                <ul className="space-y-2 text-sm text-slate-600">
                  <li><a href="https://app.movi.digital/login" className="hover:text-blue-600 transition-colors">Ingresar al Portal</a></li>
                  <li><a href="https://seguwallet.mx" target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 transition-colors">Seguwallet</a></li>
                  <li><a href="https://seguros.education" target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 transition-colors">Seguros Education</a></li>
                  <li><a href="https://www.grupojiro.com" target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 transition-colors">Grupo JIRO Corporativo</a></li>
                </ul>
              </div>

            </div>

            {/* Créditos y Copyright */}
            <div className="pt-8 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
              <p>© {new Date().getFullYear()} MOVI Digital · Grupo JIRO. Todos los derechos reservados.</p>
              
              <div className="flex items-center gap-2 text-slate-500">
                <span>Desarrollado por</span>
                <a
                  href="https://mekate.mx"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-slate-800 hover:text-blue-600 transition-colors flex items-center gap-1"
                >
                  <span>Mekate Studio</span>
                  <ExternalLink className="w-3 h-3 text-slate-400" />
                </a>
              </div>
            </div>

          </div>
        </footer>

      </div>
    </>
  );
}
