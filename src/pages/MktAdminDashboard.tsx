import { useState, useEffect } from 'react';
import { Bookmark, Camera, Sparkles, LayoutDashboard, Users, EyeOff, Wallet } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { tieneAccesoEquipoMkt } from '../lib/mktUtils';
import RecursosMarca from './RecursosMarca';
import FotosEstudioAdmin from './FotosEstudioAdmin';
import MarketingPremiumAdmin from './MarketingPremiumAdmin';
import MktPresupuestosAdmin from './MktPresupuestosAdmin';
type Tab = 'brand-kit' | 'fotos' | 'premium' | 'presupuestos' | 'equipos';

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
        {tab === 'fotos' && <FotosEstudioAdmin embedded />}
        {tab === 'premium' && <MarketingPremiumAdmin embedded />}
        {tab === 'presupuestos' && <MktPresupuestosAdmin embedded />}
        {tab === 'equipos' && esAdmin && <EquiposAccesoMktPanel />}
      </div>
    </div>
  );
}

interface GrupoVisualizacion {
  id: string;
  nombre: string;
  color: string | null;
}

function EquiposAccesoMktPanel() {
  const [grupos, setGrupos] = useState<GrupoVisualizacion[]>([]);
  const [equiposConAcceso, setEquiposConAcceso] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState<string | null>(null);

  useEffect(() => { cargar(); }, []);

  const cargar = async () => {
    setLoading(true);
    const [gruposRes, accesoRes] = await Promise.all([
      supabase.from('tramites_grupos_visualizacion').select('id, nombre, color').eq('activo', true).order('nombre'),
      supabase.from('mkt_equipos_acceso').select('grupo_id'),
    ]);
    setGrupos(gruposRes.data ?? []);
    setEquiposConAcceso(new Set((accesoRes.data ?? []).map((r: { grupo_id: string }) => r.grupo_id)));
    setLoading(false);
  };

  const toggleAcceso = async (grupoId: string, tieneAcceso: boolean) => {
    setGuardando(grupoId);
    if (tieneAcceso) {
      await supabase.from('mkt_equipos_acceso').delete().eq('grupo_id', grupoId);
      setEquiposConAcceso(prev => { const s = new Set(prev); s.delete(grupoId); return s; });
    } else {
      await supabase.from('mkt_equipos_acceso').insert({ grupo_id: grupoId });
      setEquiposConAcceso(prev => new Set([...prev, grupoId]));
    }
    setGuardando(null);
  };

  if (loading) return <div className="text-center py-12 text-neutral-500">Cargando equipos...</div>;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Equipos con acceso a Marketing Admin</h2>
        <p className="text-sm text-neutral-500 dark:text-white/50 mt-1">
          Los miembros de estos equipos pueden administrar Brand Kit, Fotos de Estudio y Plan Premium, igual que un Administrador.
        </p>
      </div>
      <div className="space-y-3 max-w-xl">
        {grupos.length === 0 && (
          <div className="text-sm text-neutral-400">No hay equipos configurados. Crea equipos en Tramites &rarr; Equipos.</div>
        )}
        {grupos.map(grupo => {
          const tieneAcceso = equiposConAcceso.has(grupo.id);
          return (
            <div key={grupo.id} className="flex items-center justify-between bg-white dark:bg-white/5 rounded-xl border border-neutral-200 dark:border-white/10 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: grupo.color ?? '#6b7280' }} />
                <span className="font-medium text-neutral-900 dark:text-white">{grupo.nombre}</span>
              </div>
              <button
                disabled={guardando === grupo.id}
                onClick={() => toggleAcceso(grupo.id, tieneAcceso)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${tieneAcceso ? 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400' : 'bg-accent text-white hover:bg-accent-hover'}`}
              >
                {tieneAcceso
                  ? <><EyeOff className="w-4 h-4" /><span className="ml-1.5">Quitar acceso</span></>
                  : <span>Dar acceso</span>}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
