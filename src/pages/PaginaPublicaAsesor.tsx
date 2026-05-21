import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Phone, Mail, MessageCircle, Loader2, ChevronLeft, ChevronRight, ArrowUp, Car, ExternalLink, Search, X } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { getPublicWebPageBySlug } from '../lib/webPagesUtils';
import type { PublicWebPageData, SharedFormLink } from '../lib/webPagesTypes';
import { DEFAULT_TEXT } from '../lib/webPagesTypes';
import { createColorVariant } from '../lib/animationUtils';

// --- Insurance metadata: icon, description, priority, category ---

interface InsuranceMeta {
  icon: string;
  description: string;
  priority: number;
  category: string;
}

const INSURANCE_CATEGORIES = {
  personales: 'Personales',
  vehiculos: 'Vehiculos',
  hogar: 'Hogar y Patrimonio',
  empresariales: 'Empresariales',
  especializados: 'Especializados',
  otros: 'Otros',
} as const;

type CategoryKey = keyof typeof INSURANCE_CATEGORIES;

const FORM_TYPE_META: Record<string, InsuranceMeta> = {
  auto: { icon: 'Car', description: 'Protege tu vehiculo con coberturas completas contra accidentes, robo y danos a terceros.', priority: 1, category: 'vehiculos' },
  vida: { icon: 'Heart', description: 'Asegura el bienestar economico de tu familia con planes de vida a tu medida.', priority: 2, category: 'personales' },
  gmm: { icon: 'Stethoscope', description: 'Accede a la mejor atencion medica con cobertura hospitalaria y de especialistas.', priority: 3, category: 'personales' },
  gastos_medicos: { icon: 'Stethoscope', description: 'Accede a la mejor atencion medica con cobertura hospitalaria y de especialistas.', priority: 3, category: 'personales' },
  salud: { icon: 'HeartPulse', description: 'Cuida tu salud y la de los tuyos con planes de atencion preventiva y hospitalaria.', priority: 4, category: 'personales' },
  hogar: { icon: 'Home', description: 'Protege tu patrimonio contra incendios, robos, desastres naturales y mas.', priority: 5, category: 'hogar' },
  casa: { icon: 'Home', description: 'Protege tu hogar contra incendios, robos, desastres naturales y mas.', priority: 5, category: 'hogar' },
  motocicleta: { icon: 'Bike', description: 'Protege tu motocicleta con coberturas de danos, robo y responsabilidad civil.', priority: 6, category: 'vehiculos' },
  moto: { icon: 'Bike', description: 'Protege tu motocicleta con coberturas de danos, robo y responsabilidad civil.', priority: 6, category: 'vehiculos' },
  accidentes_personales: { icon: 'ShieldAlert', description: 'Cobertura ante accidentes con indemnizaciones por invalidez, gastos medicos y fallecimiento.', priority: 7, category: 'personales' },
  empresa: { icon: 'Building2', description: 'Seguros empresariales que protegen tus activos, empleados y operaciones.', priority: 8, category: 'empresariales' },
  negocio: { icon: 'Building2', description: 'Seguros para tu negocio que cubren responsabilidad civil, danos y mas.', priority: 8, category: 'empresariales' },
  pyme: { icon: 'Store', description: 'Proteccion integral para pequenas y medianas empresas con coberturas a la medida.', priority: 9, category: 'empresariales' },
  responsabilidad_civil: { icon: 'Shield', description: 'Protegete ante reclamaciones de terceros por danos materiales o personales.', priority: 10, category: 'empresariales' },
  rc: { icon: 'Shield', description: 'Protegete ante reclamaciones de terceros por danos materiales o personales.', priority: 10, category: 'empresariales' },
  transporte: { icon: 'Truck', description: 'Cobertura integral para mercancia en transito nacional e internacional.', priority: 11, category: 'vehiculos' },
  flotilla: { icon: 'Bus', description: 'Seguros para flotillas vehiculares con tarifas preferenciales y atencion prioritaria.', priority: 12, category: 'vehiculos' },
  camion: { icon: 'Truck', description: 'Proteccion completa para camiones de carga con coberturas de danos y RC.', priority: 13, category: 'vehiculos' },
  viaje: { icon: 'Plane', description: 'Viaja tranquilo con cobertura medica, cancelaciones y equipaje en el extranjero.', priority: 14, category: 'especializados' },
  mascota: { icon: 'PawPrint', description: 'Protege a tu mejor amigo con cobertura veterinaria y de accidentes.', priority: 15, category: 'hogar' },
  educacion: { icon: 'GraduationCap', description: 'Asegura el futuro educativo de tus hijos con planes de ahorro e inversion.', priority: 16, category: 'personales' },
  ahorro: { icon: 'PiggyBank', description: 'Haz crecer tu dinero con planes de ahorro e inversion respaldados por aseguradoras.', priority: 17, category: 'personales' },
  retiro: { icon: 'Landmark', description: 'Planifica tu retiro con productos de ahorro a largo plazo y rendimientos garantizados.', priority: 18, category: 'personales' },
  dental: { icon: 'Smile', description: 'Cobertura dental completa para tratamientos preventivos, correctivos y de emergencia.', priority: 19, category: 'personales' },
  condominio: { icon: 'Building', description: 'Proteccion para areas comunes y estructura de condominios.', priority: 20, category: 'hogar' },
  incendio: { icon: 'Flame', description: 'Cobertura contra incendios, explosiones y fenomenos naturales para tu propiedad.', priority: 21, category: 'hogar' },
  robo: { icon: 'Lock', description: 'Proteccion contra robos con o sin violencia para tu patrimonio.', priority: 22, category: 'hogar' },
  equipo_electronico: { icon: 'Monitor', description: 'Cobertura para equipos electronicos contra danos, robo y fallas electricas.', priority: 23, category: 'hogar' },
  construccion: { icon: 'HardHat', description: 'Seguros para obras en construccion que cubren danos materiales y RC.', priority: 24, category: 'empresariales' },
  caucion: { icon: 'FileCheck', description: 'Fianzas y seguros de caucion para cumplimiento de contratos y licitaciones.', priority: 25, category: 'empresariales' },
  credito: { icon: 'CreditCard', description: 'Proteccion ante incumplimiento de pago por parte de deudores comerciales.', priority: 26, category: 'empresariales' },
  agricola: { icon: 'Leaf', description: 'Cobertura para cultivos y actividades agricolas ante fenomenos climaticos.', priority: 27, category: 'especializados' },
  maritimo: { icon: 'Ship', description: 'Seguros maritimos para embarcaciones, carga y responsabilidad civil en el mar.', priority: 28, category: 'especializados' },
  aviacion: { icon: 'PlaneTakeoff', description: 'Cobertura para aeronaves, pilotos y pasajeros en operaciones aereas.', priority: 29, category: 'especializados' },
  taxi: { icon: 'CarTaxiFront', description: 'Seguro especializado para taxis y vehiculos de transporte publico.', priority: 30, category: 'vehiculos' },
  uber: { icon: 'Smartphone', description: 'Seguro para conductores de plataformas digitales de transporte.', priority: 31, category: 'vehiculos' },
  eventos: { icon: 'Calendar', description: 'Cobertura para eventos especiales contra cancelaciones e imprevistos.', priority: 32, category: 'especializados' },
};

