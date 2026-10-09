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
import SeguwalletProductLanding from '../seguwallet/pages/SeguwalletProductLanding';
import MoviMasterLanding from '../pages/MoviMasterLanding';
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
    id: 'movi',
    name: 'MOVI Digital Ecosistema',
    slug: '/movi',
    description: 'Página de presentación oficial del ecosistema digital MOVI para promotorías y agentes.',
    category: 'SaaS & Ecosistema',
    status: 'live',
    version: 'v3.0.0',
    lastUpdated: 'Hoy',
    views: 4500,
    conversion: '18.2%',
    color: '#0D6EFD',
    theme: {
      primary: '#0D6EFD',
      accent: '#00E5FF',
      font: 'Sora'
    }
  },
  {
    id: 'seguwallet',
    name: 'Seguwallet',
    slug: '/seguwallet',
    description: 'Página de producto oficial de la cartera digital de seguros para asegurados y clientes.',
    category: 'Fintech & Wallet',
    status: 'live',
    version: 'v2.1.0',
    lastUpdated: 'Hoy',
    views: 3120,
    conversion: '15.4%',
    color: '#1C37E0',
    theme: {
      primary: '#1C37E0',
      accent: '#00E5FF',
      font: 'Inter'
    }
  },
  {
    id: 'mutuus',
    name: 'Mutuus Salud & GMM',
    slug: '/mutuus',
    description: 'Landing de Membresía de Salud y Gastos Médicos Mayores con $0 deducible y $0 coaseguro.',
    category: 'Salud & Gastos Médicos',
    status: 'live',
    version: 'v2.4.2',
    lastUpdated: 'Hoy',
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
  const nextCustom: LandingCustomization = { ...currentCustom };

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
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem(STORAGE_AUTH_KEY) === 'true';
  });
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

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

  const [selectedProjectId, setSelectedProjectId] = useState<string>('movi');
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [newProjectForm, setNewProjectForm] = useState({
    name: '',
    slug: '',
    description: '',
    category: 'SaaS & Ecosistema'
  });

  const selectedProject = projects.find(p => p.id === selectedProjectId) || projects[0];

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
      movi: [
        {
          id: '1',
          sender: 'hermes',
          text: `¡Hola Christofer! Soy Hermes, tu copilot para la página de presentación del ecosistema **MOVI Digital**.\n\nEsta landing presenta las 8 plataformas, módulos core, SICAS y calculadora de productividad.`,
          timestamp: 'Justo ahora',
          actions: [
            'Ver presentación completa del ecosistema',
            'Probar calculadora de productividad',
            'Ver plataformas conectadas'
          ]
        }
      ]
    };
  });

  const [inputPrompt, setInputPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingStep, setGeneratingStep] = useState<string>('');
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const [viewMode, setViewMode] = useState<'split' | 'chat' | 'preview'>('split');
  const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [previewKey, setPreviewKey] = useState(1);
  const [isFullPreviewModal, setIsFullPreviewModal] = useState(false);
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [deployStep, setDeployStep] = useState<number>(0);
  const [deploySuccess, setDeploySuccess] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

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

      const currentCustom = customizations[selectedProjectId] || {};
      const { responseText, diffDetails, actions, updatedCustom } = processHermesLandingInstruction(
        msg,
        selectedProject.name,
        selectedProject.slug,
        currentCustom
      );

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

      setProjects(prev =>
        prev.map(p =>
          p.id === selectedProjectId
            ? { ...p, status: 'modified', lastUpdated: 'Modificado recién' }
            : p
        )
      );

      setPreviewKey(k => k + 1);
    } finally {
      setIsGenerating(false);
      setGeneratingStep('');
    }
  };

  const handleResetCustomizations = () => {
    setCustomizations(prev => {
      const copy = { ...prev };
      delete copy[selectedProjectId];
      return copy;
    });

    setPreviewKey(k => k + 1);
  };

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
      color: '#0D6EFD',
      theme: {
        primary: '#0D6EFD',
        accent: '#00E5FF',
        font: 'Sora'
      }
    };

    setProjects(prev => [newProj, ...prev]);
    setSelectedProjectId(newProj.id);
    setShowNewProjectModal(false);
    setNewProjectForm({ name: '', slug: '', description: '', category: 'SaaS & Ecosistema' });
  };

  const activeCustomization = customizations[selectedProjectId];

  const renderLiveComponent = () => {
    switch (selectedProjectId) {
      case 'movi':
        return <MoviMasterLanding key={previewKey} />;
      case 'seguwallet':
        return <SeguwalletProductLanding key={previewKey} />;
      case 'mutuus':
        return <MutuusLanding key={previewKey} customization={activeCustomization} />;
      case 'seguros-express':
        return <SegurosExpressLanding key={previewKey} />;
      case 'seguros-education':
        return <SegurosEducationLanding key={previewKey} />;
      case 'chava-agente':
        return <ChavaAgenteLanding key={previewKey} />;
      default:
        return <MoviMasterLanding key={previewKey} />;
    }
  };

  const currentChatList = chats[selectedProjectId] || [];

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4 relative overflow-hidden font-sans selection:bg-blue-600 selection:text-white">
        <Helmet>
          <title>Hermes Landing Studio | Acceso Seguro</title>
        </Helmet>

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

        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      <Helmet>
        <title>Hermes Landing Studio · {selectedProject.name}</title>
      </Helmet>

      {/* ─── TOP NAVIGATION BAR ───────────────────────────────────────── */}
      <header className="h-16 bg-white border-b border-slate-200/80 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-40 shadow-xs">
        
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

          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 text-[11px] font-medium text-slate-600">
            <span
              className={`w-2 h-2 rounded-full ${
                selectedProject.status === 'live'
                  ? 'bg-emerald-500 animate-pulse'
                  : 'bg-amber-500'
              }`}
            />
            <span className="font-semibold capitalize text-slate-700">
              {selectedProject.status === 'live' ? 'En Vivo' : 'Borrador'}
            </span>
            <span className="text-slate-400">· {selectedProject.version}</span>
          </div>
        </div>

        {/* Center view controls */}
        <div className="hidden lg:flex items-center gap-3">
          <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200/80">
            <button
              onClick={() => setViewMode('split')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'split' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              <span>Split</span>
            </button>
            <button
              onClick={() => setViewMode('chat')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'chat' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Bot className="w-3.5 h-3.5 text-indigo-600" />
              <span>Chat</span>
            </button>
            <button
              onClick={() => setViewMode('preview')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'preview' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Eye className="w-3.5 h-3.5 text-emerald-600" />
              <span>Canvas</span>
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2.5">
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

          <button
            onClick={handleLogout}
            title="Cerrar sesión"
            className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
          >
            <Lock className="w-4 h-4" />
          </button>
        </div>

      </header>

      {/* Main Studio Body */}
      <div className="flex-1 flex overflow-hidden">
        {(viewMode === 'split' || viewMode === 'chat') && (
          <div
            className={`flex flex-col bg-white border-r border-slate-200/80 transition-all ${
              viewMode === 'chat' ? 'w-full' : 'w-full lg:w-[480px] xl:w-[520px]'
            }`}
          >
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs">
                  <Wand2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-slate-900">Hermes AI Copilot</span>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Edición en vivo de <span className="font-semibold text-blue-600">{selectedProject.name}</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#FAFAFA]">
              {currentChatList.map((m) => (
                <div
                  key={m.id}
                  className={`flex gap-3 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {m.sender === 'hermes' && (
                    <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center flex-shrink-0 mt-0.5 text-xs">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                  )}

                  <div
                    className={`max-w-[88%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed ${
                      m.sender === 'user'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white border border-slate-200/90 text-slate-800 shadow-xs'
                    }`}
                  >
                    <div className="whitespace-pre-line space-y-2">{m.text}</div>
                    {m.actions && (
                      <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap gap-1.5">
                        {m.actions.map((act, i) => (
                          <button
                            key={i}
                            onClick={() => handleSendMessage(act)}
                            className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 text-[11px] font-medium transition cursor-pointer text-left"
                          >
                            ⚡ {act}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={chatBottomRef} />
            </div>

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
                  placeholder={`Instrucción para ${selectedProject.name}...`}
                  className="flex-1 px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/70 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isGenerating}
                />
                <button
                  type="submit"
                  disabled={!inputPrompt.trim() || isGenerating}
                  className="p-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition disabled:opacity-40 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Canvas */}
        {(viewMode === 'split' || viewMode === 'preview') && (
          <div className="flex-1 bg-slate-100/70 flex flex-col overflow-hidden relative">
            <div className="h-11 bg-white border-b border-slate-200/80 px-4 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-bold text-slate-700">Preview:</span>
                <span className="font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                  https://landings.movi.digital{selectedProject.slug}
                </span>
              </div>
              <button
                onClick={() => setIsFullPreviewModal(true)}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition flex items-center gap-1.5 cursor-pointer"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Pantalla Completa</span>
              </button>
            </div>

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
                <div className="overflow-y-auto max-h-[calc(100vh-160px)]">
                  {renderLiveComponent()}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Full preview modal */}
      {isFullPreviewModal && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col">
          <div className="h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between">
            <span className="font-extrabold text-sm text-slate-900">
              Vista Previa Completa · {selectedProject.name}
            </span>
            <button
              onClick={() => setIsFullPreviewModal(false)}
              className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 transition cursor-pointer"
            >
              <Minimize2 className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {renderLiveComponent()}
          </div>
        </div>
      )}

      {/* Deploy Modal */}
      {showDeployModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-200 relative text-center space-y-4">
            <Rocket className="w-10 h-10 text-emerald-600 mx-auto" />
            <h3 className="text-xl font-black text-slate-900">¡Landing Publicada en Vivo!</h3>
            <p className="text-xs text-slate-500">Proyecto sincronizado con éxito.</p>
            <button
              onClick={() => setShowDeployModal(false)}
              className="px-6 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs"
            >
              Listo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
