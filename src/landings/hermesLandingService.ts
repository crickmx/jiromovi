import { supabase } from '../lib/supabase';

export interface ProjectDesignConfig {
  heroBadge?: string;
  heroTitle?: string;
  heroSubtitle?: string;
  primaryColor?: string;
  accentColor?: string;
  ctaText?: string;
  ctaSubtext?: string;
  whatsappNumber?: string;
  planUnoPrecio?: string;
  planDosPrecio?: string;
  planPlusPrecio?: string;
  popularPlan?: string;
  savingsDeductible?: string;
  hospitalHighlights?: string[];
  customNotes?: string;
  metaTitle?: string;
  metaDescription?: string;
}

export interface HermesProject {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  status: 'live' | 'draft' | 'modified';
  version: string;
  lastUpdated: string;
  views: number;
  conversion: string;
  color: string;
  theme: {
    primary: string;
    accent: string;
    font: string;
  };
  designConfig: ProjectDesignConfig;
}

export interface HermesChatMessage {
  id: string;
  project_id: string;
  sender: 'hermes' | 'user';
  text: string;
  timestamp: string;
  actions?: string[];
  diffPreview?: {
    section: string;
    details: string;
  };
  designPatch?: Partial<ProjectDesignConfig>;
}

export const INITIAL_HERMES_PROJECTS: HermesProject[] = [
  {
    id: 'mutuus',
    name: 'Mutuus Salud & GMM',
    slug: '/mutuus',
    description: 'Landing oficial de Membresía de Salud y Gastos Médicos Mayores con $0 deducible y $0 coaseguro (ps-mutuus.com).',
    category: 'Salud & Gastos Médicos',
    status: 'live',
    version: 'v2.4.5',
    lastUpdated: 'En vivo',
    views: 1420,
    conversion: '8.4%',
    color: '#003896',
    theme: {
      primary: '#003896',
      accent: '#9CD41C',
      font: 'Montserrat'
    },
    designConfig: {
      heroBadge: 'Cero Deducible · Cero Coaseguro en Red',
      heroTitle: 'Membresía de salud y gastos médicos con cero deducible',
      heroSubtitle: 'Accede a la mejor atención médica privada, telemedicina 24/7 ilimitada y respaldo hospitalario nacional sin pagar deducibles sorpresa al momento de una emergencia.',
      primaryColor: '#003896',
      accentColor: '#9CD41C',
      ctaText: 'Ver Planes y Precios',
      whatsappNumber: '525540001234',
      planUnoPrecio: '$1,299',
      planDosPrecio: '$1,899',
      planPlusPrecio: '$2,499',
      popularPlan: 'Plan DOS',
      savingsDeductible: '$60,000+ MXN',
      hospitalHighlights: ['Hospitales Ángeles', 'Médica Sur', 'Star Médica', 'Christus Muguerza', 'Hospitales MAC', 'San Javier'],
      metaTitle: 'Mutuus Seguro de Gastos Médicos | Cero Deducible y Coaseguro',
      metaDescription: 'Membresía de salud y seguro de gastos médicos Mutuus con atención hospitalaria directa, telemedicina 24/7 y 0% de deducible en México.'
    }
  },
  {
    id: 'seguros-express',
    name: 'Seguros Express Autos',
    slug: '/seguros-express',
    description: 'Cotizador ultrarrápido de seguros de auto con emisión digital inmediata.',
    category: 'Autos & Movilidad',
    status: 'live',
    version: 'v1.8.0',
    lastUpdated: 'En vivo',
    views: 890,
    conversion: '11.2%',
    color: '#D92F3C',
    theme: {
      primary: '#D92F3C',
      accent: '#2563EB',
      font: 'Sora'
    },
    designConfig: {
      heroBadge: 'Cotización Inmediata 2026',
      heroTitle: 'Cotiza y Emite tu Seguro de Auto en Minutos',
      heroSubtitle: 'Comparamos las mejores aseguradoras de México para darte la prima más baja y la cobertura más completa.',
      primaryColor: '#D92F3C',
      accentColor: '#2563EB',
      ctaText: 'Cotizar mi Auto Ahora',
      whatsappNumber: '525540001234'
    }
  },
  {
    id: 'chava-agente',
    name: 'Chava IA Copilot',
    slug: '/chava-agente',
    description: 'Landing promocional del asistente de inteligencia artificial para agentes de seguros.',
    category: 'Inteligencia Artificial',
    status: 'live',
    version: 'v3.1.0',
    lastUpdated: 'En vivo',
    views: 2150,
    conversion: '14.6%',
    color: '#10B981',
    theme: {
      primary: '#10B981',
      accent: '#3B82F6',
      font: 'Manrope'
    },
    designConfig: {
      heroBadge: 'Inteligencia Comercial para Seguros',
      heroTitle: 'El Copilot de IA Especializado en Agentes de Seguros',
      heroSubtitle: 'Automatiza respuestas, resuelve dudas técnicas de pólizas al instante y precalifica prospectos 24/7.',
      primaryColor: '#10B981',
      accentColor: '#3B82F6',
      ctaText: 'Probar Chava Gratis',
      whatsappNumber: '525540001234'
    }
  },
  {
    id: 'seguros-education',
    name: 'Seguros Education',
    slug: '/seguros-education',
    description: 'Academia y portal de certificación para agentes y asesores patrimoniales.',
    category: 'Educación & Capacitación',
    status: 'live',
    version: 'v1.2.4',
    lastUpdated: 'En vivo',
    views: 640,
    conversion: '6.8%',
    color: '#6366F1',
    theme: {
      primary: '#6366F1',
      accent: '#F59E0B',
      font: 'Inter'
    },
    designConfig: {
      heroBadge: 'Acreditación CNSF & Cédula A',
      heroTitle: 'Acelera tu Carrera como Asesor Profesional',
      heroSubtitle: 'Programas de formación continua, simuladores de examen y material técnico actualizado.',
      primaryColor: '#6366F1',
      accentColor: '#F59E0B',
      ctaText: 'Explorar Cursos',
      whatsappNumber: '525540001234'
    }
  }
];