const DEFAULT_FEATURED_TYPES = ['auto', 'gastos_medicos', 'gmm', 'vida', 'hogar', 'motocicleta', 'moto', 'accidentes_personales'];

function getFormLinkMeta(link: SharedFormLink): InsuranceMeta {
  const typeKey = link.form_type?.toLowerCase().replace(/[^a-z_]/g, '') || '';
  if (FORM_TYPE_META[typeKey]) return FORM_TYPE_META[typeKey];

  const title = link.form_title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const [key, meta] of Object.entries(FORM_TYPE_META)) {
    if (title.includes(key.replace(/_/g, ' '))) return meta;
  }
  if (title.includes('auto') || title.includes('vehiculo') || title.includes('carro')) return FORM_TYPE_META.auto;
  if (title.includes('vida')) return FORM_TYPE_META.vida;
  if (title.includes('gastos medicos') || title.includes('gmm') || title.includes('medic')) return FORM_TYPE_META.gmm;
  if (title.includes('salud')) return FORM_TYPE_META.salud;
  if (title.includes('hogar') || title.includes('casa')) return FORM_TYPE_META.hogar;
  if (title.includes('empresa') || title.includes('negocio') || title.includes('pyme')) return FORM_TYPE_META.empresa;
  if (title.includes('viaje')) return FORM_TYPE_META.viaje;
  if (title.includes('mascota')) return FORM_TYPE_META.mascota;
  if (title.includes('transporte') || title.includes('carga')) return FORM_TYPE_META.transporte;
  if (title.includes('moto')) return FORM_TYPE_META.moto;
  if (title.includes('flotilla')) return FORM_TYPE_META.flotilla;
  if (title.includes('accidente')) return FORM_TYPE_META.accidentes_personales;
  if (title.includes('responsabilidad') || title.includes('rc')) return FORM_TYPE_META.responsabilidad_civil;
  if (title.includes('incendio')) return FORM_TYPE_META.incendio;
  if (title.includes('robo')) return FORM_TYPE_META.robo;
  if (title.includes('dental')) return FORM_TYPE_META.dental;
  if (title.includes('condominio')) return FORM_TYPE_META.condominio;
  if (title.includes('taxi')) return FORM_TYPE_META.taxi;
  if (title.includes('uber') || title.includes('plataforma')) return FORM_TYPE_META.uber;
  if (title.includes('agricol')) return FORM_TYPE_META.agricola;
  if (title.includes('construcci')) return FORM_TYPE_META.construccion;

  return { icon: 'FileText', description: 'Solicita una cotizacion personalizada con atencion profesional y sin compromiso.', priority: 99, category: 'otros' };
}

function cleanFormTitle(title: string): string {
  return title
    .replace(/^formulario\s+de\s+/i, '')
    .replace(/^cotizaci[oó]n\s+de\s+/i, '')
    .replace(/^solicitud\s+de\s+/i, '')
    .replace(/^seguro\s+de\s+/i, '')
    .trim()
    .replace(/^\w/, c => c.toUpperCase());
}

