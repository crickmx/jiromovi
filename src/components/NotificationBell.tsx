import { useState, useRef, useEffect, useCallback, type MouseEvent as ReactMouseEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  Bell,
  Check,
  CheckCheck,
  X,
  Trash2,
  Mail,
  MessageSquare,
  Calendar,
  GraduationCap,
  MapPin,
  Palette,
  Users,
  Megaphone,
  ShoppingBag,
  Phone,
  MessageCircle,
  ClipboardList,
  TrendingUp,
  Sparkles,
  Inbox,
  Filter,
} from 'lucide-react';
import { useNotifications } from '../contexts/NotificationContext';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { es } from 'date-fns/locale';

interface ModuleConfig {
  icon: any;
  colorCls: string;
  bgCls: string;
}

const MODULE_CONFIGS: Record<string, ModuleConfig> = {
  'Trámites': { icon: ClipboardList, colorCls: 'text-blue-500', bgCls: 'bg-blue-500/10' },
  'Producción': { icon: TrendingUp, colorCls: 'text-emerald-500', bgCls: 'bg-emerald-500/10' },
  'Store': { icon: ShoppingBag, colorCls: 'text-purple-500', bgCls: 'bg-purple-500/10' },
  'Correos': { icon: Mail, colorCls: 'text-sky-500', bgCls: 'bg-sky-500/10' },
  'Chat': { icon: MessageSquare, colorCls: 'text-indigo-500', bgCls: 'bg-indigo-500/10' },
  'WhatsApp': { icon: MessageCircle, colorCls: 'text-emerald-500', bgCls: 'bg-emerald-500/10' },
  'Vacaciones': { icon: Calendar, colorCls: 'text-amber-500', bgCls: 'bg-amber-500/10' },
  'Educación': { icon: GraduationCap, colorCls: 'text-teal-500', bgCls: 'bg-teal-500/10' },
  'Espacio JIRO': { icon: MapPin, colorCls: 'text-rose-500', bgCls: 'bg-rose-500/10' },
  'Publicidad': { icon: Palette, colorCls: 'text-pink-500', bgCls: 'bg-pink-500/10' },
  'Contactos': { icon: Users, colorCls: 'text-accent-ink', bgCls: 'bg-blue-600/10' },
  'Sistema': { icon: Megaphone, colorCls: 'text-accent-ink', bgCls: 'bg-accent/10' },
};

interface NotificationBellProps {
  compact?: boolean;
  dropdownSide?: 'right' | 'bottom';
  fixedPanel?: boolean;
}

