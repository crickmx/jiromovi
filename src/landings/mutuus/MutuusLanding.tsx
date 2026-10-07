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
  ChevronDown, 
  ChevronUp, 
  ArrowRight, 
  Building2, 
  FileText, 
  Send, 
  Loader2, 
  CheckCircle2 
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { ProjectDesignConfig } from '../hermesLandingService';

interface MutuusLandingProps {
  designOverrides?: ProjectDesignConfig;
}

// ─── FAQ Data with Rich SEO Content ──────────────────────────────────────────
const FAQS = [
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
    a: 'El trámite es 100% digital. Completas tu solicitud, realizas el pago en línea y recibes tu credencial digital y póliza en tu correo y en tu app en menos de 24 horas hábiles.'
  }
];

// ─── Red Hospitalaria Logos ──────────────────────────────────────────────────
const HOSPITALES = [
  { nombre: 'Hospitales Ángeles', tipo: 'Red Directa Nacional', ciudad: 'CDMX, GDL, MTY, Puebla' },
  { nombre: 'Médica Sur', tipo: 'Alta Especialidad', ciudad: 'CDMX' },
  { nombre: 'Star Médica', tipo: 'Red Directa Nacional', ciudad: 'Nacional (15 sedes)' },
  { nombre: 'Christus Muguerza', tipo: 'Red Hospitalaria Norte', ciudad: 'Monterrey, Saltillo, Chihuahua' },
  { nombre: 'Hospitales MAC', tipo: 'Red de Excelencia', ciudad: 'Bajío, Centro y Norte' },
  { nombre: 'Hospital San Javier', tipo: 'Alta Especialidad', ciudad: 'Guadalajara y Vallarta' }
];

