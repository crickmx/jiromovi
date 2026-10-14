import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  ShieldCheck,
  FileText,
  Lock,
  CheckCircle2,
  ArrowRight,
  ChevronDown,
  Car,
  HeartPulse,
  Building2,
  Menu,
  X,
  ExternalLink,
  MessageCircle,
  Users,
  BarChart3,
  GraduationCap,
  Megaphone,
  Globe,
  HelpCircle,
  UserPlus,
  Phone,
  Sparkles,
  Zap,
  Check
} from 'lucide-react';

// ─── LOGOTIPOS OFICIALES ─────────────────────────────────────────────────────
// Archivos oficiales de marca en /public. NO redibujarlos en SVG ni sustituirlos:
//   /movirecurso_1.png  movi.digital a color (fondo claro)
//   /movirecurso_2.png  movi.digital con texto blanco (fondo oscuro)
//   /movirecurso_7.png  isotipo MOVI
//   /logojiro.png       JIRO y Asociados (fondo claro)

export function MoviOfficialLogo({ className = "h-10 w-auto", fondoOscuro = false }: { className?: string; fondoOscuro?: boolean }) {
  return (
    <img
      src={fondoOscuro ? '/movirecurso_2.png' : '/movirecurso_1.png'}
      alt="movi.digital"
      className={`${className} object-contain`}
    />
  );
}

export function GrupoJiroLogo({ className = "h-8 w-auto" }: { className?: string }) {
  return <img src="/logojiro.png" alt="JIRO y Asociados" className={`${className} object-contain`} />;
}

