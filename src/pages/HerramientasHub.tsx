import { useNavigate } from 'react-router-dom';
import {
  Users,
  BookUser,
  Key,
  Landmark,
  Monitor,
  Calendar,
  Trophy,
  PackageCheck,
  FileSearch,
  Wrench,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { isItemVisible, WORKSPACES, type UserRole } from '../lib/workspaceConfig';
import { useModuleVisibility } from '../lib/useModuleVisibility';
import { PageHeader } from '../components/ui/page-header';

interface ModuleCardConfig {
  path: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
  bgLight: string;
  iconColor: string;
  borderHover: string;
  shadowHover: string;
}

const HERRAMIENTAS_MODULES: ModuleCardConfig[] = [
  {
    path: '/mi-crm',
    label: 'Mi CRM',
    description: 'Gestión comercial de clientes, prospectos, tareas pendientes y embudos de venta.',
    icon: Users,
    gradient: 'from-blue-600 via-indigo-600 to-sky-500',
    bgLight: 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/40',
    iconColor: 'text-blue-600 dark:text-blue-400',
    borderHover: 'hover:border-blue-400/60 dark:hover:border-blue-500/50',
    shadowHover: 'hover:shadow-[0_12px_32px_-8px_rgba(59,130,246,0.25)]',
  },
  {
    path: '/contactos',
    label: 'Mis Contactos',
    description: 'Directorio unificado de contactos, vinculación con Seguwallet y gestión SICAS.',
    icon: BookUser,
    gradient: 'from-sky-500 via-cyan-500 to-teal-500',
    bgLight: 'bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 border border-sky-200/50 dark:border-sky-800/40',
    iconColor: 'text-sky-600 dark:text-sky-400',
    borderHover: 'hover:border-sky-400/60 dark:hover:border-sky-500/50',
    shadowHover: 'hover:shadow-[0_12px_32px_-8px_rgba(14,165,233,0.25)]',
  },
  {
    path: '/accesos-nacional',
    label: 'Accesos Nacional',
    description: 'Repositorio seguro de claves y credenciales compartidas para portales de aseguradoras.',
    icon: Key,
    gradient: 'from-amber-500 via-orange-500 to-yellow-500',
    bgLight: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/40',
    iconColor: 'text-amber-600 dark:text-amber-400',
    borderHover: 'hover:border-amber-400/60 dark:hover:border-amber-500/50',
    shadowHover: 'hover:shadow-[0_12px_32px_-8px_rgba(245,158,11,0.25)]',
  },
  {
    path: '/espacio-jiro',
    label: 'Espacio JIRO',
    description: 'Reserva inteligente de salas de juntas, escritorios y espacios de trabajo en oficinas JIRO.',
    icon: Landmark,
    gradient: 'from-emerald-500 via-teal-500 to-cyan-500',
    bgLight: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/40',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    borderHover: 'hover:border-emerald-400/60 dark:hover:border-emerald-500/50',
    shadowHover: 'hover:shadow-[0_12px_32px_-8px_rgba(16,185,129,0.25)]',
  },
  {
    path: '/centro-digital',
    label: 'Centro Digital',
    description: 'Repositorio documental centralizado, manuales de productos, circulares y formatos descargables.',
    icon: Monitor,
    gradient: 'from-violet-600 via-purple-600 to-indigo-600',
    bgLight: 'bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 border border-violet-200/50 dark:border-violet-800/40',
    iconColor: 'text-violet-600 dark:text-violet-400',
    borderHover: 'hover:border-violet-400/60 dark:hover:border-violet-500/50',
    shadowHover: 'hover:shadow-[0_12px_32px_-8px_rgba(139,92,246,0.25)]',
  },
  {
    path: '/vacaciones',
    label: 'Vacaciones',
    description: 'Control de días disponibles, solicitud de periodos vacacionales y flujo de aprobaciones.',
    icon: Calendar,
    gradient: 'from-rose-500 via-pink-500 to-red-500',
    bgLight: 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/50 dark:border-rose-800/40',
    iconColor: 'text-rose-600 dark:text-rose-400',
    borderHover: 'hover:border-rose-400/60 dark:hover:border-rose-500/50',
    shadowHover: 'hover:shadow-[0_12px_32px_-8px_rgba(244,63,94,0.25)]',
  },
  {
    path: '/mi-progreso',
    label: 'Mi Progreso',
    description: 'Gamificación de metas, ranking de agentes, niveles alcanzados y recompensas Jiro Coins.',
    icon: Trophy,
    gradient: 'from-yellow-500 via-amber-500 to-orange-500',
    bgLight: 'bg-yellow-50 dark:bg-yellow-950/40 text-yellow-600 dark:text-yellow-400 border border-yellow-200/50 dark:border-yellow-800/40',
    iconColor: 'text-yellow-600 dark:text-yellow-400',
    borderHover: 'hover:border-yellow-400/60 dark:hover:border-yellow-500/50',
    shadowHover: 'hover:shadow-[0_12px_32px_-8px_rgba(234,179,8,0.25)]',
  },
  {
    path: '/entrega-polizas',
    label: 'Entrega Pólizas',
    description: 'Seguimiento y control de entrega de pólizas a clientes y firmas de acuse de recibo.',
    icon: PackageCheck,
    gradient: 'from-teal-600 via-cyan-600 to-blue-600',
    bgLight: 'bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 border border-teal-200/50 dark:border-teal-800/40',
    iconColor: 'text-teal-600 dark:text-teal-400',
    borderHover: 'hover:border-teal-400/60 dark:hover:border-teal-500/50',
    shadowHover: 'hover:shadow-[0_12px_32px_-8px_rgba(20,184,166,0.25)]',
  },
  {
    path: '/lector-qualitas',
    label: 'Lector Qualitas',
    description: 'Procesamiento automatizado de carátulas de pólizas y recibos de Qualitas Compañía de Seguros.',
    icon: FileSearch,
    gradient: 'from-slate-600 via-neutral-600 to-zinc-600',
    bgLight: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-300/60 dark:border-neutral-700/60',
    iconColor: 'text-neutral-700 dark:text-neutral-300',
    borderHover: 'hover:border-neutral-400/60 dark:hover:border-neutral-500/50',
    shadowHover: 'hover:shadow-[0_12px_32px_-8px_rgba(100,116,139,0.25)]',
  },
];

const herramientasWorkspace = WORKSPACES.find(w => w.id === 'herramientas')!;

export default function HerramientasHub() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const { isVisible } = useModuleVisibility();

  const rol = (usuario?.rol || '') as UserRole;
  const oficinaId = usuario?.oficina_id ?? null;

  const visibleModules = HERRAMIENTAS_MODULES.filter(mod => {
    const navItem = herramientasWorkspace.items.find(item => item.path === mod.path || mod.path.startsWith(item.path + '/'));
    if (navItem && !isItemVisible(navItem, rol)) return false;
    if (!isVisible(mod.path, rol, oficinaId, usuario?.id)) return false;
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6 animate-fade-in">
      <PageHeader
        title="Herramientas"
        badge={`${visibleModules.length} módulos`}
        description="Centro de utilidades operativas y comerciales para agilizar tu gestión diaria, clientes, reservas y progreso."
        icon={Wrench}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {visibleModules.map((mod, idx) => {
          const Icon = mod.icon;
          return (
            <button
              key={mod.path}
              onClick={() => navigate(mod.path)}
              className={`group relative text-left rounded-2xl bg-surface-card dark:bg-neutral-900/80 border border-soft dark:border-white/[0.08] p-5 sm:p-6 overflow-hidden transition-all duration-300 hover:-translate-y-1 ${mod.shadowHover} ${mod.borderHover} focus:outline-none focus-visible:ring-2 focus-visible:ring-accent flex flex-col justify-between`}
            >
              <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${mod.gradient} opacity-80 group-hover:opacity-100 transition-opacity`} />

              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110 shadow-sm ${mod.bgLight}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-mono font-bold text-neutral-400 dark:text-neutral-500">
                    0{idx + 1}
                  </span>
                </div>

                <h3 className="text-base font-bold text-neutral-900 dark:text-white mb-2 tracking-tight group-hover:text-accent transition-colors flex items-center gap-1.5">
                  {mod.label}
                </h3>
                <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed line-clamp-3">
                  {mod.description}
                </p>
              </div>

              <div className="pt-4 mt-4 border-t border-neutral-100 dark:border-white/5 flex items-center justify-between">
                <span className={`text-xs font-semibold ${mod.iconColor} inline-flex items-center gap-1 group-hover:gap-2 transition-all`}>
                  Ingresar al módulo
                  <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
