import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Megaphone, Sparkles, Globe as Globe2, Palette, Camera, CalendarDays, CheckCircle, Pencil, X, Save, Bookmark } from 'lucide-react';
import MiMarca from './MiMarca';
import MiPaginaWeb from './MiPaginaWeb';
import Publicidad from './Publicidad';
import FotosEstudio from './FotosEstudio';
import RecursosMarca from './RecursosMarca';
import Agenda from './Agenda';
import { PageHeader } from '@/components/ui/page-header';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

type SubSection = 'mi-marca' | 'mi-pagina-web' | 'publicidad' | 'mis-disenos' | 'fotos-estudio' | 'recursos-marca' | 'agenda';

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
    key: 'agenda',
    label: 'Agenda',
    icon: CalendarDays,
    description: 'Configura calendarios, disponibilidad y tipos de cita',
  },
  {
    key: 'mi-marca',
    label: 'Mi Marca',
    icon: Sparkles,
    description: 'Foto de perfil y logotipo que se aplican en todo el sistema',
  },
  {
    key: 'fotos-estudio',
    label: 'Mis Fotos de Estudio',
    icon: Camera,
    description: 'Tu carpeta personal de fotos de estudio profesionales',
  },
  {
    key: 'recursos-marca',
    label: 'Jiro Brand Kit',
    icon: Bookmark,
    description: 'Logos, plantillas y archivos oficiales de la marca Jiro',
  },
];

interface MercadotecniaProps {
  section: SubSection;
}

function formatFecha(iso: string | null | undefined) {
  if (!iso) return '—';
  try { return format(new Date(iso), "d 'de' MMMM, yyyy", { locale: es }); } catch { return '—'; }
}

export default function Mercadotecnia({ section }: MercadotecniaProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { usuario, reloadUsuario } = useAuth();

  const isAdmin = usuario?.rol === 'Administrador';
  const tienePremium = usuario?.plan_mkt_premium ?? false;

  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [form, setForm] = useState({
    plan_mkt_premium: tienePremium,
    mkt_premium_fecha_inicio: usuario?.mkt_premium_fecha_inicio ?? '',
    mkt_premium_fecha_pago: usuario?.mkt_premium_fecha_pago ?? '',
  });

  const activeTab = TABS.find(t => t.key === section) ?? TABS[0];

  function abrirEdicion() {
    setForm({
      plan_mkt_premium: usuario?.plan_mkt_premium ?? false,
      mkt_premium_fecha_inicio: usuario?.mkt_premium_fecha_inicio ?? '',
      mkt_premium_fecha_pago: usuario?.mkt_premium_fecha_pago ?? '',
    });
    setEditando(true);
  }

  async function guardar() {
    if (!usuario) return;
    setGuardando(true);
    await supabase
      .from('usuarios')
      .update({
        plan_mkt_premium: form.plan_mkt_premium,
        mkt_premium_fecha_inicio: form.mkt_premium_fecha_inicio || null,
        mkt_premium_fecha_pago: form.mkt_premium_fecha_pago || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', usuario.id);
    await reloadUsuario();
    setGuardando(false);
    setEditando(false);
  }

  const renderContent = () => {
    switch (section) {
      case 'mi-marca':    return <MiMarca />;
      case 'mi-pagina-web': return <MiPaginaWeb />;
      case 'agenda':       return <Agenda embedded />;
      case 'publicidad':  return <Publicidad initialTab="biblioteca" />;
      case 'mis-disenos': return <Publicidad initialTab="mis-disenos" />;
      case 'fotos-estudio': return <FotosEstudio />;
      case 'recursos-marca': return <RecursosMarca />;
    }
  };

  const mostrarBanner = tienePremium || isAdmin;

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
            const isActive = tab.key === section || (tab.key === 'publicidad' && section === 'mis-disenos');
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

      {/* Banner Plan MKT Premium */}
      {mostrarBanner && (
        <div className="rounded-2xl bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-950/30 dark:to-violet-950/30 border border-purple-200 dark:border-purple-800/40 px-5 py-4">
          {!editando ? (
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2.5">
                <CheckCircle className="w-5 h-5 text-purple-600 dark:text-purple-400 shrink-0" />
                <span className="text-sm font-semibold text-purple-900 dark:text-purple-100">
                  Plan MKT Premium
                  {isAdmin && !tienePremium && (
                    <span className="ml-2 text-xs font-normal text-purple-500">(sin activar)</span>
                  )}
                </span>
              </div>

              <div className="flex flex-wrap gap-5 text-sm">
                <div className="flex items-center gap-1.5">
                  <CalendarDays className="w-4 h-4 text-purple-400 shrink-0" />
                  <span className="text-neutral-500 dark:text-white/50">Inicio:</span>
                  <span className="font-medium text-neutral-800 dark:text-white/80">
                    {formatFecha(usuario?.mkt_premium_fecha_inicio)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CalendarDays className="w-4 h-4 text-purple-400 shrink-0" />
                  <span className="text-neutral-500 dark:text-white/50">Pago:</span>
                  <span className="font-medium text-neutral-800 dark:text-white/80">
                    {formatFecha(usuario?.mkt_premium_fecha_pago)}
                  </span>
                </div>
              </div>

              {isAdmin && (
                <button
                  onClick={abrirEdicion}
                  className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Editar
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 justify-between">
                <span className="text-sm font-semibold text-purple-900 dark:text-purple-100">
                  Editar Plan MKT Premium
                </span>
                <button
                  onClick={() => setEditando(false)}
                  className="text-neutral-400 hover:text-neutral-600 dark:hover:text-white/60 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-wrap items-end gap-4">
                {/* Toggle activo */}
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <div
                    onClick={() => setForm(f => ({ ...f, plan_mkt_premium: !f.plan_mkt_premium }))}
                    className={`relative w-10 h-5 rounded-full transition-colors ${
                      form.plan_mkt_premium ? 'bg-purple-600' : 'bg-neutral-300 dark:bg-white/20'
                    }`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      form.plan_mkt_premium ? 'translate-x-5' : 'translate-x-0'
                    }`} />
                  </div>
                  <span className="text-sm text-neutral-700 dark:text-white/80 font-medium">
                    {form.plan_mkt_premium ? 'Activo' : 'Inactivo'}
                  </span>
                </label>

                {/* Fecha inicio */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-neutral-500 dark:text-white/50">Fecha de inicio</label>
                  <input
                    type="date"
                    value={form.mkt_premium_fecha_inicio}
                    onChange={e => setForm(f => ({ ...f, mkt_premium_fecha_inicio: e.target.value }))}
                    className="text-sm px-3 py-1.5 rounded-lg border border-purple-200 dark:border-purple-700 bg-white dark:bg-white/5 text-neutral-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                  />
                </div>

                {/* Fecha pago */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-neutral-500 dark:text-white/50">Fecha de pago</label>
                  <input
                    type="date"
                    value={form.mkt_premium_fecha_pago}
                    onChange={e => setForm(f => ({ ...f, mkt_premium_fecha_pago: e.target.value }))}
                    className="text-sm px-3 py-1.5 rounded-lg border border-purple-200 dark:border-purple-700 bg-white dark:bg-white/5 text-neutral-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                  />
                </div>

                <button
                  onClick={guardar}
                  disabled={guardando}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium transition disabled:opacity-60"
                >
                  <Save className="w-4 h-4" />
                  {guardando ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div>{renderContent()}</div>
    </div>
  );
}
