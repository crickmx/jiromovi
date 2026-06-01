import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  Phone, Mail, MessageCircle, Loader as Loader2,
  ChevronLeft, ChevronRight, ArrowUp, Car, ExternalLink,
  Search, X, ChevronDown, Award, Smartphone, Globe, Menu,
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { getPublicWebPageBySlug } from '../lib/webPagesUtils';
import type { PublicWebPageData, SharedFormLink } from '../lib/webPagesTypes';
import { DEFAULT_TEXT } from '../lib/webPagesTypes';
import { createColorVariant } from '../lib/animationUtils';

/* ─────────────────────────────────────────────
   TIPOS / METADATOS (sin cambios en lógica)
───────────────────────────────────────────── */

interface InsuranceMeta {
  icon: string;
  description: string;
  priority: number;
  category: string;
  keywords: string[];
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

const CATEGORY_ICONS: Record<CategoryKey, string> = {
  personales: 'Users',
  vehiculos: 'Car',
  hogar: 'Home',
  empresariales: 'Building2',
  especializados: 'Sparkles',
  otros: 'FileText',
};

const FORM_TYPE_META: Record<string, InsuranceMeta> = {
  auto: { icon: 'Car', description: 'Protege tu vehiculo con coberturas completas contra accidentes, robo y danos a terceros.', priority: 1, category: 'vehiculos', keywords: ['auto', 'carro', 'vehiculo', 'automovil'] },
  vida: { icon: 'Heart', description: 'Asegura el bienestar economico de tu familia con planes de vida a tu medida.', priority: 2, category: 'personales', keywords: ['vida', 'fallecimiento', 'beneficiarios'] },
  gmm: { icon: 'Stethoscope', description: 'Accede a la mejor atencion medica con cobertura hospitalaria y de especialistas.', priority: 3, category: 'personales', keywords: ['medico', 'hospital', 'gmm', 'gastos medicos'] },
  gastos_medicos: { icon: 'Stethoscope', description: 'Accede a la mejor atencion medica con cobertura hospitalaria y de especialistas.', priority: 3, category: 'personales', keywords: ['medico', 'hospital', 'gmm', 'gastos medicos'] },
  salud: { icon: 'HeartPulse', description: 'Cuida tu salud y la de los tuyos con planes de atencion preventiva y hospitalaria.', priority: 4, category: 'personales', keywords: ['salud', 'medico', 'preventivo'] },
  hogar: { icon: 'Home', description: 'Protege tu patrimonio contra incendios, robos, desastres naturales y mas.', priority: 5, category: 'hogar', keywords: ['hogar', 'casa', 'domicilio'] },
  casa: { icon: 'Home', description: 'Protege tu hogar contra incendios, robos, desastres naturales y mas.', priority: 5, category: 'hogar', keywords: ['casa', 'hogar', 'habitacion'] },
  motocicleta: { icon: 'Bike', description: 'Protege tu motocicleta con coberturas de danos, robo y responsabilidad civil.', priority: 6, category: 'vehiculos', keywords: ['moto', 'motocicleta', 'bike'] },
  moto: { icon: 'Bike', description: 'Protege tu motocicleta con coberturas de danos, robo y responsabilidad civil.', priority: 6, category: 'vehiculos', keywords: ['moto', 'motocicleta'] },
  accidentes_personales: { icon: 'ShieldAlert', description: 'Cobertura ante accidentes con indemnizaciones por invalidez, gastos medicos y fallecimiento.', priority: 7, category: 'personales', keywords: ['accidente', 'personal', 'invalidez'] },
  empresa: { icon: 'Building2', description: 'Seguros empresariales que protegen tus activos, empleados y operaciones.', priority: 8, category: 'empresariales', keywords: ['empresa', 'empresarial', 'corporativo'] },
  negocio: { icon: 'Building2', description: 'Seguros para tu negocio que cubren responsabilidad civil, danos y mas.', priority: 8, category: 'empresariales', keywords: ['negocio', 'comercio'] },
  pyme: { icon: 'Store', description: 'Proteccion integral para pequenas y medianas empresas con coberturas a la medida.', priority: 9, category: 'empresariales', keywords: ['pyme', 'pequena empresa', 'mediana empresa'] },
  responsabilidad_civil: { icon: 'Shield', description: 'Protegete ante reclamaciones de terceros por danos materiales o personales.', priority: 10, category: 'empresariales', keywords: ['responsabilidad', 'civil', 'rc', 'terceros'] },
  rc: { icon: 'Shield', description: 'Protegete ante reclamaciones de terceros por danos materiales o personales.', priority: 10, category: 'empresariales', keywords: ['rc', 'responsabilidad civil'] },
  transporte: { icon: 'Truck', description: 'Cobertura integral para mercancia en transito nacional e internacional.', priority: 11, category: 'vehiculos', keywords: ['transporte', 'carga', 'mercancia'] },
  flotilla: { icon: 'Bus', description: 'Seguros para flotillas vehiculares con tarifas preferenciales y atencion prioritaria.', priority: 12, category: 'vehiculos', keywords: ['flotilla', 'flota', 'vehiculos'] },
  camion: { icon: 'Truck', description: 'Proteccion completa para camiones de carga con coberturas de danos y RC.', priority: 13, category: 'vehiculos', keywords: ['camion', 'carga', 'pesado'] },
  viaje: { icon: 'Plane', description: 'Viaja tranquilo con cobertura medica, cancelaciones y equipaje en el extranjero.', priority: 14, category: 'especializados', keywords: ['viaje', 'viajero', 'extranjero', 'internacional'] },
  mascota: { icon: 'PawPrint', description: 'Protege a tu mejor amigo con cobertura veterinaria y de accidentes.', priority: 15, category: 'hogar', keywords: ['mascota', 'perro', 'gato', 'veterinario'] },
  educacion: { icon: 'GraduationCap', description: 'Asegura el futuro educativo de tus hijos con planes de ahorro e inversion.', priority: 16, category: 'personales', keywords: ['educacion', 'educativo', 'universidad', 'hijos'] },
  ahorro: { icon: 'PiggyBank', description: 'Haz crecer tu dinero con planes de ahorro e inversion respaldados por aseguradoras.', priority: 17, category: 'personales', keywords: ['ahorro', 'inversion', 'rendimiento'] },
  retiro: { icon: 'Landmark', description: 'Planifica tu retiro con productos de ahorro a largo plazo y rendimientos garantizados.', priority: 18, category: 'personales', keywords: ['retiro', 'pension', 'jubilacion'] },
  dental: { icon: 'Smile', description: 'Cobertura dental completa para tratamientos preventivos, correctivos y de emergencia.', priority: 19, category: 'personales', keywords: ['dental', 'dientes', 'bucal'] },
  condominio: { icon: 'Building', description: 'Proteccion para areas comunes y estructura de condominios.', priority: 20, category: 'hogar', keywords: ['condominio', 'departamento', 'areas comunes'] },
  incendio: { icon: 'Flame', description: 'Cobertura contra incendios, explosiones y fenomenos naturales para tu propiedad.', priority: 21, category: 'hogar', keywords: ['incendio', 'fuego', 'explosion'] },
  robo: { icon: 'Lock', description: 'Proteccion contra robos con o sin violencia para tu patrimonio.', priority: 22, category: 'hogar', keywords: ['robo', 'hurto', 'violencia'] },
  equipo_electronico: { icon: 'Monitor', description: 'Cobertura para equipos electronicos contra danos, robo y fallas electricas.', priority: 23, category: 'hogar', keywords: ['equipo', 'electronico', 'computadora', 'tecnologia'] },
  construccion: { icon: 'HardHat', description: 'Seguros para obras en construccion que cubren danos materiales y RC.', priority: 24, category: 'empresariales', keywords: ['construccion', 'obra', 'contratista'] },
  caucion: { icon: 'FileCheck', description: 'Fianzas y seguros de caucion para cumplimiento de contratos y licitaciones.', priority: 25, category: 'empresariales', keywords: ['caucion', 'fianza', 'contrato', 'licitacion'] },
  credito: { icon: 'CreditCard', description: 'Proteccion ante incumplimiento de pago por parte de deudores comerciales.', priority: 26, category: 'empresariales', keywords: ['credito', 'deudor', 'pago'] },
  agricola: { icon: 'Leaf', description: 'Cobertura para cultivos y actividades agricolas ante fenomenos climaticos.', priority: 27, category: 'especializados', keywords: ['agricola', 'cultivo', 'campo', 'cosecha'] },
  maritimo: { icon: 'Ship', description: 'Seguros maritimos para embarcaciones, carga y responsabilidad civil en el mar.', priority: 28, category: 'especializados', keywords: ['maritimo', 'barco', 'embarcacion', 'mar'] },
  aviacion: { icon: 'PlaneTakeoff', description: 'Cobertura para aeronaves, pilotos y pasajeros en operaciones aereas.', priority: 29, category: 'especializados', keywords: ['aviacion', 'aeronave', 'piloto', 'avion'] },
  taxi: { icon: 'CarTaxiFront', description: 'Seguro especializado para taxis y vehiculos de transporte publico.', priority: 30, category: 'vehiculos', keywords: ['taxi', 'transporte publico'] },
  uber: { icon: 'Smartphone', description: 'Seguro para conductores de plataformas digitales de transporte.', priority: 31, category: 'vehiculos', keywords: ['uber', 'didi', 'plataforma', 'app'] },
  eventos: { icon: 'Calendar', description: 'Cobertura para eventos especiales contra cancelaciones e imprevistos.', priority: 32, category: 'especializados', keywords: ['evento', 'fiesta', 'celebracion', 'cancelacion'] },
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
  return { icon: 'FileText', description: 'Solicita una cotizacion personalizada con atencion profesional y sin compromiso.', priority: 99, category: 'otros', keywords: [] };
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

const ITEMS_PER_PAGE = 12;

const NAV_ITEMS = [
  { id: 'inicio', label: 'Inicio' },
  { id: 'aseguradoras', label: 'Aseguradoras' },
  { id: 'cotizar', label: 'Cotizar' },
  { id: 'sobre-mi', label: 'Sobre mi' },
  { id: 'app', label: 'App' },
];

function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (el) {
    const offset = 68;
    const top = el.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: 'smooth' });
  }
}

