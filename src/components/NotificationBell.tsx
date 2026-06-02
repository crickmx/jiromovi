import { useState, useRef, useEffect, useCallback } from 'react';
import { Bell, Check, CheckCheck, X, Trash2, ListFilter as Filter, Mail, MessageSquare, Calendar, GraduationCap, MapPin, Palette, Users, Megaphone, ShoppingBag } from 'lucide-react';
import { useNotifications } from '../contexts/NotificationContext';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { es } from 'date-fns/locale';

const moduleIcons: Record<string, any> = {
  'Correos': Mail,
  'Chat': MessageSquare,
  'Vacaciones': Calendar,
  'Educación': GraduationCap,
  'Espacio JIRO': MapPin,
  'Publicidad': Palette,
  'Contactos': Users,
  'Sistema': Megaphone,
  'Store': ShoppingBag,
};

interface NotificationBellProps {
  /** Render as a compact sidebar-rail style button (44×44 px, rounded-2xl) */
  compact?: boolean;
  /** Which side to open the dropdown. Defaults to 'right' (left-full) for sidebar, 'bottom' for inline. */
  dropdownSide?: 'right' | 'bottom';
  /** When true, the panel renders fixed to the viewport (use inside overlays/drawers). */
  fixedPanel?: boolean;
}

