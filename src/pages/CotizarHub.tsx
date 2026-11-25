import { useNavigate } from 'react-router-dom';
import { Car, Compass, ChevronRight, Calculator, Heart, HeartHandshake, FileText, type LucideIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useModuleVisibility } from '../lib/useModuleVisibility';
import { isItemVisible, WORKSPACES, type UserRole } from '../lib/workspaceConfig';
import { PageHeader } from '../components/ui/page-header';

interface AseguradoraDelComparador {
  name: string;
  logo: string;
}

interface CotizadorModule {
  path: string;
  label: string;
  description: string;
  icon: LucideIcon;
  color: string;
  bgLight: string;
  borderHover: string;
  shadowHover: string;
  iconColor: string;
  logo: string | null;
  /** Texto del pie de la tarjeta (por omisión «Abrir cotizador»). */
  cta?: string;
  /** Logos de las aseguradoras que trae el comparador (se muestran juntos). */
  logos?: string[];
  /** Aseguradoras que trae cargadas el comparador (los planes incluidos). */
  aseguradoras?: AseguradoraDelComparador[];
}

const MODULES: CotizadorModule[] = [
  {
    path: '/cotizar/multicotizador-gmm',
    label: 'Multicotizador GMM',
    description: 'Compara Gastos Médicos Mayores en las tres aseguradoras cargadas, con las mismas coberturas y edad: cuál sale más barata, cómo queda el pago en cada forma (anual, semestral, trimestral, bimestral y mensual) y PDF con tu marca.',
    icon: Heart,
    color: 'from-teal-500 to-cyan-600',
    bgLight: 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 border border-teal-200/50 dark:border-teal-800/40',
    borderHover: 'hover:border-teal-400/60 dark:hover:border-teal-500/50',
    shadowHover: 'hover:shadow-teal-100/40 dark:hover:shadow-teal-900/20',
    iconColor: 'text-teal-600 dark:text-teal-400',
    logo: null,
    logos: ['/logo-bupa.png', '/logo-bx.png'],
    aseguradoras: [
      { name: 'Bupa Nacional Vital', logo: '/logo-bupa.png' },
      { name: 'Bupa Nacional Plus', logo: '/logo-bupa.png' },
      { name: 'BX+ Unikuz', logo: '/logo-bx.png' },
    ],
  },
  {
    path: '/cotizar/auna-oncologico',
    label: 'Auna Oncológico',
    description: 'Seguro oncológico Oncosalud Plus: tarifas por edad y sexo, cuestionario médico, extraprimas y PDF con tu marca.',
    icon: Heart,
    color: 'from-cyan-500 to-lime-400',
    bgLight: 'bg-white dark:bg-neutral-800 border border-cyan-200/60 dark:border-cyan-800/40',
    borderHover: 'hover:border-cyan-400/60 dark:hover:border-cyan-500/50',
    shadowHover: 'hover:shadow-cyan-100/40 dark:hover:shadow-cyan-900/20',
    iconColor: 'text-cyan-600 dark:text-cyan-400',
    logo: '/logo-auna.png',
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
  // No es un comparador: es emisión de membresías. Va al final y con su propio CTA.
  // El candado de beta lo pone el item del menú (`soloBeta`) vía isItemVisible.
  {
    path: '/saludtoday',
    label: 'salud.today',
    description: 'Emite y activa membresías de salud: telemedicina 24/7, asistencias médicas, dental, visión y beneficios para individuos y empresas. Reporte SICAS para Administrador.',
    icon: HeartHandshake,
    color: 'from-emerald-600 to-emerald-400',
    bgLight: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/40',
    borderHover: 'hover:border-emerald-400/60 dark:hover:border-emerald-500/50',
    shadowHover: 'hover:shadow-emerald-100/40 dark:hover:shadow-emerald-900/20',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    logo: '/salud-today-logo.png',
    cta: 'Emitir membresía',
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
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Cotizar"
        description="Herramientas para cotizar seguros, formularios y comparadores multi-aseguradora."
        icon={Calculator}
        action={{ label: 'Mis cotizaciones', onClick: () => navigate('/cotizar/cotizaciones'), icon: FileText }}
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
                {mod.logos && mod.logos.length > 0 ? (
                  <div className="flex items-center gap-1.5 mb-4">
                    {mod.logos.map((src) => (
                      <div
                        key={src}
                        className={`flex items-center justify-center w-12 h-12 rounded-2xl ${mod.bgLight} p-1.5 transition-transform duration-300 group-hover:scale-110 overflow-hidden`}
                      >
                        <img src={src} alt={mod.label} className="w-full h-full object-contain" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={`flex items-center justify-center w-12 h-12 rounded-2xl ${mod.bgLight} mb-4 transition-transform duration-300 group-hover:scale-110 overflow-hidden ${mod.logo ? 'p-1.5' : ''}`}>
                    {mod.logo
                      ? <img src={mod.logo} alt={mod.label} className="w-full h-full object-contain" />
                      : <Icon className={`w-6 h-6 ${mod.iconColor}`} />
                    }
                  </div>
                )}

                <h3 className="text-base font-bold text-neutral-900 dark:text-white mb-2 tracking-tight">
                  {mod.label}
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  {mod.description}
                </p>

                {mod.aseguradoras && mod.aseguradoras.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-3">
                    {mod.aseguradoras.map((aseg) => (
                      <span
                        key={aseg.name}
                        className="inline-flex items-center gap-1.5 pl-1 pr-2 py-0.5 rounded-full bg-neutral-100 dark:bg-white/5 border border-neutral-200/70 dark:border-white/10"
                      >
                        <img src={aseg.logo} alt={aseg.name} className="w-4 h-4 object-contain" />
                        <span className="text-[10px] font-semibold text-neutral-600 dark:text-neutral-300">
                          {aseg.name}
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className={`inline-flex items-center gap-1.5 mt-5 pt-3 border-t border-neutral-100 dark:border-white/5 text-xs font-semibold ${mod.iconColor} transition-all duration-200 group-hover:gap-2.5`}>
                {mod.cta ?? 'Abrir cotizador'}
                <ChevronRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
