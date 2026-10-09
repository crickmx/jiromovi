import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { 
  ShieldCheck, 
  Check, 
  X, 
  Phone, 
  MessageSquare, 
  Sparkles, 
  Clock, 
  Hospital, 
  Stethoscope, 
  ArrowRight, 
  Building2, 
  FileText, 
  Send, 
  Loader2, 
  CheckCircle2,
  Tag,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  LogIn,
  Zap,
  Lock
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

export const MUTUUS_PORTAL_URL = 'https://selfservice.psmutuus.com/agente/A-3522/promo/A-3522';

export interface LandingCustomization {
  heroTitle?: string;
  heroSubtitle?: string;
  badgeText?: string;
  primaryColor?: string;
  accentColor?: string;
  ctaText?: string;
  whatsappNumber?: string;
  promoBanner?: string;
  discountAnnual?: number;
  featuredPlan?: 'uno' | 'dos' | 'plus';
  plansData?: typeof PLANES_DATA;
  customFaqs?: Array<{ q: string; a: string }>;
}

// ─── FAQ Data with Rich SEO Content ──────────────────────────────────────────
const DEFAULT_FAQS = [
  {
    q: '¿Dónde y cómo realizo el registro o emisión de mi membresía Mutuus?',
    a: 'Puedes realizar tu cotización, registro y emisión inmediata 100% digital a través de nuestro portal oficial de autoservicio de Mutuus (código de promotor A-3522). Solo necesitas tus datos básicos y el pago en línea para recibir tu credencial y póliza de inmediato.'
  },
  {
    q: '¿Qué es exactamente Mutuus y cómo funciona la membresía de salud?',
    a: 'Mutuus es un esquema integral de salud privada que combina una membresía médica digital (telemedicina 24/7 ilimitada, consultas de especialidad a precio preferencial y red de asistencias) con el respaldo de una póliza de seguro de Gastos Médicos Mayores con $0 deducible y $0 coaseguro en su red hospitalaria autorizada.'
  },
  {
    q: '¿Realmente no pago deducible ni coaseguro al atenderme en un hospital?',
    a: 'Es correcto. Siempre que reportes el evento médico oportunamente antes de tu ingreso y acudas a los hospitales y médicos de la red de pago directo de Mutuus, el deducible y coaseguro quedan condonados al 100%, pagando $0 de tu bolsillo por los gastos cubiertos.'
  },
  {
    q: '¿Qué hospitales de México forman parte de la red de pago directo?',
    a: 'La red incluye más de 115 hospitales de pago directo y más de 548 convenios en todo el país, incluyendo cadenas líderes como Grupo Hospitales Ángeles, Médica Sur, Star Médica, Hospitales San Javier, Christus Muguerza y Hospitales MAC, entre otros.'
  },
  {
    q: '¿Cubre maternidad, parto o cesárea?',
    a: 'Sí, la cobertura de maternidad incluye ayuda económica y atención hospitalaria conforme a las condiciones de cada plan (sujeto al periodo de espera de 10 meses continuos y topes establecidos en Unidades de Medida y Actualización - UMA).'
  },
  {
    q: '¿Cómo solicito una consulta médica o videollamada 24/7?',
    a: 'Desde la aplicación móvil de Mutuus puedes iniciar una videollamada o chat médico con médicos generales, pediatras y psicólogos certificados en cualquier momento del día o la noche, sin costo adicional ni límite de consultas.'
  },
  {
    q: '¿Qué sucede en caso de una urgencia médica?',
    a: 'En situaciones de emergencia, puedes comunicarte a la línea directa de asistencia médica 24/7 marcando el botón de urgencias en la app o llamando al teléfono exclusivo. Se te coordinará ambulancia terrestre o pase de ingreso inmediato al hospital de la red más cercano.'
  },
  {
    q: '¿Cuáles son los periodos de espera para enfermedades preexistentes?',
    a: 'Como en cualquier seguro de gastos médicos, existen periodos de espera específicos (por ejemplo: 12 meses para ciertas cirugías programadas, 24 meses para padecimientos específicos y 10 meses para maternidad). Te entregamos el detalle completo antes de tu contratación.'
  },
  {
    q: '¿Cómo es el proceso de contratación y activación?',
    a: 'El trámite es 100% digital en nuestro portal de autoservicio. Completas tu solicitud, realizas el pago en línea y recibes tu credencial digital y póliza en tu correo y en tu app en menos de 24 horas hábiles.'
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
      badge: 'Más Popular ★',
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
        'Ayuda de maternidad (parto/cesárea) tras 10 meses',
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
        'Acceso prioritario a hospitales del Grupo Ángeles y Médica Sur',
        'Telemedicina 24/7 sin límite de especialidades',
        'Ambulancia aérea y terrestre en urgencias',
        'Mayor tope de cobertura en maternidad',
        'Check-up integral anual incluido',
        'Orientación jurídica y psicológica telefónica 24/7'
      ]
    }
  ],
  anual: [
    {
      id: 'uno',
      nombre: 'Plan UNO',
      badge: 'Ahorro Anual',
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
      badge: 'Más Elegido · Mejor Valor',
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
        'Ayuda de maternidad (parto/cesárea) tras 10 meses',
        'Check-up preventivo anual básico',
        'Médico a domicilio con copago preferencial'
      ]
    },
    {
      id: 'plus',
      nombre: 'Plan PLUS',
      badge: 'Protección Total',
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
        'Acceso prioritario a hospitales del Grupo Ángeles y Médica Sur',
        'Telemedicina 24/7 sin límite de especialidades',
        'Ambulancia aérea y terrestre en urgencias',
        'Mayor tope de cobertura en maternidad',
        'Check-up integral anual incluido',
        'Orientación jurídica y psicológica telefónica 24/7'
      ]
    }
  ]
};

// ─── Red Hospitalaria Logos ──────────────────────────────────────────────────
const HOSPITALES = [
  { nombre: 'Hospitales Ángeles', tipo: 'Red Directa Nacional', ciudad: 'CDMX, GDL, MTY, Puebla' },
  { nombre: 'Médica Sur', tipo: 'Alta Especialidad', ciudad: 'CDMX' },
  { nombre: 'Star Médica', tipo: 'Red Directa Nacional', ciudad: 'Nacional (15 sedes)' },
  { nombre: 'Christus Muguerza', tipo: 'Red Hospitalaria Norte', ciudad: 'Monterrey, Saltillo, Chihuahua' },
  { nombre: 'Hospitales MAC', tipo: 'Red de Excelencia', ciudad: 'Bajío, Centro y Norte' },
  { nombre: 'Hospital San Javier', tipo: 'Alta Especialidad', ciudad: 'Guadalajara y Vallarta' }
];

