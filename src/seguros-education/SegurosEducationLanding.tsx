import { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { Play, BookOpen, Video, Users, MapPin, Award, Clock, Wifi, ChevronRight, Menu, X, GraduationCap, Building2, ArrowRight, CircleCheck as CheckCircle, Monitor, Calendar, Globe, Zap, Mail, Phone, MessageSquare, Send, Loader as Loader2, CircleAlert as AlertCircle, ChevronDown, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { SELoginModal } from './SELoginModal';
import { useMoviAuth } from '../contexts/MoviAuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Lesson {
  id: string;
  titulo: string;
  descripcion: string;
  miniatura_url: string | null;
  duracion: number;
  categoria_nombre?: string;
}

interface AulaSession {
  id: string;
  titulo: string;
  descripcion?: string;
  fecha?: string;
  hora_inicio?: string;
  estado: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SE_LOGO =
  'https://movi.digital/wp-content/uploads/elementor/thumbs/moviRecurso-10-rgqg5n2oyvobfmstl7md0o8mr5w7vjv6rsxrkauuio.png';

function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function NavLink({ children, href, onClick }: { children: React.ReactNode; href?: string; onClick?: () => void }) {
  return (
    <a
      href={href || '#'}
      onClick={(e) => { if (onClick) { e.preventDefault(); onClick(); } }}
      className="text-sm font-medium text-white/80 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
    >
      {children}
    </a>
  );
}

function SectionTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-full border border-blue-100 uppercase tracking-wide">
      {children}
    </span>
  );
}

function GradientText({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn('bg-clip-text text-transparent', className)}
      style={{ backgroundImage: 'linear-gradient(90deg, #0D6EFD, #00c8e0)' }}
    >
      {children}
    </span>
  );
}

function CourseCard({ lesson, onAccess }: { lesson: Lesson; onAccess: () => void }) {
  return (
    <div
      onClick={onAccess}
      className="group bg-white rounded-2xl border border-neutral-100 shadow-sm hover:shadow-xl hover:border-blue-100 transition-all duration-300 overflow-hidden cursor-pointer flex flex-col"
    >
      <div className="aspect-video bg-gradient-to-br from-blue-600 to-cyan-500 relative overflow-hidden">
        {lesson.miniatura_url ? (
          <img
            src={lesson.miniatura_url}
            alt={lesson.titulo}
            crossOrigin="anonymous"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <BookOpen className="w-10 h-10 text-white/60" />
          </div>
        )}
        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
        <div className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2.5 py-1 bg-black/50 backdrop-blur-sm rounded-lg">
          <Play className="w-3 h-3 text-white fill-white" />
          <span className="text-white text-xs font-medium">{lesson.duracion} min</span>
        </div>
      </div>
      <div className="p-5 flex flex-col flex-1">
        {lesson.categoria_nombre && (
          <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2">
            {lesson.categoria_nombre}
          </span>
        )}
        <h3 className="text-neutral-900 font-semibold text-sm leading-snug mb-2 line-clamp-2 flex-1">
          {lesson.titulo}
        </h3>
        <div className="flex items-center justify-between pt-3 border-t border-neutral-50 mt-auto">
          <span className="text-xs text-neutral-500 flex items-center gap-1">
            <Monitor className="w-3.5 h-3.5" /> On Demand
          </span>
          <span className="text-xs font-semibold text-blue-600 flex items-center gap-1 group-hover:gap-2 transition-all">
            Ver curso <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>
    </div>
  );
}

