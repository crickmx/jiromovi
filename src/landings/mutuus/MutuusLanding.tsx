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
  Menu, 
  HeartHandshake, 
  Smartphone, 
  Calculator,
  Pill,
  Award,
  PhoneCall,
  Activity,
  UserCheck
} from 'lucide-react';

export const MUTUUS_PORTAL_URL = 'https://selfservice.psmutuus.com/agente/A-3522/promo/A-3522';

// ─── LOGO MUTUUS OFICIAL (copia local del archivo oficial) ─────────────────
export function MutuusOfficialLogo({ className = "h-11 w-auto", dark = false }: { className?: string; dark?: boolean }) {
  return (
    <img
      src="/brand/mutuus/logo-mutuus-oficial.svg"
      alt="Mutuus Salud Inteligente"
      className={className}
      style={{
        objectFit: 'contain',
        filter: dark ? 'brightness(0) invert(1)' : 'none'
      }}
      loading="eager"
    />
  );
}

export interface LandingCustomization {
  heroTitle?: string;
  heroSubtitle?: string;
  badgeText?: string;
  primaryColor?: string;
  accentColor?: string;
  ctaText?: string;
  promoBanner?: string;
  plansData?: typeof PLANES_DATA;
  customFaqs?: Array<{ q: string; a: string }>;
}

// ─── Fuente de toda la información de esta página ────────────────────────────
// "Presentación Mutuus JULIO 2026" y "Lista de Precios Julio 2026" (vigencia a partir
// del 1 de julio de 2026). Si cambia algo, se cambia contra esos documentos, no a mano.
export const MUTUUS_TELEFONO = '55 8525 8800';

// ─── FAQ Data ────────────────────────────────────────────────────────────────
const DEFAULT_FAQS = [
  {
    q: '¿Qué es Mutuus?',
    a: 'Mutuus es un Seguro Médico Inteligente: una InsureTech (compañía tecnológica de salud privada) con 8 años en el mercado y respaldada por MetLife, que te da acceso a la mayoría de los mejores hospitales privados del país cuando el diagnóstico lo requiera, sin deducible y sin coaseguro.'
  },
  {
    q: '¿Cómo obtengo el beneficio de $0 deducible y $0 coaseguro?',
    a: `Todos los eventos se deben REPORTAR por teléfono al ${MUTUUS_TELEFONO} o por la app móvil de Mutuus. Así obtienes el beneficio de 0 deducible y 0 coaseguro en padecimientos cubiertos de acuerdo con las Condiciones Generales de la póliza incluida en tu Seguro Médico Inteligente. Toda atención hospitalaria se somete a un dictamen médico que determina si procede la cobertura y, en consecuencia, el pago de la cuenta hospitalaria.`
  },
  {
    q: '¿Qué hospitales puedo usar?',
    a: 'Mutuus tiene más de 600 hospitales registrados en una red hospitalaria privada de prestigio nacional (red preferente y de reembolso), además de una amplia red de laboratorios en todo el país. Antes de ir a cualquier hospital es fundamental seguir las recomendaciones del equipo de especialistas de Mutuus, para asegurar que tu cobertura sea la adecuada y evitar costos adicionales.'
  },
  {
    q: '¿Cubre maternidad, parto o cesárea?',
    a: 'Sí. La cobertura de maternidad tiene una suma asegurada de 20 UMAM para parto normal, 25 UMAM para cesárea y $1 millón de pesos para complicaciones del embarazo. Aplica un periodo de espera de 30 días para la gestación del embarazo.'
  },
  {
    q: '¿Cuáles son las edades de aceptación?',
    a: 'De 18 a 63 años 11 meses. A partir de los 70 años está Adulto Inteligente (hasta los 99 años). Los menores de 18 años pueden contratar, siempre ligados a un titular mayor de edad.'
  },
  {
    q: '¿Hay periodo de espera?',
    a: 'Durante los primeros 30 días de vigencia, la póliza de Gastos Médicos Mayores no cubre enfermedades originadas en ese lapso; los accidentes sí están cubiertos desde el primer día. Algunos padecimientos tienen periodos de espera de dos o cinco años (consulta la sección de coberturas).'
  },
  {
    q: '¿Cubre enfermedades preexistentes?',
    a: 'No. No se cubren preexistencias, declaradas o no declaradas.'
  },
  {
    q: '¿Cómo contrato?',
    a: 'En línea, desde el portal de autoservicio de Mutuus con la promotoría A-3522 de Grupo JIRO: eliges tu plan, capturas tus datos y realizas tu pago. Se aceptan Visa, MasterCard y American Express.'
  }
];

// ─── Planes Data (precios de lista vigentes, titulares mayores de 18 años) ───
type FormaPago = 'anual' | 'msi' | 'flex';

