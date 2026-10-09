import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  Sparkles,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  AlertCircle,
  Globe,
  Rocket,
  CheckCircle2,
  ExternalLink,
  Copy,
  Check,
  X
} from 'lucide-react';
import type { UnifiedLanding, Block } from './types';
import { hermesLandingService, INITIAL_HERMES_PROJECTS } from './hermesLandingService';
import { MekateSidebar, StudioTab } from './components/MekateSidebar';
import { UnifiedLandingList } from './components/UnifiedLandingList';
import { HermesChatStudio } from './components/HermesChatStudio';
import { BlockBuilder } from './components/BlockBuilder';
import { AIWizardCreator } from './components/AIWizardCreator';
import { LandingSettingsModal } from './components/LandingSettingsModal';
import { ContentFactoryView } from './components/ContentFactoryView';

const STUDIO_PASSWORD = 'Marsella14$';
const STORAGE_AUTH_KEY = 'hermes_studio_auth_v1';
const LOGO_URL = 'https://mekate.mx/wp-content/uploads/2021/05/Recurso-6.png';

// Convertir proyectos iniciales al tipo UnifiedLanding
const INITIAL_LANDINGS: UnifiedLanding[] = INITIAL_HERMES_PROJECTS.map((p) => ({
  id: p.id,
  name: p.name,
  slug: p.slug,
  description: p.description,
  category: p.category,
  status: p.status === 'live' ? 'published' : (p.status as any),
  version: p.version,
  lastUpdated: p.lastUpdated,
  creationMode: 'crick_ia',
  views: p.views,
  conversion: p.conversion,
  primary_color: p.theme?.primary || '#003896',
  secondary_color: p.theme?.accent || '#9CD41C',
  font_family: p.theme?.font || 'Montserrat',
  customComponent: p.id as any,
  designOverrides: p.designConfig,
  blocks: [],
  seo: {
    meta_title: `${p.name} | Sitio Oficial`,
    meta_description: p.description,
    og_title: p.name,
    og_description: p.description,
    og_image_url: '',
    canonical_url: `https://landings.movi.digital${p.slug}`
  }
}));