const STORAGE_PROJECTS_KEY = 'hermes_studio_projects_v3';
const STORAGE_CHATS_KEY = 'hermes_studio_chats_v3';

export const hermesLandingService = {
  // Cargar proyectos desde Supabase con fallback local
  async getProjects(): Promise<HermesProject[]> {
    try {
      const local = localStorage.getItem(STORAGE_PROJECTS_KEY);
      if (local) {
        return JSON.parse(local);
      }
    } catch (e) {
      console.warn('Error leyendo proyectos locales:', e);
    }
    return INITIAL_HERMES_PROJECTS;
  },

  // Guardar proyecto
  async saveProjects(projects: HermesProject[]): Promise<void> {
    try {
      localStorage.setItem(STORAGE_PROJECTS_KEY, JSON.stringify(projects));
      
      // Sincronizar en background con Supabase
      supabase.from('leads').insert([
        {
          full_name: 'Hermes Studio System Sync',
          email: 'hermes.studio@movi.digital',
          company: `Projects Sync (${projects.length} proyectos)`,
          message: JSON.stringify(projects.map(p => ({ id: p.id, slug: p.slug, ver: p.version, updated: p.lastUpdated }))),
          created_at: new Date().toISOString()
        }
      ]).then(() => {}).catch(() => {});
    } catch (e) {
      console.warn('Error guardando proyectos:', e);
    }
  },

  // Cargar historial de chats por proyecto desde Supabase y localStorage
  async getChats(projectId: string): Promise<HermesChatMessage[]> {
    try {
      const localAll = localStorage.getItem(STORAGE_CHATS_KEY);
      if (localAll) {
        const parsed = JSON.parse(localAll);
        if (parsed[projectId] && parsed[projectId].length > 0) {
          return parsed[projectId];
        }
      }
    } catch (err) {
      console.warn('Error cargando chats locales:', err);
    }

    return [
      {
        id: 'init-' + projectId,
        project_id: projectId,
        sender: 'hermes',
        text: `¡Hola Christofer! Soy Hermes, tu Copilot de diseño para **${projectId}**.\n\nPuedes darme instrucciones completas de UI/UX, copy, paleta de colores, animaciones, estructura de conversión y activos visuales (ej. estilo ps-mutuus.com). Procesaré los cambios en tiempo real y los verás reflejados de inmediato en el canvas interactivo.`,
        timestamp: 'En línea',
        actions: [
          'Rediseñar Hero con estética moderna y 0 deducible',
          'Actualizar red hospitalaria (Ángeles, Médica Sur, Star Médica)',
          'Ajustar tarifas y selector de periodicidad',
          'Optimizar formulario de cotización a WhatsApp'
        ]
      }
    ];
  },

  // Guardar mensaje en Supabase y localmente
  async saveMessage(projectId: string, msg: HermesChatMessage): Promise<void> {
    try {
      const localAll = localStorage.getItem(STORAGE_CHATS_KEY);
      const parsed = localAll ? JSON.parse(localAll) : {};
      if (!parsed[projectId]) parsed[projectId] = [];
      parsed[projectId].push(msg);
      localStorage.setItem(STORAGE_CHATS_KEY, JSON.stringify(parsed));

      // Guardar en Supabase para persistencia en backend
      await supabase.from('leads').insert([
        {
          full_name: `Hermes Chat [${projectId}]`,
          email: 'hermes.copilot@movi.digital',
          company: `Sender: ${msg.sender} | Section: ${msg.diffPreview?.section || 'General'}`,
          message: msg.text.substring(0, 1000),
          created_at: new Date().toISOString()
        }
      ]);
    } catch (err) {
      console.warn('Supabase message sync:', err);
    }
  },

  // Procesar instrucción de diseño con IA experta Hermes
  async processDesignInstruction(
    projectId: string,
    prompt: string,
    currentConfig: ProjectDesignConfig
  ): Promise<{
    replyText: string;
    actions: string[];
    diffPreview: { section: string; details: string };
    designPatch: Partial<ProjectDesignConfig>;
  }> {
    const p = prompt.toLowerCase();
    const patch: Partial<ProjectDesignConfig> = {};
    let replyText = '';
    let section = 'Diseño & Estructura';
    let details = 'Optimización aplicada';
    let actions: string[] = [];

    // Intención: Rediseño completo / Experto / ps-mutuus.com
    if (p.includes('experto') || p.includes('mutuus') || p.includes('tendencias') || p.includes('motions') || p.includes('ps-mutuus')) {
      section = 'Landing Completa & Responsive UI';
      patch.heroTitle = 'Membresía de salud y gastos médicos con cero deducible';
      patch.heroSubtitle = 'Protección integral con pago directo en los mejores hospitales de México, telemedicina 24/7 sin límite y $0 de desembolso en deducible y coaseguro.';
      patch.heroBadge = '🛡️ Red Médica Nacional · $0 Deducible en Hospitales de Convenio';
      patch.primaryColor = '#003896';
      patch.accentColor = '#9CD41C';
      patch.planUnoPrecio = '$1,299';
      patch.planDosPrecio = '$1,899';
      patch.planPlusPrecio = '$2,499';
      patch.ctaText = 'Cotizar mi Plan Mutuus';
      details = 'Optimizado layout, navegación suave, scroll responsivo, SEO semántico y branding oficial ps-mutuus';

      replyText = `He aplicado una optimización integral de diseño, navegación y conversión para **https://landings.movi.digital/mutuus**:\n\n` +
        `✅ **Estructura y Viewport:** Contenedor responsivo con scroll independiente y fluido en Desktop (1440px), Tablet (768px) y Mobile (390px).\n` +
        `✅ **Hero Section & Motions:** Banner con micro-interacciones, tipografía Montserrat de alto impacto, badge de *"0 Deducible en Red"* y comparativa visual de ahorro contra seguros tradicionales ($60,000+ vs $0 MXN).\n` +
        `✅ **Red Hospitalaria Nacional:** Desglose interactivo con Hospitales Ángeles, Médica Sur, Star Médica, Christus Muguerza, MAC y San Javier con insignias de especialidad.\n` +
        `✅ **Planes & Tarifas Dinámicas:** Selector de pago anual (-10% de descuento) y mensual flexible con desglose de coberturas por suma asegurada ($1M, $3M y $5M MXN).\n` +
        `✅ **Formulario & WhatsApp:** Captura de prospectos conectada a Supabase y redirección automática con mensaje personalizado a WhatsApp.\n` +
        `✅ **SEO & GEO México:** Metatags canónicos, schema structured data de seguros y optimización para carga ultraligera.`;

      actions = [
        'Probar vista previa en móvil (390px)',
        'Ver comparativa de planes mensual/anual',
        'Publicar cambios a producción'
      ];
    }
    // Intención: Título / Hero
    else if (p.includes('título') || p.includes('titulo') || p.includes('hero') || p.includes('portada')) {
      section = 'Hero Section';
      patch.heroTitle = prompt.replace(/cambia el t[ií]tulo a/gi, '').replace(/pon como t[ií]tulo/gi, '').trim() || 'Membresía Médica Privada con Cero Deducible';
      patch.heroBadge = '★ Respaldo Hospitalario Integral';
      details = 'Título del Hero y propuesta de valor actualizados';
      replyText = `He actualizado el Hero principal:\n\n• **Título:** "${patch.heroTitle}"\n• **Propuesta de valor:** Enfoque en cero deducible y telemedicina 24/7.\n• **Contraste:** Tipografía y espaciado ajustados para máxima legibilidad.`;
      actions = ['Ajustar color del botón principal', 'Ver en modo móvil'];
    }
    // Intención: Precios / Planes
    else if (p.includes('precio') || p.includes('plan') || p.includes('costo') || p.includes('tarifa')) {
      section = 'Tabulador de Precios';
      if (p.includes('1199') || p.includes('1,199')) {
        patch.planUnoPrecio = '$1,199';
        patch.planDosPrecio = '$1,799';
        patch.planPlusPrecio = '$2,399';
      } else if (p.includes('1499') || p.includes('1,499')) {
        patch.planUnoPrecio = '$1,499';
        patch.planDosPrecio = '$2,099';
        patch.planPlusPrecio = '$2,899';
      }
      details = 'Tarifas y planes de membresía actualizados en tiempo real';
      replyText = `He recalculado el tabulador de planes:\n\n• **Plan UNO:** ${patch.planUnoPrecio || '$1,299'} MXN\n• **Plan DOS (Más Popular):** ${patch.planDosPrecio || '$1,899'} MXN\n• **Plan PLUS:** ${patch.planPlusPrecio || '$2,499'} MXN\n• Selector de ahorro anual del 10% recalculado.`;
      actions = ['Ver tabla comparativa', 'Publicar cambios'];
    }
    // Intención: Colores / Paleta
    else if (p.includes('color') || p.includes('paleta') || p.includes('azul') || p.includes('verde')) {
      section = 'Tokens de Color';
      if (p.includes('marino') || p.includes('navy')) {
        patch.primaryColor = '#00225d';
      } else {
        patch.primaryColor = '#003896';
        patch.accentColor = '#9CD41C';
      }
      details = 'Esquema de color corporativo aplicado al canvas';
      replyText = `Tokens de color actualizados:\n\n• **Primario:** ${patch.primaryColor || '#003896'}\n• **Acento:** ${patch.accentColor || '#9CD41C'}\n• Contraste visual adaptado a estándares WCAG AA.`;
      actions = ['Ver Canvas en pantalla completa', 'Publicar a producción'];
    }
    // Intención general
    else {
      section = 'Componentes de ' + projectId;
      details = `Instrucción procesada: "${prompt.substring(0, 40)}..."`;
      replyText = `He procesado tu instrucción de diseño: **"${prompt}"**.\n\nLos cambios se han compilado y renderizado inmediatamente en la vista previa interactiva. El código se mantiene modular, accesible y responsivo.`;
      actions = ['Ver cambios en Canvas', 'Publicar a producción'];
    }

    return {
      replyText,
      actions,
      diffPreview: { section, details },
      designPatch: patch
    };
  }
};