export function NotificationBell({ compact, dropdownSide = 'right', fixedPanel }: NotificationBellProps) {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    requestPushPermission,
    pushEnabled,
  } = useNotifications();

  const [isOpen, setIsOpen] = useState(false);
  const [filterModule, setFilterModule] = useState<string>('all');
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();

  const calculateFixedPosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const MARGIN = 8;
    const PANEL_MIN_HEIGHT = 500;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const panelWidth = Math.min(384, viewportWidth - 2 * MARGIN);

    let left = rect.right + MARGIN;

    // If panel would overflow right edge, show to the left of the button
    if (left + panelWidth > viewportWidth - MARGIN) {
      left = rect.left - panelWidth - MARGIN;
    }
    // If it still overflows left, align to viewport left with margin
    if (left < MARGIN) {
      left = MARGIN;
    }

    // Determine if we open downward or upward
    const spaceBelow = viewportHeight - rect.top - MARGIN;
    const spaceAbove = rect.bottom - MARGIN;
    let top: number;
    let maxHeight: number;

    if (spaceBelow >= PANEL_MIN_HEIGHT) {
      top = rect.top;
      maxHeight = spaceBelow;
    } else {
      maxHeight = Math.min(spaceAbove, viewportHeight - 2 * MARGIN);
      top = rect.bottom - maxHeight;
      if (top < MARGIN) top = MARGIN;
    }

    setPanelStyle({ position: 'fixed', top, left, width: panelWidth, maxHeight, zIndex: 9999 });
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (fixedPanel) {
        if (panelRef.current && !panelRef.current.contains(target) &&
            buttonRef.current && !buttonRef.current.contains(target)) {
          setIsOpen(false);
        }
      } else {
        if (containerRef.current && !containerRef.current.contains(target)) {
          setIsOpen(false);
        }
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      if (fixedPanel) calculateFixedPosition();
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, fixedPanel, calculateFixedPosition]);

  const filteredNotifications = filterModule === 'all'
    ? (notifications || [])
    : (notifications || []).filter(n => n.modulo === filterModule);

  const modules = Array.from(new Set((notifications || []).map(n => n.modulo)));

  const handleNotificationClick = (notification: any) => {
    markAsRead(notification.id);
    if (notification.accion_url) {
      let url = notification.accion_url;

      if (url.startsWith('http://') || url.startsWith('https://')) {
        try {
          const urlObj = new URL(url);
          url = urlObj.pathname + urlObj.search + urlObj.hash;
        } catch (e) {
          console.error('Error parsing notification URL:', e);
        }
      }

      navigate(url);
      setIsOpen(false);
    }
  };

  const getModuleIcon = (modulo: string) => {
    const IconComponent = moduleIcons[modulo] || Bell;
    return IconComponent;
  };

  const buttonClass = compact
    ? 'sidebar-rail-btn w-11 h-11 rounded-2xl flex items-center justify-center active:scale-90 relative'
    : 'relative p-2 text-neutral-600 dark:text-neutral-400 hover:text-accent hover:bg-neutral-100 dark:hover:bg-white/10 rounded-lg transition-colors';

  return (
    <div className="relative" ref={containerRef}>
      {/* Bell Icon Button */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={buttonClass}
        title="Notificaciones"
      >
        <Bell className={compact ? 'w-[18px] h-[18px]' : 'w-6 h-6'} />
        {unreadCount > 0 && (
          <span className={cn(
            "absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none",
            compact && "ring-2 ring-[rgb(var(--movi-accent-dark-rgb))]"
          )}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {isOpen && (
        <div
          ref={panelRef}
          style={fixedPanel ? panelStyle : undefined}
          className={cn(
            "bg-white dark:bg-neutral-900 rounded-xl shadow-2xl border border-neutral-200 dark:border-white/10 flex flex-col",
            fixedPanel
              ? ''
              : cn(
                  "absolute z-50",
                  dropdownSide === 'right'
                    ? "left-full ml-2 top-0 w-80 sm:w-96 max-h-[min(600px,calc(100vh-80px))]"
                    : "right-0 top-full mt-2 w-80 sm:w-96 max-h-[min(600px,calc(100vh-80px))]"
                )
          )}
        >
          {/* Header */}
          <div className="p-4 border-b border-neutral-200 dark:border-white/10">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-neutral-800 dark:text-white">
                Notificaciones
                {unreadCount > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-semibold rounded-full">
                    {unreadCount} nuevas
                  </span>
                )}
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-accent bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/40 rounded-lg transition-colors"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Marcar todo como leído
                </button>
              )}

              {!pushEnabled && (
                <button
                  onClick={requestPushPermission}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 rounded-lg transition-colors"
                >
                  <Bell className="w-3.5 h-3.5" />
                  Activar push
                </button>
              )}
            </div>

            {/* Filter */}
            {modules.length > 0 && (
              <div className="mt-3 relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400 dark:text-neutral-500" />
                <select
                  value={filterModule}
                  onChange={(e) => setFilterModule(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-neutral-300 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-accent focus:border-accent bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200"
                >
                  <option value="all">Todos los módulos</option>
                  {modules.map((module) => (
                    <option key={module} value={module}>
                      {module}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Notifications List */}
          <div className="flex-1 overflow-y-auto">
            {filteredNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4">
                <Bell className="w-16 h-16 text-neutral-300 dark:text-neutral-600 mb-3" />
                <p className="text-neutral-500 dark:text-neutral-400 text-center">
                  {filterModule === 'all'
                    ? 'No tienes notificaciones'
                    : `No hay notificaciones de ${filterModule}`
                  }
                </p>
              </div>
            ) : (
              <div className="divide-y divide-neutral-100 dark:divide-white/5">
                {filteredNotifications.map((notification) => {
                  const IconComponent = getModuleIcon(notification.modulo);

                  return (
                    <div
                      key={notification.id}
                      className={`p-4 hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors cursor-pointer ${
                        !notification.leida ? 'bg-primary-50/30 dark:bg-primary-900/10' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Icon */}
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                          !notification.leida
                            ? 'bg-primary-100 dark:bg-primary-900/30 text-accent'
                            : 'bg-neutral-100 dark:bg-white/10 text-neutral-600 dark:text-neutral-400'
                        }`}>
                          <IconComponent className="w-5 h-5" />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h4 className={`text-sm font-semibold ${
                              !notification.leida
                                ? 'text-neutral-900 dark:text-white'
                                : 'text-neutral-700 dark:text-neutral-300'
                            }`}>
                              {notification.titulo}
                            </h4>
                            {!notification.leida && (
                              <div className="w-2 h-2 bg-accent rounded-full flex-shrink-0 mt-1" />
                            )}
                          </div>

                          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2 line-clamp-2">
                            {notification.mensaje}
                          </p>

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-neutral-500 dark:text-neutral-500">
                                {formatDistanceToNow(new Date(notification.created_at), {
                                  addSuffix: true,
                                  locale: es,
                                })}
                              </span>
                              <span className="text-xs text-neutral-400 dark:text-neutral-600">•</span>
                              <span className="text-xs text-neutral-500 dark:text-neutral-500">
                                {notification.modulo}
                              </span>
                            </div>

                            <div className="flex items-center gap-1">
                              {notification.accion_url && (
                                <button
                                  onClick={() => handleNotificationClick(notification)}
                                  className="px-2 py-1 text-xs font-medium text-accent hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded transition-colors"
                                >
                                  {notification.accion_texto || 'Ver'}
                                </button>
                              )}

                              {!notification.leida && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    markAsRead(notification.id);
                                  }}
                                  className="p-1 text-neutral-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded transition-colors"
                                  title="Marcar como leída"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                              )}

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteNotification(notification.id);
                                }}
                                className="p-1 text-neutral-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                title="Eliminar"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          {(notifications || []).length > 0 && (
            <div className="p-3 border-t border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5">
              <p className="text-xs text-center text-neutral-500 dark:text-neutral-400">
                Mostrando {filteredNotifications.length} de {(notifications || []).length} notificaciones
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