export default function LandingsStudio() {
  // ─── Autenticación ────────────────────────────────────────────────────────
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem(STORAGE_AUTH_KEY) === 'true';
  });
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // ─── Navegación y Vistas ──────────────────────────────────────────────────
  const [currentTab, setCurrentTab] = useState<StudioTab>('sites');
  const [landings, setLandings] = useState<UnifiedLanding[]>(INITIAL_LANDINGS);
  const [selectedLandingId, setSelectedLandingId] = useState<string>('mutuus');
  const [showAIWizard, setShowAIWizard] = useState(false);
  const [settingsLanding, setSettingsLanding] = useState<UnifiedLanding | null>(null);

  // ─── Despliegue ───────────────────────────────────────────────────────────
  const [deployLandingTarget, setDeployLandingTarget] = useState<UnifiedLanding | null>(null);
  const [deployStep, setDeployStep] = useState(0);
  const [deploySuccess, setDeploySuccess] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Cargar landings al inicio
  useEffect(() => {
    hermesLandingService.getProjects().then((projs) => {
      if (projs && projs.length > 0) {
        const mapped: UnifiedLanding[] = projs.map((p) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          description: p.description,
          category: p.category,
          status: p.status === 'live' ? 'published' : (p.status as any),
          version: p.version,
          lastUpdated: p.lastUpdated,
          creationMode: (p as any).creationMode || 'crick_ia',
          views: p.views || 0,
          conversion: p.conversion || '0.0%',
          primary_color: p.theme?.primary || '#003896',
          secondary_color: p.theme?.accent || '#9CD41C',
          font_family: p.theme?.font || 'Montserrat',
          customComponent: p.id as any,
          designOverrides: p.designConfig,
          blocks: (p as any).blocks || [],
          seo: {
            meta_title: `${p.name} | Sitio Oficial`,
            meta_description: p.description,
            og_title: p.name,
            og_description: p.description,
            og_image_url: '',
            canonical_url: `https://landings.movi.digital${p.slug}`
          }
        }));
        setLandings(mapped);
      }
    });
  }, []);

  const selectedLanding = landings.find((l) => l.id === selectedLandingId) || landings[0];

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

  const handleUpdateLanding = (updated: UnifiedLanding) => {
    const nextList = landings.map((l) => (l.id === updated.id ? updated : l));
    setLandings(nextList);
    hermesLandingService.saveProjects(nextList as any);
  };

  const handleCreatedLanding = (newLanding: UnifiedLanding) => {
    const nextList = [newLanding, ...landings];
    setLandings(nextList);
    setSelectedLandingId(newLanding.id);
    hermesLandingService.saveProjects(nextList as any);
    setShowAIWizard(false);
    setCurrentTab('block_builder');
  };

  const handleDeleteLanding = (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta landing?')) return;
    const nextList = landings.filter((l) => l.id !== id);
    setLandings(nextList);
    hermesLandingService.saveProjects(nextList as any);
    if (selectedLandingId === id && nextList.length > 0) {
      setSelectedLandingId(nextList[0].id);
    }
  };

  const handleTriggerDeploy = async (landingToDeploy: UnifiedLanding) => {
    setDeployLandingTarget(landingToDeploy);
    setDeployStep(1);
    setDeploySuccess(false);

    await new Promise((r) => setTimeout(r, 500));
    setDeployStep(2);

    await new Promise((r) => setTimeout(r, 600));
    setDeployStep(3);

    await new Promise((r) => setTimeout(r, 600));
    setDeployStep(4);
    setDeploySuccess(true);

    const updated = {
      ...landingToDeploy,
      status: 'published' as const,
      lastUpdated: 'Publicado hoy a las ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    handleUpdateLanding(updated);
  };

  // ─── PANTALLA DE ACCESO (LOOK & FEEL MEKATE STUDIO) ────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="h-screen w-screen bg-[#0f0f0f] flex items-center justify-center p-4 relative overflow-hidden font-sans selection:bg-[#F97316] selection:text-white">
        <Helmet>
          <title>Mekate Studio | Acceso Seguro</title>
        </Helmet>

        {/* Resplandor decorativo */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#F97316]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#7E3AF2]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-md bg-[#18181b] rounded-3xl border border-[#27272a] shadow-2xl p-8 sm:p-10 relative z-10 text-white">
          <div className="text-center space-y-4 mb-8">
            <img
              src={LOGO_URL}
              alt="Mekate Studio"
              className="h-10 w-auto mx-auto object-contain brightness-110"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white">
                Mekate Studio
              </h1>
              <p className="text-xs font-semibold text-gray-400 mt-1">
                Landings & Web Creator · MOVI Ecosystem
              </p>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#27272a] text-[11px] font-semibold text-gray-300">
              <Globe className="w-3.5 h-3.5 text-[#F97316]" />
              <span>landings.movi.digital</span>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1.5">
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
                  className={`w-full px-4 py-3 rounded-xl border bg-[#0f0f0f] text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#F97316] transition-all pr-11 ${
                    authError ? 'border-rose-500' : 'border-[#27272a]'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white p-1 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {authError && (
                <div className="flex items-center gap-1.5 text-xs text-rose-400 font-semibold mt-2">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Contraseña incorrecta. Intenta nuevamente.</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-xs text-gray-400">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-gray-700 bg-gray-900 text-[#F97316] focus:ring-[#F97316]"
                />
                <span>Recordar sesión</span>
              </label>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 px-6 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-[#F97316] to-[#7E3AF2] hover:opacity-95 active:scale-98 transition-all shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Unlock className="w-4 h-4" />
              <span>Entrar al Workspace</span>
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-[#27272a] text-center">
            <p className="text-[11px] text-gray-500">
              Mekate Studio · Powered by Hermes & Crick IA Engine
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── INTERFAZ UNIFICADA MEKATE STUDIO ─────────────────────────────────────
  return (
    <div className="h-screen max-h-screen w-screen overflow-hidden bg-white text-gray-900 flex font-sans">
      <Helmet>
        <title>Mekate Studio · {selectedLanding?.name || 'Landings'}</title>
      </Helmet>

      {/* Sidebar Mekate Studio */}
      <MekateSidebar
        currentTab={currentTab}
        onTabChange={(tab) => {
          if (tab === 'ai_wizard') {
            setShowAIWizard(true);
          } else {
            setCurrentTab(tab);
          }
        }}
        onLogout={handleLogout}
        activeLandingCount={landings.length}
      />

      {/* Área de Trabajo Principal */}
      <main className="flex-1 min-h-0 flex flex-col overflow-hidden bg-[#F8FAFC]">
        {currentTab === 'sites' && (
          <UnifiedLandingList
            landings={landings}
            selectedLandingId={selectedLandingId}
            onSelectLanding={(id) => setSelectedLandingId(id)}
            onOpenCrickIA={(id) => {
              setSelectedLandingId(id);
              setCurrentTab('hermes_chat');
            }}
            onOpenBlockBuilder={(id) => {
              setSelectedLandingId(id);
              setCurrentTab('block_builder');
            }}
            onOpenSettings={(l) => setSettingsLanding(l)}
            onOpenNewWizard={() => setShowAIWizard(true)}
            onDeleteLanding={handleDeleteLanding}
            onDeployLanding={handleTriggerDeploy}
          />
        )}

        {currentTab === 'hermes_chat' && (
          <HermesChatStudio
            landing={selectedLanding}
            onUpdateLanding={handleUpdateLanding}
            onDeploy={() => handleTriggerDeploy(selectedLanding)}
            onBackToList={() => setCurrentTab('sites')}
          />
        )}

        {currentTab === 'block_builder' && (
          <BlockBuilder
            landing={selectedLanding}
            onUpdateBlocks={(newBlocks) => {
              const updated = { ...selectedLanding, blocks: newBlocks, status: 'modified' as const };
              handleUpdateLanding(updated);
            }}
            onDeploy={() => handleTriggerDeploy(selectedLanding)}
            onBackToList={() => setCurrentTab('sites')}
          />
        )}

        {(currentTab === 'brands' || currentTab === 'assets' || currentTab === 'robots' || currentTab === 'campaigns') && (
          <ContentFactoryView section={currentTab} />
        )}
      </main>

      {/* Modal Wizard de Creación con IA */}
      {showAIWizard && (
        <AIWizardCreator
          onClose={() => setShowAIWizard(false)}
          onCreated={handleCreatedLanding}
        />
      )}

      {/* Modal de Configuración y Ajustes */}
      {settingsLanding && (
        <LandingSettingsModal
          landing={settingsLanding}
          onClose={() => setSettingsLanding(null)}
          onSave={handleUpdateLanding}
        />
      )}

      {/* Modal de Publicación en Vivo */}
      {deployLandingTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-gray-200 space-y-5">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-orange-50 text-[#F97316] flex items-center justify-center mx-auto border border-orange-200">
                <Rocket className={`w-7 h-7 ${deploySuccess ? 'text-emerald-600' : 'animate-bounce'}`} />
              </div>
              <h3 className="text-xl font-black text-gray-900">
                {deploySuccess ? '¡Landing Publicada en Vivo!' : 'Publicando en Producción...'}
              </h3>
              <p className="text-xs text-gray-500">
                Dominio:{' '}
                <strong className="text-gray-800">
                  https://landings.movi.digital{deployLandingTarget.slug}
                </strong>
              </p>
            </div>

            <div className="space-y-2.5 bg-gray-50 p-4 rounded-2xl border border-gray-100 text-xs">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className={`w-4 h-4 ${deployStep >= 1 ? 'text-emerald-600' : 'text-gray-300'}`} />
                <span className={deployStep >= 1 ? 'font-bold text-gray-900' : 'text-gray-400'}>
                  1. Validando componentes y bundles
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className={`w-4 h-4 ${deployStep >= 2 ? 'text-emerald-600' : 'text-gray-300'}`} />
                <span className={deployStep >= 2 ? 'font-bold text-gray-900' : 'text-gray-400'}>
                  2. Sincronizando con base de datos y CDN
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className={`w-4 h-4 ${deployStep >= 3 ? 'text-emerald-600' : 'text-gray-300'}`} />
                <span className={deployStep >= 3 ? 'font-bold text-gray-900' : 'text-gray-400'}>
                  3. Purgando caché y verificando SSL
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className={`w-4 h-4 ${deployStep >= 4 ? 'text-emerald-600' : 'text-gray-300'}`} />
                <span className={deployStep >= 4 ? 'font-bold text-emerald-700' : 'text-gray-400'}>
                  4. Landing activa en producción
                </span>
              </div>
            </div>

            {deploySuccess && (
              <div className="space-y-3 pt-2">
                <div className="flex gap-2">
                  <a
                    href={deployLandingTarget.slug}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-[#F97316] to-[#7E3AF2] text-white font-bold text-xs text-center flex items-center justify-center gap-2 shadow-md"
                  >
                    <span>Abrir Landing en Vivo</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <button
                    onClick={() => setDeployLandingTarget(null)}
                    className="px-5 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs cursor-pointer"
                  >
                    Listo
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
