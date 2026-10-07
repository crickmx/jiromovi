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
  Smartphone, 
  Users, 
  ChevronDown, 
  ChevronUp, 
  ArrowRight, 
  Building2, 
  Award, 
  FileText, 
  Search,
  Menu,
  Activity,
  Heart,
  Video,
  MapPin,
  HelpCircle
} from 'lucide-react';

// ─── LOGO MUTUUS OFICIAL VECTORIAL EN ALTA DEFINICIÓN ────────────────────────
function MutuusLogo({ className = "h-9 w-auto" }: { className?: string }) {
  return (
    <svg viewBox="0 0 220 54" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <rect width="44" height="44" y="5" rx="12" fill="#003896"/>
      <path d="M14 35V19L22 29L30 19V35" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="33" cy="15" r="3.5" fill="#9CD41C"/>
      <text x="54" y="36" fontFamily="Montserrat, system-ui, sans-serif" fontSize="27" fontWeight="800" fill="#003896" letterSpacing="-0.5">mutuus</text>
      <text x="54" y="47" fontFamily="Montserrat, system-ui, sans-serif" fontSize="8" fontWeight="700" fill="#64748B" letterSpacing="1.8">SALUD INTELIGENTE</text>
    </svg>
  );
}

// ─── BASE DE DATOS DE PREGUNTAS FRECUENTES (FAQ) ─────────────────────────────
const FAQS = [
  {
    q: '¿Qué es exactamente Mutuus y cómo opera la membresía de salud?',
    a: 'Mutuus es un ecosistema privado de salud integral que combina consultas de telemedicina 24/7 ilimitadas, tarifas preferenciales en consultas presenciales y el respaldo de una póliza de Gastos Médicos Mayores con $0 deducible y $0 coaseguro al atenderte dentro de su red hospitalaria autorizada.'
  },
  {
    q: '¿Cómo funciona la condonación total de deducible y coaseguro?',
    a: 'Al ingresar a cualquiera de los más de 115 hospitales de pago directo o 548 convenios autorizados y realizar el reporte previo a la línea médica de Mutuus, la cuenta médica cubierta es liquidada directamente por la aseguradora, permitiéndote pagar $0 de tu bolsillo.'
  },
  {
    q: '¿Qué hospitales de México forman parte de la red de pago directo?',
    a: 'La red abarca instituciones de primer nivel en todo México, incluyendo Grupo Hospitales Ángeles, Médica Sur, Star Médica, Christus Muguerza, Hospitales MAC y Hospital San Javier, entre otras clínicas especializadas.'
  },
  {
    q: '¿Incluye cobertura para maternidad, parto o cesárea?',
    a: 'Sí, la cobertura de maternidad ofrece ayuda económica y cobertura hospitalaria para parto o cesárea tras un periodo de espera de 10 meses continuos de vigencia de la póliza, con montos calculados conforme a las Unidades de Medida y Actualización (UMA).'
  },
  {
    q: '¿Cómo se solicita una videollamada con un médico 24/7?',
    a: 'Desde la aplicación móvil oficial de Mutuus puedes pulsar en "Consulta Médica" e iniciar una videollamada o chat seguro con médicos generales, pediatras o psicólogos en menos de 2 minutos, sin costo extra y las 24 horas del día.'
  },
  {
    q: '¿Qué debo hacer en caso de una urgencia médica?',
    a: 'En caso de urgencia, puedes comunicarte inmediatamente a la línea de asistencia médica 24/7 marcando el botón de emergencia en la app. Nuestro equipo coordinará ambulancia terrestre o emitirá el pase de admisión directa en el hospital más cercano.'
  },
  {
    q: '¿Cuáles son los requisitos y tiempos de activación?',
    a: 'El proceso es 100% en línea. Tras llenar tus datos y seleccionar tu plan, tu membresía y credencial digital se activan en menos de 24 horas hábiles, listas para usarse desde tu smartphone.'
  },
  {
    q: '¿Cómo pido un reembolso si me atiendo fuera de la red?',
    a: 'Para padecimientos cubiertos fuera de la red de pago directo, puedes ingresar tu reclamación y facturas digitales a través del portal de trámites para su dictamen y reembolso conforme a tabulador médico.'
  }
];

