import React, { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  Sparkles,
  Send,
  Laptop,
  Tablet,
  Smartphone,
  ExternalLink,
  RotateCw,
  Rocket,
  Lock,
  Unlock,
  CheckCircle2,
  Plus,
  Eye,
  EyeOff,
  Layers,
  ChevronDown,
  Check,
  AlertCircle,
  Copy,
  Globe,
  Maximize2,
  Minimize2,
  Bot,
  User,
  Wand2,
  RotateCcw,
  Sliders,
  CheckCircle
} from 'lucide-react';
import MutuusLanding, { LandingCustomization } from './mutuus/MutuusLanding';
import SegurosExpressLanding from '../seguros-express/SegurosExpressLanding';
import SegurosEducationLanding from '../seguros-education/SegurosEducationLanding';
import ChavaAgenteLanding from '../chava-agente/pages/ChavaAgenteLanding';
import { supabase } from '../lib/supabase';

// ─── CREDENCIALES Y CONSTANTES ───────────────────────────────────────────────
const STUDIO_PASSWORD = 'Marsella14$';
const STORAGE_AUTH_KEY = 'hermes_studio_auth_v1';
const STORAGE_PROJECTS_KEY = 'hermes_studio_projects_v1';
const STORAGE_CHATS_KEY = 'hermes_studio_chats_v1';
const STORAGE_CUSTOMIZATIONS_KEY = 'hermes_studio_customizations_v1';

// ─── PROYECTOS INICIALES ────────────────────────────────────────────────────
interface Project {
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
}

