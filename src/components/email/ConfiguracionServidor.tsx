import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Send, Plus, Edit2, Trash2, X, Save, Eye, EyeOff, Bell } from 'lucide-react';

interface ConfiguracionSendGrid {
  id: string;
  api_key: string;
  email_remitente: string;
  nombre_remitente: string;
  activo: boolean;
}

interface ConfiguracionNotificacion {
  id: string;
  clave: string;
  valor: string;
  descripcion: string;
  activo: boolean;
}

export function ConfiguracionServidor() {
  const [configuraciones, setConfiguraciones] = useState<ConfiguracionSendGrid[]>([]);
  const [notificacionConfig, setNotificacionConfig] = useState<ConfiguracionNotificacion | null>(null);
  const [emailsNotificacion, setEmailsNotificacion] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingConfig, setEditingConfig] = useState<ConfiguracionSendGrid | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [savingNotif, setSavingNotif] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [formData, setFormData] = useState({
    api_key: '',
    email_remitente: '',
    nombre_remitente: '',
    activo: false,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [configRes, notifRes] = await Promise.all([
      supabase.from('configuracion_sendgrid').select('*'),
      supabase.from('configuracion_notificaciones').select('*').eq('clave', 'emails_notificaciones_internas').maybeSingle(),
    ]);

    if (configRes.error) {
      console.error('Error loading SendGrid configs:', configRes.error);
    } else {
      setConfiguraciones(configRes.data || []);
    }

    if (notifRes.data) {
      setNotificacionConfig(notifRes.data);
      setEmailsNotificacion(notifRes.data.valor || '');
    }

    setLoading(false);
  };

  const handleSaveNotificaciones = async () => {
    setSavingNotif(true);
    setMessage(null);

    try {
      if (notificacionConfig) {
        const { error } = await supabase
          .from('configuracion_notificaciones')
          .update({
            valor: emailsNotificacion,
            updated_at: new Date().toISOString(),
          })
          .eq('id', notificacionConfig.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('configuracion_notificaciones')
          .insert({
            clave: 'emails_notificaciones_internas',
            valor: emailsNotificacion,
            descripcion: 'Correos electrónicos que recibirán notificaciones cuando se da de alta un nuevo usuario',
            activo: true,
          });

        if (error) throw error;
      }

      setMessage({ type: 'success', text: 'Configuración de notificaciones guardada correctamente' });
      loadData();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setSavingNotif(false);
    }
  };

  const handleCreate = () => {
    setEditingConfig(null);
    setFormData({
      api_key: '',
      email_remitente: '',
      nombre_remitente: '',
      activo: false,
    });
    setShowModal(true);
  };

  const handleEdit = (config: ConfiguracionSendGrid) => {
    setEditingConfig(config);
    setFormData({
      api_key: '',
      email_remitente: config.email_remitente,
      nombre_remitente: config.nombre_remitente,
      activo: config.activo,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    setMessage(null);

    if (!formData.email_remitente || !formData.nombre_remitente) {
      setMessage({ type: 'error', text: 'Completa todos los campos requeridos' });
      return;
    }

    if (!editingConfig && !formData.api_key) {
      setMessage({ type: 'error', text: 'La API key es requerida' });
      return;
    }

    try {
      if (formData.activo) {
        await supabase
          .from('configuracion_sendgrid')
          .update({ activo: false })
          .neq('id', editingConfig?.id || '00000000-0000-0000-0000-000000000000');
      }

      const dataToSave: any = {
        email_remitente: formData.email_remitente,
        nombre_remitente: formData.nombre_remitente,
        activo: formData.activo,
        updated_at: new Date().toISOString(),
      };

      if (formData.api_key) {
        dataToSave.api_key = formData.api_key;
      }

      if (editingConfig) {
        const { error } = await supabase
          .from('configuracion_sendgrid')
          .update(dataToSave)
          .eq('id', editingConfig.id);

        if (error) throw error;
        setMessage({ type: 'success', text: 'Configuración actualizada correctamente' });
      } else {
        const { error } = await supabase
          .from('configuracion_sendgrid')
          .insert(dataToSave);

        if (error) throw error;
        setMessage({ type: 'success', text: 'Configuración creada correctamente' });
      }

      setShowModal(false);
      loadData();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta configuración?')) return;

    try {
      const { error } = await supabase
        .from('configuracion_sendgrid')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setMessage({ type: 'success', text: 'Configuración eliminada correctamente' });
      loadData();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const handleToggleActivo = async (config: ConfiguracionSendGrid) => {
    try {
      if (!config.activo) {
        await supabase
          .from('configuracion_sendgrid')
          .update({ activo: false })
          .neq('id', config.id);
      }

      const { error } = await supabase
        .from('configuracion_sendgrid')
        .update({
          activo: !config.activo,
          updated_at: new Date().toISOString(),
        })
        .eq('id', config.id);

      if (error) throw error;
      setMessage({ type: 'success', text: `Configuración ${!config.activo ? 'activada' : 'desactivada'}` });
      loadData();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div>
      {message && (
        <div
          className={`mb-6 px-4 py-3 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="mb-8 p-6 bg-amber-50 border border-amber-200 rounded-lg">
        <div className="flex items-start space-x-3 mb-4">
          <Bell className="w-6 h-6 text-amber-600 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-amber-900 mb-2">Notificaciones Internas</h3>
            <p className="text-sm text-amber-800 mb-4">
              Correo automático enviado a direcciones externas cuando se da de alta un nuevo usuario.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Correos de notificación (separar por coma)
            </label>
            <textarea
              value={emailsNotificacion}
              onChange={(e) => setEmailsNotificacion(e.target.value)}
              placeholder="admin@empresa.com, rh@empresa.com, gerencia@empresa.com"
              rows={3}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-slate-500 mt-1">
              Estos correos recibirán una notificación automática cada vez que se registre un nuevo usuario en el sistema
            </p>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSaveNotificaciones}
              disabled={savingNotif}
              className="flex items-center space-x-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg font-medium transition disabled:opacity-50"
            >
              <Save className="w-5 h-5" />
              <span>{savingNotif ? 'Guardando...' : 'Guardar Notificaciones'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start space-x-3">
          <Send className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-blue-900 mb-2">Configuración de SendGrid</h3>
            <p className="text-sm text-blue-800">
              Configura SendGrid para enviar correos electrónicos. Solo puede haber una configuración activa a la vez.
            </p>
          </div>
        </div>
      </div>

      <div className="mb-6 flex justify-end">
        <button
          onClick={handleCreate}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition"
        >
          <Plus className="w-5 h-5" />
          <span>Nueva Configuración</span>
        </button>
      </div>

      {configuraciones.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-lg">
          <Send className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <p className="text-slate-600">No hay configuraciones de SendGrid</p>
          <p className="text-sm text-slate-500 mt-2">Agrega tu API key de SendGrid para comenzar a enviar correos</p>
        </div>
      ) : (
        <div className="space-y-4">
          {configuraciones.map((config) => (
            <div
              key={config.id}
              className={`border rounded-lg p-6 ${
                config.activo
                  ? 'border-green-300 bg-green-50'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-3">
                    <h3 className="text-lg font-semibold text-slate-900">
                      SendGrid Configuration
                    </h3>
                    {config.activo && (
                      <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded">
                        Activo
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-slate-600">
                    <div>
                      <strong>API Key:</strong> {'•'.repeat(20)}
                    </div>
                    <div>
                      <strong>Remitente:</strong> {config.nombre_remitente} &lt;{config.email_remitente}&gt;
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2 ml-4">
                  <button
                    onClick={() => handleToggleActivo(config)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                      config.activo
                        ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }`}
                  >
                    {config.activo ? 'Desactivar' : 'Activar'}
                  </button>
                  <button
                    onClick={() => handleEdit(config)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                    title="Editar"
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDelete(config.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                    title="Eliminar"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white">
              <h2 className="text-xl font-bold text-slate-900">
                {editingConfig ? 'Editar Configuración de SendGrid' : 'Nueva Configuración de SendGrid'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                <strong>Nota:</strong> Necesitas una cuenta de SendGrid para obtener tu API key. Visita{' '}
                <a href="https://sendgrid.com" target="_blank" rel="noopener noreferrer" className="underline">
                  sendgrid.com
                </a>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  API Key de SendGrid {editingConfig && '(dejar vacío para mantener)'}
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={formData.api_key}
                    onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                    placeholder={editingConfig ? 'Nueva API key (opcional)' : 'SG.xxxxxxxxxxxx'}
                    className="w-full px-4 py-2 pr-12 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showApiKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Email Remitente *</label>
                <input
                  type="email"
                  value={formData.email_remitente}
                  onChange={(e) => setFormData({ ...formData, email_remitente: e.target.value })}
                  placeholder="noreply@tudominio.com"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Este email debe estar verificado en SendGrid
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Nombre Remitente *</label>
                <input
                  type="text"
                  value={formData.nombre_remitente}
                  onChange={(e) => setFormData({ ...formData, nombre_remitente: e.target.value })}
                  placeholder="Nuestra Empresa"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData.activo}
                  onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm text-slate-700">Activar esta configuración</span>
              </label>
            </div>

            <div className="px-6 py-4 bg-slate-50 rounded-b-2xl flex justify-end space-x-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
              >
                <Save className="w-5 h-5" />
                <span>Guardar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
