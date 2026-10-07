import { useState, useMemo, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  ShieldCheck,
  HeartPulse,
  Activity,
  Stethoscope,
  Building2,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ArrowRight,
  PhoneCall,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Users,
  Clock,
  MapPin,
  Calendar,
  Smartphone,
  Hospital,
  AlertCircle,
  Check,
  Zap,
  TrendingUp,
  Percent,
  Search,
  Award,
  Globe,
  Sliders,
  Send,
  Eye,
  Smile,
  FileCheck
} from 'lucide-react';

// ── Hospital Data by Region ────────────────────────────────────────────────
const HOSPITAL_CITIES = [
  { id: 'all', name: 'Todo México', count: '650+' },
  { id: 'cdmx', name: 'CDMX y Edo. Méx', count: '140+' },
  { id: 'gdl', name: 'Guadalajara y Jalisco', count: '85+' },
  { id: 'mty', name: 'Monterrey y N.L.', count: '90+' },
  { id: 'qro', name: 'Querétaro y Bajío', count: '60+' },
  { id: 'puebla', name: 'Puebla y Centro', count: '45+' },
  { id: 'merida', name: 'Mérida y Sureste', count: '50+' },
  { id: 'tijuana', name: 'Tijuana y Noroeste', count: '40+' },
];

const HOSPITALS = [
  {
    name: 'Hospital Ángeles',
    region: 'cdmx',
    locations: 'Pedregal, Lomas, Interlomas, Acoxpa, Metropolitano',
    badge: 'Nivel Alta Especialidad',
    coverage: 'Hospitalización, Cirugía, Urgencias, Terapia Intensiva',
    icon: Hospital,
  },
  {
    name: 'Médica Sur',
    region: 'cdmx',
    locations: 'Tlalpan, CDMX (Certificación Mayo Clinic)',
    badge: 'Centro Médico de Excelencia',
    coverage: 'Especialidades, Cirugías Complejas, Urgencias 24/7',
    icon: Hospital,
  },
  {
    name: 'Hospital Español',
    region: 'cdmx',
    locations: 'Polanco / Miguel Hidalgo, CDMX',
    badge: 'Tradición y Alta Tecnología',
    coverage: 'Hospitalización General, Quirófanos, Cuidados Críticos',
    icon: Hospital,
  },
  {
    name: 'Hospital Puerta de Hierro',
    region: 'gdl',
    locations: 'Zapopan, Andares, Sur y Tlajomulco',
    badge: 'Red Élite Occidente',
    coverage: 'Cirugía Avanzada, Maternidad, Urgencias',
    icon: Hospital,
  },
  {
    name: 'Hospital San Javier',
    region: 'gdl',
    locations: 'Guadalajara y Puerto Vallarta',
    badge: 'Referencia en Salud',
    coverage: 'Cirugía Robótica, Hospitalización, Check-ups',
    icon: Hospital,
  },
  {
    name: 'Christus Muguerza',
    region: 'mty',
    locations: 'Alta Especialidad, Sur, Conchitas, San Nicolás',
    badge: 'Líder en el Norte',
    coverage: 'Trauma, Cirugía Cardiovascular, Urgencias Pediátricas',
    icon: Hospital,
  },
  {
    name: 'Doctors Hospital',
    region: 'mty',
    locations: 'Monterrey Galerías y East',
    badge: 'Tecnología Médica de Vanguardia',
    coverage: 'Unidad de Quemados, Terapia Intensiva, Maternidad',
    icon: Hospital,
  },
  {
    name: 'Star Médica',
    region: 'qro',
    locations: 'Querétaro, Morelia, Mérida, San Luis Potosí, CDMX',
    badge: 'Red Nacional Confort',
    coverage: 'Urgencias, Quirófanos de Corta Estancia, Hospitalización',
    icon: Hospital,
  },
  {
    name: 'Hospital Puebla',
    region: 'puebla',
    locations: 'Angelópolis / Puebla',
    badge: 'Centro Regional de Referencia',
    coverage: 'Cirugía General, Urgencias, Medicina Interna',
    icon: Hospital,
  },
  {
    name: 'Hospital Faro del Mayab',
    region: 'merida',
    locations: 'Mérida Norte (Operado por Médica Sur)',
    badge: 'Vanguardia Sureste',
    coverage: 'Urgencias 24/7, Cirugía Laparoscópica, Terapia',
    icon: Hospital,
  },
];

