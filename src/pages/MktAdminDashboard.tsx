import { useState } from 'react';
import { Bookmark, Camera, Sparkles, LayoutDashboard } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { useAuth } from '../contexts/AuthContext';
import RecursosMarca from './RecursosMarca';
import FotosEstudioAdmin from './FotosEstudioAdmin';
import MarketingPremiumAdmin from './MarketingPremiumAdmin';

type Tab = 'brand-kit' | 'fotos' | 'premium';

const TABS: { key: Tab; label: string; icon: typeof Bookmark; description: string }[] = [
  {
    key: 'brand-kit',
    label: 'Jiro Brand Kit',
    icon: Bookmark,
    description: 'Logos, plantillas y archivos oficiales de la marca Jiro',
  },
  {
    key: 'fotos',
    label: 'Fotos de Estudio',
    icon: Camera,
    description: 'Carpetas de fotos de estudio de cada agente',
  },
  {
    key: 'premium',
    label: 'Plan Premium',
    icon: Sparkles,
    description: 'Suscripciones y planes de agentes',
  },
];

export default function MktAdminDashboard() {
  const { usuario } = useAuth();
  const [tab, setTab] = useState<Tab>('brand-kit');

  if (usuario?.rol !== 'Administrador') return null;

  const activeTab = TABS.find(t => t.key === tab)!;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Marketing Admin"
        description={activeTab.description}
        icon={LayoutDashboard}
      >
        <nav className="flex gap-1 border-b border-neutral-200 dark:border-white/8 -mb-px flex-wrap">
          {TABS.map(t => {
            const Icon = t.icon;
            const isActive = t.key === tab;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  isActive
                    ? 'border-accent text-accent'
                    : 'border-transparent text-neutral-500 dark:text-white/50 hover:text-neutral-700 dark:hover:text-white/70'
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </nav>
      </PageHeader>

      <div>
        {tab === 'brand-kit' && <RecursosMarca />}
        {tab === 'fotos' && <FotosEstudioAdmin embedded />}
        {tab === 'premium' && <MarketingPremiumAdmin embedded />}
      </div>
    </div>
  );
}
