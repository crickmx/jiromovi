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
// Lista de Precios Julio 2026, material vigente de planes y preguntas frecuentes de
// Mutuus (octubre 2026), Condiciones Generales de la póliza colectiva MetLife v06.2026
// y Condiciones de la Membresía v06.2026. Todo el texto está redactado de nuevo; no
// se copia ni se enlaza el sitio de Mutuus. Si cambia algo, se cambia contra esos
// documentos, no a mano.
// Teléfonos para reportar un evento: el de atención que hoy publica Mutuus y el que
// marcan las Condiciones de la Membresía (opción 0). Se muestran los dos.
export const MUTUUS_TELEFONO = '55 8311 3800';
export const MUTUUS_TELEFONO_CG = '55 8525 8800';

// ─── FAQ Data ────────────────────────────────────────────────────────────────
const DEFAULT_FAQS = [
  {
    q: '¿Qué es Mutuus?',
    a: 'Es una membresía de salud digital que incluye una cobertura de gastos médicos mayores y menores. La parte hospitalaria está amparada por una póliza colectiva de MetLife México, en la que Mutuus funciona como contratante; Mutuus no es una aseguradora, es una empresa de tecnología en salud. Su diferencia principal es que, al reportar tu evento y atenderte en su red coordinada, no pagas deducible ni coaseguro.'
  },
  {
    q: '¿En qué se distingue de un seguro de gastos médicos tradicional?',
    a: 'En un seguro tradicional pagas primero un deducible y después un porcentaje de la cuenta (el coaseguro suele rondar el 10%, y la CONDUSEF lo ubica entre 5% y 20%). Con Mutuus, si cumples el procedimiento, ese desembolso es de $0. Además, los servicios del día a día —telemedicina, ambulancia, checkup y limpieza dental— se pueden usar desde que inicia tu membresía, sin esperar a una emergencia.'
  },
  {
    q: '¿Qué tengo que hacer para no pagar deducible ni coaseguro?',
    a: `Avisar a Mutuus antes de usar tu cobertura, por la app o por teléfono (${MUTUUS_TELEFONO}, o ${MUTUUS_TELEFONO_CG} opción 0). Un médico urgenciólogo revisa tu caso y te indica a qué hospital de la red acudir; Mutuus notifica tu ingreso y autoriza eliminar el deducible y el coaseguro. Si hay riesgo de vida, puedes avisar dentro de las 24 horas siguientes.`
  },
  {
    q: '¿Qué pasa si no aviso antes o me atiendo fuera de la red?',
    a: 'Si usas tu membresía sin avisar primero, se aplica un deducible no reembolsable de $40,000 y un coaseguro del 50% del costo del evento, sin tope. Fuera de la red coordinada (incluidos algunos hospitales de alto nivel que solo operan por reembolso), aplican el deducible y el coaseguro de la póliza, y el reembolso se paga en un plazo no menor a 40 días hábiles después de entregar la documentación completa.'
  },
  {
    q: '¿Cuántos hospitales tiene la red?',
    a: 'Más de 500 hospitales en todo el país, de los cuales más de 110 trabajan con pago directo: llegas, te atiendes y te vas sin pagar ni tramitar reembolsos. Antes de ir, el equipo médico de Mutuus te dice cuál te conviene según tu caso y ubicación.'
  },
  {
    q: '¿Cómo funciona la suma asegurada "reinstalable"?',
    a: 'La suma asegurada ($1,000,000 en el Plan UNO y $2,000,000 en DOS y Plus) es el tope total para todos tus padecimientos cubiertos durante el año de vigencia. Si se agotara antes de terminar el año, vuelve a estar completa al renovar tu membresía.'
  },
  {
    q: '¿Qué incluye cada plan?',
    a: 'El Plan UNO cubre hasta $1,000,000 al año e incluye telemedicina 24/7, nutriólogo y psicólogo en la app, checkup y limpieza dental anuales, ambulancia, especialistas a precio preferencial, gastos funerarios y $100,000 por muerte accidental. El Plan DOS sube la suma a $2,000,000 y agrega hasta USD $50,000 para emergencias en el extranjero. El Plan Plus suma $490,000 por muerte accidental, renta diaria por hospitalización, $122,500 por diagnóstico de cáncer, plan visual y beneficios veterinarios en la app.'
  },
  {
    q: '¿Cubre maternidad?',
    a: 'Sí, para la asegurada titular: parto natural hasta 20 UMAM y cesárea hasta 25 UMAM. Las complicaciones del embarazo, el parto y el puerperio tienen una suma propia de $1,000,000. Para que aplique, el embarazo debe iniciar después del primer mes de vigencia continua.'
  },
  {
    q: '¿Hay periodos de espera?',
    a: 'Sí. Las enfermedades que inicien en los primeros 30 días no se cubren (los accidentes sí). Un grupo de padecimientos, entre ellos hernias, columna vertebral, padecimientos ortopédicos, vesícula y cáncer, requiere 2 años de antigüedad; el VIH y las enfermedades de transmisión sexual, 5 años. Los servicios de telemedicina, ambulancia, checkup y limpieza dental funcionan desde el primer día.'
  },
  {
    q: '¿Se cubren enfermedades preexistentes?',
    a: 'No. Cualquier padecimiento que ya existiera antes de contratar —declarado o no, con diagnóstico, síntomas o tratamiento previo— queda excluido sin importar la antigüedad.'
  },
  {
    q: '¿Quién puede contratar?',
    a: 'Titulares mayores de 18 y menores de 65 años, con residencia en México. Los hijos menores de 18 años pueden incluirse como dependientes con un costo adicional; con pago anual de contado se incluye un hijo menor sin costo. Al cumplir 70 años, quien ha pagado de forma continua pasa a Adulto Inteligente y puede seguir protegido hasta los 99.'
  },
  {
    q: '¿Cómo pago y puedo cancelar?',
    a: 'Con pago anual, Flex (pago inicial más 11 mensualidades) o 12 meses con tarjeta de crédito. No se aceptan pagos en efectivo. Si cambias de opinión, puedes cancelar con reembolso dentro de los primeros 5 días hábiles; si un pago se atrasa más de 15 días naturales, la membresía puede cancelarse.'
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
  'Consultas con especialistas de la red a precio preferencial, desde $650',
  'Médico general a domicilio con tarifa preferente',
  'Telemedicina con médico general, nutriólogo y psicólogo desde la app',
  'Descuentos en medicamentos y estudios de laboratorio',
  'Urgencia dental además de la limpieza anual',
  'Asistencia funeraria de hasta $30,000',
  'Tratamientos de alto costo fuera del hospital: cáncer, medicamentos para enfermedades autoinmunes y medicamentos de más de $10,000',
  'Cirugía de cataratas: un evento por ojo'
];

// ─── Condiciones Generales en lenguaje claro ─────────────────────────────────
// Resumen de las Condiciones Generales de la póliza colectiva (MetLife, v06.2026) y
// de las Condiciones de la Membresía (v06.2026). Ante cualquier diferencia mandan
// los documentos completos.
const CONDICIONES_GENERALES = [
  {
    t: 'Quién respalda tu cobertura',
    d: 'La parte hospitalaria es una póliza colectiva de Gastos Médicos Mayores de MetLife México. Mutuus es el contratante y te adhiere a ella al comprar tu membresía; los servicios de salud adicionales los prestan proveedores especializados.'
  },
  {
    t: 'Cuándo pagas $0',
    d: 'El deducible y el coaseguro se eliminan cuando se cumplen tres cosas: reportas el evento a Mutuus antes de usar tu cobertura, te atiendes en un hospital de la red coordinada y Mutuus autoriza el ingreso tras el dictamen médico.'
  },
  {
    t: 'Si no reportas antes',
    d: 'Se cobra un deducible no reembolsable de $40,000 y un coaseguro del 50% sin tope. Si hay riesgo de vida, el aviso puede darse dentro de las 24 horas posteriores al evento.'
  },
  {
    t: 'Hospitales que operan solo por reembolso',
    d: 'En un grupo de hospitales de alto nivel (por ejemplo ABC, Ángeles, Español, Médica Sur o Star Médica) la atención es por reembolso, con el deducible y el coaseguro de la póliza, aunque hayas reportado el evento.'
  },
  {
    t: 'Suma asegurada por año',
    d: 'Es un tope único para todos los gastos cubiertos durante la vigencia. Si se agota, se restablece completa al renovar la membresía.'
  },
  {
    t: 'Emergencias en el extranjero',
    d: 'Los planes DOS y Plus cubren hasta USD $50,000 sin deducible ni coaseguro, solo por reembolso y únicamente mientras dura la emergencia y hasta estabilizar al paciente. No incluye parto, cesárea ni cirugías programadas.'
  },
  {
    t: 'Lo que pasa fuera del hospital',
    d: 'La póliza cubre gastos hospitalarios. Fuera del hospital solo se cubren tratamientos de alto costo (cáncer, medicamentos para padecimientos autoinmunes y medicamentos de más de $10,000); las consultas externas se atienden con los descuentos y servicios de la membresía.'
  },
  {
    t: 'Edades y dependientes',
    d: 'Titulares de 18 a 64 años al contratar e hijos menores de 18 como dependientes. Al cumplir 18, el hijo puede contratar su propia membresía conservando su antigüedad. La permanencia llega hasta los 99 años con pagos continuos.'
  },
  {
    t: 'Pagos, cancelación y rescisión',
    d: 'No se aceptan pagos en efectivo. La cancelación con reembolso solo procede en los primeros 5 días hábiles. Con más de 15 días naturales de atraso la membresía puede cancelarse. Declarar información falsa u omitir preexistencias permite rescindirla con una penalización del 40% de su costo.'
  },
  {
    t: 'Cómo se tramita un reclamo',
    d: 'Todo se gestiona con Mutuus, no directamente con la aseguradora. Para reembolsos se necesitan comprobantes fiscales, estudios con tus datos y tu RFC con homoclave; el pago llega en un plazo no menor a 40 días hábiles tras completar el expediente.'
  },
  {
    t: 'Exclusiones principales',
    d: 'Preexistencias, tratamientos estéticos, infertilidad, padecimientos mentales y adicciones, chequeos preventivos dentro de la póliza, tratamientos experimentales, deportes profesionales o de alto riesgo, accidentes bajo efecto de alcohol o drogas, ambulancia aérea, homeopatía, quiropráctica, rehabilitación fuera del hospital y gastos personales durante la hospitalización.'
  },
  {
    t: 'Quejas y aclaraciones',
    d: 'Unidad Especializada de MetLife: 55 5328 9002 o 800 907 1111. CONDUSEF: 55 5340 0999 o 800 999 8080. El plazo para reclamar es de 2 años.'
  }
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
  const heroSubtitle = customization?.heroSubtitle || 'Atiéndete en hospitales privados de la red Mutuus sin pagar deducible ni coaseguro, con una suma asegurada de $1 o $2 millones de pesos por persona que se renueva cada año, y usa telemedicina, ambulancia, checkup y limpieza dental desde el primer día.';
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
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": allFaqs.map((f) => ({
              "@type": "Question",
              "name": f.q,
              "acceptedAnswer": { "@type": "Answer", "text": f.a }
            }))
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
            <nav className="hidden xl:flex items-center gap-6 2xl:gap-8 text-xs xl:text-sm font-bold text-slate-600 whitespace-nowrap">
              <a href="#como-funciona" className="hover:text-[#0047BA] transition-colors">¿Cómo funciona?</a>
              <a href="#planes" className="hover:text-[#0047BA] transition-colors">Planes</a>
              <a href="#red-hospitalaria" className="hover:text-[#0047BA] transition-colors">Hospitales</a>
              <a href="#coberturas" className="hover:text-[#0047BA] transition-colors">Coberturas</a>
              <a href="#condiciones" className="hover:text-[#0047BA] transition-colors">Condiciones</a>
              <a href="#faq" className="hover:text-[#0047BA] transition-colors">Preguntas</a>
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
                className="xl:hidden p-2 rounded-xl text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Abrir Menú"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>

          </div>

          {/* Menú Móvil Desplegable */}
          {mobileMenuOpen && (
            <div className="xl:hidden border-t border-slate-100 bg-white px-4 pt-4 pb-6 space-y-4 shadow-xl animate-in slide-in-from-top-2">
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
                  href="#condiciones" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2.5 rounded-xl hover:bg-slate-50 transition"
                >
                  Condiciones Generales
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
                      Aplica solo para eventos reportados antes por la app o al {MUTUUS_TELEFONO}, y sujeto a dictamen médico. No incluye gastos personales ni insumos no relacionados con el diagnóstico autorizado.
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
                      <p className="text-[11px] text-slate-500">Antes de usar tu cobertura: desde la app de Mutuus o al {MUTUUS_TELEFONO} ({MUTUUS_TELEFONO_CG}, opción 0).</p>
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
                      <p className="text-[11px] text-slate-500">Mutuus notifica tu ingreso y autoriza eliminar el deducible y el coaseguro; en los hospitales con pago directo, llegas, te atiendes y te vas.</p>
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
                      <p className="text-2xl sm:text-3xl font-black">+500</p>
                      <p className="text-[11px] text-white/70">hospitales en la red</p>
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

            <div className="mt-12 p-6 sm:p-8 rounded-3xl bg-white border-2 border-slate-200/80 shadow-xl">
              <h3 className="text-xl sm:text-2xl font-black text-slate-900">
                Mutuus frente a un seguro tradicional, con un padecimiento del corazón
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 mt-2">
                De acuerdo con Profeco (2021), tratar una enfermedad cardiaca cuesta alrededor de $347,000 al año. Así cambia lo que sale de tu bolsillo:
              </p>
              <div className="mt-5 text-xs sm:text-sm">
                <div className="grid grid-cols-4 font-bold text-slate-500 pb-2 border-b border-slate-100">
                  <span>Escenario</span>
                  <span className="text-right">Deducible</span>
                  <span className="text-right">Coaseguro</span>
                  <span className="text-right">Tu pago</span>
                </div>
                {[
                  ['Mutuus, en la red', '$0', '$0', '$0', 'text-emerald-600'],
                  ['Seguro tradicional', '$25,000', '$32,200', '$57,200', 'text-rose-600'],
                  ['Sin cobertura', '—', '—', '$347,000', 'text-rose-700']
                ].map(([esc, ded, coa, total, color]) => (
                  <div key={esc} className="grid grid-cols-4 py-2.5 border-b border-slate-50">
                    <span className="font-semibold text-slate-800">{esc}</span>
                    <span className="text-right">{ded}</span>
                    <span className="text-right">{coa}</span>
                    <span className={`text-right font-black ${color}`}>{total}</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-slate-500 mt-4">
                Ejemplo ilustrativo con un deducible de $25,000 y un coaseguro del 10% sobre el resto de la cuenta; en los seguros tradicionales el coaseguro suele ir del 5% al 20% según la CONDUSEF. El $0 de Mutuus requiere reportar el evento antes y atenderte en la red coordinada.
              </p>
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
              * Precios en pesos mexicanos para titulares mayores de 18 años, vigentes a partir del 1 de julio de 2026. Las coberturas para menores deben estar ligadas a un titular mayor de edad; con pago anual de contado se incluye un hijo menor sin costo. Aceptamos Visa, MasterCard y American Express.
            </p>

          </div>
        </section>

        {/* ─── 6. RED HOSPITALARIA ────────────────────────────────────────── */}
        <section id="red-hospitalaria" className="py-20 bg-[#F4F9FF]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">

            <div className="text-center max-w-3xl mx-auto space-y-3 mb-10">
              <span className="px-3 py-1 rounded-full bg-white border border-[#CBD5E1] text-xs font-bold uppercase tracking-wider" style={{ color: primaryColor }}>
                Red hospitalaria Mutuus
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900">
                Más de 500 hospitales en todo México
              </h2>
              <p className="text-slate-600 text-sm sm:text-base">
                Una red nacional de hospitales privados, coordinada por el equipo médico de Mutuus, con presencia en los 32 estados.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {[
                { t: '+110 con pago directo', d: 'Llegas, te atiendes y te vas: Mutuus liquida la cuenta directamente con el hospital, sin trámites de reembolso.' },
                { t: 'Atención coordinada', d: 'Un médico urgenciólogo te orienta y te indica el hospital de la red más adecuado para tu caso y tu ubicación.' },
                { t: 'Especialistas preferentes', d: 'Una red de médicos especialistas con consulta a precio preferencial, desde $650, mostrando tu credencial digital.' }
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
                Antes de acudir a un hospital, avisa desde la app o al <strong>{MUTUUS_TELEFONO}</strong>. Algunos hospitales de alto nivel operan solo por reembolso y con el deducible y el coaseguro de la póliza; el equipo médico te dice cuál te conviene.
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
                Protección en el hospital y cuidado para todos los días
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
                    { t: 'Desde el primer día', items: ['Telemedicina 24/7 con urgenciólogo y médico general', 'Nutriólogo y psicólogo sin límite de consultas en la app', 'Checkup básico anual', 'Limpieza dental anual', 'Ambulancia terrestre para urgencias', 'Descuentos en medicamentos y laboratorio'] },
                    { t: 'En el hospital', items: ['Hospitalización y cirugía por accidente o enfermedad', 'Cuarto privado estándar, quirófano y terapia intensiva', 'Honorarios médicos según tabulador', 'Medicamentos, estudios e insumos durante la estancia', 'Prótesis derivadas de un padecimiento cubierto'] },
                    { t: 'Coberturas adicionales', items: ['Maternidad y complicaciones del embarazo', 'Recién nacido sano y padecimientos congénitos de hijos nacidos en la vigencia', 'Tratamientos de alto costo fuera del hospital', 'Emergencias en el extranjero (DOS y Plus)', 'Muerte accidental y gastos funerarios'] }
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
                  <h3 className="font-black text-slate-900 text-lg mb-4">Maternidad</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                      { t: 'Parto natural', d: 'Hasta 20 UMAM' },
                      { t: 'Cesárea', d: 'Hasta 25 UMAM' },
                      { t: 'Complicaciones del embarazo', d: 'Hasta $1,000,000' }
                    ].map((m) => (
                      <div key={m.t} className="p-5 rounded-2xl border border-slate-200 text-center">
                        <p className="font-bold text-slate-900 text-sm">{m.t}</p>
                        <p className="text-xs text-slate-600 mt-1">{m.d}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-3">Aplica para la asegurada titular cuando el embarazo inicia después del primer mes de vigencia continua.</p>
                </div>

                <div>
                  <h3 className="font-black text-slate-900 text-lg mb-4">Más beneficios de la membresía</h3>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {MAS_BENEFICIOS.map((b) => (
                      <li key={b} className="flex items-start gap-2 text-xs sm:text-sm text-slate-700">
                        <Check className="w-4 h-4 text-[#22C55E] stroke-[3] flex-shrink-0 mt-0.5" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { t: 'Preexistencias', d: 'Nunca se cubren: todo padecimiento con diagnóstico, síntomas o tratamiento anterior a la contratación queda fuera, se haya declarado o no.' },
                  { t: 'Primeros 30 días', d: 'No se cubren enfermedades que inicien durante el primer mes de vigencia. Los accidentes sí se cubren desde el inicio.' },
                  { t: 'Maternidad: 1 mes', d: 'El embarazo debe iniciar después de 30 días de vigencia continua.' },
                  { t: 'Dos años', d: 'Amígdalas y adenoides, padecimientos anorrectales, circuncisión, cálculos del aparato genitourinario, hernias, columna vertebral, piso perineal y genitales, próstata, vesícula y vías biliares, tumores mamarios, insuficiencia venosa, padecimientos cardiovasculares y ortopédicos, juanetes, enfermedad ácido-péptica (incluido el reflujo) y cáncer. Si alguno llega como emergencia, se cubre la emergencia.' },
                  { t: 'Cinco años', d: 'VIH/SIDA y cualquier enfermedad de transmisión sexual, incluso en recién nacidos dentro de la colectividad.' },
                  { t: 'Indemnizaciones del Plan Plus', d: 'Renta diaria: 12 horas de hospitalización por accidente y 24 horas por enfermedad. Diagnóstico de cáncer: 90 días de carencia.' },
                  { t: 'Nariz y senos paranasales', d: 'Solo por accidente, con el deducible de la póliza y 20% de coaseguro aunque se reporte el evento. Por enfermedad no se cubren.' },
                  { t: 'Exclusiones principales', d: 'Estética, infertilidad, salud mental y adicciones, tratamientos experimentales, deportes profesionales o de alto riesgo, accidentes bajo efecto de alcohol o drogas, ambulancia aérea, homeopatía, quiropráctica, rehabilitación fuera del hospital y gastos personales.' }
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

        {/* ─── 7b. CONDICIONES GENERALES EN LENGUAJE CLARO ────────────────── */}
        <section id="condiciones" className="py-20 bg-[#F4F9FF]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto space-y-3 mb-12">
              <span className="px-3 py-1 rounded-full bg-white border border-[#CBD5E1] text-xs font-bold uppercase tracking-wider" style={{ color: primaryColor }}>
                Condiciones Generales
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900">
                Las reglas de tu cobertura, explicadas sin letras chiquitas
              </h2>
              <p className="text-slate-600 text-sm sm:text-base">
                Un resumen de las Condiciones Generales de la póliza colectiva y de las Condiciones de la Membresía (versión junio 2026). Al contratar recibes los documentos completos, que son los que rigen tu cobertura.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {CONDICIONES_GENERALES.map((c) => (
                <div key={c.t} className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
                  <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
                    <FileText className="w-4 h-4 flex-shrink-0" style={{ color: primaryColor }} />
                    {c.t}
                  </h3>
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed">{c.d}</p>
                </div>
              ))}
            </div>
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
                  <p className="text-[11px] text-slate-500 mt-0.5">Pago anual, Flex o 12 meses con tarjeta.</p>
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
                  <li><a href="#condiciones" className="hover:text-white transition-colors">Condiciones Generales</a></li>
                  <li><a href="#faq" className="hover:text-white transition-colors">Preguntas Frecuentes</a></li>
                </ul>
              </div>

              {/* Documentos y legal (sin enlaces al sitio de Mutuus) */}
              <div className="space-y-2">
                <p className="font-bold text-white text-sm">Documentos y Legal</p>
                <ul className="space-y-1.5 text-white/70">
                  <li>
                    <a href="#condiciones" className="hover:text-white transition-colors flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5 text-[#8DC63F]" /> Condiciones Generales (resumen)
                    </a>
                  </li>
                  <li>
                    <a href="#coberturas" className="hover:text-white transition-colors flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5 text-[#8DC63F]" /> Periodos de espera y exclusiones
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
                * Mutuus es una marca registrada. Comercialización y distribución autorizada a través de JIRO Agente de Seguros y Fianzas S.A. de C.V. (Clave Promotoría A-3522). El beneficio de 0 deducible y 0 coaseguro aplica solo para eventos reportados antes a Mutuus por la app o por teléfono, atendidos en la red coordinada y autorizados tras dictamen médico, en padecimientos cubiertos conforme a las Condiciones Generales de la póliza colectiva de MetLife México y a las Condiciones de la Membresía. No se cubren preexistencias. Aplican periodos de espera y exclusiones. Mutuus no acepta pagos en efectivo. Precios vigentes a partir del 1 de julio de 2026.
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