function EventCard({ session, onAccess }: { session: AulaSession; onAccess: () => void }) {
  const isLive = session.estado === 'activa';
  const isScheduled = session.estado === 'programada';

  return (
    <div
      onClick={onAccess}
      className="group flex items-start gap-4 p-4 bg-white rounded-2xl border border-neutral-100 hover:border-blue-100 hover:shadow-md transition-all cursor-pointer"
    >
      <div className={cn(
        'w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0',
        isLive ? 'bg-green-100' : 'bg-blue-50'
      )}>
        {isLive ? (
          <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
        ) : (
          <Video className="w-5 h-5 text-blue-600" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          {isLive && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-bold rounded-full">
              EN VIVO
            </span>
          )}
          {isScheduled && session.fecha && (
            <span className="text-xs text-neutral-500">
              {new Date(session.fecha + 'T00:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
              {session.hora_inicio && ` · ${session.hora_inicio.slice(0, 5)}`}
            </span>
          )}
        </div>
        <p className="text-sm font-semibold text-neutral-900 line-clamp-1">{session.titulo}</p>
        {session.descripcion && (
          <p className="text-xs text-neutral-500 mt-0.5 line-clamp-1">{session.descripcion}</p>
        )}
      </div>
      <ChevronRight className="w-4 h-4 text-neutral-400 group-hover:text-blue-600 flex-shrink-0 group-hover:translate-x-0.5 transition-all" />
    </div>
  );
}

// ─── Lead Form ────────────────────────────────────────────────────────────────

function LeadForm() {
  const [form, setForm] = useState({ nombre: '', telefono: '', email: '', mensaje: '' });
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nombre.trim() || !form.email.trim()) return;
    setLoading(true);
    setError('');
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/seguros-education-lead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({
          ...form,
          origen: 'Seguros Education',
          pagina: window.location.href,
          ip: '',
          user_agent: navigator.userAgent,
          fecha: new Date().toISOString(),
        }),
      });
      setSent(true);
    } catch {
      setError('Error al enviar. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="text-center py-10 space-y-4">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h3 className="text-xl font-bold text-neutral-900">Solicitud enviada</h3>
        <p className="text-neutral-600 text-sm max-w-xs mx-auto">
          Hemos recibido tu información. Nos pondremos en contacto contigo a la brevedad.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">Nombre *</label>
          <div className="relative">
            <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              value={form.nombre}
              onChange={(e) => setForm(f => ({ ...f, nombre: e.target.value }))}
              required
              placeholder="Tu nombre completo"
              className="w-full pl-9 pr-4 py-3 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">Teléfono</label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="tel"
              value={form.telefono}
              onChange={(e) => setForm(f => ({ ...f, telefono: e.target.value }))}
              placeholder="10 dígitos"
              className="w-full pl-9 pr-4 py-3 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            />
          </div>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1.5">Correo electrónico *</label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
            required
            placeholder="tu@correo.com"
            className="w-full pl-9 pr-4 py-3 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1.5">Mensaje</label>
        <div className="relative">
          <MessageSquare className="absolute left-3 top-3.5 w-4 h-4 text-neutral-400" />
          <textarea
            value={form.mensaje}
            onChange={(e) => setForm(f => ({ ...f, mensaje: e.target.value }))}
            placeholder="¿Sobre qué programa deseas información?"
            rows={3}
            className="w-full pl-9 pr-4 py-3 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white resize-none"
          />
        </div>
      </div>
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={loading || !form.nombre.trim() || !form.email.trim()}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-white font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-lg active:scale-[0.98]"
        style={{ background: 'linear-gradient(135deg, #0D6EFD, #0047bb)' }}
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> Enviar Solicitud</>}
      </button>
    </form>
  );
}

// ─── Main Landing Page ────────────────────────────────────────────────────────