/* ─────────────────────────────────────────────
   INPUT COMPONENT — más alto y con foco limpio
───────────────────────────────────────────── */
function FormInput({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-800 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

/* ─────────────────────────────────────────────
   COMPONENTE PRINCIPAL
───────────────────────────────────────────── */
export default function PaginaPublicaAsesor() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<PublicWebPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAutoScrolling, setIsAutoScrolling] = useState(true);
  const carouselRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState('inicio');
  const [navScrolled, setNavScrolled] = useState(false);
  const [formData, setFormData] = useState({ nombre: '', celular: '', email: '', seguro_interes: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [showAllFeatured, setShowAllFeatured] = useState(false);
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!slug) { setNotFound(true); setLoading(false); return; }
    loadPageData();
  }, [slug]);

  useEffect(() => {
    const handleScroll = () => {
      const y = window.scrollY;
      setShowScrollTop(y > 400);
      setNavScrolled(y > 60);
      if (mobileMenuOpen) setMobileMenuOpen(false);
      const sections = NAV_ITEMS.map(n => document.getElementById(n.id));
      let current = 'inicio';
      for (const sec of sections) {
        if (sec && sec.getBoundingClientRect().top <= 100) current = sec.id;
      }
      setActiveSection(current);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (!data?.insurers || data.insurers.length <= 4 || !isAutoScrolling) return;
    const interval = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % Math.ceil(data.insurers!.length / 4));
    }, 3000);
    return () => clearInterval(interval);
  }, [data?.insurers, isAutoScrolling]);

  useEffect(() => { setVisibleCount(ITEMS_PER_PAGE); }, [activeCategory, searchQuery]);

  async function loadPageData() {
    if (!slug) return;
    try {
      const pageData = await getPublicWebPageBySlug(slug);
      if (!pageData || !pageData.user) { setNotFound(true); }
      else if (pageData.config?.is_published === false) { setNotFound(true); }
      else { setData(pageData); }
    } catch (error) {
      console.error('Error loading public page:', error);
      setNotFound(true);
    } finally { setLoading(false); }
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
        body: JSON.stringify({ slug, nombre: formData.nombre, celular: formData.celular, email: formData.email, seguro_interes: formData.seguro_interes, recaptchaToken }),
      });
      const responseData = await response.json();
      if (!response.ok || !responseData.success) throw new Error(responseData.error || 'Error');
      setSubmitStatus('success');
      setFormData({ nombre: '', celular: '', email: '', seguro_interes: '' });
    } catch (error) {
      console.error('Error submitting lead:', error);
      setSubmitStatus('error');
    } finally { setIsSubmitting(false); }
  }

  const processedLinks: ProcessedFormLink[] = useMemo(() => {
    if (data?.form_templates?.length) {
      const wpNumber = data.user?.phone?.replace(/\D/g, '') || '';
      const waFallback = wpNumber ? `https://wa.me/52${wpNumber}` : '#';
      return data.form_templates.map(tmpl => {
        const typeKey = tmpl.form_type?.toLowerCase().replace(/[^a-z_]/g, '') || '';
        const meta = FORM_TYPE_META[typeKey] || { icon: tmpl.icon || 'FileText', description: 'Solicita una cotizacion personalizada con atencion profesional y sin compromiso.', priority: 99, category: 'otros', keywords: [] };
        const publicUrl = tmpl.public_url
          || (tmpl.link_slug ? `https://agentedeseguros.website/cotizar/${tmpl.link_slug}` : null)
          || `${waFallback}${wpNumber ? `?text=${encodeURIComponent(`Hola, me interesa una cotizacion de ${tmpl.title}`)}` : ''}`;
        return { slug: tmpl.link_slug || tmpl.slug || tmpl.form_type, form_title: tmpl.title, form_type: tmpl.form_type, form_slug: tmpl.slug || tmpl.form_type, quote_form_template_id: tmpl.id, meta: { ...meta, icon: tmpl.icon || meta.icon }, displayName: cleanFormTitle(tmpl.title), isFeatured: tmpl.is_featured, publicUrl };
      }).sort((a, b) => {
        if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;
        return a.meta.priority - b.meta.priority;
      });
    }
    if (!data?.form_links?.length) return [];
    const hasManualFeatured = data.form_links.some(l => l.featured_on_website);
    const links = data.form_links.map(link => {
      const meta = getFormLinkMeta(link);
      const displayName = cleanFormTitle(link.form_title);
      let isFeatured: boolean;
      if (hasManualFeatured) { isFeatured = !!link.featured_on_website; }
      else {
        const typeKey = link.form_type?.toLowerCase().replace(/[^a-z_]/g, '') || '';
        const titleNorm = link.form_title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        isFeatured = DEFAULT_FEATURED_TYPES.some(ft => typeKey === ft || titleNorm.includes(ft.replace(/_/g, ' ')));
      }
      return { ...link, meta, displayName, isFeatured, publicUrl: `https://agentedeseguros.website/cotizar/${link.slug}` };
    });
    return links.sort((a, b) => {
      if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;
      return a.meta.priority - b.meta.priority;
    });
  }, [data?.form_links, data?.form_templates]);

  const featuredLinks = useMemo(() => processedLinks.filter(l => l.isFeatured).slice(0, 6), [processedLinks]);

  const categorizedLinks = useMemo(() => {
    const groups: Record<string, ProcessedFormLink[]> = {};
    for (const link of processedLinks) {
      const cat = link.meta.category;
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(link);
    }
    return groups;
  }, [processedLinks]);

  const availableCategories = useMemo(() => {
    return Object.entries(INSURANCE_CATEGORIES)
      .filter(([key]) => categorizedLinks[key]?.length)
      .map(([key, label]) => ({ key, label, count: categorizedLinks[key]?.length || 0 }));
  }, [categorizedLinks]);

  const filteredLinks = useMemo(() => {
    let links = activeCategory === 'all' ? processedLinks : (categorizedLinks[activeCategory] || []);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      links = processedLinks.filter(l => {
        const nameMatch = l.displayName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(q);
        const typeMatch = l.form_type?.toLowerCase().includes(q);
        const categoryMatch = (INSURANCE_CATEGORIES[l.meta.category as CategoryKey] || '').toLowerCase().includes(q);
        const keywordMatch = l.meta.keywords?.some(kw => kw.includes(q));
        return nameMatch || typeMatch || categoryMatch || keywordMatch;
      });
    }
    return links;
  }, [processedLinks, activeCategory, searchQuery, categorizedLinks]);

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
    for (const [label, items] of Object.entries(restByCategory)) { groups.push({ label, items }); }
    return groups;
  }, [processedLinks]);

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-500 text-sm">Cargando pagina...</p>
        </div>
      </div>
    );
  }

  /* ── 404 ── */
  if (notFound || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-5 border border-red-100">
            <svg className="w-9 h-9 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Pagina no encontrada</h1>
          <p className="text-gray-500 mb-6">Esta pagina no existe o no esta publicada.</p>
          <a href="https://www.movi.digital" className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors">
            Ir a MOVI Digital
          </a>
        </div>
      </div>
    );
  }

  const { user, config, insurers, categories } = data;
  const primaryColor = config?.primary_color || '#1e40af';
  const secondaryColor = config?.secondary_color || '#059669';

  const textToDisplay = typeof config?.custom_text === 'string' && config.custom_text.trim()
    ? config.custom_text.split('\n').filter(t => t.trim())
    : DEFAULT_TEXT.split('\n').filter(t => t.trim());

  const whatsappNumber = user.phone?.replace(/\D/g, '');
  const whatsappLink = whatsappNumber ? `https://wa.me/52${whatsappNumber}` : '#';
  const multicotizadorUrl = `https://multicotizador.digital/cotiza/${slug}`;

  const categoriesText = processedLinks.length > 0
    ? processedLinks.slice(0, 6).map(l => l.displayName.toLowerCase()).join(', ')
    : categories?.map(c => c.name.toLowerCase()).join(', ') || '';
  const seoText = `${user.name} de ${user.office?.name || 'JIRO'} te ayuda a cotizar y contratar seguros de ${categoriesText} con atencion personalizada por WhatsApp.`;

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  const totalSlides = Math.ceil((insurers?.length || 0) / 4);
  const handlePrevSlide = () => { setIsAutoScrolling(false); setCurrentSlide(prev => (prev - 1 + totalSlides) % totalSlides); };
  const handleNextSlide = () => { setIsAutoScrolling(false); setCurrentSlide(prev => (prev + 1) % totalSlides); };

  const hasFormLinks = processedLinks.length > 0;
  const visibleFeatured = showAllFeatured ? featuredLinks : featuredLinks.slice(0, 3);
  const paginatedLinks = filteredLinks.slice(0, visibleCount);
  const hasMoreLinks = filteredLinks.length > visibleCount;

  /* ── Estilos reutilizables ── */
  const inputCls = 'w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:border-current transition-colors';
  const btnPrimary = 'inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-white text-sm transition-all duration-200 hover:brightness-90 active:scale-95 shadow-sm';
  const btnOutline = 'inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm border-2 transition-all duration-200 hover:brightness-95 active:scale-95';

  return (
    <>
      <Helmet>
        <title>{user.name}{user.office?.name ? ` - ${user.office.name}` : ' - Asesor de Seguros'}</title>
        <meta name="description" content={seoText} />
        <meta property="og:title" content={`${user.name}${user.office?.name ? ` - ${user.office.name}` : ' - Asesor de Seguros'}`} />
        <meta property="og:description" content={seoText} />
        {user.photo_url && <meta property="og:image" content={user.photo_url} />}
        <meta name="robots" content="index, follow" />
      </Helmet>

      <div className="bg-white min-h-screen overflow-x-hidden pb-16 md:pb-0">

        {/* ═══════════════════════════════════════
            NAVEGACIÓN — centrada y sticky
        ═══════════════════════════════════════ */}
        <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          navScrolled
            ? 'bg-white/96 backdrop-blur-md shadow-md border-b border-gray-100'
            : 'bg-white/90 backdrop-blur-sm'
        }`}>
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center">
            {/* Logo / Nombre — izquierda */}
            <button
              onClick={() => scrollToSection('inicio')}
              className="flex-shrink-0 flex items-center gap-2 mr-4"
            >
              {(user.logo_url || user.office?.logo_url) ? (
                <img
                  src={user.logo_url || user.office?.logo_url || ''}
                  alt="Logo"
                  className="h-8 w-auto object-contain"
                />
              ) : (
                <span
                  className="text-sm font-bold truncate max-w-[140px] leading-tight"
                  style={{ color: primaryColor }}
                >
                  {user.name}
                </span>
              )}
            </button>

            {/* Menu centrado — desktop only */}
            <div className="flex-1 hidden md:flex items-center justify-center">
              <div className="flex items-center gap-1">
                {NAV_ITEMS.map(item => (
                  <button
                    key={item.id}
                    onClick={() => scrollToSection(item.id)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                      activeSection === item.id
                        ? 'text-white'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                    style={activeSection === item.id ? { backgroundColor: primaryColor } : {}}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Spacer mobile */}
            <div className="flex-1 md:hidden" />

            {/* CTA WhatsApp — derecha desktop */}
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-90 active:scale-95 shadow-sm"
              style={{ backgroundColor: primaryColor }}
            >
              <MessageCircle className="w-4 h-4" />
              WhatsApp
            </a>

            {/* Mobile: hamburger button */}
            <button
              onClick={() => setMobileMenuOpen(v => !v)}
              className="md:hidden flex items-center justify-center w-10 h-10 rounded-xl text-gray-600 hover:bg-gray-100 transition-colors flex-shrink-0"
              aria-label="Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

          {/* Mobile drawer menu */}
          <div className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${
            mobileMenuOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
          }`}>
            <div className="bg-white border-t border-gray-100 shadow-xl px-4 py-3 space-y-1">
              {NAV_ITEMS.map(item => (
                <button
                  key={item.id}
                  onClick={() => { scrollToSection(item.id); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center px-4 py-3.5 rounded-xl text-sm font-semibold transition-all text-left ${
                    activeSection === item.id ? 'text-white' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                  style={activeSection === item.id ? { backgroundColor: primaryColor } : {}}
                >
                  {item.label}
                </button>
              ))}
              <div className="pt-2 pb-1">
                <a
                  href={whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl text-sm font-bold text-white transition-all hover:brightness-90"
                  style={{ backgroundColor: primaryColor }}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <MessageCircle className="w-4 h-4" />
                  Escribir por WhatsApp
                </a>
              </div>
            </div>
          </div>
        </nav>

        {/* Overlay for mobile menu */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/20 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* ═══════════════════════════════════════
            HERO — identificación + formulario
        ═══════════════════════════════════════ */}
        <section id="inicio" className="pt-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 py-14 md:py-20">
            <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-start">

              {/* IZQUIERDA: perfil + CTAs */}
              <div className="flex flex-col items-center lg:items-start text-center lg:text-left">
                {/* Logo sobre la foto */}
                {(user.logo_url || user.office?.logo_url) && (
                  <div className="mb-6">
                    <img
                      src={user.logo_url || user.office?.logo_url || ''}
                      alt="Logo"
                      className="h-14 md:h-16 w-auto object-contain"
                    />
                  </div>
                )}

                {/* Foto circular */}
                <div className="mb-6">
                  {user.photo_url ? (
                    <div
                      className="w-36 h-36 md:w-44 md:h-44 rounded-full overflow-hidden flex-shrink-0"
                      style={{
                        border: `4px solid ${primaryColor}`,
                        boxShadow: `0 0 0 6px ${createColorVariant(primaryColor, 0.12)}, 0 12px 40px ${createColorVariant(primaryColor, 0.22)}`,
                      }}
                    >
                      <img src={user.photo_url} alt={user.name} className="w-full h-full object-cover object-center" />
                    </div>
                  ) : (
                    <div
                      className="w-36 h-36 md:w-44 md:h-44 rounded-full flex items-center justify-center text-white text-5xl font-bold flex-shrink-0"
                      style={{
                        background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
                        boxShadow: `0 12px 40px ${createColorVariant(primaryColor, 0.3)}`,
                      }}
                    >
                      {user.name?.charAt(0)?.toUpperCase() || 'A'}
                    </div>
                  )}
                </div>

                {/* Nombre y título */}
                <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-1 leading-tight">
                  {user.name}
                </h1>
                <p className="text-base md:text-lg font-medium mb-4" style={{ color: primaryColor }}>
                  Asesor Personal de Seguros
                </p>

                {/* Propuesta de valor */}
                <div className="mb-8 max-w-lg">
                  <p className="text-gray-700 leading-relaxed text-base md:text-lg">
                    Te ayudo a encontrar el seguro perfecto para ti y tu familia. Cotizaciones sin costo, asesoria experta y atencion inmediata.
                  </p>
                </div>

                {/* CTAs */}
                <div className="flex flex-col gap-3 w-full sm:w-auto">
                  <div className="flex flex-wrap gap-3 justify-center lg:justify-start">
                    <a
                      href={whatsappLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={btnPrimary}
                      style={{ backgroundColor: primaryColor }}
                    >
                      <MessageCircle className="w-4 h-4" />
                      Escribir por WhatsApp
                    </a>
                    <a
                      href={`tel:${user.phone?.replace(/\D/g, '')}`}
                      className={btnOutline}
                      style={{ borderColor: primaryColor, color: primaryColor }}
                    >
                      <Phone className="w-4 h-4" />
                      Llamar
                    </a>
                  </div>
                  <a
                    href={multicotizadorUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={btnPrimary}
                    style={{ backgroundColor: secondaryColor }}
                  >
                    <Car className="w-4 h-4" />
                    Multicotizador de Autos
                  </a>
                </div>
              </div>

              {/* DERECHA: formulario de cotización */}
              <div className="lg:sticky lg:top-24">
                <div
                  className="bg-white rounded-2xl border shadow-xl overflow-hidden"
                  style={{ borderColor: `${primaryColor}20` }}
                >
                  {/* Cabecera del formulario con color primario */}
                  <div className="px-7 pt-6 pb-5" style={{ borderBottom: `3px solid ${primaryColor}` }}>
                    <h3 className="text-xl font-bold text-gray-900 mb-0.5">Solicita tu Cotizacion</h3>
                    <p className="text-sm text-gray-500">
                      Completa el formulario y te contacto de inmediato — sin costo ni compromiso.
                    </p>
                  </div>

                  <div className="px-7 py-6">
                    {submitStatus === 'success' ? (
                      <div className="text-center py-8">
                        <div
                          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                          style={{ backgroundColor: `${secondaryColor}15` }}
                        >
                          <svg className="w-8 h-8" fill="none" stroke={secondaryColor} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <h4 className="text-lg font-bold text-gray-900 mb-2">Solicitud recibida</h4>
                        <p className="text-gray-600 text-sm leading-relaxed">
                          Gracias {formData.nombre || ''}. Te contactare a la brevedad para ofrecerte la mejor opcion.
                        </p>
                      </div>
                    ) : (
                      <form className="space-y-4" onSubmit={handleSubmitLead}>
                        <FormInput label="Nombre completo" required>
                          <input
                            type="text"
                            value={formData.nombre}
                            onChange={e => setFormData(p => ({ ...p, nombre: e.target.value }))}
                            className={inputCls}
                            style={{ '--tw-border-opacity': '1', borderColor: formData.nombre ? primaryColor : undefined } as React.CSSProperties}
                            placeholder="Tu nombre completo"
                            required
                          />
                        </FormInput>
                        <FormInput label="Celular" required>
                          <input
                            type="tel"
                            value={formData.celular}
                            onChange={e => setFormData(p => ({ ...p, celular: e.target.value }))}
                            className={inputCls}
                            style={{ borderColor: formData.celular ? primaryColor : undefined } as React.CSSProperties}
                            placeholder="55 1234 5678"
                            required
                          />
                        </FormInput>
                        <FormInput label="Correo electronico" required>
                          <input
                            type="email"
                            value={formData.email}
                            onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                            className={inputCls}
                            style={{ borderColor: formData.email ? primaryColor : undefined } as React.CSSProperties}
                            placeholder="tu@email.com"
                            required
                          />
                        </FormInput>
                        <FormInput label="Seguro de interes" required>
                          <select
                            value={formData.seguro_interes}
                            onChange={e => setFormData(p => ({ ...p, seguro_interes: e.target.value }))}
                            className={`${inputCls} bg-white`}
                            style={{ borderColor: formData.seguro_interes ? primaryColor : undefined } as React.CSSProperties}
                            required
                          >
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
                        </FormInput>

                        {submitStatus === 'error' && (
                          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 font-medium">
                            Error al enviar. Por favor, intenta nuevamente.
                          </div>
                        )}

                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="w-full py-3.5 rounded-xl font-bold text-white text-sm transition-all hover:brightness-90 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed shadow-md mt-1"
                          style={{ backgroundColor: primaryColor }}
                        >
                          {isSubmitting ? 'Enviando...' : 'Solicitar Cotizacion Gratuita'}
                        </button>
                        <p className="text-xs text-gray-400 text-center leading-relaxed">
                          Al enviar, aceptas que te contactemos para ofrecerte informacion sobre seguros.
                        </p>
                      </form>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════
            ASEGURADORAS
        ═══════════════════════════════════════ */}
        {insurers && insurers.length > 0 && (
          <section id="aseguradoras" className="py-16 px-4 bg-gray-50">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-10">
                <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-2">
                  Aseguradoras de confianza
                </h2>
                <p className="text-gray-600 max-w-xl mx-auto">
                  Trabajo con las mejores aseguradoras del mercado para darte la mejor cobertura al mejor precio.
                </p>
              </div>

              <div
                className="relative"
                onMouseEnter={() => setIsAutoScrolling(false)}
                onMouseLeave={() => setIsAutoScrolling(true)}
              >
                {insurers.length > 4 && (
                  <>
                    <button
                      onClick={handlePrevSlide}
                      className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-5 z-10 bg-white rounded-full p-2.5 shadow-lg hover:shadow-xl transition-all hover:scale-110 border border-gray-100"
                      style={{ color: primaryColor }}
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      onClick={handleNextSlide}
                      className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-5 z-10 bg-white rounded-full p-2.5 shadow-lg hover:shadow-xl transition-all hover:scale-110 border border-gray-100"
                      style={{ color: primaryColor }}
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </>
                )}

                <div className="overflow-hidden" ref={carouselRef}>
                  <div
                    className="flex transition-transform duration-500 ease-out"
                    style={{ transform: `translateX(-${currentSlide * 100}%)` }}
                  >
                    {Array.from({ length: Math.ceil(insurers.length / 4) }).map((_, slideIndex) => (
                      <div key={slideIndex} className="w-full flex-shrink-0">
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                          {insurers.slice(slideIndex * 4, slideIndex * 4 + 4).map(insurer => (
                            <div
                              key={insurer.id}
                              className="group bg-white px-6 py-5 rounded-2xl border border-gray-100 hover:border-gray-200 shadow-sm hover:shadow-md transition-all duration-300 flex items-center justify-center min-h-[90px]"
                            >
                              {insurer.logo_url ? (
                                <img
                                  src={insurer.logo_url}
                                  alt={insurer.name}
                                  className="max-w-full max-h-10 object-contain filter grayscale group-hover:grayscale-0 transition-all duration-300"
                                />
                              ) : (
                                <span className="text-sm font-semibold text-gray-600 text-center leading-tight">{insurer.name}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {insurers.length > 4 && (
                  <div className="flex justify-center gap-1.5 mt-5">
                    {Array.from({ length: totalSlides }).map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => { setCurrentSlide(idx); setIsAutoScrolling(false); }}
                        className="h-1.5 rounded-full transition-all duration-300"
                        style={{
                          backgroundColor: currentSlide === idx ? primaryColor : '#D1D5DB',
                          width: currentSlide === idx ? '1.5rem' : '0.375rem',
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ═══════════════════════════════════════
            COTIZAR — seguros destacados
        ═══════════════════════════════════════ */}
        {hasFormLinks && featuredLinks.length > 0 && (
          <section id="cotizar" className="py-16 px-4 bg-white">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-10">
                <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-2">
                  Seguros mas solicitados
                </h2>
                <p className="text-gray-600 max-w-xl mx-auto">
                  Haz clic para iniciar tu cotizacion en segundos.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {visibleFeatured.map(link => {
                  const IconComponent = (LucideIcons as any)[link.meta.icon];
                  return (
                    <a
                      key={link.slug}
                      href={link.publicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group bg-white rounded-2xl border border-gray-100 hover:border-gray-200 shadow-sm hover:shadow-lg p-6 transition-all duration-300 hover:-translate-y-1 block no-underline"
                    >
                      {IconComponent && (
                        <div
                          className="mb-4 w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
                          style={{ backgroundColor: primaryColor }}
                        >
                          <IconComponent className="w-6 h-6 text-white" />
                        </div>
                      )}
                      <h3 className="text-base font-bold text-gray-900 mb-2">{link.displayName}</h3>
                      <p className="text-sm text-gray-500 mb-4 leading-relaxed line-clamp-2">
                        {link.meta.description}
                      </p>
                      <span
                        className="inline-flex items-center gap-1.5 text-sm font-bold"
                        style={{ color: primaryColor }}
                      >
                        Cotizar ahora <ExternalLink className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                      </span>
                    </a>
                  );
                })}
              </div>

              {featuredLinks.length > 3 && !showAllFeatured && (
                <div className="text-center mt-6 sm:hidden">
                  <button
                    onClick={() => setShowAllFeatured(true)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm border-2 transition-all"
                    style={{ borderColor: primaryColor, color: primaryColor }}
                  >
                    Ver mas <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ═══════════════════════════════════════
            EXPLORAR TODOS LOS SEGUROS
        ═══════════════════════════════════════ */}
        {hasFormLinks && processedLinks.length > featuredLinks.length && (
          <section className="py-14 px-4 bg-gray-50">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-8">
                <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-2">
                  Todos los seguros
                </h2>
                <p className="text-gray-600 max-w-lg mx-auto text-sm">
                  Encuentra el seguro ideal para ti, tu familia o tu empresa.
                </p>
              </div>

              {/* Buscador */}
              <div className="max-w-md mx-auto mb-6">
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => { setSearchQuery(e.target.value); setActiveCategory('all'); }}
                    placeholder="Buscar seguro..."
                    className="w-full pl-10 pr-10 py-3 border-2 border-gray-200 rounded-xl text-sm text-gray-900 bg-white focus:outline-none transition-colors shadow-sm"
                    style={{ borderColor: searchQuery ? primaryColor : undefined } as React.CSSProperties}
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Filtros por categoría */}
              {!searchQuery && availableCategories.length > 1 && (
                <div className="mb-8">
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide justify-start sm:justify-center">
                    <button
                      onClick={() => setActiveCategory('all')}
                      className="flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap"
                      style={activeCategory === 'all'
                        ? { backgroundColor: primaryColor, color: 'white' }
                        : { backgroundColor: 'white', color: '#374151', border: '1px solid #D1D5DB' }
                      }
                    >
                      Todos ({processedLinks.length})
                    </button>
                    {availableCategories.map(cat => {
                      const CatIcon = (LucideIcons as any)[CATEGORY_ICONS[cat.key as CategoryKey]];
                      return (
                        <button
                          key={cat.key}
                          onClick={() => setActiveCategory(cat.key)}
                          className="flex-shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap"
                          style={activeCategory === cat.key
                            ? { backgroundColor: primaryColor, color: 'white' }
                            : { backgroundColor: 'white', color: '#374151', border: '1px solid #D1D5DB' }
                          }
                        >
                          {CatIcon && <CatIcon className="w-3.5 h-3.5" />}
                          {cat.label} ({cat.count})
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {paginatedLinks.length > 0 ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {paginatedLinks.map(link => {
                      const IconComponent = (LucideIcons as any)[link.meta.icon];
                      return (
                        <a
                          key={link.slug}
                          href={link.publicUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group flex items-center gap-3 bg-white px-4 py-3.5 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-md transition-all no-underline"
                        >
                          <div
                            className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: `${primaryColor}12` }}
                          >
                            {IconComponent && <IconComponent className="w-4.5 h-4.5" style={{ color: primaryColor }} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{link.displayName}</p>
                            <p className="text-xs text-gray-500 capitalize">{INSURANCE_CATEGORIES[link.meta.category as CategoryKey] || 'Otros'}</p>
                          </div>
                          <span
                            className="flex-shrink-0 text-xs font-bold px-2.5 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ color: primaryColor, backgroundColor: `${primaryColor}10` }}
                          >
                            Cotizar
                          </span>
                        </a>
                      );
                    })}
                  </div>

                  {hasMoreLinks && (
                    <div className="text-center mt-8">
                      <button
                        onClick={() => setVisibleCount(prev => prev + ITEMS_PER_PAGE)}
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm border-2 transition-all hover:brightness-95"
                        style={{ borderColor: primaryColor, color: primaryColor }}
                      >
                        <ChevronDown className="w-4 h-4" />
                        Ver mas ({filteredLinks.length - visibleCount} restantes)
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-10">
                  <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Search className="w-6 h-6 text-gray-400" />
                  </div>
                  <p className="text-gray-800 font-semibold mb-1">No encontre ese seguro</p>
                  <p className="text-gray-500 text-sm mb-5">Escribeme y te ayudo sin compromiso</p>
                  <a
                    href={whatsappLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={btnPrimary}
                    style={{ backgroundColor: primaryColor }}
                  >
                    <MessageCircle className="w-4 h-4" /> Contactar por WhatsApp
                  </a>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Fallback: categorías antiguas */}
        {!hasFormLinks && categories && categories.length > 0 && (
          <section id="cotizar" className="py-16 px-4 bg-white">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-10">
                <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-2">Seguros a tu medida</h2>
                <p className="text-gray-600 max-w-xl mx-auto">Proteccion completa para lo que mas valoras.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {categories.map(category => {
                  const IconComponent = category.lucide_icon && (LucideIcons as any)[category.lucide_icon];
                  return (
                    <div key={category.id} className="group bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all hover:-translate-y-1">
                      {IconComponent && (
                        <div className="mb-4 w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: primaryColor }}>
                          <IconComponent className="w-5.5 h-5.5 text-white" />
                        </div>
                      )}
                      <h3 className="text-base font-bold text-gray-900 mb-2">{category.card_title}</h3>
                      <p className="text-sm text-gray-500 mb-4 leading-relaxed">{category.card_description}</p>
                      <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-bold" style={{ color: primaryColor }}>
                        Cotizar {category.name} <MessageCircle className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* Estado vacío */}
        {!hasFormLinks && (!categories || categories.length === 0) && (
          <section id="cotizar" className="py-16 px-4 bg-gray-50">
            <div className="max-w-md mx-auto text-center">
              <p className="text-gray-600 mb-5">Contactame directamente para ayudarte a encontrar la cobertura que necesitas.</p>
              <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className={btnPrimary} style={{ backgroundColor: primaryColor }}>
                <MessageCircle className="w-4 h-4" /> Contactame
              </a>
            </div>
          </section>
        )}

        {/* ═══════════════════════════════════════
            SOBRE MÍ — simplificada y auténtica
        ═══════════════════════════════════════ */}
        <section id="sobre-mi" className="py-16 px-4 bg-white">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-10 text-center">
              Sobre mi
            </h2>

            <div className="flex flex-col sm:flex-row gap-8 items-start">
              {/* Columna izquierda: foto + contacto */}
              <div className="flex flex-col items-center sm:items-start gap-4 sm:w-52 flex-shrink-0">
                {user.photo_url ? (
                  <div
                    className="w-32 h-32 rounded-full overflow-hidden"
                    style={{
                      border: `3px solid ${primaryColor}`,
                      boxShadow: `0 6px 24px ${createColorVariant(primaryColor, 0.2)}`,
                    }}
                  >
                    <img src={user.photo_url} alt={user.name} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div
                    className="w-32 h-32 rounded-full flex items-center justify-center text-3xl font-bold text-white"
                    style={{
                      background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
                      boxShadow: `0 6px 24px ${createColorVariant(primaryColor, 0.25)}`,
                    }}
                  >
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                )}

                {/* Datos de contacto */}
                <div className="w-full space-y-2">
                  {user.phone && (
                    <a
                      href={whatsappLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-80"
                      style={{ backgroundColor: `${primaryColor}10`, color: primaryColor }}
                    >
                      <MessageCircle className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{user.phone}</span>
                    </a>
                  )}
                  {user.phone && (
                    <a
                      href={`tel:${user.phone.replace(/\D/g, '')}`}
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 transition-all"
                    >
                      <Phone className="w-4 h-4 flex-shrink-0 text-gray-500" />
                      <span className="truncate">{user.phone}</span>
                    </a>
                  )}
                  {user.email && (
                    <a
                      href={`mailto:${user.email}`}
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 transition-all"
                    >
                      <Mail className="w-4 h-4 flex-shrink-0 text-gray-500" />
                      <span className="truncate text-xs">{user.email}</span>
                    </a>
                  )}
                  {(user as any).website_url && (
                    <a
                      href={(user as any).website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 transition-all"
                    >
                      <Globe className="w-4 h-4 flex-shrink-0 text-gray-500" />
                      <span className="truncate text-xs">Sitio web</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Columna derecha: bio */}
              <div className="flex-1 min-w-0 pt-1">
                <h3 className="text-xl font-bold text-gray-900 mb-1">{user.name}</h3>
                {(user as any).cedula && (
                  <p className="text-sm text-gray-500 mb-4 flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 flex-shrink-0" style={{ color: primaryColor }} />
                    Cedula {(user as any).cedula}
                  </p>
                )}
                <div className="space-y-4">
                  {textToDisplay.length > 0 ? (
                    textToDisplay.map((paragraph, index) => (
                      <p key={index} className="text-gray-700 leading-relaxed text-base">
                        {paragraph}
                      </p>
                    ))
                  ) : (
                    <p className="text-gray-600 leading-relaxed">
                      Asesor de seguros comprometido con brindarte la mejor asesoria y proteccion para ti y tu familia.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════
            APP — Seguwallet
        ═══════════════════════════════════════ */}
        <section id="app" className="py-16 px-4 bg-gray-50">
          <div className="max-w-5xl mx-auto">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-md overflow-hidden">
              <div className="grid lg:grid-cols-5">
                <div className="lg:col-span-3 p-8 sm:p-10 flex flex-col justify-center">
                  <div className="mb-6">
                    <img src="/movirecurso_5.png" alt="Seguwallet" className="h-10 w-auto object-contain" />
                  </div>
                  <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Accede a Seguwallet</h2>
                  <p className="text-gray-600 leading-relaxed mb-1 text-base">
                    Todas tus polizas en un solo lugar. Consulta coberturas, vencimientos y contacta a tu asesor desde cualquier dispositivo.
                  </p>
                  <p className="text-sm text-gray-500 mb-7">
                    Ya eres cliente? Ingresa con tu email para ver tu cartera de seguros.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <a
                      href="https://seguwallet.mx"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl font-bold text-white transition-all hover:brightness-90 shadow-sm"
                      style={{ backgroundColor: primaryColor }}
                    >
                      <Smartphone className="w-5 h-5" />
                      Ingresar a Seguwallet
                    </a>
                  </div>
                  <div className="mt-6 pt-5 border-t border-gray-100">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Tambien disponible en</p>
                    <div className="flex flex-wrap gap-2">
                      <a
                        href="https://apps.apple.com/mx/app/seguwallet-by-movi-digital/id6744545607"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                        </svg>
                        App Store
                      </a>
                      <a
                        href="https://play.google.com/store/apps/details?id=com.sicasonline.Seguwallet&pcampaignid=web_share"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.5,12.92 20.16,13.19L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z" />
                        </svg>
                        Google Play
                      </a>
                    </div>
                  </div>
                </div>

                <div
                  className="lg:col-span-2 flex items-center justify-center p-8 lg:p-6"
                  style={{ background: `linear-gradient(150deg, ${createColorVariant(primaryColor, 0.05)} 0%, ${createColorVariant(secondaryColor, 0.07)} 100%)` }}
                >
                  <img
                    src="https://movi.digital/wp-content/uploads/2025/02/seguwallet-movidigital.png"
                    alt="Seguwallet app"
                    loading="lazy"
                    className="w-full max-w-[200px] lg:max-w-[240px] object-contain hover:scale-105 transition-transform duration-500"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════
            CTA FINAL
        ═══════════════════════════════════════ */}
        <section className="py-14 px-4 bg-white">
          <div className="max-w-3xl mx-auto text-center">
            <h3 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-3">
              {hasFormLinks ? 'No encontraste el seguro que necesitas?' : 'Listo para proteger lo que mas valoras?'}
            </h3>
            <p className="text-gray-600 mb-8 max-w-xl mx-auto leading-relaxed">
              {hasFormLinks
                ? 'Escribeme y con gusto te ayudo a encontrar la cobertura ideal para ti, tu familia o tu empresa.'
                : seoText
              }
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl font-bold text-white transition-all hover:brightness-90 shadow-sm text-base"
                style={{ backgroundColor: primaryColor }}
              >
                <MessageCircle className="w-5 h-5" />
                Contactar por WhatsApp
              </a>
              <a
                href={`tel:${user.phone?.replace(/\D/g, '')}`}
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl font-bold border-2 transition-all hover:brightness-95 text-base"
                style={{ borderColor: primaryColor, color: primaryColor }}
              >
                <Phone className="w-5 h-5" />
                Llamar ahora
              </a>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════
            FOOTER
        ═══════════════════════════════════════ */}
        <footer className="bg-gray-900 py-8 px-4 text-white">
          <div className="max-w-6xl mx-auto text-center">
            <div className="flex items-center justify-center gap-3 mb-3">
              <a href="https://grupojiro.com" target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity">
                <img src="https://jiro.mx/wp-content/uploads/2021/10/Grupo-Jiro-Logo-Blanco-01.png" alt="Grupo JIRO" className="h-8 w-auto object-contain" />
              </a>
            </div>
            <p className="text-sm text-gray-400 mb-2">&copy; {new Date().getFullYear()} Grupo JIRO. Todos los derechos reservados.</p>
            <div className="flex items-center justify-center gap-4 mb-2">
              <a href="https://jiro.mx/privacidad" target="_blank" rel="noopener noreferrer" className="text-xs text-gray-500 hover:text-white transition-colors underline">
                Aviso de privacidad
              </a>
            </div>
            <p className="text-xs text-gray-500">
              Powered by{' '}
              <a href="https://www.movi.digital" className="hover:text-white transition-colors underline">MOVI Digital</a>
            </p>
          </div>
        </footer>

        {/* ═══════════════════════════════════════
            FLOTANTE DESKTOP: WhatsApp + scroll-top
        ═══════════════════════════════════════ */}
        <a
          href={whatsappLink}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden md:flex fixed bottom-8 right-8 items-center justify-center w-14 h-14 rounded-full shadow-lg hover:shadow-xl hover:scale-110 transition-all z-50 group"
          style={{ backgroundColor: primaryColor }}
        >
          <MessageCircle className="w-6 h-6 text-white group-hover:rotate-12 transition-transform" />
          <span className="absolute -top-10 right-0 bg-gray-900 text-white px-3 py-1.5 rounded-lg text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            WhatsApp
          </span>
        </a>

        <button
          onClick={scrollToTop}
          className={`hidden md:flex fixed bottom-8 right-28 items-center justify-center w-12 h-12 bg-white rounded-full shadow-lg border-2 hover:shadow-xl hover:scale-110 transition-all z-50 ${showScrollTop ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 pointer-events-none'}`}
          style={{ borderColor: `${primaryColor}40` }}
        >
          <ArrowUp className="w-5 h-5" style={{ color: primaryColor }} />
        </button>

        {/* ═══════════════════════════════════════
            BARRA MÓVIL INFERIOR
        ═══════════════════════════════════════ */}
        <div className="fixed bottom-0 left-0 right-0 md:hidden bg-white/97 backdrop-blur-md border-t border-gray-200 shadow-xl z-50">
          <div className="flex divide-x divide-gray-100">
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 py-3.5 font-bold text-sm text-white active:brightness-90 transition-all"
              style={{ backgroundColor: primaryColor }}
            >
              <MessageCircle className="w-4.5 h-4.5" /> WhatsApp
            </a>
            <a
              href={`tel:${user.phone?.replace(/\D/g, '')}`}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 font-bold text-sm bg-white active:bg-gray-50 transition-all"
              style={{ color: primaryColor }}
            >
              <Phone className="w-4.5 h-4.5" /> Llamar
            </a>
            <a
              href={`mailto:${user.email}`}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 font-bold text-sm bg-white active:bg-gray-50 transition-all"
              style={{ color: secondaryColor }}
            >
              <Mail className="w-4.5 h-4.5" /> Email
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