// ─── TARIFAS Y PLANES VIGENTES 2026 ──────────────────────────────────────────
const PLANES_DATA = {
  mensual: [
    {
      id: 'uno',
      nombre: 'Plan UNO',
      badge: 'Básico Esencial',
      sumaAsegurada: '$1,000,000 MXN',
      cuota: '$1,299',
      periodo: 'mes',
      popular: false,
      caracteristicas: [
        'Cero Deducible en red de pago directo',
        'Cero Coaseguro en hospitalización',
        'Suma asegurada de $1,000,000 MXN por padecimiento',
        'Telemedicina ilimitada 24/7 (Medicina general y pediatría)',
        'Red de más de 115 hospitales de pago directo',
        '2 traslados en ambulancia de urgencia al año',
        'Asistencia médica de urgencia en el extranjero'
      ]
    },
    {
      id: 'dos',
      nombre: 'Plan DOS',
      badge: 'Más Elegido ★',
      sumaAsegurada: '$3,000,000 MXN',
      cuota: '$1,899',
      periodo: 'mes',
      popular: true,
      caracteristicas: [
        'Cero Deducible en toda la red nacional',
        'Cero Coaseguro en cirugías y estancias',
        'Suma asegurada de $3,000,000 MXN por padecimiento',
        'Telemedicina 24/7 (General, Pediatría, Psicología, Nutrición)',
        'Red completa de 548+ hospitales en convenio',
        '3 traslados en ambulancia terrestre al año',
        'Ayuda de maternidad (parto/cesárea) tras 10 meses',
        'Check-up preventivo básico anual',
        'Médico a domicilio con copago preferencial'
      ]
    },
    {
      id: 'plus',
      nombre: 'Plan PLUS',
      badge: 'Protección Integral',
      sumaAsegurada: '$5,000,000 MXN',
      cuota: '$2,499',
      periodo: 'mes',
      popular: false,
      caracteristicas: [
        'Cero Deducible en hospitales de alta especialidad',
        'Cero Coaseguro en tratamientos oncológicos y cirugías',
        'Suma asegurada de $5,000,000 MXN por padecimiento',
        'Acceso prioritario a Grupo Ángeles, Médica Sur y Star Médica',
        'Telemedicina 24/7 multi-especialidad sin límites',
        'Coordinación de ambulancia aérea y terrestre',
        'Mayor tope en cobertura de maternidad',
        'Check-up integral anual con estudios de laboratorio',
        'Orientación legal, médica y psicológica telefónica 24/7'
      ]
    }
  ],
  anual: [
    {
      id: 'uno',
      nombre: 'Plan UNO',
      badge: 'Ahorro Anual 10%',
      sumaAsegurada: '$1,000,000 MXN',
      cuota: '$13,990',
      periodo: 'año',
      ahorro: 'Equivale a $1,165/mes',
      popular: false,
      caracteristicas: [
        'Cero Deducible en red de pago directo',
        'Cero Coaseguro en hospitalización',
        'Suma asegurada de $1,000,000 MXN por padecimiento',
        'Telemedicina ilimitada 24/7 (Medicina general y pediatría)',
        'Red de más de 115 hospitales de pago directo',
        '2 traslados en ambulancia de urgencia al año',
        'Asistencia médica de urgencia en el extranjero'
      ]
    },
    {
      id: 'dos',
      nombre: 'Plan DOS',
      badge: 'Mejor Valor · Recomendado',
      sumaAsegurada: '$3,000,000 MXN',
      cuota: '$20,490',
      periodo: 'año',
      ahorro: 'Equivale a $1,707/mes',
      popular: true,
      caracteristicas: [
        'Cero Deducible en toda la red nacional',
        'Cero Coaseguro en cirugías y estancias',
        'Suma asegurada de $3,000,000 MXN por padecimiento',
        'Telemedicina 24/7 (General, Pediatría, Psicología, Nutrición)',
        'Red completa de 548+ hospitales en convenio',
        '3 traslados en ambulancia terrestre al año',
        'Ayuda de maternidad (parto/cesárea) tras 10 meses',
        'Check-up preventivo básico anual',
        'Médico a domicilio con copago preferencial'
      ]
    },
    {
      id: 'plus',
      nombre: 'Plan PLUS',
      badge: 'Máxima Cobertura',
      sumaAsegurada: '$5,000,000 MXN',
      cuota: '$26,990',
      periodo: 'año',
      ahorro: 'Equivale a $2,249/mes',
      popular: false,
      caracteristicas: [
        'Cero Deducible en hospitales de alta especialidad',
        'Cero Coaseguro en tratamientos oncológicos y cirugías',
        'Suma asegurada de $5,000,000 MXN por padecimiento',
        'Acceso prioritario a Grupo Ángeles, Médica Sur y Star Médica',
        'Telemedicina 24/7 multi-especialidad sin límites',
        'Coordinación de ambulancia aérea y terrestre',
        'Mayor tope en cobertura de maternidad',
        'Check-up integral anual con estudios de laboratorio',
        'Orientación legal, médica y psicológica telefónica 24/7'
      ]
    }
  ]
};

// ─── RED DE HOSPITALES NACIONALES ────────────────────────────────────────────
const HOSPITALES_DATA = [
  { nombre: 'Hospitales Ángeles', ubicaciones: 'CDMX, Guadalajara, Monterrey, Puebla, Querétaro', tipo: 'Pago Directo' },
  { nombre: 'Médica Sur', ubicaciones: 'Ciudad de México (Tlalpan)', tipo: 'Alta Especialidad' },
  { nombre: 'Star Médica', ubicaciones: 'CDMX, Morelia, Mérida, Querétaro, Aguascalientes', tipo: 'Pago Directo' },
  { nombre: 'Christus Muguerza', ubicaciones: 'Monterrey, Saltillo, Chihuahua, Reynosa', tipo: 'Pago Directo' },
  { nombre: 'Hospitales MAC', ubicaciones: 'Guadalajara, Puebla, León, Celaya, Aguascalientes', tipo: 'Red de Excelencia' },
  { nombre: 'Hospital San Javier', ubicaciones: 'Guadalajara y Puerto Vallarta', tipo: 'Alta Especialidad' },
  { nombre: 'Centro Médico ABC', ubicaciones: 'Observatorio y Santa Fe (Planes Plus)', tipo: 'Convenio Especial' },
  { nombre: 'Hospital Español', ubicaciones: 'Ciudad de México (Polanco)', tipo: 'Pago Directo' }
];