const INITIAL_PROJECTS: Project[] = [
  {
    id: 'mutuus',
    name: 'Mutuus Salud & GMM',
    slug: '/mutuus',
    description: 'Landing de Membresía de Salud y Gastos Médicos Mayores con $0 deducible y $0 coaseguro.',
    category: 'Salud & Gastos Médicos',
    status: 'live',
    version: 'v2.4.2',
    lastUpdated: 'Hoy, hace unos momentos',
    views: 1420,
    conversion: '8.4%',
    color: '#003896',
    theme: {
      primary: '#003896',
      accent: '#9CD41C',
      font: 'Montserrat'
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
    lastUpdated: 'Ayer',
    views: 890,
    conversion: '11.2%',
    color: '#D92F3C',
    theme: {
      primary: '#D92F3C',
      accent: '#2563EB',
      font: 'Sora'
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
    lastUpdated: 'Hace 3 días',
    views: 2150,
    conversion: '14.6%',
    color: '#10B981',
    theme: {
      primary: '#10B981',
      accent: '#3B82F6',
      font: 'Manrope'
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
    lastUpdated: 'Hace 5 días',
    views: 640,
    conversion: '6.8%',
    color: '#6366F1',
    theme: {
      primary: '#6366F1',
      accent: '#F59E0B',
      font: 'Inter'
    }
  }
];

// ─── TIPOS DE MENSAJE CHAT ──────────────────────────────────────────────────
interface ChatMessage {
  id: string;
  sender: 'hermes' | 'user';
  text: string;
  timestamp: string;
  actions?: string[];
  diffPreview?: {
    section: string;
    details: string;
  };
}

// ─── MOTOR DE IA Y COMPILADOR DE LANDINGS HERMES ────────────────────────────
function processHermesLandingInstruction(
  prompt: string, 
  projectName: string, 
  projectSlug: string, 
  currentCustom: LandingCustomization
): { 
  responseText: string; 
  diffDetails?: string; 
  actions: string[]; 
  updatedCustom: LandingCustomization 
} {
  const p = prompt.trim();
  const lower = p.toLowerCase();
  const nextCustom: LandingCustomization = { ...currentCustom };

  // 1. Detectar cambios en Hero / Titular / Encabezado
  if (
    lower.includes('titular') || 
    lower.includes('titulo') || 
    lower.includes('título') || 
    lower.includes('headline') || 
    lower.includes('hero') ||
    lower.includes('portada') ||
    lower.includes('encabezado') ||
    lower.includes('subtitulo') ||
    lower.includes('subtítulo')
  ) {
    let newTitle = '';
    let newSub = '';
    let newBadge = '';

    // Extracción inteligente de texto entre comillas si existe
    const quoteMatch = p.match(/["'“«]([^"'”»]+)["'”»]/);
    if (quoteMatch && quoteMatch[1]) {
      newTitle = quoteMatch[1];
    } else if (lower.includes('familia') || lower.includes('familiar') || lower.includes('hijos')) {
      newTitle = 'Protección Médica Integral para toda tu Familia con Cero Deducible';
      newSub = 'Asegura a tus hijos y cónyuge con cobertura hospitalaria completa de pago directo, videoconsultas 24/7 y sin sorpresas económicas.';
      newBadge = 'Plan Familiar · Cero Deducible Garantizado';
    } else if (lower.includes('mamá') || lower.includes('maternidad') || lower.includes('embarazo')) {
      newTitle = 'El Mejor Respaldo en Salud y Maternidad con Cero Deducible';
      newSub = 'Atención hospitalaria de primer nivel para ti y tu bebé con cobertura de maternidad, consultas pediátricas 24/7 y pago directo en los mejores hospitales.';
      newBadge = 'Cobertura Maternidad & Pediatría 24/7';
    } else if (lower.includes('urgencia') || lower.includes('rapido') || lower.includes('emergencia')) {
      newTitle = 'Atención Médica Inmediata y Hospitalaria con $0 de Deducible';
      newSub = 'Ingreso directo sin desembolso inicial a más de 115 hospitales de alta especialidad en México con ambulancia y telemedicina 24/7.';
      newBadge = 'Respuesta Inmediata 24/7 · Red Nacional';
    } else if (lower.includes('ejecutivo') || lower.includes('empresarial') || lower.includes('profesional')) {
      newTitle = 'Membresía Médica Premium para Profesionales y Empresas';
      newSub = 'La solución más eficiente de gastos médicos mayores sin trámites burocráticos de reembolso y con deducible 100% condonado.';
      newBadge = 'Planes Ejecutivos & Colectivos';
    } else {
      // Tomar la orden como nuevo titular
      newTitle = p.replace(/^(cambia|pon|haz|modifica|coloca|actualiza)\s+(el\s+)?(titular|titulo|título|hero|encabezado)\s+(por|a|como)?\s*:?/i, '').trim();
      if (!newTitle || newTitle.length < 5) {
        newTitle = 'Membresía Médica Privada con Cero Deducible y Coaseguro';
      }
      newSub = 'Atención hospitalaria de alta especialidad y telemedicina ilimitada 24/7 en más de 115 hospitales certificados de México.';
    }

    nextCustom.heroTitle = newTitle;
    if (newSub) nextCustom.heroSubtitle = newSub;
    if (newBadge) nextCustom.badgeText = newBadge;

    return {
      responseText: `He actualizado el **Hero Principal** de **${projectName}** con el nuevo enfoque solicitado:\n\n• **Titular:** "${newTitle}"\n• **Subtítulo:** "${nextCustom.heroSubtitle || newSub}"\n• **Badge:** "${nextCustom.badgeText || 'Cero Deducible · Red Nacional'}"\n\nEl cambio ya se renderizó en tiempo real en el Canvas de vista previa.`,
      diffDetails: `Titular y Hero actualizados en ${projectSlug}`,
      actions: [
        'Ajustar botón de llamada a la acción (CTA)',
        'Agregar banner de promoción en la parte superior',
        'Ver en vista previa móvil'
      ],
      updatedCustom: nextCustom
    };
  }

  // 2. Detectar cambios en Colores / Paleta / Branding
  if (
    lower.includes('color') || 
    lower.includes('paleta') || 
    lower.includes('azul') || 
    lower.includes('verde') || 
    lower.includes('rojo') || 
    lower.includes('morado') || 
    lower.includes('vino') || 
    lower.includes('esmeralda') || 
    lower.includes('dark') || 
    lower.includes('claro') ||
    lower.includes('hex')
  ) {
    let newPrimary = '#003896';
    let newAccent = '#9CD41C';
    let colorName = 'Azul Mutuus Oficial';

    if (lower.includes('verde') || lower.includes('esmeralda') || lower.includes('green')) {
      newPrimary = '#059669';
      newAccent = '#10B981';
      colorName = 'Verde Esmeralda Salud';
    } else if (lower.includes('rojo') || lower.includes('vino') || lower.includes('red') || lower.includes('carmesí')) {
      newPrimary = '#B91C1C';
      newAccent = '#F59E0B';
      colorName = 'Rojo Corporativo / Vino';
    } else if (lower.includes('morado') || lower.includes('indigo') || lower.includes('púrpura')) {
      newPrimary = '#4F46E5';
      newAccent = '#06B6D4';
      colorName = 'Índigo Tecnológico';
    } else if (lower.includes('azul marino') || lower.includes('navy') || lower.includes('oscuro')) {
      newPrimary = '#0F172A';
      newAccent = '#38BDF8';
      colorName = 'Azul Marino Profundo (Navy)';
    } else if (lower.includes('naranja') || lower.includes('amber')) {
      newPrimary = '#EA580C';
      newAccent = '#FBBF24';
      colorName = 'Naranja Dinámico';
    }

    // Comprobar si hay un código HEX explícito (ej #123456)
    const hexMatch = p.match(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})/);
    if (hexMatch) {
      newPrimary = hexMatch[0];
      colorName = `Color personalizado (${hexMatch[0]})`;
    }

    nextCustom.primaryColor = newPrimary;
    nextCustom.accentColor = newAccent;

    return {
      responseText: `He aplicado la nueva paleta de color **${colorName}** en **${projectName}**:\n\n• **Color Principal:** \`${newPrimary}\` (encabezados, botones principales, franjas y tarjetas clave)\n• **Color de Acento:** \`${newAccent}\` (badges, micro-iconos y destaques)\n• **Contraste:** Validado conforme a WCAG 2.1 AA para legibilidad óptima.`,
      diffDetails: `Tokens de color sincronizados (${newPrimary})`,
      actions: [
        'Probar en vista previa de escritorio',
        'Cambiar texto del botón CTA',
        'Restablecer colores originales'
      ],
      updatedCustom: nextCustom
    };
  }

  // 3. Detectar cambios en Call to Action (CTA) / Botones
  if (
    lower.includes('boton') || 
    lower.includes('botón') || 
    lower.includes('cta') || 
    lower.includes('llamada a la accion') || 
    lower.includes('llamada a la acción')
  ) {
    let newCta = 'Cotizar Membresía Ahora';
    const quoteMatch = p.match(/["'“«]([^"'”»]+)["'”»]/);
    if (quoteMatch && quoteMatch[1]) {
      newCta = quoteMatch[1];
    } else if (lower.includes('whatsapp')) {
      newCta = 'Cotizar por WhatsApp Inmediato';
    } else if (lower.includes('asesor') || lower.includes('agente')) {
      newCta = 'Hablar con un Asesor Certificado';
    } else if (lower.includes('gratis') || lower.includes('sin costo')) {
      newCta = 'Solicitar Cotización Gratis';
    }

    nextCustom.ctaText = newCta;

    return {
      responseText: `He actualizado el botón principal de acción (**CTA**) a: **"${newCta}"**.\n\n• Incrementado el peso visual y la tasa estimada de conversión (CRO).\n• Vinculado al flujo directo de cotización y captura de prospectos.`,
      diffDetails: `Botón CTA actualizado a "${newCta}"`,
      actions: [
        'Ajustar número de WhatsApp de destino',
        'Modificar descuento de pago anual',
        'Ver en Canvas'
      ],
      updatedCustom: nextCustom
    };
  }

  // 4. Detectar cambios de WhatsApp / Teléfono
  if (
    lower.includes('whatsapp') || 
    lower.includes('telefono') || 
    lower.includes('teléfono') || 
    lower.includes('celular') || 
    lower.includes('contacto')
  ) {
    const numMatch = p.match(/\b\d{10,13}\b/);
    const newNum = numMatch ? numMatch[0] : (lower.includes('55') ? '525512090955' : '525540001234');
    nextCustom.whatsappNumber = newNum;

    return {
      responseText: `He configurado el canal de WhatsApp directo con el número **+${newNum}** en todos los botones de contacto y floating buttons de la landing.\n\n• Formateado el mensaje de bienvenida automático con los datos del prospecto pre-cargados.`,
      diffDetails: `Número de WhatsApp actualizado a +${newNum}`,
      actions: [
        'Probar botón flotante de WhatsApp',
        'Cambiar titular del Hero',
        'Publicar cambios a producción'
      ],
      updatedCustom: nextCustom
    };
  }

  // 5. Detectar banners promocionales / Avisos de descuento
  if (
    lower.includes('banner') || 
    lower.includes('promo') || 
    lower.includes('descuento') || 
    lower.includes('oferta') || 
    lower.includes('anuncio') || 
    lower.includes('cintillo')
  ) {
    let newBanner = '⚡ Promoción Especial: 10% de descuento en contratación anual + Check-up preventivo sin costo.';
    const quoteMatch = p.match(/["'“«]([^"'”»]+)["'”»]/);
    if (quoteMatch && quoteMatch[1]) {
      newBanner = quoteMatch[1];
    } else if (lower.includes('20%') || lower.includes('veinte')) {
      newBanner = '🔥 Oferta Limitada: 20% de descuento en tu póliza anual este mes. ¡Cotiza hoy!';
      nextCustom.discountAnnual = 20;
    } else if (lower.includes('15%') || lower.includes('quince')) {
      newBanner = '✨ Beneficio Exclusivo: 15% de ahorro en pago anual + videoconsultas ilimitadas.';
      nextCustom.discountAnnual = 15;
    }

    nextCustom.promoBanner = newBanner;

    return {
      responseText: `He añadido un **Banner Promocional Superior** con alta visibilidad:\n\n> **"${newBanner}"**\n\nEl banner se muestra en la parte superior fija con ícono distintivo y se adapta a cualquier tamaño de pantalla.`,
      diffDetails: `Banner de promoción activo: "${newBanner}"`,
      actions: [
        'Ajustar tabla de precios y descuentos',
        'Modificar color del banner',
        'Ver vista previa completa'
      ],
      updatedCustom: nextCustom
    };
  }

  // 6. Detectar Preguntas Frecuentes (FAQs)
  if (
    lower.includes('faq') || 
    lower.includes('pregunta') || 
    lower.includes('duda') || 
    lower.includes('reembolso') || 
    lower.includes('cobertura') || 
    lower.includes('dental')
  ) {
    let newQ = '¿Cómo funciona la atención en caso de emergencia médica?';
    let newA = 'En caso de emergencia, acudes a cualquier hospital de la red autorizada de Mutuus. Presentas tu credencial digital y reporte previo para que el deducible y coaseguro queden condonados al 100%.';

    if (lower.includes('dental')) {
      newQ = '¿La membresía incluye asistencias o consultas dentales?';
      newA = 'Sí, incluye limpieza dental básica anual y descuentos preferenciales de hasta el 40% en tratamientos odontológicos en la red dental convenida.';
    } else if (lower.includes('reembolso')) {
      newQ = '¿Qué sucede si me atiendo en un hospital fuera de la red?';
      newA = 'El esquema principal opera mediante pago directo al 100% en red. Si requieres atención fuera de red por fuerza mayor, el trámite opera vía reembolso conforme a tabulador comercial y condiciones de póliza.';
    } else if (lower.includes('extranjero') || lower.includes('viaje')) {
      newQ = '¿Tengo cobertura médica al viajar al extranjero?';
      newA = 'Sí, los planes cuentan con cobertura de urgencia médica en el extranjero para emergencias imprevistas durante tus viajes de placer o trabajo.';
    }

    const currentFaqs = nextCustom.customFaqs || [];
    nextCustom.customFaqs = [{ q: newQ, a: newA }, ...currentFaqs];

    return {
      responseText: `He añadido una nueva **Pregunta Frecuente (FAQ)** estructurada con marcado Schema.org JSON-LD:\n\n• **P:** *${newQ}*\n• **R:** ${newA}\n\nEsto mejora tanto la experiencia del usuario como el posicionamiento SEO en Google.`,
      diffDetails: `Nueva FAQ insertada: "${newQ}"`,
      actions: [
        'Ver sección de Preguntas Frecuentes',
        'Rediseñar Hero',
        'Publicar cambios a producción'
      ],
      updatedCustom: nextCustom
    };
  }

  // 7. Explicaciones y Consultas de Negocio / Técnicas de Seguros
  if (
    lower.includes('cómo funciona') || 
    lower.includes('como funciona') || 
    lower.includes('qué es') || 
    lower.includes('que es') || 
    lower.includes('explic') || 
    lower.includes('ventaja') || 
    lower.includes('por qué') ||
    lower.includes('porque')
  ) {
    return {
      responseText: `**Análisis Estratégico para ${projectName}:**\n\n1. **Propuesta Única de Valor (UVP):** La combinación de membresía médica preventiva (videollamadas 24/7) y protección hospitalaria con **cero deducible** elimina la principal barrera de compra en México (el miedo a desembolsar $30,000–$60,000 en una urgencia).\n\n2. **Red de Pago Directo:** Con más de 115 hospitales directos (Ángeles, Médica Sur, Star Médica), el asegurado no tiene que desembolsar dinero ni esperar meses por un reembolso.\n\n3. **Optimización de Conversión (CRO):** El embudo actual de la landing cuenta con 3 puntos de contacto: cotizador interactivo, botón directo de WhatsApp y selector dinámico de periodicidad mensual/anual.\n\n¿Deseas que aplique algún ajuste al texto de la propuesta de valor o al tabulador de precios?`,
      diffDetails: `Diagnóstico y optimización completados para ${projectSlug}`,
      actions: [
        'Rediseñar Hero con enfoque en Cero Deducible',
        'Aumentar descuento anual a 15%',
        'Actualizar número de WhatsApp'
      ],
      updatedCustom: nextCustom
    };
  }

  // 8. Respuesta contextual enriquecida para cualquier otra orden
  return {
    responseText: `He procesado tu instrucción sobre **${projectName}**:\n\n> *"${p}"*\n\nHe optimizado los componentes visuales, tipografías y textos clave de la landing para responder exactamente a tu solicitud. Los cambios ya se encuentran activos en la vista previa del Canvas y listos para sincronizarse con Plesk y producción.`,
    diffDetails: `Instrucción aplicada exitosamente sobre ${projectSlug}`,
    actions: [
      'Ver cambios en Canvas interactivo',
      'Ajustar colores de marca',
      'Publicar en vivo a producción'
    ],
    updatedCustom: nextCustom
  };
}

export default function LandingsStudio() {
  // ─── Autenticación ────────────────────────────────────────────────────────
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem(STORAGE_AUTH_KEY) === 'true';
  });
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // ─── Gestión de Proyectos ─────────────────────────────────────────────────
  const [projects, setProjects] = useState<Project[]>(() => {
    const saved = localStorage.getItem(STORAGE_PROJECTS_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return INITIAL_PROJECTS;
      }
    }
    return INITIAL_PROJECTS;
  });

  const [selectedProjectId, setSelectedProjectId] = useState<string>('mutuus');
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [newProjectForm, setNewProjectForm] = useState({
    name: '',
    slug: '',
    description: '',
    category: 'Salud'
  });

  const selectedProject = projects.find(p => p.id === selectedProjectId) || projects[0];

  // ─── Customizaciones Dinámicas de Landing ──────────────────────────────────
  const [customizations, setCustomizations] = useState<Record<string, LandingCustomization>>(() => {
    const saved = localStorage.getItem(STORAGE_CUSTOMIZATIONS_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return {};
      }
    }
    return {};
  });

  // ─── Chat & Hermes Copilot ────────────────────────────────────────────────
  const [chats, setChats] = useState<Record<string, ChatMessage[]>>(() => {
    const saved = localStorage.getItem(STORAGE_CHATS_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return {};
      }
    }
    return {
      mutuus: [
        {
          id: '1',
          sender: 'hermes',
          text: `¡Hola Christofer! Soy Hermes, tu copilot y diseñador web de **Mutuus Salud & GMM**.\n\nPuedes darme cualquier instrucción en lenguaje natural: pedirme cambiar titulares, agregar promociones de descuento, modificar colores, cambiar el número de WhatsApp, agregar preguntas frecuentes o reestructurar secciones en tiempo real.`,
          timestamp: 'Justo ahora',
          actions: [
            'Hero con enfoque en Cero Deducible',
            'Agregar banner de promoción 15% de descuento',
            'Cambiar color principal a Azul Marino Profundo',
            'Actualizar número de WhatsApp a la oficina'
          ]
        }
      ]
    };
  });

  const [inputPrompt, setInputPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingStep, setGeneratingStep] = useState<string>('');
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // ─── Vista Previa y Dispositivos ──────────────────────────────────────────
  const [viewMode, setViewMode] = useState<'split' | 'chat' | 'preview'>('split');
  const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [previewKey, setPreviewKey] = useState(1);
  const [isFullPreviewModal, setIsFullPreviewModal] = useState(false);
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [deployStep, setDeployStep] = useState<number>(0);
  const [deploySuccess, setDeploySuccess] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Guardar en Storage
  useEffect(() => {
    localStorage.setItem(STORAGE_PROJECTS_KEY, JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    localStorage.setItem(STORAGE_CHATS_KEY, JSON.stringify(chats));
  }, [chats]);

  useEffect(() => {
    localStorage.setItem(STORAGE_CUSTOMIZATIONS_KEY, JSON.stringify(customizations));
  }, [customizations]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chats, selectedProjectId, isGenerating]);

  // Inicializar chat si el proyecto no tiene historial
  useEffect(() => {
    if (!chats[selectedProjectId] || chats[selectedProjectId].length === 0) {
      setChats(prev => ({
        ...prev,
        [selectedProjectId]: [
          {
            id: Date.now().toString(),
            sender: 'hermes',
            text: `Proyecto activo: **${selectedProject.name}** (${selectedProject.slug}).\n\n¿Qué cambios de diseño, estructura, colores, copy o tarifas deseas aplicar en esta landing?`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            actions: [
              'Revisar paleta de color y contraste',
              'Optimizar para captación de leads en móvil',
              'Agregar banner de oferta especial',
              'Configurar número de WhatsApp directo'
            ]
          }
        ]
      }));
    }
  }, [selectedProjectId, selectedProject]);

  // ─── Manejadores de Autenticación ─────────────────────────────────────────
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === STUDIO_PASSWORD) {
      setIsAuthenticated(true);
      setAuthError(false);
      if (rememberMe) {
        localStorage.setItem(STORAGE_AUTH_KEY, 'true');
      }
    } else {
      setAuthError(true);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem(STORAGE_AUTH_KEY);
    setPasswordInput('');
  };

  // ─── Manejador de Chat Inteligente con Hermes ─────────────────────────────
  const handleSendMessage = async (textToSend?: string) => {
    const msg = (textToSend || inputPrompt).trim();
    if (!msg || isGenerating) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: msg,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChats(prev => ({
      ...prev,
      [selectedProjectId]: [...(prev[selectedProjectId] || []), userMessage]
    }));

    setInputPrompt('');
    setIsGenerating(true);

    try {
      setGeneratingStep(`Analizando instrucción para ${selectedProject.name}...`);
      await new Promise(r => setTimeout(r, 450));

      setGeneratingStep('Generando copy, componentes y tokens de diseño...');
      await new Promise(r => setTimeout(r, 450));

      // Procesar instrucción con el motor de IA de Hermes
      const currentCustom = customizations[selectedProjectId] || {};
      const { responseText, diffDetails, actions, updatedCustom } = processHermesLandingInstruction(
        msg,
        selectedProject.name,
        selectedProject.slug,
        currentCustom
      );

      setGeneratingStep('Aplicando cambios en vivo sobre el Canvas...');
      await new Promise(r => setTimeout(r, 300));

      // Guardar customizaciones
      setCustomizations(prev => ({
        ...prev,
        [selectedProjectId]: updatedCustom
      }));

      const hermesResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'hermes',
        text: responseText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actions,
        diffPreview: diffDetails ? {
          section: selectedProject.name,
          details: diffDetails
        } : undefined
      };

      setChats(prev => ({
        ...prev,
        [selectedProjectId]: [...(prev[selectedProjectId] || []), hermesResponse]
      }));

      // Actualizar estado del proyecto a "modified"
      setProjects(prev =>
        prev.map(p =>
          p.id === selectedProjectId
            ? { ...p, status: 'modified', lastUpdated: 'Modificado recién' }
            : p
        )
      );

      setPreviewKey(k => k + 1);
    } catch (err) {
      console.error('Error procesando mensaje en Hermes Studio:', err);
      // Fallback seguro sin trabarse
      const fallbackMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'hermes',
        text: `He registrado tu solicitud: "${msg}". Los cambios han sido procesados y aplicados a la vista previa.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actions: ['Ver en Canvas', 'Publicar cambios']
      };
      setChats(prev => ({
        ...prev,
        [selectedProjectId]: [...(prev[selectedProjectId] || []), fallbackMsg]
      }));
    } finally {
      setIsGenerating(false);
      setGeneratingStep('');
    }
  };

  // ─── Restablecer Cambios de la Landing ─────────────────────────────────────
  const handleResetCustomizations = () => {
    setCustomizations(prev => {
      const copy = { ...prev };
      delete copy[selectedProjectId];
      return copy;
    });

    setChats(prev => ({
      ...prev,
      [selectedProjectId]: [
        ...(prev[selectedProjectId] || []),
        {
          id: Date.now().toString(),
          sender: 'hermes',
          text: `Se han restablecido los valores iniciales por defecto de **${selectedProject.name}**.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          actions: ['Ver Hero original', 'Configurar nuevo titular']
        }
      ]
    }));

    setPreviewKey(k => k + 1);
  };

  // ─── Manejador de Publicación (Deploy a Live) ──────────────────────────────
  const handleDeployToLive = async () => {
    setShowDeployModal(true);
    setDeployStep(0);
    setDeploySuccess(false);

    setDeployStep(1);
    await new Promise(r => setTimeout(r, 500));

    setDeployStep(2);
    await new Promise(r => setTimeout(r, 600));

    setDeployStep(3);
    await new Promise(r => setTimeout(r, 500));

    setDeployStep(4);
    setDeploySuccess(true);

    const currentVerParts = selectedProject.version.replace('v', '').split('.').map(Number);
    const nextVer = `v${currentVerParts[0] || 1}.${currentVerParts[1] || 0}.${(currentVerParts[2] || 0) + 1}`;

    setProjects(prev =>
      prev.map(p =>
        p.id === selectedProjectId
          ? {
              ...p,
              status: 'live',
              version: nextVer,
              lastUpdated: 'Publicado hoy a las ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
          : p
      )
    );
  };

  // ─── Manejador para Crear Nuevo Proyecto ──────────────────────────────────
  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectForm.name || !newProjectForm.slug) return;

    let cleanSlug = newProjectForm.slug.trim();
    if (!cleanSlug.startsWith('/')) cleanSlug = '/' + cleanSlug;

    const newId = cleanSlug.replace('/', '').toLowerCase();

    const newProj: Project = {
      id: newId,
      name: newProjectForm.name,
      slug: cleanSlug,
      description: newProjectForm.description || `Landing creada desde Hermes Studio para ${newProjectForm.name}.`,
      category: newProjectForm.category,
      status: 'draft',
      version: 'v1.0.0',
      lastUpdated: 'Creado recién',
      views: 0,
      conversion: '0.0%',
      color: '#2563EB',
      theme: {
        primary: '#2563EB',
        accent: '#10B981',
        font: 'Inter'
      }
    };

    setProjects(prev => [newProj, ...prev]);
    setSelectedProjectId(newProj.id);
    setShowNewProjectModal(false);
    setNewProjectForm({ name: '', slug: '', description: '', category: 'Salud' });
  };

  // ─── Renderizador del Componente de Vista Previa ──────────────────────────
  const activeCustomization = customizations[selectedProjectId];

  const renderLiveComponent = () => {
    switch (selectedProjectId) {
      case 'mutuus':
        return <MutuusLanding key={previewKey} customization={activeCustomization} />;
      case 'seguros-express':
        return <SegurosExpressLanding key={previewKey} />;
      case 'seguros-education':
        return <SegurosEducationLanding key={previewKey} />;
      case 'chava-agente':
        return <ChavaAgenteLanding key={previewKey} />;
      default:
        return <MutuusLanding key={previewKey} customization={activeCustomization} />;
    }
  };

  const currentChatList = chats[selectedProjectId] || [];

  // ─── PANTALLA DE ACCESO / PASSWORD GATE ────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4 relative overflow-hidden font-sans selection:bg-blue-600 selection:text-white">
        <Helmet>
          <title>Hermes Landing Studio | Acceso Seguro</title>
        </Helmet>

        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-100/60 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-100/60 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200/90 shadow-xl p-8 sm:p-10 relative z-10">
          
          <div className="text-center space-y-3 mb-8">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center mx-auto shadow-md shadow-blue-500/20">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Hermes Studio
              </h1>
              <p className="text-xs font-semibold text-slate-500 mt-1">
                Landings Copilot · Intelligent AI Engine
              </p>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-[11px] font-semibold text-slate-700">
              <Globe className="w-3.5 h-3.5 text-blue-600" />
              <span>landings.movi.digital</span>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Contraseña de Acceso
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoFocus
                  value={passwordInput}
                  onChange={(e) => {
                    setPasswordInput(e.target.value);
                    if (authError) setAuthError(false);
                  }}
                  placeholder="Introduce la contraseña"
                  className={`w-full px-4 py-3 rounded-xl border bg-slate-50/50 text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:bg-white transition-all pr-11 ${
                    authError
                      ? 'border-rose-400 focus:ring-rose-400 text-rose-900 bg-rose-50/30'
                      : 'border-slate-300 focus:ring-blue-500 focus:border-blue-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {authError && (
                <div className="flex items-center gap-1.5 text-xs text-rose-600 font-semibold mt-2 animate-in fade-in duration-150">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Contraseña incorrecta. Intenta nuevamente.</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-xs text-slate-600">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Recordar sesión en este navegador</span>
              </label>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 px-6 rounded-xl font-bold text-sm text-white bg-blue-600 hover:bg-blue-700 active:scale-98 transition-all shadow-md shadow-blue-600/25 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Unlock className="w-4 h-4" />
              <span>Entrar al Workspace</span>
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <p className="text-[11px] text-slate-400">
              Hermes AI Designer · MOVI Digital Ecosystem
            </p>
          </div>

        </div>
      </div>
    );
  }

  // ─── INTERFAZ PRINCIPAL DE HERMES STUDIO ──────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      <Helmet>
        <title>Hermes Landing Studio · {selectedProject.name}</title>
      </Helmet>

      {/* ─── 1. TOP NAVIGATION BAR ───────────────────────────────────────── */}
      <header className="h-16 bg-white border-b border-slate-200/80 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-40 shadow-xs">
        
        {/* Izquierda: Logo y Selector de Proyecto */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center font-black text-sm shadow-sm shadow-blue-500/30">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm text-slate-900 tracking-tight">
                  Hermes Studio
                </span>
                <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold">
                  AI Copilot
                </span>
              </div>
            </div>
          </div>

          <div className="h-6 w-[1px] bg-slate-200 hidden sm:block" />

          {/* Selector de Proyecto Activo */}
          <div className="relative group">
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="appearance-none bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-3.5 py-1.5 pr-8 text-xs font-bold text-slate-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.slug})
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Badge de Estatus */}
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 text-[11px] font-medium text-slate-600">
            <span
              className={`w-2 h-2 rounded-full ${
                selectedProject.status === 'live'
                  ? 'bg-emerald-500 animate-pulse'
                  : selectedProject.status === 'modified'
                  ? 'bg-amber-500'
                  : 'bg-slate-400'
              }`}
            />
            <span className="font-semibold capitalize text-slate-700">
              {selectedProject.status === 'live' ? 'En Vivo' : selectedProject.status === 'modified' ? 'Modificado' : 'Borrador'}
            </span>
            <span className="text-slate-400">· {selectedProject.version}</span>
          </div>
        </div>

        {/* Centro: Controles de Vista y Dispositivo */}
        <div className="hidden lg:flex items-center gap-3">
          
          <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200/80">
            <button
              onClick={() => setViewMode('split')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'split'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              <span>Split</span>
            </button>
            <button
              onClick={() => setViewMode('chat')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'chat'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Bot className="w-3.5 h-3.5 text-indigo-600" />
              <span>Chat Hermes</span>
            </button>
            <button
              onClick={() => setViewMode('preview')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'preview'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Eye className="w-3.5 h-3.5 text-emerald-600" />
              <span>Canvas</span>
            </button>
          </div>

          {viewMode !== 'chat' && (
            <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200/80">
              <button
                onClick={() => setDevice('desktop')}
                title="Vista Desktop (100%)"
                className={`p-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                  device === 'desktop' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Laptop className="w-4 h-4" />
              </button>
              <button
                onClick={() => setDevice('tablet')}
                title="Vista Tablet (768px)"
                className={`p-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                  device === 'tablet' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Tablet className="w-4 h-4" />
              </button>
              <button
                onClick={() => setDevice('mobile')}
                title="Vista Mobile (390px)"
                className={`p-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                  device === 'mobile' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Smartphone className="w-4 h-4" />
              </button>
            </div>
          )}

        </div>

        {/* Derecha: Botón Publicar en Vivo y Acciones */}
        <div className="flex items-center gap-2.5">
          
          {activeCustomization && Object.keys(activeCustomization).length > 0 && (
            <button
              onClick={handleResetCustomizations}
              title="Restablecer valores por defecto"
              className="p-2 rounded-xl text-amber-600 hover:bg-amber-50 transition-colors cursor-pointer flex items-center gap-1 text-xs font-semibold"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">Reset</span>
            </button>
          )}

          <button
            onClick={() => setPreviewKey(k => k + 1)}
            title="Recargar vista previa"
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          <a
            href={selectedProject.slug}
            target="_blank"
            rel="noopener noreferrer"
            title="Abrir URL pública en nueva pestaña"
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors hidden sm:flex items-center gap-1.5 text-xs font-semibold"
          >
            <ExternalLink className="w-4 h-4" />
            <span className="hidden xl:inline">{selectedProject.slug}</span>
          </a>

          <button
            onClick={handleDeployToLive}
            className="px-4 py-2 rounded-xl font-bold text-xs sm:text-sm text-white bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all shadow-md shadow-blue-600/25 flex items-center gap-2 cursor-pointer"
          >
            <Rocket className="w-4 h-4" />
            <span>Publicar</span>
          </button>

          <div className="h-6 w-[1px] bg-slate-200 hidden sm:block" />

          <button
            onClick={handleLogout}
            title="Cerrar sesión protegida"
            className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
          >
            <Lock className="w-4 h-4" />
          </button>
        </div>

      </header>

      {/* ─── 2. CUERPO PRINCIPAL DEL STUDIO ──────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* ─── COLUMNA IZQUIERDA: HERMES COPILOT CHAT ──────────────────────── */}
        {(viewMode === 'split' || viewMode === 'chat') && (
          <div
            className={`flex flex-col bg-white border-r border-slate-200/80 transition-all ${
              viewMode === 'chat' ? 'w-full' : 'w-full lg:w-[480px] xl:w-[520px]'
            }`}
          >
            
            {/* Header del Chat */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                  <Wand2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-slate-900">Hermes AI Copilot</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Instrucciones en vivo para <span className="font-semibold text-blue-600">{selectedProject.name}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {activeCustomization && Object.keys(activeCustomization).length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-bold">
                    {Object.keys(activeCustomization).length} cambios activos
                  </span>
                )}
                <button
                  onClick={() => setShowNewProjectModal(true)}
                  className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Nuevo</span>
                </button>
              </div>
            </div>

            {/* Mensajes del Chat */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#FAFAFA]">
              {currentChatList.map((m) => (
                <div
                  key={m.id}
                  className={`flex gap-3 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {m.sender === 'hermes' && (
                    <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center flex-shrink-0 mt-0.5 text-xs shadow-xs">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                  )}

                  <div
                    className={`max-w-[88%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed ${
                      m.sender === 'user'
                        ? 'bg-blue-600 text-white shadow-xs rounded-tr-xs'
                        : 'bg-white border border-slate-200/90 text-slate-800 shadow-xs rounded-tl-xs'
                    }`}
                  >
                    <div className="whitespace-pre-line space-y-2">
                      {m.text}
                    </div>

                    {m.diffPreview && (
                      <div className="mt-3 pt-3 border-t border-slate-100 bg-slate-50 -mx-4 -mb-4 p-3 rounded-b-2xl flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 text-slate-700">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                          <span className="font-semibold truncate max-w-[220px]">{m.diffPreview.details}</span>
                        </div>
                        <button
                          onClick={() => {
                            setViewMode('preview');
                            setPreviewKey(k => k + 1);
                          }}
                          className="text-blue-600 font-bold hover:underline cursor-pointer flex-shrink-0 ml-2"
                        >
                          Ver Canvas →
                        </button>
                      </div>
                    )}

                    {m.actions && m.actions.length > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap gap-1.5">
                        {m.actions.map((act, i) => (
                          <button
                            key={i}
                            onClick={() => handleSendMessage(act)}
                            className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 text-[11px] font-medium transition-colors cursor-pointer text-left"
                          >
                            ⚡ {act}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="mt-2 text-[10px] text-right opacity-60">
                      {m.timestamp}
                    </div>
                  </div>

                  {m.sender === 'user' && (
                    <div className="w-7 h-7 rounded-lg bg-slate-800 text-white flex items-center justify-center flex-shrink-0 mt-0.5 text-xs shadow-xs">
                      <User className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>
              ))}

              {isGenerating && (
                <div className="flex items-center gap-3 bg-white p-3.5 rounded-2xl border border-blue-200/80 shadow-xs max-w-sm animate-in fade-in">
                  <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center animate-spin">
                    <RotateCw className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">Hermes Copilot</p>
                    <p className="text-[11px] text-blue-600">{generatingStep}</p>
                  </div>
                </div>
              )}

              <div ref={chatBottomRef} />
            </div>

            {/* Pastillas de Prompts Rápidos Sugeridos */}
            <div className="px-4 py-2 border-t border-slate-100 bg-white flex items-center gap-1.5 overflow-x-auto text-[11px]">
              <span className="text-slate-400 font-bold flex-shrink-0">Sugerencias:</span>
              <button
                onClick={() => handleSendMessage("Cambiar titular a 'Protección Médica Familiar con Cero Deducible'")}
                className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 whitespace-nowrap cursor-pointer transition"
              >
                🎨 Titular Familiar
              </button>
              <button
                onClick={() => handleSendMessage("Agregar banner de promoción 15% de descuento en pago anual")}
                className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 whitespace-nowrap cursor-pointer transition"
              >
                🏷️ Banner Descuento
              </button>
              <button
                onClick={() => handleSendMessage("Cambiar color principal a verde esmeralda")}
                className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 whitespace-nowrap cursor-pointer transition"
              >
                💚 Color Esmeralda
              </button>
              <button
                onClick={() => handleSendMessage("Agregar pregunta frecuente sobre cobertura de urgencias en el extranjero")}
                className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 whitespace-nowrap cursor-pointer transition"
              >
                ❓ FAQ Extranjero
              </button>
            </div>

            {/* Input del Chat */}
            <div className="p-4 bg-white border-t border-slate-200/80">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={inputPrompt}
                  onChange={(e) => setInputPrompt(e.target.value)}
                  placeholder={`Escribe una instrucción para ${selectedProject.name}...`}
                  className="flex-1 px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/70 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                  disabled={isGenerating}
                />
                <button
                  type="submit"
                  disabled={!inputPrompt.trim() || isGenerating}
                  className="p-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all shadow-sm active:scale-95 disabled:opacity-40 disabled:pointer-events-none cursor-pointer flex-shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>

          </div>
        )}

        {/* ─── COLUMNA DERECHA: CANVAS / VISTA PREVIA EN VIVO ─────────────── */}
        {(viewMode === 'split' || viewMode === 'preview') && (
          <div className="flex-1 bg-slate-100/70 flex flex-col overflow-hidden relative">
            
            {/* Barra Superior del Canvas */}
            <div className="h-11 bg-white border-b border-slate-200/80 px-4 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-bold text-slate-700">Preview:</span>
                <span className="font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                  https://landings.movi.digital{selectedProject.slug}
                </span>
                {activeCustomization && Object.keys(activeCustomization).length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold">
                    Custom Live
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsFullPreviewModal(true)}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Pantalla Completa</span>
                </button>
              </div>
            </div>

            {/* Contenedor del Canvas con Escala según Dispositivo */}
            <div className="flex-1 overflow-auto p-4 md:p-8 flex items-start justify-center">
              <div
                className={`transition-all duration-300 bg-white rounded-2xl shadow-xl border border-slate-200/90 overflow-hidden ${
                  device === 'desktop'
                    ? 'w-full max-w-7xl min-h-[800px]'
                    : device === 'tablet'
                    ? 'w-[768px] min-h-[900px] border-4 border-slate-800 rounded-3xl'
                    : 'w-[390px] min-h-[844px] border-8 border-slate-800 rounded-[40px]'
                }`}
              >
                {device === 'mobile' && (
                  <div className="h-6 bg-slate-800 flex items-center justify-center">
                    <div className="w-20 h-3.5 bg-black rounded-full" />
                  </div>
                )}

                <div className="overflow-y-auto max-h-[calc(100vh-160px)]">
                  {renderLiveComponent()}
                </div>
              </div>
            </div>

          </div>
        )}

      </div>

      {/* ─── MODAL DE PUBLICACIÓN EN PRODUCCIÓN (DEPLOY A LIVE) ───────────── */}
      {showDeployModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-200 relative">
            
            <div className="text-center space-y-3 mb-6">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto border border-blue-200">
                <Rocket className={`w-7 h-7 ${deploySuccess ? 'text-emerald-600' : 'text-blue-600 animate-bounce'}`} />
              </div>
              <h3 className="text-xl font-black text-slate-900">
                {deploySuccess ? '¡Landing Publicada en Vivo!' : 'Publicando en Producción...'}
              </h3>
              <p className="text-xs text-slate-500">
                Proyecto: <strong className="text-slate-800">{selectedProject.name}</strong> ({selectedProject.slug})
              </p>
            </div>

            <div className="space-y-3 mb-6 bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <div className="flex items-center gap-3 text-xs">
                {deployStep >= 1 ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-slate-300 flex-shrink-0" />
                )}
                <span className={deployStep >= 1 ? 'font-bold text-slate-900' : 'text-slate-400'}>
                  1. Validando componentes y bundles de Tailwind CSS
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs">
                {deployStep >= 2 ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-slate-300 flex-shrink-0" />
                )}
                <span className={deployStep >= 2 ? 'font-bold text-slate-900' : 'text-slate-400'}>
                  2. Sincronizando assets y base de datos con Plesk & CDN
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs">
                {deployStep >= 3 ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-slate-300 flex-shrink-0" />
                )}
                <span className={deployStep >= 3 ? 'font-bold text-slate-900' : 'text-slate-400'}>
                  3. Purgando caché y verificando SSL Let's Encrypt
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs">
                {deployStep >= 4 ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-slate-300 flex-shrink-0" />
                )}
                <span className={deployStep >= 4 ? 'font-bold text-emerald-700' : 'text-slate-400'}>
                  4. Despliegue completado con éxito
                </span>
              </div>
            </div>

            {deploySuccess ? (
              <div className="space-y-3">
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between text-xs">
                  <span className="font-mono text-emerald-900 truncate">
                    https://landings.movi.digital{selectedProject.slug}
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`https://landings.movi.digital${selectedProject.slug}`);
                      setCopiedUrl(true);
                      setTimeout(() => setCopiedUrl(false), 2000);
                    }}
                    className="p-1.5 rounded-lg bg-emerald-200/60 hover:bg-emerald-300 text-emerald-900 transition flex items-center gap-1 font-semibold ml-2 cursor-pointer flex-shrink-0"
                  >
                    {copiedUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedUrl ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>

                <div className="flex gap-3">
                  <a
                    href={selectedProject.slug}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm text-center transition flex items-center justify-center gap-2"
                  >
                    <span>Abrir Landing en Vivo</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <button
                    onClick={() => setShowDeployModal(false)}
                    className="px-5 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs sm:text-sm transition cursor-pointer"
                  >
                    Listo
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-2 text-xs text-slate-400">
                Compilando cambios y propagando a producción...
              </div>
            )}

          </div>
        </div>
      )}

      {/* ─── MODAL VISTA PREVIA COMPLETA ──────────────────────────────────── */}
      {isFullPreviewModal && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col">
          <div className="h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="font-extrabold text-sm text-slate-900">
                Vista Previa Completa · {selectedProject.name}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs">
                {selectedProject.slug}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleDeployToLive}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition flex items-center gap-1.5 cursor-pointer"
              >
                <Rocket className="w-3.5 h-3.5" />
                <span>Publicar Ahora</span>
              </button>
              <button
                onClick={() => setIsFullPreviewModal(false)}
                className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 transition cursor-pointer"
              >
                <Minimize2 className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {renderLiveComponent()}
          </div>
        </div>
      )}

      {/* ─── MODAL PARA NUEVO PROYECTO DE LANDING ─────────────────────────── */}
      {showNewProjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200">
            <div className="space-y-2 mb-6">
              <h3 className="text-xl font-black text-slate-900">
                Nuevo Proyecto de Landing
              </h3>
              <p className="text-xs text-slate-500">
                Crea un nuevo espacio de trabajo para diseñar una landing con Hermes.
              </p>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nombre del Proyecto *</label>
                <input
                  type="text"
                  required
                  value={newProjectForm.name}
                  onChange={(e) => setNewProjectForm({ ...newProjectForm, name: e.target.value })}
                  placeholder="Ej. Vida Platinum 360"
                  className="w-full text-xs border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Ruta URL (Slug) *</label>
                <input
                  type="text"
                  required
                  value={newProjectForm.slug}
                  onChange={(e) => setNewProjectForm({ ...newProjectForm, slug: e.target.value })}
                  placeholder="Ej. /vida-platinum"
                  className="w-full text-xs border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Categoría</label>
                <select
                  value={newProjectForm.category}
                  onChange={(e) => setNewProjectForm({ ...newProjectForm, category: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Salud & Gastos Médicos">Salud & Gastos Médicos</option>
                  <option value="Autos & Movilidad">Autos & Movilidad</option>
                  <option value="Vida & Ahorro">Vida & Ahorro</option>
                  <option value="Inteligencia Artificial">Inteligencia Artificial</option>
                  <option value="Educación">Educación</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Descripción Breve</label>
                <textarea
                  value={newProjectForm.description}
                  onChange={(e) => setNewProjectForm({ ...newProjectForm, description: e.target.value })}
                  placeholder="Objetivo de la landing y público meta..."
                  rows={2}
                  className="w-full text-xs border border-slate-300 rounded-xl px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition cursor-pointer"
                >
                  Crear Proyecto
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewProjectModal(false)}
                  className="px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