// ─── RECURSOS DE MARCA ───────────────────────────────────────────────────────
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
          content="MOVI Digital es la plataforma exclusiva de gestión para agentes de seguros de Grupo JIRO. Control de trámites, CRM, comisiones, tu web personalizada y notificaciones."
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
          content="La plataforma digital concisa y de vanguardia para la red de agentes de Grupo JIRO."
        />
        <meta property="og:url" content="https://movi.digital/" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="MOVI Digital · Mi Oficina Virtual | Grupo JIRO" />
        <meta
          name="twitter:description"
          content="Gestión comercial y operativa para agentes de seguros."
        />
      </Helmet>

      {/* Estilos de Animación e Interactividad SaaS */}
      <style>{`
        @keyframes floatSlow {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
        @keyframes shimmerBadge {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .animate-float {
          animation: floatSlow 4s ease-in-out infinite;
        }
        .shimmer-badge {
          background: linear-gradient(90deg, #EFF6FF 0%, #DBEAFE 50%, #EFF6FF 100%);
          background-size: 200% 100%;
          animation: shimmerBadge 3s infinite;
        }
      `}</style>

      <div className="min-h-screen bg-[#F8FAFC] text-slate-900 selection:bg-blue-600 selection:text-white font-sans antialiased overflow-x-hidden">

        {/* ─── 1. NAVBAR SUPERIOR CLARO CON LOGOS OFICIALES ─────────────────── */}
        <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200/80 transition-all duration-200 shadow-xs">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16 sm:h-20">
              
              {/* Logos Oficiales: MOVI Digital + Grupo JIRO */}
              <div className="flex items-center gap-3 sm:gap-4">
                <a
                  href="#inicio"
                  onClick={(e) => { e.preventDefault(); scrollTo('inicio'); }}
                  className="flex items-center group transition-transform duration-200 hover:scale-102"
                >
                  <MoviOfficialLogo className="h-8 sm:h-9 w-auto" />
                </a>
                <div className="h-6 w-[1px] bg-slate-200 hidden sm:block" />
                <a
                  href="https://www.grupojiro.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden sm:flex items-center hover:opacity-80 transition-opacity"
                >
                  <GrupoJiroLogo className="h-8 sm:h-10 w-auto" />
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

              {/* Botón Ingresar */}
              <div className="hidden sm:flex items-center gap-3">
                <a
                  href="https://app.movi.digital/login"
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-extrabold text-xs sm:text-sm text-white bg-blue-600 hover:bg-blue-700 active:scale-95 hover:shadow-lg hover:shadow-blue-600/30 transition-all cursor-pointer"
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
            <div className="lg:hidden border-t border-slate-200 bg-white px-5 py-6 space-y-4 shadow-xl animate-in slide-in-from-top duration-200">
              <div className="space-y-2">
                {[
                  { label: 'Beneficios y Módulos', id: 'funciones' },
                  { label: 'Tu Página Web (Ejemplo en Vivo)', id: 'mi-web' },
                  { label: 'Herramientas', id: 'herramientas' },
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

        {/* ─── 2. HERO PRINCIPAL CONCISO Y MODERNO ─────────────────────────── */}
        <section
          id="inicio"
          className="relative pt-24 pb-16 lg:pt-36 lg:pb-24 bg-gradient-to-b from-blue-50/70 via-white to-[#F8FAFC] overflow-hidden"
        >
          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto space-y-6">
              
              {/* Logo Oficial MOVI Digital en Gran Formato (Sin Texto Duplicado) */}
              <div className="flex justify-center mb-2 animate-float">
                <MoviOfficialLogo className="h-14 sm:h-18 lg:h-22 w-auto drop-shadow-sm hover:scale-102 transition-transform duration-300" />
              </div>

              {/* Badge Oficial */}
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full shimmer-badge border border-blue-200 text-blue-900 text-xs font-extrabold uppercase tracking-wide shadow-xs">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span>Plataforma Digital Exclusiva para Asesores de Grupo JIRO</span>
              </div>

              {/* Subtítulo Conciso y Directo */}
              <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto">
                Controla tus trámites en vivo, atiende prospectos en tu CRM, consulta tus comisiones y haz crecer tu cartera con tu propia página web profesional.
              </p>

              {/* Botones de Acción */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-1">
                <a
                  href="https://app.movi.digital/login"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-2xl font-bold text-sm text-white bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-600/25 hover:-translate-y-0.5"
                >
                  <Lock className="w-4 h-4" />
                  <span>Ingresar</span>
                  <ArrowRight className="w-4 h-4" />
                </a>

                <a
                  href="https://agentedeseguros.website/ejemplo"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-2xl font-bold text-sm text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 shadow-xs transition-all hover:-translate-y-0.5"
                >
                  <Globe className="w-4 h-4 text-blue-600" />
                  <span>Ver Página Web de Ejemplo</span>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                </a>
              </div>

              {/* 4 Métricas Clave */}
              <div className="pt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 text-left border-t border-slate-200/80">
                <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-blue-300 transition-colors">
                  <p className="text-xl font-black text-blue-600">100%</p>
                  <p className="text-xs font-bold text-slate-800">Control de Trámites</p>
                  <p className="text-[11px] text-slate-500">Emisión en línea</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-emerald-300 transition-colors">
                  <p className="text-xl font-black text-emerald-600">WhatsApp</p>
                  <p className="text-xs font-bold text-slate-800">Notificaciones</p>
                  <p className="text-[11px] text-slate-500">Alertas automáticas</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-indigo-300 transition-colors">
                  <p className="text-xl font-black text-indigo-600">Mi CRM</p>
                  <p className="text-xs font-bold text-slate-800">Cartera 360°</p>
                  <p className="text-[11px] text-slate-500">Historial centralizado</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-cyan-300 transition-colors">
                  <p className="text-xl font-black text-cyan-600">Mi Web</p>
                  <p className="text-xs font-bold text-slate-800">Sitio Profesional</p>
                  <p className="text-[11px] text-slate-500">Cotizadores listos</p>
                </div>
              </div>

            </div>

            {/* Mockup Interactivo del SaaS MOVI */}
            <div className="mt-12 max-w-5xl mx-auto">
              <div className="rounded-3xl border border-slate-200 bg-white shadow-xl overflow-hidden">
                
                {/* Header de la ventana */}
                <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    <span className="ml-2 font-mono text-slate-500 bg-white px-2.5 py-0.5 rounded-md border border-slate-200">
                      app.movi.digital · Grupo JIRO
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Oficina Virtual Activa</span>
                  </div>
                </div>

                {/* Selector de Pestañas */}
                <div className="flex overflow-x-auto no-scrollbar gap-1.5 p-2.5 bg-slate-100/80 border-b border-slate-200 text-xs font-bold">
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
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl whitespace-nowrap transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200/80'
                        }`}
                      >
                        <IconComp className="w-3.5 h-3.5" />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Contenido Dinámico */}
                <div className="p-6 min-h-[340px] bg-white">
                  
                  {activeTab === 'tramites' && (
                    <div className="space-y-3 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-extrabold text-slate-900">Mesa de Control de Trámites</span>
                        <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-bold">
                          14 Trámites en Curso
                        </span>
                      </div>

                      <div className="space-y-2">
                        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 flex items-center justify-between">
                          <div className="space-y-0.5 text-left">
                            <p className="text-xs font-bold text-slate-900">Emisión Auto Cobertura Amplia · Folio #TR-8821</p>
                            <p className="text-[11px] text-slate-500">Cliente: Mariana Ríos · GNP Seguros · Póliza Anual</p>
                          </div>
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                            Póliza Emitida ✓
                          </span>
                        </div>

                        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 flex items-center justify-between">
                          <div className="space-y-0.5 text-left">
                            <p className="text-xs font-bold text-slate-900">Endoso Aumento de Suma · Folio #TR-8822</p>
                            <p className="text-[11px] text-slate-500">Cliente: Constructora del Centro · Quálitas Flotillas</p>
                          </div>
                          <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold">
                            En Revisión Mesa JIRO
                          </span>
                        </div>

                        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 flex items-center justify-between">
                          <div className="space-y-0.5 text-left">
                            <p className="text-xs font-bold text-slate-900">Cotización Gastos Médicos · Folio #TR-8823</p>
                            <p className="text-[11px] text-slate-500">Cliente: Dr. Esteban Garza · Plan Familiar</p>
                          </div>
                          <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[11px] font-bold">
                            Cotización Lista
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'crm' && (
                    <div className="space-y-3 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-extrabold text-slate-900">Mi CRM de Asesor</span>
                        <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold">
                          48 Clientes Registrados
                        </span>
                      </div>

                      <div className="grid sm:grid-cols-2 gap-3 text-left">
                        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-bold text-slate-900">Lic. Roberto Sánchez</p>
                            <span className="px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-800 text-[10px] font-bold">Lead Web</span>
                          </div>
                          <p className="text-[11px] text-slate-500">Cotizó Seguro de Auto desde tu web</p>
                          <p className="text-[11px] font-semibold text-blue-600">55 4920 1823 · WhatsApp Activo</p>
                        </div>

                        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-bold text-slate-900">Dra. Claudia Morales</p>
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">Cliente Vigente</span>
                          </div>
                          <p className="text-[11px] text-slate-500">Póliza GMM Quálitas · Renovación en 28 días</p>
                          <p className="text-[11px] font-semibold text-emerald-700">Recibo 1/4 Validado ✓</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'produccion' && (
                    <div className="space-y-3 animate-in fade-in duration-150 text-left">
                      <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-700 text-white space-y-1">
                        <p className="text-[11px] text-blue-100 font-semibold uppercase tracking-wider">Comisiones Quincenales</p>
                        <p className="text-2xl font-black">$48,920.00 MXN</p>
                        <p className="text-[11px] text-blue-100">Dispersión programada por aseguradora</p>
                      </div>

                      <div className="space-y-1.5 text-xs">
                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                          <span>GNP Seguros (Emisiones)</span>
                          <span className="font-bold text-emerald-600 font-mono">$26,400.00</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                          <span>Quálitas Compañía de Seguros</span>
                          <span className="font-bold text-emerald-600 font-mono">$14,820.00</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'notificaciones' && (
                    <div className="space-y-3 animate-in fade-in duration-150 text-left">
                      <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-3">
                        <MessageCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                        <div>
                          <p className="text-xs font-bold text-emerald-900">Avisos automáticos sin trabajo manual</p>
                          <p className="text-[11px] text-emerald-700">Alertas por WhatsApp al cambiar el estado de la póliza.</p>
                        </div>
                      </div>

                      <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-2 font-mono text-xs">
                        <p className="text-[10px] text-slate-400">WhatsApp enviado automáticamente:</p>
                        <p className="text-emerald-400 font-sans leading-relaxed text-xs">
                          "Hola <strong>Mariana</strong>, tu asesor <strong>Carlos Méndez (Grupo JIRO)</strong> te informa que tu póliza de auto <strong>GNP #9281-9920</strong> ya fue emitida. Puedes descargar tu recibo en Seguwallet."
                        </p>
                      </div>
                    </div>
                  )}

                  {activeTab === 'comunicados' && (
                    <div className="space-y-3 animate-in fade-in duration-150 text-left">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-extrabold text-slate-900">Comunicados y Campañas Grupo JIRO</span>
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px]">Oficial</span>
                      </div>

                      <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-1">
                        <p className="text-xs font-bold text-amber-900">Campaña de Autos GNP & Quálitas 2026</p>
                        <p className="text-[11px] text-slate-700 leading-relaxed">
                          Conoce la tabla de bonos especiales por volumen de pólizas emitidas para toda la red de agentes de Grupo JIRO.
                        </p>
                      </div>
                    </div>
                  )}

                </div>

                {/* Footer del Mockup */}
                <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <span className="text-slate-500">Acceso exclusivo para agentes de Grupo JIRO</span>
                  <a
                    href="https://app.movi.digital/login"
                    className="font-extrabold text-blue-600 hover:text-blue-800 flex items-center gap-1.5"
                  >
                    <span>Ingresar</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                </div>

              </div>
            </div>

          </div>
        </section>

        {/* ─── 3. FUNCIONES CLAVE CONCISAS ─────────────────────────────────── */}
        <section id="funciones" className="py-20 bg-white border-y border-slate-200/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            
            <div className="text-center max-w-3xl mx-auto space-y-3 mb-14">
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold uppercase tracking-wider">
                Diseñado para el Asesor de Éxito
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                Módulos de Gestión de Grupo JIRO
              </h2>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                Toda la fuerza comercial y operativa concentrada en tu oficina virtual.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              
              <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200/90 hover:border-blue-300 hover:shadow-lg transition-all space-y-3 text-left">
                <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md">
                  <FileText className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Control de Trámites</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Monitorea cotizaciones, emisiones, cancelaciones y endosos con asignación directa al equipo de operaciones de Grupo JIRO.
                </p>
              </div>

              <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200/90 hover:border-emerald-300 hover:shadow-lg transition-all space-y-3 text-left">
                <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Notificaciones en Vivo</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Avisos automáticos por WhatsApp y correo a tus clientes cuando su póliza o recibo cambia de estado.
                </p>
              </div>

              <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200/90 hover:border-indigo-300 hover:shadow-lg transition-all space-y-3 text-left">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
                  <Users className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Mi CRM Integrado</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Historial de prospectos, clientes y vigencias para asegurar renovaciones y ventas cruzadas.
                </p>
              </div>

              <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200/90 hover:border-cyan-300 hover:shadow-lg transition-all space-y-3 text-left">
                <div className="w-10 h-10 rounded-2xl bg-cyan-600 text-white flex items-center justify-center shadow-md">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Central de Producción</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Consulta tus comisiones quincenales, recibos cobrados y bonos con total claridad y exactitud.
                </p>
              </div>

              <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200/90 hover:border-rose-300 hover:shadow-lg transition-all space-y-3 text-left">
                <div className="w-10 h-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center shadow-md">
                  <Globe className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Tu Propia Página Web</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Sitio web profesional con tu nombre y cotizadores integrados que envían los leads directo a tu CRM.
                </p>
              </div>

              <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200/90 hover:border-amber-300 hover:shadow-lg transition-all space-y-3 text-left">
                <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md">
                  <Megaphone className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Comunicados JIRO</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Circulares oficiales, incentivos y campañas comerciales emitidas directamente por Grupo JIRO.
                </p>
              </div>

            </div>

          </div>
        </section>

        {/* ─── 4. SECCIÓN: TU PÁGINA WEB PERSONALIZADA (MOCKUP REAL) ───────── */}
        <section id="mi-web" className="py-20 bg-[#F8FAFC]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
            
            <div className="text-center max-w-3xl mx-auto space-y-3">
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-blue-100 text-blue-800 text-xs font-extrabold uppercase tracking-wider">
                <Globe className="w-4 h-4 text-blue-600" /> Presencia Digital
              </span>

              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                Tu Página Web Conectada al CRM
              </h2>

              <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                Cada asesor de Grupo JIRO cuenta con su propio sitio web oficial para captar prospectos y cotizar seguros.
              </p>

              <div className="pt-1">
                <a
                  href="https://agentedeseguros.website/ejemplo"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-all"
                >
                  <span>Abrir Página Web de Ejemplo</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* MOCKUP REAL DE AGENTE DEMO */}
            <div className="max-w-5xl mx-auto rounded-3xl border border-slate-200/90 bg-white shadow-xl overflow-hidden text-slate-900">
              
              {/* Browser Bar */}
              <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  <span className="ml-2 font-mono text-slate-600 bg-white px-2.5 py-0.5 rounded-md border border-slate-200 truncate">
                    https://agentedeseguros.website/ejemplo
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-[11px]">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>En Línea</span>
                </div>
              </div>

              {/* Header Interno del Sitio Web del Asesor */}
              <div className="px-6 sm:px-10 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="flex flex-col text-left leading-none">
                    <span className="text-sm font-extrabold text-slate-900 tracking-tight">seguros</span>
                    <span className="text-xs font-black text-amber-500">.studio</span>
                  </div>
                </div>

                <div className="hidden sm:flex items-center gap-5 text-xs font-bold text-slate-600">
                  <span className="px-3 py-1 rounded-full bg-slate-800 text-white">Inicio</span>
                  <span className="hover:text-slate-900 cursor-pointer">Aseguradoras</span>
                  <span className="hover:text-slate-900 cursor-pointer">Cotizar</span>
                  <span className="hover:text-slate-900 cursor-pointer">Sobre mi</span>
                  <span className="hover:text-slate-900 cursor-pointer">App</span>
                </div>

                <div>
                  <a
                    href="https://agentedeseguros.website/ejemplo"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold shadow-xs transition"
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                    <span>WhatsApp</span>
                  </a>
                </div>
              </div>

              {/* Cuerpo del Mockup */}
              <div className="p-6 sm:p-10 grid lg:grid-cols-12 gap-8 items-start relative">
                
                {/* Columna Izquierda: Perfil y Botones */}
                <div className="lg:col-span-5 space-y-5 text-left">
                  
                  <div className="relative inline-block">
                    <div className="w-28 h-28 rounded-full p-1 bg-gradient-to-tr from-amber-400 via-emerald-400 to-blue-500 shadow-md">
                      <div className="w-full h-full rounded-full bg-slate-100 overflow-hidden flex items-center justify-center border-2 border-white">
                        <img
                          src={AVATAR_DEMO}
                          alt="Agente Demo"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.parentElement!.innerHTML = `
                              <div class="w-full h-full bg-amber-50 flex items-center justify-center text-3xl">
                                👨‍💼
                              </div>
                            `;
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-0.5">
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                      AGENTE DEMO
                    </h3>
                    <p className="text-xs font-bold text-slate-600">
                      Asesor Personal de Seguros
                    </p>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    Te ayudo a encontrar el seguro perfecto para ti y tu familia. Cotizaciones sin costo, asesoria experta y atencion inmediata.
                  </p>

                  {/* 4 Botones de Acción */}
                  <div className="space-y-2 pt-1">
                    <div className="grid grid-cols-2 gap-2">
                      <button className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-800 text-white font-bold text-xs shadow-xs hover:bg-slate-900 transition">
                        <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Escribir WhatsApp</span>
                      </button>

                      <button className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-white border border-slate-300 text-slate-800 font-bold text-xs shadow-xs hover:bg-slate-50 transition">
                        <Phone className="w-3.5 h-3.5 text-slate-600" />
                        <span>Llamar</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-[#E5A823] text-white font-bold text-xs shadow-xs hover:bg-[#D99A16] transition">
                        <Car className="w-3.5 h-3.5 text-white" />
                        <span>Multicotizador</span>
                      </button>

                      <button className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-white border border-slate-300 text-slate-800 font-bold text-xs shadow-xs hover:bg-slate-50 transition">
                        <UserPlus className="w-3.5 h-3.5 text-slate-600" />
                        <span>Guardar Contacto</span>
                      </button>
                    </div>
                  </div>

                </div>

                {/* Columna Derecha: Tarjeta de Cotización */}
                <div className="lg:col-span-7">
                  <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-7 shadow-lg space-y-4 text-left">
                    
                    <div className="space-y-0.5 pb-3 border-b border-slate-100">
                      <h4 className="text-xl font-black text-slate-900 tracking-tight">
                        Solicita tu Cotizacion
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Completa el formulario y te contacto de inmediato — sin costo ni compromiso.
                      </p>
                    </div>

                    {demoFormSent ? (
                      <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-2 animate-in fade-in">
                        <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                        <h5 className="text-sm font-extrabold text-emerald-900">¡Cotización Enviada al Asesor!</h5>
                        <p className="text-xs text-emerald-700">
                          La solicitud entró a <strong>Mi CRM</strong> y el agente recibió una alerta en WhatsApp.
                        </p>
                        <button
                          onClick={() => setDemoFormSent(false)}
                          className="text-xs font-bold text-blue-600 hover:underline pt-1 cursor-pointer"
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
                        className="space-y-3"
                      >
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-800">Nombre completo *</label>
                          <input
                            type="text"
                            required
                            placeholder="Tu nombre completo"
                            defaultValue="María Elena Torres"
                            className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-800">Celular *</label>
                          <input
                            type="tel"
                            required
                            placeholder="55 1234 5678"
                            defaultValue="55 4920 1823"
                            className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-800">Correo electronico *</label>
                          <input
                            type="email"
                            required
                            placeholder="tu@email.com"
                            defaultValue="maria.torres@ejemplo.com"
                            className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-800">Seguro de interes *</label>
                          <select
                            value={selectedInsurance}
                            onChange={(e) => setSelectedInsurance(e.target.value)}
                            className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="Seguro de Auto">Seguro de Auto</option>
                            <option value="Gastos Médicos Mayores">Gastos Médicos Mayores</option>
                            <option value="Seguro de Vida & Ahorro">Seguro de Vida & Ahorro</option>
                            <option value="Seguro de Hogar / Casa">Seguro de Hogar / Casa</option>
                          </select>
                        </div>

                        <button
                          type="submit"
                          className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-900 active:scale-98 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
                        >
                          Solicitar Cotizacion Gratuita
                        </button>

                        <p className="text-[10px] text-center text-slate-400">
                          Al enviar, aceptas que te contactemos para ofrecerte informacion sobre seguros.
                        </p>
                      </form>
                    )}

                  </div>
                </div>

                {/* Burbuja flotante de WhatsApp */}
                <div className="absolute bottom-5 right-5 hidden sm:flex items-center justify-center w-11 h-11 rounded-full bg-slate-800 text-white shadow-xl cursor-pointer hover:scale-110 transition-transform">
                  <MessageCircle className="w-5 h-5 text-emerald-400" />
                </div>

              </div>

            </div>

          </div>
        </section>

        {/* ─── 5. HERRAMIENTAS (SEGUWALLET & EDUCATION CON LOGOS) ───────────── */}
        <section id="herramientas" className="py-20 bg-white border-y border-slate-200/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            
            <div className="text-center max-w-3xl mx-auto space-y-3 mb-14">
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold uppercase tracking-wider">
                Ecosistema de Soluciones
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                Herramientas Exclusivas para el Asesor
              </h2>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                Tecnología móvil para tus clientes y formación continua para tu desarrollo profesional.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              
              {/* Card Seguwallet */}
              <div className="p-7 sm:p-8 rounded-3xl bg-gradient-to-br from-[#06142F] to-[#0A2260] text-white space-y-5 shadow-lg flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <img
                      src={LOGO_SEGUWALLET}
                      alt="Seguwallet"
                      className="h-8 w-auto object-contain brightness-110"
                    />
                    <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-bold">
                      App para Clientes
                    </span>
                  </div>

                  <h3 className="text-xl font-black text-white">
                    Seguwallet: La Cartera Digital de tus Clientes
                  </h3>

                  <p className="text-xs sm:text-sm text-white/80 leading-relaxed">
                    Tus clientes consultan pólizas, descargan recibos en PDF y reportan siniestros directamente sin contraseñas (acceso OTP por WhatsApp).
                  </p>
                </div>

                <div className="pt-3 border-t border-white/10">
                  <a
                    href="https://seguwallet.mx"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-all shadow-md active:scale-95"
                  >
                    <span>Conocer Seguwallet</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              {/* Card Seguros Education */}
              <div className="p-7 sm:p-8 rounded-3xl bg-gradient-to-br from-[#1E293B] to-[#0F172A] text-white space-y-5 shadow-lg flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GraduationCap className="w-6 h-6 text-amber-400" />
                      <span className="font-black text-base text-white">Seguros Education</span>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold">
                      Campus Virtual JIRO
                    </span>
                  </div>

                  <h3 className="text-xl font-black text-white">
                    Seguros Education: Academia y Certificaciones
                  </h3>

                  <p className="text-xs sm:text-sm text-white/80 leading-relaxed">
                    Cursos on-demand, simulador de examen para la Cédula A de la CNSF, certificaciones con aseguradoras y diplomados universitarios con UTEL.
                  </p>
                </div>

                <div className="pt-3 border-t border-white/10">
                  <a
                    href="https://seguros.education"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs transition-all shadow-md active:scale-95"
                  >
                    <span>Ir a Seguros Education</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

            </div>

          </div>
        </section>

        {/* ─── 6. PREGUNTAS FRECUENTES (FAQ) ───────────────────────────────── */}
        <section id="faq" className="py-20 bg-[#F8FAFC]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            
            <div className="text-center max-w-2xl mx-auto space-y-3 mb-12">
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-blue-100 text-blue-800 text-xs font-extrabold uppercase tracking-wider">
                <HelpCircle className="w-4 h-4 text-blue-600" /> Dudas Comunes
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                Preguntas Frecuentes
              </h2>
            </div>

            <div className="space-y-3.5">
              {[
                {
                  q: '¿Cómo accedo a MOVI Digital / Mi Oficina Virtual?',
                  a: 'Si eres agente activo de Grupo JIRO, tu cuenta ya se encuentra habilitada. Puedes ingresar directamente desde https://app.movi.digital/login con tu correo y contraseña registrados.'
                },
                {
                  q: '¿Tiene algún costo para los asesores de Grupo JIRO?',
                  a: 'No. MOVI Digital, tu página web personalizada, Seguwallet y Seguros Education son beneficios tecnológicos 100% gratuitos y exclusivos para la fuerza de ventas de Grupo JIRO.'
                },
                {
                  q: '¿Cómo obtengo y configuro mi Página Web personalizada?',
                  a: 'Dentro de tu Oficina Virtual en MOVI, ingresa a "Mi Marca" y "Mi Página Web". Podrás elegir tu slug personalizado (ej. agentedeseguros.website/tu-nombre) y seleccionar tus ramos.'
                },
                {
                  q: '¿Cómo recibo las alertas de prospectos y cambios de trámites?',
                  a: 'El sistema está conectado a un Gateway automático de WhatsApp y correo. Cuando un cliente cotiza en tu web o cuando un trámite es emitido, recibes una notificación inmediata.'
                }
              ].map((faq, index) => {
                const isOpen = openFaq === index;
                return (
                  <div
                    key={index}
                    className="rounded-2xl bg-white border border-slate-200/90 overflow-hidden shadow-xs hover:border-blue-300 transition-colors"
                  >
                    <button
                      onClick={() => setOpenFaq(isOpen ? null : index)}
                      className="w-full flex items-center justify-between p-5 text-left cursor-pointer hover:bg-slate-50 transition-colors"
                    >
                      <span className="text-sm sm:text-base font-bold text-slate-900 pr-4">
                        {faq.q}
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 text-blue-600 flex-shrink-0 transition-transform duration-200 ${
                          isOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {isOpen && (
                      <div className="px-5 pb-5 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
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
        <section className="py-16 bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 text-white relative">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
            
            <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white mx-auto shadow-xl">
              <ShieldCheck className="w-7 h-7" />
            </div>

            <div className="space-y-2 max-w-xl mx-auto">
              <h2 className="text-2xl sm:text-3xl font-black leading-tight">
                Haz crecer tu despacho con la tecnología de Grupo JIRO
              </h2>
              <p className="text-sm text-blue-100">
                Ingresa hoy a tu Oficina Virtual y aprovecha todas las herramientas disponibles.
              </p>
            </div>

            <div>
              <a
                href="https://app.movi.digital/login"
                className="inline-flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-2xl font-bold text-sm text-blue-700 bg-white hover:bg-blue-50 active:scale-95 transition-all shadow-xl hover:-translate-y-0.5"
              >
                <Lock className="w-4 h-4" />
                <span>Ingresar</span>
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>

          </div>
        </section>

        {/* ─── 8. FOOTER INSTITUCIONAL Y CRÉDITOS ───────────────────────────── */}
        <footer className="border-t border-slate-200 bg-white py-12 text-slate-600">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
            
            <div className="grid md:grid-cols-4 gap-8">
              
              {/* Columna 1: Logos MOVI Digital + Grupo JIRO */}
              <div className="md:col-span-2 space-y-3 text-left">
                <div className="flex items-center gap-3">
                  <MoviOfficialLogo className="h-8 w-auto" />
                  <div className="h-5 w-[1px] bg-slate-200" />
                  <a href="https://www.grupojiro.com" target="_blank" rel="noopener noreferrer">
                    <GrupoJiroLogo className="h-9 w-auto" />
                  </a>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed max-w-sm">
                  <strong>MOVI.Digital · Mi Oficina Virtual</strong> es la plataforma de gestión operativa y comercial exclusiva de <strong>Grupo JIRO</strong> para su red de agentes de seguros.
                </p>
                <div className="text-xs">
                  <a href="https://www.grupojiro.com" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-blue-600 underline">
                    www.grupojiro.com
                  </a>
                </div>
              </div>

              {/* Columna 2: Módulos */}
              <div className="space-y-2 text-left">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-900">Módulos</p>
                <ul className="space-y-1.5 text-xs text-slate-600">
                  <li><button onClick={() => scrollTo('funciones')} className="hover:text-blue-600 transition-colors cursor-pointer">Control de Trámites</button></li>
                  <li><button onClick={() => scrollTo('funciones')} className="hover:text-blue-600 transition-colors cursor-pointer">Mi CRM de Asesor</button></li>
                  <li><button onClick={() => scrollTo('funciones')} className="hover:text-blue-600 transition-colors cursor-pointer">Central de Producción</button></li>
                  <li><button onClick={() => scrollTo('mi-web')} className="hover:text-blue-600 transition-colors cursor-pointer">Mi Página Web</button></li>
                </ul>
              </div>

              {/* Columna 3: Ecosistema JIRO */}
              <div className="space-y-2 text-left">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-900">Ecosistema</p>
                <ul className="space-y-1.5 text-xs text-slate-600">
                  <li><a href="https://app.movi.digital/login" className="hover:text-blue-600 transition-colors">Ingresar al Portal</a></li>
                  <li><a href="https://seguwallet.mx" target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 transition-colors">Seguwallet</a></li>
                  <li><a href="https://seguros.education" target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 transition-colors">Seguros Education</a></li>
                  <li><a href="https://www.grupojiro.com" target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 transition-colors">Grupo JIRO</a></li>
                </ul>
              </div>

            </div>

            {/* Copyright y Créditos de Mekate Studio */}
            <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
              <p>© {new Date().getFullYear()} MOVI Digital · Grupo JIRO. Todos los derechos reservados.</p>
              
              <div className="flex items-center gap-1.5 text-slate-500">
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