export default function MutuusLanding() {
  const [periodicidad, setPeriodicidad] = useState<'anual' | 'mensual'>('anual');
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [tabCobertura, setTabCobertura] = useState<'cubierto' | 'no_cubierto'>('cubierto');
  const [searchHospital, setSearchHospital] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Asegurar que el documento principal tenga scroll libre y fluido
  useEffect(() => {
    const root = document.getElementById('root');
    root?.classList.add('public-page');
    document.body.style.overflow = 'auto';
    document.documentElement.style.overflow = 'auto';
    document.body.style.height = 'auto';
    document.documentElement.style.height = 'auto';

    return () => {
      root?.classList.remove('public-page');
    };
  }, []);

  const plans = PLANES_DATA[periodicidad];

  // Filtro de Hospitales
  const filteredHospitales = useMemo(() => {
    if (!searchHospital.trim()) return HOSPITALES_DATA;
    const q = searchHospital.toLowerCase();
    return HOSPITALES_DATA.filter(h => 
      h.nombre.toLowerCase().includes(q) || h.ubicaciones.toLowerCase().includes(q)
    );
  }, [searchHospital]);

  return (
    <>
      {/* ─── METATAGS SEO & GEO ────────────────────────────────────────────── */}
      <Helmet>
        <html lang="es-MX" />
        <title>Mutuus Seguro de Gastos Médicos | Cero Deducible y Coaseguro</title>
        <meta 
          name="description" 
          content="Contrata tu membresía de salud y seguro de gastos médicos Mutuus con atención hospitalaria directa, telemedicina 24/7 y 0% de deducible en México." 
        />
        <meta 
          name="keywords" 
          content="Mutuus seguro gastos medicos, seguro sin deducible, seguro medico sin coaseguro, telemedicina 24/7 mexico, promotor autorizado mutuus" 
        />
        <link rel="canonical" href="https://landings.movi.digital/mutuus" />
        <meta name="geo.region" content="MX" />
        <meta name="geo.placename" content="México" />

        {/* Schema.org Structured Data (JSON-LD) */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "InsuranceAgency",
                "name": "Promotoría Autorizada Mutuus - Movi Digital",
                "url": "https://landings.movi.digital/mutuus",
                "description": "Contratación autorizada de membresías de salud y seguros de gastos médicos Mutuus en México."
              },
              {
                "@type": "Product",
                "name": "Membresía de Salud y Gastos Médicos Mutuus",
                "description": "Protección médica privada con $0 de deducible y coaseguro en red de pago directo.",
                "brand": { "@type": "Brand", "name": "Mutuus" }
              },
              {
                "@type": "FAQPage",
                "mainEntity": FAQS.map(faq => ({
                  "@type": "Question",
                  "name": faq.q,
                  "acceptedAnswer": { "@type": "Answer", "text": faq.a }
                }))
              }
            ]
          })}
        </script>
      </Helmet>

      {/* ─── CONTENEDOR PRINCIPAL CON SCROLL COMPLETO ────────────────────── */}
      <div 
        className="w-full min-h-screen bg-white text-[#2B2A2A] font-sans antialiased relative"
        style={{ fontFamily: 'Montserrat, system-ui, -apple-system, sans-serif' }}
      >

        {/* ─── 1. HEADER LIMPIO, ESPACIOSO Y NO ENCIMADO ──────────────────── */}
        <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-xs">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
            
            {/* Logo y Leyenda de Promotor Autorizado */}
            <div className="flex items-center gap-3">
              <a href="#inicio" className="flex items-center">
                <MutuusLogo className="h-10 w-auto" />
              </a>

              <div className="h-7 w-[1px] bg-slate-200 hidden sm:block" />

              <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EFF6FF] border border-[#CBD5E1] text-[11px] font-bold text-[#003896]">
                <ShieldCheck className="w-3.5 h-3.5 text-[#003896]" />
                <span>Promotor Autorizado</span>
              </span>
            </div>

            {/* Menú de Navegación Desktop */}
            <nav className="hidden lg:flex items-center gap-6 xl:gap-8 text-sm font-semibold text-slate-700">
              <a href="#comparativa" className="hover:text-[#003896] transition-colors">¿Por qué Mutuus?</a>
              <a href="#planes" className="hover:text-[#003896] transition-colors">Planes & Tarifas</a>
              <a href="#hospitales" className="hover:text-[#003896] transition-colors">Red Hospitalaria</a>
              <a href="#app" className="hover:text-[#003896] transition-colors">App 24/7</a>
              <a href="#coberturas" className="hover:text-[#003896] transition-colors">Coberturas</a>
              <a href="#faq" className="hover:text-[#003896] transition-colors">FAQ</a>
            </nav>

            {/* Botón Contratar */}
            <div className="flex items-center gap-3">
              <a
                href="#"
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold text-white bg-[#003896] hover:bg-[#002b75] transition-all shadow-md shadow-[#003896]/20 active:scale-95"
              >
                <span>Contratar</span>
                <ArrowRight className="w-4 h-4" />
              </a>

              {/* Botón Menú Móvil */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 rounded-xl text-slate-700 hover:bg-slate-100 transition"
                aria-label="Abrir menú"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>

          </div>

          {/* Menú Desplegable en Móvil */}
          {mobileMenuOpen && (
            <div className="lg:hidden bg-white border-b border-slate-200 px-6 py-5 space-y-3 shadow-lg">
              <a
                href="#comparativa"
                onClick={() => setMobileMenuOpen(false)}
                className="block py-2 text-sm font-bold text-slate-800 hover:text-[#003896]"
              >
                ¿Por qué Mutuus?
              </a>
              <a
                href="#planes"
                onClick={() => setMobileMenuOpen(false)}
                className="block py-2 text-sm font-bold text-slate-800 hover:text-[#003896]"
              >
                Planes & Tarifas
              </a>
              <a
                href="#hospitales"
                onClick={() => setMobileMenuOpen(false)}
                className="block py-2 text-sm font-bold text-slate-800 hover:text-[#003896]"
              >
                Red Hospitalaria
              </a>
              <a
                href="#app"
                onClick={() => setMobileMenuOpen(false)}
                className="block py-2 text-sm font-bold text-slate-800 hover:text-[#003896]"
              >
                App & Telemedicina
              </a>
              <a
                href="#coberturas"
                onClick={() => setMobileMenuOpen(false)}
                className="block py-2 text-sm font-bold text-slate-800 hover:text-[#003896]"
              >
                Coberturas
              </a>
              <a
                href="#faq"
                onClick={() => setMobileMenuOpen(false)}
                className="block py-2 text-sm font-bold text-slate-800 hover:text-[#003896]"
              >
                Preguntas Frecuentes
              </a>
              <div className="pt-2">
                <a
                  href="#"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full py-3 rounded-full text-center font-bold text-sm text-white bg-[#003896] block"
                >
                  Contratar Plan
                </a>
              </div>
            </div>
          )}
        </header>

        {/* ─── 2. HERO SECTION CON ILUSTRACIÓN INTEGRADA ───────────────────── */}
        <section id="inicio" className="pt-12 pb-20 md:pt-20 md:pb-28 bg-gradient-to-b from-[#F4F9FF] via-white to-white overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              
              {/* Contenido Izquierdo */}
              <div className="lg:col-span-7 space-y-6">
                
                {/* Badge de Seguridad */}
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#EFF6FF] border border-[#CBD5E1] text-xs font-bold text-[#003896]">
                  <Sparkles className="w-4 h-4 text-[#003896]" />
                  <span>Cero Deducible · Cero Coaseguro en Red</span>
                </div>

                {/* H1 Principal con SEO Keyword */}
                <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-[#2B2A2A] tracking-tight leading-[1.12]">
                  Membresía de salud y gastos médicos con <span className="text-[#003896]">cero deducible</span>
                </h1>

                {/* Subtítulo Descriptivo */}
                <p className="text-base sm:text-lg text-slate-600 leading-relaxed font-normal max-w-2xl">
                  Accede a la mejor atención médica privada, telemedicina 24/7 ilimitada y respaldo hospitalario nacional sin pagar deducibles sorpresa al momento de una emergencia.
                </p>

                {/* Nota Legal visible */}
                <p className="text-xs text-slate-400 italic">
                  * Aplican términos, condiciones y periodos de espera estipulados en el contrato de póliza.
                </p>

                {/* Botón Contratar Principal */}
                <div className="pt-2">
                  <a
                    href="#"
                    className="inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-full text-base font-bold text-white bg-[#003896] hover:bg-[#002c77] transition-all shadow-lg shadow-[#003896]/25 hover:shadow-xl active:scale-98 text-center"
                  >
                    <span>Contratar Plan</span>
                    <ArrowRight className="w-5 h-5" />
                  </a>
                </div>

                {/* Micro-beneficios con Checks */}
                <div className="pt-6 border-t border-slate-200/80 grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs font-semibold text-slate-700">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#22C55E] stroke-[3]" />
                    <span>Médico en video 24/7</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#22C55E] stroke-[3]" />
                    <span>115+ Hospitales directos</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#22C55E] stroke-[3]" />
                    <span>Trámite 100% digital</span>
                  </div>
                </div>

              </div>

              {/* Tarjeta Visual Hero Derecha (Ilustración Gráfica) */}
              <div className="lg:col-span-5">
                <div className="rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-[#003896] to-[#00225d] text-white shadow-2xl border border-white/20 relative overflow-hidden">
                  
                  <div className="space-y-6">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs font-bold text-[#9CD41C] border border-white/10">
                      <Hospital className="w-4 h-4" />
                      <span>Pago Directo al Hospital</span>
                    </div>

                    <h3 className="text-2xl font-black text-white leading-snug">
                      La diferencia real de no pagar deducible:
                    </h3>

                    {/* Comparativa rápida visual */}
                    <div className="space-y-3">
                      <div className="p-3.5 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-between">
                        <div>
                          <p className="text-xs text-white/70">Seguro Tradicional</p>
                          <p className="text-sm font-bold text-white">Deducible + Coaseguro</p>
                        </div>
                        <span className="text-rose-300 font-extrabold text-sm">$60,000+ MXN</span>
                      </div>

                      <div className="p-4 rounded-2xl bg-[#9CD41C] text-slate-900 border border-[#9CD41C] flex items-center justify-between shadow-lg">
                        <div>
                          <p className="text-xs font-bold text-slate-800">Con Membresía Mutuus</p>
                          <p className="text-base font-black text-slate-900">En Red Hospitalaria</p>
                        </div>
                        <span className="text-2xl font-black text-slate-900">$0 MXN</span>
                      </div>
                    </div>

                    <p className="text-xs text-white/75 leading-relaxed">
                      Sin trámites engorrosos de reembolso ni desembolsos iniciales que desestabilicen el patrimonio de tu familia.
                    </p>

                    <a
                      href="#"
                      className="w-full py-3.5 px-6 rounded-full font-extrabold text-sm text-slate-900 bg-[#9CD41C] hover:bg-[#8ec218] transition-all shadow-md active:scale-95 text-center block"
                    >
                      Contratar Membresía Mutuus
                    </a>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ─── 3. DEFINICIÓN CON ESCUDO ──────────────────────────────────── */}
        <section className="py-12 bg-white">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="p-6 sm:p-8 rounded-3xl bg-[#EFF6FF] border border-[#CBD5E1] flex flex-col md:flex-row items-center gap-6 shadow-xs">
              <div className="w-16 h-16 rounded-2xl bg-[#003896] text-white flex items-center justify-center flex-shrink-0 shadow-md">
                <ShieldCheck className="w-9 h-9 text-[#9CD41C]" />
              </div>
              <div className="space-y-2 text-center md:text-left">
                <h2 className="text-xl sm:text-2xl font-extrabold text-[#003896]">
                  ¿Cómo funciona el modelo Mutuus?
                </h2>
                <p className="text-sm sm:text-base text-slate-700 leading-relaxed font-normal">
                  Mutuus es el esquema integral de salud privada que elimina las barreras económicas tradicionales: combina consultas médicas ilimitadas por videollamada 24/7 y una póliza hospitalaria que te garantiza <strong className="text-[#003896] font-bold">cero deducible y cero coaseguro</strong> al atenderte en su red nacional de hospitales certificados.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ─── 4. POR QUÉ MUTUUS (COMPARATIVA DE 3 COLUMNAS) ──────────────── */}
        <section id="comparativa" className="py-20 bg-[#F4F9FF]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            
            <div className="text-center max-w-3xl mx-auto space-y-3 mb-14">
              <span className="px-3 py-1 rounded-full bg-white border border-[#CBD5E1] text-xs font-bold text-[#003896] uppercase tracking-wider">
                Impacto Financiero Real
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-[#003896]">
                ¿Por qué elegir Mutuus frente a un seguro tradicional?
              </h2>
              <p className="text-slate-600 text-sm sm:text-base">
                Ejemplo real de una cuenta hospitalaria de <strong className="text-slate-900 font-bold">$705,500 MXN</strong> por atención de urgencia médica:
              </p>
            </div>

            {/* Grid 3 Columnas Comparativas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch">
              
              {/* Columna 1: Mutuus (Destacada) */}
              <div className="rounded-3xl p-6 sm:p-8 bg-white border-2 border-[#003896] shadow-xl relative flex flex-col justify-between order-1 ring-4 ring-[#003896]/10">
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-[#003896] text-white text-xs font-extrabold uppercase tracking-wide">
                  Opción Mutuus
                </div>

                <div className="space-y-6 pt-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                      <ShieldCheck className="w-6 h-6 text-[#22C55E]" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-[#003896]">Con Mutuus</h3>
                      <p className="text-xs text-slate-500">En Red de Pago Directo</p>
                    </div>
                  </div>

                  <div className="space-y-3 text-sm border-t border-slate-100 pt-4">
                    <div className="flex justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-600">Cuenta hospitalaria:</span>
                      <span className="font-bold text-slate-900">$705,500 MXN</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-600">Deducible pagado:</span>
                      <span className="font-bold text-[#22C55E]">$0 MXN</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-600">Coaseguro (10%):</span>
                      <span className="font-bold text-[#22C55E]">$0 MXN</span>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-4 border-t-2 border-slate-100 bg-[#EFF6FF] -mx-6 -mb-6 p-6 rounded-b-3xl">
                  <p className="text-xs font-bold text-[#003896] uppercase">Pago Final de tu Bolsillo:</p>
                  <p className="text-3xl font-black text-[#003896] mt-1">$0 MXN</p>
                  <p className="text-[11px] text-slate-500 mt-1">Condonación total cumpliendo protocolo en red.</p>
                </div>
              </div>

              {/* Columna 2: Seguro Tradicional */}
              <div className="rounded-3xl p-6 sm:p-8 bg-white border border-slate-200 shadow-sm flex flex-col justify-between order-2">
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-amber-700" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-800">Seguro Tradicional</h3>
                      <p className="text-xs text-slate-500">Póliza GMM Estándar</p>
                    </div>
                  </div>

                  <div className="space-y-3 text-sm border-t border-slate-100 pt-4">
                    <div className="flex justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-600">Cuenta hospitalaria:</span>
                      <span className="font-bold text-slate-900">$705,500 MXN</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-600">Deducible inicial:</span>
                      <span className="font-bold text-rose-600">$25,000 MXN</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-600">Coaseguro (tope):</span>
                      <span className="font-bold text-rose-600">$35,000 MXN</span>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-4 border-t border-slate-100 bg-slate-50 -mx-6 -mb-6 p-6 rounded-b-3xl">
                  <p className="text-xs font-bold text-slate-500 uppercase">Pago Final de tu Bolsillo:</p>
                  <p className="text-3xl font-black text-rose-600 mt-1">$60,000 MXN</p>
                  <p className="text-[11px] text-slate-400 mt-1">Más trámites de dictamen y reembolsos.</p>
                </div>
              </div>

              {/* Columna 3: Sin Seguro */}
              <div className="rounded-3xl p-6 sm:p-8 bg-white border border-slate-200 shadow-sm flex flex-col justify-between order-3">
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center">
                      <X className="w-5 h-5 text-rose-600 stroke-[3]" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-800">Sin Protección</h3>
                      <p className="text-xs text-slate-500">Gasto de Bolsillo 100%</p>
                    </div>
                  </div>

                  <div className="space-y-3 text-sm border-t border-slate-100 pt-4">
                    <div className="flex justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-600">Cuenta hospitalaria:</span>
                      <span className="font-bold text-slate-900">$705,500 MXN</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-600">Descuento aplicado:</span>
                      <span className="font-bold text-slate-500">$0 MXN</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-600">Cobertura médica:</span>
                      <span className="font-bold text-slate-500">0%</span>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-4 border-t border-slate-100 bg-rose-50 -mx-6 -mb-6 p-6 rounded-b-3xl">
                  <p className="text-xs font-bold text-rose-700 uppercase">Pago Total Requerido:</p>
                  <p className="text-3xl font-black text-rose-700 mt-1">$705,500 MXN</p>
                  <p className="text-[11px] text-rose-600 mt-1">Riesgo de endeudamiento familiar severo.</p>
                </div>
              </div>

            </div>

          </div>
        </section>

        {/* ─── 5. APP Y TELEMEDICINA 24/7 ─────────────────────────────────── */}
        <section id="app" className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              
              {/* Mockup Móvil */}
              <div className="lg:col-span-5 order-2 lg:order-1 flex justify-center">
                <div className="w-full max-w-xs p-5 rounded-[36px] bg-slate-900 text-white shadow-2xl border-4 border-slate-800">
                  <div className="h-5 flex items-center justify-center mb-3">
                    <div className="w-20 h-3 bg-black rounded-full" />
                  </div>

                  <div className="rounded-2xl bg-gradient-to-br from-[#003896] to-[#00225d] p-4 text-white space-y-4">
                    <div className="flex items-center justify-between border-b border-white/10 pb-3">
                      <div>
                        <p className="text-[10px] text-white/70">Credencial Digital</p>
                        <p className="text-xs font-extrabold">Mutuus Salud</p>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-black text-[9px]">ACTIVA</span>
                    </div>

                    <div className="space-y-2">
                      <div className="p-3 rounded-xl bg-white/10 flex items-center gap-2.5">
                        <Video className="w-5 h-5 text-[#9CD41C]" />
                        <div>
                          <p className="text-[11px] font-bold">Consulta Médica 24/7</p>
                          <p className="text-[9px] text-white/70">Videollamada en &lt; 2 min</p>
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-white/10 flex items-center gap-2.5">
                        <Hospital className="w-5 h-5 text-blue-300" />
                        <div>
                          <p className="text-[11px] font-bold">115+ Hospitales en Red</p>
                          <p className="text-[9px] text-white/70">Pago directo geolocalizado</p>
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-white/10 flex items-center gap-2.5">
                        <FileText className="w-5 h-5 text-[#9CD41C]" />
                        <div>
                          <p className="text-[11px] font-bold">Receta Digital</p>
                          <p className="text-[9px] text-white/70">Válida en farmacias de México</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Contenido Descriptivo */}
              <div className="lg:col-span-7 order-1 lg:order-2 space-y-6">
                <span className="px-3 py-1 rounded-full bg-[#EFF6FF] border border-[#CBD5E1] text-xs font-bold text-[#003896] uppercase tracking-wider">
                  Telemedicina & Asistencia Inmediata
                </span>

                <h2 className="text-3xl sm:text-4xl font-extrabold text-[#003896]">
                  Tu médico de cabecera disponible las 24 horas del día
                </h2>

                <p className="text-slate-600 text-base leading-relaxed">
                  Olvídate de las salas de espera para dudas comunes o síntomas leves. Con la app de Mutuus tienes contacto directo e inmediato con profesionales de la salud los 365 días del año.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="p-4 rounded-2xl bg-[#F4F9FF] border border-slate-200">
                    <h4 className="font-bold text-slate-900 text-sm mb-1">Videollamadas Ilimitadas</h4>
                    <p className="text-xs text-slate-600">Sin costo por consulta ni límites mensuales para ti y tus dependientes.</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-[#F4F9FF] border border-slate-200">
                    <h4 className="font-bold text-slate-900 text-sm mb-1">Receta Médica Digital</h4>
                    <p className="text-xs text-slate-600">Emisión legal de recetas con firma electrónica válida en farmacias de todo México.</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-[#F4F9FF] border border-slate-200">
                    <h4 className="font-bold text-slate-900 text-sm mb-1">Gestión de Membresía</h4>
                    <p className="text-xs text-slate-600">Consulta estatus de pagos, vigencia de póliza y reportes de eventos.</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-[#F4F9FF] border border-slate-200">
                    <h4 className="font-bold text-slate-900 text-sm mb-1">Directorio Hospitalario</h4>
                    <p className="text-xs text-slate-600">Encuentra los hospitales de pago directo más cercanos con un solo clic.</p>
                  </div>
                </div>

                <div className="pt-2">
                  <a
                    href="#"
                    className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-[#003896] text-white font-bold text-sm hover:bg-[#002b75] transition-all shadow-md"
                  >
                    <span>Contratar Membresía</span>
                    <ArrowRight className="w-4 h-4" />
                  </a>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ─── 6. PLANES Y TARIFAS TRANSPARENTES ──────────────────────────── */}
        <section id="planes" className="py-20 bg-[#F4F9FF]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            
            <div className="text-center max-w-3xl mx-auto space-y-4 mb-12">
              <span className="px-3 py-1 rounded-full bg-white border border-[#CBD5E1] text-xs font-bold text-[#003896] uppercase tracking-wider">
                Tarifas y Coberturas Oficiales
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-[#003896]">
                Elige el plan diseñado para ti y tu familia
              </h2>
              <p className="text-slate-600 text-sm sm:text-base">
                Precios claros, sin costos ocultos ni letras pequeñas. Respaldo asegurador oficial en moneda nacional (MXN).
              </p>

              {/* Selector Switch Mensual / Anual */}
              <div className="pt-4 flex items-center justify-center">
                <div className="bg-white p-1 rounded-full border border-slate-200 shadow-xs inline-flex">
                  <button
                    onClick={() => setPeriodicidad('anual')}
                    className={`px-6 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      periodicidad === 'anual'
                        ? 'bg-[#003896] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Pago Anual (Ahorro 10%)
                  </button>
                  <button
                    onClick={() => setPeriodicidad('mensual')}
                    className={`px-6 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      periodicidad === 'mensual'
                        ? 'bg-[#003896] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
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
                      ? 'border-2 border-[#003896] shadow-2xl scale-102 lg:-translate-y-2 ring-4 ring-[#003896]/10'
                      : 'border border-slate-200 shadow-md hover:shadow-xl'
                  }`}
                >
                  {p.popular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-[#003896] text-white text-xs font-extrabold uppercase tracking-wide">
                      {p.badge}
                    </div>
                  )}

                  <div>
                    {!p.popular && (
                      <span className="inline-block px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold mb-3">
                        {p.badge}
                      </span>
                    )}

                    <h3 className="text-2xl font-black text-[#2B2A2A] mt-2">{p.nombre}</h3>
                    
                    <div className="mt-4 pb-5 border-b border-slate-100">
                      <p className="text-xs text-slate-500 font-medium">Suma Asegurada por Padecimiento:</p>
                      <p className="text-xl font-extrabold text-[#003896]">{p.sumaAsegurada}</p>
                      
                      <div className="mt-3 flex items-baseline gap-1">
                        <span className="text-3xl sm:text-4xl font-black text-slate-900">{p.cuota}</span>
                        <span className="text-xs text-slate-500 font-semibold">MXN / {p.periodo}</span>
                      </div>
                      
                      {p.ahorro && (
                        <span className="inline-block mt-1 px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[11px] font-bold">
                          {p.ahorro}
                        </span>
                      )}
                    </div>

                    {/* Lista de Beneficios */}
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
                      href="#"
                      className={`w-full py-3.5 px-6 rounded-full font-bold text-xs sm:text-sm transition-all shadow-md active:scale-95 text-center block ${
                        p.popular
                          ? 'bg-[#003896] text-white hover:bg-[#002b75]'
                          : 'bg-slate-900 text-white hover:bg-slate-800'
                      }`}
                    >
                      Contratar {p.nombre}
                    </a>
                  </div>

                </div>
              ))}
            </div>

            {/* Aviso de vigencia de tarifas */}
            <p className="text-center text-xs text-slate-500 mt-10">
              * Tarifas vigentes al 2026. Precios en Moneda Nacional con IVA incluido. Consulta condicionado general de póliza para sumas aseguradas por parentesco.
            </p>

          </div>
        </section>

        {/* ─── 7. RED HOSPITALARIA Y EXPLORADOR ────────────────────────────── */}
        <section id="hospitales" className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            
            <div className="text-center max-w-3xl mx-auto space-y-3 mb-10">
              <span className="px-3 py-1 rounded-full bg-[#EFF6FF] border border-[#CBD5E1] text-xs font-bold text-[#003896] uppercase tracking-wider">
                Infraestructura Hospitalaria
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-[#003896]">
                Red Médica Nacional de Pago Directo
              </h2>
              <p className="text-slate-600 text-sm sm:text-base">
                Más de <strong>115 hospitales de pago directo</strong> y más de <strong>548 instituciones médicas</strong> en convenio en toda la República Mexicana.
              </p>
            </div>

            {/* Buscador de Hospitales */}
            <div className="max-w-md mx-auto mb-10">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchHospital}
                  onChange={(e) => setSearchHospital(e.target.value)}
                  placeholder="Buscar hospital o ciudad (ej. Ángeles, CDMX, Monterrey)..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-full border border-slate-300 bg-slate-50 text-xs focus:outline-none focus:ring-2 focus:ring-[#003896] focus:bg-white transition"
                />
              </div>
            </div>

            {/* Grid de Hospitales */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {filteredHospitales.map((h, i) => (
                <div
                  key={i}
                  className="p-5 rounded-2xl bg-[#F4F9FF] border border-slate-200/80 hover:border-[#003896] hover:shadow-md transition-all group flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2.5 mb-2.5">
                      <div className="w-8 h-8 rounded-xl bg-white text-[#003896] border border-slate-200 flex items-center justify-center font-bold text-sm group-hover:bg-[#003896] group-hover:text-white transition-colors">
                        <Hospital className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm line-clamp-1">{h.nombre}</h4>
                        <span className="text-[10px] font-semibold text-[#003896] uppercase">{h.tipo}</span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 flex items-start gap-1 mt-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                      <span>{h.ubicaciones}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-10 p-6 rounded-2xl bg-[#EFF6FF] border border-blue-200/60 text-center max-w-2xl mx-auto">
              <p className="text-xs sm:text-sm text-slate-700">
                ¿Buscas un hospital específico en tu ciudad? Nuestro equipo te apoya con la ubicación exacta.
              </p>
              <a
                href="#"
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-[#003896] hover:underline"
              >
                <span>Contratar para acceder a la red completa</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>

          </div>
        </section>

        {/* ─── 8. LÍNEA DE ATENCIÓN (FRANJA AZUL #003896) ─────────────────── */}
        <section className="py-16 bg-[#003896] text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-8 text-center lg:text-left">
              
              <div className="space-y-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-xs font-bold text-[#9CD41C] border border-white/10 uppercase tracking-wider">
                  <Clock className="w-3.5 h-3.5" /> Atención Médica Continua 24/7/365
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                  Protección Hospitalaria y Telemedicina en Todo México
                </h2>
                <p className="text-white/80 text-sm max-w-xl">
                  Acceso garantizado a consultas médicas digitales y coordinación de atención hospitalaria con cero deducible en red.
                </p>
              </div>

              <div>
                <a
                  href="#"
                  className="px-8 py-4 rounded-full font-extrabold text-sm text-slate-900 bg-[#9CD41C] hover:bg-[#8ec218] transition-all shadow-lg active:scale-95 inline-flex items-center gap-2"
                >
                  <span>Contratar Ahora</span>
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>

            </div>
          </div>
        </section>

        {/* ─── 9. COBERTURAS: QUÉ CUBRE VS QUÉ NO CUBRE ──────────────────── */}
        <section id="coberturas" className="py-20 bg-[#F4F9FF]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            
            <div className="text-center max-w-2xl mx-auto space-y-3 mb-12">
              <span className="px-3 py-1 rounded-full bg-white border border-[#CBD5E1] text-xs font-bold text-[#003896] uppercase tracking-wider">
                Transparencia Total
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-[#003896]">
                Claridad en lo que cubre tu membresía
              </h2>
              <p className="text-slate-600 text-sm">
                Sin letras chiquitas. Conoce con total exactitud el alcance de tu protección médica.
              </p>

              {/* Tabs */}
              <div className="pt-4 flex justify-center">
                <div className="bg-white p-1 rounded-full border border-slate-200 shadow-xs inline-flex">
                  <button
                    onClick={() => setTabCobertura('cubierto')}
                    className={`px-6 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      tabCobertura === 'cubierto'
                        ? 'bg-[#22C55E] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    ✓ Qué está Cubierto
                  </button>
                  <button
                    onClick={() => setTabCobertura('no_cubierto')}
                    className={`px-6 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      tabCobertura === 'no_cubierto'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    ✕ Qué no Cubre (Exclusiones)
                  </button>
                </div>
              </div>
            </div>

            {/* Contenido de Tabs */}
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
                  <div key={idx} className="p-5 rounded-2xl bg-white border border-emerald-100 shadow-xs flex items-start gap-3">
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
                  <div key={idx} className="p-5 rounded-2xl bg-white border border-rose-100 shadow-xs flex items-start gap-3">
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

        {/* ─── 10. MÉTRICAS Y PRUEBA SOCIAL ───────────────────────────────── */}
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 text-center">
              
              <div className="p-6 rounded-2xl bg-[#F4F9FF] border border-slate-200/70">
                <p className="text-3xl sm:text-4xl font-black text-[#003896]">+50,000</p>
                <p className="text-xs sm:text-sm font-semibold text-slate-700 mt-1">Miembros Protegidos</p>
                <p className="text-[11px] text-slate-500 mt-0.5">En toda la República Mexicana</p>
              </div>

              <div className="p-6 rounded-2xl bg-[#F4F9FF] border border-slate-200/70">
                <p className="text-3xl sm:text-4xl font-black text-[#003896]">100%</p>
                <p className="text-xs sm:text-sm font-semibold text-slate-700 mt-1">Deducible $0 en Red</p>
                <p className="text-[11px] text-slate-500 mt-0.5">En eventos autorizados</p>
              </div>

              <div className="p-6 rounded-2xl bg-[#F4F9FF] border border-slate-200/70">
                <p className="text-3xl sm:text-4xl font-black text-[#003896]">+115</p>
                <p className="text-xs sm:text-sm font-semibold text-slate-700 mt-1">Hospitales Directos</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Y +548 en convenio nacional</p>
              </div>

              <div className="p-6 rounded-2xl bg-[#F4F9FF] border border-slate-200/70">
                <p className="text-3xl sm:text-4xl font-black text-[#003896]">98.4%</p>
                <p className="text-xs sm:text-sm font-semibold text-slate-700 mt-1">Satisfacción Médica</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Opiniones verificadas</p>
              </div>

            </div>
          </div>
        </section>

        {/* ─── 11. FAQ ACCORDION ──────────────────────────────────────────── */}
        <section id="faq" className="py-20 bg-[#F4F9FF]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            
            <div className="text-center space-y-3 mb-12">
              <span className="px-3 py-1 rounded-full bg-white border border-[#CBD5E1] text-xs font-bold text-[#003896] uppercase tracking-wider">
                Resolvemos tus Dudas
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-[#003896]">
                Preguntas Frecuentes
              </h2>
              <p className="text-slate-600 text-sm">
                Todo lo que necesitas saber antes de contratar tu membresía de salud.
              </p>
            </div>

            <div className="space-y-3">
              {FAQS.map((faq, idx) => {
                const isOpen = openFaq === idx;
                return (
                  <div
                    key={idx}
                    className="rounded-2xl bg-white border border-slate-200/80 overflow-hidden transition-all shadow-xs"
                  >
                    <button
                      onClick={() => setOpenFaq(isOpen ? null : idx)}
                      className="w-full p-5 text-left flex items-center justify-between gap-4 font-bold text-slate-900 text-sm sm:text-base hover:text-[#003896] transition-colors cursor-pointer"
                    >
                      <span>{faq.q}</span>
                      {isOpen ? (
                        <ChevronUp className="w-5 h-5 text-[#003896] flex-shrink-0" />
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

        {/* ─── 12. CTA FINAL CON LINK A # ─────────────────────────────────── */}
        <section className="py-20 bg-[#003896] text-white text-center">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
            <span className="px-3.5 py-1 rounded-full bg-white/20 text-xs font-bold text-[#9CD41C] uppercase tracking-wider">
              Contratación Inmediata
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
              Protege tu salud y la de tu familia hoy mismo
            </h2>
            <p className="text-white/80 text-sm max-w-xl mx-auto">
              Activa tu membresía de salud y seguro de gastos médicos con cero deducible en red y telemedicina 24/7.
            </p>
            <div className="pt-4">
              <a
                href="#"
                className="inline-flex items-center justify-center gap-2 px-9 py-4 rounded-full font-black text-sm text-slate-900 bg-[#9CD41C] hover:bg-[#8ec218] transition-all shadow-xl active:scale-95"
              >
                <span>Contratar Ahora</span>
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        </section>

        {/* ─── 13. FOOTER INSTITUCIONAL Y LEGAL ───────────────────────────── */}
        <footer className="bg-[#00225d] text-white/80 text-xs py-14 border-t border-white/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              
              {/* Columna 1: Marca y Promotor */}
              <div className="space-y-3">
                <span className="font-extrabold text-2xl text-white tracking-tight block">
                  mutuus
                </span>
                <p className="text-white/70 text-xs leading-relaxed">
                  Promotoría Autorizada de Mutuus. Distribución y asesoría certificada de membresías de salud y pólizas de gastos médicos.
                </p>
                <div className="pt-1">
                  <span className="inline-block px-2.5 py-1 rounded-full bg-white/10 text-[10px] font-bold text-[#9CD41C] border border-white/10">
                    Promotor Oficial Grupo JIRO / Movi Digital
                  </span>
                </div>
              </div>

              {/* Columna 2: Navegación */}
              <div className="space-y-2">
                <p className="font-bold text-white text-sm">Secciones</p>
                <ul className="space-y-1.5 text-white/70">
                  <li><a href="#comparativa" className="hover:text-white transition-colors">¿Por qué Mutuus?</a></li>
                  <li><a href="#planes" className="hover:text-white transition-colors">Planes UNO, DOS y PLUS</a></li>
                  <li><a href="#hospitales" className="hover:text-white transition-colors">Red de Hospitales</a></li>
                  <li><a href="#coberturas" className="hover:text-white transition-colors">Tabulador de Coberturas</a></li>
                  <li><a href="#faq" className="hover:text-white transition-colors">Preguntas Frecuentes</a></li>
                </ul>
              </div>

              {/* Columna 3: Documentación Legal */}
              <div className="space-y-2">
                <p className="font-bold text-white text-sm">Documentos Oficiales</p>
                <ul className="space-y-1.5 text-white/70">
                  <li><a href="#" className="hover:text-white transition-colors flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> Condiciones Generales Póliza</a></li>
                  <li><a href="#" className="hover:text-white transition-colors flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> Manual de Membresía Salud</a></li>
                  <li><a href="#" className="hover:text-white transition-colors flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> Términos y Condiciones</a></li>
                  <li><a href="#" className="hover:text-white transition-colors flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> Aviso de Privacidad Integral</a></li>
                </ul>
              </div>

              {/* Columna 4: Contratación */}
              <div className="space-y-2">
                <p className="font-bold text-white text-sm">Contratación</p>
                <p className="text-white/70 text-xs">
                  Planes de salud individuales, familiares y colectivos.
                </p>
                <div className="pt-2">
                  <a
                    href="#"
                    className="inline-block px-4 py-2 rounded-full bg-white/10 text-white font-bold text-xs hover:bg-white/20 transition"
                  >
                    Contratar en Línea
                  </a>
                </div>
              </div>

            </div>

            {/* Notas Legales Regulatorias */}
            <div className="pt-8 border-t border-white/10 space-y-2 text-[11px] text-white/50 leading-relaxed">
              <p>
                * Mutuus es una marca registrada. Este sitio es operado por promotores y asesores profesionales autorizados para la intermediación y difusión de sus productos. La condonación del deducible y coaseguro opera exclusivamente bajo el estricto cumplimiento del protocolo de atención en la red de pago directo y reporte previo del siniestro. Cobertura de maternidad sujeta a 10 meses continuos y topes establecidos en Unidades de Medida y Actualización (UMA).
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-between pt-4 text-white/40">
                <p>© {new Date().getFullYear()} landings.movi.digital/mutuus · Todos los derechos reservados.</p>
                <p>Cumplimiento WCAG 2.1 AA · Optimizado para SEO & GEO México</p>
              </div>
            </div>

          </div>
        </footer>

      </div>
    </>
  );
}
