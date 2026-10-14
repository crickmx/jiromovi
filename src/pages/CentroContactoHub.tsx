import { useNavigate } from 'react-router-dom';
import {
  MessageCircle,
  Mail,
  MessageSquare,
  Building2,
  Bell,
  Headphones,
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

const CONTACT_MODULES: ModuleCardConfig[] = [
  {
    path: '/centro-contacto/whatsapp',
    label: 'WhatsApp',
    description: 'Bandeja unificada de conversaciones, atención a clientes y seguimiento por WhatsApp.',
    icon: MessageCircle,
    gradient: 'from-emerald-500 via-teal-500 to-green-600',
    bgLight: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/40',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    borderHover: 'hover:border-emerald-400/60 dark:hover:border-emerald-500/50',
    shadowHover: 'hover:shadow-[0_12px_32px_-8px_rgba(16,185,129,0.25)]',
  },
  {
    path: '/centro-contacto/email',
    label: 'Email',
    description: 'Gestor de correo electrónico profesional sincronizado con cuentas corporativas IONOS / Roundcube.',
    icon: Mail,
    gradient: 'from-blue-600 via-sky-600 to-indigo-600',
    bgLight: 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/40',
    iconColor: 'text-blue-600 dark:text-blue-400',
    borderHover: 'hover:border-blue-400/60 dark:hover:border-blue-500/50',
    shadowHover: 'hover:shadow-[0_12px_32px_-8px_rgba(59,130,246,0.25)]',
  },
  {
    path: '/centro-contacto/chat',
    label: 'Chat Interno',
    description: 'Canales de comunicación directa entre agentes, ejecutivos y áreas operativas.',
    icon: MessageSquare,
    gradient: 'from-violet-600 via-purple-600 to-indigo-600',
    bgLight: 'bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 border border-violet-200/50 dark:border-violet-800/40',
    iconColor: 'text-violet-600 dark:text-violet-400',
    borderHover: 'hover:border-violet-400/60 dark:hover:border-violet-500/50',
    shadowHover: 'hover:shadow-[0_12px_32px_-8px_rgba(139,92,246,0.25)]',
  },
  {
    path: '/directorio-jiro',
    label: 'Directorio JIRO',
    description: 'Directorio de extensiones telefónicas, contactos internos y oficinas de todo el grupo.',
    icon: Building2,
    gradient: 'from-amber-500 via-orange-500 to-yellow-600',
    bgLight: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/40',
    iconColor: 'text-amber-600 dark:text-amber-400',
    borderHover: 'hover:border-amber-400/60 dark:hover:border-amber-500/50',
    shadowHover: 'hover:shadow-[0_12px_32px_-8px_rgba(245,158,11,0.25)]',
  },
  {
    path: '/centro-contacto/notificaciones',
    label: 'Notificaciones',
    description: 'Centro de administración de alertas y plantillas de notificaciones transaccionales.',
    icon: Bell,
    gradient: 'from-rose-500 via-pink-500 to-red-600',
    bgLight: 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/50 dark:border-rose-800/40',
    iconColor: 'text-rose-600 dark:text-rose-400',
    borderHover: 'hover:border-rose-400/60 dark:hover:border-rose-500/50',
    shadowHover: 'hover:shadow-[0_12px_32px_-8px_rgba(244,63,94,0.25)]',
  },
];

const centroContactoWorkspace = WORKSPACES.find(w => w.id === 'centro-contacto')!;

export default function CentroContactoHub() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const { isVisible } = useModuleVisibility();

  const rol = (usuario?.rol || '') as UserRole;
  const oficinaId = usuario?.oficina_id ?? null;

  const visibleModules = CONTACT_MODULES.filter(mod => {
    const navItem = centroContactoWorkspace.items.find(item => item.path === mod.path || mod.path.startsWith(item.path + '/'));
    if (navItem && !isItemVisible(navItem, rol)) return false;
    if (!isVisible(mod.path, rol, oficinaId, usuario?.id)) return false;
    return true;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Centro de Contacto"
        badge={`${visibleModules.length} canales`}
        description="Comunícate con clientes y equipo a través de WhatsApp, correo corporativo, chat interno y telefonía."
        icon={Headphones}
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
                  Abrir canal
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
