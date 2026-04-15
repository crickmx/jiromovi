import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Mail, Settings, FileText, Send, CheckCircle2, XCircle, Clock, AlertCircle, RefreshCw, MessageCircle, LayoutGrid as Layout } from 'lucide-react';
import { ConfiguracionSMTP } from '../components/notificaciones/ConfiguracionSMTP';
import { ConfiguracionWhatsApp } from '../components/notificaciones/ConfiguracionWhatsApp';
import { TiposNotificaciones } from '../components/notificaciones/TiposNotificaciones';
import { HistorialEnvios } from '../components/notificaciones/HistorialEnvios';
import { EmailGlobalLayout } from '../components/notificaciones/EmailGlobalLayout';

type Tab = 'configuracion' | 'whatsapp' | 'notificaciones' | 'layout' | 'historial';

interface Config {
  id: string;
  tipo_integracion: 'smtp' | 'sendgrid' | 'resend';
  remitente_nombre: string;
  remitente_email: string;
  activo: boolean;
  estado_ultima_prueba: string | null;
  ultima_prueba: string | null;
  resend_api_key?: string;
}

interface Stats {
  total_enviados: number;
  total_fallidos: number;
  total_pendientes: number;
  tipos_activos: number;
}

export function NotificacionesTransaccionales() {
  const { usuario } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('configuracion');
  const [config, setConfig] = useState<Config | null>(null);
  const [whatsappConfig, setWhatsappConfig] = useState<any>(null);
  const [stats, setStats] = useState<Stats>({
    total_enviados: 0,
    total_fallidos: 0,
    total_pendientes: 0,
    tipos_activos: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (usuario?.rol === 'Administrador') {
      fetchData();
    }
  }, [usuario]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Obtener configuración
      const { data: configData } = await supabase
        .from('correo_configuracion')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (configData) {
        setConfig(configData);
      }

      // Obtener configuración WhatsApp
      const { data: whatsappData } = await supabase
        .from('whatsapp_configuracion')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (whatsappData) {
        setWhatsappConfig(whatsappData);
      }

      // Obtener estadísticas
      const { data: enviados } = await supabase
        .from('correo_historial_envios')
        .select('id', { count: 'exact', head: true })
        .eq('estado', 'enviado');

      const { data: fallidos } = await supabase
        .from('correo_historial_envios')
        .select('id', { count: 'exact', head: true })
        .eq('estado', 'fallido');

      const { data: pendientes } = await supabase
        .from('correo_historial_envios')
        .select('id', { count: 'exact', head: true })
        .eq('estado', 'pendiente');

      const { data: activos } = await supabase
        .from('correo_tipos_notificacion')
        .select('id', { count: 'exact', head: true })
        .eq('activo', true);

      setStats({
        total_enviados: (enviados as any)?.count || 0,
        total_fallidos: (fallidos as any)?.count || 0,
        total_pendientes: (pendientes as any)?.count || 0,
        tipos_activos: (activos as any)?.count || 0
      });
    } catch (error) {
      console.error('Error al cargar datos:', error);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-accent to-accent-dark rounded-2xl shadow-lg p-8 text-white">
        <div className="flex items-center gap-3 mb-2">
          <Mail className="w-8 h-8 text-white" />
          <h1 className="text-3xl font-bold text-white">Notificaciones Transaccionales</h1>
        </div>
        <p className="text-white opacity-90">
          Administra correos automáticos, plantillas y configuración SMTP
        </p>
      </div>

      {/* Estado de Configuración */}
      {!loading && (
        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-3 h-3 rounded-full ${config?.activo ? 'bg-emerald-500' : 'bg-neutral-300'}`} />
              <div>
                <h3 className="font-semibold text-neutral-800">
                  {config?.activo ? 'Sistema Activo' : 'Sistema Inactivo'}
                </h3>
                <p className="text-sm text-neutral-600">
                  {config
                    ? `${config.tipo_integracion.toUpperCase()} - ${config.remitente_email}`
                    : 'No hay configuración activa'
                  }
                </p>
              </div>
            </div>
            <button
              onClick={fetchData}
              className="px-4 py-2 text-sm font-medium text-accent hover:bg-primary-50 rounded-lg transition-colors flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Actualizar
            </button>
          </div>

          {config?.estado_ultima_prueba && (
            <div className="mt-4 pt-4 border-t border-neutral-200">
              <p className="text-sm text-neutral-600">
                <span className="font-medium">Última prueba:</span>{' '}
                {config.estado_ultima_prueba}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-600 mb-1">Enviados</p>
              <p className="text-2xl font-bold text-emerald-600">{stats.total_enviados}</p>
            </div>
            <CheckCircle2 className="w-10 h-10 text-emerald-500 opacity-20" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-600 mb-1">Fallidos</p>
              <p className="text-2xl font-bold text-accent-600">{stats.total_fallidos}</p>
            </div>
            <XCircle className="w-10 h-10 text-accent-500 opacity-20" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-600 mb-1">Pendientes</p>
              <p className="text-2xl font-bold text-amber-600">{stats.total_pendientes}</p>
            </div>
            <Clock className="w-10 h-10 text-amber-500 opacity-20" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-600 mb-1">Tipos Activos</p>
              <p className="text-2xl font-bold text-accent">{stats.tipos_activos}</p>
            </div>
            <Send className="w-10 h-10 text-accent opacity-20" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-neutral-200">
        <div className="border-b border-neutral-200">
          <div className="flex overflow-x-auto">
            <button
              onClick={() => setActiveTab('configuracion')}
              className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors whitespace-nowrap ${
                activeTab === 'configuracion'
                  ? 'text-accent border-b-2 border-accent'
                  : 'text-neutral-600 hover:text-neutral-800'
              }`}
            >
              <Settings className="w-5 h-5" />
              Configuración SMTP
            </button>
            <button
              onClick={() => setActiveTab('whatsapp')}
              className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors whitespace-nowrap ${
                activeTab === 'whatsapp'
                  ? 'text-accent border-b-2 border-accent'
                  : 'text-neutral-600 hover:text-neutral-800'
              }`}
            >
              <Send className="w-5 h-5" />
              WhatsApp
            </button>
            <button
              onClick={() => setActiveTab('notificaciones')}
              className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors whitespace-nowrap ${
                activeTab === 'notificaciones'
                  ? 'text-accent border-b-2 border-accent'
                  : 'text-neutral-600 hover:text-neutral-800'
              }`}
            >
              <FileText className="w-5 h-5" />
              Plantillas y Notificaciones
            </button>
            <button
              onClick={() => setActiveTab('layout')}
              className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors whitespace-nowrap ${
                activeTab === 'layout'
                  ? 'text-accent border-b-2 border-accent'
                  : 'text-neutral-600 hover:text-neutral-800'
              }`}
            >
              <Layout className="w-5 h-5" />
              Header y Footer
            </button>
            <button
              onClick={() => setActiveTab('historial')}
              className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors whitespace-nowrap ${
                activeTab === 'historial'
                  ? 'text-accent border-b-2 border-accent'
                  : 'text-neutral-600 hover:text-neutral-800'
              }`}
            >
              <Clock className="w-5 h-5" />
              Historial de Envíos
            </button>
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'configuracion' && (
            <ConfiguracionSMTP
              config={config}
              onConfigSaved={fetchData}
            />
          )}
          {activeTab === 'whatsapp' && (
            <ConfiguracionWhatsApp
              config={whatsappConfig}
              onConfigSaved={fetchData}
            />
          )}
          {activeTab === 'notificaciones' && (
            <TiposNotificaciones onUpdate={fetchData} />
          )}
          {activeTab === 'layout' && (
            <EmailGlobalLayout />
          )}
          {activeTab === 'historial' && (
            <HistorialEnvios />
          )}
        </div>
      </div>
    </div>
  );
}
