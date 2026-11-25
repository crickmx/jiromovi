import { useNavigate } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useModuleVisibility } from '../lib/useModuleVisibility';
import { isItemVisible, WORKSPACES, type UserRole } from '../lib/workspaceConfig';
import { MODULES } from '../lib/cotizadores';
import { PageHeader } from '../components/ui/page-header';
import { ZocaloCard } from '../components/ui/zocalo-card';

const cotizarWorkspace = WORKSPACES.find(w => w.id === 'cotizar')!;

export default function CotizarHub() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const { isVisible } = useModuleVisibility();

  const rol = (usuario?.rol || '') as UserRole;
  const oficinaId = usuario?.oficina_id ?? null;

  const visibleModules = MODULES.filter(mod => {
    const navItem = cotizarWorkspace.items.find(item => item.path === mod.path || mod.path.startsWith(item.path + '/'));
    if (navItem && !isItemVisible(navItem, rol)) return false;
    if (!isVisible(mod.path, rol, oficinaId, usuario?.id)) return false;
    return true;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        breadcrumb={<>Inicio <span className="px-1 text-neutral-300 dark:text-neutral-600">/</span> Cotizar</>}
        title="Cotizar"
        description="Herramientas para cotizar seguros, formularios y comparadores multi-aseguradora."
        action={{ label: 'Mis cotizaciones', onClick: () => navigate('/cotizar/cotizaciones'), icon: FileText }}
      />

      {/* Module Cards */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {visibleModules.map((mod) => (
          <ZocaloCard
            key={mod.path}
            title={mod.label}
            description={mod.description}
            logo={mod.logo}
            logos={mod.logos}
            icon={mod.icon}
            iconColor={mod.iconColor}
            bullets={mod.bullets ?? mod.aseguradoras?.map(a => a.name)}
            bulletColor={mod.bulletColor}
            cta={mod.cta ?? 'Abrir cotizador'}
            accent={mod.zocaloHover}
            onClick={() => navigate(mod.path)}
          />
        ))}
      </div>
    </div>
  );
}
