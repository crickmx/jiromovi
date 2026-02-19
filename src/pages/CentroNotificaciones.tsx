import { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Send, Users, Building2, UserCheck, Megaphone, Bell, CheckCircle, MessageCircle } from 'lucide-react';
import { crearNotificacionGlobal } from '../lib/notificationHelpers';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Oficina {
  id: string;
  nombre: string;
}

interface NotificacionGlobal {
  id: string;
  titulo: string;
  mensaje: string;
  accion_url: string | null;
  destinatarios: any;
  enviado_por: string;
  fecha_envio: string;
  enviador: { nombre: string; apellidos: string } | null;
}

export function CentroNotificaciones() {
  const { usuario } = useAuth();
  const [oficinas, setOficinas] = useState<Oficina[]>([]);
  const [historial, setHistorial] = useState<NotificacionGlobal[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const [formData, setFormData] = useState({
    titulo: '',
    mensaje: '',
    accion_url: '',
    tipo: 'todos' as 'todos' | 'oficina' | 'rol' | 'usuario',
    oficina_id: '',
    rol: '',
    user_id: '',
    enviar_whatsapp: false,
  });

  const roles = ['Administrador', 'Gerente', 'Empleado', 'Agente'];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch oficinas
      const { data: ofiData } = await supabase
        .from('oficinas')
        .select('id, nombre')
        .order('nombre');
      setOficinas(ofiData || []);

      // Fetch notification history
      const { data: histData } = await supabase
        .from('notificaciones_globales')
        .select(`
          *,
          enviador:enviado_por(nombre, apellidos)
        `)
        .order('fecha_envio', { ascending: false })
        .limit(50);

      setHistorial(histData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEnviar = async () => {
    if (!formData.titulo || !formData.mensaje) {
      showToast('Complete los campos requeridos', 'error');
      return;
    }

    if (!usuario) return;

    try {
      setSending(true);

      const destinatarios: any = {
        tipo: formData.tipo,
      };

      if (formData.tipo === 'oficina' && formData.oficina_id) {
        destinatarios.oficina_id = formData.oficina_id;
      } else if (formData.tipo === 'rol' && formData.rol) {
        destinatarios.rol = formData.rol;
      } else if (formData.tipo === 'usuario' && formData.user_id) {
        destinatarios.user_id = formData.user_id;
      }

      const result = await crearNotificacionGlobal(
        formData.titulo,
        formData.mensaje,
        formData.accion_url || null,
        destinatarios,
        usuario.id,
        formData.enviar_whatsapp
      );

      if (result.success) {
        showToast('Notificación enviada exitosamente', 'success');
        setFormData({
          titulo: '',
          mensaje: '',
          accion_url: '',
          tipo: 'todos',
          oficina_id: '',
          rol: '',
          user_id: '',
          enviar_whatsapp: false,
        });
        fetchData();
      } else {
        throw new Error('Failed to send notification');
      }
    } catch (error) {
      console.error('Error sending notification:', error);
      showToast('Error al enviar notificación', 'error');
    } finally {
      setSending(false);
    }
  };

  const getDestinatariosText = (destinatarios: any) => {
    if (!destinatarios) return 'Desconocido';

    if (destinatarios.tipo === 'todos') return 'Todos los usuarios';
    if (destinatarios.tipo === 'oficina') {
      const oficina = oficinas.find((o) => o.id === destinatarios.oficina_id);
      return `Oficina: ${oficina?.nombre || 'Desconocida'}`;
    }
    if (destinatarios.tipo === 'rol') return `Rol: ${destinatarios.rol}`;
    if (destinatarios.tipo === 'usuario') return 'Usuario específico';

    return 'Desconocido';
  };

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

  if (usuario?.rol !== 'Administrador') {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-neutral-600">
            Solo los administradores pueden acceder a esta página.
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-accent to-accent-dark rounded-2xl p-8 text-white">
          <div className="flex items-center gap-3 mb-2">
            <Megaphone className="w-8 h-8" />
            <h1 className="text-3xl font-bold text-white">Centro de Notificaciones Global</h1>
          </div>
          <p className="text-primary-100">
            Envía notificaciones personalizadas a usuarios, oficinas o roles específicos
          </p>
        </div>

        {/* Send Notification Form */}
        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
          <h2 className="text-xl font-bold text-neutral-800 mb-6 flex items-center gap-2">
            <Send className="w-5 h-5 text-accent" />
            Enviar Nueva Notificación
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-2">
                Título <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.titulo}
                onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-accent"
                placeholder="Ej: Nueva política interna"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-2">
                Mensaje <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.mensaje}
                onChange={(e) => setFormData({ ...formData, mensaje: e.target.value })}
                rows={4}
                className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-accent"
                placeholder="Escribe el mensaje de la notificación..."
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-2">
                Enlace o Acción (Opcional)
              </label>
              <input
                type="text"
                value={formData.accion_url}
                onChange={(e) => setFormData({ ...formData, accion_url: e.target.value })}
                className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-accent"
                placeholder="/vacaciones, /seguros-education, etc."
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-2">
                Destinatarios <span className="text-red-500">*</span>
              </label>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <button
                  onClick={() => setFormData({ ...formData, tipo: 'todos' })}
                  className={`p-4 border-2 rounded-lg transition-all ${
                    formData.tipo === 'todos'
                      ? 'border-accent bg-primary-50'
                      : 'border-neutral-200 hover:border-primary-300'
                  }`}
                >
                  <Users className="w-6 h-6 mx-auto mb-2 text-accent" />
                  <span className="text-sm font-medium">Todos</span>
                </button>

                <button
                  onClick={() => setFormData({ ...formData, tipo: 'oficina' })}
                  className={`p-4 border-2 rounded-lg transition-all ${
                    formData.tipo === 'oficina'
                      ? 'border-accent bg-primary-50'
                      : 'border-neutral-200 hover:border-primary-300'
                  }`}
                >
                  <Building2 className="w-6 h-6 mx-auto mb-2 text-accent" />
                  <span className="text-sm font-medium">Oficina</span>
                </button>

                <button
                  onClick={() => setFormData({ ...formData, tipo: 'rol' })}
                  className={`p-4 border-2 rounded-lg transition-all ${
                    formData.tipo === 'rol'
                      ? 'border-accent bg-primary-50'
                      : 'border-neutral-200 hover:border-primary-300'
                  }`}
                >
                  <UserCheck className="w-6 h-6 mx-auto mb-2 text-accent" />
                  <span className="text-sm font-medium">Rol</span>
                </button>

                <button
                  onClick={() => setFormData({ ...formData, tipo: 'usuario' })}
                  className={`p-4 border-2 rounded-lg transition-all ${
                    formData.tipo === 'usuario'
                      ? 'border-accent bg-primary-50'
                      : 'border-neutral-200 hover:border-primary-300'
                  }`}
                >
                  <Bell className="w-6 h-6 mx-auto mb-2 text-accent" />
                  <span className="text-sm font-medium">Usuario</span>
                </button>
              </div>

              {formData.tipo === 'oficina' && (
                <select
                  value={formData.oficina_id}
                  onChange={(e) => setFormData({ ...formData, oficina_id: e.target.value })}
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-accent"
                >
                  <option value="">Seleccionar oficina</option>
                  {oficinas.map((ofi) => (
                    <option key={ofi.id} value={ofi.id}>
                      {ofi.nombre}
                    </option>
                  ))}
                </select>
              )}

              {formData.tipo === 'rol' && (
                <select
                  value={formData.rol}
                  onChange={(e) => setFormData({ ...formData, rol: e.target.value })}
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-accent"
                >
                  <option value="">Seleccionar rol</option>
                  {roles.map((rol) => (
                    <option key={rol} value={rol}>
                      {rol}
                    </option>
                  ))}
                </select>
              )}

              {formData.tipo === 'usuario' && (
                <p className="text-sm text-neutral-500 mt-2">
                  Esta función requiere buscar usuarios. Por ahora, usa oficina o rol.
                </p>
              )}
            </div>

            {/* Canales de Envío */}
            <div className="border-t border-neutral-200 pt-4">
              <label className="block text-sm font-semibold text-neutral-700 mb-3">
                Canales de Envío
              </label>

              <div className="space-y-3">
                {/* Notificación Push (siempre activa) */}
                <div className="flex items-start gap-3 p-3 bg-primary-50 border border-primary-200 rounded-lg">
                  <Bell className="w-5 h-5 text-accent mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-primary-900">Notificación Push (Campanita)</span>
                      <span className="px-2 py-0.5 bg-accent text-white text-xs rounded-full">Siempre</span>
                    </div>
                    <p className="text-xs text-primary-700 mt-1">
                      Se enviará una notificación en el sistema a todos los destinatarios seleccionados
                    </p>
                  </div>
                </div>

                {/* WhatsApp Opcional */}
                <div className={`flex items-start gap-3 p-3 border rounded-lg transition-colors ${
                  formData.enviar_whatsapp
                    ? 'bg-emerald-50 border-emerald-200'
                    : 'bg-neutral-50 border-neutral-200'
                }`}>
                  <MessageCircle className={`w-5 h-5 mt-0.5 ${
                    formData.enviar_whatsapp ? 'text-emerald-600' : 'text-neutral-400'
                  }`} />
                  <div className="flex-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.enviar_whatsapp}
                        onChange={(e) => setFormData({ ...formData, enviar_whatsapp: e.target.checked })}
                        className="w-4 h-4 text-emerald-600 border-neutral-300 rounded focus:ring-2 focus:ring-emerald-500"
                      />
                      <span className={`font-medium ${
                        formData.enviar_whatsapp ? 'text-emerald-900' : 'text-neutral-700'
                      }`}>
                        Enviar también por WhatsApp
                      </span>
                    </label>
                    <p className={`text-xs mt-1 ${
                      formData.enviar_whatsapp ? 'text-emerald-700' : 'text-neutral-500'
                    }`}>
                      {formData.enviar_whatsapp
                        ? 'Se enviará el mensaje por WhatsApp a todos los usuarios que tengan número de teléfono'
                        : 'Marca esta opción para enviar el mensaje también por WhatsApp'
                      }
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                onClick={handleEnviar}
                disabled={sending || !formData.titulo || !formData.mensaje}
                className="flex items-center gap-2 px-6 py-3 bg-accent text-white font-semibold rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? (
                  <>Enviando...</>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Enviar Notificación
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Notification History */}
        <div className="bg-white rounded-xl shadow-sm border border-neutral-200">
          <div className="p-6 border-b border-neutral-200">
            <h2 className="text-xl font-bold text-neutral-800 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-accent" />
              Historial de Notificaciones Enviadas
            </h2>
          </div>

          <div className="p-6">
            {loading ? (
              <p className="text-center text-neutral-500 py-8">Cargando...</p>
            ) : historial.length === 0 ? (
              <p className="text-center text-neutral-500 py-8">
                No se han enviado notificaciones globales
              </p>
            ) : (
              <div className="space-y-4">
                {historial.map((notif) => (
                  <div
                    key={notif.id}
                    className="p-4 bg-neutral-50 rounded-lg border border-neutral-200"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-neutral-800">{notif.titulo}</h3>
                      <span className="text-xs text-neutral-500">
                        {format(new Date(notif.fecha_envio), "dd MMM yyyy 'a las' HH:mm", {
                          locale: es,
                        })}
                      </span>
                    </div>
                    <p className="text-sm text-neutral-600 mb-3">{notif.mensaje}</p>
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-4">
                        <span className="text-neutral-500">
                          Enviado por:{' '}
                          <span className="font-medium text-neutral-700">
                            {notif.enviador
                              ? `${notif.enviador.nombre} ${notif.enviador.apellidos}`
                              : 'Desconocido'}
                          </span>
                        </span>
                        <span className="text-neutral-500">
                          Destinatarios:{' '}
                          <span className="font-medium text-neutral-700">
                            {getDestinatariosText(notif.destinatarios)}
                          </span>
                        </span>
                      </div>
                      {notif.accion_url && (
                        <span className="px-2 py-1 bg-primary-100 text-primary-700 rounded">
                          Con enlace
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
