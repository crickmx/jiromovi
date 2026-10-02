import { useState, useEffect } from 'react';
import { Bookmark, Sparkles, LayoutDashboard, Users, Wallet } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { useAuth } from '../contexts/AuthContext';
import { EquiposAccesoPanel } from '../components/admin/EquiposAccesoPanel';
import { tieneAccesoEquipoMkt } from '../lib/mktUtils';
import RecursosMarca from './RecursosMarca';
import MarketingPremiumAdmin from './MarketingPremiumAdmin';
import MktPresupuestosAdmin from './MktPresupuestosAdmin';
type Tab = 'brand-kit' | 'premium' | 'presupuestos' | 'equipos';

const TABS: { key: Tab; label: string; icon: typeof Bookmark; description: string }[] = [
  {
    key: 'brand-kit',
    label: 'Jiro Brand Kit',
    icon: Bookmark,
    description: 'Logos, plantillas y archivos oficiales de la marca Jiro',
  },
  {
    key: 'premium',
    label: 'Gestión de asesores',
    icon: Sparkles,
    description: 'Plan Premium, logos y gestión de asesores',
  },
  {
    key: 'presupuestos',
    label: 'Presupuestos',
    icon: Wallet,
    description: 'Presupuesto y gasto por campaña de redes sociales',
  },
];

export default function MktAdminDashboard() {
  const { usuario } = useAuth();
  const [tab, setTab] = useState<Tab>('brand-kit');
  const [cargando, setCargando] = useState(true);
  const [tieneAcceso, setTieneAcceso] = useState(false);

  const esAdmin = usuario?.rol === 'Administrador';

  useEffect(() => {
    (async () => {
      if (!usuario) { setCargando(false); return; }
      const acceso = esAdmin || await tieneAccesoEquipoMkt(usuario.id);
      setTieneAcceso(acceso);
      setCargando(false);
    })();
  }, [usuario?.id]);

  if (cargando) return null;
  if (!tieneAcceso) return null;

  const tabs = esAdmin
    ? [...TABS, { key: 'equipos' as Tab, label: 'Equipos con acceso', icon: Users, description: 'Equipos que pueden administrar Mercadotecnia' }]
    : TABS;
  const activeTab = tabs.find(t => t.key === tab) ?? tabs[0];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Marketing Admin"
        description={activeTab.description}
        icon={LayoutDashboard}
      >
        <nav className="flex gap-1 border-b border-neutral-200 dark:border-white/8 -mb-px flex-wrap">
          {tabs.map(t => {
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
        {tab === 'premium' && <MarketingPremiumAdmin embedded />}
        {tab === 'presupuestos' && <MktPresupuestosAdmin embedded />}
        {tab === 'equipos' && esAdmin && <EquiposAccesoPanel
            modulo="mkt"
            titulo="Equipos con acceso a Marketing Admin"
            descripcion="Los miembros de estos equipos pueden administrar Brand Kit, Fotos de Estudio y Plan Premium, igual que un Administrador."
          />}
      </div>
    </div>
  );
}


