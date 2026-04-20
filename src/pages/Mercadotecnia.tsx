import { useNavigate, useLocation } from 'react-router-dom';
import { Megaphone, Sparkles, Globe as Globe2, Palette } from 'lucide-react';
import MiMarca from './MiMarca';
import MiPaginaWeb from './MiPaginaWeb';
import { Publicidad } from './Publicidad';

type SubSection = 'mi-marca' | 'mi-pagina-web' | 'publicidad';

const TABS: { key: SubSection; label: string; icon: typeof Sparkles; description: string }[] = [
  {
    key: 'mi-marca',
    label: 'Mi Marca',
    icon: Sparkles,
    description: 'Foto de perfil y logotipo que se aplican en todo el sistema',
  },
  {
    key: 'mi-pagina-web',
    label: 'Mi Página Web',
    icon: Globe2,
    description: 'Tu sitio público con tu información profesional',
  },
  {
    key: 'publicidad',
    label: 'Publicidad',
    icon: Palette,
    description: 'Plantillas y diseños personalizados para tus campañas',
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
    <div className="space-y-6">
      <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-start gap-3 mb-6">
          <div className="p-2.5 bg-blue-100 rounded-xl">
            <Megaphone className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Mercadotecnia</h1>
            <p className="text-sm text-neutral-500 mt-0.5">
              {activeTab.description}
            </p>
          </div>
        </div>

        <nav className="flex flex-wrap gap-2 border-b border-neutral-200 -mb-6 pb-0">
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
                className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
                  isActive
                    ? 'border-blue-600 text-blue-700 bg-blue-50/60'
                    : 'border-transparent text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div>{renderContent()}</div>
    </div>
  );
}
