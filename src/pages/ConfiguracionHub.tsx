import { useState, useMemo } from 'react';
import { Settings, Building2, Database, Link as LinkIcon, Trophy, Activity } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Configuracion } from './Configuracion';
import { Oficinas } from './Oficinas';
import CatalogosWeb from './CatalogosWeb';
import SicasAdmin from './SicasAdmin';
import GamificacionAdmin from './GamificacionAdmin';
import GMMTarifasAdmin from './GMMTarifasAdmin';
import { cn } from '@/lib/utils';

type TabKey = 'general' | 'oficinas' | 'catalogos' | 'sicas' | 'gamificacion' | 'gmm-tarifas';

interface TabDef {
  key: TabKey;
  label: string;
  icon: typeof Settings;
}

export default function ConfiguracionHub() {
  const { usuario } = useAuth();

  const isAdmin = usuario?.rol === 'Administrador';

  const tabs: TabDef[] = useMemo(() => [
    { key: 'general', label: 'General', icon: Settings },
    { key: 'oficinas', label: 'Oficinas', icon: Building2 },
    { key: 'gamificacion', label: 'Gamificacion', icon: Trophy },
    { key: 'catalogos', label: 'Catalogos Web', icon: Database },
    { key: 'sicas', label: 'SICAS', icon: LinkIcon },
    { key: 'gmm-tarifas', label: 'GMM Tarifas', icon: Activity },
  ], []);

  const [activeTab, setActiveTab] = useState<TabKey>('general');

  if (!isAdmin) {
    return (
      <div className="text-center py-12">
        <p className="text-neutral-600 dark:text-neutral-400">
          Solo los administradores pueden acceder a esta seccion.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Tab Navigation */}
      <div className="bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-700 px-4 sm:px-6">
        <nav className="flex gap-1 overflow-x-auto scrollbar-hide -mb-px" aria-label="Tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap",
                  isActive
                    ? "border-accent text-accent"
                    : "border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:border-neutral-300"
                )}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'general' && <Configuracion />}
        {activeTab === 'oficinas' && <Oficinas />}
        {activeTab === 'gamificacion' && <GamificacionAdmin />}
        {activeTab === 'catalogos' && <CatalogosWeb />}
        {activeTab === 'sicas' && <SicasAdmin />}
        {activeTab === 'gmm-tarifas' && <GMMTarifasAdmin />}
      </div>
    </div>
  );
}