interface ProcessedFormLink {
  slug: string;
  form_title: string;
  form_type: string;
  form_slug: string;
  quote_form_template_id: string | null;
  meta: InsuranceMeta;
  displayName: string;
  isFeatured: boolean;
  publicUrl: string;
}

declare global {
  interface Window {
    grecaptcha: {
      ready: (callback: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

export default function PaginaPublicaAsesor() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<PublicWebPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAutoScrolling, setIsAutoScrolling] = useState(true);
  const carouselRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState({
    nombre: '',
    celular: '',
    email: '',
    seguro_interes: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [showAllFeatured, setShowAllFeatured] = useState(false);

  useEffect(() => {
    if (!slug) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    loadPageData();
  }, [slug]);

  useEffect(() => {
    const handleScroll = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!data?.insurers || data.insurers.length <= 4 || !isAutoScrolling) return;
    const interval = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % Math.ceil(data.insurers!.length / 4));
    }, 3000);
    return () => clearInterval(interval);
  }, [data?.insurers, isAutoScrolling]);

  async function loadPageData() {
    if (!slug) return;
    try {
      const pageData = await getPublicWebPageBySlug(slug);
      if (!pageData || !pageData.user || !pageData.config?.is_published) {
        setNotFound(true);
      } else {
        setData(pageData);
      }
    } catch (error) {
      console.error('Error loading public page:', error);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitLead(e: React.FormEvent) {
    e.preventDefault();
    if (!slug || !formData.nombre || !formData.celular || !formData.email || !formData.seguro_interes) return;
    setIsSubmitting(true);
    setSubmitStatus('idle');
    try {
      const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
      if (!siteKey) throw new Error('reCAPTCHA no configurado');
      const recaptchaToken = await window.grecaptcha.execute(siteKey, { action: 'submit_lead' });
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://qhwvuuyjhcennqccgvse.supabase.co';
      const response = await fetch(`${supabaseUrl}/functions/v1/submit-web-lead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug, nombre: formData.nombre, celular: formData.celular,
          email: formData.email, seguro_interes: formData.seguro_interes, recaptchaToken,
        }),
      });
      const responseData = await response.json();
      if (!response.ok || !responseData.success) throw new Error(responseData.error || 'Error');
      setSubmitStatus('success');
      setFormData({ nombre: '', celular: '', email: '', seguro_interes: '' });
    } catch (error) {
      console.error('Error submitting lead:', error);
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  }

  // Process form links
  const processedLinks: ProcessedFormLink[] = useMemo(() => {
    if (!data?.form_links?.length) return [];
    const links = data.form_links.map(link => {
      const meta = getFormLinkMeta(link);
      const displayName = cleanFormTitle(link.form_title);
      const typeKey = link.form_type?.toLowerCase().replace(/[^a-z_]/g, '') || '';
      const titleNorm = link.form_title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const isFeatured = DEFAULT_FEATURED_TYPES.some(ft =>
        typeKey === ft || titleNorm.includes(ft.replace(/_/g, ' '))
      );
      return {
        ...link,
        meta,
        displayName,
        isFeatured,
        publicUrl: `https://agentedeseguros.website/cotizar/${link.slug}`,
      };
    });
    return links.sort((a, b) => a.meta.priority - b.meta.priority);
  }, [data?.form_links]);

  const featuredLinks = useMemo(() => processedLinks.filter(l => l.isFeatured).slice(0, 6), [processedLinks]);
  const allLinks = processedLinks;

  const categorizedLinks = useMemo(() => {
    const groups: Record<string, ProcessedFormLink[]> = {};
    for (const link of allLinks) {
      const cat = link.meta.category;
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(link);
    }
    return groups;
  }, [allLinks]);

  const availableCategories = useMemo(() => {
    return Object.entries(INSURANCE_CATEGORIES)
      .filter(([key]) => categorizedLinks[key]?.length)
      .map(([key, label]) => ({ key, label }));
  }, [categorizedLinks]);

  const filteredLinks = useMemo(() => {
    let links = activeCategory === 'all' ? allLinks : (categorizedLinks[activeCategory] || []);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      links = allLinks.filter(l =>
        l.displayName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(q) ||
        l.meta.category.includes(q) ||
        l.form_type?.toLowerCase().includes(q)
      );
    }
    return links;
  }, [allLinks, activeCategory, searchQuery, categorizedLinks]);

  // Grouped options for select
  const selectGroups = useMemo(() => {
    if (!processedLinks.length) return null;
    const featured = processedLinks.filter(l => l.isFeatured);
    const rest = processedLinks.filter(l => !l.isFeatured);
    const groups: { label: string; items: ProcessedFormLink[] }[] = [];
    if (featured.length) groups.push({ label: 'Destacados', items: featured });
    const restByCategory: Record<string, ProcessedFormLink[]> = {};
    for (const link of rest) {
      const catLabel = INSURANCE_CATEGORIES[link.meta.category as CategoryKey] || 'Otros';
      if (!restByCategory[catLabel]) restByCategory[catLabel] = [];
      restByCategory[catLabel].push(link);
    }
    for (const [label, items] of Object.entries(restByCategory)) {
      groups.push({ label, items });
    }
    return groups;
  }, [processedLinks]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Cargando pagina...</p>
        </div>
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-12 h-12 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Pagina no encontrada</h1>
          <p className="text-gray-600 mb-6">Esta pagina no existe o no esta publicada.</p>
          <a href="https://www.movi.digital" className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors">
            Ir a MOVI Digital
          </a>
        </div>
      </div>
    );
  }

  const { user, config, insurers, categories } = data;
  const primaryColor = config.primary_color;
  const secondaryColor = config.secondary_color;

  const textToDisplay = typeof config.custom_text === 'string' && config.custom_text.trim()
    ? config.custom_text.split('\n').filter(t => t.trim())
    : DEFAULT_TEXT.split('\n').filter(t => t.trim());

  const whatsappNumber = user.phone?.replace(/\D/g, '');
  const whatsappLink = whatsappNumber ? `https://wa.me/52${whatsappNumber}` : '#';
  const multicotizadorUrl = `https://multicotizador.digital/cotiza/${slug}`;

  const categoriesText = processedLinks.length > 0
    ? processedLinks.slice(0, 6).map(l => l.displayName.toLowerCase()).join(', ')
    : categories?.map(c => c.name.toLowerCase()).join(', ') || '';
  const seoText = `${user.name} de ${user.office?.name || 'JIRO'} te ayuda a cotizar y contratar seguros de ${categoriesText} con atencion personalizada por WhatsApp.`;
  const pageTitle = `${user.name} | Asesor de Seguros${user.office?.name ? ` | ${user.office.name}` : ''}`;
  const metaDescription = seoText.slice(0, 160);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  const handlePrevSlide = () => {
    setIsAutoScrolling(false);
    setCurrentSlide(prev => (prev - 1 + Math.ceil(insurers!.length / 4)) % Math.ceil(insurers!.length / 4));
  };
  const handleNextSlide = () => {
    setIsAutoScrolling(false);
    setCurrentSlide(prev => (prev + 1) % Math.ceil(insurers!.length / 4));
  };

  const hasFormLinks = processedLinks.length > 0;
  const visibleFeatured = showAllFeatured ? featuredLinks : featuredLinks.slice(0, 3);

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={metaDescription} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={metaDescription} />
        <meta property="og:type" content="profile" />
        {user.photo_url && <meta property="og:image" content={user.photo_url} />}
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={`https://agentedeseguros.website/${slug}`} />
        <script src={`https://www.google.com/recaptcha/api.js?render=${import.meta.env.VITE_RECAPTCHA_SITE_KEY}`} async defer />
      </Helmet>

      <div className="bg-white min-h-screen overflow-x-hidden pb-16 md:pb-0">
        <div
          className="fixed inset-0 pointer-events-none z-0 opacity-30"
          style={{
            backgroundImage: `radial-gradient(circle at 20% 30%, ${createColorVariant(primaryColor, 0.1)} 0%, transparent 50%),
                             radial-gradient(circle at 80% 70%, ${createColorVariant(secondaryColor, 0.1)} 0%, transparent 50%)`
          }}
        />

        {/* HERO */}
        <section className="relative bg-gradient-to-b from-gray-50 to-white py-12 md:py-20 px-4">
          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-start">
              <div className="flex flex-col items-center lg:items-start text-center lg:text-left">
                {user.logo_url && (
                  <div className="mb-6">
                    <img src={user.logo_url} alt="Logo" className="h-16 md:h-20 w-auto object-contain" />
                  </div>
                )}
                {user.photo_url && (
                  <div className="mb-6">
                    <img src={user.photo_url} alt={user.name} className="w-32 h-32 md:w-40 md:h-40 rounded-2xl object-cover shadow-xl" />
                  </div>
                )}
                <h1 className="text-3xl md:text-4xl font-bold mb-3" style={{ color: primaryColor }}>{user.name}</h1>
                <p className="text-lg md:text-xl text-gray-600 mb-6">Asesor Personal de Seguros</p>
                <div className="mb-8">
                  <h2 className="text-2xl md:text-3xl font-bold mb-4" style={{ color: primaryColor }}>Protege lo que mas importa</h2>
                  <p className="text-gray-600 leading-relaxed max-w-lg">Te ayudo a encontrar el seguro perfecto para ti y tu familia. Cotizaciones personalizadas, asesoria profesional y atencion inmediata.</p>
                </div>
                <div className="flex flex-col items-center lg:items-start gap-3">
                  <div className="flex flex-wrap gap-3 justify-center lg:justify-start">
                    <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="group inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-white transition-all duration-300 hover:scale-105 shadow-md hover:shadow-lg text-sm" style={{ backgroundColor: primaryColor }}>
                      <MessageCircle className="w-4 h-4 group-hover:rotate-12 transition-transform" /> WhatsApp
                    </a>
                    <a href={`tel:${user.phone?.replace(/\D/g, '')}`} className="group inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-semibold bg-white border-2 transition-all duration-300 hover:scale-105 shadow-md hover:shadow-lg text-sm" style={{ borderColor: primaryColor, color: primaryColor }}>
                      <Phone className="w-4 h-4 group-hover:rotate-12 transition-transform" /> Llamar
                    </a>
                  </div>
                  <a href={multicotizadorUrl} target="_blank" rel="noopener noreferrer" className="group inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-white transition-all duration-300 hover:scale-105 shadow-md hover:shadow-lg text-sm" style={{ backgroundColor: secondaryColor }}>
                    <Car className="w-4 h-4 group-hover:translate-x-1 transition-transform" /> Multicotizador de Autos
                  </a>
                </div>
              </div>

              {/* LEAD FORM */}
              <div className="lg:sticky lg:top-24">
                <div className="bg-white rounded-2xl shadow-2xl p-5 md:p-6 border" style={{ borderColor: createColorVariant(primaryColor, 0.2) }}>
                  <h3 className="text-xl font-bold mb-1" style={{ color: primaryColor }}>Solicita tu Cotizacion</h3>
                  <p className="text-gray-600 mb-4 text-sm">Completa el formulario y te contactare de inmediato</p>

                  {submitStatus === 'success' ? (
                    <div className="text-center py-6">
                      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      </div>
                      <h4 className="text-xl font-bold text-gray-900 mb-2">Solicitud Recibida</h4>
                      <p className="text-gray-600">Gracias. Te contactare a la brevedad para ofrecerte la mejor opcion.</p>
                    </div>
                  ) : (
                    <form className="space-y-3" onSubmit={handleSubmitLead}>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Nombre Completo *</label>
                        <input type="text" value={formData.nombre} onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))} className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 transition-colors text-sm" placeholder="Tu nombre" required />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Celular *</label>
                        <input type="tel" value={formData.celular} onChange={(e) => setFormData(prev => ({ ...prev, celular: e.target.value }))} className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 transition-colors text-sm" placeholder="55 1234 5678" required />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Email *</label>
                        <input type="email" value={formData.email} onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))} className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 transition-colors text-sm" placeholder="tu@email.com" required />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Seguro de Interes *</label>
                        <select value={formData.seguro_interes} onChange={(e) => setFormData(prev => ({ ...prev, seguro_interes: e.target.value }))} className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 transition-colors bg-white text-sm" required>
                          <option value="">Selecciona un seguro</option>
                          {selectGroups ? (
                            selectGroups.map(group => (
                              <optgroup key={group.label} label={group.label}>
                                {group.items.map(link => (
                                  <option key={link.slug} value={link.displayName}>{link.displayName}</option>
                                ))}
                              </optgroup>
                            ))
                          ) : categories?.map(category => (
                            <option key={category.id} value={category.name}>{category.name}</option>
                          ))}
                        </select>
                      </div>
                      {submitStatus === 'error' && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">Error al enviar. Intenta nuevamente.</div>
                      )}
                      <button type="submit" disabled={isSubmitting} className="w-full py-4 rounded-xl font-bold text-white transition-all duration-300 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed" style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)` }}>
                        {isSubmitting ? 'Enviando...' : 'Solicitar Cotizacion'}
                      </button>
                      <p className="text-xs text-gray-500 text-center">Al enviar, aceptas que te contactemos para ofrecerte informacion sobre seguros.</p>
                    </form>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* INSURERS CAROUSEL */}
        {insurers && insurers.length > 0 && (
          <section className="relative py-16 px-4 bg-gradient-to-b from-gray-50 to-white z-10">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-3xl sm:text-4xl font-bold text-center mb-3 px-4" style={{ color: primaryColor }}>Aseguradoras de Confianza</h2>
              <p className="text-center text-gray-600 mb-8 sm:mb-12 max-w-2xl mx-auto text-base sm:text-lg px-4">Trabajo con las mejores aseguradoras del mercado para ofrecerte opciones competitivas</p>
              <div className="relative px-4" onMouseEnter={() => setIsAutoScrolling(false)} onMouseLeave={() => setIsAutoScrolling(true)}>
                {insurers.length > 4 && (
                  <>
                    <button onClick={handlePrevSlide} className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 bg-white rounded-full p-3 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110" style={{ color: primaryColor }}><ChevronLeft className="w-6 h-6" /></button>
                    <button onClick={handleNextSlide} className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 bg-white rounded-full p-3 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110" style={{ color: primaryColor }}><ChevronRight className="w-6 h-6" /></button>
                  </>
                )}
                <div className="overflow-hidden" ref={carouselRef}>
                  <div className="flex transition-transform duration-500 ease-out" style={{ transform: `translateX(-${currentSlide * 100}%)` }}>
                    {Array.from({ length: Math.ceil(insurers.length / 4) }).map((_, slideIndex) => (
                      <div key={slideIndex} className="w-full flex-shrink-0">
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-6 px-2">
                          {insurers.slice(slideIndex * 4, slideIndex * 4 + 4).map((insurer) => (
                            <div key={insurer.id} className="group bg-white p-4 sm:p-6 md:p-8 rounded-2xl shadow-md hover:shadow-2xl transition-all duration-500 flex items-center justify-center transform hover:-translate-y-2 hover:scale-105 min-h-[100px] sm:min-h-[120px]">
                              <img src={insurer.logo_url} alt={insurer.name} className="max-w-full max-h-12 sm:max-h-14 md:max-h-16 object-contain filter grayscale group-hover:grayscale-0 transition-all duration-300" />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {insurers.length > 4 && (
                  <div className="flex justify-center gap-2 mt-6 sm:mt-8">
                    {Array.from({ length: Math.ceil(insurers.length / 4) }).map((_, idx) => (
                      <button key={idx} onClick={() => { setCurrentSlide(idx); setIsAutoScrolling(false); }} className="h-2 rounded-full transition-all duration-300" style={{ backgroundColor: currentSlide === idx ? primaryColor : '#D1D5DB', width: currentSlide === idx ? '2rem' : '0.5rem' }} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* FEATURED INSURANCE SECTION */}
        {hasFormLinks && featuredLinks.length > 0 && (
          <section className="relative py-16 px-4 bg-gradient-to-b from-white to-gray-50 z-10">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-3xl sm:text-4xl font-bold text-center mb-3 px-4" style={{ color: primaryColor }}>Seguros mas solicitados</h2>
              <p className="text-center text-gray-600 mb-10 max-w-2xl mx-auto text-base sm:text-lg px-4">Proteccion completa para lo que mas valoras</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 px-4">
                {visibleFeatured.map((link, idx) => {
                  const IconComponent = (LucideIcons as any)[link.meta.icon];
                  return (
                    <a key={link.slug} href={link.publicUrl} className="group relative bg-white p-6 sm:p-8 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 no-underline block" style={{ animationDelay: `${idx * 80}ms` }}>
                      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl" style={{ background: `linear-gradient(135deg, ${createColorVariant(primaryColor, 0.1)} 0%, ${createColorVariant(secondaryColor, 0.1)} 100%)` }} />
                      <div className="relative z-10">
                        {IconComponent && (
                          <div className="mb-5 w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center transform group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 shadow-lg" style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)` }}>
                            <IconComponent className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
                          </div>
                        )}
                        <h3 className="text-xl sm:text-2xl font-bold mb-3 transition-all" style={{ color: primaryColor }}>{link.displayName}</h3>
                        <p className="text-sm sm:text-base text-gray-600 mb-5 leading-relaxed">{link.meta.description}</p>
                        <span className="inline-flex items-center gap-2 text-sm font-bold group-hover:gap-3 transition-all duration-300" style={{ color: secondaryColor }}>
                          Cotizar ahora <ExternalLink className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </span>
                      </div>
                    </a>
                  );
                })}
              </div>

              {/* Show more button on mobile */}
              {featuredLinks.length > 3 && !showAllFeatured && (
                <div className="text-center mt-6 sm:hidden">
                  <button onClick={() => setShowAllFeatured(true)} className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg font-semibold text-sm border-2 transition-all hover:scale-105" style={{ borderColor: primaryColor, color: primaryColor }}>
                    Ver mas seguros destacados
                  </button>
                </div>
              )}
            </div>
          </section>
        )}

        {/* EXPLORE ALL INSURANCE SECTION */}
        {hasFormLinks && allLinks.length > featuredLinks.length && (
          <section className="relative py-16 px-4 bg-gray-50 z-10">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-2xl sm:text-3xl font-bold text-center mb-2 px-4" style={{ color: primaryColor }}>Explora todos los seguros</h2>
              <p className="text-center text-gray-600 mb-8 max-w-xl mx-auto text-sm sm:text-base px-4">Encuentra el seguro ideal para ti, tu familia o tu empresa</p>

              {/* Search bar */}
              <div className="max-w-md mx-auto mb-6 px-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setActiveCategory('all'); }}
                    placeholder="Buscar seguro..."
                    className="w-full pl-10 pr-10 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-400 transition-colors text-sm bg-white"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Category tabs */}
              {!searchQuery && availableCategories.length > 1 && (
                <div className="mb-8 px-4">
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide justify-start sm:justify-center">
                    <button
                      onClick={() => setActiveCategory('all')}
                      className="flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 whitespace-nowrap"
                      style={activeCategory === 'all'
                        ? { backgroundColor: primaryColor, color: 'white' }
                        : { backgroundColor: 'white', color: '#6B7280', border: '1px solid #E5E7EB' }
                      }
                    >
                      Todos
                    </button>
                    {availableCategories.map(cat => (
                      <button
                        key={cat.key}
                        onClick={() => setActiveCategory(cat.key)}
                        className="flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 whitespace-nowrap"
                        style={activeCategory === cat.key
                          ? { backgroundColor: primaryColor, color: 'white' }
                          : { backgroundColor: 'white', color: '#6B7280', border: '1px solid #E5E7EB' }
                        }
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Compact grid of all insurance */}
              {filteredLinks.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 px-4">
                  {filteredLinks.slice(0, 12).map(link => {
                    const IconComponent = (LucideIcons as any)[link.meta.icon];
                    return (
                      <a
                        key={link.slug}
                        href={link.publicUrl}
                        className="group flex items-center gap-3 bg-white p-4 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-md transition-all duration-300 no-underline"
                      >
                        <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: createColorVariant(primaryColor, 0.1) }}>
                          {IconComponent && <IconComponent className="w-5 h-5" style={{ color: primaryColor }} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{link.displayName}</p>
                          <p className="text-xs text-gray-500 capitalize">{INSURANCE_CATEGORIES[link.meta.category as CategoryKey] || 'Otros'}</p>
                        </div>
                        <span className="flex-shrink-0 text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: secondaryColor }}>Cotizar</span>
                      </a>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 px-4">
                  <p className="text-gray-500 mb-4">No encontre ese seguro.</p>
                  <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-white text-sm transition-all hover:scale-105" style={{ backgroundColor: primaryColor }}>
                    <MessageCircle className="w-4 h-4" /> Escribeme y te ayudo a cotizarlo
                  </a>
                </div>
              )}

              {/* Show more if there are more than 12 */}
              {filteredLinks.length > 12 && !searchQuery && (
                <div className="text-center mt-6">
                  <p className="text-sm text-gray-500">Mostrando 12 de {filteredLinks.length} seguros disponibles</p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* FALLBACK: Old categories if no form links */}
        {!hasFormLinks && categories && categories.length > 0 && (
          <section className="relative py-16 px-4 bg-gradient-to-b from-gray-50 to-white z-10">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-3xl sm:text-4xl font-bold text-center mb-3 px-4" style={{ color: primaryColor }}>Seguros a tu medida</h2>
              <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto text-base sm:text-lg px-4">Proteccion completa para lo que mas valoras</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 px-4">
                {categories.map((category, idx) => {
                  const IconComponent = category.lucide_icon && (LucideIcons as any)[category.lucide_icon];
                  return (
                    <div key={category.id} className="group relative bg-white p-6 sm:p-8 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2" style={{ animationDelay: `${idx * 100}ms` }}>
                      <div className="relative z-10">
                        {IconComponent && (
                          <div className="mb-5 w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center transform group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 shadow-lg" style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)` }}>
                            <IconComponent className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
                          </div>
                        )}
                        <h3 className="text-xl sm:text-2xl font-bold mb-3 transition-all" style={{ color: primaryColor }}>{category.card_title}</h3>
                        <p className="text-sm sm:text-base text-gray-600 mb-5 leading-relaxed">{category.card_description}</p>
                        <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-bold hover:gap-3 transition-all duration-300" style={{ color: secondaryColor }}>
                          Cotizar {category.name} <MessageCircle className="w-4 h-4" />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* EMPTY STATE */}
        {!hasFormLinks && (!categories || categories.length === 0) && (
          <section className="relative py-16 px-4 bg-gray-50 z-10">
            <div className="max-w-md mx-auto text-center">
              <p className="text-gray-600 mb-4">Por el momento no hay formularios de cotizacion disponibles.</p>
              <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-white transition-all hover:scale-105" style={{ backgroundColor: primaryColor }}>
                <MessageCircle className="w-4 h-4" /> Contactame directamente
              </a>
            </div>
          </section>
        )}

        {/* ABOUT */}
        <section className="relative py-16 px-4 bg-white z-10">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold mb-6 sm:mb-8 text-center px-4" style={{ color: primaryColor }}>Sobre Mi</h2>
            {textToDisplay.length > 0 ? (
              <div className="space-y-4 px-4">
                {textToDisplay.map((paragraph, index) => (
                  <p key={index} className="text-base sm:text-lg text-gray-700 leading-relaxed">{paragraph}</p>
                ))}
              </div>
            ) : (
              <div className="text-center py-8"><p className="text-gray-500">No hay informacion disponible</p></div>
            )}
          </div>
        </section>

        {/* SEGUWALLET */}
        <section className="relative py-16 px-4 z-10" style={{ backgroundColor: createColorVariant(secondaryColor, 0.05) }}>
          <div className="max-w-6xl mx-auto">
            <div className="bg-white rounded-3xl shadow-xl p-6 sm:p-8 md:p-12 border" style={{ borderColor: createColorVariant(primaryColor, 0.1) }}>
              <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
                <div className="flex flex-col items-center lg:items-start text-center lg:text-left">
                  <a href="https://www.seguwallet.mx" target="_blank" rel="noopener noreferrer" className="mb-6 block transition-transform duration-300 hover:scale-105">
                    <img src="/movirecurso_5.png" alt="Seguwallet" className="h-12 sm:h-14 w-auto object-contain" />
                  </a>
                  <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4" style={{ color: primaryColor }}>Descarga Seguwallet, nuestra app</h2>
                  <p className="text-base sm:text-lg text-gray-700 leading-relaxed mb-2">Todas tus polizas contratadas en Grupo JIRO, en un solo lugar.</p>
                  <p className="text-sm sm:text-base text-gray-600 mb-6 sm:mb-8">Accede, consulta y mantente al dia con tus polizas desde tu celular.</p>
                  <div className="flex flex-col w-full sm:w-auto gap-3 mb-4">
                    <a href="https://apps.apple.com/mx/app/seguwallet-by-movi-digital/id6744545607" target="_blank" rel="noopener noreferrer" className="group inline-flex items-center justify-center gap-3 px-6 py-3.5 bg-black text-white rounded-xl font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg">
                      <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
                      <div className="text-left"><div className="text-[10px] sm:text-xs font-normal">Descarga en</div><div className="text-sm sm:text-base font-bold -mt-0.5">App Store</div></div>
                    </a>
                    <a href="https://play.google.com/store/apps/details?id=com.sicasonline.Seguwallet&pcampaignid=web_share" target="_blank" rel="noopener noreferrer" className="group inline-flex items-center justify-center gap-3 px-6 py-3.5 bg-black text-white rounded-xl font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg">
                      <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor"><path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.5,12.92 20.16,13.19L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z"/></svg>
                      <div className="text-left"><div className="text-[10px] sm:text-xs font-normal">Disponible en</div><div className="text-sm sm:text-base font-bold -mt-0.5">Google Play</div></div>
                    </a>
                  </div>
                  <a href="https://www.seguwallet.mx" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm sm:text-base font-bold transition-all duration-300 hover:gap-3" style={{ color: secondaryColor }}>
                    Conoce mas sobre Seguwallet <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </a>
                </div>
                <div className="flex items-center justify-center lg:justify-end">
                  <img src="https://movi.digital/wp-content/uploads/2025/02/seguwallet-movidigital.png" alt="Seguwallet app" loading="lazy" className="w-full max-w-sm lg:max-w-md object-contain transform hover:scale-105 transition-transform duration-500" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA - Not found section */}
        <section className="relative py-12 sm:py-16 px-4 bg-white z-10">
          <div className="max-w-4xl mx-auto text-center">
            <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4 px-4" style={{ color: primaryColor }}>
              {hasFormLinks ? 'No encontraste el seguro que necesitas?' : 'Listo para proteger lo que mas valoras?'}
            </h3>
            <p className="text-sm sm:text-base md:text-lg text-gray-600 mb-6 sm:mb-8 px-4 max-w-2xl mx-auto">
              {hasFormLinks
                ? 'Escribeme y con gusto te ayudo a encontrar la cobertura ideal para ti, tu familia o tu empresa.'
                : seoText
              }
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4">
              <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="group inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-semibold text-white transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-xl text-sm sm:text-base" style={{ backgroundColor: primaryColor }}>
                <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5 group-hover:rotate-12 transition-transform" /> Contactar por WhatsApp
              </a>
              <a href={`tel:${user.phone?.replace(/\D/g, '')}`} className="group inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-semibold bg-white border-2 transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-xl text-sm sm:text-base" style={{ borderColor: primaryColor, color: primaryColor }}>
                <Phone className="w-4 h-4 sm:w-5 sm:h-5 group-hover:rotate-12 transition-transform" /> Llamar Ahora
              </a>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="bg-gray-900 py-8 px-4 text-white">
          <div className="max-w-6xl mx-auto text-center">
            <div className="flex items-center justify-center gap-3 mb-3">
              <a href="https://grupojiro.com" target="_blank" rel="noopener noreferrer" className="transition-transform duration-300 hover:scale-105">
                <img src="https://jiro.mx/wp-content/uploads/2021/10/Grupo-Jiro-Logo-Blanco-01.png" alt="Grupo JIRO" className="h-8 w-auto object-contain" />
              </a>
            </div>
            <p className="text-sm text-gray-400 mb-2">&copy; {new Date().getFullYear()} Grupo JIRO. Todos los derechos reservados.</p>
            <div className="flex items-center justify-center gap-4 mb-2">
              <a href="https://jiro.mx/privacidad" target="_blank" rel="noopener noreferrer" className="text-xs text-gray-500 hover:text-white transition-colors underline">Aviso de privacidad</a>
            </div>
            <p className="text-xs text-gray-500">Powered by{' '}<a href="https://www.movi.digital" className="hover:text-white transition-colors underline">MOVI Digital</a></p>
          </div>
        </footer>

        {/* FLOATING WHATSAPP BUTTON (desktop) */}
        <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="hidden md:flex fixed bottom-8 right-8 items-center justify-center w-14 h-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 z-50 group" style={{ backgroundColor: primaryColor }}>
          <MessageCircle className="w-6 h-6 text-white group-hover:rotate-12 transition-transform" />
          <span className="absolute -top-12 right-0 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">WhatsApp</span>
        </a>

        {/* SCROLL TO TOP */}
        <button onClick={scrollToTop} className={`hidden md:flex fixed bottom-8 right-28 items-center justify-center w-12 h-12 bg-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 z-50 border-2 ${showScrollTop ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0 pointer-events-none'}`} style={{ borderColor: createColorVariant(primaryColor, 0.3) }}>
          <ArrowUp className="w-5 h-5" style={{ color: primaryColor }} />
        </button>

        {/* MOBILE BOTTOM BAR */}
        <div className="fixed bottom-0 left-0 right-0 md:hidden backdrop-blur-lg bg-white/95 border-t border-gray-200 shadow-lg z-50">
          <div className="flex divide-x divide-gray-200">
            <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-2 py-4 font-semibold text-white active:scale-95 transition-transform" style={{ backgroundColor: primaryColor }}>
              <MessageCircle className="w-5 h-5" /> WhatsApp
            </a>
            <a href={`tel:${user.phone?.replace(/\D/g, '')}`} className="flex-1 flex items-center justify-center gap-2 py-4 font-semibold active:scale-95 transition-transform" style={{ color: primaryColor }}>
              <Phone className="w-5 h-5" /> Llamar
            </a>
            <a href={`mailto:${user.email}`} className="flex-1 flex items-center justify-center gap-2 py-4 font-semibold active:scale-95 transition-transform" style={{ color: secondaryColor }}>
              <Mail className="w-5 h-5" /> Email
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
