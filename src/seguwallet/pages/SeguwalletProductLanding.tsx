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
  FolderOpen
} from 'lucide-react';

// ─── ASSETS & CONSTANTS ──────────────────────────────────────────────────────
const SEGUWALLET_LOGO = '/seguwallet-logo.png';
const LOGO_JIRO = '/logojiro.png';
const MOVI_LOGO = '/movirecurso_2.png';

const HOST = typeof window !== 'undefined' ? window.location.hostname : '';
const isSeguwalletDomain = HOST === 'seguwallet.mx' || HOST.endsWith('.seguwallet.mx');
const LOGIN_PATH = isSeguwalletDomain ? '/login' : '/seguwallet/login';

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

const FAQS = [
  {
    q: '¿Qué es Seguwallet y para qué sirve?',
    a: 'Seguwallet es la cartera digital inteligente para asegurados. Te permite reunir, consultar y gestionar todas tus pólizas de seguros (autos, gastos médicos, vida, hogar y empresas) en un solo lugar seguro, descargar pólizas y recibos en PDF, reportar siniestros con marcación directa y resolver dudas 24/7 con Chava IA.'
  },
  {
    q: '¿Tiene algún costo para mí como cliente?',
    a: 'No. Seguwallet es un servicio 100% gratuito proporcionado por tu asesor de seguros de confianza y la Red Nacional de Grupo JIRO para ofrecerte la mejor experiencia y acceso inmediato a tu protección patrimonial.'
  },
  {
    q: '¿Cómo inicio sesión si no tengo una contraseña?',
    a: 'Seguwallet utiliza tecnología de acceso sin contraseñas (Passwordless). Solo necesitas ingresar el correo electrónico o número de WhatsApp registrado en tu póliza. Recibirás un código seguro de 6 dígitos que te dará acceso inmediato en segundos.'
  },
  {
    q: '¿Puedo tener pólizas de diferentes aseguradoras en la misma cuenta?',
    a: '¡Sí! Esa es una de las grandes ventajas de Seguwallet. Puedes tener una póliza de auto con Quálitas, tu seguro de gastos médicos con GNP y tu seguro de vida con Allianz o Seguros Monterrey; todas estarán sincronizadas y organizadas cronológicamente en tu misma cartera.'
  },
  {
    q: '¿Cómo reporto un siniestro o solicito asistencia en caso de emergencia?',
    a: 'Dentro de Seguwallet cuentas con el botón directo de "Reportar Siniestro" y "Directorio de Aseguradoras". Con un solo toque accedes al número telefónico de emergencia 800 de tu aseguradora con tu número de póliza e inciso listos en pantalla para brindárselos al operador.'
  },
  {
    q: '¿Cómo puedo instalar Seguwallet en mi celular?',
    a: 'Seguwallet funciona como una Progressive Web App (PWA) de última generación. Puedes abrirla en Safari (iPhone) o Chrome (Android) y seleccionar "Agregar a la pantalla de inicio" para tenerla como una app nativa, rápida y sin ocupar almacenamiento en tu teléfono.'
  }
];

