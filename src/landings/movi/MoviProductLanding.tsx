import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import '@fontsource-variable/inter/index.css';
import {
  ShieldCheck,
  FileText,
  Lock,
  CheckCircle2,
  ArrowRight,
  ChevronDown,
  Car,
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
} from 'lucide-react';
import {
  EASE,
  SURFACE,
  FOCUS,
  Reveal,
  RevealItem,
  Float,
  SpotlightCard,
  CountUp,
  TiltFrame,
  Parallax,
  DecoArea,
  DecoBars,
  DecoSpark,
  DecoWaves,
} from './landingMotion';

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
const AVATAR_DEMO = '/display-avatar.png';

// ─── SISTEMA VISUAL (light premium) ─────────────────────────────────────────
// Primario MOVI como único acento (blue-600). Superficies blancas, bordes finos,
// radios 16px en cards y 10px en botones, iconos Lucide con stroke 1.5.
const FONT = "'Inter Variable', 'Inter', ui-sans-serif, system-ui, sans-serif";
const ICON = { strokeWidth: 1.5 };
const BTN_PRIMARIO = `relative overflow-hidden inline-flex items-center justify-center gap-2 rounded-[10px] bg-blue-600 text-white font-semibold shadow-[0_1px_2px_rgba(15,23,42,0.08),0_8px_20px_-6px_rgba(37,99,235,0.45)] hover:bg-blue-700 transition-colors duration-300 ${FOCUS}`;
const BTN_SECUNDARIO = `inline-flex items-center justify-center gap-2 rounded-[10px] bg-white text-slate-800 font-semibold border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.05)] hover:border-slate-300 hover:bg-slate-50 transition-colors duration-300 ${FOCUS}`;
const EYEBROW = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs font-semibold uppercase tracking-[0.08em]';
const H2 = 'text-balance text-[32px] sm:text-[44px] lg:text-5xl font-semibold text-slate-900 tracking-[-0.03em] leading-[1.08]';
const LEAD = 'text-lg sm:text-xl text-slate-600 leading-relaxed';
const DOTS = { backgroundImage: 'radial-gradient(rgba(15,23,42,0.03) 1px, transparent 1px)', backgroundSize: '16px 16px' };

/** Botón/enlace con scale 0.98 al presionar. */
function Press({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.span className="inline-flex w-full sm:w-auto" whileTap={reduce ? undefined : { scale: 0.98 }} transition={{ duration: 0.25, ease: EASE }}>
      {children}
    </motion.span>
  );
}

/** Brillo sutil que recorre el CTA principal. */
function Shimmer() {
  const reduce = useReducedMotion();
  if (reduce) return null;
  return (
    <motion.span
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-white/25 to-transparent skew-x-[-20deg]"
      animate={{ x: ['0%', '400%'] }}
      transition={{ duration: 2.6, ease: 'easeInOut', repeat: Infinity, repeatDelay: 2.4 }}
    />
  );
}

/** Marco de navegador para los mockups. */
function BrowserBar({ url, status }: { url: string; status: string }) {
  return (
    <div className="px-4 sm:px-5 py-3 bg-slate-50/80 border-b border-slate-200/60 flex flex-wrap items-center justify-between gap-3 text-xs">
      <div className="flex items-center gap-2 min-w-0">
        <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
        <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
        <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
        <span className="ml-2 font-mono text-slate-500 bg-white px-2.5 py-0.5 rounded-md border border-slate-200/60 truncate">
          {url}
        </span>
      </div>
      <div className="flex items-center gap-1.5 font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/70">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <span>{status}</span>
      </div>
    </div>
  );
}

