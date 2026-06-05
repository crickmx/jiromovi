import { useNavigate } from 'react-router-dom';
import { TrendingUp, Activity, DollarSign, FolderOpen, Settings, ChevronRight, ChartBar as BarChart3 } from 'lucide-react';
import { useMoviAuth } from '../contexts/MoviAuthContext';

const MODULES = [
  {
    path: '/produccion/mi-produccion',
    label: 'Mi Produccion',
    description: 'Visualiza tu produccion personal con datos de SICAS en tiempo real. Polizas, renovaciones y avance comercial.',
    icon: TrendingUp,
    color: 'from-emerald-500 to-teal-500',
    bgLight: 'bg-emerald-50 dark:bg-emerald-900/20',
    borderHover: 'hover:border-emerald-200 dark:hover:border-emerald-700',
    shadowHover: 'hover:shadow-emerald-100/40 dark:hover:shadow-emerald-900/20',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    adminOnly: false,
    notAgent: false,
  },
  {
    path: '/produccion/total',
    label: 'Produccion Total',
    description: 'Reporte consolidado de produccion de la oficina. Comparativos por ramo, aseguradora y periodo.',
    icon: BarChart3,
    color: 'from-blue-500 to-cyan-500',
    bgLight: 'bg-blue-50 dark:bg-blue-900/20',
    borderHover: 'hover:border-blue-200 dark:hover:border-blue-700',
    shadowHover: 'hover:shadow-blue-100/40 dark:hover:shadow-blue-900/20',
    iconColor: 'text-blue-600 dark:text-blue-400',
    adminOnly: false,
    notAgent: true,
  },
  {
    path: '/produccion/convenio',
    label: 'Produccion Convenio',
    description: 'Analisis de produccion por convenios especiales. Prima ponderada, bonos y cumplimiento.',
    icon: Activity,
    color: 'from-violet-500 to-fuchsia-500',
    bgLight: 'bg-violet-50 dark:bg-violet-900/20',
    borderHover: 'hover:border-violet-200 dark:hover:border-violet-700',
    shadowHover: 'hover:shadow-violet-100/40 dark:hover:shadow-violet-900/20',
    iconColor: 'text-violet-600 dark:text-violet-400',
    adminOnly: false,
    notAgent: true,
  },
  {
    path: '/produccion/mis-comisiones',
    label: 'Mis Comisiones',
    description: 'Detalle de tus comisiones por periodo. Desglose fiscal, pagos recibidos y pendientes.',
    icon: DollarSign,
    color: 'from-amber-500 to-orange-500',
    bgLight: 'bg-amber-50 dark:bg-amber-900/20',
    borderHover: 'hover:border-amber-200 dark:hover:border-amber-700',
    shadowHover: 'hover:shadow-amber-100/40 dark:hover:shadow-amber-900/20',
    iconColor: 'text-amber-600 dark:text-amber-400',
    adminOnly: false,
    notAgent: false,
  },
  {
    path: '/produccion/cargar',
    label: 'Cargar Datos',
    description: 'Importar datos de produccion desde Excel o Google Sheets. Procesamiento automatico de lotes.',
    icon: FolderOpen,
    color: 'from-slate-500 to-zinc-500',
    bgLight: 'bg-slate-50 dark:bg-slate-900/20',
    borderHover: 'hover:border-slate-200 dark:hover:border-slate-700',
    shadowHover: 'hover:shadow-slate-100/40 dark:hover:shadow-slate-900/20',
    iconColor: 'text-slate-600 dark:text-slate-400',
    adminOnly: true,
    notAgent: false,
  },
  {
    path: '/produccion/configuracion',
    label: 'Configuracion',
    description: 'Gestionar fuentes de datos, mapeos de vendedores y configuracion de sincronizacion.',
    icon: Settings,
    color: 'from-rose-500 to-pink-500',
    bgLight: 'bg-rose-50 dark:bg-rose-900/20',
    borderHover: 'hover:border-rose-200 dark:hover:border-rose-700',
    shadowHover: 'hover:shadow-rose-100/40 dark:hover:shadow-rose-900/20',
    iconColor: 'text-rose-600 dark:text-rose-400',
    adminOnly: true,
    notAgent: false,
  },
];

export default function ProduccionHub() {
  const navigate = useNavigate();
  const { usuario } = useMoviAuth();
  const rol = usuario?.rol;

  const visibleModules = MODULES.filter(m => {
    if (m.adminOnly && rol !== 'Administrador') return false;
    if (m.notAgent && rol === 'Agente') return false;
    return true;
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-7">
      <div className="flex items-center gap-4 mb-8">
        <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/30 flex-shrink-0">
          <BarChart3 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-white tracking-tight">Central de Produccion</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Toda tu produccion, comisiones y rendimiento en un solo lugar</p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        {visibleModules.map((mod) => {
          const Icon = mod.icon;
          return (
            <button
              key={mod.path}
              onClick={() => navigate(mod.path)}
              className={`group relative text-left rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/[0.06] overflow-hidden transition-all duration-300 hover:shadow-2xl ${mod.shadowHover} hover:-translate-y-1 ${mod.borderHover} focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500`}
            >
              <div className={`h-1.5 bg-gradient-to-r ${mod.color}`} />

              <div className="p-6">
                <div className={`flex items-center justify-center w-12 h-12 rounded-2xl ${mod.bgLight} mb-5 transition-transform duration-300 group-hover:scale-110`}>
                  <Icon className={`w-6 h-6 ${mod.iconColor}`} />
                </div>

                <h3 className="text-[15px] font-bold text-neutral-900 dark:text-white mb-2 tracking-tight">
                  {mod.label}
                </h3>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  {mod.description}
                </p>

                <div className={`inline-flex items-center gap-1.5 mt-5 text-[13px] font-semibold ${mod.iconColor} transition-all duration-200 group-hover:gap-2.5`}>
                  Abrir
                  <ChevronRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                </div>
              </div>

              <div className={`absolute inset-0 bg-gradient-to-br ${mod.color} opacity-0 group-hover:opacity-[0.03] transition-opacity duration-300 pointer-events-none`} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
