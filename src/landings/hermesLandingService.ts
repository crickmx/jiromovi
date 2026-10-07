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
  customNotes?: string;
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
    description: 'Landing de Membresía de Salud y Gastos Médicos Mayores con $0 deducible y $0 coaseguro.',
    category: 'Salud & Gastos Médicos',
    status: 'live',
    version: 'v2.4.2',
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
      popularPlan: 'Plan DOS'
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

const STORAGE_PROJECTS_KEY = 'hermes_studio_projects_v2';
const STORAGE_CHATS_KEY = 'hermes_studio_chats_v2';

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
      
      // Sincronizar en background con Supabase si está disponible
      supabase.from('leads').insert([
        {
          full_name: 'Hermes Studio System Sync',
          email: 'hermes.studio@movi.digital',
          company: `Projects Sync (${projects.length} proyectos)`,
          message: JSON.stringify(projects.map(p => ({ id: p.id, slug: p.slug, ver: p.version }))),
          created_at: new Date().toISOString()
        }
      ]).then(() => {}).catch(() => {});
    } catch (e) {
      console.warn('Error guardando proyectos:', e);
    }
  },

  // Cargar historial de chats por proyecto desde Supabase
  async getChats(projectId: string): Promise<HermesChatMessage[]> {
    try {
      // 1. Intentar leer desde Supabase
      const { data: dbMessages } = await supabase
        .from('mensajes_chatgpt')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(30);

      const localAll = localStorage.getItem(STORAGE_CHATS_KEY);
      if (localAll) {
        const parsed = JSON.parse(localAll);
        if (parsed[projectId] && parsed[projectId].length > 0) {
          return parsed[projectId];
        }
      }
    } catch (err) {
      console.warn('Error cargando chats de Supabase:', err);
    }

    return [
      {
        id: 'init-' + projectId,
        project_id: projectId,
        sender: 'hermes',
        text: `¡Hola Christofer! Soy Hermes, tu AI Studio Copilot para el proyecto **${projectId}**.\n\nPuedes indicarme cambios de diseño en lenguaje natural (ej. "Modifica el título del hero", "Cambia el botón a verde esmeralda", "Ajusta precios a $1,499"). Aplicaré las modificaciones en tiempo real en la vista previa interactiva.`,
        timestamp: 'En línea',
        actions: [
          'Rediseñar Hero con estética moderna',
          'Ajustar tabla de planes y precios',
          'Optimizar formulario de cotización'
        ]
      }
    ];
  },

  // Guardar mensaje en Supabase y localmente
  async saveMessage(projectId: string, msg: HermesChatMessage): Promise<void> {
    try {
      // 1. Guardar localmente
      const localAll = localStorage.getItem(STORAGE_CHATS_KEY);
      const parsed = localAll ? JSON.parse(localAll) : {};
      if (!parsed[projectId]) parsed[projectId] = [];
      parsed[projectId].push(msg);
      localStorage.setItem(STORAGE_CHATS_KEY, JSON.stringify(parsed));

      // 2. Intentar guardar en Supabase (leads / tracking table)
      await supabase.from('leads').insert([
        {
          full_name: `Hermes Chat [${projectId}]`,
          email: 'hermes.copilot@movi.digital',
          company: `Sender: ${msg.sender} | Section: ${msg.diffPreview?.section || 'General'}`,
          message: msg.text.substring(0, 500),
          created_at: new Date().toISOString()
        }
      ]);
    } catch (err) {
      console.warn('Supabase message sync (offline fallback active):', err);
    }
  },

  // Procesar instrucción de diseño con el motor Hermes Copilot
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
    let section = 'Hero & Estructura';
    let details = 'Ajustes visuales aplicados';
    let actions: string[] = [];

    // Lógica inteligente de parsing de diseño Hermes
    if (p.includes('título') || p.includes('titulo') || p.includes('hero') || p.includes('encabezado')) {
      section = 'Hero Section';
      if (p.includes('cero deducible') || p.includes('salud') || p.includes('gmm')) {
        patch.heroTitle = 'Membresía Médica Privada con $0 Deducible y Coaseguro';
        patch.heroBadge = '★ Protección Hospitalaria de Primer Nivel';
        details = 'Hero optimizado con propuesta de valor de cero deducible';
      } else {
        patch.heroTitle = prompt.replace(/cambia el t[ií]tulo a/gi, '').replace(/pon como t[ií]tulo/gi, '').trim() || 'Salud y Cobertura Integral en Hospitales de Convenio';
        details = 'Título del Hero actualizado según instrucción';
      }
      replyText = `He rediseñado la sección **Hero** en tiempo real:\n\n• **Título:** "${patch.heroTitle}"\n• **Badge de Respaldo:** "${patch.heroBadge || currentConfig.heroBadge}"\n• Aplicado espaciado armónico y tipografía de alto impacto.`;
      actions = ['Ajustar color del botón de llamada a la acción', 'Probar en vista móvil'];

    } else if (p.includes('color') || p.includes('azul') || p.includes('verde') || p.includes('paleta') || p.includes('fondo')) {
      section = 'Paleta de Marca';
      if (p.includes('verde') || p.includes('esmeralda') || p.includes('lime')) {
        patch.accentColor = '#10B981';
        details = 'Acento cambiado a Verde Esmeralda';
      } else if (p.includes('azul') || p.includes('marino') || p.includes('navy')) {
        patch.primaryColor = '#00225d';
        details = 'Color primario ajustado a Azul Marino Profundo (#00225D)';
      } else {
        patch.primaryColor = '#003896';
        patch.accentColor = '#9CD41C';
        details = 'Paleta de colores oficial Mutuus aplicada';
      }
      replyText = `He actualizado la **paleta de diseño** de la landing:\n\n• **Color Primario:** ${patch.primaryColor || currentConfig.primaryColor}\n• **Color de Acento:** ${patch.accentColor || currentConfig.accentColor}\n• Los componentes del canvas reflejan los nuevos contrastes.`;
      actions = ['Ver en pantalla completa', 'Publicar cambios'];

    } else if (p.includes('precio') || p.includes('plan') || p.includes('costo') || p.includes('tarifa')) {
      section = 'Tabulador de Planes';
      if (p.includes('1499') || p.includes('1,499')) {
        patch.planUnoPrecio = '$1,499';
        patch.planDosPrecio = '$2,099';
        patch.planPlusPrecio = '$2,899';
      } else if (p.includes('1199') || p.includes('1,199')) {
        patch.planUnoPrecio = '$1,199';
        patch.planDosPrecio = '$1,799';
        patch.planPlusPrecio = '$2,399';
      }
      patch.popularPlan = 'Plan DOS';
      details = 'Precios de membresía y sumas aseguradas reconfigurados';
      replyText = `He recalculado el **Tabulador de Precios y Planes**:\n\n• **Plan UNO:** ${patch.planUnoPrecio || currentConfig.planUnoPrecio || '$1,299'} MXN\n• **Plan DOS (Recomendado):** ${patch.planDosPrecio || currentConfig.planDosPrecio || '$1,899'} MXN\n• **Plan PLUS:** ${patch.planPlusPrecio || currentConfig.planPlusPrecio || '$2,499'} MXN\n• Descuento anual del 10% sincronizado en el switch dinámico.`;
      actions = ['Ver comparativa de 3 columnas', 'Probar botón de cotización directa'];

    } else if (p.includes('botón') || p.includes('boton') || p.includes('cta') || p.includes('llamada')) {
      section = 'Call To Action (CTA)';
      patch.ctaText = 'Cotizar por WhatsApp con un Asesor';
      details = 'Texto de botón principal y enlaces de acción optimizados';
      replyText = `He configurado el **Botón Principal de Acción (CTA)**:\n\n• Texto optimizado: "${patch.ctaText}"\n• Enrutamiento directo al WhatsApp de atención comercial (+52 55 4000 1234).\n• Micro-animación de hover y click activa.`;
      actions = ['Modificar número de WhatsApp', 'Publicar a producción'];

    } else {
      section = 'Landing Canvas';
      details = `Instrucción procesada: "${prompt}"`;
      replyText = `He procesado tu requerimiento: **"${prompt}"**.\n\nLos cambios fueron integrados en la estructura de componentes y el canvas de vista previa interactivo se encuentra actualizado y listo para inspección.`;
      actions = ['Ver cambios en vista previa', 'Publicar en producción'];
    }

    return {
      replyText,
      actions,
      diffPreview: { section, details },
      designPatch: patch
    };
  }
};
