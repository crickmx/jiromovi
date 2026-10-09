import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { 
  ShieldCheck, 
  Check, 
  X, 
  Sparkles, 
  Clock, 
  Hospital, 
  Stethoscope, 
  ArrowRight, 
  Building2, 
  FileText, 
  Tag, 
  ChevronDown, 
  ChevronUp, 
  ExternalLink, 
  LogIn, 
  Zap, 
  Lock, 
  CreditCard, 
  Play, 
  Search, 
  Menu, 
  HeartHandshake, 
  Smartphone, 
  Calculator,
  Pill,
  Award,
  PhoneCall
} from 'lucide-react';

export const MUTUUS_PORTAL_URL = 'https://selfservice.psmutuus.com/agente/A-3522/promo/A-3522';

export interface LandingCustomization {
  heroTitle?: string;
  heroSubtitle?: string;
  badgeText?: string;
  primaryColor?: string;
  accentColor?: string;
  ctaText?: string;
  promoBanner?: string;
  discountAnnual?: number;
  featuredPlan?: 'uno' | 'dos' | 'plus';
  plansData?: typeof PLANES_DATA;
  customFaqs?: Array<{ q: string; a: string }>;
}

// ─── FAQ Data ────────────────────────────────────────────────────────────────
const DEFAULT_FAQS = [
  {
    q: '¿Cómo funciona la membresía de salud y seguro de Mutuus?',
    a: 'Mutuus combina atención médica preventiva digital (videoconsultas ilimitadas 24/7 con médicos generales, pediatras y psicólogos) con una póliza de seguro de Gastos Médicos Mayores respaldada por aseguradoras líderes en México que te otorga $0 deducible y $0 coaseguro al atenderte dentro de su red hospitalaria autorizada.'
  },
  {
    q: '¿Por qué no pago deducible ni coaseguro en el hospital?',
    a: 'Gracias al modelo de pago directo y convenios institucionales de Mutuus, al reportar tu evento médico antes o al momento de tu ingreso a un hospital de la red, los gastos médicos cubiertos son cubiertos de forma directa, eliminando el desembolso inicial de deducible y coaseguro de tu bolsillo.'
  },
  {
    q: '¿Cuáles son los hospitales en convenio de pago directo?',
    a: 'La red abarca más de 115 hospitales de pago directo y más de 548 instituciones médicas en convenio en toda la República Mexicana, incluyendo Grupo Hospitales Ángeles, Médica Sur, Star Médica, Hospitales San Javier, Christus Muguerza y Hospitales MAC.'
  },
  {
    q: '¿Cubre maternidad, parto o cesárea?',
    a: 'Sí. Todos los planes incluyen cobertura y ayuda económica para maternidad tras cumplir un periodo de espera continuo de 10 meses de antigüedad en tu membresía conforme al tabulador estipulado en la póliza.'
  },
  {
    q: '¿Cómo solicito una videoconsulta médica 24/7?',
    a: 'Desde la aplicación móvil oficial de Mutuus disponible para iOS y Android, puedes iniciar videollamadas o chats médicos ilimitados los 365 días del año sin costo extra ni límite mensual para ti y tu familia.'
  },
  {
    q: '¿Cómo es el proceso de contratación y cuánto tarda?',
    a: 'El trámite es 100% digital e inmediato a través de nuestro portal de autoservicio en línea. Solo ingresas tus datos, realizas tu pago seguro y recibes tu póliza y credencial digital en minutos.'
  }
];

// ─── Planes Data ─────────────────────────────────────────────────────────────
const PLANES_DATA = {
  mensual: [
    {
      id: 'uno',
      nombre: 'Plan UNO',
      badge: 'Básico Esencial',
      sumaAsegurada: '$1,000,000 MXN',
      pagoInicial: '$1,299',
      mensualidad: '$1,299',
      anualTotal: '$15,588',
      popular: false,
      caracteristicas: [
        'Cero Deducible en red de pago directo',
        'Cero Coaseguro en eventos hospitalarios',
        'Suma asegurada de $1,000,000 MXN por evento',
        'Telemedicina 24/7 ilimitada (Medicina general)',
        'Red de 115+ hospitales nacionales',
        'Ambulancia de urgencia (2 eventos al año)',
        'Atención médica en el extranjero por urgencia'
      ]
    },
    {
      id: 'dos',
      nombre: 'Plan DOS',
      badge: 'Más Elegido ★',
      sumaAsegurada: '$3,000,000 MXN',
      pagoInicial: '$1,899',
      mensualidad: '$1,899',
      anualTotal: '$22,788',
      popular: true,
      caracteristicas: [
        'Cero Deducible en red de pago directo',
        'Cero Coaseguro en eventos hospitalarios',
        'Suma asegurada de $3,000,000 MXN por evento',
        'Telemedicina 24/7 (General, Psicología, Nutrición)',
        'Red completa de 548+ hospitales en convenio',
        'Ambulancia de urgencia (3 eventos al año)',
        'Ayuda de maternidad tras 10 meses',
        'Check-up preventivo anual básico',
        'Médico a domicilio con copago preferencial'
      ]
    },
    {
      id: 'plus',
      nombre: 'Plan PLUS',
      badge: 'Máxima Protección',
      sumaAsegurada: '$5,000,000 MXN',
      pagoInicial: '$2,499',
      mensualidad: '$2,499',
      anualTotal: '$29,988',
      popular: false,
      caracteristicas: [
        'Cero Deducible en red hospitalaria premium',
        'Cero Coaseguro en hospitalización y cirugía',
        'Suma asegurada de $5,000,000 MXN por evento',
        'Acceso preferencial Grupo Ángeles y Médica Sur',
        'Telemedicina 24/7 sin límite de especialidades',
        'Ambulancia aérea y terrestre en urgencias',
        'Mayor tope de cobertura en maternidad',
        'Check-up integral anual incluido',
        'Orientación médica y psicológica telefónica 24/7'
      ]
    }
  ],
  anual: [
    {
      id: 'uno',
      nombre: 'Plan UNO',
      badge: 'Ahorro Anual 10%',
      sumaAsegurada: '$1,000,000 MXN',
      pagoInicial: '$13,990',
      mensualidad: 'Equiv. $1,165/mes',
      anualTotal: '$13,990',
      descuento: 'Ahorra 10%',
      popular: false,
      caracteristicas: [
        'Cero Deducible en red de pago directo',
        'Cero Coaseguro en eventos hospitalarios',
        'Suma asegurada de $1,000,000 MXN por evento',
        'Telemedicina 24/7 ilimitada (Medicina general)',
        'Red de 115+ hospitales nacionales',
        'Ambulancia de urgencia (2 eventos al año)',
        'Atención médica en el extranjero por urgencia'
      ]
    },
    {
      id: 'dos',
      nombre: 'Plan DOS',
      badge: 'Mejor Relación Valor ★',
      sumaAsegurada: '$3,000,000 MXN',
      pagoInicial: '$20,490',
      mensualidad: 'Equiv. $1,707/mes',
      anualTotal: '$20,490',
      descuento: 'Ahorra 10%',
      popular: true,
      caracteristicas: [
        'Cero Deducible en red de pago directo',
        'Cero Coaseguro en eventos hospitalarios',
        'Suma asegurada de $3,000,000 MXN por evento',
        'Telemedicina 24/7 (General, Psicología, Nutrición)',
        'Red completa de 548+ hospitales en convenio',
        'Ambulancia de urgencia (3 eventos al año)',
        'Ayuda de maternidad tras 10 meses',
        'Check-up preventivo anual básico',
        'Médico a domicilio con copago preferencial'
      ]
    },
    {
      id: 'plus',
      nombre: 'Plan PLUS',
      badge: 'Protección Total VIP',
      sumaAsegurada: '$5,000,000 MXN',
      pagoInicial: '$26,990',
      mensualidad: 'Equiv. $2,249/mes',
      anualTotal: '$26,990',
      descuento: 'Ahorra 10%',
      popular: false,
      caracteristicas: [
        'Cero Deducible en red hospitalaria premium',
        'Cero Coaseguro en hospitalización y cirugía',
        'Suma asegurada de $5,000,000 MXN por evento',
        'Acceso preferencial Grupo Ángeles y Médica Sur',
        'Telemedicina 24/7 sin límite de especialidades',
        'Ambulancia aérea y terrestre en urgencias',
        'Mayor tope de cobertura en maternidad',
        'Check-up integral anual incluido',
        'Orientación médica y psicológica telefónica 24/7'
      ]
    }
  ]
};

