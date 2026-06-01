import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { MessageCircle, Mail, MessagesSquare } from 'lucide-react';
import { cn } from '../lib/utils';

const TABS = [
  { label: 'WhatsApp', path: '/centro-contacto/whatsapp', icon: MessageCircle, color: 'text-emerald-600 dark:text-emerald-400' },
  { label: 'Correo', path: '/centro-contacto/email', icon: Mail, color: 'text-sky-600 dark:text-sky-400' },
  { label: 'Chat', path: '/centro-contacto/chat', icon: MessagesSquare, color: 'text-blue-600 dark:text-blue-400' },
];

export default function CentroContactoLayout() {
  const location = useLocation();

  const isChannelRoute = TABS.some(t => location.pathname.startsWith(t.path));

  return (
    <div className="flex flex-col h-full min-h-0">
      {isChannelRoute && (
        <div className="flex-shrink-0 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-700 px-4">
          <nav className="flex gap-1" aria-label="Canales de contacto">
            {TABS.map(({ label, path, icon: Icon, color }) => (
              <NavLink
                key={path}
                to={path}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                    isActive
                      ? cn('border-current', color)
                      : 'border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:border-neutral-300 dark:hover:border-neutral-600'
                  )
                }
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}