export default function MutuusLanding({ designOverrides }: MutuusLandingProps) {
  const [periodicidad, setPeriodicidad] = useState<'anual' | 'mensual'>('anual');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [tabCobertura, setTabCobertura] = useState<'cubierto' | 'no_cubierto'>('cubierto');
  const [showModalLead, setShowModalLead] = useState(false);
  const [selectedPlanForModal, setSelectedPlanForModal] = useState<string>('Plan DOS');

  // Valores dinámicos combinados con los designOverrides de Hermes
  const heroBadge = designOverrides?.heroBadge || 'Cero Deducible · Cero Coaseguro en Red';
  const heroTitle = designOverrides?.heroTitle || 'Membresía de salud y gastos médicos con cero deducible';
  const heroSubtitle = designOverrides?.heroSubtitle || 'Accede a la mejor atención médica privada, telemedicina 24/7 ilimitada y respaldo hospitalario nacional sin pagar deducibles sorpresa al momento de una emergencia.';
  const primaryColor = designOverrides?.primaryColor || '#003896';
  const accentColor = designOverrides?.accentColor || '#9CD41C';
  const ctaBtnText = designOverrides?.ctaText || 'Ver Planes y Precios';
  const pUno = designOverrides?.planUnoPrecio || '$1,299';
  const pDos = designOverrides?.planDosPrecio || '$1,899';
  const pPlus = designOverrides?.planPlusPrecio || '$2,499';

  const PLANES_DYNAMIC = {
    mensual: [
      {
        id: 'uno',
        nombre: 'Plan UNO',
        badge: 'Básico Esencial',
        sumaAsegurada: '$1,000,000 MXN',
        pagoInicial: pUno,
        mensualidad: pUno,
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
        pagoInicial: pDos,
        mensualidad: pDos,
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
        pagoInicial: pPlus,
        mensualidad: pPlus,
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
        descuento: 'Ahorra 10%',
        popular: false,
        caracteristicas: [
          'Cero Deducible en red de pago directo',
          'Cero Coaseguro en eventos hospitalarios',
          'Suma asegurada de $1,000,000 MXN por evento',
          'Telemedicina 24/7 ilimitada (Medicina general)',
          'Red de 115+ hospitales nacionales',
          'Ambulancia de urgencia (2 eventos al año)'
        ]
      },
      {
        id: 'dos',
        nombre: 'Plan DOS',
        badge: 'Más Elegido · Mejor Valor',
        sumaAsegurada: '$3,000,000 MXN',
        pagoInicial: '$20,490',
        mensualidad: 'Equiv. $1,707/mes',
        descuento: 'Ahorra 10%',
        popular: true,
        caracteristicas: [
          'Cero Deducible en red de pago directo',
          'Cero Coaseguro en eventos hospitalarios',
          'Suma asegurada de $3,000,000 MXN por evento',
          'Telemedicina 24/7 (General, Psicología, Nutrición)',
          'Red completa de 548+ hospitales en convenio',
          'Ayuda de maternidad tras 10 meses'
        ]
      },
      {
        id: 'plus',
        nombre: 'Plan PLUS',
        badge: 'Protección Total',
        sumaAsegurada: '$5,000,000 MXN',
        pagoInicial: '$26,990',
        mensualidad: 'Equiv. $2,249/mes',
        descuento: 'Ahorra 10%',
        popular: false,
        caracteristicas: [
          'Cero Deducible en red hospitalaria premium',
          'Cero Coaseguro en hospitalización y cirugía',
          'Suma asegurada de $5,000,000 MXN por evento',
          'Acceso prioritario a hospitales Grupo Ángeles y Médica Sur',
          'Ambulancia aérea y terrestre en urgencias'
        ]
      }
    ]
  };

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

  const plans = PLANES_DYNAMIC[periodicidad];

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
        window.open(`https://wa.me/525540001234?text=${msg}`, '_blank');
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
        <title>Mutuus Seguro de Gastos Médicos | Cero Deducible y Coaseguro</title>
        <meta 
          name="description" 
          content="Membresía de salud y seguro de gastos médicos Mutuus con atención hospitalaria directa, telemedicina 24/7 y 0% de deducible en México." 
        />
        <link rel="canonical" href="https://landings.movi.digital/mutuus" />
      </Helmet>

      <div className="min-h-screen bg-white text-[#2B2A2A] font-sans antialiased selection:bg-[#003896] selection:text-white" style={{ fontFamily: 'Montserrat, system-ui, -apple-system, sans-serif' }}>

        {/* ─── 1. HEADER STICKY (PROMOTOR AUTORIZADO) ────────────────────── */}
        <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
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

              <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#EFF6FF] border border-[#CBD5E1] text-[11px] font-bold text-[#003896]">
                <ShieldCheck className="w-3.5 h-3.5 text-[#003896]" />
                <span>Promotor Autorizado</span>
              </div>
            </div>

            <nav className="hidden lg:flex items-center gap-7 text-sm font-semibold text-slate-700">
              <a href="#porque-mutuus" className="hover:text-[#003896] transition-colors">¿Por qué Mutuus?</a>
              <a href="#planes" className="hover:text-[#003896] transition-colors">Planes y Precios</a>
              <a href="#red-hospitalaria" className="hover:text-[#003896] transition-colors">Red de Hospitales</a>
              <a href="#coberturas" className="hover:text-[#003896] transition-colors">Coberturas</a>
              <a href="#faq" className="hover:text-[#003896] transition-colors">Preguntas Frecuentes</a>
            </nav>

            <div className="flex items-center gap-3">
              <button
                onClick={() => handleOpenLeadModal('Plan DOS')}
                className="hidden sm:inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs md:text-sm font-bold text-white transition-all shadow-md active:scale-95 cursor-pointer"
                style={{ backgroundColor: primaryColor }}
              >
                <span>Cotizar Plan</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <a
                href="https://wa.me/525540001234?text=Hola,%20deseo%20asesoria%20sobre%20los%20planes%20Mutuus."
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold text-slate-900 bg-[#25D366] hover:bg-[#20ba5a] transition-all shadow-sm active:scale-95"
              >
                <MessageSquare className="w-4 h-4 fill-slate-900 text-slate-900" />
                <span className="hidden md:inline">WhatsApp Asesor</span>
              </a>
            </div>
          </div>
        </header>

        {/* ─── 2. HERO SECTION CON OVERLAY Y FOTO ─────────────────────────── */}
        <section id="inicio" className="relative pt-12 pb-20 md:pt-20 md:pb-28 overflow-hidden bg-gradient-to-b from-[#F4F9FF] via-white to-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              
              <div className="lg:col-span-7 space-y-6">
                
                {/* Badge Dinámico */}
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#EFF6FF] border border-[#CBD5E1] text-xs font-bold text-[#003896]">
                  <Sparkles className="w-4 h-4 text-[#003896]" />
                  <span>{heroBadge}</span>
                </div>

                {/* H1 Principal Dinámico */}
                <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-[#2B2A2A] tracking-tight leading-[1.15]">
                  {heroTitle}
                </h1>

                {/* Subtítulo Dinámico */}
                <p className="text-base sm:text-lg text-slate-600 leading-relaxed font-normal max-w-2xl">
                  {heroSubtitle}
                </p>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-2">
                  <a
                    href="#planes"
                    className="inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-full text-base font-bold text-white transition-all shadow-lg active:scale-98 text-center"
                    style={{ backgroundColor: primaryColor }}
                  >
                    <span>{ctaBtnText}</span>
                    <ArrowRight className="w-5 h-5" />
                  </a>

                  <button
                    onClick={() => handleOpenLeadModal('Plan DOS')}
                    className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-full text-base font-bold bg-white border-2 hover:bg-[#EFF6FF] transition-all text-center"
                    style={{ borderColor: primaryColor, color: primaryColor }}
                  >
                    <Phone className="w-4 h-4" />
                    <span>Hablar con un Asesor</span>
                  </button>
                </div>

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

              {/* Tarjeta Visual Hero Derecha */}
              <div className="lg:col-span-5 relative">
                <div
                  className="relative rounded-3xl p-6 sm:p-8 text-white shadow-2xl border border-white/20 overflow-hidden"
                  style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, #001845 100%)` }}
                >
                  <div className="relative z-10 space-y-6">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs font-bold text-lime-300 border border-white/10">
                      <Hospital className="w-4 h-4" />
                      <span>Pago Directo al Hospital</span>
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

                    <button
                      onClick={() => handleOpenLeadModal('Plan DOS')}
                      className="w-full py-3.5 px-6 rounded-full font-extrabold text-sm text-slate-900 transition-all shadow-md active:scale-95 cursor-pointer text-center block"
                      style={{ backgroundColor: accentColor }}
                    >
                      Cotizar mi Membresía Ahora
                    </button>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ─── 3. PLANES Y PRECIOS TRANSPARENTES ──────────────────────────── */}
        <section id="planes" className="py-20 bg-[#F4F9FF]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            
            <div className="text-center max-w-3xl mx-auto space-y-4 mb-12">
              <span className="px-3 py-1 rounded-full bg-white border border-[#CBD5E1] text-xs font-bold text-[#003896] uppercase tracking-wider">
                Tarifas y Coberturas
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-[#003896]">
                Elige el plan diseñado para tu estilo de vida
              </h2>

              <div className="pt-4 flex items-center justify-center">
                <div className="bg-white p-1 rounded-full border border-slate-200 shadow-xs inline-flex">
                  <button
                    onClick={() => setPeriodicidad('anual')}
                    className={`px-6 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      periodicidad === 'anual' ? 'bg-[#003896] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Pago Anual (Ahorro 10%)
                  </button>
                  <button
                    onClick={() => setPeriodicidad('mensual')}
                    className={`px-6 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      periodicidad === 'mensual' ? 'bg-[#003896] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
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
                      ? 'border-2 border-[#003896] shadow-2xl scale-102 lg:-translate-y-2'
                      : 'border border-slate-200 shadow-md hover:shadow-xl'
                  }`}
                >
                  {p.popular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-[#003896] text-white text-xs font-extrabold uppercase tracking-wide">
                      {p.badge}
                    </div>
                  )}

                  <div>
                    <h3 className="text-2xl font-black text-[#2B2A2A] mt-2">{p.nombre}</h3>
                    
                    <div className="mt-4 pb-5 border-b border-slate-100">
                      <p className="text-xs text-slate-500 font-medium">Suma Asegurada por Evento:</p>
                      <p className="text-xl font-extrabold text-[#003896]">{p.sumaAsegurada}</p>
                      
                      <div className="mt-3 flex items-baseline gap-1">
                        <span className="text-3xl sm:text-4xl font-black text-slate-900">{p.pagoInicial}</span>
                        <span className="text-xs text-slate-500 font-semibold">MXN / {periodicidad === 'anual' ? 'año' : 'mes'}</span>
                      </div>
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
                    <button
                      onClick={() => handleOpenLeadModal(p.nombre)}
                      className={`w-full py-3.5 px-6 rounded-full font-bold text-xs sm:text-sm transition-all shadow-md active:scale-95 cursor-pointer text-center block ${
                        p.popular ? 'bg-[#003896] text-white hover:bg-[#002b75]' : 'bg-slate-900 text-white hover:bg-slate-800'
                      }`}
                    >
                      Solicitar {p.nombre}
                    </button>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </section>

        {/* ─── 4. RED HOSPITALARIA DE PAGO DIRECTO ────────────────────────── */}
        <section id="red-hospitalaria" className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto space-y-3 mb-14">
              <span className="px-3 py-1 rounded-full bg-[#EFF6FF] border border-[#CBD5E1] text-xs font-bold text-[#003896] uppercase tracking-wider">
                Infraestructura Hospitalaria
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-[#003896]">
                Red Médica Nacional de Pago Directo
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {HOSPITALES.map((h, i) => (
                <div
                  key={i}
                  className="p-6 rounded-2xl bg-[#F4F9FF] border border-slate-200/80 hover:border-[#003896] hover:shadow-lg transition-all group"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-white text-[#003896] border border-slate-200 flex items-center justify-center font-bold text-lg group-hover:bg-[#003896] group-hover:text-white transition-colors">
                      <Hospital className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-base">{h.nombre}</h4>
                      <span className="text-[11px] font-semibold text-[#003896] uppercase">{h.tipo}</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-2">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>Cobertura: {h.ciudad}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

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
                <span className="px-2.5 py-1 rounded-full bg-[#EFF6FF] text-[#003896] text-xs font-bold">
                  {selectedPlanForModal}
                </span>
                <h3 className="text-xl font-black text-slate-900">
                  Solicitar Cotización Inmediata
                </h3>
              </div>

              {leadSuccess ? (
                <div className="p-6 rounded-2xl bg-emerald-50 text-center space-y-2">
                  <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                  <p className="font-bold text-emerald-900 text-sm">¡Datos enviados con éxito!</p>
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
                      className="w-full text-xs border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#003896]"
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
                      className="w-full text-xs border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#003896]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submittingLead}
                    className="w-full mt-2 py-3.5 px-6 text-white font-bold text-xs sm:text-sm rounded-xl transition shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {submittingLead ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    <span>Recibir Asesoría y Cotización</span>
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

      </div>
    </>
  );
}