// ── Plans & Pricing ───────────────────────────────────────────────────────
const PLANS = [
  {
    id: 'esencial',
    name: 'Mutuus Esencial',
    tagline: 'Ideal para personas independientes y jóvenes que buscan protección médica clave.',
    popular: false,
    monthlyPrice: 699,
    annualPrice: 7490,
    sumAssurance: 'Hasta $1,000,000 MXN / evento',
    deductible: '$0 MXN en Red',
    coaseguro: '0%',
    features: [
      'Urgencias médicas por accidente o enfermedad 24/7',
      'Telemedicina ilimitada 24/7 por videollamada y chat',
      'Consultas con médicos especialistas en red a solo $350 MXN',
      'Check-up preventivo anual incluido (laboratorios básicos)',
      'Asistencia dental (2 limpiezas gratis al año + descuentos)',
      'Asistencia visual y óptica (examen de la vista + armazón)',
      'Asistencia médica en viajes nacionales e internacionales',
      'App móvil con credencial digital y botón SOS',
    ],
    notIncluded: [
      'Cirugías programadas no urgentes',
      'Maternidad y parto programado',
    ],
    ctaText: 'Cotizar Esencial',
  },
  {
    id: 'total',
    name: 'Mutuus Total Plus',
    tagline: 'La membresía médica más completa. Hospitalización privada, cirugías y cero deducible.',
    popular: true,
    monthlyPrice: 1490,
    annualPrice: 15990,
    sumAssurance: 'Hasta $5,000,000 MXN / evento',
    deductible: '$0 MXN en Red Hospitalaria',
    coaseguro: '0% de coaseguro',
    features: [
      'Todo lo incluido en Mutuus Esencial',
      'Hospitalización privada completa en habitación estándar',
      'Cirugías programadas y cirugías de urgencia cubiertas',
      'Honorarios de cirujano, anestesiólogo y equipo quirúrgico',
      'Terapia Intensiva e Intermedia sin límite de días cubiertos',
      'Medicamentos intrahospitalarios y material de curación',
      'Tratamientos oncológicos y cardiovasculares de alta gama',
      'Maternidad y complicaciones del embarazo (con periodo de espera)',
      'Pago directo al hospital: sin trámites de reembolso',
      'Concierge médico personal para citas y admisiones',
    ],
    notIncluded: [],
    ctaText: 'Elegir Plan Total Plus',
  },
  {
    id: 'familiar',
    name: 'Mutuus Familiar',
    tagline: 'Tranquilidad total para tu hogar con tarifas multi-integrante y pediatría 24/7.',
    popular: false,
    monthlyPrice: 3290,
    annualPrice: 35400,
    sumAssurance: 'Hasta $5,000,000 MXN por cada integrante',
    deductible: '$0 MXN en Red',
    coaseguro: '0%',
    features: [
      'Cobertura integral para Titular + Cónyuge + Hijos',
      'Telepediatría 24/7 sin límite de consultas por videollamada',
      'Hospitalización y cirugías privadas para toda la familia',
      'Chequeos preventivos pediátricos y para adultos incluidos',
      'Atención de urgencias pediátricas en hospitales especializados',
      'Descuentos en farmacias de cadena y laboratorios clínicos',
      'Manejo de accidentes escolares y deportivos de los hijos',
      'Asistencia psicológica y nutricional familiar vía App',
    ],
    notIncluded: [],
    ctaText: 'Cotizar Plan Familiar',
  },
  {
    id: 'empresarial',
    name: 'Mutuus Corporativo',
    tagline: 'Para startups, empresas y equipos de trabajo. 100% deducible de impuestos.',
    popular: false,
    monthlyPrice: 'A la medida',
    annualPrice: 'Cotización grupal',
    sumAssurance: 'Planes flexibles desde 5 colaboradores',
    deductible: '$0 MXN',
    coaseguro: '0%',
    features: [
      'Precios preferenciales por volumen desde 5 colaboradores',
      '100% deducible de ISR como previsión social',
      'Sin exámenes médicos de admisión previos para el equipo',
      'Portal de administración digital de altas, bajas y nómina',
      'Telemedicina ilimitada para todos los colaboradores',
      'Cobertura para accidentes de trabajo y emergencias generales',
      'Webinars de salud mental, ergonomía y bienestar corporativo',
    ],
    notIncluded: [],
    ctaText: 'Cotizar para mi Empresa',
  },
];

// ── FAQs ──────────────────────────────────────────────────────────────────
const FAQS = [
  {
    q: '¿Qué es exactamente la Membresía Médica Mutuus?',
    a: 'Mutuus es un modelo de salud inteligente que combina acceso a hospitales privados de primer nivel, cirugías, urgencias médicas, telemedicina 24/7 y medicina preventiva bajo un esquema sin deducibles ni coaseguros tradicionales dentro de su red. No tienes que desembolsar miles de pesos de deducible inicial para que tu atención comience.',
  },
  {
    q: '¿Cómo funciona el beneficio de $0 Deducible y 0% Coaseguro?',
    a: 'En los seguros tradicionales de Gastos Médicos Mayores (SGMM), para que la aseguradora pague, primero debes cubrir un deducible de $20,000 a $60,000 MXN, más el 10% o 20% de coaseguro del total de la cuenta. Con Mutuus, al atenderte en los hospitales y centros médicos en convenio, el pago se realiza directamente sin que tengas que cubrir deducible ni porcentaje de coaseguro.',
  },
  {
    q: '¿Cómo se ingresa a un hospital en caso de una urgencia médica?',
    a: 'Solo debes presentarte en el área de urgencias de cualquiera de los más de 650 hospitales de la red y mostrar tu credencial digital Mutuus desde la App o llamar a la línea de asistencia médica 24/7. El equipo de coordinación médica enlaza con el hospital y emite el pase de atención inmediata con pago directo.',
  },
  {
    q: '¿Qué hospitales forman parte de la red de atención?',
    a: 'Contamos con una amplia red hospitalaria que incluye Grupo Ángeles, Star Médica, Médica Sur, Hospital Español, Christus Muguerza, Puerta de Hierro, San Javier, San Ángel Inn, Country 2000, Faro del Mayab, entre muchos otros en las principales ciudades de México.',
  },
  {
    q: '¿Existen periodos de espera para ciertos padecimientos?',
    a: 'Las urgencias médicas por accidente o padecimientos agudos repentinos están cubiertas desde el primer día de vigencia de tu membresía. Para cirugías programadas, maternidad o ciertos procedimientos específicos, aplican periodos de espera claros y transparentes (ej. 10 meses para maternidad, 12 meses para hernias/vesícula), estipulados en tu contrato sin letras chiquitas.',
  },
  {
    q: '¿Qué servicios de prevención y salud diaria incluye?',
    a: 'Incluye consultas de telemedicina ilimitadas 24/7 (medicina general, pediatría, psicología, nutrición), check-up médico anual con estudios clínicos de laboratorio sin costo, limpiezas dentales anuales, descuentos en consultas con médicos especialistas en consultorio y precios preferenciales en farmacias.',
  },
  {
    q: '¿Hasta qué edad se puede contratar la membresía?',
    a: 'La edad de contratación inicial es desde recién nacidos (0 años) hasta los 64 años de edad, con renovación vitalicia garantizada manteniendo tu membresía activa.',
  },
  {
    q: '¿Es deducible de impuestos en México?',
    a: 'Sí. Para personas morales y personas físicas con actividad empresarial/régimen correspondiente, las cuotas de previsión social y salud médica pueden ser deducibles de impuestos cumpliendo con los requisitos fiscales del SAT.',
  },
];