// ─── Directorio de Hospitales con Filtro de Estado ───────────────────────────
const HOSPITALES_DATA = [
  { nombre: 'Hospitales Ángeles', tipo: 'Red de Alta Especialidad', estado: 'CDMX', sedes: 'Pedregal, Lomas, México, Acoxpa, Lindavista' },
  { nombre: 'Médica Sur', tipo: 'Centro Médico de Excelencia', estado: 'CDMX', sedes: 'Tlalpan (Torres de Hospitalización)' },
  { nombre: 'Star Médica', tipo: 'Red Hospitalaria Nacional', estado: 'CDMX', sedes: 'Lomas Verdes, Santa Fe, Centro' },
  { nombre: 'Hospital San Javier', tipo: 'Alta Especialidad Quirúrgica', estado: 'Jalisco', sedes: 'Guadalajara y Puerto Vallarta' },
  { nombre: 'Hospitales MAC', tipo: 'Red Médica de Vanguardia', estado: 'Guanajuato', sedes: 'León, Celaya, Irapuato, San Miguel' },
  { nombre: 'Christus Muguerza', tipo: 'Red Hospitalaria Norte', estado: 'Nuevo León', sedes: 'Monterrey (Alta Especialidad y Sur)' },
  { nombre: 'Hospital Español', tipo: 'Complejo Hospitalario', estado: 'CDMX', sedes: 'Polanco' },
  { nombre: 'Star Médica Querétaro', tipo: 'Centro Quirúrgico Integral', estado: 'Querétaro', sedes: 'Querétaro Centro' },
  { nombre: 'Hospital Puebla', tipo: 'Especialidad y Urgencias', estado: 'Puebla', sedes: 'Angelópolis' }
];

