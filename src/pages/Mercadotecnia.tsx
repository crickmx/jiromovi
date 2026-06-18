import { useNavigate, useLocation } from 'react-router-dom';
import { Megaphone, Sparkles, Globe as Globe2, Palette } from 'lucide-react';
import MiMarca from './MiMarca';
import MiPaginaWeb from './MiPaginaWeb';
import { Publicidad } from './Publicidad';
import { PageHeader } from '@/components/ui/page-header';

type SubSection = 'mi-marca' | 'mi-pagina-web' | 'publicidad';

const TABS: { key: SubSection; label: string; icon: typeof Sparkles; description: string }[] = [
  {
    key: 'publicidad',
    label: 'Publicidad',
    icon: Palette,
    description: 'Plantillas y diseños personalizados para tus campañas',
  },
  {
    key: 'mi-pagina-web',
    label: 'Mi Página Web',
    icon: Globe2,
    description: 'Tu sitio público con tu información profesional',
  },
  {
    key: 'mi-marca',
    label: 'Mi Marca',
    icon: Sparkles,
    description: 'Foto de perfil y logotipo que se aplican en todo el sistema',
  },
];

interface MercadotecniaProps {
  section: SubSection;
}

export default function Mercadotecnia({ section }: MercadotecniaProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const activeTab = TABS.find(t => t.key === section) ?? TABS[0];

  const renderContent = () => {
    switch (section) {
      case 'mi-marca':
        return <MiMarca />;
      case 'mi-pagina-web':
        return <MiPaginaWeb />;
      case 'publicidad':
        return <Publicidad />;
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Mercadotecnia"
        description={activeTab.description}
        icon={Megaphone}
      >
        <nav className="flex flex-wrap gap-1 border-b border-neutral-200 dark:border-white/8 -mb-px">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = tab.key === section;
            return (
              <button
                key={tab.key}
                onClick={() => {
                  const target = `/mercadotecnia/${tab.key}`;
                  if (location.pathname !== target) navigate(target);
                }}
                className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  isActive
                    ? 'border-accent text-accent'
                    : 'border-transparent text-neutral-500 dark:text-white/50 hover:text-neutral-700 dark:hover:text-white/70'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </PageHeader>

      <div>{renderContent()}</div>
    </div>
  );
}