export default function SeguwalletProductLanding() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'polizas' | 'chava' | 'siniestros' | 'descargas'>('polizas');
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [showPwaModal, setShowPwaModal] = useState(false);
  const [pwaPlatform, setPwaPlatform] = useState<'ios' | 'android'>('ios');

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

  const openPwaGuide = (platform: 'ios' | 'android') => {
    setPwaPlatform(platform);
    setShowPwaModal(true);
  };

  return (
    <>
      <Helmet>
        <title>Seguwallet | Tu Cartera Digital de Seguros</title>
        <meta
          name="description"
          content="Consulta tus pólizas, vigencias, recibos y asistencias al instante. Reporta siniestros con un clic y resuelve dudas 24/7 con Chava IA. La wallet de seguros inteligente."
        />
        <meta
          name="keywords"
          content="Seguwallet, cartera digital de seguros, app de seguros, consultar póliza, recibos de seguros, Chava IA, Grupo JIRO, MOVI Digital, asistencia en siniestros, seguros México"
        />
        <link rel="canonical" href="https://seguwallet.mx/" />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Seguwallet | Tu Cartera Digital de Seguros" />
        <meta
          property="og:description"
          content="Todas tus pólizas en un solo lugar. Consulta vigencias, descarga documentos y reporta siniestros en segundos."
        />
        <meta property="og:url" content="https://seguwallet.mx/" />
        <meta property="og:image" content="https://seguwallet.mx/seguwallet-logo.png" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Seguwallet | Tu Cartera Digital de Seguros" />
        <meta
          name="twitter:description"
          content="Tu cartera digital de seguros. Accede sin contraseñas con OTP por WhatsApp y correo."
        />

        {/* Schema.org */}
        <script type="application/ld+json">
          {JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'Seguwallet',
            applicationCategory: 'FinanceApplication',
            operatingSystem: 'iOS, Android, Web',
            offers: {
              '@type': 'Offer',
              price: '0',
              priceCurrency: 'MXN'
            },
            description:
              'Plataforma y cartera digital para asegurados con gestión de pólizas, centro de descargas, reporte de siniestros e inteligencia artificial.',
            url: 'https://seguwallet.mx',
            publisher: {
              '@type': 'Organization',
              name: 'Grupo JIRO / MOVI Digital'
            }
          })}
        </script>
      </Helmet>

      <div className="min-h-screen bg-[#040C1F] text-white selection:bg-[#1C37E0] selection:text-white font-sans antialiased">

        {/* ─── 1. NAVBAR SUPERIOR FIJO ─────────────────────────────────────── */}
        <header
          className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
          style={{
            background: 'rgba(4, 12, 31, 0.90)',
            backdropFilter: 'blur(20px)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
          }}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16 sm:h-20">
              
              {/* Logo Seguwallet */}
              <a href="#inicio" onClick={(e) => { e.preventDefault(); scrollTo('inicio'); }} className="flex items-center gap-3 group">
                <img
                  src={SEGUWALLET_LOGO}
                  alt="Seguwallet"
                  className="h-9 sm:h-11 w-auto object-contain transition-transform group-hover:scale-105"
                />
              </a>

              {/* Desktop Menu */}
              <nav className="hidden lg:flex items-center gap-7">
                <button
                  onClick={() => scrollTo('beneficios')}
                  className="text-sm font-medium text-white/70 hover:text-white transition-colors cursor-pointer"
                >
                  Características
                </button>
                <button
                  onClick={() => scrollTo('como-funciona')}
                  className="text-sm font-medium text-white/70 hover:text-white transition-colors cursor-pointer"
                >
                  ¿Cómo funciona?
                </button>
                <button
                  onClick={() => scrollTo('experiencia')}
                  className="text-sm font-medium text-white/70 hover:text-white transition-colors cursor-pointer"
                >
                  Experiencia App
                </button>
                <button
                  onClick={() => scrollTo('aseguradoras')}
                  className="text-sm font-medium text-white/70 hover:text-white transition-colors cursor-pointer"
                >
                  Aseguradoras
                </button>
                <button
                  onClick={() => scrollTo('descargas')}
                  className="text-sm font-medium text-white/70 hover:text-white transition-colors cursor-pointer"
                >
                  Descargar
                </button>
                <button
                  onClick={() => scrollTo('faq')}
                  className="text-sm font-medium text-white/70 hover:text-white transition-colors cursor-pointer"
                >
                  Preguntas Frecuentes
                </button>
              </nav>

              {/* Desktop CTAs */}
              <div className="hidden sm:flex items-center gap-3">
                <a
                  href={LOGIN_PATH}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white transition-all duration-200 active:scale-95 shadow-lg shadow-blue-600/30 hover:shadow-blue-600/50"
                  style={{
                    background: 'linear-gradient(135deg, #1C37E0 0%, #3B58F0 100%)'
                  }}
                >
                  <Lock className="w-4 h-4" />
                  <span>Ingresar al Portal</span>
                  <ArrowRight className="w-4 h-4 ml-0.5" />
                </a>
              </div>

              {/* Mobile menu toggle */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Abrir menú"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>

            </div>
          </div>

          {/* Mobile menu panel */}
          {mobileMenuOpen && (
            <div className="lg:hidden border-t border-white/10 bg-[#06142F]/98 px-5 py-6 space-y-4 backdrop-blur-2xl">
              <div className="space-y-2">
                {[
                  { label: 'Características', id: 'beneficios' },
                  { label: '¿Cómo funciona?', id: 'como-funciona' },
                  { label: 'Experiencia App', id: 'experiencia' },
                  { label: 'Aseguradoras', id: 'aseguradoras' },
                  { label: 'Descargar App', id: 'descargas' },
                  { label: 'Preguntas Frecuentes', id: 'faq' }
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => scrollTo(item.id)}
                    className="block w-full text-left px-4 py-3 text-base font-semibold text-white/80 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="pt-4 border-t border-white/10 space-y-3">
                <a
                  href={LOGIN_PATH}
                  className="flex items-center justify-center gap-2 w-full px-5 py-3.5 rounded-xl font-bold text-sm text-white text-center shadow-lg shadow-blue-600/30"
                  style={{ background: 'linear-gradient(135deg, #1C37E0 0%, #3B58F0 100%)' }}
                >
                  <Lock className="w-4 h-4" />
                  <span>Ingresar al Portal</span>
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            </div>
          )}
        </header>

        {/* ─── 2. HERO PRINCIPAL ───────────────────────────────────────────── */}
        <section
          id="inicio"
          className="relative min-h-[92vh] flex items-center pt-24 pb-16 lg:pt-32 lg:pb-24 overflow-hidden"
          style={{
            background: 'radial-gradient(circle at 50% 20%, #0A2260 0%, #050E24 45%, #040C1F 100%)'
          }}
        >
          {/* Subtle geometric pattern & glow orbs */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
                                linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)`,
              backgroundSize: '64px 64px'
            }}
          />
          <div
            className="absolute -top-32 right-1/4 w-[600px] h-[600px] rounded-full pointer-events-none"
            style={{
              background: 'radial-gradient(circle, #1C37E0 0%, transparent 70%)',
              opacity: 0.18,
              filter: 'blur(60px)'
            }}
          />
          <div
            className="absolute bottom-10 left-10 w-[450px] h-[450px] rounded-full pointer-events-none"
            style={{
              background: 'radial-gradient(circle, #00E5FF 0%, transparent 70%)',
              opacity: 0.08,
              filter: 'blur(50px)'
            }}
          />

          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
            <div className="grid lg:grid-cols-12 gap-12 lg:gap-8 items-center">
              
              {/* Columna Izquierda: Copy y CTAs */}
              <div className="lg:col-span-7 space-y-7 text-center lg:text-left">
                
                {/* Badge Superior */}
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.12] backdrop-blur-md">
                  <span className="w-2 h-2 rounded-full bg-[#00E5FF] animate-pulse" />
                  <span className="text-xs font-semibold text-[#00E5FF] tracking-wide uppercase">
                    La Cartera Digital de Tus Seguros
                  </span>
                </div>

                {/* Titular Principal */}
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-[1.08] tracking-tight">
                  Tus pólizas en un solo lugar.{' '}
                  <span
                    className="bg-clip-text text-transparent"
                    style={{
                      backgroundImage: 'linear-gradient(135deg, #5B78FF 0%, #00E5FF 100%)'
                    }}
                  >
                    Siempre contigo.
                  </span>
                </h1>

                {/* Subtítulo */}
                <p className="text-base sm:text-lg text-white/70 leading-relaxed max-w-2xl mx-auto lg:mx-0">
                  Consulta tus pólizas, vigencias, recibos y asistencias en cualquier momento. Reporta siniestros con un clic y resuelve dudas 24/7 con Chava IA. Acceso rápido y seguro sin contraseñas.
                </p>

                {/* Botones de Acción */}
                <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3.5 pt-2">
                  <a
                    href={LOGIN_PATH}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl font-bold text-base text-white transition-all duration-200 active:scale-95 shadow-xl shadow-blue-600/35 hover:shadow-blue-600/50"
                    style={{
                      background: 'linear-gradient(135deg, #1C37E0 0%, #3B58F0 100%)'
                    }}
                  >
                    <Lock className="w-5 h-5" />
                    <span>Ingresar a mi Wallet</span>
                    <ArrowRight className="w-5 h-5" />
                  </a>

                  <button
                    onClick={() => scrollTo('experiencia')}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-4 rounded-2xl font-semibold text-sm text-white/85 bg-white/[0.05] hover:bg-white/[0.10] border border-white/[0.12] transition-colors cursor-pointer"
                  >
                    <Smartphone className="w-4 h-4 text-[#00E5FF]" />
                    <span>Explorar Funciones</span>
                  </button>
                </div>

                {/* Badges de Confianza / Quick Stats */}
                <div className="pt-6 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-4 text-left">
                  <div className="space-y-1">
                    <p className="text-xl sm:text-2xl font-black text-white">+12</p>
                    <p className="text-xs text-white/50 leading-tight">Aseguradoras en una sola app</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xl sm:text-2xl font-black text-[#00E5FF]">100%</p>
                    <p className="text-xs text-white/50 leading-tight">Sin contraseñas (OTP seguro)</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xl sm:text-2xl font-black text-white">24/7</p>
                    <p className="text-xs text-white/50 leading-tight">Chava IA & Asistencia inmediata</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xl sm:text-2xl font-black text-emerald-400">$0</p>
                    <p className="text-xs text-white/50 leading-tight">Gratuito para clientes</p>
                  </div>
                </div>

              </div>

              {/* Columna Derecha: Mockup 3D Interactivo de la App */}
              <div className="lg:col-span-5 flex justify-center lg:justify-end">
                <div className="relative w-full max-w-[360px] sm:max-w-[390px]">
                  
                  {/* Glow detrás del teléfono */}
                  <div
                    className="absolute -inset-4 rounded-[48px] pointer-events-none"
                    style={{
                      background: 'linear-gradient(135deg, rgba(28,55,224,0.35) 0%, rgba(0,229,255,0.2) 100%)',
                      filter: 'blur(30px)'
                    }}
                  />

                  {/* Frame del Dispositivo Móvil */}
                  <div className="relative rounded-[40px] border-[6px] border-[#1C2A4D] bg-[#0A1633] shadow-2xl overflow-hidden text-neutral-900 font-sans">
                    
                    {/* Notch Superior / Dynamic Island */}
                    <div className="bg-[#0A1633] pt-3 pb-2 px-6 flex items-center justify-between text-white/60 text-[11px] font-medium border-b border-white/5">
                      <span>9:41</span>
                      <div className="w-20 h-4 bg-black rounded-full mx-auto" />
                      <div className="flex items-center gap-1.5">
                        <span className="w-3.5 h-2 border border-white/60 rounded-xs inline-block relative after:absolute after:right-0 after:top-0 after:bottom-0 after:w-2 after:bg-white/80" />
                      </div>
                    </div>

                    {/* Header interno de la App */}
                    <div className="p-4 bg-gradient-to-b from-[#0C1E4A] to-[#0A1633] border-b border-white/10 text-white flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <img src={SEGUWALLET_LOGO} alt="Seguwallet" className="h-7 w-auto object-contain" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-[11px] font-semibold text-white/80">3 Pólizas Activas</span>
                      </div>
                    </div>

                    {/* Pantalla Dinámica según tab seleccionado */}
                    <div className="p-4 space-y-3.5 bg-[#071026] text-white min-h-[460px] flex flex-col justify-between">
                      
                      {/* Tarjeta de Bienvenida */}
                      <div className="p-3.5 rounded-2xl bg-gradient-to-r from-[#1C37E0] to-[#1228B8] shadow-md space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-white/80 font-medium">Mi Cartera Digital</span>
                          <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-bold">Cliente Activo</span>
                        </div>
                        <div>
                          <p className="text-base font-extrabold text-white">Carlos Mendoza Ruiz</p>
                          <p className="text-[11px] text-white/70">Asesor: Roberto J. (Oficina CDMX)</p>
                        </div>
                      </div>

                      {/* Selector de Pestañas Interactivo dentro del Mockup */}
                      <div className="grid grid-cols-4 gap-1 p-1 bg-white/[0.05] rounded-xl border border-white/[0.08] text-[10.5px] font-bold text-center">
                        <button
                          onClick={() => setActiveTab('polizas')}
                          className={`py-1.5 rounded-lg transition-all ${
                            activeTab === 'polizas' ? 'bg-[#1C37E0] text-white shadow-xs' : 'text-white/60 hover:text-white'
                          }`}
                        >
                          Pólizas
                        </button>
                        <button
                          onClick={() => setActiveTab('chava')}
                          className={`py-1.5 rounded-lg transition-all ${
                            activeTab === 'chava' ? 'bg-[#1C37E0] text-white shadow-xs' : 'text-white/60 hover:text-white'
                          }`}
                        >
                          Chava IA
                        </button>
                        <button
                          onClick={() => setActiveTab('siniestros')}
                          className={`py-1.5 rounded-lg transition-all ${
                            activeTab === 'siniestros' ? 'bg-[#1C37E0] text-white shadow-xs' : 'text-white/60 hover:text-white'
                          }`}
                        >
                          Siniestros
                        </button>
                        <button
                          onClick={() => setActiveTab('descargas')}
                          className={`py-1.5 rounded-lg transition-all ${
                            activeTab === 'descargas' ? 'bg-[#1C37E0] text-white shadow-xs' : 'text-white/60 hover:text-white'
                          }`}
                        >
                          Bóveda
                        </button>
                      </div>

                      {/* Contenido Dinámico del Mockup */}
                      <div className="space-y-2.5 flex-1">
                        
                        {activeTab === 'polizas' && (
                          <div className="space-y-2 animate-in fade-in duration-200">
                            {/* Póliza 1 */}
                            <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:border-blue-400/40 transition-colors">
                              <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-lg bg-blue-500/20 flex items-center justify-center">
                                    <Car className="w-3.5 h-3.5 text-blue-400" />
                                  </div>
                                  <span className="text-xs font-bold text-white">Auto · GNP Cobertura Amplia</span>
                                </div>
                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">Vigente</span>
                              </div>
                              <div className="flex items-center justify-between text-[11px] text-white/50">
                                <span>Póliza: <strong>9281-9920-A</strong></span>
                                <span>Vence: 18 Oct 2026</span>
                              </div>
                            </div>

                            {/* Póliza 2 */}
                            <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                              <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                                    <HeartPulse className="w-3.5 h-3.5 text-emerald-400" />
                                  </div>
                                  <span className="text-xs font-bold text-white">GMM · Quálitas Salud</span>
                                </div>
                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">Vigente</span>
                              </div>
                              <div className="flex items-center justify-between text-[11px] text-white/50">
                                <span>Deducible: $15,000</span>
                                <span>Coaseguro: 10%</span>
                              </div>
                            </div>

                            {/* Póliza 3 */}
                            <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                              <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-lg bg-purple-500/20 flex items-center justify-center">
                                    <Shield className="w-3.5 h-3.5 text-purple-400" />
                                  </div>
                                  <span className="text-xs font-bold text-white">Vida · Respaldo Patrimonial</span>
                                </div>
                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">Vigente</span>
                              </div>
                              <div className="flex items-center justify-between text-[11px] text-white/50">
                                <span>Suma: $2,500,000</span>
                                <span>Recibo 1/4 pagado</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {activeTab === 'chava' && (
                          <div className="space-y-2.5 animate-in fade-in duration-200">
                            <div className="p-3 rounded-2xl bg-white/[0.05] border border-white/[0.08] flex items-start gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-[#00E5FF]/20 border border-[#00E5FF]/40 flex items-center justify-center flex-shrink-0 text-[#00E5FF]">
                                <Sparkles className="w-3.5 h-3.5" />
                              </div>
                              <div className="space-y-1">
                                <p className="text-[11px] font-bold text-[#00E5FF]">Chava IA · Tu Copiloto</p>
                                <p className="text-[11.5px] text-white/80 leading-snug">
                                  "¡Hola Carlos! Tu póliza de auto GNP cubre rotura de cristales con un deducible preferente del 20%. ¿Necesitas solicitar asistencia vial o una grúa?"
                                </p>
                              </div>
                            </div>

                            <div className="p-2.5 rounded-xl bg-[#1C37E0]/15 border border-[#1C37E0]/30 text-[11px] text-white/70 flex items-center justify-between">
                              <span>¿Cuánto debo de deducible en GMM?</span>
                              <ChevronRight className="w-3.5 h-3.5 text-[#5B78FF]" />
                            </div>
                            <div className="p-2.5 rounded-xl bg-[#1C37E0]/15 border border-[#1C37E0]/30 text-[11px] text-white/70 flex items-center justify-between">
                              <span>¿Cómo programar una cirugía hospitalaria?</span>
                              <ChevronRight className="w-3.5 h-3.5 text-[#5B78FF]" />
                            </div>
                          </div>
                        )}

                        {activeTab === 'siniestros' && (
                          <div className="space-y-2 animate-in fade-in duration-200">
                            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/25 space-y-2">
                              <div className="flex items-center gap-2 text-rose-400 font-bold text-xs">
                                <AlertTriangle className="w-4 h-4" />
                                <span>Reporte Inmediato de Siniestro</span>
                              </div>
                              <p className="text-[11px] text-white/70">
                                En caso de choque o urgencia médica, presiona el botón para llamar directo a cabina con tu póliza en mano.
                              </p>
                              <a
                                href="tel:8004009000"
                                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition-colors"
                              >
                                <PhoneCall className="w-3.5 h-3.5" />
                                <span>Llamar a GNP (800 400 9000)</span>
                              </a>
                            </div>

                            <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[11px] text-white/60">
                              💡 <strong>Consejo rápido:</strong> No te muevas del lugar del accidente hasta que llegue el ajustador oficial.
                            </div>
                          </div>
                        )}

                        {activeTab === 'descargas' && (
                          <div className="space-y-2 animate-in fade-in duration-200">
                            <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                              <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4 text-blue-400" />
                                <div className="text-left">
                                  <p className="text-xs font-semibold text-white">Carátula GNP Auto.pdf</p>
                                  <p className="text-[10px] text-white/40">1.4 MB · Vigente</p>
                                </div>
                              </div>
                              <span className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400 text-xs font-bold">
                                <Download className="w-3.5 h-3.5" />
                              </span>
                            </div>

                            <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                              <div className="flex items-center gap-2">
                                <FileCheck className="w-4 h-4 text-emerald-400" />
                                <div className="text-left">
                                  <p className="text-xs font-semibold text-white">Recibo Fiscal Q3 2026.pdf</p>
                                  <p className="text-[10px] text-white/40">820 KB · Pagado</p>
                                </div>
                              </div>
                              <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-bold">
                                <Download className="w-3.5 h-3.5" />
                              </span>
                            </div>

                            <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                              <div className="flex items-center gap-2">
                                <FolderOpen className="w-4 h-4 text-purple-400" />
                                <div className="text-left">
                                  <p className="text-xs font-semibold text-white">Condiciones Generales.pdf</p>
                                  <p className="text-[10px] text-white/40">3.2 MB · Oficial</p>
                                </div>
                              </div>
                              <span className="p-1.5 rounded-lg bg-purple-500/20 text-purple-400 text-xs font-bold">
                                <Download className="w-3.5 h-3.5" />
                              </span>
                            </div>
                          </div>
                        )}

                      </div>

                      {/* Botón inferior simulado */}
                      <a
                        href={LOGIN_PATH}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-[#1C37E0] to-[#3B58F0] text-white font-bold text-xs shadow-md transition-all active:scale-95"
                      >
                        <span>Entrar a mi Seguwallet real</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </a>

                    </div>

                  </div>

                  {/* Floating Notification Badge */}
                  <div className="absolute -bottom-4 -left-4 sm:-left-8 bg-white/95 text-slate-900 rounded-2xl p-3 shadow-2xl border border-white/20 backdrop-blur-xl flex items-center gap-3 animate-bounce">
                    <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold flex-shrink-0">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-extrabold leading-tight">Póliza Actualizada</p>
                      <p className="text-[11px] text-slate-500 leading-tight">Vigencia sincronizada con tu aseguradora</p>
                    </div>
                  </div>

                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ─── 3. MARQUEE DE ASEGURADORAS ALIADAS ─────────────────────────── */}
        <section
          id="aseguradoras"
          className="py-12 bg-[#030917] border-y border-white/[0.08] relative overflow-hidden"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6 text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-white/40">
              Conectado y compatible con las principales aseguradoras de México
            </p>
          </div>

          <div className="flex overflow-x-auto no-scrollbar gap-8 sm:gap-12 py-2 px-6 items-center justify-center flex-wrap opacity-80 hover:opacity-100 transition-opacity">
            {CARRIERS.map((c, i) => (
              <div
                key={i}
                className="h-10 sm:h-12 px-4 py-2 bg-white/[0.04] rounded-xl border border-white/[0.06] flex items-center justify-center transition-all hover:bg-white/[0.08] hover:scale-105"
              >
                <img
                  src={c.logo}
                  alt={c.name}
                  className="max-h-6 sm:max-h-7 max-w-[110px] w-auto object-contain filter brightness-110"
                  onError={(e) => {
                    const span = document.createElement('span');
                    span.textContent = c.name;
                    span.className = 'text-xs font-bold text-white/80';
                    e.currentTarget.parentElement?.appendChild(span);
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            ))}
          </div>
        </section>

        {/* ─── 4. PILARES Y BENEFICIOS CLAVE (BENTO GRID) ─────────────────── */}
        <section id="beneficios" className="py-24 bg-[#040C1F] relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            
            <div className="text-center space-y-4 max-w-3xl mx-auto mb-16">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-[#5B78FF] text-xs font-bold uppercase tracking-wide">
                <Sparkles className="w-3.5 h-3.5" /> Todo lo que necesitas
              </span>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-tight">
                Diseñado para darte el control total de tu tranquilidad
              </h2>
              <p className="text-base text-white/60 leading-relaxed">
                Olvídate de buscar papeles en cajones o perder pólizas en correos antiguos. Seguwallet reúne tu información aseguradora con la máxima seguridad y rapidez.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              
              {/* Card 1: Centralización */}
              <div className="rounded-3xl p-8 bg-white/[0.03] border border-white/[0.07] hover:border-blue-500/40 hover:bg-white/[0.05] transition-all duration-300 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#1C37E0] to-[#3B58F0] flex items-center justify-center text-white shadow-lg shadow-blue-600/30">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-white">Todas tus Pólizas Centralizadas</h3>
                <p className="text-sm text-white/60 leading-relaxed">
                  Autos, Gastos Médicos, Vida, Casa, Negocio y Fianzas. Cada seguro organizado con su número de póliza, vigencia, estatus de recibos y cobertura detallada.
                </p>
              </div>

              {/* Card 2: Passwordless */}
              <div className="rounded-3xl p-8 bg-white/[0.03] border border-white/[0.07] hover:border-[#00E5FF]/40 hover:bg-white/[0.05] transition-all duration-300 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#00E5FF]/20 to-[#1C37E0]/30 border border-[#00E5FF]/40 flex items-center justify-center text-[#00E5FF]">
                  <Lock className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-white">Acceso Seguro sin Contraseñas</h3>
                <p className="text-sm text-white/60 leading-relaxed">
                  Nunca más recordarás contraseñas complicadas. Ingresa en un clic con código seguro OTP enviado a tu WhatsApp o correo electrónico verificado.
                </p>
              </div>

              {/* Card 3: Chava IA */}
              <div className="rounded-3xl p-8 bg-white/[0.03] border border-white/[0.07] hover:border-purple-500/40 hover:bg-white/[0.05] transition-all duration-300 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-purple-600/30">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-white">Chava IA: Experto en Seguros 24/7</h3>
                <p className="text-sm text-white/60 leading-relaxed">
                  ¿Tienes dudas de qué cubre tu póliza o cómo usar tu deducible? Pregúntale a Chava IA en lenguaje natural y recibe respuestas exactas basadas en tus condiciones.
                </p>
              </div>

              {/* Card 4: Siniestros y Emergencias */}
              <div className="rounded-3xl p-8 bg-white/[0.03] border border-white/[0.07] hover:border-rose-500/40 hover:bg-white/[0.05] transition-all duration-300 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-600 to-amber-600 flex items-center justify-center text-white shadow-lg shadow-rose-600/30">
                  <PhoneCall className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-white">Botón de Siniestro & Emergencias</h3>
                <p className="text-sm text-white/60 leading-relaxed">
                  En momentos de tensión, cada segundo cuenta. Accede a la marcación telefónica directa de la cabina de tu aseguradora con tu póliza e inciso a la vista.
                </p>
              </div>

              {/* Card 5: Bóveda de Documentos */}
              <div className="rounded-3xl p-8 bg-white/[0.03] border border-white/[0.07] hover:border-emerald-500/40 hover:bg-white/[0.05] transition-all duration-300 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-emerald-600/30">
                  <Download className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-white">Bóveda de Documentos & PDFs</h3>
                <p className="text-sm text-white/60 leading-relaxed">
                  Descarga tus carátulas oficiales, condiciones generales, recibos fiscales y constancias vigentes en PDF cuando realices trámites o viajes.
                </p>
              </div>

              {/* Card 6: Asesor Personal Vinculado */}
              <div className="rounded-3xl p-8 bg-white/[0.03] border border-white/[0.07] hover:border-blue-500/40 hover:bg-white/[0.05] transition-all duration-300 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-700 to-cyan-600 flex items-center justify-center text-white shadow-lg shadow-blue-600/30">
                  <UserCheck className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-white">Tu Asesor Personal Siempre Cerca</h3>
                <p className="text-sm text-white/60 leading-relaxed">
                  Seguwallet está conectado con tu agente de seguros. Con un solo clic puedes abrir su WhatsApp, llamarle por teléfono o solicitar nuevas cotizaciones.
                </p>
              </div>

            </div>

          </div>
        </section>

        {/* ─── 5. CÓMO FUNCIONA EN 3 PASOS ───────────────────────────────── */}
        <section id="como-funciona" className="py-24 bg-[#06142F] border-y border-white/[0.08] relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            
            <div className="text-center space-y-4 max-w-2xl mx-auto mb-16">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.06] border border-white/[0.12] text-xs font-bold uppercase tracking-wide text-[#00E5FF]">
                Simple y sin fricción
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-white leading-tight">
                Comienza a usar tu Seguwallet en 3 simples pasos
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-8 relative">
              
              {/* Paso 1 */}
              <div className="p-8 rounded-3xl bg-white/[0.03] border border-white/[0.08] relative space-y-4">
                <span className="text-5xl font-black text-[#1C37E0]/40">01</span>
                <h3 className="text-xl font-bold text-white">Ingresa tu dato de contacto</h3>
                <p className="text-sm text-white/60 leading-relaxed">
                  Introduce tu correo electrónico o tu número de WhatsApp registrado en tu póliza con tu asesor de seguros.
                </p>
                <div className="pt-2 flex items-center gap-2 text-xs font-semibold text-[#00E5FF]">
                  <Check className="w-4 h-4" /> Sin formularios eternos
                </div>
              </div>

              {/* Paso 2 */}
              <div className="p-8 rounded-3xl bg-white/[0.03] border border-white/[0.08] relative space-y-4">
                <span className="text-5xl font-black text-[#00E5FF]/40">02</span>
                <h3 className="text-xl font-bold text-white">Recibe tu código seguro</h3>
                <p className="text-sm text-white/60 leading-relaxed">
                  Te enviamos un código de un solo uso de 6 dígitos instantáneamente a tu WhatsApp o correo para autenticarte.
                </p>
                <div className="pt-2 flex items-center gap-2 text-xs font-semibold text-[#00E5FF]">
                  <Check className="w-4 h-4" /> 100% libre de contraseñas
                </div>
              </div>

              {/* Paso 3 */}
              <div className="p-8 rounded-3xl bg-white/[0.03] border border-white/[0.08] relative space-y-4">
                <span className="text-5xl font-black text-emerald-400/40">03</span>
                <h3 className="text-xl font-bold text-white">¡Listo! Accede a tu cartera</h3>
                <p className="text-sm text-white/60 leading-relaxed">
                  Visualiza todas tus pólizas, descarga tus documentos en PDF, solicita asistencias y chatea con Chava IA en cualquier momento.
                </p>
                <div className="pt-2 flex items-center gap-2 text-xs font-semibold text-emerald-400">
                  <Check className="w-4 h-4" /> Disponible 24/7 en móvil y PC
                </div>
              </div>

            </div>

            <div className="mt-14 text-center">
              <a
                href={LOGIN_PATH}
                className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl font-bold text-sm text-white shadow-xl shadow-blue-600/30 hover:shadow-blue-600/50 transition-all active:scale-95"
                style={{ background: 'linear-gradient(135deg, #1C37E0 0%, #3B58F0 100%)' }}
              >
                <Lock className="w-4 h-4" />
                <span>Ingresar ahora a mi Seguwallet</span>
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>

          </div>
        </section>

        {/* ─── 6. SECCIÓN DE DESCARGAS & MULTIPLATAFORMA ──────────────────── */}
        <section id="descargas" className="py-24 bg-[#040C1F] relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="rounded-3xl p-8 sm:p-14 bg-gradient-to-br from-[#0A2260] via-[#0D2E80] to-[#06142F] border border-blue-500/30 shadow-2xl relative overflow-hidden">
              
              <div className="grid lg:grid-cols-2 gap-10 items-center relative z-10">
                <div className="space-y-6">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-white text-xs font-bold uppercase tracking-wide">
                    <Smartphone className="w-3.5 h-3.5 text-[#00E5FF]" /> PWA de Última Generación
                  </span>
                  
                  <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-tight">
                    Lleva Seguwallet en la pantalla de inicio de tu celular
                  </h2>

                  <p className="text-base text-white/75 leading-relaxed">
                    Instala Seguwallet directamente en tu iPhone o dispositivo Android como una app nativa sin ocupar memoria ni descargas pesadas. Tus pólizas siempre a un toque de distancia.
                  </p>

                  <div className="flex flex-wrap gap-4 pt-2">
                    <button
                      onClick={() => openPwaGuide('ios')}
                      className="inline-flex items-center gap-3 px-6 py-3.5 rounded-2xl bg-white text-slate-900 font-extrabold text-sm hover:bg-slate-100 transition-all shadow-lg active:scale-95 cursor-pointer"
                    >
                      <span className="text-lg">🍎</span>
                      <div className="text-left leading-tight">
                        <span className="block text-[10px] text-slate-500 font-bold uppercase">Instalar en</span>
                        <span>iPhone (iOS Safari)</span>
                      </div>
                    </button>

                    <button
                      onClick={() => openPwaGuide('android')}
                      className="inline-flex items-center gap-3 px-6 py-3.5 rounded-2xl bg-white/[0.12] hover:bg-white/[0.20] border border-white/20 text-white font-extrabold text-sm transition-all active:scale-95 cursor-pointer"
                    >
                      <span className="text-lg">🤖</span>
                      <div className="text-left leading-tight">
                        <span className="block text-[10px] text-white/60 font-bold uppercase">Instalar en</span>
                        <span>Android (Chrome)</span>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="space-y-4 bg-white/[0.05] p-6 rounded-2xl border border-white/10 backdrop-blur-md">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Laptop className="w-5 h-5 text-[#00E5FF]" />
                    <span>También accesible desde tu computadora</span>
                  </h3>
                  <p className="text-sm text-white/70 leading-relaxed">
                    Accede desde cualquier navegador web en tu laptop o tablet. Toda la información se mantiene sincronizada en la nube en tiempo real.
                  </p>
                  <div className="pt-2">
                    <a
                      href={LOGIN_PATH}
                      className="inline-flex items-center gap-2 text-sm font-bold text-[#00E5FF] hover:underline"
                    >
                      Abrir portal web de clientes <ArrowRight className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ─── 7. PREGUNTAS FRECUENTES (FAQ ACCORDION) ────────────────────── */}
        <section id="faq" className="py-24 bg-[#030917] border-t border-white/[0.08]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            
            <div className="text-center space-y-4 mb-16">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-[#5B78FF] text-xs font-bold uppercase tracking-wide">
                <HelpCircle className="w-3.5 h-3.5" /> Resolvemos tus dudas
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-white">
                Preguntas Frecuentes sobre Seguwallet
              </h2>
            </div>

            <div className="space-y-4">
              {FAQS.map((faq, index) => {
                const isOpen = openFaq === index;
                return (
                  <div
                    key={index}
                    className="rounded-2xl bg-white/[0.03] border border-white/[0.07] overflow-hidden transition-all duration-200"
                  >
                    <button
                      onClick={() => setOpenFaq(isOpen ? null : index)}
                      className="w-full flex items-center justify-between p-6 text-left cursor-pointer hover:bg-white/[0.02]"
                    >
                      <span className="text-base sm:text-lg font-bold text-white pr-4">
                        {faq.q}
                      </span>
                      <ChevronDown
                        className={`w-5 h-5 text-[#5B78FF] flex-shrink-0 transition-transform duration-200 ${
                          isOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {isOpen && (
                      <div className="px-6 pb-6 text-sm text-white/70 leading-relaxed border-t border-white/[0.05] pt-4 animate-in fade-in duration-150">
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

          </div>
        </section>

        {/* ─── 8. CTA FINAL ───────────────────────────────────────────────── */}
        <section className="py-20 bg-gradient-to-b from-[#030917] to-[#040C1F] relative">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
            
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-[#1C37E0] to-[#00E5FF] flex items-center justify-center text-white mx-auto shadow-2xl shadow-blue-500/30">
              <ShieldCheck className="w-8 h-8" />
            </div>

            <div className="space-y-4 max-w-2xl mx-auto">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-tight">
                Tu tranquilidad respaldada en cada momento
              </h2>
              <p className="text-base sm:text-lg text-white/70">
                Ingresa hoy a Seguwallet y lleva todas tus pólizas organizadas en la palma de tu mano.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href={LOGIN_PATH}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl font-bold text-base text-white shadow-xl shadow-blue-600/40 hover:shadow-blue-600/60 transition-all active:scale-95"
                style={{ background: 'linear-gradient(135deg, #1C37E0 0%, #3B58F0 100%)' }}
              >
                <Lock className="w-5 h-5" />
                <span>Ingresar a Seguwallet</span>
                <ArrowRight className="w-5 h-5" />
              </a>
            </div>

          </div>
        </section>

        {/* ─── 9. FOOTER INSTITUCIONAL ─────────────────────────────────────── */}
        <footer className="border-t border-white/[0.08] bg-[#020612] py-14">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
            
            <div className="grid md:grid-cols-4 gap-8">
              
              <div className="md:col-span-2 space-y-4">
                <img src={SEGUWALLET_LOGO} alt="Seguwallet" className="h-10 w-auto object-contain" />
                <p className="text-sm text-white/50 leading-relaxed max-w-sm">
                  Seguwallet es la cartera digital inteligente para asegurados. Un servicio oficial respaldado por la Red Nacional de Grupo JIRO y el ecosistema MOVI Digital.
                </p>
                <div className="flex items-center gap-4 pt-2 text-xs text-white/40">
                  <span>Protegido con encriptación SSL de 256 bits</span>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-white">Navegación</p>
                <ul className="space-y-2 text-sm text-white/60">
                  <li><button onClick={() => scrollTo('beneficios')} className="hover:text-white transition-colors cursor-pointer">Características</button></li>
                  <li><button onClick={() => scrollTo('como-funciona')} className="hover:text-white transition-colors cursor-pointer">¿Cómo funciona?</button></li>
                  <li><button onClick={() => scrollTo('aseguradoras')} className="hover:text-white transition-colors cursor-pointer">Aseguradoras</button></li>
                  <li><button onClick={() => scrollTo('descargas')} className="hover:text-white transition-colors cursor-pointer">Descargar App</button></li>
                  <li><button onClick={() => scrollTo('faq')} className="hover:text-white transition-colors cursor-pointer">Preguntas Frecuentes</button></li>
                </ul>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-white">Ecosistema</p>
                <ul className="space-y-2 text-sm text-white/60">
                  <li><a href="https://movi.digital" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">MOVI Digital</a></li>
                  <li><a href="https://grupojiro.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Grupo JIRO</a></li>
                  <li><a href="https://seguros.education" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Seguros Education</a></li>
                  <li><a href="https://agentedeseguros.ai" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Chava AI</a></li>
                </ul>
              </div>

            </div>

            <div className="pt-8 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/40">
              <p>© {new Date().getFullYear()} Seguwallet · Grupo JIRO. Todos los derechos reservados.</p>
              <div className="flex items-center gap-4">
                <a href="https://movi.digital" target="_blank" rel="noopener noreferrer" className="hover:text-white/70 transition-colors">Aviso de Privacidad</a>
                <span>·</span>
                <a href="https://movi.digital" target="_blank" rel="noopener noreferrer" className="hover:text-white/70 transition-colors">Términos de Servicio</a>
              </div>
            </div>

          </div>
        </footer>

      </div>

      {/* ─── MODAL GUÍA DE INSTALACIÓN PWA ──────────────────────────────── */}
      {showPwaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#0A1633] text-white rounded-3xl p-6 sm:p-8 max-w-md w-full border border-white/10 shadow-2xl space-y-6 relative">
            
            <button
              onClick={() => setShowPwaModal(false)}
              className="absolute top-5 right-5 p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-2">
              <span className="text-3xl">{pwaPlatform === 'ios' ? '🍎' : '🤖'}</span>
              <h3 className="text-xl font-black text-white">
                {pwaPlatform === 'ios' ? 'Instalar en iPhone (Safari)' : 'Instalar en Android (Chrome)'}
              </h3>
              <p className="text-xs text-white/60">
                Sigue estos 3 pasos rápidos para tener Seguwallet como app nativa:
              </p>
            </div>

            <div className="space-y-4 bg-white/[0.03] p-4 rounded-2xl border border-white/[0.06] text-xs">
              {pwaPlatform === 'ios' ? (
                <>
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center flex-shrink-0">1</span>
                    <p className="text-white/80">Abre <strong>https://seguwallet.mx</strong> en el navegador <strong>Safari</strong> de tu iPhone.</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center flex-shrink-0">2</span>
                    <p className="text-white/80">Toca el botón <strong>Compartir</strong> <Share2 className="inline w-3.5 h-3.5 mx-1" /> en la barra inferior de Safari.</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center flex-shrink-0">3</span>
                    <p className="text-white/80">Desplázate hacia abajo y selecciona <strong>"Agregar al inicio"</strong> <Plus className="inline w-3.5 h-3.5 mx-1" />.</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center flex-shrink-0">1</span>
                    <p className="text-white/80">Abre <strong>https://seguwallet.mx</strong> en <strong>Google Chrome</strong> en tu Android.</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center flex-shrink-0">2</span>
                    <p className="text-white/80">Toca el menú de <strong>tres puntos (⋮)</strong> en la esquina superior derecha.</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center flex-shrink-0">3</span>
                    <p className="text-white/80">Selecciona <strong>"Instalar aplicación"</strong> o <strong>"Agregar a la pantalla principal"</strong>.</p>
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-3">
              <a
                href={LOGIN_PATH}
                className="flex-1 py-3 px-4 rounded-xl font-bold text-xs text-white text-center shadow-md shadow-blue-600/30"
                style={{ background: 'linear-gradient(135deg, #1C37E0 0%, #3B58F0 100%)' }}
              >
                Abrir Seguwallet ahora
              </a>
              <button
                onClick={() => setShowPwaModal(false)}
                className="px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>

          </div>
        </div>
      )}

    </>
  );
}
