import { useState, useRef, useEffect } from 'react';
import { Bell, Check, CheckCheck, X, Trash2, Filter, Mail, MessageSquare, Calendar, GraduationCap, MapPin, Palette, Users, Megaphone, ShoppingBag } from 'lucide-react';
import { useNotifications } from '../contexts/NotificationContext';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
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

export function NotificationBell() {
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
  const panelRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const filteredNotifications = filterModule === 'all'
    ? (notifications || [])
    : (notifications || []).filter(n => n.modulo === filterModule);

  const modules = Array.from(new Set((notifications || []).map(n => n.modulo)));

  const handleNotificationClick = (notification: any) => {
    markAsRead(notification.id);
    if (notification.accion_url) {
      navigate(notification.accion_url);
      setIsOpen(false);
    }
  };

  const getModuleIcon = (modulo: string) => {
    const IconComponent = moduleIcons[modulo] || Bell;
    return IconComponent;
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Icon Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-neutral-600 hover:text-primary-600 hover:bg-neutral-100 rounded-lg transition-colors"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-96 max-h-[600px] bg-white rounded-xl shadow-2xl border border-neutral-200 z-50 flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-neutral-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-neutral-800">
                Notificaciones
                {unreadCount > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-600 text-xs font-semibold rounded-full">
                    {unreadCount} nuevas
                  </span>
                )}
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-neutral-400 hover:text-neutral-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Marcar todo como leído
                </button>
              )}

              {!pushEnabled && (
                <button
                  onClick={requestPushPermission}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                >
                  <Bell className="w-3.5 h-3.5" />
                  Activar push
                </button>
              )}
            </div>

            {/* Filter */}
            {modules.length > 0 && (
              <div className="mt-3 relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <select
                  value={filterModule}
                  onChange={(e) => setFilterModule(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
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
                <Bell className="w-16 h-16 text-neutral-300 mb-3" />
                <p className="text-neutral-500 text-center">
                  {filterModule === 'all'
                    ? 'No tienes notificaciones'
                    : `No hay notificaciones de ${filterModule}`
                  }
                </p>
              </div>
            ) : (
              <div className="divide-y divide-neutral-100">
                {filteredNotifications.map((notification) => {
                  const IconComponent = getModuleIcon(notification.modulo);

                  return (
                    <div
                      key={notification.id}
                      className={`p-4 hover:bg-neutral-50 transition-colors cursor-pointer ${
                        !notification.leida ? 'bg-primary-50/30' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Icon */}
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                          !notification.leida
                            ? 'bg-primary-100 text-primary-600'
                            : 'bg-neutral-100 text-neutral-600'
                        }`}>
                          <IconComponent className="w-5 h-5" />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h4 className={`text-sm font-semibold ${
                              !notification.leida ? 'text-neutral-900' : 'text-neutral-700'
                            }`}>
                              {notification.titulo}
                            </h4>
                            {!notification.leida && (
                              <div className="w-2 h-2 bg-primary-600 rounded-full flex-shrink-0 mt-1" />
                            )}
                          </div>

                          <p className="text-sm text-neutral-600 mb-2 line-clamp-2">
                            {notification.mensaje}
                          </p>

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-neutral-500">
                                {formatDistanceToNow(new Date(notification.created_at), {
                                  addSuffix: true,
                                  locale: es,
                                })}
                              </span>
                              <span className="text-xs text-neutral-400">•</span>
                              <span className="text-xs text-neutral-500">
                                {notification.modulo}
                              </span>
                            </div>

                            <div className="flex items-center gap-1">
                              {notification.accion_url && (
                                <button
                                  onClick={() => handleNotificationClick(notification)}
                                  className="px-2 py-1 text-xs font-medium text-primary-600 hover:bg-primary-50 rounded transition-colors"
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
                                  className="p-1 text-neutral-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
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
                                className="p-1 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
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
            <div className="p-3 border-t border-neutral-200 bg-neutral-50">
              <p className="text-xs text-center text-neutral-500">
                Mostrando {filteredNotifications.length} de {(notifications || []).length} notificaciones
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
