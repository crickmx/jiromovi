import { useNavigate } from 'react-router-dom';
import { Activity, Car, FormInput, Compass, ChevronRight, Calculator, FileCheck, LayoutGrid, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const MODULES = [
  {
    path: '/cotizar/gmm-bx',
    label: 'GMM BX+',
    description: 'Cotiza seguros de Gastos Medicos Mayores con tarifas actualizadas de Blue Cross y otras aseguradoras.',
    icon: Activity,
    color: 'from-sky-500 to-cyan-500',
    bgLight: 'bg-sky-50 dark:bg-sky-900/20',
    borderHover: 'hover:border-sky-200 dark:hover:border-sky-700',
    shadowHover: 'hover:shadow-sky-100/40 dark:hover:shadow-sky-900/20',
    iconColor: 'text-sky-600 dark:text-sky-400',
    adminOnly: true,
  },
  {
    path: '/cotizar/formularios',
    label: 'Formularios de Cotizacion',
    description: 'Crea y gestiona formularios de cotizacion personalizados para todos los ramos de seguros.',
    icon: FormInput,
    color: 'from-emerald-500 to-teal-500',
    bgLight: 'bg-emerald-50 dark:bg-emerald-900/20',
    borderHover: 'hover:border-emerald-200 dark:hover:border-emerald-700',
    shadowHover: 'hover:shadow-emerald-100/40 dark:hover:shadow-emerald-900/20',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    adminOnly: false,
  },
  {
    path: '/cotizar/a-la-medida',
    label: 'A la Medida',
    description: 'Disenador inteligente de seguros. Selecciona coberturas y encuentra las aseguradoras con mejor compatibilidad.',
    icon: Compass,
    color: 'from-amber-500 to-orange-500',
    bgLight: 'bg-amber-50 dark:bg-amber-900/20',
    borderHover: 'hover:border-amber-200 dark:hover:border-amber-700',
    shadowHover: 'hover:shadow-amber-100/40 dark:hover:shadow-amber-900/20',
    iconColor: 'text-amber-600 dark:text-amber-400',
    adminOnly: false,
  },
  {
    path: '/cotizar/multicotizador',
    label: 'Multicotizador Digital',
    description: 'Compara cotizaciones de autos en multiples aseguradoras de forma rapida y eficiente.',
    icon: Car,
    color: 'from-rose-500 to-pink-500',
    bgLight: 'bg-rose-50 dark:bg-rose-900/20',
    borderHover: 'hover:border-rose-200 dark:hover:border-rose-700',
    shadowHover: 'hover:shadow-rose-100/40 dark:hover:shadow-rose-900/20',
    iconColor: 'text-rose-600 dark:text-rose-400',
    adminOnly: false,
  },
];

const STATS = [
  { icon: Calculator, label: 'Cotizaciones rapidas', value: 'En segundos' },
  { icon: FileCheck, label: 'Ramos disponibles', value: '+20' },
  { icon: LayoutGrid, label: 'Herramientas integradas', value: '4 modulos' },
];

export default function CotizarHub() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const isAdmin = usuario?.rol === 'Administrador';

  const visibleModules = MODULES.filter(m => !m.adminOnly || isAdmin);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 pb-16">
      {/* Header */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-sky-50 to-emerald-50 dark:from-sky-900/20 dark:to-emerald-900/20 border border-sky-100 dark:border-sky-800/30 mb-5">
          <Sparkles className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          <span className="text-sm font-medium text-sky-700 dark:text-sky-300">Herramientas de cotizacion</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-neutral-900 dark:text-white mb-4 tracking-tight">
          Centro de{' '}
          <span className="bg-gradient-to-r from-sky-600 to-emerald-600 bg-clip-text text-transparent">
            Cotizacion
          </span>
        </h1>
        <p className="text-neutral-500 dark:text-neutral-400 max-w-xl mx-auto text-base leading-relaxed">
          Todas las herramientas que necesitas para cotizar seguros, desde formularios personalizados
          hasta comparadores multi-aseguradora.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-12">
        {STATS.map(({ icon: Icon, label, value }) => (
          <div
            key={label}
            className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/[0.06] rounded-2xl px-4 py-5 text-center"
          >
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-900/20 mx-auto mb-3">
              <Icon className="w-5 h-5 text-sky-600 dark:text-sky-400" />
            </div>
            <p className="text-xl font-bold text-neutral-900 dark:text-white">{value}</p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Module Cards */}
      <div className="grid sm:grid-cols-2 gap-6">
        {visibleModules.map((mod) => {
          const Icon = mod.icon;
          return (
            <button
              key={mod.path}
              onClick={() => navigate(mod.path)}
              className={`group relative text-left rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/[0.06] overflow-hidden transition-all duration-300 hover:shadow-2xl ${mod.shadowHover} hover:-translate-y-1 ${mod.borderHover} focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500`}
            >
              {/* Gradient top bar */}
              <div className={`h-1.5 bg-gradient-to-r ${mod.color}`} />

              <div className="p-6">
                {/* Icon */}
                <div className={`flex items-center justify-center w-12 h-12 rounded-2xl ${mod.bgLight} mb-5 transition-transform duration-300 group-hover:scale-110`}>
                  <Icon className={`w-6 h-6 ${mod.iconColor}`} />
                </div>

                {/* Text */}
                <h3 className="text-[15px] font-bold text-neutral-900 dark:text-white mb-2 tracking-tight">
                  {mod.label}
                </h3>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  {mod.description}
                </p>

                {/* CTA */}
                <div className={`inline-flex items-center gap-1.5 mt-5 text-[13px] font-semibold ${mod.iconColor} transition-all duration-200 group-hover:gap-2.5`}>
                  Abrir
                  <ChevronRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                </div>
              </div>

              {/* Subtle gradient overlay on hover */}
              <div className={`absolute inset-0 bg-gradient-to-br ${mod.color} opacity-0 group-hover:opacity-[0.03] transition-opacity duration-300 pointer-events-none`} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
