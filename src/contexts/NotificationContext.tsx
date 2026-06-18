import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

interface Notification {
  id: string;
  titulo: string;
  mensaje: string;
  modulo: string;
  accion_url: string | null;
  accion_texto: string | null;
  leida: boolean;
  created_at: string;
  tipo?: string;
  prioridad?: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  createNotification: (notification: Omit<Notification, 'id' | 'created_at' | 'leida'>) => Promise<void>;
  requestPushPermission: () => Promise<void>;
  pushEnabled: boolean;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { usuario } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(false);
  // Ref so the realtime callback always reads the latest value (no stale closure)
  const pushEnabledRef = useRef(pushEnabled);
  useEffect(() => { pushEnabledRef.current = pushEnabled; }, [pushEnabled]);

  useEffect(() => {
    if (usuario) {
      fetchNotifications();
      checkPushPermission();
      const unsub = subscribeToNotifications();
      return unsub;
    }
  }, [usuario?.id]);

  const checkPushPermission = () => {
    if ('Notification' in window) {
      const granted = Notification.permission === 'granted';
      setPushEnabled(granted);
      pushEnabledRef.current = granted;
    }
  };

  const fetchNotifications = async () => {
    if (!usuario) return;

    try {
      setLoading(true);

      const [notificacionesResult, transactionalResult] = await Promise.all([
        supabase
          .from('notificaciones')
          .select('*')
          .eq('usuario_id', usuario.id)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('notifications')
          .select('*')
          .eq('user_id', usuario.id)
          .order('created_at', { ascending: false })
          .limit(50)
      ]);

      const notificacionesData = notificacionesResult.data || [];
      const transactionalData = transactionalResult.data || [];

      const transactionalMapped = transactionalData.map(n => ({
        id: n.id,
        titulo: n.title,
        mensaje: n.body,
        modulo: 'Comisiones',
        accion_url: n.link_url,
        accion_texto: 'Ver',
        leida: n.is_read,
        created_at: n.created_at,
        tipo: 'transaccional',
        prioridad: 'normal'
      }));

      const allNotifications = [...notificacionesData, ...transactionalMapped].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setNotifications(allNotifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToNotifications = () => {
    if (!usuario) return;

    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    let currentChannel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    const connect = () => {
      if (cancelled) return;

      const channel = supabase
        .channel(`notificaciones-${usuario.id}-${Date.now()}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notificaciones',
            filter: `usuario_id=eq.${usuario.id}`,
          },
          (payload) => {
            const newNotification = payload.new as Notification;
            setNotifications((prev) => [newNotification, ...prev]);

            if (pushEnabledRef.current && 'Notification' in window && Notification.permission === 'granted') {
              showBrowserNotification(newNotification);
            }
            playNotificationSound();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${usuario.id}`,
          },
          (payload) => {
            const newNotif = payload.new as any;
            const mapped: Notification = {
              id: newNotif.id,
              titulo: newNotif.title,
              mensaje: newNotif.body,
              modulo: 'Comisiones',
              accion_url: newNotif.link_url,
              accion_texto: 'Ver',
              leida: newNotif.is_read,
              created_at: newNotif.created_at,
              tipo: 'transaccional',
              prioridad: 'normal'
            };
            setNotifications((prev) => [mapped, ...prev]);

            if (pushEnabledRef.current && 'Notification' in window && Notification.permission === 'granted') {
              showBrowserNotification(mapped);
            }
            playNotificationSound();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'notificaciones',
            filter: `usuario_id=eq.${usuario.id}`,
          },
          (payload) => {
            const updatedNotification = payload.new as Notification;
            setNotifications((prev) =>
              prev.map((n) => (n.id === updatedNotification.id ? updatedNotification : n))
            );
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${usuario.id}`,
          },
          (payload) => {
            const updated = payload.new as any;
            const mapped: Notification = {
              id: updated.id,
              titulo: updated.title,
              mensaje: updated.body,
              modulo: 'Comisiones',
              accion_url: updated.link_url,
              accion_texto: 'Ver',
              leida: updated.is_read,
              created_at: updated.created_at,
              tipo: 'transaccional',
              prioridad: 'normal'
            };
            setNotifications((prev) =>
              prev.map((n) => (n.id === mapped.id ? mapped : n))
            );
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'notificaciones',
            filter: `usuario_id=eq.${usuario.id}`,
          },
          (payload) => {
            const deletedId = payload.old.id;
            setNotifications((prev) => prev.filter((n) => n.id !== deletedId));
          }
        )
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            if (!cancelled) {
              supabase.removeChannel(channel);
              retryTimeout = setTimeout(connect, 3000);
            }
          }
        });

      currentChannel = channel;
    };

    connect();

    return () => {
      cancelled = true;
      if (retryTimeout) clearTimeout(retryTimeout);
      if (currentChannel) supabase.removeChannel(currentChannel);
    };
  };

  const showBrowserNotification = (notification: Notification) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      const notif = new Notification(notification.titulo, {
        body: notification.mensaje,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: notification.id,
        requireInteraction: false,
        silent: false,
      });

      notif.onclick = () => {
        window.focus();
        if (notification.accion_url) {
          window.location.href = notification.accion_url;
        }
        notif.close();
      };
    }
  };

  const playNotificationSound = () => {
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZRQ8PWqzn77BdGAc+ltryxncsAyqAzvLZiTUIGGm98OCjUQ4MUKjk7rdmHgU3kNfyz34uBiZyx/D');
    audio.volume = 0.3;
    audio.play().catch(() => {});
  };

  const requestPushPermission = async () => {
    if (!('Notification' in window)) {
      console.warn('Browser does not support notifications');
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setPushEnabled(permission === 'granted');
      pushEnabledRef.current = permission === 'granted';

      if (permission === 'granted') {
        showToast('Notificaciones activadas', 'success');
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      const notification = notifications.find(n => n.id === id);

      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, leida: true } : n))
      );

      if (notification?.tipo === 'transaccional') {
        const { error } = await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('id', id)
          .eq('user_id', usuario?.id);

        if (error) {
          console.error('Error marking transactional notification as read:', error);
          fetchNotifications();
        }
      } else {
        const { error } = await supabase
          .from('notificaciones')
          .update({ leida: true })
          .eq('id', id)
          .eq('usuario_id', usuario?.id);

        if (error) {
          console.error('Error marking notification as read:', error);
          fetchNotifications();
        }
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
      fetchNotifications();
    }
  };

  const markAllAsRead = async () => {
    if (!usuario) return;

    try {
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, leida: true }))
      );

      await Promise.all([
        supabase
          .from('notificaciones')
          .update({ leida: true })
          .eq('usuario_id', usuario.id)
          .eq('leida', false),
        supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('user_id', usuario.id)
          .eq('is_read', false)
      ]);

    } catch (error) {
      console.error('Error marking all as read:', error);
      fetchNotifications();
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      const notificationToDelete = notifications.find(n => n.id === id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));

      if (notificationToDelete?.tipo === 'transaccional') {
        const { error } = await supabase
          .from('notifications')
          .delete()
          .eq('id', id)
          .eq('user_id', usuario?.id);

        if (error) {
          console.error('Error deleting transactional notification:', error);
          if (notificationToDelete) {
            setNotifications((prev) => [notificationToDelete, ...prev]);
          }
        }
      } else {
        const { error } = await supabase
          .from('notificaciones')
          .delete()
          .eq('id', id)
          .eq('usuario_id', usuario?.id);

        if (error) {
          console.error('Error deleting notification:', error);
          if (notificationToDelete) {
            setNotifications((prev) => [notificationToDelete, ...prev]);
          }
        }
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
      fetchNotifications();
    }
  };

  const createNotification = async (
    notification: Omit<Notification, 'id' | 'created_at' | 'leida'>
  ) => {
    if (!usuario) return;

    try {
      // Usar función RPC que envía notificación + WhatsApp automáticamente
      const { error } = await supabase.rpc('enviar_notificacion_individual', {
        p_user_id: usuario.id,
        p_titulo: notification.titulo,
        p_mensaje: notification.mensaje,
        p_modulo: notification.modulo,
        p_accion_url: notification.accion_url || null,
        p_enviar_whatsapp: true, // Siempre enviar WhatsApp por defecto
      });

      if (error) throw error;
    } catch (error) {
      console.error('Error creating notification:', error);
    }
  };

  const unreadCount = notifications.filter((n) => !n.leida).length;

  const showToast = (message: string, type: 'success' | 'error') => {
    const toast = document.createElement('div');
    toast.className = `fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg text-white z-50 ${
      type === 'success' ? 'bg-emerald-500' : 'bg-red-500'
    }`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 3000);
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        createNotification,
        requestPushPermission,
        pushEnabled,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
}