export default function MutuusLanding() {
  // Plan billing interval
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');
  // Selected City Filter for Hospitals
  const [selectedCity, setSelectedCity] = useState('all');
  // Search query in FAQ
  const [faqSearch, setFaqSearch] = useState('');
  // Expanded FAQ item index
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Interactive Calculator State
  const [calcAgeGroup, setCalcAgeGroup] = useState<string>('30-39');
  const [calcMembers, setCalcMembers] = useState<number>(1);
  const [calcPlan, setCalcPlan] = useState<'esencial' | 'total'>('total');

  // Lead Form State
  const [leadName, setLeadName] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [leadCity, setLeadCity] = useState('CDMX');
  const [leadPlanInterest, setLeadPlanInterest] = useState('Mutuus Total Plus');
  const [leadSubmitted, setLeadSubmitted] = useState(false);
  const [leadLoading, setLeadLoading] = useState(false);

  const formRef = useRef<HTMLDivElement>(null);

  const scrollToForm = (planName?: string) => {
    if (planName) {
      setLeadPlanInterest(planName);
    }
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Filtered Hospitals
  const filteredHospitals = useMemo(() => {
    if (selectedCity === 'all') return HOSPITALS;
    return HOSPITALS.filter((h) => h.region === selectedCity);
  }, [selectedCity]);

  // Filtered FAQs
  const filteredFaqs = useMemo(() => {
    if (!faqSearch.trim()) return FAQS;
    const q = faqSearch.toLowerCase();
    return FAQS.filter(
      (item) => item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q)
    );
  }, [faqSearch]);

  // Estimated Calculator Math
  const calculatedQuote = useMemo(() => {
    let base = calcPlan === 'esencial' ? 699 : 1490;
    if (calcAgeGroup === '40-49') base *= 1.35;
    if (calcAgeGroup === '50-59') base *= 1.85;
    if (calcAgeGroup === '60-64') base *= 2.45;

    const totalMonthly = Math.round(base * calcMembers * (calcMembers > 2 ? 0.9 : 1));
    const sgmmTraditionalDeductible = 35000;
    const estimatedSavingsAnnual = Math.round(sgmmTraditionalDeductible + totalMonthly * 0.35);

    return {
      monthlyPerPerson: Math.round(base),
      totalMonthly,
      totalAnnual: Math.round(totalMonthly * 10.8), // 10% disc on annual
      estimatedSavingsAnnual,
    };
  }, [calcAgeGroup, calcMembers, calcPlan]);

  const handleLeadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadName || !leadPhone) return;

    setLeadLoading(true);
    setTimeout(() => {
      setLeadLoading(false);
      setLeadSubmitted(true);
    }, 900);
  };

  return (
    <div className="min-h-screen bg-[#070D1E] text-slate-100 font-sans selection:bg-emerald-500 selection:text-white antialiased">
      <Helmet>
        <title>Mutuus Salud Inteligente | Membresía Médica Sin Deducible en México</title>
        <meta
          name="description"
          content="Conoce Mutuus, la membresía de gastos médicos sin deducible y sin coaseguro. Atención en los mejores hospitales privados de México, cirugías, urgencias y telemedicina 24/7."
        />
        <meta
          name="keywords"
          content="mutuus membresia medica, gastos medicos sin deducible, seguro medico mexico, hospital angeles sin deducible, medicina privada cdmx guadalajara monterrey, salud digital mexico"
        />
        <meta property="og:title" content="Mutuus Salud Inteligente | Protección Médica Sin Deducible" />
        <meta
          property="og:description"
          content="La evolución de los gastos médicos en México: $0 Deducible, 0% Coaseguro y más de 650 hospitales privados."
        />
        <meta property="og:type" content="website" />
        <meta name="theme-color" content="#070D1E" />
        <script type="application/ld+json">
          {JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'MedicalBusiness',
            name: 'Mutuus Salud Inteligente',
            description: 'Membresías médicas de salud privada sin deducible ni coaseguro en México.',
            areaServed: ['CDMX', 'Guadalajara', 'Monterrey', 'Querétaro', 'Puebla', 'Mérida', 'Tijuana'],
            medicalSpecialty: ['Emergency', 'Surgery', 'GeneralPractice', 'Telemedicine'],
            currenciesAccepted: 'MXN',
            paymentAccepted: 'Credit Card, Debit Card, Bank Transfer',
          })}
        </script>
      </Helmet>

      {/* ── Top Announcement Bar ── */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white text-xs md:text-sm font-medium py-2 px-4 text-center flex items-center justify-center gap-2 shadow-sm">
        <Sparkles className="w-4 h-4 shrink-0 animate-pulse" />
        <span>
          <strong>Nueva Cobertura 2025:</strong> $0 Deducible en más de 650 hospitales privados de México.
        </span>
        <button
          onClick={() => scrollToForm()}
          className="hidden sm:inline-flex items-center gap-1 underline font-semibold hover:text-emerald-100 transition-colors ml-2"
        >
          Cotizar ahora <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── Navigation Header ── */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#070D1E]/85 border-b border-white/10 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <HeartPulse className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-xl font-extrabold tracking-tight text-white flex items-center gap-1">
                mutuus<span className="text-emerald-400">.</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30 tracking-normal">
                  Salud Inteligente
                </span>
              </span>
              <p className="text-[10px] text-slate-400 font-medium">Membresía Médica Privada</p>
            </div>
          </div>

          <nav className="hidden lg:flex items-center gap-8 text-sm font-medium text-slate-300">
            <a href="#beneficios" className="hover:text-emerald-400 transition-colors">Beneficios</a>
            <a href="#comparativa" className="hover:text-emerald-400 transition-colors">Mutuus vs SGMM</a>
            <a href="#planes" className="hover:text-emerald-400 transition-colors">Planes & Tarifas</a>
            <a href="#hospitales" className="hover:text-emerald-400 transition-colors">Red Hospitalaria</a>
            <a href="#calculadora" className="hover:text-emerald-400 transition-colors">Calculadora</a>
            <a href="#faqs" className="hover:text-emerald-400 transition-colors">Preguntas Frecuentes</a>
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={() => scrollToForm()}
              className="relative group overflow-hidden px-5 py-2.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-semibold text-sm shadow-lg shadow-emerald-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
            >
              <span className="relative z-10 flex items-center gap-1.5">
                Cotizar Membresía <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* ── HERO SECTION ── */}
      <section className="relative pt-12 pb-20 md:pt-20 md:pb-32 overflow-hidden">
        {/* Glowing Background Orbs */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-gradient-to-b from-emerald-500/15 via-teal-500/10 to-transparent blur-3xl -z-10 pointer-events-none" />
        <div className="absolute top-1/3 right-10 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl -z-10 pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            
            {/* Left Copy Column */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs sm:text-sm font-semibold tracking-wide">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>La alternativa moderna a los gastos médicos tradicionales</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-[1.12]">
                Tu salud protegida en los mejores hospitales, <br className="hidden sm:inline" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">
                  sin deducibles ni sorpresas.
                </span>
              </h1>

              <p className="text-lg sm:text-xl text-slate-300 max-w-2xl font-normal leading-relaxed">
                Acceso hospitalario privado de primer nivel, cirugías, urgencias médicas y telemedicina 24/7. 
                <strong> $0 Deducible</strong> y <strong>0% Coaseguro</strong> dentro de la red más prestigiosa de México.
              </p>

              {/* Highlights Checkmarks */}
              <div className="grid sm:grid-cols-2 gap-3 pt-2 text-sm text-slate-200 text-left">
                <div className="flex items-center gap-2.5 bg-white/[0.04] p-2.5 rounded-xl border border-white/5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span><strong>$0 Deducible</strong> desde el primer peso en red</span>
                </div>
                <div className="flex items-center gap-2.5 bg-white/[0.04] p-2.5 rounded-xl border border-white/5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span><strong>+650 Hospitales</strong> privados en todo México</span>
                </div>
                <div className="flex items-center gap-2.5 bg-white/[0.04] p-2.5 rounded-xl border border-white/5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span><strong>Pago Directo</strong>: Cero trámites de reembolso</span>
                </div>
                <div className="flex items-center gap-2.5 bg-white/[0.04] p-2.5 rounded-xl border border-white/5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span><strong>Telemedicina 24/7</strong> y check-up anual gratis</span>
                </div>
              </div>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row items-center gap-4 pt-4 justify-center lg:justify-start">
                <button
                  onClick={() => scrollToForm()}
                  className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold text-base shadow-xl shadow-emerald-500/30 flex items-center justify-center gap-2 transition-all transform hover:-translate-y-0.5"
                >
                  <Sparkles className="w-5 h-5" />
                  Solicitar Cotización Personalizada
                </button>
                <a
                  href="#comparativa"
                  className="w-full sm:w-auto px-6 py-4 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 font-semibold text-base border border-white/10 flex items-center justify-center gap-2 transition-colors"
                >
                  Ver Comparativa vs SGMM <ArrowRight className="w-4 h-4" />
                </a>
              </div>

              {/* Trust Badges */}
              <div className="pt-6 border-t border-white/10 flex flex-wrap items-center justify-center lg:justify-start gap-6 text-xs text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-emerald-400" /> +45,000 Miembros Activos
                </span>
                <span className="flex items-center gap-1.5">
                  <Hospital className="w-4 h-4 text-teal-400" /> Ángeles, Star Médica, Médica Sur
                </span>
                <span className="flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-cyan-400" /> App Móvil iOS & Android
                </span>
              </div>
            </div>

            {/* Right Card Column: Lead Capture Box */}
            <div className="lg:col-span-5" ref={formRef}>
              <div className="relative rounded-3xl bg-gradient-to-b from-slate-800/90 to-slate-900/95 border border-emerald-500/30 p-6 sm:p-8 shadow-2xl shadow-emerald-950/50 backdrop-blur-2xl">
                <div className="absolute -top-3.5 right-6 px-3.5 py-1 rounded-full bg-emerald-500 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-md">
                  Cotización Inmediata
                </div>

                <div className="space-y-2 mb-6">
                  <h3 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                    <Activity className="w-6 h-6 text-emerald-400" />
                    Calcula tu Membresía
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300">
                    Déjanos tus datos para enviarte el desglose de cobertura y cotización a la medida sin compromiso.
                  </p>
                </div>

                {leadSubmitted ? (
                  <div className="py-8 text-center space-y-4 bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-6">
                    <div className="w-14 h-14 mx-auto bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center">
                      <Check className="w-8 h-8" />
                    </div>
                    <h4 className="text-xl font-bold text-white">¡Solicitud Recibida!</h4>
                    <p className="text-sm text-slate-300">
                      Un asesor especialista de salud se pondrá en contacto contigo a la brevedad para brindarte tu propuesta detallada y opciones para tu ciudad.
                    </p>
                    <button
                      onClick={() => setLeadSubmitted(false)}
                      className="px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs font-semibold hover:bg-emerald-500/30 transition-colors"
                    >
                      Enviar otra consulta
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleLeadSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Nombre Completo *
                      </label>
                      <input
                        type="text"
                        required
                        value={leadName}
                        onChange={(e) => setLeadName(e.target.value)}
                        placeholder="Ej. Carlos Mendoza"
                        className="w-full px-4 py-3 rounded-xl bg-slate-950/60 border border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-white placeholder-slate-500 text-sm outline-none transition-all"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                          Celular / WhatsApp *
                        </label>
                        <input
                          type="tel"
                          required
                          value={leadPhone}
                          onChange={(e) => setLeadPhone(e.target.value)}
                          placeholder="10 dígitos"
                          className="w-full px-4 py-3 rounded-xl bg-slate-950/60 border border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-white placeholder-slate-500 text-sm outline-none transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                          Correo Electrónico
                        </label>
                        <input
                          type="email"
                          value={leadEmail}
                          onChange={(e) => setLeadEmail(e.target.value)}
                          placeholder="tu@correo.com"
                          className="w-full px-4 py-3 rounded-xl bg-slate-950/60 border border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-white placeholder-slate-500 text-sm outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                          Ciudad / Estado
                        </label>
                        <select
                          value={leadCity}
                          onChange={(e) => setLeadCity(e.target.value)}
                          className="w-full px-3.5 py-3 rounded-xl bg-slate-950/60 border border-slate-700 focus:border-emerald-500 text-white text-sm outline-none"
                        >
                          <option value="CDMX">CDMX / Edo. Méx</option>
                          <option value="Guadalajara">Guadalajara / Jal.</option>
                          <option value="Monterrey">Monterrey / N.L.</option>
                          <option value="Querétaro">Querétaro</option>
                          <option value="Puebla">Puebla</option>
                          <option value="Mérida">Mérida</option>
                          <option value="Tijuana">Tijuana</option>
                          <option value="Otra">Otra Ciudad</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                          Plan de Interés
                        </label>
                        <select
                          value={leadPlanInterest}
                          onChange={(e) => setLeadPlanInterest(e.target.value)}
                          className="w-full px-3.5 py-3 rounded-xl bg-slate-950/60 border border-slate-700 focus:border-emerald-500 text-white text-sm outline-none"
                        >
                          <option value="Mutuus Total Plus">Mutuus Total Plus (Recomendado)</option>
                          <option value="Mutuus Esencial">Mutuus Esencial</option>
                          <option value="Mutuus Familiar">Plan Familiar</option>
                          <option value="Mutuus Corporativo">Plan para Empresas</option>
                        </select>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={leadLoading}
                      className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold text-sm sm:text-base shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 mt-2"
                    >
                      {leadLoading ? (
                        <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <Send className="w-4 h-4" /> Recibir Propuesta de Salud
                        </>
                      )}
                    </button>

                    <p className="text-[11px] text-slate-400 text-center leading-tight pt-1">
                      🔒 Tus datos están protegidos bajo estricta confidencialidad. Sin spam telefónico molesto.
                    </p>
                  </form>
                )}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── LOGOS CAROUSEL / NETWORK BANNER ── */}
      <section className="py-8 bg-slate-950/60 border-y border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs uppercase font-bold text-slate-400 tracking-widest mb-6">
            Red Médica y Hospitales en Convenio Nacional
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-14 opacity-75 grayscale hover:grayscale-0 transition-all duration-300">
            <span className="font-extrabold text-lg sm:text-xl text-slate-300 tracking-wide flex items-center gap-1.5">
              <Hospital className="w-5 h-5 text-emerald-400" /> HOSPITAL ÁNGELES
            </span>
            <span className="font-extrabold text-lg sm:text-xl text-slate-300 tracking-wide flex items-center gap-1.5">
              <Hospital className="w-5 h-5 text-teal-400" /> MÉDICA SUR
            </span>
            <span className="font-extrabold text-lg sm:text-xl text-slate-300 tracking-wide flex items-center gap-1.5">
              <Hospital className="w-5 h-5 text-cyan-400" /> STAR MÉDICA
            </span>
            <span className="font-extrabold text-lg sm:text-xl text-slate-300 tracking-wide flex items-center gap-1.5">
              <Hospital className="w-5 h-5 text-emerald-400" /> CHRISTUS MUGUERZA
            </span>
            <span className="font-extrabold text-lg sm:text-xl text-slate-300 tracking-wide flex items-center gap-1.5">
              <Hospital className="w-5 h-5 text-teal-400" /> PUERTA DE HIERRO
            </span>
            <span className="font-extrabold text-lg sm:text-xl text-slate-300 tracking-wide flex items-center gap-1.5">
              <Hospital className="w-5 h-5 text-cyan-400" /> HOSPITAL ESPAÑOL
            </span>
          </div>
        </div>
      </section>

      {/* ── SECTION: MUTUUS VS SGMM TRADICIONAL ── */}
      <section id="comparativa" className="py-20 lg:py-28 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-bold tracking-wide uppercase">
              <Sliders className="w-3.5 h-3.5" /> Comparativa Real
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              ¿Por qué Mutuus es la evolución de los Gastos Médicos?
            </h2>
            <p className="text-slate-300 text-base sm:text-lg">
              Los seguros tradicionales te cobran primas elevadas y, cuando los necesitas, debes desembolsar miles de pesos en deducibles y coaseguros. Conoce la diferencia.
            </p>
          </div>

          <div className="overflow-x-auto pb-4">
            <table className="w-full text-left border-collapse min-w-[640px]">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="py-4 px-6 text-sm font-bold text-slate-400 uppercase tracking-wider w-1/3">
                    Concepto
                  </th>
                  <th className="py-4 px-6 text-base font-extrabold text-emerald-400 bg-emerald-950/40 rounded-t-2xl border-t border-x border-emerald-500/30 w-1/3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Sparkles className="w-5 h-5" /> Membresía Mutuus
                    </div>
                  </th>
                  <th className="py-4 px-6 text-sm font-bold text-slate-400 uppercase tracking-wider w-1/3 text-center">
                    Seguro Tradicional (SGMM)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-sm sm:text-base">
                <tr>
                  <td className="py-5 px-6 font-semibold text-white flex items-center gap-2">
                    <Percent className="w-4 h-4 text-emerald-400 shrink-0" />
                    Deducible Inicial por Evento
                  </td>
                  <td className="py-5 px-6 font-extrabold text-emerald-300 bg-emerald-950/40 border-x border-emerald-500/30 text-center">
                    $0 MXN en Red
                    <div className="text-xs font-normal text-emerald-400/80">Sin pago previo para atenderte</div>
                  </td>
                  <td className="py-5 px-6 text-slate-400 text-center">
                    $25,000 a $60,000+ MXN
                    <div className="text-xs text-rose-400/80">Debes pagarlo de tu bolsillo primero</div>
                  </td>
                </tr>

                <tr>
                  <td className="py-5 px-6 font-semibold text-white flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />
                    Coaseguro sobre la cuenta total
                  </td>
                  <td className="py-5 px-6 font-extrabold text-emerald-300 bg-emerald-950/40 border-x border-emerald-500/30 text-center">
                    0% de Coaseguro
                    <div className="text-xs font-normal text-emerald-400/80">Cero porcentaje retenido</div>
                  </td>
                  <td className="py-5 px-6 text-slate-400 text-center">
                    10% al 20%
                    <div className="text-xs text-rose-400/80">Hasta $50,000 - $80,000 MXN extra</div>
                  </td>
                </tr>

                <tr>
                  <td className="py-5 px-6 font-semibold text-white flex items-center gap-2">
                    <Zap className="w-4 h-4 text-emerald-400 shrink-0" />
                    Forma de Pago a Hospitales
                  </td>
                  <td className="py-5 px-6 font-extrabold text-emerald-300 bg-emerald-950/40 border-x border-emerald-500/30 text-center">
                    Pago Directo Inmediato
                    <div className="text-xs font-normal text-emerald-400/80">Pase médico digital desde la App</div>
                  </td>
                  <td className="py-5 px-6 text-slate-400 text-center">
                    Reembolso o Pago Lento
                    <div className="text-xs text-slate-500">Semanas de dictámenes y formatos</div>
                  </td>
                </tr>

                <tr>
                  <td className="py-5 px-6 font-semibold text-white flex items-center gap-2">
                    <Stethoscope className="w-4 h-4 text-emerald-400 shrink-0" />
                    Consultas de Telemedicina 24/7
                  </td>
                  <td className="py-5 px-6 font-extrabold text-emerald-300 bg-emerald-950/40 border-x border-emerald-500/30 text-center">
                    Ilimitadas y Gratuitas
                    <div className="text-xs font-normal text-emerald-400/80">Médicos generales y especialistas</div>
                  </td>
                  <td className="py-5 px-6 text-slate-400 text-center">
                    No incluidas o muy limitadas
                    <div className="text-xs text-slate-500">Generalmente sujetas a costo extra</div>
                  </td>
                </tr>

                <tr>
                  <td className="py-5 px-6 font-semibold text-white flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-400 shrink-0" />
                    Salud Preventiva (Check-up Anual)
                  </td>
                  <td className="py-5 px-6 font-extrabold text-emerald-300 bg-emerald-950/40 border-x border-emerald-500/30 text-center rounded-b-2xl border-b">
                    Incluido Anualmente
                    <div className="text-xs font-normal text-emerald-400/80">Estudios clínicos de laboratorio</div>
                  </td>
                  <td className="py-5 px-6 text-slate-400 text-center">
                    No cubre prevención
                    <div className="text-xs text-slate-500">Solo entra cuando ya hay siniestro grave</div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── SECTION: 6 PILARES DE COBERTURA ── */}
      <section id="beneficios" className="py-20 bg-slate-950/40 border-t border-white/5 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">
              Cobertura Integral
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
              Todo lo que necesitas para cuidar de ti y tu familia
            </h2>
            <p className="text-slate-300">
              Diseñado para protegerte tanto en las emergencias mayores como en la atención médica cotidiana.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {/* Card 1 */}
            <div className="p-7 rounded-3xl bg-slate-900/80 border border-white/10 hover:border-emerald-500/40 transition-all group hover:-translate-y-1">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <Hospital className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Hospitalización y Cirugías</h3>
              <p className="text-slate-300 text-sm leading-relaxed">
                Habitación privada estándar, quirófanos, terapia intensiva, honorarios médicos y medicamentos intrahospitalarios cubiertos con pago directo.
              </p>
            </div>

            {/* Card 2 */}
            <div className="p-7 rounded-3xl bg-slate-900/80 border border-white/10 hover:border-teal-500/40 transition-all group hover:-translate-y-1">
              <div className="w-12 h-12 rounded-2xl bg-teal-500/15 border border-teal-500/30 text-teal-400 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">$0 Deducible en Red</h3>
              <p className="text-slate-300 text-sm leading-relaxed">
                Olvídate de desembolsar $30,000 o $50,000 pesos de tu cuenta bancaria. Al ingresar a un hospital en convenio, tu cobertura aplica desde el primer peso.
              </p>
            </div>

            {/* Card 3 */}
            <div className="p-7 rounded-3xl bg-slate-900/80 border border-white/10 hover:border-cyan-500/40 transition-all group hover:-translate-y-1">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <Smartphone className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Telemedicina Ilimitada 24/7</h3>
              <p className="text-slate-300 text-sm leading-relaxed">
                Consultas médicas generales y pediátricas en menos de 5 minutos por videollamada desde tu celular, además de orientación psicológica y nutricional.
              </p>
            </div>

            {/* Card 4 */}
            <div className="p-7 rounded-3xl bg-slate-900/80 border border-white/10 hover:border-emerald-500/40 transition-all group hover:-translate-y-1">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <Activity className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Check-up Preventivo Anual</h3>
              <p className="text-slate-300 text-sm leading-relaxed">
                Laboratorios clínicos preventivos anuales (química sanguínea, biometría hemática, examen general de orina) incluidos para detección oportuna.
              </p>
            </div>

            {/* Card 5 */}
            <div className="p-7 rounded-3xl bg-slate-900/80 border border-white/10 hover:border-teal-500/40 transition-all group hover:-translate-y-1">
              <div className="w-12 h-12 rounded-2xl bg-teal-500/15 border border-teal-500/30 text-teal-400 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <Smile className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Asistencia Dental y Visión</h3>
              <p className="text-slate-300 text-sm leading-relaxed">
                2 limpiezas dentales al año sin costo, consultas odontológicas con tarifas preferenciales, examen de la vista gratuito y descuentos en armazones.
              </p>
            </div>

            {/* Card 6 */}
            <div className="p-7 rounded-3xl bg-slate-900/80 border border-white/10 hover:border-cyan-500/40 transition-all group hover:-translate-y-1">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <Globe className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Asistencia en Viajes</h3>
              <p className="text-slate-300 text-sm leading-relaxed">
                Protección médica ante accidentes o emergencias imprevistas mientras viajas por toda la República Mexicana y cobertura de asistencia internacional.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION: INTERACTIVE CALCULATOR / ESTIMATOR ── */}
      <section id="calculadora" className="py-20 lg:py-28 relative">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-emerald-500/30 p-8 sm:p-12 shadow-2xl">
            <div className="text-center max-w-2xl mx-auto mb-10 space-y-2">
              <span className="text-xs uppercase font-extrabold tracking-widest text-emerald-400">
                Simulador Interactivo
              </span>
              <h2 className="text-2xl sm:text-4xl font-extrabold text-white">
                Calcula tu inversión y ahorro estimado
              </h2>
              <p className="text-slate-300 text-sm sm:text-base">
                Selecciona tu rango de edad y plan para simular tu cuota mensual.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 items-center">
              {/* Controls */}
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                    1. Rango de Edad del Titular
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {['18-29', '30-39', '40-49', '50-59', '60-64'].map((age) => (
                      <button
                        key={age}
                        type="button"
                        onClick={() => setCalcAgeGroup(age)}
                        className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold border transition-all ${
                          calcAgeGroup === age
                            ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-lg shadow-emerald-500/20'
                            : 'bg-slate-950/50 text-slate-300 border-slate-700 hover:border-slate-500'
                        }`}
                      >
                        {age} años
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                    2. Plan de Membresía
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setCalcPlan('esencial')}
                      className={`p-3.5 rounded-xl text-left border transition-all ${
                        calcPlan === 'esencial'
                          ? 'bg-emerald-500/15 border-emerald-400 text-white'
                          : 'bg-slate-950/50 border-slate-700 text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      <div className="font-bold text-sm">Mutuus Esencial</div>
                      <div className="text-[11px] text-slate-400">Urgencias + Telemedicina</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCalcPlan('total')}
                      className={`p-3.5 rounded-xl text-left border transition-all ${
                        calcPlan === 'total'
                          ? 'bg-emerald-500/15 border-emerald-400 text-white'
                          : 'bg-slate-950/50 border-slate-700 text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      <div className="font-bold text-sm flex items-center justify-between">
                        Total Plus <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                      </div>
                      <div className="text-[11px] text-slate-400">Hospitalización + Cirugías</div>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                    3. Número de Integrantes a Proteger ({calcMembers})
                  </label>
                  <div className="flex items-center gap-3">
                    {[1, 2, 3, 4, 5].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setCalcMembers(num)}
                        className={`w-11 h-11 rounded-xl text-sm font-bold border transition-all ${
                          calcMembers === num
                            ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                            : 'bg-slate-950/50 text-slate-300 border-slate-700 hover:border-slate-500'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Live Result Box */}
              <div className="p-7 rounded-2xl bg-slate-950/80 border border-emerald-500/40 space-y-6 text-center">
                <div>
                  <span className="text-xs uppercase font-bold text-slate-400 tracking-wider">
                    Inversión Mensual Estimada
                  </span>
                  <div className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300 mt-1">
                    ${calculatedQuote.totalMonthly.toLocaleString('es-MX')}{' '}
                    <span className="text-sm font-medium text-slate-400">MXN / mes</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    o ${calculatedQuote.totalAnnual.toLocaleString('es-MX')} MXN anual con descuento
                  </div>
                </div>

                <div className="py-4 px-5 rounded-xl bg-emerald-950/50 border border-emerald-500/30 text-left space-y-2">
                  <div className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Ahorro directo frente a SGMM:
                  </div>
                  <p className="text-xs text-slate-300">
                    Ahorras aprox. <strong>${calculatedQuote.estimatedSavingsAnnual.toLocaleString('es-MX')} MXN</strong> al año al evitar deducibles de $30k+ y 10% de coaseguro en caso de evento médico.
                  </p>
                </div>

                <button
                  onClick={() => scrollToForm(calcPlan === 'total' ? 'Mutuus Total Plus' : 'Mutuus Esencial')}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold text-sm shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 transition-all"
                >
                  Confirmar Esta Cotización <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION: PLANES Y TARIFAS ── */}
      <section id="planes" className="py-20 lg:py-28 bg-slate-950/60 border-t border-white/5 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12 space-y-3">
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">
              Planes Transparentes
            </span>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white">
              Elige el nivel de protección ideal
            </h2>
            <p className="text-slate-300 text-base sm:text-lg">
              Sin letras chiquitas ni cláusulas ocultas. Precios claros para personas, familias y empresas.
            </p>

            {/* Billing Toggle */}
            <div className="pt-4 flex items-center justify-center gap-3">
              <span className={`text-sm font-semibold ${billingCycle === 'monthly' ? 'text-white' : 'text-slate-400'}`}>
                Pago Mensual
              </span>
              <button
                type="button"
                onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'annual' : 'monthly')}
                className="w-14 h-8 rounded-full bg-slate-800 border border-slate-700 p-1 flex items-center transition-colors relative"
              >
                <div
                  className={`w-6 h-6 rounded-full bg-emerald-500 transition-transform ${
                    billingCycle === 'annual' ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
              <span className={`text-sm font-semibold flex items-center gap-1.5 ${billingCycle === 'annual' ? 'text-white' : 'text-slate-400'}`}>
                Pago Anual <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">Ahorra 10%</span>
              </span>
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 items-stretch">
            {PLANS.map((plan) => {
              const priceDisplay =
                typeof plan.monthlyPrice === 'number'
                  ? billingCycle === 'monthly'
                    ? `$${plan.monthlyPrice.toLocaleString('es-MX')}`
                    : `$${Math.round(plan.annualPrice / 12).toLocaleString('es-MX')}`
                  : plan.monthlyPrice;

              return (
                <div
                  key={plan.id}
                  className={`rounded-3xl p-7 flex flex-col justify-between transition-all duration-300 relative ${
                    plan.popular
                      ? 'bg-gradient-to-b from-slate-800/95 via-slate-900 to-slate-950 border-2 border-emerald-500 shadow-2xl shadow-emerald-950/60 lg:-translate-y-2'
                      : 'bg-slate-900/60 border border-white/10 hover:border-white/20'
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-emerald-500 text-slate-950 font-extrabold text-xs uppercase tracking-wider shadow-md">
                      Más Elegido en México
                    </div>
                  )}

                  <div>
                    <h3 className="text-xl font-extrabold text-white mb-1">{plan.name}</h3>
                    <p className="text-xs text-slate-400 min-h-[36px] mb-4">{plan.tagline}</p>

                    <div className="py-4 border-y border-white/10 mb-5">
                      <div className="text-3xl sm:text-4xl font-extrabold text-white">
                        {priceDisplay}
                        {typeof plan.monthlyPrice === 'number' && (
                          <span className="text-xs font-normal text-slate-400 ml-1">MXN / mes</span>
                        )}
                      </div>
                      <div className="text-[11px] text-emerald-400 font-semibold mt-1">
                        Deducible: {plan.deductible} | Coaseguro: {plan.coaseguro}
                      </div>
                    </div>

                    <div className="space-y-3 text-xs sm:text-sm text-slate-300 mb-6">
                      <p className="font-bold text-white text-xs uppercase tracking-wider">Incluye:</p>
                      {plan.features.map((feat, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-white/5">
                    <button
                      onClick={() => scrollToForm(plan.name)}
                      className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-1.5 ${
                        plan.popular
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-lg shadow-emerald-500/25'
                          : 'bg-white/10 hover:bg-white/20 text-white'
                      }`}
                    >
                      {plan.ctaText} <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── SECTION: RED HOSPITALARIA Y MAPA ── */}
      <section id="hospitales" className="py-20 lg:py-28 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12 space-y-3">
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-400 flex items-center justify-center gap-1.5">
              <MapPin className="w-4 h-4" /> Cobertura Geo Nacional
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
              Más de 650 Hospitales Privados en México
            </h2>
            <p className="text-slate-300">
              Filtra por tu estado o ciudad para conocer los centros médicos de alta especialidad en convenio.
            </p>

            {/* City Tabs */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-4">
              {HOSPITAL_CITIES.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCity(c.id)}
                  className={`px-4 py-2 rounded-full text-xs font-bold transition-all border ${
                    selectedCity === c.id
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-500/20'
                      : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-500'
                  }`}
                >
                  {c.name} <span className="opacity-75 font-normal">({c.count})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Hospital Cards Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredHospitals.map((h, i) => (
              <div
                key={i}
                className="p-6 rounded-2xl bg-slate-900/80 border border-white/10 hover:border-emerald-500/40 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      <Hospital className="w-5 h-5" />
                    </div>
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                      {h.badge}
                    </span>
                  </div>

                  <h4 className="text-lg font-bold text-white mb-1">{h.name}</h4>
                  <p className="text-xs text-emerald-400/90 font-medium mb-3 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 shrink-0" /> {h.locations}
                  </p>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    <strong>Servicios:</strong> {h.coverage}
                  </p>
                </div>

                <div className="pt-4 mt-4 border-t border-white/5 flex items-center justify-between text-xs text-slate-400">
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Pago Directo
                  </span>
                  <span>$0 Deducible</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION: PROCESO EN CASO DE ATENCIÓN (PASO A PASO) ── */}
      <section className="py-20 bg-slate-950/70 border-t border-white/5 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">
              Atención Sin Fricción
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
              ¿Cómo funciona si tienes una urgencia médica?
            </h2>
            <p className="text-slate-300">
              Diseñamos un flujo 100% digital y sin burocracia para que tu única preocupación sea recuperarte.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            <div className="p-8 rounded-3xl bg-slate-900 border border-white/10 relative">
              <div className="text-5xl font-black text-emerald-500/20 mb-4">01</div>
              <h3 className="text-xl font-bold text-white mb-2">Abre tu App o Llama 24/7</h3>
              <p className="text-slate-300 text-sm leading-relaxed">
                Presiona el botón de auxilio médico en tu celular o contacta a la cabina de concierge médico activo las 24 horas del día.
              </p>
            </div>

            <div className="p-8 rounded-3xl bg-slate-900 border border-white/10 relative">
              <div className="text-5xl font-black text-teal-500/20 mb-4">02</div>
              <h3 className="text-xl font-bold text-white mb-2">Pase Médico Digital</h3>
              <p className="text-slate-300 text-sm leading-relaxed">
                Te asignamos el hospital en red más cercano y emitimos tu pase de admisión hospitalaria de forma inmediata sin trámites en papel.
              </p>
            </div>

            <div className="p-8 rounded-3xl bg-slate-900 border border-white/10 relative">
              <div className="text-5xl font-black text-cyan-500/20 mb-4">03</div>
              <h3 className="text-xl font-bold text-white mb-2">Pago Directo Liquidado</h3>
              <p className="text-slate-300 text-sm leading-relaxed">
                El hospital y los honorarios médicos se pagan de forma directa. Sales del hospital sin desembolsar deducibles ni pelear reembolsos.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION: FAQS ACCORDION ── */}
      <section id="faqs" className="py-20 lg:py-28 relative">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-3 mb-12">
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-400 flex items-center justify-center gap-1.5">
              <HelpCircle className="w-4 h-4" /> Claridad Absoluta
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
              Preguntas Frecuentes
            </h2>
            <p className="text-slate-300 text-sm sm:text-base">
              Resolvemos tus dudas sobre cómo opera la membresía de salud en México.
            </p>

            {/* FAQ Search */}
            <div className="pt-4 max-w-md mx-auto relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar duda (ej. deducible, hospitales, edades)..."
                value={faqSearch}
                onChange={(e) => setFaqSearch(e.target.value)}
                className="w-full pl-11 pr-4 py-3 rounded-full bg-slate-900 border border-slate-700 focus:border-emerald-500 text-sm text-white placeholder-slate-500 outline-none"
              />
            </div>
          </div>

          <div className="space-y-3">
            {filteredFaqs.map((faq, index) => {
              const isOpen = openFaq === index;
              return (
                <div
                  key={index}
                  className="rounded-2xl bg-slate-900/80 border border-white/10 overflow-hidden transition-all"
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    className="w-full p-5 sm:p-6 text-left flex items-center justify-between gap-4 text-white font-bold text-base sm:text-lg hover:text-emerald-300 transition-colors"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      className={`w-5 h-5 text-emerald-400 shrink-0 transition-transform duration-300 ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-5 sm:px-6 pb-6 text-slate-300 text-sm sm:text-base leading-relaxed border-t border-white/5 pt-4">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA BANNER ── */}
      <section className="py-16 bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 border-t border-emerald-500/30 relative">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            ¿Listo para proteger tu salud sin deducibles?
          </h2>
          <p className="text-slate-300 text-base sm:text-lg max-w-2xl mx-auto">
            Cotiza hoy mismo tu membresía médica Mutuus. Planes a la medida para personas individuales, familias y empresas.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <button
              onClick={() => scrollToForm()}
              className="w-full sm:w-auto px-8 py-4 rounded-full bg-gradient-to-r from-emerald-400 to-teal-400 text-slate-950 font-extrabold text-base shadow-xl shadow-emerald-500/30 flex items-center justify-center gap-2 hover:brightness-110 transition-all transform hover:-translate-y-0.5"
            >
              <Sparkles className="w-5 h-5" /> Comenzar Mi Cotización Gratis
            </button>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="py-12 bg-slate-950 border-t border-white/5 text-slate-400 text-xs sm:text-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-slate-950">
                <HeartPulse className="w-5 h-5" />
              </div>
              <span className="text-lg font-bold text-white">
                mutuus<span className="text-emerald-400">.</span>
              </span>
              <span className="text-slate-400 text-xs">Membresía Médica Privada</span>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-xs text-slate-300">
              <a href="#beneficios" className="hover:text-emerald-400 transition-colors">Beneficios</a>
              <a href="#comparativa" className="hover:text-emerald-400 transition-colors">Comparativa</a>
              <a href="#planes" className="hover:text-emerald-400 transition-colors">Planes</a>
              <a href="#hospitales" className="hover:text-emerald-400 transition-colors">Hospitales</a>
              <a href="#faqs" className="hover:text-emerald-400 transition-colors">FAQ</a>
            </div>
          </div>

          <div className="pt-6 border-t border-white/5 text-center text-slate-500 text-xs space-y-2">
            <p>
              © {new Date().getFullYear()} Mutuus Salud Inteligente. Todos los derechos reservados.
            </p>
            <p className="max-w-3xl mx-auto text-[11px] leading-relaxed">
              Aviso: La información presentada en este portal es de carácter informativo sobre los servicios y planes de salud médica privada en convenio. Las coberturas, alcances y periodos de espera se rigen bajo los términos del contrato de membresía.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
