import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

interface Notification {
  id: string;
  titulo: string;
  mensaje: string;
  modulo: string;
  icono: string;
  accion_url: string | null;
  accion_texto: string;
  leida: boolean;
  fecha_creacion: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  createNotification: (notification: Omit<Notification, 'id' | 'fecha_creacion' | 'leida'>) => Promise<void>;
  requestPushPermission: () => Promise<void>;
  pushEnabled: boolean;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { usuario } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(false);

  useEffect(() => {
    if (usuario) {
      fetchNotifications();
      subscribeToNotifications();
      checkPushPermission();
    }
  }, [usuario]);

  const checkPushPermission = () => {
    if ('Notification' in window) {
      setPushEnabled(Notification.permission === 'granted');
    }
  };

  const fetchNotifications = async () => {
    if (!usuario) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('notificaciones')
        .select('*')
        .eq('usuario_id', usuario.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setNotifications(data || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToNotifications = () => {
    if (!usuario) return;

    const channel = supabase
      .channel('notificaciones-channel')
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

          // Show browser notification if enabled
          if (pushEnabled && 'Notification' in window && Notification.permission === 'granted') {
            showBrowserNotification(newNotification);
          }

          // Play sound
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
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

      if (permission === 'granted') {
        showToast('Notificaciones activadas', 'success');
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notificaciones')
        .update({ leida: true })
        .eq('id', id)
        .eq('usuario_id', usuario?.id);

      if (error) throw error;
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!usuario) return;

    try {
      const { error } = await supabase
        .from('notificaciones')
        .update({ leida: true })
        .eq('usuario_id', usuario.id)
        .eq('leida', false);

      if (error) throw error;
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notificaciones')
        .delete()
        .eq('id', id)
        .eq('usuario_id', usuario?.id);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const createNotification = async (
    notification: Omit<Notification, 'id' | 'fecha_creacion' | 'leida'>
  ) => {
    if (!usuario) return;

    try {
      const { error } = await supabase.from('notificaciones').insert({
        usuario_id: usuario.id,
        ...notification,
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
