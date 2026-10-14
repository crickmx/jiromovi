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
  LayoutDashboard
} from 'lucide-react';

// ─── RECURSOS LOCALES Y LOGOS ──────────────────────────────────────────────
const LOGO_MOVI = '/movirecurso_2.png';
const LOGO_JIRO = '/logojiro.png';
const LOGO_SEGUWALLET = '/seguwallet-logo.png';

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
  const [activeTab, setActiveTab] = useState<'tramites' | 'crm' | 'produccion' | 'notificaciones' | 'comunicados'>('tramites');
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

  return (
    <>
      <Helmet>
        <title>MOVI Digital · Mi Oficina Virtual | Grupo JIRO y Asociados</title>
        <meta
          name="description"
          content="MOVI Digital es la plataforma exclusiva de gestión para los agentes y asesores de Grupo JIRO y Asociados. Control de trámites, Mi CRM, Central de Producción, tu propia página web y notificaciones automáticas por WhatsApp."
        />
        <meta
          name="keywords"
          content="MOVI Digital, Mi Oficina Virtual, Grupo JIRO, Grupo JIRO y Asociados, agentes de seguros, CRM para agentes, control de tramites, comisiones seguros, Seguwallet, Seguros Education"
        />
        <link rel="canonical" href="https://movi.digital/" />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content="MOVI Digital · Mi Oficina Virtual | Grupo JIRO y Asociados" />
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
                  className="hidden sm:flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-blue-700 transition-colors"
                >
                  <img
                    src={LOGO_JIRO}
                    alt="Grupo JIRO"
                    className="h-6 sm:h-7 w-auto object-contain"
                  />
                  <span className="hidden xl:inline text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    · Promotoría Oficial
                  </span>
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
                  onClick={() => scrollTo('ecosistema')}
                  className="text-xs xl:text-sm font-bold text-slate-600 hover:text-blue-600 transition-colors cursor-pointer"
                >
                  Seguwallet & Education
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
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-extrabold text-xs sm:text-sm text-white bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all shadow-md shadow-blue-600/25"
                >
                  <Lock className="w-4 h-4" />
                  <span>Ingresar a Mi Oficina Virtual</span>
                  <ArrowRight className="w-4 h-4 ml-0.5" />
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
                  { label: 'Seguwallet & Seguros Education', id: 'ecosistema' },
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
                  <span>Ingresar a Mi Oficina Virtual</span>
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            </div>
          )}
        </header>

        {/* ─── 2. HERO PRINCIPAL: INSTITUCIONAL Y COMERCIAL ─────────────────── */}
        <section
          id="inicio"
          className="relative pt-24 pb-16 lg:pt-36 lg:pb-24 bg-gradient-to-b from-blue-50/60 via-white to-[#F8FAFC] overflow-hidden"
        >
          {/* Acentos de fondo */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-r from-blue-200/40 via-indigo-200/30 to-cyan-200/30 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-4xl mx-auto space-y-6">
              
              {/* Badge Oficial */}
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-100/80 border border-blue-200 text-blue-900 text-xs font-extrabold tracking-wide uppercase shadow-xs">
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
                La herramienta tecnológica todo-en-uno creada exclusivamente para respaldar el éxito de nuestros agentes de seguros. Controla tus trámites, atiende a tus prospectos en tu CRM, consulta tus comisiones y capta más clientes con tu propia página web profesional.
              </p>

              {/* Botones de Acción */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
                <a
                  href="https://app.movi.digital/login"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl font-bold text-base text-white bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all shadow-xl shadow-blue-600/30 hover:shadow-blue-600/40"
                >
                  <Lock className="w-5 h-5" />
                  <span>Ingresar a Mi Oficina Virtual</span>
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

            {/* Mockup Interactivo del SaaS MOVI (Claro / Moderno) */}
            <div className="mt-14 max-w-5xl mx-auto">
              <div className="rounded-3xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
                
                {/* Header de la ventana */}
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-rose-400" />
                    <span className="w-3 h-3 rounded-full bg-amber-400" />
                    <span className="w-3 h-3 rounded-full bg-emerald-400" />
                    <span className="ml-2 font-mono text-xs font-semibold text-slate-500 bg-white px-3 py-1 rounded-lg border border-slate-200">
                      app.movi.digital · Grupo JIRO y Asociados
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
                  <span className="text-slate-500 font-medium">Acceso seguro con usuario y contraseña de Grupo JIRO</span>
                  <a
                    href="https://app.movi.digital/login"
                    className="font-extrabold text-blue-600 hover:text-blue-800 flex items-center gap-1.5"
                  >
                    <span>Entrar ahora</span>
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
                  Acceso directo a circulares de aseguradoras, promociones exclusivas, bonos y políticas comerciales emitidas por la promotoría.
                </p>
              </div>

            </div>

          </div>
        </section>

        {/* ─── 4. SECCIÓN: TU PÁGINA WEB PERSONALIZADA (LINK DE EJEMPLO) ────── */}
        <section id="mi-web" className="py-24 bg-[#F8FAFC]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            
            <div className="grid lg:grid-cols-12 gap-12 items-center">
              
              {/* Copy Informativo */}
              <div className="lg:col-span-6 space-y-6">
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-blue-100 text-blue-800 text-xs font-extrabold uppercase tracking-wider">
                  <Globe className="w-4 h-4 text-blue-600" /> Tu Marca Personal en Internet
                </span>

                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 leading-tight">
                  Tu propia Página Web conectada en tiempo real a tu CRM
                </h2>

                <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
                  Como asesor de Grupo JIRO, cuentas con un sitio web oficial totalmente personalizado. Tus clientes y prospectos pueden conocerte, agendar llamadas y solicitar cotizaciones que entran de forma automática a tu bandeja de prospectos.
                </p>

                <div className="space-y-3 pt-2 text-sm text-slate-700">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                    <span>Personaliza tus colores, logotipo, fotografía y datos de contacto.</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                    <span>Cotizadores de Auto, Gastos Médicos, Vida y Hogar listos para usar.</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                    <span>Recibe alertas al instante por WhatsApp cuando un cliente solicita informes.</span>
                  </div>
                </div>

                <div className="pt-4 flex flex-wrap items-center gap-4">
                  <a
                    href="https://agentedeseguros.website/ejemplo"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-lg shadow-blue-600/25 transition-all"
                  >
                    <span>Ver Web de Ejemplo en Vivo</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>

                  <a
                    href="https://app.movi.digital/login"
                    className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold text-sm transition-all"
                  >
                    <span>Configurar Mi Web en MOVI</span>
                  </a>
                </div>
              </div>

              {/* Vista Previa / Mockup de la Página de Ejemplo */}
              <div className="lg:col-span-6">
                <div className="rounded-3xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
                  
                  {/* Browser Bar */}
                  <div className="bg-slate-100 px-4 py-3 border-b border-slate-200 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-rose-400" />
                      <span className="w-3 h-3 rounded-full bg-amber-400" />
                      <span className="w-3 h-3 rounded-full bg-emerald-400" />
                      <span className="ml-2 font-mono text-slate-600 bg-white px-3 py-1 rounded-md border border-slate-200 truncate">
                        https://agentedeseguros.website/ejemplo
                      </span>
                    </div>
                    <a
                      href="https://agentedeseguros.website/ejemplo"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 font-bold hover:underline flex items-center gap-1 text-[11px]"
                    >
                      <span>Abrir</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  {/* Cuerpo de la Web de Ejemplo */}
                  <div className="p-6 sm:p-8 space-y-6">
                    <div className="flex items-center gap-4 pb-6 border-b border-slate-100">
                      <div className="w-16 h-16 rounded-2xl bg-blue-600 text-white font-black text-xl flex items-center justify-center shadow-md">
                        JD
                      </div>
                      <div className="space-y-1">
                        <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[11px] font-bold">
                          Asesor Certificado · Grupo JIRO
                        </span>
                        <h4 className="text-xl font-black text-slate-900">Agente de Seguros Demo</h4>
                        <p className="text-xs text-slate-500">Especialista en Protección Patrimonial y Seguros de Auto</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Cotizadores integrados que captan clientes:
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-xs font-bold text-slate-700">
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2">
                          <Car className="w-4 h-4 text-blue-600" />
                          <span>Seguro de Auto</span>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2">
                          <HeartPulse className="w-4 h-4 text-emerald-600" />
                          <span>Gastos Médicos</span>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2">
                          <Shield className="w-4 h-4 text-purple-600" />
                          <span>Vida & Ahorro</span>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-amber-600" />
                          <span>Hogar y Negocio</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-between text-xs">
                      <div className="space-y-0.5">
                        <p className="font-extrabold text-blue-950">Tu propio enlace personalizado</p>
                        <p className="text-blue-700">agentedeseguros.website/tu-nombre</p>
                      </div>
                      <a
                        href="https://agentedeseguros.website/ejemplo"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all shadow-xs"
                      >
                        Ver demo →
                      </a>
                    </div>
                  </div>

                </div>
              </div>

            </div>

          </div>
        </section>

        {/* ─── 5. SECCIÓN: SOLUCIONES INTEGRADAS (SEGUWALLET & EDUCATION) ──── */}
        <section id="ecosistema" className="py-24 bg-white border-y border-slate-200/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            
            <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold uppercase tracking-wider">
                Valor Agregado Exclusivo
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                Herramientas complementarias para ti y tus asegurados
              </h2>
              <p className="text-base text-slate-600 leading-relaxed">
                Grupo JIRO pone a tu disposición dos plataformas líderes que potencian la fidelización de tus clientes y tu desarrollo profesional.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              
              {/* Card Seguwallet */}
              <div className="p-8 sm:p-10 rounded-3xl bg-gradient-to-br from-[#06142F] to-[#0A2260] text-white space-y-6 shadow-xl flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <img src={LOGO_SEGUWALLET} alt="Seguwallet" className="h-8 w-auto object-contain brightness-110" />
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
                    <div className="flex items-center gap-2 text-amber-400 font-extrabold text-base">
                      <GraduationCap className="w-6 h-6" />
                      <span>Seguros Education</span>
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
                  a: 'Si eres agente activo de Grupo JIRO y Asociados, tu cuenta ya se encuentra habilitada. Puedes ingresar directamente desde https://app.movi.digital/login con tu correo y contraseña registrados en la promotoría.'
                },
                {
                  q: '¿Tiene algún costo para los asesores de Grupo JIRO?',
                  a: 'No. MOVI Digital, tu página web personalizada, Seguwallet y Seguros Education son beneficios tecnológicos 100% gratuitos y exclusivos para la fuerza de ventas de Grupo JIRO y Asociados.'
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
                <span>Ingresar a Mi Oficina Virtual</span>
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
                  <strong>MOVI.Digital · Mi Oficina Virtual</strong> es la plataforma de gestión operativa y comercial exclusiva de <strong>Grupo JIRO y Asociados</strong> para su red nacional de agentes y promotorías de seguros.
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
                  <li><a href="https://app.movi.digital/login" className="hover:text-blue-600 transition-colors">Mi Oficina Virtual (Login)</a></li>
                  <li><a href="https://seguwallet.mx" target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 transition-colors">Seguwallet</a></li>
                  <li><a href="https://seguros.education" target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 transition-colors">Seguros Education</a></li>
                  <li><a href="https://www.grupojiro.com" target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 transition-colors">Grupo JIRO Corporativo</a></li>
                </ul>
              </div>

            </div>

            {/* Créditos y Copyright */}
            <div className="pt-8 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
              <p>© {new Date().getFullYear()} MOVI Digital · Grupo JIRO y Asociados. Todos los derechos reservados.</p>
              
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