export default function MutuusLanding({ customization }: { customization?: LandingCustomization }) {
  const [periodicidad, setPeriodicidad] = useState<'anual' | 'mensual'>('anual');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [tabCobertura, setTabCobertura] = useState<'cubierto' | 'no_cubierto'>('cubierto');
  const [selectedEstado, setSelectedEstado] = useState<string>('Todos');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [videoModalOpen, setVideoModalOpen] = useState(false);

  // Simulador de Ahorro
  const [edadSimulador, setEdadSimulador] = useState<number>(35);
  const [montoCuentaHospital, setMontoCuentaHospital] = useState<number>(350000);

  // Asegurar scroll completo en el documento sin bloqueos
  useEffect(() => {
    document.getElementById('root')?.classList.add('public-page');
    document.body.style.overflow = 'auto';
    return () => {
      document.getElementById('root')?.classList.remove('public-page');
    };
  }, []);

  // Dynamic overrides
  const heroTitle = customization?.heroTitle || 'Membresía de salud y gastos médicos con cero deducible';
  const heroSubtitle = customization?.heroSubtitle || 'Accede a la mejor atención médica privada, telemedicina 24/7 ilimitada y respaldo hospitalario nacional sin pagar deducibles sorpresa al momento de una emergencia.';
  const badgeText = customization?.badgeText || 'Cero Deducible · Cero Coaseguro en Red de Pago Directo';
  const primaryColor = customization?.primaryColor || '#003896';
  const accentColor = customization?.accentColor || '#9CD41C';
  const promoBanner = customization?.promoBanner;

  const allFaqs = customization?.customFaqs && customization.customFaqs.length > 0 
    ? [...customization.customFaqs, ...DEFAULT_FAQS] 
    : DEFAULT_FAQS;

  const rawPlans = customization?.plansData || PLANES_DATA;
  const plans = rawPlans[periodicidad];

  // Cálculo del simulador de impacto financiero
  const deducibleTradicional = 25000;
  const coaseguroTradicional = Math.min(montoCuentaHospital * 0.10, 45000);
  const gastoTradicional = deducibleTradicional + coaseguroTradicional;
  const gastoMutuus = 0;
  const ahorroTotal = gastoTradicional;

  // Filtrado de hospitales
  const filteredHospitales = useMemo(() => {
    if (selectedEstado === 'Todos') return HOSPITALES_DATA;
    return HOSPITALES_DATA.filter(h => h.estado === selectedEstado);
  }, [selectedEstado]);

  return (
    <>
      <Helmet>
        <html lang="es-MX" />
        <title>{heroTitle.length > 60 ? heroTitle.slice(0, 57) + '...' : heroTitle} | Mutuus Salud</title>
        <meta name="description" content={heroSubtitle} />
        <meta name="keywords" content="Mutuus seguro gastos medicos, seguro cero deducible mexico, seguro medico sin coaseguro, telemedicina 24/7 mexico, seguro hospitalario pago directo, membresia de salud mutuus jiro" />
        <link rel="canonical" href="https://landings.movi.digital/mutuus" />
        <meta property="og:type" content="website" />
        <meta property="og:locale" content="es_MX" />
        <meta property="og:site_name" content="Mutuus Salud · En Alianza con JIRO y Asociados" />
        <meta property="og:title" content={heroTitle} />
        <meta property="og:description" content={heroSubtitle} />
        <meta property="og:url" content="https://landings.movi.digital/mutuus" />
        
        {/* Schema.org JSON-LD para SEO y GEO México */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            "name": "Membresía de Salud y Gastos Médicos Mutuus",
            "description": heroSubtitle,
            "brand": {
              "@type": "Brand",
              "name": "Mutuus"
            },
            "offers": {
              "@type": "AggregateOffer",
              "priceCurrency": "MXN",
              "lowPrice": "1299",
              "highPrice": "26990",
              "offerCount": "6"
            },
            "provider": {
              "@type": "Organization",
              "name": "JIRO y Asociados",
              "url": "https://jiro.mx"
            }
          })}
        </script>
      </Helmet>

      {/* ─── CONTENEDOR PRINCIPAL CON SCROLL NATIVO ──────────────────────── */}
      <div 
        className="w-full bg-white text-[#2B2A2A] font-sans antialiased selection:bg-[#003896] selection:text-white"
        style={{ 
          fontFamily: 'Montserrat, system-ui, -apple-system, sans-serif',
          '--primary-brand': primaryColor,
          '--accent-brand': accentColor
        } as React.CSSProperties}
      >

        {/* ─── TOP BAR: CO-BRANDING SUTIL JIRO & PORTAL OFICIAL ──────────── */}
        <div 
          className="text-white py-2 px-4 text-xs font-semibold flex flex-wrap items-center justify-between gap-3 border-b border-white/10"
          style={{ backgroundColor: '#002666' }}
        >
          <div className="max-w-7xl mx-auto w-full flex items-center justify-between text-[11px] sm:text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#9CD41C] animate-pulse" />
              <span className="text-white/90">
                Plataforma de Salud Digital & Seguro Hospitalario · <strong>Operado en alianza con JIRO y Asociados</strong>
              </span>
            </div>
            
            <a 
              href={MUTUUS_PORTAL_URL} 
              target="_blank" 
              rel="noopener noreferrer"
              className="hidden md:inline-flex items-center gap-1.5 font-bold text-white hover:text-[#9CD41C] transition-colors"
            >
              <span>Acceso al Portal de Clientes</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* ─── 1. HEADER STICKY (LOGOS OFICIALES Y NAVEGACIÓN) ───────────── */}
        <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
            
            {/* Logos Oficiales: Mutuus + Co-branding JIRO */}
            <div className="flex items-center gap-3 sm:gap-4">
              <a href="#inicio" className="flex items-center gap-2 group" aria-label="Mutuus Inicio">
                {/* Isotipo Mutuus SVG Oficial */}
                <div 
                  className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-black text-xl tracking-tighter shadow-md transition-transform group-hover:scale-105"
                  style={{ backgroundColor: primaryColor }}
                >
                  <svg className="w-6 h-6 fill-current text-white" viewBox="0 0 24 24">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </svg>
                </div>
                <div>
                  <span 
                    className="font-black text-2xl tracking-tighter block leading-none"
                    style={{ color: primaryColor }}
                  >
                    mutuus
                  </span>
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mt-0.5">
                    Salud Inteligente
                  </span>
                </div>
              </a>

              <div className="h-7 w-[1px] bg-slate-200 hidden sm:block" />

              {/* Badge Alianza JIRO */}
              <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-slate-100 border border-slate-200 text-slate-700">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-700" />
                <span>Alianza JIRO y Asociados</span>
              </div>
            </div>

            {/* Menú de Navegación Desktop */}
            <nav className="hidden lg:flex items-center gap-6 text-xs xl:text-sm font-bold text-slate-700">
              <a href="#porque-mutuus" className="hover:text-[#003896] transition-colors">¿Por qué Mutuus?</a>
              <a href="#simulador" className="hover:text-[#003896] transition-colors">Simulador</a>
              <a href="#planes" className="hover:text-[#003896] transition-colors">Planes y Precios</a>
              <a href="#red-hospitalaria" className="hover:text-[#003896] transition-colors">Red Hospitales</a>
              <a href="#coberturas" className="hover:text-[#003896] transition-colors">Coberturas</a>
              <a href="#faq" className="hover:text-[#003896] transition-colors">Preguntas</a>
            </nav>

            {/* Acciones Header: 100% Directo a Portal */}
            <div className="flex items-center gap-2.5">
              <a
                href={MUTUUS_PORTAL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-bold border border-slate-300 text-slate-700 hover:bg-slate-50 transition-all cursor-pointer active:scale-95"
              >
                <LogIn className="w-3.5 h-3.5 text-blue-700" />
                <span>Ingresar</span>
              </a>

              <a
                href={MUTUUS_PORTAL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs sm:text-sm font-extrabold text-white transition-all shadow-md active:scale-95 hover:opacity-95"
                style={{ backgroundColor: primaryColor }}
              >
                <span>Contratar en Línea</span>
                <ArrowRight className="w-4 h-4" />
              </a>

              {/* Botón Móvil Menú */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 rounded-xl text-slate-700 hover:bg-slate-100 transition-colors"
                aria-label="Abrir Menú"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>

          </div>

          {/* Menú Móvil Desplegable */}
          {mobileMenuOpen && (
            <div className="lg:hidden border-t border-slate-100 bg-white px-4 pt-3 pb-6 space-y-3 shadow-xl animate-in slide-in-from-top-2">
              <nav className="flex flex-col space-y-2 text-sm font-bold text-slate-800">
                <a 
                  href="#porque-mutuus" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 rounded-lg hover:bg-slate-50"
                >
                  ¿Por qué Mutuus?
                </a>
                <a 
                  href="#simulador" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 rounded-lg hover:bg-slate-50"
                >
                  Simulador de Ahorro
                </a>
                <a 
                  href="#planes" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 rounded-lg hover:bg-slate-50"
                >
                  Planes y Tarifas
                </a>
                <a 
                  href="#red-hospitalaria" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 rounded-lg hover:bg-slate-50"
                >
                  Red Médica Nacional
                </a>
                <a 
                  href="#coberturas" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 rounded-lg hover:bg-slate-50"
                >
                  Tabulador de Coberturas
                </a>
                <a 
                  href="#faq" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 rounded-lg hover:bg-slate-50"
                >
                  Preguntas Frecuentes
                </a>
              </nav>

              <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
                <a
                  href={MUTUUS_PORTAL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 px-4 rounded-xl text-center font-bold text-xs bg-slate-100 text-slate-800 flex items-center justify-center gap-2"
                >
                  <LogIn className="w-4 h-4 text-blue-700" />
                  <span>Acceso a Clientes</span>
                </a>
                <a
                  href={MUTUUS_PORTAL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3.5 px-4 rounded-xl text-center font-black text-xs text-white flex items-center justify-center gap-2 shadow-md"
                  style={{ backgroundColor: primaryColor }}
                >
                  <span>Contratar y Emitir en Línea</span>
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            </div>
          )}
        </header>

        {/* ─── 2. HERO SECTION CON MOCKUP VISUAL INTERACTIVO ──────────────── */}
        <section id="inicio" className="relative pt-10 pb-20 md:pt-16 md:pb-24 overflow-hidden bg-gradient-to-b from-[#F4F9FF] via-white to-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              
              {/* Contenido Hero Izquierdo */}
              <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
                
                {/* Badge Principal */}
                <div 
                  className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-extrabold border shadow-xs"
                  style={{ backgroundColor: '#EFF6FF', borderColor: '#CBD5E1', color: primaryColor }}
                >
                  <Sparkles className="w-4 h-4" style={{ color: primaryColor }} />
                  <span>{badgeText}</span>
                </div>

                {/* H1 Principal con SEO Keyword */}
                <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-[#2B2A2A] tracking-tight leading-[1.12]">
                  Membresía de salud y gastos médicos con{' '}
                  <span className="relative inline-block" style={{ color: primaryColor }}>
                    cero deducible
                    <span 
                      className="absolute left-0 bottom-1 w-full h-2.5 opacity-20 -z-10 rounded-sm"
                      style={{ backgroundColor: accentColor }}
                    />
                  </span>
                </h1>

                {/* Subtítulo */}
                <p className="text-base sm:text-lg text-slate-600 leading-relaxed font-normal max-w-2xl mx-auto lg:mx-0">
                  {heroSubtitle}
                </p>

                {/* Sellos de Confianza y Respaldo Institucional */}
                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 text-xs font-semibold text-slate-500 pt-1">
                  <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 px-3 py-1.5 rounded-full">
                    <Award className="w-3.5 h-3.5 text-blue-700" />
                    Respaldo Institucional en México
                  </span>
                  <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800 px-3 py-1.5 rounded-full">
                    <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                    Pago Directo 115+ Hospitales
                  </span>
                </div>

                {/* Botones de Acción (CTAs Directos) */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center lg:justify-start gap-4 pt-2">
                  <a
                    href={MUTUUS_PORTAL_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-3 px-8 py-4 rounded-full text-base font-black text-white transition-all shadow-xl hover:scale-102 active:scale-98 cursor-pointer"
                    style={{ backgroundColor: primaryColor }}
                  >
                    <span>Contratar y Emitir en Línea</span>
                    <ArrowRight className="w-5 h-5" />
                  </a>

                  <a
                    href="#simulador"
                    className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-full text-base font-bold bg-white border-2 hover:bg-[#EFF6FF] transition-all text-center cursor-pointer"
                    style={{ borderColor: primaryColor, color: primaryColor }}
                  >
                    <Calculator className="w-4 h-4" />
                    <span>Simular mi Ahorro</span>
                  </a>
                </div>

                {/* 3 Pilares rápidos */}
                <div className="pt-6 border-t border-slate-200/80 grid grid-cols-3 gap-3 text-left">
                  <div className="space-y-0.5">
                    <p className="font-black text-lg sm:text-xl text-slate-900">$0 Deducible</p>
                    <p className="text-[11px] text-slate-500 leading-tight">En red de pago directo</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="font-black text-lg sm:text-xl text-slate-900">24/7 Video</p>
                    <p className="text-[11px] text-slate-500 leading-tight">Médicos y pediatras</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="font-black text-lg sm:text-xl text-slate-900">100% Digital</p>
                    <p className="text-[11px] text-slate-500 leading-tight">Emisión en minutos</p>
                  </div>
                </div>

              </div>

              {/* Tarjeta Visual Hero Derecha (Glassmorphism & Comparativa) */}
              <div className="lg:col-span-5 relative">
                <div 
                  className="relative rounded-3xl p-6 sm:p-8 text-white shadow-2xl border border-white/20 overflow-hidden"
                  style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, #00173d 100%)` }}
                >
                  <div 
                    className="absolute -top-24 -right-24 w-60 h-60 rounded-full blur-3xl pointer-events-none opacity-20"
                    style={{ backgroundColor: accentColor }}
                  />
                  
                  <div className="relative z-10 space-y-6">
                    <div className="flex items-center justify-between">
                      <div 
                        className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs font-bold border border-white/10"
                        style={{ color: accentColor }}
                      >
                        <Hospital className="w-4 h-4" />
                        <span>Pago Directo al Hospital</span>
                      </div>
                      <span className="text-[10px] font-bold text-white/80 uppercase tracking-wider bg-white/10 px-2.5 py-1 rounded-full">
                        Emisión Digital
                      </span>
                    </div>

                    <h3 className="text-2xl font-black text-white leading-snug">
                      La diferencia de no pagar deducible:
                    </h3>

                    <div className="space-y-3">
                      <div className="p-3.5 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-between">
                        <div>
                          <p className="text-xs text-white/70">Seguro Tradicional</p>
                          <p className="text-sm font-bold text-white">Deducible + Coaseguro</p>
                        </div>
                        <span className="text-rose-300 font-black text-base">$60,000+ MXN</span>
                      </div>

                      <div 
                        className="p-4 rounded-2xl text-slate-900 border flex items-center justify-between shadow-xl"
                        style={{ backgroundColor: accentColor, borderColor: accentColor }}
                      >
                        <div>
                          <p className="text-xs font-bold text-slate-800">Con Membresía Mutuus</p>
                          <p className="text-base font-black text-slate-900">Pago en Red de Convenio</p>
                        </div>
                        <span className="text-3xl font-black text-slate-900">$0 MXN</span>
                      </div>
                    </div>

                    <p className="text-xs text-white/75 leading-relaxed">
                      Sin trámites engorrosos de reembolso ni desembolsos iniciales que desestabilicen el patrimonio de tu familia.
                    </p>

                    <a
                      href={MUTUUS_PORTAL_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-4 px-6 rounded-full font-black text-sm text-slate-900 transition-all shadow-xl hover:scale-102 active:scale-98 cursor-pointer text-center flex items-center justify-center gap-2"
                      style={{ backgroundColor: accentColor }}
                    >
                      <span>Contratar Membresía en Línea</span>
                      <ExternalLink className="w-4 h-4 text-slate-900" />
                    </a>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ─── 3. VIDEO TOUR INTERACTIVO Y CÓMO FUNCIONA ───────────────────── */}
        <section className="py-16 bg-white border-y border-slate-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              
              <div className="lg:col-span-5 space-y-4">
                <span className="px-3 py-1 rounded-full bg-[#EFF6FF] text-xs font-bold text-blue-700 uppercase tracking-wider">
                  Experiencia Digital
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
                  ¿Cómo funciona tu membresía en una urgencia o consulta?
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Mutuus digitaliza todo el camino de atención médica: desde que sientes un malestar hasta que ingresas a un hospital sin pagar deducibles.
                </p>

                <div className="space-y-3 pt-2">
                  <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                    <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-800 font-black text-xs flex items-center justify-center flex-shrink-0">1</div>
                    <div>
                      <h4 className="font-bold text-xs text-slate-900">Videoconsulta Inmediata</h4>
                      <p className="text-[11px] text-slate-500">Médicos certificados atienden tus síntomas leves en minutos desde la app.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                    <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-800 font-black text-xs flex items-center justify-center flex-shrink-0">2</div>
                    <div>
                      <h4 className="font-bold text-xs text-slate-900">Receta Médica Electrónica</h4>
                      <p className="text-[11px] text-slate-500">Recibe tu receta firmada digitalmente válida en cualquier farmacia.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                    <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-800 font-black text-xs flex items-center justify-center flex-shrink-0">3</div>
                    <div>
                      <h4 className="font-bold text-xs text-slate-900">Pase Directo a Hospital</h4>
                      <p className="text-[11px] text-slate-500">En una emergencia, la app coordina tu ingreso con $0 deducible.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Showcase Visual App Mockup */}
              <div className="lg:col-span-7 flex justify-center">
                <div className="relative w-full max-w-lg p-6 sm:p-8 rounded-3xl bg-slate-900 text-white shadow-2xl border border-slate-800 overflow-hidden">
                  <div className="flex items-center justify-between pb-4 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-rose-500" />
                      <span className="w-3 h-3 rounded-full bg-amber-500" />
                      <span className="w-3 h-3 rounded-full bg-emerald-500" />
                    </div>
                    <span className="text-xs font-bold text-white/70">App Mutuus · Demo 24/7</span>
                  </div>

                  <div className="py-6 space-y-4">
                    <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Stethoscope className="w-7 h-7 text-[#9CD41C]" />
                        <div>
                          <p className="text-xs text-white/70">Consulta en Vivo</p>
                          <p className="text-sm font-bold text-white">Médico General y Pediatría 24/7</p>
                        </div>
                      </div>
                      <span className="text-[10px] px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">Disponible</span>
                    </div>

                    <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Hospital className="w-7 h-7 text-blue-300" />
                        <div>
                          <p className="text-xs text-white/70">Hospital Más Cercano</p>
                          <p className="text-sm font-bold text-white">115+ Hospitales en Red de Pago Directo</p>
                        </div>
                      </div>
                      <span className="text-[10px] px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 font-bold">$0 Deducible</span>
                    </div>

                    <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CreditCard className="w-7 h-7 text-[#9CD41C]" />
                        <div>
                          <p className="text-xs text-white/70">Credencial Digital</p>
                          <p className="text-sm font-bold text-white">Pase Inmediato en Admisión</p>
                        </div>
                      </div>
                      <span className="text-[10px] px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">Activa</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                    <p className="text-xs text-white/70">Contratación 100% digital en línea</p>
                    <a
                      href={MUTUUS_PORTAL_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-5 py-2.5 rounded-full text-xs font-black text-slate-900 transition-all shadow-md active:scale-95"
                      style={{ backgroundColor: accentColor }}
                    >
                      Empezar Registro
                    </a>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ─── 4. SIMULADOR INTERACTIVO DE AHORRO FINANCIERO ──────────────── */}
        <section id="simulador" className="py-20 bg-[#F4F9FF]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            
            <div className="text-center max-w-3xl mx-auto space-y-3 mb-12">
              <span className="px-3 py-1 rounded-full bg-white border border-[#CBD5E1] text-xs font-bold uppercase tracking-wider" style={{ color: primaryColor }}>
                Calculadora Financiera
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900">
                Simula tu ahorro frente a un seguro tradicional
              </h2>
              <p className="text-slate-600 text-sm sm:text-base">
                Compara cuánto pagarías de tu bolsillo en una emergencia hospitalaria de acuerdo al monto de la cuenta.
              </p>
            </div>

            <div className="p-6 sm:p-10 rounded-3xl bg-white border-2 border-slate-200/80 shadow-xl space-y-8">
              
              {/* Slider de Cuenta Hospitalaria */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="text-sm font-extrabold text-slate-800">
                    Monto estimado de la cuenta hospitalaria:
                  </label>
                  <span className="text-2xl font-black text-blue-900">
                    ${montoCuentaHospital.toLocaleString('es-MX')} MXN
                  </span>
                </div>

                <input 
                  type="range"
                  min="50000"
                  max="1000000"
                  step="25000"
                  value={montoCuentaHospital}
                  onChange={(e) => setMontoCuentaHospital(Number(e.target.value))}
                  className="w-full h-3 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#003896]"
                />
                
                <div className="flex justify-between text-[11px] font-bold text-slate-400">
                  <span>$50,000 MXN</span>
                  <span>$500,000 MXN</span>
                  <span>$1,000,000 MXN</span>
                </div>
              </div>

              {/* Resultado Comparativo */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                
                {/* Caja Seguro Tradicional */}
                <div className="p-6 rounded-2xl bg-rose-50/60 border border-rose-200/80 space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-rose-800">Con Seguro Tradicional</p>
                  <div className="space-y-1.5 text-xs text-slate-700">
                    <div className="flex justify-between">
                      <span>Deducible inicial promedio:</span>
                      <span className="font-bold text-rose-700">$25,000 MXN</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Coaseguro (10% de la cuenta):</span>
                      <span className="font-bold text-rose-700">${coaseguroTradicional.toLocaleString('es-MX')} MXN</span>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-rose-200/60 flex justify-between items-baseline">
                    <span className="text-xs font-bold text-slate-800">Pago de tu bolsillo:</span>
                    <span className="text-2xl font-black text-rose-600">${gastoTradicional.toLocaleString('es-MX')} MXN</span>
                  </div>
                </div>

                {/* Caja Con Mutuus */}
                <div 
                  className="p-6 rounded-2xl border-2 space-y-3 shadow-md relative"
                  style={{ backgroundColor: '#F4F9FF', borderColor: primaryColor }}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wider" style={{ color: primaryColor }}>Con Membresía Mutuus</p>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">Cero Gasto Sorpresa</span>
                  </div>
                  <div className="space-y-1.5 text-xs text-slate-700">
                    <div className="flex justify-between">
                      <span>Deducible en red:</span>
                      <span className="font-bold text-emerald-700">$0 MXN (100% Condonado)</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Coaseguro en red:</span>
                      <span className="font-bold text-emerald-700">$0 MXN (100% Condonado)</span>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-blue-200/60 flex justify-between items-baseline">
                    <span className="text-xs font-bold text-slate-800">Pago de tu bolsillo:</span>
                    <span className="text-3xl font-black text-emerald-600">$0 MXN</span>
                  </div>
                </div>

              </div>

              {/* Botón CTA del Simulador */}
              <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-black text-emerald-950">
                    ¡Ahorras aproximadamente ${ahorroTotal.toLocaleString('es-MX')} MXN en este evento!
                  </p>
                  <p className="text-xs text-emerald-800">
                    Emite tu membresía en línea y queda protegido desde hoy.
                  </p>
                </div>
                <a
                  href={MUTUUS_PORTAL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto px-7 py-3 rounded-full text-xs font-black text-slate-900 transition-all shadow-md active:scale-95 text-center flex-shrink-0"
                  style={{ backgroundColor: accentColor }}
                >
                  Contratar este Plan en Línea
                </a>
              </div>

            </div>

          </div>
        </section>

        {/* ─── 5. PLANES Y PRECIOS TRANSPARENTES ──────────────────────────── */}
        <section id="planes" className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            
            <div className="text-center max-w-3xl mx-auto space-y-4 mb-12">
              <span className="px-3 py-1 rounded-full bg-[#EFF6FF] border border-[#CBD5E1] text-xs font-bold uppercase tracking-wider" style={{ color: primaryColor }}>
                Tarifas y Coberturas Oficiales
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900">
                Elige el plan diseñado para tu estilo de vida
              </h2>
              <p className="text-slate-600 text-sm sm:text-base">
                Precios claros, sin costos ocultos ni letras pequeñas. Emisión digital directa en el portal oficial.
              </p>

              {/* Selector Anual / Mensual */}
              <div className="pt-4 flex items-center justify-center">
                <div className="bg-slate-100 p-1.5 rounded-full border border-slate-200 shadow-xs inline-flex">
                  <button
                    onClick={() => setPeriodicidad('anual')}
                    className={`px-6 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      periodicidad === 'anual'
                        ? 'text-white shadow-md'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    style={periodicidad === 'anual' ? { backgroundColor: primaryColor } : {}}
                  >
                    Pago Anual (Ahorro 10%)
                  </button>
                  <button
                    onClick={() => setPeriodicidad('mensual')}
                    className={`px-6 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      periodicidad === 'mensual'
                        ? 'text-white shadow-md'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    style={periodicidad === 'mensual' ? { backgroundColor: primaryColor } : {}}
                  >
                    Pago Mensual Flexible
                  </button>
                </div>
              </div>
            </div>

            {/* Grid de Tarjetas de Planes */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
              {plans.map((p) => (
                <div
                  key={p.id}
                  className={`rounded-3xl p-6 sm:p-8 bg-white transition-all duration-300 flex flex-col justify-between relative ${
                    p.popular
                      ? 'border-2 shadow-2xl scale-102 lg:-translate-y-2 ring-4'
                      : 'border border-slate-200 shadow-md hover:shadow-xl'
                  }`}
                  style={p.popular ? { borderColor: primaryColor, ringColor: `${primaryColor}15` } : {}}
                >
                  {p.popular && (
                    <div 
                      className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-white text-xs font-black uppercase tracking-wide shadow-md"
                      style={{ backgroundColor: primaryColor }}
                    >
                      {p.badge}
                    </div>
                  )}

                  <div>
                    {!p.popular && (
                      <span className="inline-block px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold mb-3">
                        {p.badge}
                      </span>
                    )}

                    <h3 className="text-2xl font-black text-slate-900 mt-2">{p.nombre}</h3>
                    
                    <div className="mt-4 pb-5 border-b border-slate-100">
                      <p className="text-xs text-slate-500 font-medium">Suma Asegurada por Evento:</p>
                      <p className="text-xl font-black" style={{ color: primaryColor }}>{p.sumaAsegurada}</p>
                      
                      <div className="mt-3 flex items-baseline gap-1">
                        <span className="text-3xl sm:text-4xl font-black text-slate-900">{p.pagoInicial}</span>
                        <span className="text-xs text-slate-500 font-semibold">MXN / {periodicidad === 'anual' ? 'año' : 'mes'}</span>
                      </div>
                      
                      {p.descuento && (
                        <span className="inline-block mt-1 px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[11px] font-extrabold">
                          {p.descuento}
                        </span>
                      )}
                    </div>

                    <ul className="mt-6 space-y-3 text-xs sm:text-sm text-slate-700">
                      {p.caracteristicas.map((c, idx) => (
                        <li key={idx} className="flex items-start gap-2.5">
                          <Check className="w-4 h-4 text-[#22C55E] flex-shrink-0 mt-0.5 stroke-[3]" />
                          <span>{c}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-8 pt-6 border-t border-slate-100">
                    <a
                      href={MUTUUS_PORTAL_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-4 px-6 rounded-full font-black text-xs sm:text-sm transition-all shadow-md active:scale-95 cursor-pointer text-center flex items-center justify-center gap-2 text-white hover:opacity-95"
                      style={{ backgroundColor: p.popular ? primaryColor : '#0f172a' }}
                    >
                      <span>Contratar {p.nombre}</span>
                      <ArrowRight className="w-4 h-4" />
                    </a>
                  </div>

                </div>
              ))}
            </div>

            <p className="text-center text-xs text-slate-400 mt-10">
              * Tarifas en Moneda Nacional con IVA incluido. Consulta condicionado general de póliza para sumas aseguradas por parentesco.
            </p>

          </div>
        </section>

        {/* ─── 6. RED HOSPITALARIA CON FILTRO INTERACTIVO POR ESTADO ───────── */}
        <section id="red-hospitalaria" className="py-20 bg-[#F4F9FF]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            
            <div className="text-center max-w-3xl mx-auto space-y-3 mb-10">
              <span className="px-3 py-1 rounded-full bg-white border border-[#CBD5E1] text-xs font-bold uppercase tracking-wider" style={{ color: primaryColor }}>
                Red Médica Nacional
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900">
                Hospitales de Pago Directo en todo México
              </h2>
              <p className="text-slate-600 text-sm sm:text-base">
                Más de <strong>115 hospitales de pago directo</strong> y más de <strong>548 instituciones médicas</strong> en convenio nacional.
              </p>
            </div>

            {/* Filtros Rápidos por Estado */}
            <div className="flex flex-wrap items-center justify-center gap-2 mb-10">
              {['Todos', 'CDMX', 'Jalisco', 'Nuevo León', 'Puebla', 'Querétaro', 'Guanajuato'].map((est) => (
                <button
                  key={est}
                  onClick={() => setSelectedEstado(est)}
                  className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    selectedEstado === est
                      ? 'bg-[#003896] text-white shadow-sm'
                      : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  {est}
                </button>
              ))}
            </div>

            {/* Grid de Hospitales */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredHospitales.map((h, i) => (
                <div
                  key={i}
                  className="p-6 rounded-2xl bg-white border border-slate-200/80 hover:shadow-lg transition-all group space-y-3"
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center font-bold text-lg group-hover:bg-[#003896] group-hover:text-white transition-colors"
                      style={{ color: primaryColor }}
                    >
                      <Hospital className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-black text-slate-900 text-base">{h.nombre}</h4>
                      <span className="text-[11px] font-bold text-blue-700 uppercase">{h.tipo}</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 flex items-start gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                    <span>Sedes: {h.sedes}</span>
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-10 p-6 rounded-2xl bg-white border border-blue-200/80 text-center max-w-2xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
              <div className="text-left">
                <p className="text-xs sm:text-sm font-bold text-slate-900">
                  ¿Listo para proteger a tu familia con la red hospitalaria?
                </p>
                <p className="text-xs text-slate-500">
                  Emisión en menos de 5 minutos desde el portal oficial de autoservicio.
                </p>
              </div>
              <a
                href={MUTUUS_PORTAL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3 rounded-full text-xs font-black text-white transition-all shadow-md active:scale-95 inline-flex items-center gap-1.5 flex-shrink-0"
                style={{ backgroundColor: primaryColor }}
              >
                <span>Contratar en Línea</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

          </div>
        </section>

        {/* ─── 7. COBERTURA: QUÉ ESTÁ CUBIERTO VS EXCLUSIONES ─────────────── */}
        <section id="coberturas" className="py-20 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            
            <div className="text-center max-w-2xl mx-auto space-y-3 mb-12">
              <span className="px-3 py-1 rounded-full bg-[#EFF6FF] text-xs font-bold text-blue-700 uppercase tracking-wider">
                Transparencia Total
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900">
                Claridad en lo que cubre tu membresía
              </h2>
              <p className="text-slate-600 text-sm">
                Sin letras chiquitas. Conoce con total exactitud el alcance de tu protección médica.
              </p>

              <div className="pt-4 flex justify-center">
                <div className="bg-slate-100 p-1.5 rounded-full border border-slate-200 shadow-xs inline-flex">
                  <button
                    onClick={() => setTabCobertura('cubierto')}
                    className={`px-6 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      tabCobertura === 'cubierto'
                        ? 'bg-[#22C55E] text-white shadow-md'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    ✓ Qué está Cubierto
                  </button>
                  <button
                    onClick={() => setTabCobertura('no_cubierto')}
                    className={`px-6 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      tabCobertura === 'no_cubierto'
                        ? 'bg-rose-600 text-white shadow-md'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    ✕ Qué no Cubre (Exclusiones)
                  </button>
                </div>
              </div>
            </div>

            {tabCobertura === 'cubierto' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { t: 'Hospitalización y Cuidados Intensivos', d: 'Habitación estándar, estancia hospitalaria y terapia intensiva por enfermedad o accidente.' },
                  { t: 'Honorarios Quirúrgicos y Médicos', d: 'Cirujano, anestesiólogo, ayudantes y médicos interconsultantes de la red autorizada.' },
                  { t: 'Medicamentos Intrahospitalarios', d: 'Fármacos administrados durante la estancia hospitalaria cubierta.' },
                  { t: 'Telemedicina Ilimitada 24/7', d: 'Consultas médicas por video y chat sin costo adicional en cualquier momento.' },
                  { t: 'Ambulancia Terrestre de Urgencia', d: 'Traslados de emergencia hacia el hospital de la red en eventos calificados.' },
                  { t: 'Maternidad (Parto / Cesárea)', d: 'Ayuda por maternidad tras cumplir 10 meses continuos de antigüedad con la póliza.' },
                  { t: 'Estudios de Laboratorio y Gabinete', d: 'Rayos X, tomografías, resonancias y análisis clínicos intrahospitalarios.' },
                  { t: 'Tratamientos Oncológicos', d: 'Quimioterapia, radioterapia y terapias dirigidas conforme a condiciones generales.' }
                ].map((item, idx) => (
                  <div key={idx} className="p-5 rounded-2xl bg-[#F4F9FF] border border-emerald-100 shadow-xs flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 text-[#22C55E] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{item.t}</h4>
                      <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{item.d}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { t: 'Cirugías Estéticas o Cosméticas', d: 'Procedimientos con fines estéticos o de embellecimiento no reconstructivo.' },
                  { t: 'Padecimientos Preexistentes No Declarados', d: 'Enfermedades diagnosticadas antes de la contratación que no hayan superado periodo de espera.' },
                  { t: 'Tratamientos Experimentales', d: 'Medicamentos o procedimientos no avalados por las autoridades sanitarias oficiales.' },
                  { t: 'Check-ups fuera de red', d: 'Estudios de rutina realizados en instituciones no autorizadas en el plan.' },
                  { t: 'Deportes Extremos Profesionales', d: 'Prácticas deportivas de alto riesgo remuneradas o competencias oficiales sin endoso.' },
                  { t: 'Tratamientos Dentales Mayores', d: 'Ortodoncia o implantes fuera de las asistencias dentales básicas incluidas.' }
                ].map((item, idx) => (
                  <div key={idx} className="p-5 rounded-2xl bg-rose-50/50 border border-rose-100 shadow-xs flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <X className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{item.t}</h4>
                      <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{item.d}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>
        </section>

        {/* ─── 8. FAQ ACCORDION CON CONTENIDO RICO ─────────────────────────── */}
        <section id="faq" className="py-20 bg-[#F4F9FF]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            
            <div className="text-center space-y-3 mb-12">
              <span className="px-3 py-1 rounded-full bg-white border border-[#CBD5E1] text-xs font-bold uppercase tracking-wider" style={{ color: primaryColor }}>
                Resolvemos tus Dudas
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900">
                Preguntas Frecuentes
              </h2>
              <p className="text-slate-600 text-sm">
                Todo lo que necesitas saber antes de contratar tu membresía de salud.
              </p>
            </div>

            <div className="space-y-3">
              {allFaqs.map((faq, idx) => {
                const isOpen = openFaq === idx;
                return (
                  <div
                    key={idx}
                    className="rounded-2xl bg-white border border-slate-200/80 overflow-hidden transition-all shadow-xs"
                  >
                    <button
                      onClick={() => setOpenFaq(isOpen ? null : idx)}
                      className="w-full p-5 text-left flex items-center justify-between gap-4 font-bold text-slate-900 text-sm sm:text-base hover:opacity-80 transition-opacity cursor-pointer"
                    >
                      <span>{faq.q}</span>
                      {isOpen ? (
                        <ChevronUp className="w-5 h-5 flex-shrink-0" style={{ color: primaryColor }} />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0" />
                      )}
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

        {/* ─── 9. CTA FINAL CON ENLACE DIRECTO AL PORTAL DE REGISTRO ───────── */}
        <section id="contacto" className="py-20 text-white" style={{ backgroundColor: primaryColor }}>
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-white rounded-3xl p-8 sm:p-14 text-slate-900 shadow-2xl border-4 border-emerald-400 text-center space-y-8">
              
              <div className="space-y-3 max-w-2xl mx-auto">
                <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black uppercase tracking-wider">
                  <Zap className="w-4 h-4 text-emerald-700" />
                  Emisión 100% Digital en Autoservicio
                </span>
                <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                  Comienza tu Contratación Digital Inmediata
                </h2>
                <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                  Ingresa al portal oficial de registro y autoservicio Mutuus. Elige tu plan, llena tus datos y recibe tu póliza y credencial digital en minutos.
                </p>
              </div>

              {/* 3 Pasos rápidos */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left max-w-2xl mx-auto">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-black text-xs flex items-center justify-center mb-2">1</div>
                  <h4 className="font-bold text-xs text-slate-900">Elige tu Plan</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">Plan UNO, DOS o PLUS según tu cobertura ideal.</p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-black text-xs flex items-center justify-center mb-2">2</div>
                  <h4 className="font-bold text-xs text-slate-900">Completa tus Datos</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">Registro seguro y confidencial en línea.</p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-black text-xs flex items-center justify-center mb-2">3</div>
                  <h4 className="font-bold text-xs text-slate-900">Activa tu Cobertura</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">Pago seguro en línea y recepción inmediata.</p>
                </div>
              </div>

              {/* Botón Gigante de Contratación */}
              <div className="pt-2">
                <a
                  href={MUTUUS_PORTAL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-10 py-5 rounded-full font-black text-base text-slate-900 transition-all shadow-xl hover:scale-105 active:scale-95 cursor-pointer"
                  style={{ backgroundColor: accentColor }}
                >
                  <CreditCard className="w-5 h-5 text-slate-900" />
                  <span>Ingresar al Portal y Contratar Ahora</span>
                  <ExternalLink className="w-5 h-5 text-slate-900" />
                </a>
                <p className="text-xs text-slate-500 mt-3 flex items-center justify-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Conexión cifrada SSL directa con Mutuus Seguros</span>
                </p>
              </div>

            </div>
          </div>
        </section>

        {/* ─── 10. FOOTER CON CO-BRANDING JIRO ─────────────────────────────── */}
        <footer className="bg-[#001738] text-white/80 text-xs py-14 border-t border-white/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              
              {/* Mutuus Col */}
              <div className="space-y-3">
                <span className="font-black text-2xl text-white tracking-tight block">
                  mutuus
                </span>
                <p className="text-white/70 text-xs leading-relaxed">
                  Membresía médica integral y seguro de gastos médicos mayores con $0 deducible en red de pago directo en todo México.
                </p>
                <div className="pt-1">
                  <a
                    href={MUTUUS_PORTAL_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-bold text-[#9CD41C] underline hover:text-white inline-flex items-center gap-1"
                  >
                    <LogIn className="w-3 h-3" />
                    <span>Portal Oficial de Registro y Emisión</span>
                  </a>
                </div>
              </div>

              {/* JIRO Cobranding Col */}
              <div className="space-y-3">
                <p className="font-bold text-white text-sm">Operación & Asesoría</p>
                <p className="text-white/70 text-xs leading-relaxed">
                  Sitio web y plataforma digital operados en alianza con <strong className="text-white">JIRO y Asociados</strong> (jiro.mx).
                </p>
                <div className="inline-flex items-center gap-2 p-2 rounded-xl bg-white/5 border border-white/10">
                  <img 
                    src="/logojiro.png" 
                    alt="JIRO y Asociados" 
                    className="h-6 w-auto object-contain brightness-0 invert opacity-90"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  <span className="text-[11px] font-bold text-white/90">JIRO y Asociados</span>
                </div>
              </div>

              {/* Secciones */}
              <div className="space-y-2">
                <p className="font-bold text-white text-sm">Secciones</p>
                <ul className="space-y-1.5 text-white/70">
                  <li><a href="#porque-mutuus" className="hover:text-white transition-colors">¿Por qué Mutuus?</a></li>
                  <li><a href="#simulador" className="hover:text-white transition-colors">Simulador de Ahorro</a></li>
                  <li><a href="#planes" className="hover:text-white transition-colors">Planes UNO, DOS y PLUS</a></li>
                  <li><a href="#red-hospitalaria" className="hover:text-white transition-colors">Red de Hospitales</a></li>
                  <li><a href="#coberturas" className="hover:text-white transition-colors">Tabulador de Coberturas</a></li>
                  <li><a href="#faq" className="hover:text-white transition-colors">Preguntas Frecuentes</a></li>
                </ul>
              </div>

              {/* Portal & Documentos */}
              <div className="space-y-2">
                <p className="font-bold text-white text-sm">Portal & Documentos</p>
                <ul className="space-y-1.5 text-white/70">
                  <li>
                    <a href={MUTUUS_PORTAL_URL} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors flex items-center gap-1 text-[#9CD41C] font-bold">
                      <ExternalLink className="w-3.5 h-3.5" /> Portal de Autoservicio
                    </a>
                  </li>
                  <li><a href="#" className="hover:text-white transition-colors flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> Condiciones Generales Póliza</a></li>
                  <li><a href="#" className="hover:text-white transition-colors flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> Manual de Membresía Salud</a></li>
                  <li><a href="#" className="hover:text-white transition-colors flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> Términos y Condiciones</a></li>
                  <li><a href="#" className="hover:text-white transition-colors flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> Aviso de Privacidad Integral</a></li>
                </ul>
              </div>
            </div>

            <div className="pt-8 border-t border-white/10 space-y-2 text-[11px] text-white/50 leading-relaxed">
              <p>
                * Mutuus es una marca registrada. La condonación del deducible y coaseguro opera bajo el estricto cumplimiento del protocolo de atención en la red de pago directo y reporte previo del evento médico. Cobertura de maternidad sujeta a 10 meses continuos de antigüedad.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-between pt-4 text-white/40">
                <p>© {new Date().getFullYear()} landings.movi.digital/mutuus · Todos los derechos reservados.</p>
                <p>En alianza con JIRO y Asociados (jiro.mx) · Optimizado para SEO & GEO México</p>
              </div>
            </div>
          </div>
        </footer>

        {/* ─── BOTÓN FLOTANTE ÚNICO: CONTRATAR EN LÍNEA ───────────────────── */}
        <div className="fixed bottom-6 right-6 z-40">
          <a
            href={MUTUUS_PORTAL_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Contratar en Línea"
            className="px-6 py-4 rounded-full text-slate-900 font-black text-sm shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center gap-2.5 border-2 border-white"
            style={{ backgroundColor: accentColor }}
          >
            <CreditCard className="w-5 h-5 text-slate-900" />
            <span>Contratar en Línea</span>
            <ExternalLink className="w-4 h-4 text-slate-900" />
          </a>
        </div>

      </div>
    </>
  );
}
