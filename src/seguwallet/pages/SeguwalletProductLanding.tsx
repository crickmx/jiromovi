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
  Car,
  HeartPulse,
  Menu,
  X,
  Laptop,
  Check,
  AlertTriangle,
  HelpCircle,
  FileCheck,
  Share2,
  Plus,
  UserCheck,
  FolderOpen
} from 'lucide-react';

// ─── ASSETS & CONSTANTS ──────────────────────────────────────────────────────
const SEGUWALLET_LOGO = '/seguwallet-logo.png';

const HOST = typeof window !== 'undefined' ? window.location.hostname : '';
const isSeguwalletDomain = HOST === 'seguwallet.mx' || HOST.endsWith('.seguwallet.mx');
const LOGIN_PATH = isSeguwalletDomain ? '/login' : '/seguwallet/login';

const FAQS = [
  {
    q: '¿Qué es Seguwallet y para qué sirve?',
    a: 'Seguwallet es la cartera digital para asegurados provista por tu asesor de seguros. Te permite consultar tus pólizas vigentes, descargar tus documentos y recibos en PDF, acceder a las líneas directas de siniestro y consultar dudas con Chava IA desde tu celular o computadora.'
  },
  {
    q: '¿Tiene algún costo para mí como cliente?',
    a: 'No. Seguwallet es un servicio gratuito proporcionado por tu asesor de seguros de confianza para que tengas acceso inmediato a la información de tus pólizas.'
  },
  {
    q: '¿Cómo inicio sesión si no tengo una contraseña?',
    a: 'Seguwallet no utiliza contraseñas fijas. Solo ingresas el correo electrónico o número de WhatsApp registrado con tu asesor y recibes un código seguro de 6 dígitos de un solo uso para ingresar al instante.'
  },
  {
    q: '¿Qué tipo de pólizas puedo consultar?',
    a: 'Puedes consultar las pólizas administradas por tu asesor de seguros (Autos, Gastos Médicos Mayores, Vida, Hogar, Empresa y Fianzas) con su vigencia, número de póliza y estatus de recibos.'
  },
  {
    q: '¿Cómo reporto un siniestro en caso de emergencia?',
    a: 'Dentro de Seguwallet tienes la sección de Siniestros y Emergencias con los números telefónicos directos de cabina de asistencia y tu número de póliza visible para proporcionarlo al operador.'
  },
  {
    q: '¿Cómo puedo instalar Seguwallet en mi celular?',
    a: 'Seguwallet funciona como una Progressive Web App (PWA). Puedes abrirla en Safari (iPhone) o Chrome (Android) y seleccionar "Agregar a la pantalla de inicio" para tenerla en tu teléfono sin ocupar espacio.'
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
          content="Consulta tus pólizas, vigencias, recibos y asistencias. Reporta siniestros con un clic y resuelve dudas con Chava IA. Tu wallet de seguros."
        />
        <meta
          name="keywords"
          content="Seguwallet, cartera digital de seguros, app de seguros, consultar póliza, recibos de seguros, Chava IA, Grupo JIRO, asistencia en siniestros"
        />
        <link rel="canonical" href="https://seguwallet.mx/" />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Seguwallet | Tu Cartera Digital de Seguros" />
        <meta
          property="og:description"
          content="Tus pólizas en un solo lugar. Consulta vigencias, descarga documentos y reporta siniestros en segundos."
        />
        <meta property="og:url" content="https://seguwallet.mx/" />
        <meta property="og:image" content="/seguwallet-logo.png" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Seguwallet | Tu Cartera Digital de Seguros" />
        <meta
          name="twitter:description"
          content="Tu cartera digital de seguros. Accede sin contraseñas con OTP por WhatsApp y correo."
        />
      </Helmet>

      <div className="min-h-screen bg-[#040C1F] text-white selection:bg-[#1C37E0] selection:text-white font-sans antialiased">

        {/* ─── NAVBAR SUPERIOR ─────────────────────────────────────── */}
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
                  Funciones
                </button>
                <button
                  onClick={() => scrollTo('como-funciona')}
                  className="text-sm font-medium text-white/70 hover:text-white transition-colors cursor-pointer"
                >
                  ¿Cómo funciona?
                </button>
                <button
                  onClick={() => scrollTo('descargas')}
                  className="text-sm font-medium text-white/70 hover:text-white transition-colors cursor-pointer"
                >
                  Instalar App
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
                  { label: 'Funciones', id: 'beneficios' },
                  { label: '¿Cómo funciona?', id: 'como-funciona' },
                  { label: 'Instalar App', id: 'descargas' },
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

        {/* ─── HERO PRINCIPAL ─────────────────────────────────────── */}
        <section
          id="inicio"
          className="relative min-h-[90vh] flex items-center pt-24 pb-16 lg:pt-32 lg:pb-24 overflow-hidden"
          style={{
            background: 'radial-gradient(circle at 50% 20%, #0A2260 0%, #050E24 45%, #040C1F 100%)'
          }}
        >
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

          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
            <div className="grid lg:grid-cols-12 gap-12 lg:gap-8 items-center">
              
              {/* Copy */}
              <div className="lg:col-span-7 space-y-7 text-center lg:text-left">
                
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.12] backdrop-blur-md">
                  <span className="w-2 h-2 rounded-full bg-[#00E5FF] animate-pulse" />
                  <span className="text-xs font-semibold text-[#00E5FF] tracking-wide uppercase">
                    Portal de Clientes y Asegurados
                  </span>
                </div>

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

                <p className="text-base sm:text-lg text-white/70 leading-relaxed max-w-2xl mx-auto lg:mx-0">
                  Consulta tus pólizas, vigencias, recibos y asistencias administradas por tu asesor. Reporta siniestros y resuelve dudas con Chava IA. Acceso rápido sin contraseñas.
                </p>

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
                    onClick={() => scrollTo('beneficios')}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-4 rounded-2xl font-semibold text-sm text-white/85 bg-white/[0.05] hover:bg-white/[0.10] border border-white/[0.12] transition-colors cursor-pointer"
                  >
                    <Smartphone className="w-4 h-4 text-[#00E5FF]" />
                    <span>Conocer Funciones</span>
                  </button>
                </div>

                {/* Quick Stats */}
                <div className="pt-6 border-t border-white/10 grid grid-cols-2 sm:grid-cols-3 gap-4 text-left">
                  <div className="space-y-1">
                    <p className="text-xl sm:text-2xl font-black text-[#00E5FF]">100%</p>
                    <p className="text-xs text-white/50 leading-tight">Acceso seguro con código OTP</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xl sm:text-2xl font-black text-white">24/7</p>
                    <p className="text-xs text-white/50 leading-tight">Chava IA y líneas de emergencia</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xl sm:text-2xl font-black text-emerald-400">Sin costo</p>
                    <p className="text-xs text-white/50 leading-tight">Para clientes de tu asesor</p>
                  </div>
                </div>

              </div>

              {/* Mockup Interactivo */}
              <div className="lg:col-span-5 flex justify-center lg:justify-end">
                <div className="relative w-full max-w-[360px] sm:max-w-[390px]">
                  
                  <div
                    className="absolute -inset-4 rounded-[48px] pointer-events-none"
                    style={{
                      background: 'linear-gradient(135deg, rgba(28,55,224,0.35) 0%, rgba(0,229,255,0.2) 100%)',
                      filter: 'blur(30px)'
                    }}
                  />

                  {/* Frame */}
                  <div className="relative rounded-[40px] border-[6px] border-[#1C2A4D] bg-[#0A1633] shadow-2xl overflow-hidden text-neutral-900 font-sans">
                    
                    <div className="bg-[#0A1633] pt-3 pb-2 px-6 flex items-center justify-between text-white/60 text-[11px] font-medium border-b border-white/5">
                      <span>9:41</span>
                      <div className="w-20 h-4 bg-black rounded-full mx-auto" />
                      <div className="flex items-center gap-1.5">
                        <span className="w-3.5 h-2 border border-white/60 rounded-xs inline-block relative after:absolute after:right-0 after:top-0 after:bottom-0 after:w-2 after:bg-white/80" />
                      </div>
                    </div>

                    <div className="p-4 bg-gradient-to-b from-[#0C1E4A] to-[#0A1633] border-b border-white/10 text-white flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <img src={SEGUWALLET_LOGO} alt="Seguwallet" className="h-7 w-auto object-contain" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-[11px] font-semibold text-white/80">Pólizas Activas</span>
                      </div>
                    </div>

                    <div className="p-4 space-y-3.5 bg-[#071026] text-white min-h-[440px] flex flex-col justify-between">
                      
                      <div className="p-3.5 rounded-2xl bg-gradient-to-r from-[#1C37E0] to-[#1228B8] shadow-md space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-white/80 font-medium">Mi Cartera Digital</span>
                          <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-bold">Cliente Activo</span>
                        </div>
                        <div>
                          <p className="text-base font-extrabold text-white">Carlos Mendoza Ruiz</p>
                          <p className="text-[11px] text-white/70">Atendido por tu asesor de seguros</p>
                        </div>
                      </div>

                      {/* Tab buttons */}
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

                      {/* Tab contents */}
                      <div className="space-y-2.5 flex-1">
                        
                        {activeTab === 'polizas' && (
                          <div className="space-y-2 animate-in fade-in duration-200">
                            <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                              <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-lg bg-blue-500/20 flex items-center justify-center">
                                    <Car className="w-3.5 h-3.5 text-blue-400" />
                                  </div>
                                  <span className="text-xs font-bold text-white">Auto · Cobertura Amplia</span>
                                </div>
                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">Vigente</span>
                              </div>
                              <div className="flex items-center justify-between text-[11px] text-white/50">
                                <span>Póliza: <strong>9281-9920-A</strong></span>
                                <span>Vence: 18 Oct 2026</span>
                              </div>
                            </div>

                            <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                              <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                                    <HeartPulse className="w-3.5 h-3.5 text-emerald-400" />
                                  </div>
                                  <span className="text-xs font-bold text-white">GMM · Plan Familiar</span>
                                </div>
                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">Vigente</span>
                              </div>
                              <div className="flex items-center justify-between text-[11px] text-white/50">
                                <span>Deducible: $15,000</span>
                                <span>Coaseguro: 10%</span>
                              </div>
                            </div>

                            <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                              <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-lg bg-purple-500/20 flex items-center justify-center">
                                    <Shield className="w-3.5 h-3.5 text-purple-400" />
                                  </div>
                                  <span className="text-xs font-bold text-white">Vida · Protección Temporal</span>
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
                                  "¡Hola Carlos! Tu póliza de auto cubre asistencia vial y grúa. ¿Deseas consultar tu deducible o llamar a la cabina de siniestro?"
                                </p>
                              </div>
                            </div>

                            <div className="p-2.5 rounded-xl bg-[#1C37E0]/15 border border-[#1C37E0]/30 text-[11px] text-white/70 flex items-center justify-between">
                              <span>¿Cómo solicitar un reembolso médico?</span>
                              <ChevronRight className="w-3.5 h-3.5 text-[#5B78FF]" />
                            </div>
                          </div>
                        )}

                        {activeTab === 'siniestros' && (
                          <div className="space-y-2 animate-in fade-in duration-200">
                            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/25 space-y-2">
                              <div className="flex items-center gap-2 text-rose-400 font-bold text-xs">
                                <AlertTriangle className="w-4 h-4" />
                                <span>Reporte de Siniestro</span>
                              </div>
                              <p className="text-[11px] text-white/70">
                                En caso de emergencia o accidente, consulta los números directos de atención y ten tu póliza visible.
                              </p>
                              <a
                                href={LOGIN_PATH}
                                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition-colors"
                              >
                                <PhoneCall className="w-3.5 h-3.5" />
                                <span>Ver Directorio en mi Wallet</span>
                              </a>
                            </div>
                          </div>
                        )}

                        {activeTab === 'descargas' && (
                          <div className="space-y-2 animate-in fade-in duration-200">
                            <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                              <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4 text-blue-400" />
                                <div className="text-left">
                                  <p className="text-xs font-semibold text-white">Carátula de Póliza.pdf</p>
                                  <p className="text-[10px] text-white/40">Descarga oficial</p>
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
                                  <p className="text-xs font-semibold text-white">Recibo de Pago.pdf</p>
                                  <p className="text-[10px] text-white/40">Vigente</p>
                                </div>
                              </div>
                              <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-bold">
                                <Download className="w-3.5 h-3.5" />
                              </span>
                            </div>
                          </div>
                        )}

                      </div>

                      <a
                        href={LOGIN_PATH}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-[#1C37E0] to-[#3B58F0] text-white font-bold text-xs shadow-md transition-all active:scale-95"
                      >
                        <span>Entrar a mi Seguwallet</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </a>

                    </div>

                  </div>

                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ─── PILARES Y BENEFICIOS CLAVE ─────────────────── */}
        <section id="beneficios" className="py-24 bg-[#040C1F] relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            
            <div className="text-center space-y-4 max-w-3xl mx-auto mb-16">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-[#5B78FF] text-xs font-bold uppercase tracking-wide">
                <Sparkles className="w-3.5 h-3.5" /> Funciones Principales
              </span>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-tight">
                El control de tus pólizas en la palma de tu mano
              </h2>
              <p className="text-base text-white/60 leading-relaxed">
                Toda la información de tus seguros organizada y accesible en cualquier momento.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              
              <div className="rounded-3xl p-8 bg-white/[0.03] border border-white/[0.07] hover:border-blue-500/40 hover:bg-white/[0.05] transition-all duration-300 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#1C37E0] to-[#3B58F0] flex items-center justify-center text-white shadow-lg shadow-blue-600/30">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-white">Pólizas Organizadas</h3>
                <p className="text-sm text-white/60 leading-relaxed">
                  Consulta tus pólizas individuales o familiares con su vigencia, número, estatus y coberturas.
                </p>
              </div>

              <div className="rounded-3xl p-8 bg-white/[0.03] border border-white/[0.07] hover:border-[#00E5FF]/40 hover:bg-white/[0.05] transition-all duration-300 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#00E5FF]/20 to-[#1C37E0]/30 border border-[#00E5FF]/40 flex items-center justify-center text-[#00E5FF]">
                  <Lock className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-white">Acceso sin Contraseña</h3>
                <p className="text-sm text-white/60 leading-relaxed">
                  Ingresa con un código seguro enviado a tu WhatsApp o correo verificado.
                </p>
              </div>

              <div className="rounded-3xl p-8 bg-white/[0.03] border border-white/[0.07] hover:border-purple-500/40 hover:bg-white/[0.05] transition-all duration-300 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-purple-600/30">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-white">Chava IA</h3>
                <p className="text-sm text-white/60 leading-relaxed">
                  Resuelve dudas sobre coberturas, deducibles y procesos ante cualquier situación.
                </p>
              </div>

              <div className="rounded-3xl p-8 bg-white/[0.03] border border-white/[0.07] hover:border-rose-500/40 hover:bg-white/[0.05] transition-all duration-300 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-600 to-amber-600 flex items-center justify-center text-white shadow-lg shadow-rose-600/30">
                  <PhoneCall className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-white">Líneas de Emergencia</h3>
                <p className="text-sm text-white/60 leading-relaxed">
                  Directorio de teléfonos de asistencia y reporte de siniestros al alcance de un clic.
                </p>
              </div>

              <div className="rounded-3xl p-8 bg-white/[0.03] border border-white/[0.07] hover:border-emerald-500/40 hover:bg-white/[0.05] transition-all duration-300 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-emerald-600/30">
                  <Download className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-white">Centro de Descargas</h3>
                <p className="text-sm text-white/60 leading-relaxed">
                  Descarga tus carátulas, recibos y condiciones generales en PDF cuando lo requieras.
                </p>
              </div>

              <div className="rounded-3xl p-8 bg-white/[0.03] border border-white/[0.07] hover:border-blue-500/40 hover:bg-white/[0.05] transition-all duration-300 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-700 to-cyan-600 flex items-center justify-center text-white shadow-lg shadow-blue-600/30">
                  <UserCheck className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-white">Contacto con tu Asesor</h3>
                <p className="text-sm text-white/60 leading-relaxed">
                  Comunícate directamente por WhatsApp o teléfono con tu agente de seguros.
                </p>
              </div>

            </div>

          </div>
        </section>

        {/* ─── CÓMO FUNCIONA EN 3 PASOS ───────────────────────────────── */}
        <section id="como-funciona" className="py-24 bg-[#06142F] border-y border-white/[0.08] relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            
            <div className="text-center space-y-4 max-w-2xl mx-auto mb-16">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.06] border border-white/[0.12] text-xs font-bold uppercase tracking-wide text-[#00E5FF]">
                Fácil y Rápido
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-white leading-tight">
                Accede a tu Seguwallet en 3 pasos
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-8 relative">
              
              <div className="p-8 rounded-3xl bg-white/[0.03] border border-white/[0.08] relative space-y-4">
                <span className="text-5xl font-black text-[#1C37E0]/40">01</span>
                <h3 className="text-xl font-bold text-white">Ingresa tu dato</h3>
                <p className="text-sm text-white/60 leading-relaxed">
                  Coloca tu correo electrónico o número de WhatsApp registrado con tu asesor.
                </p>
              </div>

              <div className="p-8 rounded-3xl bg-white/[0.03] border border-white/[0.08] relative space-y-4">
                <span className="text-5xl font-black text-[#00E5FF]/40">02</span>
                <h3 className="text-xl font-bold text-white">Recibe tu código</h3>
                <p className="text-sm text-white/60 leading-relaxed">
                  Te llega un código seguro de 6 dígitos por WhatsApp o correo electrónico.
                </p>
              </div>

              <div className="p-8 rounded-3xl bg-white/[0.03] border border-white/[0.08] relative space-y-4">
                <span className="text-5xl font-black text-emerald-400/40">03</span>
                <h3 className="text-xl font-bold text-white">Consulta tus pólizas</h3>
                <p className="text-sm text-white/60 leading-relaxed">
                  Revisa vigencias, descarga documentos y gestiona tus seguros de forma inmediata.
                </p>
              </div>

            </div>

            <div className="mt-14 text-center">
              <a
                href={LOGIN_PATH}
                className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl font-bold text-sm text-white shadow-xl shadow-blue-600/30 hover:shadow-blue-600/50 transition-all active:scale-95"
                style={{ background: 'linear-gradient(135deg, #1C37E0 0%, #3B58F0 100%)' }}
              >
                <Lock className="w-4 h-4" />
                <span>Ingresar a mi Seguwallet</span>
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>

          </div>
        </section>

        {/* ─── DESCARGAS & PWA ──────────────────── */}
        <section id="descargas" className="py-24 bg-[#040C1F] relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="rounded-3xl p-8 sm:p-14 bg-gradient-to-br from-[#0A2260] via-[#0D2E80] to-[#06142F] border border-blue-500/30 shadow-2xl relative overflow-hidden">
              
              <div className="grid lg:grid-cols-2 gap-10 items-center relative z-10">
                <div className="space-y-6">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-white text-xs font-bold uppercase tracking-wide">
                    <Smartphone className="w-3.5 h-3.5 text-[#00E5FF]" /> Acceso Móvil y Web
                  </span>
                  
                  <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-tight">
                    Agrega Seguwallet a la pantalla de tu celular
                  </h2>

                  <p className="text-base text-white/75 leading-relaxed">
                    Instala Seguwallet en tu iPhone o Android como acceso directo en tu pantalla de inicio para entrar rápidamente sin descargas pesadas.
                  </p>

                  <div className="flex flex-wrap gap-4 pt-2">
                    <button
                      onClick={() => openPwaGuide('ios')}
                      className="inline-flex items-center gap-3 px-6 py-3.5 rounded-2xl bg-white text-slate-900 font-extrabold text-sm hover:bg-slate-100 transition-all shadow-lg active:scale-95 cursor-pointer"
                    >
                      <span className="text-lg">🍎</span>
                      <div className="text-left leading-tight">
                        <span className="block text-[10px] text-slate-500 font-bold uppercase">Instalar en</span>
                        <span>iPhone (Safari)</span>
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
                    <span>Acceso desde computadora</span>
                  </h3>
                  <p className="text-sm text-white/70 leading-relaxed">
                    También puedes acceder a través de cualquier navegador web en tu laptop o tablet.
                  </p>
                  <div className="pt-2">
                    <a
                      href={LOGIN_PATH}
                      className="inline-flex items-center gap-2 text-sm font-bold text-[#00E5FF] hover:underline"
                    >
                      Ingresar al portal web <ArrowRight className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ─── PREGUNTAS FRECUENTES ────────────────────── */}
        <section id="faq" className="py-24 bg-[#030917] border-t border-white/[0.08]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            
            <div className="text-center space-y-4 mb-16">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-[#5B78FF] text-xs font-bold uppercase tracking-wide">
                <HelpCircle className="w-3.5 h-3.5" /> Dudas Comunes
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-white">
                Preguntas Frecuentes
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

        {/* ─── CTA FINAL ───────────────────────────────────────────────── */}
        <section className="py-20 bg-gradient-to-b from-[#030917] to-[#040C1F] relative">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
            
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-[#1C37E0] to-[#00E5FF] flex items-center justify-center text-white mx-auto shadow-2xl shadow-blue-500/30">
              <ShieldCheck className="w-8 h-8" />
            </div>

            <div className="space-y-4 max-w-2xl mx-auto">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-tight">
                Tus pólizas siempre contigo
              </h2>
              <p className="text-base sm:text-lg text-white/70">
                Ingresa a Seguwallet y consulta tu información en cualquier momento.
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

        {/* ─── FOOTER ─────────────────────────────────────── */}
        <footer className="border-t border-white/[0.08] bg-[#020612] py-14">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
            
            <div className="grid md:grid-cols-4 gap-8">
              
              <div className="md:col-span-2 space-y-4">
                <img src={SEGUWALLET_LOGO} alt="Seguwallet" className="h-10 w-auto object-contain" />
                <p className="text-sm text-white/50 leading-relaxed max-w-sm">
                  Seguwallet es la cartera digital para asegurados de Grupo JIRO y MOVI Digital.
                </p>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-white">Navegación</p>
                <ul className="space-y-2 text-sm text-white/60">
                  <li><button onClick={() => scrollTo('beneficios')} className="hover:text-white transition-colors cursor-pointer">Funciones</button></li>
                  <li><button onClick={() => scrollTo('como-funciona')} className="hover:text-white transition-colors cursor-pointer">¿Cómo funciona?</button></li>
                  <li><button onClick={() => scrollTo('descargas')} className="hover:text-white transition-colors cursor-pointer">Instalar App</button></li>
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
                Sigue estos pasos para agregar Seguwallet a tu pantalla de inicio:
              </p>
            </div>

            <div className="space-y-4 bg-white/[0.03] p-4 rounded-2xl border border-white/[0.06] text-xs">
              {pwaPlatform === 'ios' ? (
                <>
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center flex-shrink-0">1</span>
                    <p className="text-white/80">Abre <strong>https://seguwallet.mx</strong> en <strong>Safari</strong>.</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center flex-shrink-0">2</span>
                    <p className="text-white/80">Toca el botón <strong>Compartir</strong> <Share2 className="inline w-3.5 h-3.5 mx-1" />.</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center flex-shrink-0">3</span>
                    <p className="text-white/80">Selecciona <strong>"Agregar al inicio"</strong> <Plus className="inline w-3.5 h-3.5 mx-1" />.</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center flex-shrink-0">1</span>
                    <p className="text-white/80">Abre <strong>https://seguwallet.mx</strong> en <strong>Google Chrome</strong>.</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center flex-shrink-0">2</span>
                    <p className="text-white/80">Toca el menú de <strong>tres puntos (⋮)</strong> arriba a la derecha.</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center flex-shrink-0">3</span>
                    <p className="text-white/80">Selecciona <strong>"Instalar aplicación"</strong> o <strong>"Agregar a pantalla principal"</strong>.</p>
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
                Abrir Seguwallet
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
