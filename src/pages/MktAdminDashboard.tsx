import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bookmark, Sparkles, LayoutDashboard, Users, Wallet, ClipboardList } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { useAuth } from '../contexts/AuthContext';
import { EquiposAccesoPanel } from '../components/admin/EquiposAccesoPanel';
import { BitacoraComercial } from '../components/admin/BitacoraComercial';
import { tieneAccesoEquipoMkt } from '../lib/mktUtils';
import RecursosMarca from './RecursosMarca';
import MarketingPremiumAdmin from './MarketingPremiumAdmin';
import MktPresupuestosAdmin from './MktPresupuestosAdmin';
type Tab = 'brand-kit' | 'premium' | 'presupuestos' | 'equipos' | 'bitacora';

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
  // La bitácora enlaza con `?tab=premium&agente=<id>`; sin leerlo, el clic
  // cambiaba la URL y la pantalla se quedaba donde estaba.
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>(() => (searchParams.get('tab') as Tab) || 'brand-kit');

  useEffect(() => {
    const pedida = searchParams.get('tab') as Tab | null;
    if (pedida) setTab(pedida);
  }, [searchParams]);
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

  // La bitácora la ve también el equipo con acceso, no solo el Administrador:
  // dentro decide qué módulos puede mirar cada quien. "Equipos con acceso" sí
  // se queda solo para Admin, porque desde ahí se reparten los permisos.
  const tabs = [
    ...TABS,
    ...(esAdmin
      ? [{ key: 'equipos' as Tab, label: 'Equipos con acceso', icon: Users, description: 'Equipos que pueden administrar Mercadotecnia' }]
      : []),
    { key: 'bitacora' as Tab, label: 'Bitácora', icon: ClipboardList, description: 'Pedidos de Store y periodos de Premium, con sus pagos' },
  ];
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
                    ? 'border-accent text-accent-ink'
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
        {tab === 'bitacora' && <BitacoraComercial />}
        {tab === 'equipos' && esAdmin && <EquiposAccesoPanel
            modulo="mkt"
            titulo="Equipos con acceso a Marketing Admin"
            descripcion="Los miembros de estos equipos pueden administrar Brand Kit, Fotos de Estudio y Plan Premium, igual que un Administrador."
          />}
      </div>
    </div>
  );
}