export default function MutuusLanding({ customization }: { customization?: LandingCustomization }) {
  const [periodicidad, setPeriodicidad] = useState<'anual' | 'mensual'>('anual');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [tabCobertura, setTabCobertura] = useState<'cubierto' | 'no_cubierto'>('cubierto');
  const [showModalLead, setShowModalLead] = useState(false);
  const [selectedPlanForModal, setSelectedPlanForModal] = useState<string>('Plan DOS');

  // Form State
  const [leadForm, setLeadForm] = useState({
    nombre: '',
    edad: '',
    telefono: '',
    email: '',
    ciudad: '',
    plan: 'Plan DOS'
  });
  const [submittingLead, setSubmittingLead] = useState(false);
  const [leadSuccess, setLeadSuccess] = useState(false);

  // Dynamic overrides
  const heroTitle = customization?.heroTitle || 'Membresía de salud y gastos médicos con cero deducible';
  const heroSubtitle = customization?.heroSubtitle || 'Accede a la mejor atención médica privada, telemedicina 24/7 ilimitada y respaldo hospitalario nacional sin pagar deducibles sorpresa al momento de una emergencia.';
  const badgeText = customization?.badgeText || 'Cero Deducible · Cero Coaseguro en Red';
  const primaryColor = customization?.primaryColor || '#003896';
  const accentColor = customization?.accentColor || '#9CD41C';
  const ctaText = customization?.ctaText || 'Contratar en Línea (Portal Autoservicio)';
  const whatsappNumber = customization?.whatsappNumber || '525540001234';
  const promoBanner = customization?.promoBanner;
  
  const allFaqs = customization?.customFaqs && customization.customFaqs.length > 0 
    ? [...customization.customFaqs, ...DEFAULT_FAQS] 
    : DEFAULT_FAQS;

  const rawPlans = customization?.plansData || PLANES_DATA;
  const plans = rawPlans[periodicidad];

  const handleOpenLeadModal = (planNombre: string) => {
    setSelectedPlanForModal(planNombre);
    setLeadForm(prev => ({ ...prev, plan: planNombre }));
    setShowModalLead(true);
  };

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadForm.nombre || !leadForm.telefono) return;

    setSubmittingLead(true);
    try {
      await supabase.from('leads').insert([
        {
          full_name: leadForm.nombre,
          email: leadForm.email || 'sin-correo@mutuus.landing',
          company: `Edad: ${leadForm.edad} | Ciudad: ${leadForm.ciudad} | Plan: ${leadForm.plan}`,
          message: `Solicitud de cotización de membresía Mutuus (${leadForm.plan}) enviada desde landings.movi.digital/mutuus. Tel: ${leadForm.telefono}`,
          created_at: new Date().toISOString()
        }
      ]);
      setLeadSuccess(true);

      const msg = encodeURIComponent(
        `Hola, me interesa información y cotizar el ${leadForm.plan} de Mutuus. Mi nombre es ${leadForm.nombre}, tengo ${leadForm.edad} años y vivo en ${leadForm.ciudad || 'México'}.`
      );
      setTimeout(() => {
        window.open(`https://wa.me/${whatsappNumber}?text=${msg}`, '_blank');
      }, 1200);
    } catch (err) {
      console.error('Error enviando lead:', err);
    } finally {
      setSubmittingLead(false);
    }
  };

  return (
    <>
      <Helmet>
        <html lang="es-MX" />
        <title>{heroTitle.length > 60 ? heroTitle.slice(0, 57) + '...' : heroTitle} | Mutuus</title>
        <meta 
          name="description" 
          content={heroSubtitle} 
        />
        <meta 
          name="keywords" 
          content="Mutuus seguro gastos medicos, seguro sin deducible, seguro medico sin coaseguro, telemedicina 24/7 mexico, seguros metlife mutuus, promotor autorizado mutuus, hospital pago directo, contratacion mutuus selfservice" 
        />
        <link rel="canonical" href="https://landings.movi.digital/mutuus" />
        <meta name="geo.region" content="MX" />
        <meta name="geo.placename" content="México" />
        <meta name="geo.position" content="19.432608;-99.133208" />
        <meta name="ICBM" content="19.432608, -99.133208" />
        <meta property="og:type" content="website" />
        <meta property="og:locale" content="es_MX" />
        <meta property="og:site_name" content="Movi Digital · Promotor Autorizado Mutuus" />
        <meta property="og:title" content={heroTitle} />
        <meta property="og:description" content={heroSubtitle} />
        <meta property="og:url" content="https://landings.movi.digital/mutuus" />
      </Helmet>

      {/* ─── CONTENEDOR PRINCIPAL ────────────────────────────────────────── */}
      <div 
        className="min-h-screen bg-white text-[#2B2A2A] font-sans antialiased selection:text-white"
        style={{ 
          fontFamily: 'Montserrat, system-ui, -apple-system, sans-serif',
          '--primary-brand': primaryColor,
          '--accent-brand': accentColor
        } as React.CSSProperties}
      >

        {/* ─── PROMO BANNER DINÁMICO ────────────────────────────────────── */}
        {promoBanner ? (
          <div 
            className="text-white py-2 px-4 text-center text-xs font-bold flex items-center justify-center gap-2 shadow-inner"
            style={{ backgroundColor: primaryColor }}
          >
            <Tag className="w-3.5 h-3.5" style={{ color: accentColor }} />
            <span>{promoBanner}</span>
          </div>
        ) : (
          <div 
            className="text-white py-1.5 px-4 text-center text-xs font-semibold flex items-center justify-center gap-2 border-b border-white/10"
            style={{ backgroundColor: '#002666' }}
          >
            <Zap className="w-3.5 h-3.5 text-amber-300" />
            <span>Portal de Registro y Emisión Inmediata 100% Digital · Promotor <strong>A-3522</strong></span>
            <a 
              href={MUTUUS_PORTAL_URL} 
              target="_blank" 
              rel="noopener noreferrer"
              className="ml-2 font-bold underline hover:text-white/80 inline-flex items-center gap-1"
            >
              <span>Acceder al Portal</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}

        {/* ─── 1. HEADER STICKY (PROMOTOR AUTORIZADO) ────────────────────── */}
        <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
            {/* Logos & Leyenda Promotor */}
            <div className="flex items-center gap-3 sm:gap-4">
              <a href="#inicio" className="flex items-center gap-2 group">
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-xl tracking-tighter shadow-md"
                  style={{ backgroundColor: primaryColor }}
                >
                  M
                </div>
                <div>
                  <span 
                    className="font-extrabold text-xl tracking-tight block leading-none"
                    style={{ color: primaryColor }}
                  >
                    mutuus
                  </span>
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mt-0.5">
                    Salud Inteligente
                  </span>
                </div>
              </a>

              <div className="h-7 w-[1px] bg-slate-200 hidden sm:block" />

              <div 
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border"
                style={{ backgroundColor: '#EFF6FF', borderColor: '#CBD5E1', color: primaryColor }}
              >
                <ShieldCheck className="w-3.5 h-3.5" style={{ color: primaryColor }} />
                <span>Promotor Autorizado A-3522</span>
              </div>
            </div>

            {/* Menú de Navegación Desktop */}
            <nav className="hidden lg:flex items-center gap-6 text-sm font-semibold text-slate-700">
              <a href="#porque-mutuus" className="hover:opacity-80 transition-opacity">¿Por qué Mutuus?</a>
              <a href="#planes" className="hover:opacity-80 transition-opacity">Planes y Precios</a>
              <a href="#red-hospitalaria" className="hover:opacity-80 transition-opacity">Red de Hospitales</a>
              <a href="#coberturas" className="hover:opacity-80 transition-opacity">Coberturas</a>
              <a href="#faq" className="hover:opacity-80 transition-opacity">Preguntas Frecuentes</a>
            </nav>

            {/* Acciones */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Botón Ingresar / Portal */}
              <a
                href={MUTUUS_PORTAL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold border border-slate-300 text-slate-700 hover:bg-slate-50 transition-all cursor-pointer active:scale-95"
                title="Acceso al portal de clientes y registro"
              >
                <LogIn className="w-3.5 h-3.5 text-blue-600" />
                <span>Ingresar / Portal</span>
              </a>

              {/* Botón Contratar / Emitir Directo */}
              <a
                href={MUTUUS_PORTAL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold text-white transition-all shadow-md active:scale-95 cursor-pointer"
                style={{ backgroundColor: primaryColor }}
              >
                <span>Emitir en Línea</span>
                <ArrowRight className="w-4 h-4" />
              </a>

              <a
                href={`https://wa.me/${whatsappNumber}?text=Hola,%20deseo%20asesoria%20sobre%20los%20planes%20Mutuus.`}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden md:inline-flex items-center gap-2 px-3.5 py-2.5 rounded-full text-xs font-bold text-slate-900 bg-[#25D366] hover:bg-[#20ba5a] transition-all shadow-sm active:scale-95"
                title="Atención por WhatsApp"
              >
                <MessageSquare className="w-4 h-4 fill-slate-900 text-slate-900" />
                <span>WhatsApp</span>
              </a>
            </div>
          </div>
        </header>

        {/* ─── 2. HERO SECTION CON OVERLAY Y FOTO ─────────────────────────── */}
        <section id="inicio" className="relative pt-12 pb-20 md:pt-20 md:pb-28 overflow-hidden bg-gradient-to-b from-[#F4F9FF] via-white to-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              
              {/* Contenido Izquierdo */}
              <div className="lg:col-span-7 space-y-6">
                
                {/* Badge de Seguridad */}
                <div 
                  className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold border"
                  style={{ backgroundColor: '#EFF6FF', borderColor: '#CBD5E1', color: primaryColor }}
                >
                  <Sparkles className="w-4 h-4" style={{ color: primaryColor }} />
                  <span>{badgeText}</span>
                </div>

                {/* H1 Principal con SEO Keyword */}
                <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-[#2B2A2A] tracking-tight leading-[1.15]">
                  {heroTitle.includes('cero deducible') ? (
                    <>
                      {heroTitle.split('cero deducible')[0]}
                      <span style={{ color: primaryColor }}>cero deducible</span>
                      {heroTitle.split('cero deducible')[1]}
                    </>
                  ) : (
                    heroTitle
                  )}
                </h1>

                {/* Subtítulo Descriptivo */}
                <p className="text-base sm:text-lg text-slate-600 leading-relaxed font-normal max-w-2xl">
                  {heroSubtitle}
                </p>

                {/* Nota Legal y Promotor visible */}
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1 font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md">
                    <Lock className="w-3 h-3 text-emerald-600" />
                    Portal Oficial de Emisión · Código A-3522
                  </span>
                  <span className="italic">* Aplican términos y condiciones estipulados en la póliza.</span>
                </div>

                {/* Botones de Acción (CTA) */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-2">
                  <a
                    href={MUTUUS_PORTAL_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-full text-base font-bold text-white transition-all shadow-xl hover:opacity-95 active:scale-98 text-center cursor-pointer"
                    style={{ backgroundColor: primaryColor }}
                  >
                    <span>Contratar y Emitir en Línea</span>
                    <ArrowRight className="w-5 h-5" />
                  </a>

                  <a
                    href="#planes"
                    className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-full text-base font-bold bg-white border-2 hover:bg-[#EFF6FF] transition-all text-center cursor-pointer"
                    style={{ borderColor: primaryColor, color: primaryColor }}
                  >
                    <span>Ver Planes y Precios</span>
                  </a>

                  <button
                    onClick={() => handleOpenLeadModal('Plan DOS')}
                    className="inline-flex items-center justify-center gap-2 px-5 py-4 rounded-full text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all text-center cursor-pointer"
                  >
                    <Phone className="w-4 h-4 text-slate-500" />
                    <span>Hablar con Asesor</span>
                  </button>
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
                    <span>Emisión 100% digital</span>
                  </div>
                </div>

              </div>

              {/* Tarjeta Visual Hero Derecha */}
              <div className="lg:col-span-5 relative">
                <div 
                  className="relative rounded-3xl p-6 sm:p-8 text-white shadow-2xl border border-white/20 overflow-hidden"
                  style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, #001a4a 100%)` }}
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
                      <span className="text-[11px] font-bold text-white/80 bg-white/10 px-2.5 py-0.5 rounded-full">
                        Promo A-3522
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
                        <span className="text-rose-300 font-extrabold text-sm">$60,000+ MXN</span>
                      </div>

                      <div 
                        className="p-4 rounded-2xl text-slate-900 border flex items-center justify-between shadow-lg"
                        style={{ backgroundColor: accentColor, borderColor: accentColor }}
                      >
                        <div>
                          <p className="text-xs font-bold text-slate-800">Con Membresía Mutuus</p>
                          <p className="text-base font-black text-slate-900">Pago en Red de Convenio</p>
                        </div>
                        <span className="text-2xl font-black text-slate-900">$0 MXN</span>
                      </div>
                    </div>

                    <p className="text-xs text-white/75 leading-relaxed">
                      Sin trámites engorrosos de reembolso ni desembolsos iniciales que desestabilicen tu patrimonio familiar.
                    </p>

                    <a
                      href={MUTUUS_PORTAL_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-4 px-6 rounded-full font-extrabold text-sm text-slate-900 transition-all shadow-md active:scale-95 cursor-pointer text-center flex items-center justify-center gap-2"
                      style={{ backgroundColor: accentColor }}
                    >
                      <span>Contratar y Emitir en Línea</span>
                      <ExternalLink className="w-4 h-4 text-slate-900" />
                    </a>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ─── 3. CAJA DE DEFINICIÓN (QUÉ ES MUTUUS) ──────────────────────── */}
        <section className="py-12 bg-white">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="p-6 sm:p-8 rounded-3xl bg-[#EFF6FF] border border-[#CBD5E1] flex flex-col md:flex-row items-center gap-6 shadow-xs">
              <div 
                className="w-16 h-16 rounded-2xl text-white flex items-center justify-center flex-shrink-0 shadow-md"
                style={{ backgroundColor: primaryColor }}
              >
                <ShieldCheck className="w-9 h-9" style={{ color: accentColor }} />
              </div>
              <div className="space-y-2 text-center md:text-left flex-1">
                <h2 className="text-xl sm:text-2xl font-extrabold" style={{ color: primaryColor }}>
                  ¿Qué es Mutuus?
                </h2>
                <p className="text-sm sm:text-base text-slate-700 leading-relaxed font-normal">
                  Mutuus es el ecosistema de salud privada que elimina las barreras económicas tradicionales: combina consultas médicas ilimitadas por videollamada 24/7 y una póliza hospitalaria que te garantiza <strong className="font-bold" style={{ color: primaryColor }}>cero deducible y cero coaseguro</strong> al atenderte en su red nacional de hospitales certificados.
                </p>
              </div>
              <div className="flex-shrink-0">
                <a
                  href={MUTUUS_PORTAL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-3 rounded-full text-xs font-bold text-white transition-all shadow-sm active:scale-95 inline-flex items-center gap-1.5"
                  style={{ backgroundColor: primaryColor }}
                >
                  <span>Ir al Registro</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ─── 4. POR QUÉ MUTUUS ──────────────────────────────────────────── */}
        <section id="porque-mutuus" className="py-20 bg-[#F4F9FF]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            
            <div className="text-center max-w-3xl mx-auto space-y-3 mb-14">
              <span className="px-3 py-1 rounded-full bg-white border border-[#CBD5E1] text-xs font-bold uppercase tracking-wider" style={{ color: primaryColor }}>
                Comparativa de Impacto Financiero
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold" style={{ color: primaryColor }}>
                ¿Por qué elegir Mutuus frente a un seguro tradicional?
              </h2>
              <p className="text-slate-600 text-sm sm:text-base">
                Ejemplo real de una cuenta hospitalaria de <strong className="text-slate-900 font-bold">$705,500 MXN</strong> por atención de urgencia médica:
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch">
              
              {/* Columna 1: Mutuus */}
              <div 
                className="rounded-3xl p-6 sm:p-8 bg-white border-2 shadow-xl relative flex flex-col justify-between order-1 ring-4"
                style={{ borderColor: primaryColor, ringColor: `${primaryColor}20` }}
              >
                <div 
                  className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-white text-xs font-extrabold uppercase tracking-wide"
                  style={{ backgroundColor: primaryColor }}
                >
                  Opción Mutuus
                </div>

                <div className="space-y-6 pt-2">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">🛡️</span>
                    <div>
                      <h3 className="text-xl font-black" style={{ color: primaryColor }}>Con Mutuus</h3>
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
                  <p className="text-xs font-bold uppercase" style={{ color: primaryColor }}>Pago Final de tu Bolsillo:</p>
                  <p className="text-3xl font-black mt-1" style={{ color: primaryColor }}>$0 MXN</p>
                  <p className="text-[11px] text-slate-500 mt-1 mb-4">Condonación total cumpliendo protocolo en red.</p>
                  
                  <a
                    href={MUTUUS_PORTAL_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 px-4 rounded-xl font-bold text-xs text-white text-center flex items-center justify-center gap-1.5 shadow-sm"
                    style={{ backgroundColor: primaryColor }}
                  >
                    <span>Emitir con $0 Deducible</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              {/* Columna 2: Seguro Tradicional */}
              <div className="rounded-3xl p-6 sm:p-8 bg-white border border-slate-200 shadow-sm flex flex-col justify-between order-2">
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">📄</span>
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
                    <span className="text-3xl">⚠️</span>
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
                  <p className="text-[11px] text-rose-600 mt-1">Riesgo patrimonial severo o endeudamiento.</p>
                </div>
              </div>

            </div>

          </div>
        </section>

        {/* ─── 5. APP Y TELEMEDICINA 24/7 ─────────────────────────────────── */}
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              
              <div className="lg:col-span-5 order-2 lg:order-1 flex justify-center">
                <div 
                  className="relative w-full max-w-sm p-6 rounded-3xl text-white shadow-2xl"
                  style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, #001a4a 100%)` }}
                >
                  <div className="flex items-center justify-between pb-4 border-b border-white/10">
                    <span className="text-xs font-bold" style={{ color: accentColor }}>App Oficial Mutuus</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">En línea 24/7</span>
                  </div>

                  <div className="py-6 space-y-4">
                    <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 flex items-center gap-3">
                      <Stethoscope className="w-8 h-8" style={{ color: accentColor }} />
                      <div>
                        <p className="text-xs text-white/70">Consulta en Vivo</p>
                        <p className="text-sm font-bold">Médico General y Pediatría</p>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 flex items-center gap-3">
                      <Hospital className="w-8 h-8 text-blue-300" />
                      <div>
                        <p className="text-xs text-white/70">Geolocalizador</p>
                        <p className="text-sm font-bold">115+ Hospitales Cercanos</p>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 flex items-center gap-3">
                      <ShieldCheck className="w-8 h-8" style={{ color: accentColor }} />
                      <div>
                        <p className="text-xs text-white/70">Credencial Digital</p>
                        <p className="text-sm font-bold">Acceso inmediato en admisión</p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-white/10 flex items-center justify-around text-xs text-center text-white/75">
                    <div>
                      <p className="font-bold text-white">App Store</p>
                      <p className="text-[10px]">iOS 14.0+</p>
                    </div>
                    <div className="h-6 w-[1px] bg-white/20" />
                    <div>
                      <p className="font-bold text-white">Google Play</p>
                      <p className="text-[10px]">Android 8.0+</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-7 order-1 lg:order-2 space-y-6">
                <span className="px-3 py-1 rounded-full bg-[#EFF6FF] border border-[#CBD5E1] text-xs font-bold uppercase tracking-wider" style={{ color: primaryColor }}>
                  Salud Digital en tu Bolsillo
                </span>

                <h2 className="text-3xl sm:text-4xl font-extrabold" style={{ color: primaryColor }}>
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

                <div className="pt-4 flex flex-wrap gap-4">
                  <a
                    href={MUTUUS_PORTAL_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-7 py-3.5 rounded-full text-white font-bold text-xs sm:text-sm hover:opacity-95 transition-all shadow-md cursor-pointer flex items-center gap-2"
                    style={{ backgroundColor: primaryColor }}
                  >
                    <span>Contratar y Activar en Línea</span>
                    <ArrowRight className="w-4 h-4" />
                  </a>

                  <button
                    onClick={() => handleOpenLeadModal('Plan DOS')}
                    className="px-6 py-3.5 rounded-full text-slate-700 bg-slate-100 hover:bg-slate-200 font-semibold text-xs sm:text-sm transition cursor-pointer"
                  >
                    Solicitar Asesoría
                  </button>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ─── 6. PLANES Y PRECIOS TRANSPARENTES ──────────────────────────── */}
        <section id="planes" className="py-20 bg-[#F4F9FF]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            
            <div className="text-center max-w-3xl mx-auto space-y-4 mb-12">
              <span className="px-3 py-1 rounded-full bg-white border border-[#CBD5E1] text-xs font-bold uppercase tracking-wider" style={{ color: primaryColor }}>
                Tarifas y Coberturas
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold" style={{ color: primaryColor }}>
                Elige el plan diseñado para tu estilo de vida
              </h2>
              <p className="text-slate-600 text-sm sm:text-base">
                Precios claros, sin costos ocultos ni letras pequeñas. Emisión digital directa en el portal oficial con código de promotor <strong>A-3522</strong>.
              </p>

              <div className="pt-4 flex items-center justify-center">
                <div className="bg-white p-1 rounded-full border border-slate-200 shadow-xs inline-flex">
                  <button
                    onClick={() => setPeriodicidad('anual')}
                    className={`px-6 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      periodicidad === 'anual'
                        ? 'text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    style={periodicidad === 'anual' ? { backgroundColor: primaryColor } : {}}
                  >
                    Pago Anual (Ahorro 10%)
                  </button>
                  <button
                    onClick={() => setPeriodicidad('mensual')}
                    className={`px-6 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      periodicidad === 'mensual'
                        ? 'text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    style={periodicidad === 'mensual' ? { backgroundColor: primaryColor } : {}}
                  >
                    Pago Mensual Flexible
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
              {plans.map((p) => (
                <div
                  key={p.id}
                  className={`rounded-3xl p-6 sm:p-8 bg-white transition-all duration-300 flex flex-col justify-between relative ${
                    p.popular
                      ? 'border-2 shadow-2xl scale-102 lg:-translate-y-2'
                      : 'border border-slate-200 shadow-md hover:shadow-xl'
                  }`}
                  style={p.popular ? { borderColor: primaryColor } : {}}
                >
                  {p.popular && (
                    <div 
                      className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-white text-xs font-extrabold uppercase tracking-wide"
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

                    <h3 className="text-2xl font-black text-[#2B2A2A] mt-2">{p.nombre}</h3>
                    
                    <div className="mt-4 pb-5 border-b border-slate-100">
                      <p className="text-xs text-slate-500 font-medium">Suma Asegurada por Evento:</p>
                      <p className="text-xl font-extrabold" style={{ color: primaryColor }}>{p.sumaAsegurada}</p>
                      
                      <div className="mt-3 flex items-baseline gap-1">
                        <span className="text-3xl sm:text-4xl font-black text-slate-900">{p.pagoInicial}</span>
                        <span className="text-xs text-slate-500 font-semibold">MXN / {periodicidad === 'anual' ? 'año' : 'mes'}</span>
                      </div>
                      
                      {p.descuento && (
                        <span className="inline-block mt-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[11px] font-bold">
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

                  <div className="mt-8 pt-6 border-t border-slate-100 space-y-3">
                    {/* Botón principal de contratación que lleva directo al portal selfservice */}
                    <a
                      href={MUTUUS_PORTAL_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-3.5 px-6 rounded-full font-bold text-xs sm:text-sm transition-all shadow-md active:scale-95 cursor-pointer text-center flex items-center justify-center gap-2 text-white"
                      style={{ backgroundColor: p.popular ? primaryColor : '#0f172a' }}
                    >
                      <span>Contratar {p.nombre} en Línea</span>
                      <ArrowRight className="w-4 h-4" />
                    </a>
                    
                    <div className="flex gap-2">
                      <a
                        href={`https://wa.me/${whatsappNumber}?text=Hola,%20deseo%20cotizar%20el%20${encodeURIComponent(p.nombre)}%20de%20Mutuus.`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 py-2 px-3 rounded-full font-semibold text-xs text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-all text-center flex items-center justify-center gap-1.5"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-[#25D366]" />
                        <span>WhatsApp</span>
                      </a>

                      <button
                        onClick={() => handleOpenLeadModal(p.nombre)}
                        className="py-2 px-3 rounded-full font-semibold text-xs text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-all text-center cursor-pointer"
                      >
                        Cotizar
                      </button>
                    </div>
                  </div>

                </div>
              ))}
            </div>

            <p className="text-center text-xs text-slate-500 mt-10">
              * Tarifas vigentes al 2026. Precios en Moneda Nacional con IVA incluido. Consulta condicionado general de póliza para sumas aseguradas por parentesco.
            </p>

          </div>
        </section>

        {/* ─── 7. RED HOSPITALARIA DE PAGO DIRECTO ────────────────────────── */}
        <section id="red-hospitalaria" className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            
            <div className="text-center max-w-3xl mx-auto space-y-3 mb-14">
              <span className="px-3 py-1 rounded-full bg-[#EFF6FF] border border-[#CBD5E1] text-xs font-bold uppercase tracking-wider" style={{ color: primaryColor }}>
                Infraestructura Hospitalaria
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold" style={{ color: primaryColor }}>
                Red Médica Nacional de Pago Directo
              </h2>
              <p className="text-slate-600 text-sm sm:text-base">
                Más de <strong>115 hospitales de pago directo</strong> y más de <strong>548 instituciones médicas</strong> en convenio en toda la República Mexicana.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {HOSPITALES.map((h, i) => (
                <div
                  key={i}
                  className="p-6 rounded-2xl bg-[#F4F9FF] border border-slate-200/80 hover:shadow-lg transition-all group"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div 
                      className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center font-bold text-lg group-hover:text-white transition-colors"
                      style={{ color: primaryColor }}
                    >
                      <Hospital className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-base">{h.nombre}</h4>
                      <span className="text-[11px] font-semibold uppercase" style={{ color: primaryColor }}>{h.tipo}</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-2">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>Cobertura: {h.ciudad}</span>
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-10 p-6 rounded-2xl bg-[#EFF6FF] border border-blue-200/60 text-center max-w-2xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-left">
                <p className="text-xs sm:text-sm font-bold text-slate-900">
                  ¿Listo para activar tu protección en red hospitalaria?
                </p>
                <p className="text-xs text-slate-600">
                  Emisión en menos de 5 minutos desde el portal de autoservicio.
                </p>
              </div>
              <a
                href={MUTUUS_PORTAL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2.5 rounded-full text-xs font-bold text-white transition-all shadow-sm active:scale-95 inline-flex items-center gap-1.5 flex-shrink-0"
                style={{ backgroundColor: primaryColor }}
              >
                <span>Emitir en Línea</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

          </div>
        </section>

        {/* ─── 8. LÍNEA DE ATENCIÓN Y URGENCIAS ───────────────────────────── */}
        <section className="py-16 text-white" style={{ backgroundColor: primaryColor }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
              
              <div className="space-y-3 text-center lg:text-left">
                <span 
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-xs font-bold border border-white/10 uppercase tracking-wider"
                  style={{ color: accentColor }}
                >
                  <Clock className="w-3.5 h-3.5" /> Atención Continua 24/7/365
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                  Línea Exclusiva de Soporte y Urgencias Médicas
                </h2>
                <p className="text-white/80 text-sm max-w-xl">
                  Asistencia para reporte previo de eventos, coordinación de ambulancias y asesoría de trámites en tiempo real.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-4">
                <a
                  href={`tel:${whatsappNumber}`}
                  className="px-8 py-4 rounded-full font-extrabold text-sm text-slate-900 transition-all shadow-lg active:scale-95 text-center flex items-center gap-2"
                  style={{ backgroundColor: accentColor }}
                >
                  <Phone className="w-4 h-4 fill-slate-900" />
                  <span>Llamar a Urgencias</span>
                </a>
                
                <a
                  href={`https://wa.me/${whatsappNumber}?text=Hola,%20requiero%20atencion%20sobre%20mi%20membresia%20Mutuus.`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-4 rounded-full font-bold text-sm text-white bg-white/10 hover:bg-white/20 border border-white/20 transition-all text-center flex items-center gap-2"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Chat de Asistencia</span>
                </a>

                <a
                  href={MUTUUS_PORTAL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-4 rounded-full font-bold text-sm text-white bg-white/10 hover:bg-white/20 border border-white/20 transition-all text-center flex items-center gap-2"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Ingresar al Portal</span>
                </a>
              </div>

            </div>
          </div>
        </section>

        {/* ─── 9. COBERTURA: QUÉ ESTÁ CUBIERTO VS QUÉ NO ─────────────────── */}
        <section id="coberturas" className="py-20 bg-[#F4F9FF]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            
            <div className="text-center max-w-2xl mx-auto space-y-3 mb-12">
              <span className="px-3 py-1 rounded-full bg-white border border-[#CBD5E1] text-xs font-bold uppercase tracking-wider" style={{ color: primaryColor }}>
                Transparencia Total
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold" style={{ color: primaryColor }}>
                Claridad en lo que cubre tu membresía
              </h2>
              <p className="text-slate-600 text-sm">
                Sin letras chiquitas. Conoce con total exactitud el alcance de tu protección médica.
              </p>

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

        {/* ─── 10. PRUEBA SOCIAL & ESTADÍSTICAS ───────────────────────────── */}
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 text-center">
              <div className="p-6 rounded-2xl bg-[#F4F9FF] border border-slate-200/70">
                <p className="text-3xl sm:text-4xl font-black" style={{ color: primaryColor }}>+50,000</p>
                <p className="text-xs sm:text-sm font-semibold text-slate-700 mt-1">Miembros Protegidos</p>
                <p className="text-[11px] text-slate-500 mt-0.5">En toda la República Mexicana</p>
              </div>

              <div className="p-6 rounded-2xl bg-[#F4F9FF] border border-slate-200/70">
                <p className="text-3xl sm:text-4xl font-black" style={{ color: primaryColor }}>100%</p>
                <p className="text-xs sm:text-sm font-semibold text-slate-700 mt-1">Deducible $0 en Red</p>
                <p className="text-[11px] text-slate-500 mt-0.5">En eventos autorizados</p>
              </div>

              <div className="p-6 rounded-2xl bg-[#F4F9FF] border border-slate-200/70">
                <p className="text-3xl sm:text-4xl font-black" style={{ color: primaryColor }}>+115</p>
                <p className="text-xs sm:text-sm font-semibold text-slate-700 mt-1">Hospitales Directos</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Y +548 en convenio nacional</p>
              </div>

              <div className="p-6 rounded-2xl bg-[#F4F9FF] border border-slate-200/70">
                <p className="text-3xl sm:text-4xl font-black" style={{ color: primaryColor }}>98.4%</p>
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
              <span className="px-3 py-1 rounded-full bg-white border border-[#CBD5E1] text-xs font-bold uppercase tracking-wider" style={{ color: primaryColor }}>
                Resolvemos tus Dudas
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold" style={{ color: primaryColor }}>
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

        {/* ─── 12. CTA FINAL CON ENLACE AL PORTAL Y FORMULARIO ────────────── */}
        <section id="contacto" className="py-20 text-white" style={{ backgroundColor: primaryColor }}>
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            
            {/* Tarjeta Destacada de Emisión Directa en Autoservicio */}
            <div className="mb-12 p-8 sm:p-10 rounded-3xl bg-white text-slate-900 shadow-2xl border-4 border-emerald-400 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-2 text-center md:text-left">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold uppercase tracking-wider">
                  <Zap className="w-3.5 h-3.5 text-emerald-700" />
                  Emisión 100% Digital en Autoservicio
                </span>
                <h3 className="text-2xl sm:text-3xl font-black text-slate-900">
                  ¿Listo para emitir tu póliza ahora mismo?
                </h3>
                <p className="text-sm text-slate-600 max-w-xl">
                  Accede al portal oficial de registro de Mutuus con el código de promotor <strong className="text-slate-900 font-bold">A-3522</strong> para cotizar, llenar tu solicitud y activar tu cobertura de inmediato.
                </p>
              </div>

              <div className="flex-shrink-0">
                <a
                  href={MUTUUS_PORTAL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-8 py-4 rounded-full font-black text-sm text-slate-900 transition-all shadow-xl hover:scale-105 active:scale-95 text-center flex items-center justify-center gap-2 cursor-pointer"
                  style={{ backgroundColor: accentColor }}
                >
                  <span>Ingresar al Portal de Registro</span>
                  <ExternalLink className="w-4 h-4 text-slate-900" />
                </a>
              </div>
            </div>

            {/* Formulario de Asesoría Personalizada */}
            <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 sm:p-12 border border-white/20 shadow-2xl">
              
              <div className="text-center max-w-2xl mx-auto space-y-3 mb-8">
                <span 
                  className="px-3 py-1 rounded-full bg-white/20 text-xs font-bold uppercase tracking-wider"
                  style={{ color: accentColor }}
                >
                  Asesoría Personalizada
                </span>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
                  ¿Prefieres que un asesor te acompañe en el proceso?
                </h2>
                <p className="text-white/80 text-sm">
                  Déjanos tus datos y te enviaremos una propuesta personalizada por WhatsApp sin costo ni compromiso.
                </p>
              </div>

              {leadSuccess ? (
                <div className="p-8 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 text-center space-y-3">
                  <CheckCircle2 className="w-12 h-12 mx-auto" style={{ color: accentColor }} />
                  <h3 className="text-xl font-bold text-white">¡Solicitud recibida con éxito!</h3>
                  <p className="text-xs sm:text-sm text-white/90 max-w-md mx-auto">
                    Un asesor especializado te contactará en breve por WhatsApp o teléfono con el desglose de tu membresía.
                  </p>
                  <div className="pt-3">
                    <a
                      href={MUTUUS_PORTAL_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-bold text-xs text-slate-900"
                      style={{ backgroundColor: accentColor }}
                    >
                      <span>O continúa directo al portal oficial Mutuus</span>
                      <ArrowRight className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleLeadSubmit} className="space-y-4 max-w-xl mx-auto">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-white/90 mb-1">Nombre Completo *</label>
                      <input
                        type="text"
                        required
                        value={leadForm.nombre}
                        onChange={(e) => setLeadForm({ ...leadForm, nombre: e.target.value })}
                        placeholder="Ej. Carlos Mendoza"
                        className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 text-sm focus:outline-none focus:ring-2"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-white/90 mb-1">Edad del Titular *</label>
                      <input
                        type="number"
                        required
                        min="0"
                        max="80"
                        value={leadForm.edad}
                        onChange={(e) => setLeadForm({ ...leadForm, edad: e.target.value })}
                        placeholder="Ej. 34"
                        className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 text-sm focus:outline-none focus:ring-2"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-white/90 mb-1">Teléfono / WhatsApp *</label>
                      <input
                        type="tel"
                        required
                        value={leadForm.telefono}
                        onChange={(e) => setLeadForm({ ...leadForm, telefono: e.target.value })}
                        placeholder="10 dígitos (ej. 5512345678)"
                        className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 text-sm focus:outline-none focus:ring-2"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-white/90 mb-1">Ciudad / Estado</label>
                      <input
                        type="text"
                        value={leadForm.ciudad}
                        onChange={(e) => setLeadForm({ ...leadForm, ciudad: e.target.value })}
                        placeholder="Ej. CDMX / Guadalajara"
                        className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 text-sm focus:outline-none focus:ring-2"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-white/90 mb-1">Plan de Interés</label>
                    <select
                      value={leadForm.plan}
                      onChange={(e) => setLeadForm({ ...leadForm, plan: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white text-sm focus:outline-none focus:ring-2"
                    >
                      <option value="Plan UNO" className="text-slate-900">Plan UNO ($1,000,000 MXN Suma Asegurada)</option>
                      <option value="Plan DOS" className="text-slate-900">Plan DOS ($3,000,000 MXN Suma Asegurada · Más Elegido)</option>
                      <option value="Plan PLUS" className="text-slate-900">Plan PLUS ($5,000,000 MXN Suma Asegurada · Premium)</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={submittingLead}
                    className="w-full py-4 px-6 rounded-full font-black text-sm text-slate-900 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    style={{ backgroundColor: accentColor }}
                  >
                    {submittingLead ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                    <span>Enviar y Recibir Cotización en WhatsApp</span>
                  </button>

                  <p className="text-[11px] text-center text-white/60">
                    Tus datos están protegidos conforme a la Ley Federal de Protección de Datos Personales (LFPDPPP).
                  </p>
                </form>
              )}

            </div>
          </div>
        </section>

        {/* ─── 13. FOOTER ─────────────────────────────────────────────────── */}
        <footer className="bg-[#001738] text-white/80 text-xs py-14 border-t border-white/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <div className="space-y-3">
                <span className="font-extrabold text-xl text-white tracking-tight block">
                  mutuus
                </span>
                <p className="text-white/70 text-xs leading-relaxed">
                  Promotoría Autorizada de Mutuus. Distribución y asesoría certificada de membresías de salud y pólizas de gastos médicos.
                </p>
                <div className="pt-1 space-y-1.5">
                  <span 
                    className="inline-block px-2.5 py-1 rounded-full bg-white/10 text-[10px] font-bold border border-white/10"
                    style={{ color: accentColor }}
                  >
                    Promotor Oficial Grupo JIRO / Movi Digital · A-3522
                  </span>
                  <div>
                    <a
                      href={MUTUUS_PORTAL_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-bold text-white underline hover:text-white/80 inline-flex items-center gap-1"
                    >
                      <LogIn className="w-3 h-3" />
                      <span>Portal de Registro y Autoservicio</span>
                    </a>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="font-bold text-white text-sm">Secciones</p>
                <ul className="space-y-1.5 text-white/70">
                  <li><a href="#porque-mutuus" className="hover:text-white transition-colors">¿Por qué Mutuus?</a></li>
                  <li><a href="#planes" className="hover:text-white transition-colors">Planes UNO, DOS y PLUS</a></li>
                  <li><a href="#red-hospitalaria" className="hover:text-white transition-colors">Red de Hospitales</a></li>
                  <li><a href="#coberturas" className="hover:text-white transition-colors">Tabulador de Coberturas</a></li>
                  <li><a href="#faq" className="hover:text-white transition-colors">Preguntas Frecuentes</a></li>
                </ul>
              </div>

              <div className="space-y-2">
                <p className="font-bold text-white text-sm">Portal & Documentos</p>
                <ul className="space-y-1.5 text-white/70">
                  <li>
                    <a href={MUTUUS_PORTAL_URL} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors flex items-center gap-1 text-emerald-300 font-bold">
                      <ExternalLink className="w-3.5 h-3.5" /> Portal de Emisión (A-3522)
                    </a>
                  </li>
                  <li><a href="#" className="hover:text-white transition-colors flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> Condiciones Generales Póliza</a></li>
                  <li><a href="#" className="hover:text-white transition-colors flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> Manual de Membresía Salud</a></li>
                  <li><a href="#" className="hover:text-white transition-colors flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> Términos y Condiciones</a></li>
                  <li><a href="#" className="hover:text-white transition-colors flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> Aviso de Privacidad Integral</a></li>
                </ul>
              </div>

              <div className="space-y-2">
                <p className="font-bold text-white text-sm">Contacto Directo</p>
                <p className="text-white/70 text-xs">
                  Atención personalizada para agentes, familias y empresas.
                </p>
                <p className="text-white font-bold text-xs pt-1">
                  WhatsApp: <a href={`https://wa.me/${whatsappNumber}`} className="hover:underline" style={{ color: accentColor }}>+{whatsappNumber}</a>
                </p>
                <p className="text-white/70 text-[11px]">
                  México · Cobertura a nivel nacional
                </p>
              </div>
            </div>

            <div className="pt-8 border-t border-white/10 space-y-2 text-[11px] text-white/50 leading-relaxed">
              <p>
                * Mutuus es una marca registrada. Este sitio es operado por promotores y asesores profesionales autorizados para la intermediación y difusión de sus productos. La condonación del deducible y coaseguro opera exclusivamente bajo el estricto cumplimiento del protocolo de atención en la red de pago directo y reporte previo del siniestro. Cobertura de maternidad sujeta a 10 meses continuos y topes establecidos en Unidades de Medida y Actualización (UMA).
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-between pt-4 text-white/40">
                <p>© {new Date().getFullYear()} landings.movi.digital/mutuus · Todos los derechos reservados.</p>
                <p>Promotor Autorizado A-3522 · Optimizado para SEO & GEO México</p>
              </div>
            </div>
          </div>
        </footer>

        {/* ─── MODAL RÁPIDO DE COTIZACIÓN ─────────────────────────────────── */}
        {showModalLead && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative border border-slate-200">
              <button
                onClick={() => setShowModalLead(false)}
                className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="space-y-2 mb-6">
                <span 
                  className="px-2.5 py-1 rounded-full text-xs font-bold"
                  style={{ backgroundColor: '#EFF6FF', color: primaryColor }}
                >
                  {selectedPlanForModal}
                </span>
                <h3 className="text-xl font-black text-slate-900">
                  Solicitar Cotización Inmediata
                </h3>
                <p className="text-xs text-slate-500">
                  Completa tus datos para enviarte la propuesta formal y activar tu membresía.
                </p>
              </div>

              {leadSuccess ? (
                <div className="p-6 rounded-2xl bg-emerald-50 text-center space-y-3">
                  <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                  <p className="font-bold text-emerald-900 text-sm">¡Datos enviados con éxito!</p>
                  <p className="text-xs text-emerald-700">Te estamos abriendo WhatsApp para darte atención inmediata.</p>
                  <div className="pt-2">
                    <a
                      href={MUTUUS_PORTAL_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-white"
                      style={{ backgroundColor: primaryColor }}
                    >
                      <span>Ir al portal de registro en línea</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleLeadSubmit} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre Completo *</label>
                    <input
                      type="text"
                      required
                      value={leadForm.nombre}
                      onChange={(e) => setLeadForm({ ...leadForm, nombre: e.target.value })}
                      placeholder="Tu nombre y apellido"
                      className="w-full text-xs border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Edad *</label>
                      <input
                        type="number"
                        required
                        value={leadForm.edad}
                        onChange={(e) => setLeadForm({ ...leadForm, edad: e.target.value })}
                        placeholder="Ej. 30"
                        className="w-full text-xs border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Teléfono / WhatsApp *</label>
                      <input
                        type="tel"
                        required
                        value={leadForm.telefono}
                        onChange={(e) => setLeadForm({ ...leadForm, telefono: e.target.value })}
                        placeholder="10 dígitos"
                        className="w-full text-xs border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Correo Electrónico</label>
                    <input
                      type="email"
                      value={leadForm.email}
                      onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })}
                      placeholder="tu@correo.com"
                      className="w-full text-xs border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submittingLead}
                    className="w-full mt-2 py-3.5 px-6 text-white font-bold text-xs sm:text-sm rounded-xl transition shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {submittingLead ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    <span>Recibir Asesoría y Cotización</span>
                  </button>

                  <div className="text-center pt-2">
                    <a
                      href={MUTUUS_PORTAL_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-bold text-blue-600 hover:underline inline-flex items-center gap-1"
                    >
                      <span>¿Prefieres emitir tú mismo en línea? Accede al portal</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* ─── BARRA FLOTANTE DE ACCIÓN RÁPIDA ────────────────────────────── */}
        <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">
          {/* Botón flotante al portal de emisión */}
          <a
            href={MUTUUS_PORTAL_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Emitir en Línea"
            className="px-4 py-3 rounded-full text-white font-black text-xs shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center gap-2 border-2 border-white"
            style={{ backgroundColor: primaryColor }}
          >
            <LogIn className="w-4 h-4" />
            <span className="hidden sm:inline">Portal / Emitir (A-3522)</span>
          </a>

          {/* Botón flotante WhatsApp */}
          <a
            href={`https://wa.me/${whatsappNumber}?text=Hola,%20deseo%20cotizar%20la%20membresia%20Mutuus.`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Cotizar por WhatsApp"
            className="p-3.5 sm:px-4 sm:py-3 rounded-full bg-[#25D366] text-slate-900 shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center gap-2 border-2 border-white"
          >
            <MessageSquare className="w-5 h-5 fill-slate-900 text-slate-900" />
            <span className="font-extrabold text-xs hidden sm:inline text-slate-900">WhatsApp Asesor</span>
          </a>
        </div>

      </div>
    </>
  );
}
