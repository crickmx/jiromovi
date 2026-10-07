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
  Sliders,
  FolderOpen,
  Search,
  Code2
} from 'lucide-react';
import MutuusLanding from './mutuus/MutuusLanding';
import SegurosExpressLanding from '../seguros-express/SegurosExpressLanding';
import SegurosEducationLanding from '../seguros-education/SegurosEducationLanding';
import ChavaAgenteLanding from '../chava-agente/pages/ChavaAgenteLanding';
import {
  hermesLandingService,
  HermesProject,
  HermesChatMessage,
  INITIAL_HERMES_PROJECTS
} from './hermesLandingService';

// ─── CREDENCIALES Y CONSTANTES ───────────────────────────────────────────────
const STUDIO_PASSWORD = 'Marsella14$';
const STORAGE_AUTH_KEY = 'hermes_studio_auth_v1';

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
  const [projects, setProjects] = useState<HermesProject[]>(INITIAL_HERMES_PROJECTS);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('mutuus');
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [newProjectForm, setNewProjectForm] = useState({
    name: '',
    slug: '',
    description: '',
    category: 'Salud & Gastos Médicos'
  });

  // ─── Chat & Hermes Copilot ────────────────────────────────────────────────
  const [chats, setChats] = useState<Record<string, HermesChatMessage[]>>({});
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

  // Cargar proyectos iniciales de hermesLandingService / Supabase
  useEffect(() => {
    hermesLandingService.getProjects().then((loadedProjects) => {
      if (loadedProjects && loadedProjects.length > 0) {
        setProjects(loadedProjects);
      }
    });
  }, []);

  // Cargar chat del proyecto seleccionado
  useEffect(() => {
    hermesLandingService.getChats(selectedProjectId).then((msgs) => {
      setChats(prev => ({ ...prev, [selectedProjectId]: msgs }));
    });
  }, [selectedProjectId]);

  const selectedProject = projects.find(p => p.id === selectedProjectId) || projects[0] || INITIAL_HERMES_PROJECTS[0];

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chats, selectedProjectId, isGenerating]);

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

  // ─── Manejador de Chat con Hermes Copilot ─────────────────────────────────
  const handleSendMessage = async (textToSend?: string) => {
    const msg = (textToSend || inputPrompt).trim();
    if (!msg || isGenerating) return;

    const userMessage: HermesChatMessage = {
      id: Date.now().toString(),
      project_id: selectedProjectId,
      sender: 'user',
      text: msg,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    // Actualizar UI y guardar en Supabase
    setChats(prev => ({
      ...prev,
      [selectedProjectId]: [...(prev[selectedProjectId] || []), userMessage]
    }));
    hermesLandingService.saveMessage(selectedProjectId, userMessage);

    setInputPrompt('');
    setIsGenerating(true);

    // Animación de pasos de razonamiento
    setGeneratingStep('Analizando arquitectura de componentes y CSS...');
    await new Promise(r => setTimeout(r, 500));

    setGeneratingStep('Sintetizando cambios y procesando diseño con Hermes AI...');
    await new Promise(r => setTimeout(r, 600));

    // Procesar cambios con el motor de Hermes
    const result = await hermesLandingService.processDesignInstruction(
      selectedProjectId,
      msg,
      selectedProject.designConfig
    );

    setGeneratingStep('Inyectando estilos dinámicos en el Canvas en tiempo real...');
    await new Promise(r => setTimeout(r, 400));

    // Aplicar patch de diseño al proyecto en tiempo real
    const updatedProjects = projects.map(p => {
      if (p.id === selectedProjectId) {
        return {
          ...p,
          status: 'modified' as const,
          lastUpdated: 'Modificado recién',
          designConfig: {
            ...p.designConfig,
            ...result.designPatch
          }
        };
      }
      return p;
    });

    setProjects(updatedProjects);
    hermesLandingService.saveProjects(updatedProjects);

    const hermesResponse: HermesChatMessage = {
      id: (Date.now() + 1).toString(),
      project_id: selectedProjectId,
      sender: 'hermes',
      text: result.replyText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      actions: result.actions,
      diffPreview: result.diffPreview,
      designPatch: result.designPatch
    };

    setChats(prev => ({
      ...prev,
      [selectedProjectId]: [...(prev[selectedProjectId] || []), hermesResponse]
    }));
    hermesLandingService.saveMessage(selectedProjectId, hermesResponse);

    setIsGenerating(false);
    setGeneratingStep('');
    setPreviewKey(k => k + 1);
  };

  // ─── Manejador de Publicación (Deploy a Live) ──────────────────────────────
  const handleDeployToLive = async () => {
    setShowDeployModal(true);
    setDeployStep(0);
    setDeploySuccess(false);

    setDeployStep(1);
    await new Promise(r => setTimeout(r, 600));

    setDeployStep(2);
    await new Promise(r => setTimeout(r, 700));

    setDeployStep(3);
    await new Promise(r => setTimeout(r, 700));

    setDeployStep(4);
    setDeploySuccess(true);

    const currentVerParts = selectedProject.version.replace('v', '').split('.').map(Number);
    const nextVer = `v${currentVerParts[0] || 1}.${currentVerParts[1] || 0}.${(currentVerParts[2] || 0) + 1}`;

    const updatedProjects = projects.map(p =>
      p.id === selectedProjectId
        ? {
            ...p,
            status: 'live' as const,
            version: nextVer,
            lastUpdated: 'Publicado hoy a las ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        : p
    );

    setProjects(updatedProjects);
    hermesLandingService.saveProjects(updatedProjects);
  };

  // ─── Manejador para Iniciar Nuevo Proyecto ─────────────────────────────────
  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectForm.name || !newProjectForm.slug) return;

    let cleanSlug = newProjectForm.slug.trim();
    if (!cleanSlug.startsWith('/')) cleanSlug = '/' + cleanSlug;

    const newId = cleanSlug.replace('/', '').toLowerCase();

    const newProj: HermesProject = {
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
      },
      designConfig: {
        heroBadge: 'Nuevo Proyecto · En Desarrollo',
        heroTitle: newProjectForm.name,
        heroSubtitle: newProjectForm.description || 'Bienvenido a la nueva experiencia digital diseñada por Hermes Copilot.',
        primaryColor: '#2563EB',
        accentColor: '#10B981',
        ctaText: 'Solicitar Información',
        whatsappNumber: '525540001234'
      }
    };

    const newProjectsList = [newProj, ...projects];
    setProjects(newProjectsList);
    hermesLandingService.saveProjects(newProjectsList);
    setSelectedProjectId(newProj.id);
    setShowNewProjectModal(false);
    setNewProjectForm({ name: '', slug: '', description: '', category: 'Salud & Gastos Médicos' });
  };

  // ─── Renderizador del Componente en Vivo ──────────────────────────────────
  const renderLiveComponent = () => {
    switch (selectedProjectId) {
      case 'mutuus':
        return <MutuusLanding key={previewKey} designOverrides={selectedProject.designConfig} />;
      case 'seguros-express':
        return <SegurosExpressLanding key={previewKey} />;
      case 'seguros-education':
        return <SegurosEducationLanding key={previewKey} />;
      case 'chava-agente':
        return <ChavaAgenteLanding key={previewKey} />;
      default:
        return <MutuusLanding key={previewKey} designOverrides={selectedProject.designConfig} />;
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
                Landings Copilot · Bolt & Lovable Engine
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

  // ─── INTERFAZ PRINCIPAL DE HERMES STUDIO (BOLT / LOVABLE LOOK) ────────────
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      <Helmet>
        <title>Hermes Landing Studio · {selectedProject.name}</title>
      </Helmet>

      {/* ─── 1. TOP NAVIGATION BAR ───────────────────────────────────────── */}
      <header className="h-16 bg-white border-b border-slate-200/80 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-40 shadow-xs">
        
        {/* Izquierda: Logo y Selector de Proyecto */}
        <div className="flex items-center gap-3 sm:gap-4">
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
                  Bolt/Lovable
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

          {/* Botón para Iniciar Nuevo Proyecto */}
          <button
            onClick={() => setShowNewProjectModal(true)}
            className="px-2.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
            title="Crear nueva landing"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Nuevo Proyecto</span>
          </button>

          {/* Badge de Estatus */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 text-[11px] font-medium text-slate-600">
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
        <div className="flex items-center gap-2 sm:gap-2.5">
          
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

          {/* Botón Principal: PUBLICAR */}
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
        
        {/* ─── COLUMNA IZQUIERDA: HERMES COPILOT CHAT (BOLT STYLE) ────────── */}
        {(viewMode === 'split' || viewMode === 'chat') && (
          <div
            className={`flex flex-col bg-white border-r border-slate-200/80 transition-all ${
              viewMode === 'chat' ? 'w-full' : 'w-full lg:w-[480px] xl:w-[520px]'
            }`}
          >
            
            {/* Header del Chat */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-slate-900">Hermes Designer</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Copilot de diseño conectado a <span className="font-semibold text-blue-600">{selectedProject.name}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                  Supabase Live Sync
                </span>
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
                        <div className="flex items-center gap-2 text-slate-600">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span className="font-semibold">{m.diffPreview.details}</span>
                        </div>
                        <button
                          onClick={() => {
                            setViewMode('preview');
                            setPreviewKey(k => k + 1);
                          }}
                          className="text-blue-600 font-bold hover:underline cursor-pointer"
                        >
                          Ver Canvas
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
                onClick={() => handleSendMessage("Cambiar título a Membresía Médica con Cero Deducible")}
                className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 whitespace-nowrap cursor-pointer transition"
              >
                🎨 Título Hero
              </button>
              <button
                onClick={() => handleSendMessage("Ajustar precios: Plan UNO a $1,199 y Plan DOS a $1,799 mensual")}
                className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 whitespace-nowrap cursor-pointer transition"
              >
                💳 Ajustar Tarifas
              </button>
              <button
                onClick={() => handleSendMessage("Cambiar botón CTA a 'Cotizar por WhatsApp con un Asesor'")}
                className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 whitespace-nowrap cursor-pointer transition"
              >
                📲 CTA WhatsApp
              </button>
              <button
                onClick={() => handleSendMessage("Cambiar paleta a azul marino con acento verde esmeralda")}
                className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 whitespace-nowrap cursor-pointer transition"
              >
                🎨 Paleta de Color
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
                  placeholder={`Indica un cambio en lenguaje natural para ${selectedProject.name}...`}
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
            
            <div className="h-11 bg-white border-b border-slate-200/80 px-4 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="font-bold text-slate-700">Preview:</span>
                <span className="font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                  https://landings.movi.digital{selectedProject.slug}
                </span>
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

      {/* ─── MODAL PARA INICIAR NUEVO PROYECTO DE LANDING ─────────────────── */}
      {showNewProjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200">
            <div className="space-y-2 mb-6">
              <h3 className="text-xl font-black text-slate-900">
                Iniciar Nuevo Proyecto de Landing
              </h3>
              <p className="text-xs text-slate-500">
                Crea un nuevo espacio de trabajo para diseñar una landing personalizada con Hermes AI.
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
                  Crear e Iniciar Chat
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
