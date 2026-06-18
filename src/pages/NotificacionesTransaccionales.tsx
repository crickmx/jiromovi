import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Mail, FileText, Send, CircleCheck as CheckCircle2, Circle as XCircle, Clock, CircleAlert as AlertCircle, RefreshCw, Radio } from 'lucide-react';
import { TiposNotificaciones } from '../components/notificaciones/TiposNotificaciones';
import { HistorialEnvios } from '../components/notificaciones/HistorialEnvios';
import { CanalesNotificacion } from '../components/notificaciones/CanalesNotificacion';
import { PageHeader } from '@/components/ui/page-header';

type Tab = 'canales' | 'notificaciones' | 'historial';

interface Stats {
  total_enviados: number;
  total_fallidos: number;
  total_pendientes: number;
  tipos_activos: number;
}

export function NotificacionesTransaccionales() {
  const { usuario } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('canales');
  const [stats, setStats] = useState<Stats>({
    total_enviados: 0,
    total_fallidos: 0,
    total_pendientes: 0,
    tipos_activos: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (usuario?.rol === 'Administrador') {
      fetchStats();
    }
  }, [usuario]);

  const fetchStats = async () => {
    try {
      setLoading(true);

      const [{ count: enviados }, { count: fallidos }, { count: pendientes }, { count: activos }] =
        await Promise.all([
          supabase.from('correo_historial_envios').select('id', { count: 'exact', head: true }).eq('estado', 'enviado'),
          supabase.from('correo_historial_envios').select('id', { count: 'exact', head: true }).eq('estado', 'fallido'),
          supabase.from('correo_historial_envios').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente'),
          supabase.from('correo_tipos_notificacion').select('id', { count: 'exact', head: true }).eq('activo', true),
        ]);

      setStats({
        total_enviados: enviados || 0,
        total_fallidos: fallidos || 0,
        total_pendientes: pendientes || 0,
        tipos_activos: activos || 0,
      });
    } catch (error) {
      console.error('Error al cargar estadísticas:', error);
    } finally {
      setLoading(false);
    }
  };

  if (usuario?.rol !== 'Administrador') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-accent-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-neutral-800 mb-2">Acceso Restringido</h2>
          <p className="text-neutral-600">Solo los administradores pueden acceder a este módulo.</p>
        </div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'canales', label: 'Canales', icon: Radio },
    { id: 'notificaciones', label: 'Plantillas y Notificaciones', icon: FileText },
    { id: 'historial', label: 'Historial de Envíos', icon: Clock },
  ];

  return (
    <div className="h-full overflow-y-auto">
      <div className="space-y-6 p-6">
        <PageHeader
          title="Notificaciones Transaccionales"
          description="Administra canales de envío, plantillas y configuración de notificaciones"
          icon={Mail}
        />

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-neutral-800/50 rounded-xl border border-neutral-200/60 dark:border-white/8 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-600 dark:text-white/60 mb-1">Enviados</p>
                <p className="text-2xl font-bold text-emerald-600">{loading ? '—' : stats.total_enviados}</p>
              </div>
              <CheckCircle2 className="w-10 h-10 text-emerald-500 opacity-20" />
            </div>
          </div>

          <div className="bg-white dark:bg-neutral-800/50 rounded-xl border border-neutral-200/60 dark:border-white/8 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-600 dark:text-white/60 mb-1">Fallidos</p>
                <p className="text-2xl font-bold text-accent-600">{loading ? '—' : stats.total_fallidos}</p>
              </div>
              <XCircle className="w-10 h-10 text-accent-500 opacity-20" />
            </div>
          </div>

          <div className="bg-white dark:bg-neutral-800/50 rounded-xl border border-neutral-200/60 dark:border-white/8 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-600 dark:text-white/60 mb-1">Pendientes</p>
                <p className="text-2xl font-bold text-amber-600">{loading ? '—' : stats.total_pendientes}</p>
              </div>
              <Clock className="w-10 h-10 text-amber-500 opacity-20" />
            </div>
          </div>

          <div className="bg-white dark:bg-neutral-800/50 rounded-xl border border-neutral-200/60 dark:border-white/8 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-600 dark:text-white/60 mb-1">Tipos Activos</p>
                <p className="text-2xl font-bold text-accent">{loading ? '—' : stats.tipos_activos}</p>
              </div>
              <Send className="w-10 h-10 text-accent opacity-20" />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white dark:bg-neutral-800/50 rounded-xl border border-neutral-200/60 dark:border-white/8">
          <div className="border-b border-neutral-200 dark:border-white/8">
            <div className="flex overflow-x-auto items-center justify-between pr-4">
              <div className="flex">
                {tabs.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors whitespace-nowrap ${
                      activeTab === id
                        ? 'text-accent border-b-2 border-accent'
                        : 'text-neutral-600 dark:text-white/50 hover:text-neutral-800 dark:hover:text-white/70'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {label}
                  </button>
                ))}
              </div>
              <button
                onClick={fetchStats}
                className="px-3 py-1.5 text-sm font-medium text-neutral-500 dark:text-white/50 hover:text-neutral-700 dark:hover:text-white/70 rounded-lg transition-colors flex items-center gap-1.5 flex-shrink-0"
              >
                <RefreshCw className="w-4 h-4" />
                Actualizar
              </button>
            </div>
          </div>

          <div className="p-6">
            {activeTab === 'canales' && <CanalesNotificacion />}
            {activeTab === 'notificaciones' && <TiposNotificaciones onUpdate={fetchStats} />}
            {activeTab === 'historial' && <HistorialEnvios />}
          </div>
        </div>
      </div>
    </div>
  );
}
export default NotificacionesTransaccionales;