export default function SegurosEducationLanding() {
  const { usuario, loading: authLoading } = useMoviAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [loginRedirect, setLoginRedirect] = useState<string | undefined>();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [sessions, setSessions] = useState<AulaSession[]>([]);
  const [loadingContent, setLoadingContent] = useState(true);
  const heroRef = useRef<HTMLDivElement>(null);
  const contactoRef = useRef<HTMLElement>(null);

  useEffect(() => {
    async function load() {
      try {
        const [{ data: lessonsData }, { data: sessionsData }] = await Promise.all([
          supabase
            .from('seguros_lessons')
            .select('id, titulo, descripcion, miniatura_url, duracion, categorias:seguros_lesson_categories(categoria:seguros_categories(nombre))')
            .eq('activo', true)
            .order('orden', { ascending: true })
            .limit(6),
          supabase
            .from('aula_sesiones')
            .select('id, titulo, descripcion, fecha, hora_inicio, estado')
            .in('estado', ['activa', 'programada'])
            .order('fecha', { ascending: true })
            .limit(4),
        ]);

        if (lessonsData) {
          setLessons(lessonsData.map((l: any) => ({
            ...l,
            categoria_nombre: l.categorias?.[0]?.categoria?.nombre ?? null,
          })));
        }
        if (sessionsData) setSessions(sessionsData as AulaSession[]);
      } catch {
        // fail silently — landing still works without live data
      } finally {
        setLoadingContent(false);
      }
    }
    load();
  }, []);

  function requireAuth(redirectPath?: string) {
    if (authLoading) return;
    if (usuario) {
      window.location.href = redirectPath || '/seguros-education';
    } else {
      setLoginRedirect(redirectPath);
      setShowLogin(true);
    }
  }

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMobileMenuOpen(false);
  }

  const navItems = [
    { label: 'Inicio', id: 'inicio' },
    { label: 'Modalidades', id: 'modalidades' },
    { label: 'Cursos', id: 'cursos' },
    { label: 'Cédula A', id: 'cedula-a' },
    { label: 'Aula Virtual', id: 'aula-virtual' },
    { label: 'Beneficios', id: 'beneficios' },
    { label: 'Contacto', id: 'contacto' },
  ];

  return (
    <>
      <Helmet>
        <title>Seguros Education | Capacitación Continua para Agentes de Seguros</title>
        <meta name="description" content="Cursos On Demand, Aula Virtual, Curso Cédula A, capacitación presencial, Universidad Quálitas y beneficios académicos para agentes de seguros." />
        <meta name="keywords" content="Curso Cédula A, Capacitación para agentes de seguros, Educación continua seguros, Universidad Quálitas, Seguros Education, Formación aseguradora, Agentes de seguros México" />
        <link rel="canonical" href="https://seguros.education/" />
        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Seguros Education | Capacitación Continua para Agentes de Seguros" />
        <meta property="og:description" content="Cursos On Demand, Aula Virtual, Curso Cédula A, capacitación presencial y beneficios académicos para agentes de seguros." />
        <meta property="og:url" content="https://seguros.education/" />
        <meta property="og:image" content={SE_LOGO} />
        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Seguros Education | Capacitación para Agentes de Seguros" />
        <meta name="twitter:description" content="Cursos On Demand, Aula Virtual, Cédula A y más. Desarrolla tu carrera en seguros." />
        {/* Schema.org */}
        <script type="application/ld+json">{JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'EducationalOrganization',
          name: 'Seguros Education',
          description: 'Plataforma de educación continua para agentes de seguros y fianzas',
          url: 'https://seguros.education',
          logo: SE_LOGO,
          parentOrganization: { '@type': 'Organization', name: 'Grupo JIRO' },
        })}</script>
      </Helmet>

      <div className="font-sans antialiased bg-white text-neutral-900" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

        {/* ─── NAVBAR ───────────────────────────────────────────────────── */}
        <header
          id="inicio"
          className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
          style={{ background: 'rgba(4,12,31,0.92)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              {/* Logo */}
              <button onClick={() => scrollTo('inicio')} className="flex items-center flex-shrink-0">
                <img
                  src={SE_LOGO}
                  alt="Seguros Education"
                  className="h-8 w-auto object-contain"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              </button>

              {/* Desktop Nav */}
              <nav className="hidden lg:flex items-center gap-6">
                {navItems.map((item) => (
                  <NavLink key={item.id} onClick={() => scrollTo(item.id)}>
                    {item.label}
                  </NavLink>
                ))}
              </nav>

              {/* CTA */}
              <div className="flex items-center gap-3">
                {!authLoading && usuario ? (
                  <a
                    href="/seguros-education"
                    className="hidden sm:inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl transition-all hover:opacity-90"
                    style={{ background: 'linear-gradient(135deg, #0D6EFD, #0047bb)' }}
                  >
                    Ir a la plataforma
                    <ArrowRight className="w-4 h-4" />
                  </a>
                ) : (
                  <button
                    onClick={() => setShowLogin(true)}
                    className="hidden sm:inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl transition-all hover:opacity-90"
                    style={{ background: 'linear-gradient(135deg, #0D6EFD, #0047bb)' }}
                  >
                    Ingresar con MOVI Digital
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="lg:hidden p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                >
                  {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="lg:hidden border-t border-white/10 py-4 px-4 space-y-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollTo(item.id)}
                  className="block w-full text-left px-4 py-2.5 text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
                >
                  {item.label}
                </button>
              ))}
              <div className="pt-3 border-t border-white/10">
                {usuario ? (
                  <a
                    href="/seguros-education"
                    className="flex items-center justify-center gap-2 w-full px-4 py-3 text-sm font-semibold text-white rounded-xl"
                    style={{ background: 'linear-gradient(135deg, #0D6EFD, #0047bb)' }}
                  >
                    Ir a la plataforma <ArrowRight className="w-4 h-4" />
                  </a>
                ) : (
                  <button
                    onClick={() => { setMobileMenuOpen(false); setShowLogin(true); }}
                    className="flex items-center justify-center gap-2 w-full px-4 py-3 text-sm font-semibold text-white rounded-xl"
                    style={{ background: 'linear-gradient(135deg, #0D6EFD, #0047bb)' }}
                  >
                    Ingresar con MOVI Digital <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          )}
        </header>

        {/* ─── HERO ─────────────────────────────────────────────────────── */}
        <section
          ref={heroRef}
          className="relative min-h-screen flex items-center pt-16 overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #040c1f 0%, #061428 45%, #081a38 65%, #04101f 100%)' }}
        >
          {/* Grid */}
          <div className="absolute inset-0 pointer-events-none" style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)`,
            backgroundSize: '72px 72px',
          }} />
          {/* Orbs */}
          <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, #0D6EFD 0%, transparent 70%)', opacity: 0.1 }} />
          <div className="absolute bottom-0 -left-32 w-[450px] h-[450px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, #00c8e0 0%, transparent 70%)', opacity: 0.07 }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, #0D6EFD 0%, transparent 60%)', opacity: 0.04 }} />

          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32 w-full">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div className="space-y-8">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold rounded-full uppercase tracking-wide">
                    <GraduationCap className="w-3.5 h-3.5" /> Plataforma educativa
                  </span>
                </div>

                <div className="space-y-4">
                  <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight tracking-tight">
                    <span className="text-white">Capacitación continua</span>
                    <br />
                    <span className="text-white">para </span>
                    <GradientText>agentes de seguros</GradientText>
                  </h1>
                  <p className="text-lg text-white/55 leading-relaxed max-w-lg">
                    Aprende, certifícate y desarrolla tu carrera profesional con cursos On Demand, Aula Virtual, capacitación presencial y programas especializados para el sector asegurador.
                  </p>
                </div>

                <div className="flex flex-wrap gap-4">
                  <button
                    onClick={() => scrollTo('contacto')}
                    className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl text-white font-bold text-sm transition-all hover:shadow-2xl hover:shadow-blue-500/25 active:scale-[0.98]"
                    style={{ background: 'linear-gradient(135deg, #0D6EFD, #0047bb)' }}
                  >
                    Solicitar Información
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => scrollTo('cursos')}
                    className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl text-white/80 font-semibold text-sm border border-white/15 hover:border-white/30 hover:text-white transition-all"
                  >
                    Explorar Programas
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Quick stats */}
                <div className="flex flex-wrap gap-6 pt-4 border-t border-white/10">
                  {[
                    { label: 'Cursos disponibles', value: '24/7' },
                    { label: 'Modalidades', value: '3' },
                    { label: 'Red nacional', value: 'Grupo JIRO' },
                  ].map((s) => (
                    <div key={s.label} className="space-y-0.5">
                      <p className="text-xl font-extrabold text-white">{s.value}</p>
                      <p className="text-xs text-white/40">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right panel — feature cards */}
              <div className="hidden lg:grid grid-cols-2 gap-4">
                {[
                  { icon: Monitor, title: 'On Demand', desc: 'Aprende a tu propio ritmo, en cualquier momento y lugar.', color: 'from-blue-600 to-blue-700' },
                  { icon: Video, title: 'Aula Virtual', desc: 'Sesiones en vivo con instructores especializados.', color: 'from-cyan-600 to-blue-600' },
                  { icon: GraduationCap, title: 'Cédula A', desc: 'Programa de preparación para agentes certificados.', color: 'from-indigo-600 to-blue-600' },
                  { icon: Building2, title: 'Presencial', desc: 'Talleres y networking en la Red Nacional de Oficinas.', color: 'from-blue-700 to-indigo-700' },
                ].map((card) => (
                  <div
                    key={card.title}
                    className="rounded-2xl p-5 bg-white/[0.04] border border-white/[0.07] hover:bg-white/[0.07] transition-colors space-y-3"
                  >
                    <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br', card.color)}>
                      <card.icon className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="font-bold text-white text-sm">{card.title}</h3>
                    <p className="text-xs text-white/45 leading-relaxed">{card.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Scroll indicator */}
          <button
            onClick={() => scrollTo('modalidades')}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/30 hover:text-white/60 transition-colors animate-bounce"
          >
            <ChevronDown className="w-6 h-6" />
          </button>
        </section>

        {/* ─── MODALIDADES ─────────────────────────────────────────────── */}
        <section id="modalidades" className="py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center space-y-4 mb-16">
              <SectionTag>Modalidades de aprendizaje</SectionTag>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-neutral-900">
                Aprende como quieras,<br />
                <GradientText>cuando quieras</GradientText>
              </h2>
              <p className="text-neutral-500 max-w-xl mx-auto text-base">
                Tres modalidades diseñadas para adaptarse a tu agenda y estilo de aprendizaje.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  icon: Monitor,
                  title: 'On Demand',
                  badge: '24/7',
                  badgeColor: 'bg-blue-50 text-blue-700',
                  desc: 'Accede a todos los cursos grabados cuando quieras. Pausa, retoma y aprende a tu propio ritmo desde cualquier dispositivo.',
                  features: ['Acceso ilimitado', 'Progreso guardado', 'Certificado al completar', 'Disponible en móvil'],
                  cta: 'Ver cursos disponibles',
                  action: () => requireAuth('/seguros-education/on-demand'),
                  gradient: 'from-blue-500 to-blue-700',
                },
                {
                  icon: Video,
                  title: 'Aula Virtual',
                  badge: 'En Vivo',
                  badgeColor: 'bg-green-50 text-green-700',
                  desc: 'Sesiones interactivas en tiempo real con instructores. Talleres, webinars y capacitación dinámica con especialistas del sector.',
                  features: ['Sesiones en vivo', 'Interacción directa', 'Talleres especializados', 'Grabaciones disponibles'],
                  cta: 'Ver próximas sesiones',
                  action: () => requireAuth('/seguros-education/aula-virtual'),
                  gradient: 'from-cyan-500 to-blue-600',
                },
                {
                  icon: MapPin,
                  title: 'Presencial',
                  badge: 'Red Nacional',
                  badgeColor: 'bg-orange-50 text-orange-700',
                  desc: 'Capacitación cara a cara en la Red Nacional de Oficinas Grupo JIRO. Networking, talleres y eventos presenciales en todo el país.',
                  features: ['Talleres prácticos', 'Networking profesional', 'Eventos especializados', 'Cobertura nacional'],
                  cta: 'Solicitar información',
                  action: () => scrollTo('contacto'),
                  gradient: 'from-orange-400 to-orange-600',
                },
              ].map((m) => (
                <div
                  key={m.title}
                  className="group rounded-3xl border border-neutral-100 bg-white hover:shadow-xl hover:border-neutral-200 transition-all duration-300 overflow-hidden flex flex-col"
                >
                  <div className={cn('h-2 bg-gradient-to-r', m.gradient)} />
                  <div className="p-8 flex flex-col flex-1 space-y-5">
                    <div className="flex items-start justify-between">
                      <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-br', m.gradient)}>
                        <m.icon className="w-6 h-6 text-white" />
                      </div>
                      <span className={cn('px-2.5 py-1 text-xs font-bold rounded-full', m.badgeColor)}>
                        {m.badge}
                      </span>
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xl font-bold text-neutral-900">{m.title}</h3>
                      <p className="text-neutral-500 text-sm leading-relaxed">{m.desc}</p>
                    </div>
                    <ul className="space-y-2 flex-1">
                      {m.features.map((f) => (
                        <li key={f} className="flex items-center gap-2 text-sm text-neutral-600">
                          <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={m.action}
                      className="mt-auto w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold border border-neutral-200 hover:border-blue-300 hover:text-blue-600 transition-colors group-hover:bg-blue-50"
                    >
                      {m.cta}
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── CÉDULA A (FEATURED) ─────────────────────────────────────── */}
        <section id="cedula-a" className="py-24 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #040c1f 0%, #0a1a3a 50%, #061428 100%)' }}>
          <div className="absolute inset-0 pointer-events-none" style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }} />
          <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, #0D6EFD 0%, transparent 65%)', opacity: 0.12 }} />

          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div className="space-y-8">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-yellow-400/10 border border-yellow-400/20 text-yellow-400 text-xs font-semibold rounded-full uppercase tracking-wide">
                    <Star className="w-3 h-3 fill-yellow-400" /> Programa Estrella
                  </span>
                </div>
                <div className="space-y-4">
                  <h2 className="text-4xl sm:text-5xl font-extrabold text-white leading-tight">
                    Curso
                    <br />
                    <GradientText>Cédula A</GradientText>
                  </h2>
                  <p className="text-white/60 text-lg leading-relaxed max-w-lg">
                    Prepárate para convertirte en agente profesional de seguros. Programa integral diseñado especialmente para futuros agentes que desean obtener su Cédula A.
                  </p>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  {[
                    { icon: BookOpen, label: 'Formación integral', desc: 'Marco legal, productos y técnicas de venta' },
                    { icon: Award, label: 'Contenido actualizado', desc: 'Alineado con los requisitos CNSF vigentes' },
                    { icon: Users, label: 'Acompañamiento profesional', desc: 'Instructores con experiencia en el sector' },
                    { icon: Zap, label: 'Preparación especializada', desc: 'Material enfocado al examen oficial' },
                  ].map((f) => (
                    <div key={f.label} className="flex items-start gap-3 p-4 rounded-2xl bg-white/[0.04] border border-white/[0.07]">
                      <div className="w-8 h-8 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                        <f.icon className="w-4 h-4 text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{f.label}</p>
                        <p className="text-xs text-white/45 mt-0.5">{f.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-4">
                  <button
                    onClick={() => requireAuth('/cedula-a')}
                    className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl text-white font-bold text-sm transition-all hover:shadow-2xl hover:shadow-blue-500/25 active:scale-[0.98]"
                    style={{ background: 'linear-gradient(135deg, #0D6EFD, #0047bb)' }}
                  >
                    Acceder al Curso
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => scrollTo('contacto')}
                    className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl text-white/80 font-semibold text-sm border border-white/15 hover:border-white/30 hover:text-white transition-all"
                  >
                    Quiero Más Información
                  </button>
                </div>
              </div>

              {/* Visual card */}
              <div className="relative">
                <div className="rounded-3xl p-8 bg-white/[0.04] border border-white/[0.08] space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-500/30">
                      <GraduationCap className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <h3 className="text-white font-bold text-lg">Cédula A</h3>
                      <p className="text-white/50 text-sm">Agente de Seguros Certificado</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {['Marco Legal del Sector Asegurador', 'Seguros de Personas y Daños', 'Técnicas de Venta y Asesoría', 'Reglamento de Agentes', 'Sistemas Financieros', 'Práctica y Simulacros'].map((m, i) => (
                      <div key={m} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                        <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                          <span className="text-blue-400 text-xs font-bold">{i + 1}</span>
                        </div>
                        <span className="text-white/70 text-sm">{m}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20">
                    <div>
                      <p className="text-white text-sm font-semibold">Grupo JIRO</p>
                      <p className="text-white/50 text-xs mt-0.5">Red Nacional de Oficinas</p>
                    </div>
                    <Award className="w-8 h-8 text-blue-400" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── CURSOS DESTACADOS ────────────────────────────────────────── */}
        <section id="cursos" className="py-24 bg-neutral-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-12">
              <div className="space-y-3">
                <SectionTag>Cursos On Demand</SectionTag>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-neutral-900">
                  Aprende a tu ritmo
                </h2>
                <p className="text-neutral-500 max-w-lg">
                  Contenido especializado para el sector asegurador, disponible las 24 horas.
                </p>
              </div>
              <button
                onClick={() => requireAuth('/seguros-education/on-demand')}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold text-sm whitespace-nowrap"
              >
                Ver todos los cursos <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {loadingContent ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="rounded-2xl bg-neutral-100 animate-pulse" style={{ height: 280 }} />
                ))}
              </div>
            ) : lessons.length > 0 ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {lessons.map((lesson) => (
                  <CourseCard
                    key={lesson.id}
                    lesson={lesson}
                    onAccess={() => requireAuth('/seguros-education/on-demand')}
                  />
                ))}
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[
                  { title: 'Fundamentos del Seguro de Vida', cat: 'Seguros de Personas', dur: 45 },
                  { title: 'Introducción al Seguro de Gastos Médicos Mayores', cat: 'Seguros de Personas', dur: 60 },
                  { title: 'Seguro de Autos: Coberturas y Condicionados', cat: 'Seguros de Daños', dur: 40 },
                  { title: 'Técnicas de Venta para Agentes de Seguros', cat: 'Ventas', dur: 50 },
                  { title: 'Marco Legal del Sector Asegurador en México', cat: 'Marco Legal', dur: 55 },
                  { title: 'Cómo Asesorar en Seguros de Retiro y Ahorro', cat: 'Seguros de Personas', dur: 35 },
                ].map((lesson) => (
                  <CourseCard
                    key={lesson.title}
                    lesson={{ id: lesson.title, titulo: lesson.title, descripcion: '', miniatura_url: null, duracion: lesson.dur, categoria_nombre: lesson.cat }}
                    onAccess={() => requireAuth('/seguros-education/on-demand')}
                  />
                ))}
              </div>
            )}

            <div className="mt-10 text-center">
              <button
                onClick={() => requireAuth('/seguros-education/on-demand')}
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl text-white font-semibold text-sm transition-all hover:shadow-lg active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #0D6EFD, #0047bb)' }}
              >
                Acceder a todos los cursos
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>

        {/* ─── AULA VIRTUAL ─────────────────────────────────────────────── */}
        <section id="aula-virtual" className="py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-16 items-start">
              <div className="space-y-6">
                <SectionTag>Aula Virtual</SectionTag>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-neutral-900">
                  Sesiones en vivo con{' '}
                  <GradientText>especialistas</GradientText>
                </h2>
                <p className="text-neutral-500 leading-relaxed">
                  Participa en sesiones interactivas impartidas por expertos del sector asegurador. Talleres, webinars y capacitación dinámica para potenciar tus habilidades.
                </p>
                <div className="grid sm:grid-cols-2 gap-4">
                  {[
                    { icon: Video, label: 'Sesiones en vivo', desc: 'Interacción directa con el instructor' },
                    { icon: Calendar, label: 'Calendario de eventos', desc: 'Próximas sesiones programadas' },
                    { icon: Wifi, label: 'Grabaciones', desc: 'Accede a sesiones anteriores' },
                    { icon: Users, label: 'Comunidad activa', desc: 'Networking con otros agentes' },
                  ].map((f) => (
                    <div key={f.label} className="flex items-start gap-3 p-4 rounded-2xl bg-neutral-50 border border-neutral-100">
                      <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <f.icon className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-neutral-900">{f.label}</p>
                        <p className="text-xs text-neutral-500 mt-0.5">{f.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => requireAuth('/seguros-education/aula-virtual')}
                  className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl text-white font-semibold text-sm transition-all hover:shadow-lg active:scale-[0.98]"
                  style={{ background: 'linear-gradient(135deg, #0D6EFD, #0047bb)' }}
                >
                  Ver próximas sesiones
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-neutral-900">Próximas sesiones</h3>
                  <button
                    onClick={() => requireAuth('/seguros-education/aula-virtual')}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                  >
                    Ver calendario <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {loadingContent ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="h-20 rounded-2xl bg-neutral-100 animate-pulse" />
                    ))}
                  </div>
                ) : sessions.length > 0 ? (
                  <div className="space-y-3">
                    {sessions.map((s) => (
                      <EventCard
                        key={s.id}
                        session={s}
                        onAccess={() => requireAuth('/seguros-education/aula-virtual')}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {[
                      { titulo: 'Novedades en GMM 2026: Lo que todo agente debe saber', fecha: 'Próximamente', estado: 'programada' },
                      { titulo: 'Técnicas avanzadas de cierre en seguros de vida', fecha: 'Próximamente', estado: 'programada' },
                      { titulo: 'Actualización fiscal para agentes de seguros', fecha: 'Próximamente', estado: 'programada' },
                    ].map((s) => (
                      <EventCard
                        key={s.titulo}
                        session={{ id: s.titulo, titulo: s.titulo, estado: s.estado }}
                        onAccess={() => requireAuth('/seguros-education/aula-virtual')}
                      />
                    ))}
                  </div>
                )}

                <div className="rounded-2xl p-5 bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-100 space-y-3 mt-6">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-blue-600" />
                    <h4 className="font-semibold text-neutral-900 text-sm">Próximos eventos presenciales</h4>
                  </div>
                  <p className="text-sm text-neutral-600">
                    Talleres y capacitaciones en la Red Nacional de Oficinas Grupo JIRO. Networking, eventos y formación práctica cerca de ti.
                  </p>
                  <button
                    onClick={() => scrollTo('contacto')}
                    className="text-sm font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    Consultar disponibilidad <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── UNIVERSIDAD QUÁLITAS + UTEL ─────────────────────────────── */}
        <section className="py-24 bg-neutral-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center space-y-4 mb-16">
              <SectionTag>Alianzas académicas</SectionTag>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-neutral-900">
                Beneficios académicos <GradientText>exclusivos</GradientText>
              </h2>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {/* Universidad Quálitas */}
              <div className="bg-white rounded-3xl border border-neutral-100 overflow-hidden hover:shadow-xl transition-all duration-300 flex flex-col">
                <div className="h-2 bg-gradient-to-r from-blue-600 to-cyan-500" />
                <div className="p-8 flex flex-col flex-1 space-y-5">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <GraduationCap className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-neutral-900">Universidad Quálitas</h3>
                      <p className="text-sm text-neutral-500 mt-0.5">Formación especializada en seguros</p>
                    </div>
                  </div>
                  <p className="text-neutral-600 text-sm leading-relaxed flex-1">
                    Accede a contenido educativo especializado de la Universidad Quálitas a través de Seguros Education. Formación técnica y práctica para potenciar tu desempeño como agente de seguros.
                  </p>
                  <ul className="space-y-2">
                    {['Educación continua especializada', 'Contenido técnico del sector', 'Desarrollo profesional certificado'].map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-neutral-600">
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => requireAuth('/seguros-education')}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-blue-600 border border-blue-200 hover:bg-blue-50 transition-colors"
                  >
                    Conocer más <ExternalLink className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Universidad UTEL */}
              <div className="bg-white rounded-3xl border border-neutral-100 overflow-hidden hover:shadow-xl transition-all duration-300 flex flex-col">
                <div className="h-2 bg-gradient-to-r from-orange-400 to-orange-600" />
                <div className="p-8 flex flex-col flex-1 space-y-5">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-orange-100 flex items-center justify-center flex-shrink-0">
                      <Award className="w-6 h-6 text-orange-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-neutral-900">Universidad UTEL</h3>
                      <p className="text-sm text-neutral-500 mt-0.5">Becas y beneficios académicos</p>
                    </div>
                  </div>
                  <p className="text-neutral-600 text-sm leading-relaxed flex-1">
                    Beneficios académicos exclusivos para agentes de Grupo JIRO. Accede a becas y programas especiales en la Universidad UTEL para continuar con tu educación formal.
                  </p>
                  <ul className="space-y-2">
                    {['Becas exclusivas disponibles', 'Programas de licenciatura y posgrado', 'Educación en línea flexible'].map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-neutral-600">
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => scrollTo('contacto')}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-orange-600 border border-orange-200 hover:bg-orange-50 transition-colors"
                  >
                    Solicitar Información <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── BENEFICIOS ───────────────────────────────────────────────── */}
        <section id="beneficios" className="py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center space-y-4 mb-16">
              <SectionTag>Por qué elegirnos</SectionTag>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-neutral-900">
                Todo lo que necesitas para <GradientText>crecer profesionalmente</GradientText>
              </h2>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { icon: Globe, title: 'Aprende desde cualquier lugar', desc: 'Plataforma 100% accesible desde cualquier dispositivo con conexión a internet.' },
                { icon: Clock, title: 'Acceso 24/7', desc: 'Los cursos On Demand están disponibles en cualquier momento, sin restricciones horarias.' },
                { icon: BookOpen, title: 'Contenido especializado', desc: 'Material diseñado por expertos del sector asegurador mexicano.' },
                { icon: Zap, title: 'Formación práctica', desc: 'Casos reales, simulaciones y ejercicios aplicados a la venta de seguros.' },
                { icon: Award, title: 'Certificaciones', desc: 'Reconocimiento formal de tus conocimientos y habilidades profesionales.' },
                { icon: Users, title: 'Comunidad profesional', desc: 'Conecta con otros agentes y especialistas del sector asegurador.' },
                { icon: GraduationCap, title: 'Alianzas académicas', desc: 'Universidad Quálitas y Universidad UTEL para tu desarrollo continuo.' },
                { icon: MapPin, title: 'Red nacional de oficinas', desc: 'Capacitación presencial en toda la República Mexicana a través de Grupo JIRO.' },
              ].map((b) => (
                <div
                  key={b.title}
                  className="group p-6 rounded-2xl border border-neutral-100 bg-neutral-50 hover:bg-white hover:border-blue-100 hover:shadow-lg transition-all duration-300 space-y-4"
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-100 group-hover:bg-blue-600 flex items-center justify-center transition-colors">
                    <b.icon className="w-5 h-5 text-blue-600 group-hover:text-white transition-colors" />
                  </div>
                  <h3 className="font-bold text-neutral-900 text-sm leading-tight">{b.title}</h3>
                  <p className="text-neutral-500 text-xs leading-relaxed">{b.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── RED NACIONAL ─────────────────────────────────────────────── */}
        <section className="py-24 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #040c1f 0%, #0a1a3a 50%, #061428 100%)' }}>
          <div className="absolute inset-0 pointer-events-none" style={{
            backgroundImage: `radial-gradient(rgba(13,110,253,0.08) 1px, transparent 1px)`,
            backgroundSize: '30px 30px',
          }} />
          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
            <div className="space-y-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 border border-white/15 text-white/70 text-xs font-semibold rounded-full uppercase tracking-wide">
                <Building2 className="w-3.5 h-3.5" /> Red Nacional
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight">
                Capacitación presencial en toda{' '}
                <GradientText>la República Mexicana</GradientText>
              </h2>
              <p className="text-white/50 max-w-2xl mx-auto text-lg">
                Capacitación presencial disponible a través de la Red Nacional de Oficinas Grupo JIRO. Eventos, talleres y networking cerca de ti.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-3xl mx-auto">
              {[
                { icon: Building2, label: 'Oficinas', desc: 'Red nacional activa' },
                { icon: Calendar, label: 'Eventos', desc: 'Talleres y capacitaciones' },
                { icon: Users, label: 'Networking', desc: 'Conecta con colegas' },
                { icon: Award, label: 'Especialización', desc: 'Formación práctica' },
              ].map((item) => (
                <div key={item.label} className="p-5 rounded-2xl bg-white/[0.05] border border-white/[0.08] space-y-2">
                  <item.icon className="w-6 h-6 text-blue-400 mx-auto" />
                  <p className="font-bold text-white text-sm">{item.label}</p>
                  <p className="text-white/45 text-xs">{item.desc}</p>
                </div>
              ))}
            </div>

            <button
              onClick={() => scrollTo('contacto')}
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl text-white font-semibold text-sm border border-white/20 hover:border-white/40 hover:bg-white/5 transition-all"
            >
              Consultar disponibilidad en mi área
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </section>

        {/* ─── CONTACTO / FORMULARIO ───────────────────────────────────── */}
        <section id="contacto" ref={contactoRef as any} className="py-24 bg-neutral-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-16 items-start">
              <div className="space-y-8">
                <div className="space-y-4">
                  <SectionTag>Contacto</SectionTag>
                  <h2 className="text-3xl sm:text-4xl font-extrabold text-neutral-900">
                    ¿Listo para{' '}
                    <GradientText>desarrollarte profesionalmente?</GradientText>
                  </h2>
                  <p className="text-neutral-500 leading-relaxed">
                    Completa el formulario y uno de nuestros asesores te contactará a la brevedad para orientarte sobre el programa más adecuado para ti.
                  </p>
                </div>

                <div className="space-y-4">
                  {[
                    { icon: GraduationCap, title: 'Curso Cédula A', desc: 'Prepárate para la certificación oficial' },
                    { icon: Monitor, title: 'Cursos On Demand', desc: 'Aprende a tu propio ritmo' },
                    { icon: Video, title: 'Aula Virtual', desc: 'Sesiones en vivo con especialistas' },
                    { icon: Award, title: 'Becas UTEL', desc: 'Beneficios académicos exclusivos' },
                  ].map((item) => (
                    <div key={item.title} className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-neutral-100 shadow-sm">
                      <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <item.icon className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-neutral-900">{item.title}</p>
                        <p className="text-xs text-neutral-500">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-neutral-100 p-8 shadow-xl">
                <h3 className="text-xl font-bold text-neutral-900 mb-6">Solicita Información</h3>
                <LeadForm />
              </div>
            </div>
          </div>
        </section>

        {/* ─── FOOTER ───────────────────────────────────────────────────── */}
        <footer style={{ background: '#040c1f' }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-8">
              <div className="space-y-3">
                <img
                  src={SE_LOGO}
                  alt="Seguros Education"
                  className="h-8 w-auto object-contain"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
                <p className="text-white/40 text-xs max-w-xs">
                  Plataforma de educación continua para agentes de seguros y fianzas. Grupo JIRO.
                </p>
              </div>
              <div className="flex flex-wrap gap-6 text-xs text-white/30">
                <button onClick={() => scrollTo('modalidades')} className="hover:text-white/60 transition-colors">Modalidades</button>
                <button onClick={() => scrollTo('cursos')} className="hover:text-white/60 transition-colors">Cursos</button>
                <button onClick={() => scrollTo('cedula-a')} className="hover:text-white/60 transition-colors">Cédula A</button>
                <button onClick={() => scrollTo('beneficios')} className="hover:text-white/60 transition-colors">Beneficios</button>
                <button onClick={() => scrollTo('contacto')} className="hover:text-white/60 transition-colors">Contacto</button>
              </div>
            </div>
            <div className="mt-8 pt-6 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-white/20">
              <p>© {new Date().getFullYear()} Seguros Education · Grupo JIRO. Todos los derechos reservados.</p>
              <div className="flex gap-4">
                <a href="https://movi.digital" className="hover:text-white/40 transition-colors" target="_blank" rel="noopener noreferrer">MOVI Digital</a>
                <a href="https://seguwallet.mx" className="hover:text-white/40 transition-colors" target="_blank" rel="noopener noreferrer">Seguwallet</a>
              </div>
            </div>
          </div>
        </footer>

      </div>

      {/* ─── LOGIN MODAL ─────────────────────────────────────────────── */}
      {showLogin && (
        <SELoginModal
          onClose={() => setShowLogin(false)}
          onSuccess={() => {
            setShowLogin(false);
            if (loginRedirect) window.location.href = loginRedirect;
          }}
          redirectTo={loginRedirect}
        />
      )}
    </>
  );
}