const PLANES_DATA = [
  {
    id: 'uno',
    nombre: 'Plan UNO',
    badge: 'Esencial',
    sumaAsegurada: '$1,000,000 MXN',
    popular: false,
    precios: {
      anual: { principal: '$20,376', detalle: 'Un solo pago al año · equivale a $1,698 al mes' },
      msi: { principal: '$2,017', detalle: '12 cargos mensuales a tarjeta de crédito · $24,204 al año' },
      flex: { principal: '$1,500', detalle: 'Pago inicial de $5,000 y 11 mensualidades de $1,500 · $21,500 al año' }
    },
    menores: '$8,916 al año o $743 al mes',
    caracteristicas: [
      'Suma asegurada de $1,000,000 al año, reinstalable',
      '$0 de deducible y 0% de coaseguro en la red, al reportar tu evento',
      'Telemedicina 24/7 con urgenciólogo y médico general',
      'Nutriólogo y psicólogo sin límite de consultas en la app',
      'Checkup básico y limpieza dental, una vez al año',
      'Ambulancia terrestre para urgencias',
      'Especialistas con tarifa preferencial',
      'Gastos funerarios',
      '$100,000 por muerte accidental'
    ]
  },
  {
    id: 'dos',
    nombre: 'Plan DOS',
    badge: 'El más popular',
    sumaAsegurada: '$2,000,000 MXN',
    popular: true,
    precios: {
      anual: { principal: '$24,936', detalle: 'Un solo pago al año · equivale a $2,078 al mes' },
      msi: { principal: '$2,431', detalle: '12 cargos mensuales a tarjeta de crédito · $29,172 al año' },
      flex: { principal: '$1,800', detalle: 'Pago inicial de $6,000 y 11 mensualidades de $1,800 · $25,800 al año' }
    },
    menores: '$10,824 al año o $902 al mes',
    caracteristicas: [
      'Todo lo del Plan UNO',
      'Suma asegurada de $2,000,000 al año, que se renueva en cada aniversario',
      'Hasta USD $50,000 para emergencias médicas en el extranjero'
    ]
  },
  {
    id: 'plus',
    nombre: 'Plan Plus',
    badge: 'Con indemnizaciones en efectivo',
    sumaAsegurada: '$2,000,000 MXN',
    popular: false,
    precios: {
      anual: { principal: '$29,292', detalle: 'Un solo pago al año · equivale a $2,441 al mes' },
      msi: { principal: '$2,876', detalle: '12 cargos mensuales a tarjeta de crédito · $34,512 al año' },
      flex: { principal: '$2,100', detalle: 'Pago inicial de $7,500 y 11 mensualidades de $2,100 · $30,600 al año' }
    },
    menores: '$11,460 al año o $955 al mes',
    caracteristicas: [
      'Todo lo del Plan DOS',
      '$490,000 por muerte accidental (en lugar de $100,000)',
      '$2,450 diarios si te hospitalizan por accidente y $980 diarios por enfermedad',
      '$122,500 si te diagnostican cáncer',
      'Plan visual: anteojos completos o lentes de contacto graduados',
      'Atención veterinaria y consultas de sexología en la app'
    ]
  }
];

const FORMAS_PAGO: { id: FormaPago; label: string; sufijo: string }[] = [
  { id: 'anual', label: 'Pago anual', sufijo: '/ año' },
  { id: 'flex', label: 'Flex (inicial + 11 meses)', sufijo: '/ mes' },
  { id: 'msi', label: '12 meses con tarjeta', sufijo: '/ mes' }
];

// ─── Más beneficios (presentación, "Más beneficios") ─────────────────────────
const MAS_BENEFICIOS = [
  'Red de más de 8,000 médicos especialistas a nivel nacional, con tarifa preferencial de $300 a máximo $1,300 por consulta',
  'Médico a domicilio con tarifa especial (de 7:00 a 20:00)',
  'Descuentos en laboratorios',
  'Salud visual con descuentos en ópticas',
  'Limpieza dental anual sin costo',
  'Descuentos en más de 100 tratamientos odontológicos',
  'Asistencia telefónica 24 horas: médica, nutricional y emocional',
  'Servicios de asistencia y gastos funerarios',
  '80% de descuento en Open English'
];