export default function MoviProductLanding() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'tramites' | 'crm' | 'produccion' | 'notificaciones' | 'comunicados'>('tramites');
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [compact, setCompact] = useState(false);
  const reduce = useReducedMotion();

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

  // Navbar que se compacta al hacer scroll.
  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMobileMenuOpen(false);
  };

  const panel = {
    initial: reduce ? false : { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: reduce ? undefined : { opacity: 0, y: -8 },
    transition: { duration: 0.25, ease: EASE },
  } as const;

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

      {/* El CSS global le pone la fuente de display a h1–h6; en esta página todo es Inter. */}
      <style>{`.movi-landing h1, .movi-landing h2, .movi-landing h3, .movi-landing h4, .movi-landing h5 { font-family: inherit; }`}</style>

      <div
        className="movi-landing min-h-screen bg-[#FAFBFC] text-slate-900 selection:bg-blue-600 selection:text-white antialiased overflow-x-hidden"
        style={{ fontFamily: FONT }}
      >

        {/* ─── 1. NAVBAR STICKY CON BLUR ─────────────────────────────────── */}
        <header
          className={`fixed top-0 left-0 right-0 z-50 border-b transition-[background-color,border-color,box-shadow] duration-300 backdrop-blur-xl ${
            compact
              ? 'bg-white/70 border-slate-200/60 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.10)]'
              : 'bg-white/70 border-transparent'
          }`}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className={`flex items-center justify-between transition-[height] duration-300 ${compact ? 'h-16' : 'h-16 sm:h-20'}`}>

              {/* Logos Oficiales: MOVI Digital + Grupo JIRO */}
              <div className="flex items-center gap-3 sm:gap-4">
                <a
                  href="#inicio"
                  onClick={(e) => { e.preventDefault(); scrollTo('inicio'); }}
                  className={`flex items-center rounded-lg ${FOCUS}`}
                >
                  <MoviOfficialLogo className={`w-auto transition-[height] duration-300 ${compact ? 'h-8' : 'h-8 sm:h-9'}`} />
                </a>
                <div className="h-6 w-px bg-slate-200 hidden sm:block" />
                <a
                  href="https://www.grupojiro.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`hidden sm:flex items-center rounded-lg hover:opacity-80 transition-opacity ${FOCUS}`}
                >
                  <GrupoJiroLogo className={`w-auto transition-[height] duration-300 ${compact ? 'h-8' : 'h-8 sm:h-10'}`} />
                </a>
              </div>

              {/* Menú de Navegación */}
              <nav className="hidden lg:flex items-center gap-1">
                {[
                  { label: 'Beneficios y Módulos', id: 'funciones' },
                  { label: 'Tu Página Web', id: 'mi-web' },
                  { label: 'Herramientas', id: 'herramientas' },
                  { label: 'Preguntas Frecuentes', id: 'faq' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => scrollTo(item.id)}
                    className={`px-3.5 py-2 rounded-[10px] text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 transition-colors cursor-pointer ${FOCUS}`}
                  >
                    {item.label}
                  </button>
                ))}
              </nav>

              {/* Botón Ingresar */}
              <div className="hidden sm:flex items-center gap-3">
                <Press>
                  <a href="https://app.movi.digital/login" className={`${BTN_PRIMARIO} px-5 py-2.5 text-sm`}>
                    <Lock className="w-4 h-4" {...ICON} />
                    <span>Ingresar</span>
                  </a>
                </Press>
              </div>

              {/* Mobile toggle */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className={`lg:hidden p-2 rounded-[10px] text-slate-700 hover:bg-slate-100 transition-colors ${FOCUS}`}
                aria-label="Abrir menú"
                aria-expanded={mobileMenuOpen}
              >
                {mobileMenuOpen ? <X className="w-6 h-6" {...ICON} /> : <Menu className="w-6 h-6" {...ICON} />}
              </button>

            </div>
          </div>

          {/* Menú móvil */}
          <AnimatePresence>
            {mobileMenuOpen && (
              <motion.div
                initial={reduce ? false : { opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0, y: -8 }}
                transition={{ duration: 0.25, ease: EASE }}
                className="lg:hidden border-t border-slate-200/60 bg-white/95 backdrop-blur-xl px-5 py-6 space-y-4 shadow-[0_16px_40px_-12px_rgba(15,23,42,0.15)]"
              >
                <div className="space-y-1">
                  {[
                    { label: 'Beneficios y Módulos', id: 'funciones' },
                    { label: 'Tu Página Web (Ejemplo en Vivo)', id: 'mi-web' },
                    { label: 'Herramientas', id: 'herramientas' },
                    { label: 'Preguntas Frecuentes', id: 'faq' }
                  ].map((item) => (
                    <button
                      key={item.id}
                      onClick={() => scrollTo(item.id)}
                      className={`block w-full text-left px-4 py-3 text-base font-medium text-slate-700 hover:bg-slate-50 hover:text-blue-600 rounded-[10px] transition-colors ${FOCUS}`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <div className="pt-4 border-t border-slate-100 space-y-3">
                  <a
                    href="https://app.movi.digital/login"
                    className={`${BTN_PRIMARIO} w-full px-5 py-3.5 text-sm`}
                  >
                    <Lock className="w-4 h-4" {...ICON} />
                    <span>Ingresar</span>
                  </a>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </header>

        {/* ─── 2. HERO ──────────────────────────────────────────────────── */}
        <section id="inicio" className="relative pt-28 pb-24 sm:pt-36 lg:pt-44 lg:pb-36 overflow-hidden">
          {/* Glow radial del primario + retícula de puntos al 3% */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={DOTS} />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 w-[1100px] h-[700px] rounded-full"
            style={{ background: 'radial-gradient(closest-side, rgba(37,99,235,0.13), rgba(37,99,235,0.04) 55%, transparent)' }}
          />
          <Parallax className="pointer-events-none absolute -left-40 top-24 hidden md:block" offset={80}>
            <Float><DecoWaves className="w-[420px] h-[420px]" /></Float>
          </Parallax>
          <Parallax className="pointer-events-none absolute -right-32 top-64 hidden md:block" offset={120}>
            <Float delay={1.5}><DecoWaves className="w-[340px] h-[340px]" /></Float>
          </Parallax>

          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <Reveal stagger className="text-center max-w-4xl mx-auto">

              {/* Logo Oficial MOVI Digital (sin texto duplicado) */}
              <RevealItem className="flex justify-center">
                <Float>
                  <MoviOfficialLogo className="h-12 sm:h-16 lg:h-20 w-auto" />
                </Float>
              </RevealItem>

              {/* Titular: el mismo texto del badge oficial, ahora como H1 */}
              <RevealItem className="mt-8 sm:mt-10">
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-white border border-slate-200/60 shadow-[0_1px_2px_rgba(15,23,42,0.05)] mb-5" aria-hidden="true">
                  <Sparkles className="w-4 h-4 text-blue-600" {...ICON} />
                </span>
                <h1 className="text-[34px] leading-[1.08] sm:text-[56px] lg:text-[68px] font-semibold tracking-[-0.035em] text-slate-900 text-balance">
                  <span>Plataforma Digital Exclusiva para Asesores de </span>
                  <span className="bg-gradient-to-r from-blue-700 via-blue-600 to-blue-500 bg-clip-text text-transparent">Grupo JIRO</span>
                </h1>
              </RevealItem>

              {/* Subtítulo */}
              <RevealItem>
                <p className={`mt-6 ${LEAD} max-w-2xl mx-auto`}>
                  Controla tus trámites en vivo, atiende prospectos en tu CRM, consulta tus comisiones y haz crecer tu cartera con tu propia página web profesional.
                </p>
              </RevealItem>

              {/* Botones de Acción */}
              <RevealItem className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Press>
                  <a
                    href="https://app.movi.digital/login"
                    className={`${BTN_PRIMARIO} w-full sm:w-auto px-7 py-3.5 text-[15px]`}
                  >
                    <Shimmer />
                    <Lock className="w-4 h-4" {...ICON} />
                    <span>Ingresar</span>
                    <ArrowRight className="w-4 h-4" {...ICON} />
                  </a>
                </Press>

                <Press>
                  <a
                    href="https://agentedeseguros.website/ejemplo"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${BTN_SECUNDARIO} w-full sm:w-auto px-6 py-3.5 text-[15px]`}
                  >
                    <Globe className="w-4 h-4 text-blue-600" {...ICON} />
                    <span>Ver Página Web de Ejemplo</span>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400" {...ICON} />
                  </a>
                </Press>
              </RevealItem>
            </Reveal>

            {/* 4 Métricas Clave */}
            <Reveal stagger className="mt-16 sm:mt-20 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 max-w-5xl mx-auto text-left">
              {[
                { valor: <CountUp value="100%" />, titulo: 'Control de Trámites', detalle: 'Emisión en línea', deco: <DecoSpark className="w-16 h-5" /> },
                { valor: 'WhatsApp', titulo: 'Notificaciones', detalle: 'Alertas automáticas', deco: <DecoBars className="w-14 h-6" bars={[30, 52, 40, 66, 58, 84]} /> },
                { valor: 'Mi CRM', titulo: 'Cartera 360°', detalle: 'Historial centralizado', deco: <DecoSpark className="w-16 h-5" /> },
                { valor: 'Mi Web', titulo: 'Sitio Profesional', detalle: 'Cotizadores listos', deco: <DecoBars className="w-14 h-6" bars={[44, 36, 58, 50, 72, 90]} /> },
              ].map((m, i) => (
                <RevealItem key={i}>
                  <SpotlightCard className="h-full p-5 sm:p-6">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-2xl sm:text-[28px] font-semibold tracking-[-0.02em] text-blue-600 tabular-nums">{m.valor}</p>
                      <div className="opacity-80 shrink-0 mt-2 hidden sm:block">{m.deco}</div>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-slate-900">{m.titulo}</p>
                    <p className="mt-0.5 text-[13px] text-slate-500">{m.detalle}</p>
                  </SpotlightCard>
                </RevealItem>
              ))}
            </Reveal>

            {/* Mockup Interactivo del SaaS MOVI */}
            <TiltFrame className="mt-16 sm:mt-24 max-w-5xl mx-auto">
              <div className="relative">
                <div aria-hidden="true" className="absolute -inset-x-10 -top-10 bottom-0 rounded-[32px] bg-gradient-to-b from-blue-500/10 to-transparent blur-2xl" />
                <div className={`relative rounded-2xl overflow-hidden ${SURFACE}`}>

                  {/* Header de la ventana */}
                  <BrowserBar url="app.movi.digital · Grupo JIRO" status="Oficina Virtual Activa" />

                  {/* Selector de Pestañas */}
                  <div className="flex overflow-x-auto no-scrollbar gap-1 p-2 bg-white border-b border-slate-200/60 text-[13px] font-medium" role="tablist">
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
                          role="tab"
                          aria-selected={isSelected}
                          onClick={() => setActiveTab(tab.id as any)}
                          className={`relative flex items-center gap-2 px-3.5 py-2 rounded-[10px] whitespace-nowrap transition-colors cursor-pointer ${FOCUS} ${
                            isSelected ? 'text-blue-700' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                          }`}
                        >
                          {isSelected && (
                            <motion.span
                              layoutId="movi-tab-activa"
                              className="absolute inset-0 rounded-[10px] bg-blue-50 border border-blue-100"
                              transition={{ duration: reduce ? 0 : 0.35, ease: EASE }}
                            />
                          )}
                          <IconComp className="relative w-4 h-4" {...ICON} />
                          <span className="relative">{tab.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Contenido Dinámico */}
                  <div className="relative p-5 sm:p-7 min-h-[360px] bg-white">
                    <AnimatePresence mode="wait" initial={false}>

                      {activeTab === 'tramites' && (
                        <motion.div key="tramites" {...panel} className="space-y-4">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-sm font-semibold text-slate-900">Mesa de Control de Trámites</span>
                            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 font-semibold tabular-nums">
                              14 Trámites en Curso
                            </span>
                          </div>

                          <div className="space-y-2">
                            {[
                              { t: 'Emisión Auto Cobertura Amplia · Folio #TR-8821', c: 'Cliente: Mariana Ríos · GNP Seguros · Póliza Anual', s: 'Póliza Emitida ✓', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200/70' },
                              { t: 'Endoso Aumento de Suma · Folio #TR-8822', c: 'Cliente: Constructora del Centro · Quálitas Flotillas', s: 'En Revisión Mesa JIRO', cls: 'bg-amber-50 text-amber-700 border-amber-200/70' },
                              { t: 'Cotización Gastos Médicos · Folio #TR-8823', c: 'Cliente: Dr. Esteban Garza · Plan Familiar', s: 'Cotización Lista', cls: 'bg-blue-50 text-blue-700 border-blue-100' },
                            ].map((r, i) => (
                              <motion.div
                                key={r.t}
                                initial={reduce ? false : { opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.4, ease: EASE, delay: 0.06 * i }}
                                className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/60 flex flex-wrap items-center justify-between gap-2"
                              >
                                <div className="space-y-0.5 text-left">
                                  <p className="text-[13px] font-semibold text-slate-900">{r.t}</p>
                                  <p className="text-xs text-slate-500">{r.c}</p>
                                </div>
                                <span className={`px-2.5 py-0.5 rounded-full border text-[11px] font-semibold ${r.cls}`}>
                                  {r.s}
                                </span>
                              </motion.div>
                            ))}
                          </div>
                        </motion.div>
                      )}

                      {activeTab === 'crm' && (
                        <motion.div key="crm" {...panel} className="space-y-4">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-sm font-semibold text-slate-900">Mi CRM de Asesor</span>
                            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 font-semibold tabular-nums">
                              48 Clientes Registrados
                            </span>
                          </div>

                          <div className="grid sm:grid-cols-2 gap-3 text-left">
                            <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/60 space-y-1.5">
                              <div className="flex items-center justify-between">
                                <p className="text-[13px] font-semibold text-slate-900">Lic. Roberto Sánchez</p>
                                <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 text-[10px] font-semibold">Lead Web</span>
                              </div>
                              <p className="text-xs text-slate-500">Cotizó Seguro de Auto desde tu web</p>
                              <p className="text-xs font-medium text-blue-600 tabular-nums">55 4920 1823 · WhatsApp Activo</p>
                            </div>

                            <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/60 space-y-1.5">
                              <div className="flex items-center justify-between">
                                <p className="text-[13px] font-semibold text-slate-900">Dra. Claudia Morales</p>
                                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/70 text-[10px] font-semibold">Cliente Vigente</span>
                              </div>
                              <p className="text-xs text-slate-500">Póliza GMM Quálitas · Renovación en 28 días</p>
                              <p className="text-xs font-medium text-emerald-700">Recibo 1/4 Validado ✓</p>
                            </div>
                          </div>
                          <DecoArea className="w-full h-24 mt-2" />
                        </motion.div>
                      )}

                      {activeTab === 'produccion' && (
                        <motion.div key="produccion" {...panel} className="space-y-4 text-left">
                          <div className="relative overflow-hidden p-5 rounded-xl bg-blue-600 text-white space-y-1">
                            <DecoArea className="absolute right-0 bottom-0 w-2/3 h-20 opacity-40 [&_path]:stroke-white" />
                            <p className="relative text-[11px] text-blue-100 font-semibold uppercase tracking-[0.08em]">Comisiones Quincenales</p>
                            <p className="relative text-3xl font-semibold tracking-[-0.02em]">$<CountUp value="48,920.00" /> MXN</p>
                            <p className="relative text-xs text-blue-100">Dispersión programada por aseguradora</p>
                          </div>

                          <div className="space-y-2 text-[13px]">
                            <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/60 flex items-center justify-between">
                              <span>GNP Seguros (Emisiones)</span>
                              <span className="font-semibold text-emerald-600 font-mono tabular-nums">$26,400.00</span>
                            </div>
                            <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/60 flex items-center justify-between">
                              <span>Quálitas Compañía de Seguros</span>
                              <span className="font-semibold text-emerald-600 font-mono tabular-nums">$14,820.00</span>
                            </div>
                          </div>
                          <DecoBars className="w-full h-16" bars={[26, 40, 34, 52, 46, 64, 58, 72, 66, 84, 78, 92]} />
                        </motion.div>
                      )}

                      {activeTab === 'notificaciones' && (
                        <motion.div key="notificaciones" {...panel} className="space-y-4 text-left">
                          <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200/70 flex items-center gap-3">
                            <span className="w-9 h-9 rounded-full bg-white border border-emerald-200/70 flex items-center justify-center flex-shrink-0">
                              <MessageCircle className="w-[18px] h-[18px] text-emerald-600" {...ICON} />
                            </span>
                            <div>
                              <p className="text-[13px] font-semibold text-emerald-900">Avisos automáticos sin trabajo manual</p>
                              <p className="text-xs text-emerald-700">Alertas por WhatsApp al cambiar el estado de la póliza.</p>
                            </div>
                          </div>

                          <div className="p-5 rounded-xl bg-slate-50 border border-slate-200/60 space-y-2 text-xs">
                            <p className="text-[11px] font-mono text-slate-400">WhatsApp enviado automáticamente:</p>
                            <p className="max-w-xl rounded-2xl rounded-tl-sm bg-white border border-slate-200/60 px-4 py-3 text-slate-700 leading-relaxed text-[13px] shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                              "Hola <strong>Mariana</strong>, tu asesor <strong>Carlos Méndez (Grupo JIRO)</strong> te informa que tu póliza de auto <strong>GNP #9281-9920</strong> ya fue emitida. Puedes descargar tu recibo en Seguwallet."
                            </p>
                          </div>
                        </motion.div>
                      )}

                      {activeTab === 'comunicados' && (
                        <motion.div key="comunicados" {...panel} className="space-y-4 text-left">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-sm font-semibold text-slate-900">Comunicados y Campañas Grupo JIRO</span>
                            <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 font-semibold text-[10px]">Oficial</span>
                          </div>

                          <div className="p-5 rounded-xl bg-slate-50/70 border border-slate-200/60 space-y-1.5">
                            <p className="text-[13px] font-semibold text-slate-900">Campaña de Autos GNP & Quálitas 2026</p>
                            <p className="text-xs text-slate-600 leading-relaxed">
                              Conoce la tabla de bonos especiales por volumen de pólizas emitidas para toda la red de agentes de Grupo JIRO.
                            </p>
                          </div>
                          <DecoArea className="w-full h-24" />
                        </motion.div>
                      )}

                    </AnimatePresence>
                  </div>

                  {/* Footer del Mockup */}
                  <div className="px-5 sm:px-7 py-3.5 bg-slate-50/80 border-t border-slate-200/60 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <span className="text-slate-500">Acceso exclusivo para agentes de Grupo JIRO</span>
                    <a
                      href="https://app.movi.digital/login"
                      className={`group font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1.5 rounded ${FOCUS}`}
                    >
                      <span>Ingresar</span>
                      <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-0.5" {...ICON} />
                    </a>
                  </div>

                </div>
              </div>
            </TiltFrame>

          </div>
        </section>

        {/* ─── 3. MÓDULOS (BENTO) ───────────────────────────────────────── */}
        <section id="funciones" className="relative py-28 lg:py-40 bg-white border-y border-slate-200/60">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

            <Reveal stagger className="text-center max-w-3xl mx-auto mb-14 lg:mb-20">
              <RevealItem>
                <span className={EYEBROW}>
                  Diseñado para el Asesor de Éxito
                </span>
              </RevealItem>
              <RevealItem>
                <h2 className={`mt-5 ${H2}`}>
                  Módulos de Gestión de Grupo JIRO
                </h2>
              </RevealItem>
              <RevealItem>
                <p className={`mt-5 ${LEAD}`}>
                  Toda la fuerza comercial y operativa concentrada en tu oficina virtual.
                </p>
              </RevealItem>
            </Reveal>

            <Reveal stagger className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
              {[
                { icon: FileText, t: 'Control de Trámites', d: 'Monitorea cotizaciones, emisiones, cancelaciones y endosos con asignación directa al equipo de operaciones de Grupo JIRO.', span: 'lg:col-span-2', deco: <DecoBars className="w-full h-24" /> },
                { icon: MessageCircle, t: 'Notificaciones en Vivo', d: 'Avisos automáticos por WhatsApp y correo a tus clientes cuando su póliza o recibo cambia de estado.', span: '', deco: null },
                { icon: Users, t: 'Mi CRM Integrado', d: 'Historial de prospectos, clientes y vigencias para asegurar renovaciones y ventas cruzadas.', span: '', deco: null },
                { icon: BarChart3, t: 'Central de Producción', d: 'Consulta tus comisiones quincenales, recibos cobrados y bonos con total claridad y exactitud.', span: 'lg:col-span-2', deco: <DecoArea className="w-full h-24" /> },
                { icon: Globe, t: 'Tu Propia Página Web', d: 'Sitio web profesional con tu nombre y cotizadores integrados que envían los leads directo a tu CRM.', span: '', deco: null },
                { icon: Megaphone, t: 'Comunicados JIRO', d: 'Circulares oficiales, incentivos y campañas comerciales emitidas directamente por Grupo JIRO.', span: 'lg:col-span-2', deco: <DecoSpark className="w-full h-16" /> },
              ].map((c) => {
                const Icon = c.icon;
                return (
                  <RevealItem key={c.t} className={c.span}>
                    <SpotlightCard className="h-full p-7 lg:p-8 text-left">
                      <div className={c.deco ? 'grid sm:grid-cols-2 gap-8 items-end' : ''}>
                        <div>
                          <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center">
                            <Icon className="w-5 h-5" {...ICON} />
                          </div>
                          <h3 className="mt-6 text-lg font-semibold text-slate-900 tracking-[-0.01em]">{c.t}</h3>
                          <p className="mt-2 text-[15px] text-slate-600 leading-relaxed">
                            {c.d}
                          </p>
                        </div>
                        {c.deco && <div className="hidden sm:block rounded-xl bg-slate-50/70 border border-slate-200/60 p-4">{c.deco}</div>}
                      </div>
                    </SpotlightCard>
                  </RevealItem>
                );
              })}
            </Reveal>

          </div>
        </section>

        {/* ─── 4. TU PÁGINA WEB PERSONALIZADA (MOCKUP REAL) ────────────── */}
        <section id="mi-web" className="relative py-28 lg:py-40 overflow-hidden">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={DOTS} />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-40 -translate-x-1/2 w-[900px] h-[520px] rounded-full"
            style={{ background: 'radial-gradient(closest-side, rgba(37,99,235,0.08), transparent)' }}
          />
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

            <Reveal stagger className="text-center max-w-3xl mx-auto">
              <RevealItem>
                <span className={EYEBROW}>
                  <Globe className="w-3.5 h-3.5 text-blue-600" {...ICON} /> Presencia Digital
                </span>
              </RevealItem>

              <RevealItem>
                <h2 className={`mt-5 ${H2}`}>
                  Tu Página Web Conectada al CRM
                </h2>
              </RevealItem>

              <RevealItem>
                <p className={`mt-5 ${LEAD}`}>
                  Cada asesor de Grupo JIRO cuenta con su propio sitio web oficial para captar prospectos y cotizar seguros.
                </p>
              </RevealItem>

              <RevealItem className="mt-8">
                <Press>
                  <a
                    href="https://agentedeseguros.website/ejemplo"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${BTN_PRIMARIO} w-full sm:w-auto px-6 py-3 text-sm`}
                  >
                    <span>Abrir Página Web de Ejemplo</span>
                    <ExternalLink className="w-3.5 h-3.5" {...ICON} />
                  </a>
                </Press>
              </RevealItem>
            </Reveal>

            {/* MOCKUP REAL DE AGENTE DEMO (es el sitio del asesor: conserva su propio estilo) */}
            <TiltFrame className="mt-14 lg:mt-20 max-w-5xl mx-auto">
              <div className={`relative rounded-2xl overflow-hidden text-slate-900 ${SURFACE}`}>

                {/* Browser Bar */}
                <BrowserBar url="https://agentedeseguros.website/ejemplo" status="En Línea" />

                {/* Header Interno del Sitio Web del Asesor */}
                <div className="px-6 sm:px-10 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
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
                      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold shadow-xs transition ${FOCUS}`}
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-emerald-400" {...ICON} />
                      <span>WhatsApp</span>
                    </a>
                  </div>
                </div>

                {/* Cuerpo del Mockup */}
                <div className="p-6 sm:p-10 grid lg:grid-cols-12 gap-8 items-start relative bg-white">

                  {/* Columna Izquierda: Perfil y Botones */}
                  <div className="lg:col-span-5 space-y-5 text-left">

                    <div className="relative inline-block">
                      <div className="w-28 h-28 rounded-full p-1 bg-gradient-to-tr from-amber-400 via-emerald-400 to-blue-500 shadow-md">
                        <div className="w-full h-full rounded-full bg-slate-100 overflow-hidden flex items-center justify-center border-2 border-white">
                          <img
                            src={AVATAR_DEMO}
                            alt="Agente Demo"
                            loading="lazy"
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
                        <button className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-800 text-white font-bold text-xs shadow-xs hover:bg-slate-900 transition ${FOCUS}`}>
                          <MessageCircle className="w-3.5 h-3.5 text-emerald-400" {...ICON} />
                          <span>Escribir WhatsApp</span>
                        </button>

                        <button className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-white border border-slate-300 text-slate-800 font-bold text-xs shadow-xs hover:bg-slate-50 transition ${FOCUS}`}>
                          <Phone className="w-3.5 h-3.5 text-slate-600" {...ICON} />
                          <span>Llamar</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-[#E5A823] text-white font-bold text-xs shadow-xs hover:bg-[#D99A16] transition ${FOCUS}`}>
                          <Car className="w-3.5 h-3.5 text-white" {...ICON} />
                          <span>Multicotizador</span>
                        </button>

                        <button className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-white border border-slate-300 text-slate-800 font-bold text-xs shadow-xs hover:bg-slate-50 transition ${FOCUS}`}>
                          <UserPlus className="w-3.5 h-3.5 text-slate-600" {...ICON} />
                          <span>Guardar Contacto</span>
                        </button>
                      </div>
                    </div>

                  </div>

                  {/* Columna Derecha: Tarjeta de Cotización */}
                  <div className="lg:col-span-7">
                    <div className="rounded-2xl border border-slate-200/70 bg-white p-5 sm:p-7 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-12px_rgba(15,23,42,0.12)] space-y-4 text-left">

                      <div className="space-y-0.5 pb-3 border-b border-slate-100">
                        <h4 className="text-xl font-black text-slate-900 tracking-tight">
                          Solicita tu Cotizacion
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          Completa el formulario y te contacto de inmediato — sin costo ni compromiso.
                        </p>
                      </div>

                      <AnimatePresence mode="wait" initial={false}>
                        {demoFormSent ? (
                          <motion.div key="enviado" {...panel} className="p-5 rounded-xl bg-emerald-50 border border-emerald-200 text-center space-y-2">
                            <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" {...ICON} />
                            <h5 className="text-sm font-extrabold text-emerald-900">¡Cotización Enviada al Asesor!</h5>
                            <p className="text-xs text-emerald-700">
                              La solicitud entró a <strong>Mi CRM</strong> y el agente recibió una alerta en WhatsApp.
                            </p>
                            <button
                              onClick={() => setDemoFormSent(false)}
                              className={`text-xs font-bold text-blue-600 hover:underline pt-1 cursor-pointer rounded ${FOCUS}`}
                            >
                              Enviar otra cotización de prueba
                            </button>
                          </motion.div>
                        ) : (
                          <motion.form
                            key="form"
                            {...panel}
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
                              className={`w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-900 active:scale-[0.98] text-white font-bold text-xs shadow-md transition-all cursor-pointer ${FOCUS}`}
                            >
                              Solicitar Cotizacion Gratuita
                            </button>

                            <p className="text-[10px] text-center text-slate-400">
                              Al enviar, aceptas que te contactemos para ofrecerte informacion sobre seguros.
                            </p>
                          </motion.form>
                        )}
                      </AnimatePresence>

                    </div>
                  </div>

                  {/* Burbuja flotante de WhatsApp */}
                  <Float className="absolute bottom-5 right-5 hidden sm:block">
                    <div className="flex items-center justify-center w-11 h-11 rounded-full bg-slate-800 text-white shadow-xl cursor-pointer hover:scale-110 transition-transform">
                      <MessageCircle className="w-5 h-5 text-emerald-400" {...ICON} />
                    </div>
                  </Float>

                </div>

              </div>
            </TiltFrame>

          </div>
        </section>

        {/* ─── 5. HERRAMIENTAS (SEGUWALLET & EDUCATION) ─────────────────── */}
        <section id="herramientas" className="py-28 lg:py-40 bg-white border-y border-slate-200/60">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

            <Reveal stagger className="text-center max-w-3xl mx-auto mb-14 lg:mb-20">
              <RevealItem>
                <span className={EYEBROW}>
                  Ecosistema de Soluciones
                </span>
              </RevealItem>
              <RevealItem>
                <h2 className={`mt-5 ${H2}`}>
                  Herramientas Exclusivas para el Asesor
                </h2>
              </RevealItem>
              <RevealItem>
                <p className={`mt-5 ${LEAD}`}>
                  Tecnología móvil para tus clientes y formación continua para tu desarrollo profesional.
                </p>
              </RevealItem>
            </Reveal>

            <Reveal stagger className="grid md:grid-cols-2 gap-4 lg:gap-5">

              {/* Card Seguwallet */}
              <RevealItem>
                <SpotlightCard className="h-full p-7 sm:p-9">
                  <div className="flex flex-col justify-between h-full gap-8">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <img
                          src={LOGO_SEGUWALLET}
                          alt="Seguwallet"
                          loading="lazy"
                          className="h-16 w-auto object-contain"
                        />
                        <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 text-xs font-semibold">
                          App para Clientes
                        </span>
                      </div>

                      <h3 className="text-2xl font-semibold text-slate-900 tracking-[-0.02em]">
                        Seguwallet: La Cartera Digital de tus Clientes
                      </h3>

                      <p className="text-[15px] text-slate-600 leading-relaxed">
                        Tus clientes consultan pólizas, descargan recibos en PDF y reportan siniestros directamente sin contraseñas (acceso OTP por WhatsApp).
                      </p>
                    </div>

                    <div className="pt-6 border-t border-slate-200/60">
                      <Press>
                        <a
                          href="https://seguwallet.mx"
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`${BTN_PRIMARIO} px-5 py-2.5 text-sm`}
                        >
                          <span>Conocer Seguwallet</span>
                          <ExternalLink className="w-3.5 h-3.5" {...ICON} />
                        </a>
                      </Press>
                    </div>
                  </div>
                </SpotlightCard>
              </RevealItem>

              {/* Card Seguros Education */}
              <RevealItem>
                <SpotlightCard className="h-full p-7 sm:p-9">
                  <div className="flex flex-col justify-between h-full gap-8">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <span className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center">
                            <GraduationCap className="w-5 h-5" {...ICON} />
                          </span>
                          <span className="font-semibold text-base text-slate-900">Seguros Education</span>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 text-xs font-semibold">
                          Campus Virtual JIRO
                        </span>
                      </div>

                      <h3 className="text-2xl font-semibold text-slate-900 tracking-[-0.02em]">
                        Seguros Education: Academia y Certificaciones
                      </h3>

                      <p className="text-[15px] text-slate-600 leading-relaxed">
                        Cursos on-demand, simulador de examen para la Cédula A de la CNSF, certificaciones con aseguradoras y diplomados universitarios con UTEL.
                      </p>
                    </div>

                    <div className="pt-6 border-t border-slate-200/60">
                      <Press>
                        <a
                          href="https://seguros.education"
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`${BTN_SECUNDARIO} px-5 py-2.5 text-sm`}
                        >
                          <span>Ir a Seguros Education</span>
                          <ExternalLink className="w-3.5 h-3.5" {...ICON} />
                        </a>
                      </Press>
                    </div>
                  </div>
                </SpotlightCard>
              </RevealItem>

            </Reveal>

          </div>
        </section>

        {/* ─── 6. PREGUNTAS FRECUENTES (FAQ) ───────────────────────────── */}
        <section id="faq" className="py-28 lg:py-40">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">

            <Reveal stagger className="text-center max-w-2xl mx-auto mb-12 lg:mb-16">
              <RevealItem>
                <span className={EYEBROW}>
                  <HelpCircle className="w-3.5 h-3.5 text-blue-600" {...ICON} /> Dudas Comunes
                </span>
              </RevealItem>
              <RevealItem>
                <h2 className={`mt-5 ${H2}`}>
                  Preguntas Frecuentes
                </h2>
              </RevealItem>
            </Reveal>

            <Reveal stagger className="space-y-3">
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
                  <RevealItem key={index}>
                    <div
                      className={`rounded-2xl overflow-hidden transition-[border-color,box-shadow] duration-300 ${SURFACE} ${isOpen ? 'border-blue-500/30' : 'hover:border-slate-300'}`}
                    >
                      <button
                        onClick={() => setOpenFaq(isOpen ? null : index)}
                        aria-expanded={isOpen}
                        className={`w-full flex items-center justify-between gap-4 p-5 sm:p-6 text-left cursor-pointer rounded-2xl ${FOCUS}`}
                      >
                        <span className="text-base sm:text-[17px] font-semibold text-slate-900 tracking-[-0.01em]">
                          {faq.q}
                        </span>
                        <span className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors duration-300 ${isOpen ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                          <ChevronDown
                            className={`w-4 h-4 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                            {...ICON}
                          />
                        </span>
                      </button>

                      <AnimatePresence initial={false}>
                        {isOpen && (
                          <motion.div
                            key="respuesta"
                            initial={reduce ? false : { height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={reduce ? undefined : { height: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: EASE }}
                            className="overflow-hidden"
                          >
                            <div className="px-5 sm:px-6 pb-6 text-[15px] text-slate-600 leading-relaxed">
                              {faq.a}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </RevealItem>
                );
              })}
            </Reveal>

          </div>
        </section>

        {/* ─── 7. CTA FINAL ─────────────────────────────────────────────── */}
        <section className="px-4 sm:px-6 lg:px-8 pb-24 lg:pb-32">
          <Reveal className="relative max-w-6xl mx-auto overflow-hidden rounded-[28px] border border-slate-200/60 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_24px_64px_-24px_rgba(37,99,235,0.25)]">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={DOTS} />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 -top-40 -translate-x-1/2 w-[900px] h-[520px] rounded-full"
              style={{ background: 'radial-gradient(closest-side, rgba(37,99,235,0.14), transparent)' }}
            />
            <div className="relative px-6 py-20 sm:py-24 lg:py-28 text-center">

              <Float className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center mx-auto shadow-[0_12px_32px_-8px_rgba(37,99,235,0.6)]">
                <ShieldCheck className="w-7 h-7" {...ICON} />
              </Float>

              <div className="mt-8 space-y-4 max-w-2xl mx-auto">
                <h2 className={H2}>
                  Haz crecer tu despacho con la tecnología de Grupo JIRO
                </h2>
                <p className={LEAD}>
                  Ingresa hoy a tu Oficina Virtual y aprovecha todas las herramientas disponibles.
                </p>
              </div>

              <div className="mt-10">
                <Press>
                  <a
                    href="https://app.movi.digital/login"
                    className={`${BTN_PRIMARIO} w-full sm:w-auto px-8 py-3.5 text-[15px]`}
                  >
                    <Shimmer />
                    <Lock className="w-4 h-4" {...ICON} />
                    <span>Ingresar</span>
                    <ArrowRight className="w-4 h-4" {...ICON} />
                  </a>
                </Press>
              </div>

            </div>
          </Reveal>
        </section>

        {/* ─── 8. FOOTER INSTITUCIONAL Y CRÉDITOS ───────────────────────── */}
        <footer className="border-t border-slate-200/60 bg-white py-16 text-slate-600">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">

            <div className="grid md:grid-cols-4 gap-10">

              {/* Columna 1: Logos MOVI Digital + Grupo JIRO */}
              <div className="md:col-span-2 space-y-4 text-left">
                <div className="flex items-center gap-3">
                  <MoviOfficialLogo className="h-8 w-auto" />
                  <div className="h-5 w-px bg-slate-200" />
                  <a href="https://www.grupojiro.com" target="_blank" rel="noopener noreferrer" className={`rounded ${FOCUS}`}>
                    <GrupoJiroLogo className="h-9 w-auto" />
                  </a>
                </div>
                <p className="text-sm text-slate-500 leading-relaxed max-w-sm">
                  <strong className="font-semibold text-slate-700">MOVI.Digital · Mi Oficina Virtual</strong> es la plataforma de gestión operativa y comercial exclusiva de <strong className="font-semibold text-slate-700">Grupo JIRO</strong> para su red de agentes de seguros.
                </p>
                <div className="text-sm">
                  <a href="https://www.grupojiro.com" target="_blank" rel="noopener noreferrer" className={`text-slate-500 hover:text-blue-600 underline underline-offset-4 decoration-slate-300 rounded ${FOCUS}`}>
                    www.grupojiro.com
                  </a>
                </div>
              </div>

              {/* Columna 2: Módulos */}
              <div className="space-y-3 text-left">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-900">Módulos</p>
                <ul className="space-y-2 text-sm text-slate-600">
                  <li><button onClick={() => scrollTo('funciones')} className={`hover:text-blue-600 transition-colors cursor-pointer rounded ${FOCUS}`}>Control de Trámites</button></li>
                  <li><button onClick={() => scrollTo('funciones')} className={`hover:text-blue-600 transition-colors cursor-pointer rounded ${FOCUS}`}>Mi CRM de Asesor</button></li>
                  <li><button onClick={() => scrollTo('funciones')} className={`hover:text-blue-600 transition-colors cursor-pointer rounded ${FOCUS}`}>Central de Producción</button></li>
                  <li><button onClick={() => scrollTo('mi-web')} className={`hover:text-blue-600 transition-colors cursor-pointer rounded ${FOCUS}`}>Mi Página Web</button></li>
                </ul>
              </div>

              {/* Columna 3: Ecosistema JIRO */}
              <div className="space-y-3 text-left">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-900">Ecosistema</p>
                <ul className="space-y-2 text-sm text-slate-600">
                  <li><a href="https://app.movi.digital/login" className={`hover:text-blue-600 transition-colors rounded ${FOCUS}`}>Ingresar al Portal</a></li>
                  <li><a href="https://seguwallet.mx" target="_blank" rel="noopener noreferrer" className={`hover:text-blue-600 transition-colors rounded ${FOCUS}`}>Seguwallet</a></li>
                  <li><a href="https://seguros.education" target="_blank" rel="noopener noreferrer" className={`hover:text-blue-600 transition-colors rounded ${FOCUS}`}>Seguros Education</a></li>
                  <li><a href="https://www.grupojiro.com" target="_blank" rel="noopener noreferrer" className={`hover:text-blue-600 transition-colors rounded ${FOCUS}`}>Grupo JIRO</a></li>
                </ul>
              </div>

            </div>

            {/* Copyright y Créditos de Mekate Studio */}
            <div className="pt-8 border-t border-slate-200/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-slate-500">
              <p>© {new Date().getFullYear()} MOVI Digital · Grupo JIRO. Todos los derechos reservados.</p>

              <div className="flex items-center gap-1.5 text-slate-500">
                <span>Desarrollado por</span>
                <a
                  href="https://mekate.mx"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`font-semibold text-slate-800 hover:text-blue-600 transition-colors flex items-center gap-1 rounded ${FOCUS}`}
                >
                  <span>Mekate Studio</span>
                  <ExternalLink className="w-3 h-3 text-slate-400" {...ICON} />
                </a>
              </div>
            </div>

          </div>
        </footer>

      </div>
    </>
  );
}
