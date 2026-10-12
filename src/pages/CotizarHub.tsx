import { useNavigate } from 'react-router-dom';
import { Car, Compass, ChevronRight, Calculator, Heart } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useModuleVisibility } from '../lib/useModuleVisibility';
import { isItemVisible, WORKSPACES, type UserRole } from '../lib/workspaceConfig';
import { PageHeader } from '../components/ui/page-header';

const MODULES = [
  {
    path: '/cotizar/multicotizador-gmm',
    label: 'Multicotizador GMM',
    description: 'Compara cotizaciones de Gastos Médicos Mayores entre BX+, Bupa Nacional Vital y Bupa Nacional Plus.',
    icon: Heart,
    color: 'from-teal-500 to-cyan-600',
    bgLight: 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 border border-teal-200/50 dark:border-teal-800/40',
    borderHover: 'hover:border-teal-400/60 dark:hover:border-teal-500/50',
    shadowHover: 'hover:shadow-teal-100/40 dark:hover:shadow-teal-900/20',
    iconColor: 'text-teal-600 dark:text-teal-400',
    logo: '/logo-bupa.png',
  },
  {
    path: '/cotizar/a-la-medida',
    label: 'A la Medida',
    description: 'Diseñador inteligente de seguros. Selecciona coberturas y encuentra las aseguradoras con mejor compatibilidad.',
    icon: Compass,
    color: 'from-amber-500 to-orange-500',
    bgLight: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/40',
    borderHover: 'hover:border-amber-400/60 dark:hover:border-amber-500/50',
    shadowHover: 'hover:shadow-amber-100/40 dark:hover:shadow-amber-900/20',
    iconColor: 'text-amber-600 dark:text-amber-400',
    logo: null,
  },
  {
    path: '/cotizar/multicotizador',
    label: 'Multicotizador Digital',
    description: 'Compara cotizaciones de autos en múltiples aseguradoras de forma rápida y eficiente.',
    icon: Car,
    color: 'from-rose-500 to-pink-500',
    bgLight: 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 border border-rose-200/50 dark:border-rose-800/40',
    borderHover: 'hover:border-rose-400/60 dark:hover:border-rose-500/50',
    shadowHover: 'hover:shadow-rose-100/40 dark:hover:shadow-rose-900/20',
    iconColor: 'text-rose-600 dark:text-rose-400',
    logo: null,
  },
];

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
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6 animate-fade-in">
      <PageHeader
        title="Cotizar"
        badge={`${visibleModules.length} comparadores`}
        description="Herramientas para cotizar seguros, formularios y comparadores multi-aseguradora."
        icon={Calculator}
      />

      {/* Module Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {visibleModules.map((mod) => {
          const Icon = mod.icon;
          return (
            <button
              key={mod.path}
              onClick={() => navigate(mod.path)}
              className={`group relative text-left rounded-2xl bg-surface-card dark:bg-neutral-900 border border-soft dark:border-white/[0.06] overflow-hidden transition-all duration-300 hover:shadow-2xl ${mod.shadowHover} hover:-translate-y-1 ${mod.borderHover} focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 p-6 flex flex-col justify-between`}
            >
              <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${mod.color}`} />

              <div>
                <div className={`flex items-center justify-center w-12 h-12 rounded-2xl ${mod.bgLight} mb-4 transition-transform duration-300 group-hover:scale-110 overflow-hidden ${mod.logo ? 'p-1.5' : ''}`}>
                  {mod.logo
                    ? <img src={mod.logo} alt={mod.label} className="w-full h-full object-contain" />
                    : <Icon className={`w-6 h-6 ${mod.iconColor}`} />
                  }
                </div>

                <h3 className="text-base font-bold text-neutral-900 dark:text-white mb-2 tracking-tight">
                  {mod.label}
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  {mod.description}
                </p>
              </div>

              <div className={`inline-flex items-center gap-1.5 mt-5 pt-3 border-t border-neutral-100 dark:border-white/5 text-xs font-semibold ${mod.iconColor} transition-all duration-200 group-hover:gap-2.5`}>
                Abrir cotizador
                <ChevronRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