export default function MutuusLanding({ customization }: { customization?: LandingCustomization }) {
  const [formaPago, setFormaPago] = useState<FormaPago>('anual');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [tabCobertura, setTabCobertura] = useState<'cubierto' | 'no_cubierto'>('cubierto');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Asegurar scroll completo en el documento sin bloqueos
  useEffect(() => {
    document.getElementById('root')?.classList.add('public-page');
    document.body.style.overflow = 'auto';
    return () => {
      document.getElementById('root')?.classList.remove('public-page');
    };
  }, []);

  // Dynamic overrides
  const heroTitle = customization?.heroTitle || 'Seguro Médico Inteligente Mutuus';
  const heroSubtitle = customization?.heroSubtitle || 'Acceso a la mayoría de los mejores hospitales privados del país cuando el diagnóstico lo requiera, sin que tengas que hacer ningún pago. Suma Asegurada Inteligente de $1 o $2 millones de pesos por persona, renovable cada año.';
  const badgeText = customization?.badgeText || 'Sin deducible · Sin coaseguro';
  const primaryColor = customization?.primaryColor || '#0047BA';
  const accentColor = customization?.accentColor || '#8DC63F';

  const allFaqs = customization?.customFaqs && customization.customFaqs.length > 0 
    ? [...customization.customFaqs, ...DEFAULT_FAQS] 
    : DEFAULT_FAQS;

  const plans = customization?.plansData || PLANES_DATA;
  const formaPagoActiva = FORMAS_PAGO.find(f => f.id === formaPago)!;

  return (
    <>
      <Helmet>
        <html lang="es-MX" />
        <title>Seguro Médico Inteligente Mutuus | Cobertura de Gastos Médicos Mayores y Menores sin Deducible</title>
        <meta name="description" content="Seguro Médico Inteligente Mutuus: Cobertura de Gastos Médicos Mayores y Menores, sin deducible ni coaseguro. Red de más de 500 hospitales en México, más de 110 con pago directo." />
        <meta name="keywords" content="Mutuus seguro gastos medicos, seguro cero deducible mexico, seguro medico sin coaseguro, telemedicina 24/7 mexico, seguro hospitalario pago directo, membresia de salud mutuus, seguro medico inteligente mutuus" />
        <link rel="canonical" href="https://mutuus.mx/" />
        
        {/* Open Graph Social Card */}
        <meta property="og:type" content="website" />
        <meta property="og:locale" content="es_MX" />
        <meta property="og:site_name" content="Mutuus Salud Inteligente" />
        <meta property="og:title" content="Seguro Médico Inteligente Mutuus | Sin Deducible ni Coaseguro" />
        <meta property="og:description" content="Cobertura de Gastos Médicos Mayores y Menores, sin deducible ni coaseguro. Más de 500 hospitales en red y telemedicina 24/7 desde el primer día." />
        <meta property="og:url" content="https://mutuus.mx/" />
        <meta property="og:image" content="https://mutuus.mx/brand/mutuus/og-mutuus.svg" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        
        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Seguro Médico Inteligente Mutuus | Gastos Médicos Mayores y Menores" />
        <meta name="twitter:description" content="Cobertura de Gastos Médicos Mayores y Menores, sin deducible ni coaseguro. Más de 500 hospitales en red en México." />
        <meta name="twitter:image" content="https://mutuus.mx/brand/mutuus/og-mutuus.svg" />
        
        {/* Schema.org JSON-LD */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            "name": "Seguro Médico Inteligente Mutuus",
            "description": "Cobertura de Gastos Médicos Mayores y Menores, sin deducible ni coaseguro. Operado por Grupo JIRO.",
            "image": "https://mutuus.mx/brand/mutuus/og-mutuus.svg",
            "brand": {
              "@type": "Brand",
              "name": "Mutuus Salud Inteligente"
            },
            "offers": {
              "@type": "AggregateOffer",
              "priceCurrency": "MXN",
              "lowPrice": "20376",
              "highPrice": "29292",
              "offerCount": "3"
            }
          })}
        </script>
      </Helmet>

      {/* ─── CONTENEDOR PRINCIPAL CON SCROLL NATIVO ──────────────────────── */}
      <div 
        className="w-full bg-white text-[#2B2A2A] font-sans antialiased selection:bg-[#0047BA] selection:text-white"
        style={{ 
          fontFamily: 'Montserrat, system-ui, -apple-system, sans-serif',
          '--primary-brand': primaryColor,
          '--accent-brand': accentColor
        } as React.CSSProperties}
      >

        {/* ─── 1. HEADER STICKY (LOGOTIPO OFICIAL MUTUUS & MENÚ ELEGANTE) ── */}
        <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-6">
            
            {/* Logotipo Oficial Mutuus desde CDN Oficial */}
            <a href="#inicio" className="flex items-center group py-1 flex-shrink-0" aria-label="Mutuus Salud Inteligente Inicio">
              <MutuusOfficialLogo className="h-9 sm:h-11 w-auto transition-transform group-hover:scale-102" />
            </a>

            {/* Menú de Navegación Desktop con UX Pulida y Espaciada */}
            <nav className="hidden lg:flex items-center gap-6 xl:gap-8 text-xs xl:text-sm font-bold text-slate-600 whitespace-nowrap">
              <a href="#como-funciona" className="hover:text-[#0047BA] transition-colors">¿Cómo funciona?</a>
              <a href="#planes" className="hover:text-[#0047BA] transition-colors">Planes y Precios</a>
              <a href="#red-hospitalaria" className="hover:text-[#0047BA] transition-colors">Red de Hospitales</a>
              <a href="#coberturas" className="hover:text-[#0047BA] transition-colors">Coberturas</a>
              <a href="#faq" className="hover:text-[#0047BA] transition-colors">Preguntas Frecuentes</a>
            </nav>

            {/* Acciones Header: 100% Directo a Portal */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <a
                href={MUTUUS_PORTAL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-bold border border-slate-200 text-slate-700 hover:bg-slate-50 transition-all cursor-pointer active:scale-95"
              >
                <LogIn className="w-3.5 h-3.5 text-blue-700" />
                <span>Ingresar</span>
              </a>

              <a
                href={MUTUUS_PORTAL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 sm:px-6 py-2.5 rounded-full text-xs sm:text-sm font-black text-white transition-all shadow-md active:scale-95 hover:opacity-95"
                style={{ backgroundColor: primaryColor }}
              >
                <span>Contratar en Línea</span>
                <ArrowRight className="w-4 h-4" />
              </a>

              {/* Botón Móvil Menú */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 rounded-xl text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Abrir Menú"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>

          </div>

          {/* Menú Móvil Desplegable */}
          {mobileMenuOpen && (
            <div className="lg:hidden border-t border-slate-100 bg-white px-4 pt-4 pb-6 space-y-4 shadow-xl animate-in slide-in-from-top-2">
              <nav className="flex flex-col space-y-2 text-sm font-bold text-slate-800">
                <a 
                  href="#como-funciona" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2.5 rounded-xl hover:bg-slate-50 transition"
                >
                  ¿Cómo funciona?
                </a>
                <a 
                  href="#planes" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2.5 rounded-xl hover:bg-slate-50 transition"
                >
                  Planes y Tarifas
                </a>
                <a 
                  href="#red-hospitalaria" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2.5 rounded-xl hover:bg-slate-50 transition"
                >
                  Red Hospitalaria
                </a>
                <a 
                  href="#coberturas" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2.5 rounded-xl hover:bg-slate-50 transition"
                >
                  Coberturas
                </a>
                <a 
                  href="#faq" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2.5 rounded-xl hover:bg-slate-50 transition"
                >
                  Preguntas Frecuentes
                </a>
              </nav>

              <div className="pt-2 border-t border-slate-100 flex flex-col gap-2.5">
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

        {/* ─── 2. HERO SECTION ────────────────────────────────────────────── */}
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

                {/* H1 Principal Actualizado */}
                <div className="space-y-3">
                  <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-[#2B2A2A] tracking-tight leading-[1.12]">
                    Seguro Médico Inteligente{' '}
                    <span className="relative inline-block" style={{ color: primaryColor }}>
                      Mutuus
                      <span 
                        className="absolute left-0 bottom-1 w-full h-2.5 opacity-20 -z-10 rounded-sm"
                        style={{ backgroundColor: accentColor }}
                      />
                    </span>
                  </h1>

                  <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-[#003896] leading-snug">
                    Cobertura de Gastos Médicos Mayores y Menores, sin deducible ni coaseguro
                  </h2>
                </div>

                {/* Subtítulo Detallado */}
                <p className="text-base sm:text-lg text-slate-600 leading-relaxed font-normal max-w-2xl mx-auto lg:mx-0">
                  {heroSubtitle}
                </p>

                {/* Sellos de Confianza Institucional */}
                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 text-xs font-semibold text-slate-500 pt-1">
                  <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 px-3 py-1.5 rounded-full font-bold">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-700" />
                    Respaldados por MetLife
                  </span>
                  <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800 px-3 py-1.5 rounded-full font-bold">
                    <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                    +110 hospitales de pago directo
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
                    href="#como-funciona"
                    className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-full text-base font-bold bg-white border-2 hover:bg-[#EFF6FF] transition-all text-center cursor-pointer"
                    style={{ borderColor: primaryColor, color: primaryColor }}
                  >
                    <Calculator className="w-4 h-4" />
                    <span>Ver cómo funciona</span>
                  </a>
                </div>

                {/* 3 Pilares rápidos */}
                <div className="pt-6 border-t border-slate-200/80 grid grid-cols-3 gap-3 text-left">
                  <div className="space-y-0.5">
                    <p className="font-black text-lg sm:text-xl text-slate-900">$0 Deducible</p>
                    <p className="text-[11px] text-slate-500 leading-tight">Ni coaseguro, en eventos reportados</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="font-black text-lg sm:text-xl text-slate-900">+13,470</p>
                    <p className="text-[11px] text-slate-500 leading-tight">Miembros registrados</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="font-black text-lg sm:text-xl text-slate-900">8 años</p>
                    <p className="text-[11px] text-slate-500 leading-tight">De experiencia en el mercado</p>
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
                        style={{ color: '#8DC63F' }}
                      >
                        <Hospital className="w-4 h-4" />
                        <span>Ejemplo: Manuel requiere cirugía</span>
                      </div>
                      <span className="text-[10px] font-bold text-white/80 uppercase tracking-wider bg-white/10 px-2.5 py-1 rounded-full">
                        Emisión Digital
                      </span>
                    </div>

                    <h3 className="text-2xl font-black text-white leading-snug">
                      Lo que paga de su bolsillo:
                    </h3>

                    <div className="space-y-3">
                      <div className="p-3.5 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-between">
                        <div>
                          <p className="text-xs text-white/70">Sin Mutuus</p>
                          <p className="text-sm font-bold text-white">Cirugía</p>
                        </div>
                        <span className="text-rose-300 font-black text-base">$100,000 MXN</span>
                      </div>

                      <div 
                        className="p-4 rounded-2xl text-slate-900 border flex items-center justify-between shadow-xl"
                        style={{ backgroundColor: '#8DC63F', borderColor: '#8DC63F' }}
                      >
                        <div>
                          <p className="text-xs font-bold text-slate-800">Con Mutuus</p>
                          <p className="text-base font-black text-slate-900">Cuenta y honorarios pagados</p>
                        </div>
                        <span className="text-3xl font-black text-slate-900">$0 MXN</span>
                      </div>
                    </div>

                    <p className="text-xs text-white/75 leading-relaxed">
                      Aplica solo para eventos reportados al 55 8525 8800 o por la app, y sujeto a dictamen médico. No incluye gastos personales ni insumos no relacionados con el diagnóstico autorizado.
                    </p>

                    <a
                      href={MUTUUS_PORTAL_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-4 px-6 rounded-full font-black text-sm text-slate-900 transition-all shadow-xl hover:scale-102 active:scale-98 cursor-pointer text-center flex items-center justify-center gap-2"
                      style={{ backgroundColor: '#8DC63F' }}
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

        {/* ─── 3. CÓMO FUNCIONA ───────────────────────────────────────────── */}
        <section id="como-funciona" className="py-16 bg-white border-y border-slate-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">

              <div className="lg:col-span-6 space-y-4">
                <span className="px-3 py-1 rounded-full bg-[#EFF6FF] text-xs font-bold text-blue-700 uppercase tracking-wider">
                  ¡Importante!
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
                  ¿Cómo se usa tu Seguro Médico Inteligente?
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Es fácil de usar, instantáneo y accesible en todo momento desde tu celular. Para obtener el beneficio de 0 deducible y 0 coaseguro, todos los eventos se reportan primero a Mutuus.
                </p>

                <div className="space-y-3 pt-2">
                  <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                    <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-800 font-black text-xs flex items-center justify-center flex-shrink-0">1</div>
                    <div>
                      <h4 className="font-bold text-xs text-slate-900">Reporta tu evento</h4>
                      <p className="text-[11px] text-slate-500">Por teléfono al {MUTUUS_TELEFONO} o desde la app móvil de Mutuus.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                    <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-800 font-black text-xs flex items-center justify-center flex-shrink-0">2</div>
                    <div>
                      <h4 className="font-bold text-xs text-slate-900">Te orienta un médico urgenciólogo</h4>
                      <p className="text-[11px] text-slate-500">Analiza tu caso y te ayuda a tomar la mejor decisión para tu salud y tu patrimonio, incluido a qué hospital de la red acudir.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                    <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-800 font-black text-xs flex items-center justify-center flex-shrink-0">3</div>
                    <div>
                      <h4 className="font-bold text-xs text-slate-900">Dictamen médico y pago</h4>
                      <p className="text-[11px] text-slate-500">El área de dictamen determina si procede la cobertura. Si procede, Mutuus paga la cuenta del hospital y los honorarios médicos.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Cifras de la presentación oficial */}
              <div className="lg:col-span-6 flex justify-center">
                <div className="relative w-full max-w-lg p-6 sm:p-8 rounded-3xl bg-slate-900 text-white shadow-2xl border border-slate-800 overflow-hidden">
                  <p className="text-xs font-bold text-[#8DC63F] uppercase tracking-wider">Experiencia Mutuus</p>
                  <div className="py-6 grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-2xl sm:text-3xl font-black">+13,470</p>
                      <p className="text-[11px] text-white/70">miembros registrados</p>
                    </div>
                    <div>
                      <p className="text-2xl sm:text-3xl font-black">+100</p>
                      <p className="text-[11px] text-white/70">millones de pesos ahorrados en cuentas hospitalarias</p>
                    </div>
                    <div>
                      <p className="text-2xl sm:text-3xl font-black">+600</p>
                      <p className="text-[11px] text-white/70">hospitales registrados</p>
                    </div>
                  </div>
                  <p className="text-xs text-white/80 leading-relaxed border-t border-white/10 pt-4">
                    Con 8 años de experiencia y respaldados por MetLife, más de 10,000 personas en México ya tienen acceso a atención médica privada; el 88% nunca había tenido un seguro de Gastos Médicos Mayores.
                  </p>
                  <div className="pt-4 flex justify-end">
                    <a
                      href={MUTUUS_PORTAL_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-5 py-2.5 rounded-full text-xs font-black text-slate-900 transition-all shadow-md active:scale-95"
                      style={{ backgroundColor: '#8DC63F' }}
                    >
                      Contratar en línea
                    </a>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ─── 4. EJEMPLO DE AHORRO (caso de la presentación oficial) ─────── */}
        <section id="simulador" className="py-20 bg-[#F4F9FF]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">

            <div className="text-center max-w-3xl mx-auto space-y-3 mb-12">
              <span className="px-3 py-1 rounded-full bg-white border border-[#CBD5E1] text-xs font-bold uppercase tracking-wider" style={{ color: primaryColor }}>
                Un ejemplo real
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900">
                Manuel no tenía Seguro de Gastos Médicos Mayores
              </h2>
              <p className="text-slate-600 text-sm sm:text-base">
                Lleva dos días con malestar estomacal y decide ver a un especialista. Le receta medicamentos y le pide estudios y un ultrasonido.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                {
                  titulo: '1. La consulta y los estudios',
                  filas: [['Medicamentos', '$600', '$500'], ['Ultrasonido', '$800', '$650'], ['Consulta médica', '$1,200', '$650']],
                  total: ['$2,600', '$1,750'],
                  nota: 'Ahorro estimado de $850 con los descuentos de la red.'
                },
                {
                  titulo: '2. Los resultados: Manuel va a requerir cirugía',
                  filas: [['Cirugía', '$100,000', '$0']],
                  total: ['$100,000', '$0'],
                  nota: 'Su Seguro Médico Inteligente lo llevó a uno de los mejores hospitales privados de México y le pagó la cuenta y los honorarios médicos.'
                }
              ].map((caso) => (
                <div key={caso.titulo} className="p-6 rounded-3xl bg-white border-2 border-slate-200/80 shadow-xl space-y-4">
                  <h3 className="font-black text-slate-900">{caso.titulo}</h3>
                  <div className="text-xs text-slate-700">
                    <div className="grid grid-cols-3 font-bold text-slate-500 pb-2 border-b border-slate-100">
                      <span />
                      <span className="text-right">Sin Mutuus</span>
                      <span className="text-right" style={{ color: primaryColor }}>Con Mutuus</span>
                    </div>
                    {caso.filas.map(([concepto, sin, con]) => (
                      <div key={concepto} className="grid grid-cols-3 py-2 border-b border-slate-50">
                        <span>{concepto}</span>
                        <span className="text-right text-rose-700 font-bold">{sin}</span>
                        <span className="text-right text-emerald-700 font-bold">{con}</span>
                      </div>
                    ))}
                    <div className="grid grid-cols-3 pt-3 text-sm font-black">
                      <span>Total</span>
                      <span className="text-right text-rose-600">{caso.total[0]}</span>
                      <span className="text-right text-emerald-600">{caso.total[1]}</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{caso.nota}</p>
                </div>
              ))}
            </div>

            <p className="text-[11px] text-slate-500 mt-6 leading-relaxed">
              * El ahorro es estimado y puede variar según el porcentaje de descuento del proveedor o las condiciones de mercado, que Mutuus no controla. La cirugía sin costo aplica solo para eventos reportados al {MUTUUS_TELEFONO} o por la app, y está sujeta a dictamen médico. La cobertura de gastos hospitalarios no incluye gastos personales ni insumos no relacionados con el diagnóstico autorizado.
            </p>

          </div>
        </section>

        {/* ─── 5. PLANES Y PRECIOS (Lista de Precios Julio 2026) ──────────── */}
        <section id="planes" className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

            <div className="text-center max-w-3xl mx-auto space-y-4 mb-12">
              <span className="px-3 py-1 rounded-full bg-[#EFF6FF] border border-[#CBD5E1] text-xs font-bold uppercase tracking-wider" style={{ color: primaryColor }}>
                Precios vigentes a partir del 1 de julio de 2026
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900">
                Nuestros productos
              </h2>
              <p className="text-slate-600 text-sm sm:text-base">
                Todos incluyen una Suma Asegurada Inteligente por persona, que se renueva automáticamente cada año en la fecha de aniversario.
              </p>

              {/* Selector de forma de pago */}
              <div className="pt-4 flex items-center justify-center">
                <div className="bg-slate-100 p-1.5 rounded-full border border-slate-200 shadow-xs inline-flex flex-wrap justify-center">
                  {FORMAS_PAGO.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setFormaPago(f.id)}
                      className={`px-4 sm:px-6 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                        formaPago === f.id ? 'text-white shadow-md' : 'text-slate-600 hover:text-slate-900'
                      }`}
                      style={formaPago === f.id ? { backgroundColor: primaryColor } : {}}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Grid de Tarjetas de Planes */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
              {plans.map((p) => {
                const precio = p.precios[formaPago];
                return (
                  <div
                    key={p.id}
                    className={`rounded-3xl p-6 sm:p-8 bg-white transition-all duration-300 flex flex-col justify-between relative ${
                      p.popular
                        ? 'border-2 shadow-2xl lg:-translate-y-2'
                        : 'border border-slate-200 shadow-md hover:shadow-xl'
                    }`}
                    style={p.popular ? { borderColor: primaryColor } : {}}
                  >
                    {p.popular && (
                      <div
                        className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-white text-xs font-black uppercase tracking-wide shadow-md whitespace-nowrap"
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
                        <p className="text-xs text-slate-500 font-medium">Suma Asegurada por persona:</p>
                        <p className="text-xl font-black" style={{ color: primaryColor }}>{p.sumaAsegurada}</p>

                        <div className="mt-3 flex items-baseline gap-1">
                          <span className="text-3xl sm:text-4xl font-black text-slate-900">{precio.principal}</span>
                          <span className="text-xs text-slate-500 font-semibold">MXN {formaPagoActiva.sufijo}</span>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-500">{precio.detalle}</p>
                        <p className="mt-2 text-[11px] text-slate-600">
                          <strong>Menores de 18 años:</strong> {p.menores}
                        </p>
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
                );
              })}
            </div>

            <div className="mt-10 p-5 rounded-2xl bg-[#F4F9FF] border border-[#CBD5E1] max-w-3xl mx-auto text-xs sm:text-sm text-slate-700">
              <strong>Adulto Inteligente, para seguir protegido después de los 70.</strong> No se contrata por separado: es la continuación de tu plan para quien lo contrató antes de los 64 años y lleva al menos 61 meses de pagos continuos. Al renovar ya en la edad de elegibilidad, el plan cambia solo a Adulto Inteligente: $1,000,000 de suma asegurada reinstalable, renovación garantizada hasta los 99 años y una tarifa plana de $34,512 al año (o $2,876 al mes con tarjeta), igual para hombres y mujeres.
            </div>

            <p className="text-center text-xs text-slate-400 mt-6 max-w-3xl mx-auto">
              * Precios en pesos mexicanos para titulares mayores de 18 años, vigentes a partir del 1 de julio de 2026. Las coberturas para menores deben estar ligadas forzosamente a un titular mayor de edad. Aceptamos Visa, MasterCard y American Express.
            </p>

          </div>
        </section>

        {/* ─── 6. SISTEMA HOSPITALARIO ────────────────────────────────────── */}
        <section id="red-hospitalaria" className="py-20 bg-[#F4F9FF]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">

            <div className="text-center max-w-3xl mx-auto space-y-3 mb-10">
              <span className="px-3 py-1 rounded-full bg-white border border-[#CBD5E1] text-xs font-bold uppercase tracking-wider" style={{ color: primaryColor }}>
                Sistema Hospitalario Mutuus
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900">
                Más de 500 hospitales en todo México
              </h2>
              <p className="text-slate-600 text-sm sm:text-base">
                Una red hospitalaria privada de prestigio nacional, que incluye muchos de los hospitales mejor valorados del país.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {[
                { t: 'Red preferente y de reembolso', d: 'Acceso a instalaciones de primer nivel para asegurar el mejor cuidado posible.' },
                { t: 'Red nacional de laboratorios', d: 'Una amplia red de laboratorios para una cobertura completa en servicios de salud.' },
                { t: '+8,000 médicos especialistas', d: 'Con tarifa preferencial de entre $300 y máximo $1,300 por consulta.' }
              ].map((item) => (
                <div key={item.t} className="p-6 rounded-2xl bg-white border border-slate-200/80 space-y-3">
                  <div
                    className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center"
                    style={{ color: primaryColor }}
                  >
                    <Hospital className="w-5 h-5" />
                  </div>
                  <h4 className="font-black text-slate-900 text-base">{item.t}</h4>
                  <p className="text-xs text-slate-500">{item.d}</p>
                </div>
              ))}
            </div>

            <div className="mt-10 p-6 rounded-2xl bg-white border border-blue-200/80 max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
              <p className="text-xs sm:text-sm text-slate-700">
                Antes de acudir a cualquier hospital de la red, llama al <strong>{MUTUUS_TELEFONO}</strong> o usa la app y sigue las recomendaciones del equipo de especialistas: así tu cobertura es la adecuada y evitas costos adicionales.
              </p>
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

        {/* ─── 7. COBERTURAS, BENEFICIOS Y PERIODOS DE ESPERA ─────────────── */}
        <section id="coberturas" className="py-20 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

            <div className="text-center max-w-2xl mx-auto space-y-3 mb-12">
              <span className="px-3 py-1 rounded-full bg-[#EFF6FF] text-xs font-bold text-blue-700 uppercase tracking-wider">
                ¿Qué cubre?
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900">
                Tu Seguro Médico Inteligente, antes, durante y después del hospital
              </h2>

              <div className="pt-4 flex justify-center">
                <div className="bg-slate-100 p-1.5 rounded-full border border-slate-200 shadow-xs inline-flex flex-wrap justify-center">
                  <button
                    onClick={() => setTabCobertura('cubierto')}
                    className={`px-6 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      tabCobertura === 'cubierto'
                        ? 'bg-[#22C55E] text-white shadow-md'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    ✓ Qué cubre
                  </button>
                  <button
                    onClick={() => setTabCobertura('no_cubierto')}
                    className={`px-6 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      tabCobertura === 'no_cubierto'
                        ? 'bg-rose-600 text-white shadow-md'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Periodos de espera y exclusiones
                  </button>
                </div>
              </div>
            </div>

            {tabCobertura === 'cubierto' ? (
              <div className="space-y-10">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { t: 'Atención pre hospitalaria', items: ['Servicio de Urgencias 24/7', 'Telemedicina', 'Check up anual', 'Limpieza dental anual', 'Ambulancia', 'Asistencia funeraria', 'Descuentos en medicinas, consultas y pruebas de laboratorio'] },
                    { t: 'Atención hospitalaria', items: ['En accidentes', 'En enfermedades', 'Maternidad', 'Cuenta del hospital y honorarios médicos sin deducible ni coaseguro'] },
                    { t: 'Atención post hospitalaria', items: ['Descuentos en consultas médicas, medicamentos y pruebas de laboratorio', 'Seguro por muerte accidental'] }
                  ].map((bloque) => (
                    <div key={bloque.t} className="p-5 rounded-2xl bg-[#F4F9FF] border border-emerald-100 shadow-xs">
                      <h4 className="font-black text-slate-900 text-sm mb-3">{bloque.t}</h4>
                      <ul className="space-y-2">
                        {bloque.items.map((it) => (
                          <li key={it} className="flex items-start gap-2 text-xs text-slate-700">
                            <Check className="w-3.5 h-3.5 text-[#22C55E] stroke-[3] flex-shrink-0 mt-0.5" />
                            <span>{it}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>

                <div>
                  <h3 className="font-black text-slate-900 text-lg mb-4">Cobertura de maternidad</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                      { t: 'Parto normal', d: 'Suma asegurada de 20 UMAM' },
                      { t: 'Cesárea', d: 'Suma asegurada de 25 UMAM' },
                      { t: 'Complicaciones del embarazo', d: 'Suma asegurada de $1 millón de pesos' }
                    ].map((m) => (
                      <div key={m.t} className="p-5 rounded-2xl border border-slate-200 text-center">
                        <p className="font-bold text-slate-900 text-sm">{m.t}</p>
                        <p className="text-xs text-slate-600 mt-1">{m.d}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-black text-slate-900 text-lg mb-4">Más beneficios</h3>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {MAS_BENEFICIOS.map((b) => (
                      <li key={b} className="flex items-start gap-2 text-xs sm:text-sm text-slate-700">
                        <Check className="w-4 h-4 text-[#22C55E] stroke-[3] flex-shrink-0 mt-0.5" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-[11px] text-slate-500 mt-3">Tarifas de consulta según el tabulador del manual de tu Seguro Médico Inteligente. Aplican términos y condiciones.</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { t: 'Preexistencias', d: 'No se cubren padecimientos preexistentes, declarados o no declarados.' },
                  { t: 'Primeros 30 días', d: 'La póliza no cubre enfermedades originadas en los primeros 30 días de vigencia. Los accidentes sí están cubiertos desde el inicio.' },
                  { t: 'Embarazo: 30 días', d: 'Periodo de espera de 30 días para la gestación del embarazo.' },
                  { t: 'Dos años', d: 'Amígdalas y/o adenoides, padecimientos anorrectales, circuncisiones, litiasis del aparato genitourinario, hernias, columna vertebral, tratamientos quirúrgicos u oncológicos del piso perineal y genitales, padecimientos prostáticos, vesícula y vías biliares, tumoraciones mamarias, insuficiencia venosa, rodilla, cáncer, padecimientos cardiovasculares (excepto recién nacidos dentro de la colectividad), padecimientos ortopédicos, hallux valgus (juanetes) y enfermedades ácido-pépticas, incluido el reflujo gastroesofágico.' },
                  { t: 'Cinco años', d: 'Síndrome de Inmunodeficiencia Adquirida (SIDA) o seropositividad y cualquier padecimiento de transmisión sexual; aplica también para recién nacidos dentro de la colectividad.' },
                  { t: 'Senos paranasales', d: 'Sin periodo de espera, pero solo se cubren en accidentes, con 20% de coaseguro y $40,000 de deducible.' },
                  { t: 'Indemnizaciones del Plan Plus', d: '12 horas para renta diaria por accidente, 24 horas para renta diaria por enfermedad y 90 días para diagnóstico de cáncer.' },
                  { t: 'Dictamen y tabuladores', d: 'Todo evento lo evalúa y aprueba el área de dictamen antes del pago. Los médicos pueden cambiar sus tarifas; si el hospital te pide firmar que pagarás una diferencia, contacta a Mutuus antes de firmar.' }
                ].map((item) => (
                  <div key={item.t} className="p-5 rounded-2xl bg-rose-50/50 border border-rose-100 shadow-xs flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Clock className="w-3.5 h-3.5" />
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
                Todo lo que necesitas saber antes de contratar tu seguro médico inteligente.
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
            <div className="bg-white rounded-3xl p-8 sm:p-14 text-slate-900 shadow-2xl border-4 border-[#8DC63F] text-center space-y-8">
              
              <div className="space-y-3 max-w-2xl mx-auto">
                <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black uppercase tracking-wider">
                  <Zap className="w-4 h-4 text-emerald-700" />
                  Emisión 100% Digital en Autoservicio · Promotoría A-3522
                </span>
                <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                  Comienza tu Contratación Digital Inmediata
                </h2>
                <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                  Ingresa al portal de autoservicio de Mutuus con el respaldo de Grupo JIRO: elige tu plan, llena tus datos y realiza tu pago con Visa, MasterCard o American Express.
                </p>
              </div>

              {/* 3 Pasos rápidos */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left max-w-2xl mx-auto">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-black text-xs flex items-center justify-center mb-2">1</div>
                  <h4 className="font-bold text-xs text-slate-900">Elige tu Plan</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">Plan UNO, DOS o Plus.</p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-black text-xs flex items-center justify-center mb-2">2</div>
                  <h4 className="font-bold text-xs text-slate-900">Completa tus Datos</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">Registro seguro y confidencial en línea.</p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-black text-xs flex items-center justify-center mb-2">3</div>
                  <h4 className="font-bold text-xs text-slate-900">Activa tu Cobertura</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">Pago anual, 12 meses con TDC o pago diferido.</p>
                </div>
              </div>

              {/* Botón Gigante de Contratación */}
              <div className="pt-2">
                <a
                  href={MUTUUS_PORTAL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-10 py-5 rounded-full font-black text-base text-slate-900 transition-all shadow-xl hover:scale-105 active:scale-95 cursor-pointer"
                  style={{ backgroundColor: '#8DC63F' }}
                >
                  <CreditCard className="w-5 h-5 text-slate-900" />
                  <span>Ingresar al Portal y Contratar Ahora</span>
                  <ExternalLink className="w-5 h-5 text-slate-900" />
                </a>
                <p className="text-xs text-slate-500 mt-3 flex items-center justify-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Conexión cifrada SSL directa con Mutuus & Grupo JIRO</span>
                </p>
              </div>

            </div>
          </div>
        </section>

        {/* ─── 10. FOOTER CON CRÉDITOS CLAROS DE OPERACIÓN POR JIRO ───────── */}
        <footer className="bg-[#001738] text-white/80 text-xs py-14 border-t border-white/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
            
            {/* Banner Destacado de Operación por Grupo JIRO con Logo Oficial Blanco */}
            <div className="p-6 sm:p-8 rounded-2xl bg-white/5 border border-white/10 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
                <img
                  src="https://jiro.mx/wp-content/uploads/2021/10/Grupo-Jiro-Logo-Blanco-01.png"
                  alt="Grupo JIRO"
                  className="h-10 sm:h-12 w-auto object-contain flex-shrink-0"
                  loading="lazy"
                />
                <div>
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <p className="text-white font-black text-sm">Operado y Distribuido por Grupo JIRO</p>
                    <span className="px-2 py-0.5 rounded-full bg-[#8DC63F]/20 text-[#8DC63F] text-[10px] font-black uppercase">
                      Promotoría A-3522
                    </span>
                  </div>
                  <p className="text-white/70 text-xs mt-1">
                    JIRO Agente de Seguros y Fianzas S.A. de C.V. · Socio Comercial y Distribuidor Oficial de Mutuus Salud Inteligente.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <a
                  href="https://www.grupojiro.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition inline-flex items-center gap-1.5 border border-white/10"
                >
                  <span>Conocer Grupo JIRO</span>
                  <ExternalLink className="w-3.5 h-3.5 text-[#8DC63F]" />
                </a>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              
              {/* Mutuus Col */}
              <div className="space-y-3">
                <MutuusOfficialLogo className="h-10 w-auto" dark={true} />
                <p className="text-white/70 text-xs leading-relaxed mt-2">
                  Seguro Médico Inteligente sin deducible ni coaseguro, con una red de más de 500 hospitales en todo México.
                </p>
                <div className="pt-1">
                  <a
                    href={MUTUUS_PORTAL_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-bold text-[#8DC63F] underline hover:text-white inline-flex items-center gap-1"
                  >
                    <LogIn className="w-3 h-3" />
                    <span>Portal Oficial de Registro y Emisión</span>
                  </a>
                </div>
              </div>

              {/* Secciones */}
              <div className="space-y-2">
                <p className="font-bold text-white text-sm">Navegación</p>
                <ul className="space-y-1.5 text-white/70">
                  <li><a href="#como-funciona" className="hover:text-white transition-colors">¿Cómo Funciona?</a></li>
                  <li><a href="#simulador" className="hover:text-white transition-colors">Ejemplo de Ahorro</a></li>
                  <li><a href="#planes" className="hover:text-white transition-colors">Planes y Precios</a></li>
                  <li><a href="#red-hospitalaria" className="hover:text-white transition-colors">Red de Hospitales</a></li>
                  <li><a href="#coberturas" className="hover:text-white transition-colors">Coberturas</a></li>
                  <li><a href="#faq" className="hover:text-white transition-colors">Preguntas Frecuentes</a></li>
                </ul>
              </div>

              {/* Documentos Oficiales ps-mutuus.com */}
              <div className="space-y-2">
                <p className="font-bold text-white text-sm">Documentos y Legal</p>
                <ul className="space-y-1.5 text-white/70">
                  <li>
                    <a 
                      href="https://ps-mutuus.com/Condiciones-Generales-Mutuus-MetLife.pdf" 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="hover:text-white transition-colors flex items-center gap-1"
                    >
                      <FileText className="w-3.5 h-3.5 text-[#8DC63F]" /> Condiciones Generales Póliza (PDF)
                    </a>
                  </li>
                  <li>
                    <a 
                      href="https://ps-mutuus.com/terminos-y-condiciones" 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="hover:text-white transition-colors flex items-center gap-1"
                    >
                      <FileText className="w-3.5 h-3.5 text-[#8DC63F]" /> Términos y Condiciones Oficiales
                    </a>
                  </li>
                  <li>
                    <a 
                      href="https://www.grupojiro.com/aviso-de-privacidad" 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="hover:text-white transition-colors flex items-center gap-1 text-emerald-300 font-bold"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Aviso de Privacidad Integral (Grupo JIRO)
                    </a>
                  </li>
                  <li>
                    <a 
                      href="https://www.grupojiro.com" 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="hover:text-white transition-colors flex items-center gap-1 text-white/90"
                    >
                      <Building2 className="w-3.5 h-3.5 text-[#8DC63F]" /> Corporativo Grupo JIRO (jiro.mx)
                    </a>
                  </li>
                </ul>
              </div>

              {/* Portal & Cobertura */}
              <div className="space-y-2">
                <p className="font-bold text-white text-sm">Emisión & Respaldo JIRO</p>
                <p className="text-white/70 text-xs">
                  Reporta tus eventos al {MUTUUS_TELEFONO} o desde la app. Asesoría de agentes autorizados de Grupo JIRO.
                </p>
                <div className="pt-2">
                  <a
                    href={MUTUUS_PORTAL_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition"
                  >
                    <span>Emisión Inmediata en Línea</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </div>

            <div className="pt-8 border-t border-white/10 space-y-2 text-[11px] text-white/50 leading-relaxed">
              <p>
                * Mutuus es una marca registrada. Comercialización y distribución autorizada a través de JIRO Agente de Seguros y Fianzas S.A. de C.V. (Clave Promotoría A-3522). El beneficio de 0 deducible y 0 coaseguro aplica solo para eventos reportados por teléfono al 55 8525 8800 o por la app móvil, en padecimientos cubiertos de acuerdo con las Condiciones Generales, y sujeto a dictamen médico. No se cubren preexistencias. Aplican periodos de espera. Precios vigentes a partir del 1 de julio de 2026.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-between pt-4 text-white/40">
                <p>© {new Date().getFullYear()} Mutuus Salud Inteligente · Operado y Distribuido por Grupo JIRO (<a href="https://www.grupojiro.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-white">jiro.mx</a>). Todos los derechos reservados.</p>
                <p>Aviso de Privacidad protegido por Ley Federal de Protección de Datos Personales (LFPDPPP)</p>
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
            style={{ backgroundColor: '#8DC63F' }}
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