type TabFilter = 'all' | 'unread';

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
  const [activeTab, setActiveTab] = useState<TabFilter>('all');
  const [filterModule, setFilterModule] = useState<string>('all');
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});
  const [fullScreen, setFullScreen] = useState<boolean>(
    () => typeof window !== 'undefined' && window.innerWidth < 640
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();

  // Posicionamiento flotante seguro junto a la campana
  const calculatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const mobile = viewportWidth < 640;
    setFullScreen(mobile);
    if (mobile) return;

    const panelWidth = Math.min(410, viewportWidth - 32);
    const panelHeight = Math.min(580, viewportHeight - 32);

    // Si está en el footer de la barra lateral (zona inferior izquierda):
    // Abrir hacia arriba y hacia la derecha de la campana
    let left = rect.right + 12;
    if (left + panelWidth > viewportWidth - 16) {
      left = Math.max(16, rect.left - panelWidth - 12);
    }

    let top = rect.bottom - panelHeight;
    if (top < 16) top = 16;
    if (top + panelHeight > viewportHeight - 16) {
      top = viewportHeight - panelHeight - 16;
    }

    setPanelStyle({
      position: 'fixed',
      top,
      left,
      width: panelWidth,
      height: panelHeight,
      maxHeight: panelHeight,
      zIndex: 99999,
    });
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: globalThis.MouseEvent) => {
      const target = event.target as Node;
      if (panelRef.current && !panelRef.current.contains(target) &&
          buttonRef.current && !buttonRef.current.contains(target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      calculatePosition();
      window.addEventListener('resize', calculatePosition);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', calculatePosition);
    };
  }, [isOpen, calculatePosition]);

  // Lista de notificaciones filtradas por Pestaña ("Todas" vs "No leídas") y por Módulo
  const list = notifications || [];
  const filteredNotifications = list.filter(n => {
    if (activeTab === 'unread' && n.leida) return false;
    if (filterModule !== 'all' && n.modulo !== filterModule) return false;
    return true;
  });

  const modules = Array.from(new Set(list.map(n => n.modulo))).filter(Boolean);

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

  const getModuleConfig = (modulo: string): ModuleConfig => {
    return MODULE_CONFIGS[modulo] || { icon: Bell, colorCls: 'text-accent-ink', bgCls: 'bg-accent/10' };
  };

  const getMissedCallNumber = (notification: any): string | null => {
    if (notification.tipo !== 'llamada_perdida') return null;
    const raw = notification.metadata?.caller_number;
    if (!raw) return null;
    const digits = String(raw).replace(/\D/g, '');
    if (digits.length < 10) return null;
    return digits.slice(-10);
  };

  const handleLlamarClick = (e: ReactMouseEvent<HTMLElement>, notification: any) => {
    e.stopPropagation();
    markAsRead(notification.id);
  };

  const handleWhatsappClick = (e: ReactMouseEvent<HTMLButtonElement>, notification: any, numero: string) => {
    e.stopPropagation();
    markAsRead(notification.id);
    const nombre = notification.metadata?.caller_name || '';
    navigate(`/centro-contacto/whatsapp?telefono=${numero}${nombre ? `&nombre=${encodeURIComponent(nombre)}` : ''}`);
    setIsOpen(false);
  };

  const buttonClass = compact
    ? 'w-7 h-7 rounded-lg flex items-center justify-center hover:bg-neutral-200/60 dark:hover:bg-white/10 active:scale-90 transition-all text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white relative'
    : 'relative p-2 text-neutral-600 dark:text-neutral-400 hover:text-accent-ink hover:bg-neutral-100 dark:hover:bg-white/10 rounded-lg transition-colors';

  return (
    <div className="relative inline-block" ref={containerRef}>
      {/* Botón Campana con Ping */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={buttonClass}
        title="Notificaciones"
        aria-label="Abrir panel de notificaciones"
        aria-expanded={isOpen}
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center">
            <span className="absolute inset-0 rounded-full bg-red-400 opacity-70 animate-ping" />
            <span className="relative min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10.5px] font-extrabold rounded-full flex items-center justify-center leading-none shadow-xs">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          </span>
        )}
      </button>

      {/* Modal / Panel de Notificaciones Flotante */}
      {isOpen && (() => {
        const panelNode = (
          <div
            ref={panelRef}
            style={fullScreen ? { position: 'fixed', inset: 0, zIndex: 99999 } : panelStyle}
            className={cn(
              "bg-white/95 dark:bg-[#16161a]/95 backdrop-blur-md shadow-2xl flex flex-col overflow-hidden border border-neutral-200/90 dark:border-white/10 animate-in fade-in zoom-in-95 duration-150",
              fullScreen ? "rounded-none border-0" : "rounded-2xl"
            )}
          >
            {/* ── Header: Título, Pestañas y Acciones ── */}
            <div className="p-3.5 border-b border-neutral-100 dark:border-white/10 bg-neutral-50/50 dark:bg-white/[0.02]">
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-accent/10 dark:bg-accent/20 flex items-center justify-center text-accent-ink">
                    <Bell className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-1.5 leading-tight">
                      Notificaciones
                      {unreadCount > 0 && (
                        <span className="px-1.5 py-0.2 bg-red-500 text-white text-[11px] font-bold rounded-full">
                          {unreadCount}
                        </span>
                      )}
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-accent-ink hover:bg-accent/10 rounded-lg transition-colors"
                      title="Marcar todas como leídas"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Leer todo</span>
                    </button>
                  )}
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1 rounded-lg text-neutral-500 hover:text-neutral-700 dark:hover:text-white hover:bg-neutral-200/60 dark:hover:bg-white/10 transition-colors"
                    title="Cerrar"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Pestañas: Todas vs No Leídas */}
              <div className="flex items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-1 bg-neutral-200/70 dark:bg-white/5 p-0.5 rounded-lg text-xs font-medium">
                  <button
                    onClick={() => setActiveTab('all')}
                    className={cn(
                      'px-2.5 py-1 rounded-md transition-all',
                      activeTab === 'all'
                        ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-2xs font-semibold'
                        : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                    )}
                  >
                    Todas ({list.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('unread')}
                    className={cn(
                      'px-2.5 py-1 rounded-md transition-all flex items-center gap-1',
                      activeTab === 'unread'
                        ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-2xs font-semibold'
                        : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                    )}
                  >
                    No leídas
                    {unreadCount > 0 && (
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    )}
                  </button>
                </div>

                {/* Filtro por Módulo */}
                {modules.length > 0 && (
                  <div className="relative">
                    <select
                      value={filterModule}
                      onChange={(e) => setFilterModule(e.target.value)}
                      className="text-xs py-1 pl-2 pr-6 border border-soft dark:border-white/10 rounded-lg bg-surface-card dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-accent appearance-none cursor-pointer"
                    >
                      <option value="all">Módulos (todos)</option>
                      {modules.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                    <Filter className="w-3 h-3 text-neutral-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                )}
              </div>
            </div>

            {/* ── Cuerpo: Lista de Notificaciones ── */}
            <div className="flex-1 overflow-y-auto divide-y divide-neutral-100 dark:divide-white/[0.04]">
              {filteredNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-neutral-100 dark:bg-white/5 flex items-center justify-center text-neutral-500 mb-3">
                    <Inbox className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                    {activeTab === 'unread'
                      ? 'No tienes notificaciones pendientes'
                      : 'Bandeja de notificaciones vacía'}
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-500 mt-1 max-w-xs">
                    {activeTab === 'unread'
                      ? '¡Todo está al día! Las nuevas alertas aparecerán aquí en tiempo real.'
                      : 'Aquí recibirás avisos de trámites, mensajes, asignaciones y novedades.'}
                  </p>
                </div>
              ) : (
                filteredNotifications.map((n) => {
                  const cfg = getModuleConfig(n.modulo);
                  const Icon = cfg.icon;
                  const numeroLlamada = getMissedCallNumber(n);
                  const isUnread = !n.leida;

                  return (
                    <div
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className={cn(
                        'p-3 sm:p-3.5 transition-colors cursor-pointer relative group flex items-start gap-3',
                        isUnread
                          ? 'bg-accent/[0.04] dark:bg-accent/[0.08] hover:bg-accent/[0.07] dark:hover:bg-accent/[0.12]'
                          : 'hover:bg-neutral-50 dark:hover:bg-white/[0.03]'
                      )}
                    >
                      {/* Indicador de no leído */}
                      {isUnread && (
                        <span className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full bg-accent" />
                      )}

                      {/* Icono del Módulo */}
                      <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105', cfg.bgCls, cfg.colorCls)}>
                        <Icon className="w-4 h-4" />
                      </div>

                      {/* Contenido */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <h4 className={cn(
                            'text-xs truncate font-semibold',
                            isUnread ? 'text-neutral-900 dark:text-white' : 'text-neutral-700 dark:text-neutral-300'
                          )}>
                            {n.titulo}
                          </h4>
                          <span className="text-[11px] text-neutral-500 shrink-0 font-medium">
                            {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: es })}
                          </span>
                        </div>

                        <p className="text-xs text-neutral-600 dark:text-neutral-400 line-clamp-2 leading-relaxed">
                          {n.mensaje}
                        </p>

                        {/* Metadatos y Botones de Acción */}
                        <div className="flex items-center justify-between gap-2 mt-2 pt-1 border-t border-neutral-100/60 dark:border-white/[0.03]">
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10.5px] font-bold uppercase tracking-wider bg-neutral-100 dark:bg-white/5 text-neutral-600 dark:text-neutral-400">
                            {n.modulo}
                          </span>

                          <div className="flex items-center gap-1.5">
                            {numeroLlamada ? (
                              <>
                                <a
                                  href={`tel:${numeroLlamada}`}
                                  onClick={(e) => handleLlamarClick(e, n)}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold text-accent-ink hover:bg-accent/10 rounded-md transition-colors"
                                >
                                  <Phone className="w-3 h-3" />
                                  Llamar
                                </a>
                                <button
                                  onClick={(e) => handleWhatsappClick(e, n, numeroLlamada)}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-md transition-colors"
                                >
                                  <MessageCircle className="w-3 h-3" />
                                  WhatsApp
                                </button>
                              </>
                            ) : n.accion_url && (
                              <span className="text-[11px] font-semibold text-accent-ink group-hover:underline">
                                {n.accion_texto || 'Ver detalle →'}
                              </span>
                            )}

                            {isUnread && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  markAsRead(n.id);
                                }}
                                className="p-1 text-neutral-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-md transition-colors"
                                title="Marcar como leída"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteNotification(n.id);
                              }}
                              className="p-1 text-neutral-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                              title="Eliminar notificación"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* ── Footer: Push Banner y Conteo ── */}
            <div className="p-2.5 bg-neutral-50 dark:bg-white/[0.02] border-t border-neutral-100 dark:border-white/10 flex items-center justify-between text-[11px] text-neutral-500">
              <span>
                {filteredNotifications.length} de {list.length} notificaciones
              </span>

              {!pushEnabled && (
                <button
                  onClick={requestPushPermission}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold text-accent-ink hover:bg-accent/10 transition-colors"
                >
                  <Sparkles className="w-3 h-3" />
                  Activar Push en PC
                </button>
              )}
            </div>
          </div>
        );

        return createPortal(panelNode, document.body);
      })()}
    </div>
  );
}
